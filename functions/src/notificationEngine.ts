import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c';

const app = getApps().length > 0 ? getApps()[0] : initializeApp();
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
export const messaging = getMessaging(app);

export type NotificationType =
  | 'event_update'
  | 'club_activity'
  | 'event_reminder'
  | 'announcement'
  | 'rsvp_update';

export type NotificationJobType =
  | 'event_published'
  | 'event_updated'
  | 'event_cancelled'
  | 'club_announcement'
  | 'school_announcement'
  | 'reminder_24h'
  | 'reminder_1h';

export interface UserNotificationPrefsDoc {
  reminder24h: boolean;
  reminder1h: boolean;
  clubNewEvents: boolean;
  clubEventUpdates: boolean;
  schoolAnnouncements: boolean;
  importantNotices: boolean;
  inAppEnabled: boolean;
  pushEnabled: boolean;
}

const DEFAULT_PREFS: UserNotificationPrefsDoc = {
  reminder24h: true,
  reminder1h: true,
  clubNewEvents: true,
  clubEventUpdates: true,
  schoolAnnouncements: true,
  importantNotices: true,
  inAppEnabled: true,
  pushEnabled: false,
};

export function buildDedupId(rawKey: string): string {
  const clean = rawKey
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (clean.length > 0 && clean.length <= 120) return clean;
  let hash = 2166136261;
  for (let i = 0; i < rawKey.length; i += 1) {
    hash ^= rawKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36);
  return `${clean.slice(0, 100)}_${suffix}`.slice(0, 120);
}

export function formatEventStartTime(startAt: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'America/Los_Angeles',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(startAt);
  } catch {
    return startAt.toUTCString();
  }
}

export type PrefFlagKey = keyof Pick<
  UserNotificationPrefsDoc,
  | 'reminder24h'
  | 'reminder1h'
  | 'clubNewEvents'
  | 'clubEventUpdates'
  | 'schoolAnnouncements'
  | 'importantNotices'
>;

export async function getUserPreferences(uid: string): Promise<UserNotificationPrefsDoc> {
  const snap = await db.doc(`users/${uid}/notificationPreferences/settings`).get();
  if (!snap.exists) return DEFAULT_PREFS;
  const d = snap.data() || {};
  return {
    reminder24h: typeof d.reminder24h === 'boolean' ? d.reminder24h : DEFAULT_PREFS.reminder24h,
    reminder1h: typeof d.reminder1h === 'boolean' ? d.reminder1h : DEFAULT_PREFS.reminder1h,
    clubNewEvents:
      typeof d.clubNewEvents === 'boolean' ? d.clubNewEvents : DEFAULT_PREFS.clubNewEvents,
    clubEventUpdates:
      typeof d.clubEventUpdates === 'boolean' ? d.clubEventUpdates : DEFAULT_PREFS.clubEventUpdates,
    schoolAnnouncements:
      typeof d.schoolAnnouncements === 'boolean'
        ? d.schoolAnnouncements
        : DEFAULT_PREFS.schoolAnnouncements,
    importantNotices:
      typeof d.importantNotices === 'boolean' ? d.importantNotices : DEFAULT_PREFS.importantNotices,
    inAppEnabled:
      typeof d.inAppEnabled === 'boolean' ? d.inAppEnabled : DEFAULT_PREFS.inAppEnabled,
    pushEnabled: typeof d.pushEnabled === 'boolean' ? d.pushEnabled : DEFAULT_PREFS.pushEnabled,
  };
}

export async function canUserReceiveVisibility(
  uid: string,
  schoolId: string,
  visibility: string
): Promise<boolean> {
  if (visibility !== 'school') return true;
  const memberSnap = await db.doc(`schools/${schoolId}/members/${uid}`).get();
  return memberSnap.exists && memberSnap.data()?.status === 'active';
}

interface DispatchPayload {
  schoolId: string;
  jobType: NotificationJobType;
  jobDedupKey: string;
  recipientUids: string[];
  type: NotificationType;
  prefKey: PrefFlagKey;
  title: string;
  message: string;
  entityType: 'event' | 'club' | 'school';
  entityId: string;
  actionUrl: string;
  visibility?: string;
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

async function sendPushToUserDevices(params: {
  uid: string;
  title: string;
  message: string;
  actionUrl: string;
  dedupKey: string;
}): Promise<number> {
  const tokensSnap = await db
    .collection(`users/${params.uid}/deviceTokens`)
    .where('enabled', '==', true)
    .get();

  if (tokensSnap.empty) return 0;

  const docs = tokensSnap.docs.filter((d) => typeof d.data().token === 'string');
  if (docs.length === 0) return 0;

  const tokens = docs.map((d) => String(d.data().token));
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: params.title,
      body: params.message,
    },
    data: {
      title: params.title,
      body: params.message,
      actionUrl: params.actionUrl,
      dedupKey: params.dedupKey,
    },
  });

  // Clean up expired or revoked FCM device tokens immediately
  const cleanupBatch = db.batch();
  let cleanupCount = 0;
  response.responses.forEach((res, idx) => {
    const code = res.error?.code;
    if (!res.success && code && INVALID_TOKEN_CODES.has(code)) {
      cleanupBatch.delete(docs[idx].ref);
      cleanupCount += 1;
    }
  });
  if (cleanupCount > 0) {
    await cleanupBatch.commit();
  }

  return response.successCount;
}

export async function dispatchNotificationBatch(payload: DispatchPayload): Promise<{
  inAppSent: number;
  pushSent: number;
}> {
  const uniqueUids = Array.from(new Set(payload.recipientUids.filter(Boolean)));
  const jobId = buildDedupId(payload.jobDedupKey);
  const jobRef = db.doc(`schools/${payload.schoolId}/notificationJobs/${jobId}`);

  // Atomic idempotency claim on notificationJobs
  try {
    await jobRef.create({
      jobId,
      schoolId: payload.schoolId,
      jobType: payload.jobType,
      entityType: payload.entityType,
      entityId: payload.entityId,
      dedupKey: payload.jobDedupKey,
      status: 'processing',
      attempts: 1,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: unknown) {
    // Already exists (ALREADY_EXISTS code 6) -> skip duplicate trigger execution
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number | string }).code === 6
    ) {
      return { inAppSent: 0, pushSent: 0 };
    }
    throw err;
  }

  let inAppSent = 0;
  let pushSent = 0;

  try {
    const chunkSize = 50;
    for (let i = 0; i < uniqueUids.length; i += chunkSize) {
      const chunk = uniqueUids.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (uid) => {
          if (payload.visibility) {
            const visible = await canUserReceiveVisibility(
              uid,
              payload.schoolId,
              payload.visibility
            );
            if (!visible) return;
          }

          const prefs = await getUserPreferences(uid);
          const categoryAllowed = prefs[payload.prefKey];
          if (!categoryAllowed) return;

          const dedupKey = buildDedupId(`${payload.jobDedupKey}_${uid}`);

          if (prefs.inAppEnabled) {
            const notifRef = db.doc(`users/${uid}/notifications/${dedupKey}`);
            try {
              await notifRef.create({
                id: dedupKey,
                recipientUid: uid,
                schoolId: payload.schoolId,
                type: payload.type,
                title: payload.title.slice(0, 140),
                message: payload.message.slice(0, 400),
                createdAt: FieldValue.serverTimestamp(),
                entityType: payload.entityType,
                entityId: payload.entityId,
                actionUrl: payload.actionUrl.slice(0, 240),
                status: 'unread',
                dedupKey,
              });
              inAppSent += 1;
            } catch {
              // Ignore duplicate notification doc
            }
          }

          if (prefs.pushEnabled) {
            const sent = await sendPushToUserDevices({
              uid,
              title: payload.title.slice(0, 140),
              message: payload.message.slice(0, 400),
              actionUrl: payload.actionUrl,
              dedupKey,
            });
            pushSent += sent;
          }
        })
      );
    }

    await jobRef.update({
      status: 'completed',
      recipientCount: inAppSent,
      pushSentCount: pushSent,
      processedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    await jobRef.update({
      status: 'failed',
      lastError: (err instanceof Error ? err.message : String(err)).slice(0, 300),
      processedAt: FieldValue.serverTimestamp(),
    });
    throw err;
  }

  return { inAppSent, pushSent };
}

export async function getClubFollowerUids(schoolId: string, clubId: string): Promise<string[]> {
  const snap = await db
    .collection(`schools/${schoolId}/clubs/${clubId}/followers`)
    .where('notificationsEnabled', '==', true)
    .get();
  return snap.docs.map((d) => d.id);
}

export async function getEventAttendeeUids(eventId: string): Promise<string[]> {
  const snap = await db.collection(`events/${eventId}/attendees`).get();
  return snap.docs.map((d) => d.id);
}

export async function getActiveSchoolMemberUids(schoolId: string): Promise<string[]> {
  const snap = await db
    .collection(`schools/${schoolId}/members`)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d) => d.id);
}

export function detectMeaningfulEventDiff(
  before: DocumentData | undefined,
  after: DocumentData
): {
  kind: 'none' | 'published' | 'cancelled' | 'updated';
  summary: string;
} {
  const afterStatus = after.status;
  const beforeStatus = before?.status;

  if (!before) {
    return afterStatus === 'published'
      ? { kind: 'published', summary: 'New event published.' }
      : { kind: 'none', summary: '' };
  }

  if (beforeStatus !== 'cancelled' && afterStatus === 'cancelled') {
    const reason =
      typeof after.cancellationReason === 'string' && after.cancellationReason.trim()
        ? ` Reason: ${after.cancellationReason.trim()}`
        : '';
    return {
      kind: 'cancelled',
      summary: `${String(after.title || 'Event')} has been cancelled.${reason}`,
    };
  }

  if (beforeStatus !== 'published' && afterStatus === 'published') {
    return { kind: 'published', summary: 'New event published.' };
  }

  if (beforeStatus !== 'published' || afterStatus !== 'published') {
    return { kind: 'none', summary: '' };
  }

  const changed: string[] = [];
  if (String(before.title || '').trim() !== String(after.title || '').trim()) {
    changed.push('title');
  }
  const beforeStart = before.startAt instanceof Timestamp ? before.startAt.toMillis() : 0;
  const afterStart = after.startAt instanceof Timestamp ? after.startAt.toMillis() : 0;
  if (beforeStart !== afterStart) changed.push('start time');

  const beforeEnd = before.endAt instanceof Timestamp ? before.endAt.toMillis() : 0;
  const afterEnd = after.endAt instanceof Timestamp ? after.endAt.toMillis() : 0;
  if (beforeEnd !== afterEnd && !changed.includes('start time')) changed.push('end time');

  if (String(before.location || '').trim() !== String(after.location || '').trim()) {
    changed.push('location');
  }
  if (before.visibility !== after.visibility) {
    changed.push('audience visibility');
  }

  if (changed.length === 0) {
    return { kind: 'none', summary: '' };
  }

  return {
    kind: 'updated',
    summary: `Updated ${changed.join(', ')} for ${String(after.title || 'this event')}.`,
  };
}
