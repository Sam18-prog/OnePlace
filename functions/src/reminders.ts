import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  buildDedupId,
  db,
  dispatchNotificationBatch,
  formatEventStartTime,
  getEventAttendeeUids,
} from './notificationEngine';

export async function runScheduledRemindersJob(now: Date = new Date()): Promise<{
  checkedEvents: number;
  remindersDispatched: number;
}> {
  const windowStart = new Date(now.getTime() + 45 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24.25 * 60 * 60 * 1000);

  const upcomingSnap = await db
    .collection('events')
    .where('status', '==', 'published')
    .where('startAt', '>=', Timestamp.fromDate(windowStart))
    .where('startAt', '<=', Timestamp.fromDate(windowEnd))
    .get();

  let remindersDispatched = 0;

  for (const eventDoc of upcomingSnap.docs) {
    const data = eventDoc.data();
    const startTs = data.startAt;
    if (!(startTs instanceof Timestamp)) continue;

    const startAt = startTs.toDate();
    const diffMs = startAt.getTime() - now.getTime();
    if (diffMs <= 0) continue;

    let windowType: '24h' | '1h' | null = null;
    if (diffMs >= 23.5 * 60 * 60 * 1000 && diffMs <= 24.25 * 60 * 60 * 1000) {
      windowType = '24h';
    } else if (diffMs >= 45 * 60 * 1000 && diffMs <= 75 * 60 * 1000) {
      windowType = '1h';
    }

    if (!windowType) continue;

    const attendeeUids = await getEventAttendeeUids(eventDoc.id);
    if (attendeeUids.length === 0) continue;

    const schoolId = String(data.schoolId || 'oakridge-high');
    const timezone = String(data.timezone || 'America/Los_Angeles');
    const startFormatted = formatEventStartTime(startAt, timezone);
    const location = String(data.location || 'Campus');
    const title = String(data.title || 'Upcoming Event');

    const jobDedupKey = buildDedupId(
      `rem_${windowType}_${eventDoc.id}_${startAt.getTime()}`
    );

    const res = await dispatchNotificationBatch({
      schoolId,
      jobType: windowType === '24h' ? 'reminder_24h' : 'reminder_1h',
      jobDedupKey,
      recipientUids: attendeeUids,
      type: 'event_reminder',
      prefKey: windowType === '24h' ? 'reminder24h' : 'reminder1h',
      title:
        windowType === '24h'
          ? `Tomorrow: ${title}`
          : `Starting in 1 hour: ${title}`,
      message: `${startFormatted} at ${location}.`,
      entityType: 'event',
      entityId: eventDoc.id,
      actionUrl: `/?view=event&id=${eventDoc.id}`,
      visibility: String(data.visibility || 'public'),
    });

    remindersDispatched += res.inAppSent;
  }

  return {
    checkedEvents: upcomingSnap.size,
    remindersDispatched,
  };
}

export async function runNotificationCleanupJob(now: Date = new Date()): Promise<void> {
  const cutoffRead = Timestamp.fromDate(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000));
  const staleSnap = await db
    .collectionGroup('notifications')
    .where('status', '==', 'read')
    .where('createdAt', '<', cutoffRead)
    .limit(400)
    .get();

  if (!staleSnap.empty) {
    const batch = db.batch();
    staleSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }

  const cutoffTokens = Timestamp.fromDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
  const oldDisabledTokens = await db
    .collectionGroup('deviceTokens')
    .where('enabled', '==', false)
    .where('updatedAt', '<', cutoffTokens)
    .limit(200)
    .get();

  if (!oldDisabledTokens.empty) {
    const batch = db.batch();
    oldDisabledTokens.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }

  // Keep server timestamp import referenced if needed cleanly
  void FieldValue;
}
