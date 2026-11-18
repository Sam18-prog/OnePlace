import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AppNotification,
  NotificationPreferences,
  NotificationType,
} from '../types/notification';
import {
  createDefaultNotificationPreferences,
  NOTIFICATION_PAGE_SIZE,
  sanitizeNotificationPreferences,
} from '../utils/notificationValidation';
import type { SchoolAnnouncementRecord } from '../utils/starterNotifications';

const VALID_TYPES: NotificationType[] = [
  'event_update',
  'club_activity',
  'event_reminder',
  'announcement',
  'rsvp_update',
];

function parseDate(value: unknown, fallback: Date = new Date()): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return fallback;
}

export function mapNotificationDoc(id: string, data: DocumentData): AppNotification | null {
  if (
    typeof data.recipientUid !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.message !== 'string'
  ) {
    return null;
  }

  const type: NotificationType = VALID_TYPES.includes(data.type) ? data.type : 'event_update';
  const entityType =
    data.entityType === 'club' || data.entityType === 'school' ? data.entityType : 'event';
  const status = data.status === 'read' ? 'read' : 'unread';

  return {
    id: typeof data.id === 'string' && data.id ? data.id : id,
    recipientUid: data.recipientUid,
    schoolId: typeof data.schoolId === 'string' ? data.schoolId : '',
    type,
    title: data.title,
    message: data.message,
    createdAt: parseDate(data.createdAt),
    readAt: data.readAt ? parseDate(data.readAt) : undefined,
    entityType,
    entityId: typeof data.entityId === 'string' ? data.entityId : '',
    actionUrl: typeof data.actionUrl === 'string' ? data.actionUrl : undefined,
    status,
    dedupKey: typeof data.dedupKey === 'string' ? data.dedupKey : id,
  };
}

export function subscribeToNotifications(params: {
  uid: string;
  pageLimit?: number;
  onNotifications: (items: AppNotification[], hasMore: boolean) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { uid, pageLimit = NOTIFICATION_PAGE_SIZE, onNotifications, onError } = params;
  const colRef = collection(db, 'users', uid, 'notifications');
  const fetchLimit = Math.max(pageLimit, NOTIFICATION_PAGE_SIZE);
  // Equality filter matches firestore.rules list invariant without requiring a composite index
  const q = query(colRef, where('recipientUid', '==', uid), limit(fetchLimit));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AppNotification[] = [];
      snapshot.forEach((docSnap) => {
        const mapped = mapNotificationDoc(docSnap.id, docSnap.data());
        if (mapped) items.push(mapped);
      });
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onNotifications(items.slice(0, pageLimit), snapshot.size >= fetchLimit);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/notifications`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToSchoolAnnouncements(params: {
  schoolId: string;
  enabled: boolean;
  onAnnouncements: (items: SchoolAnnouncementRecord[]) => void;
}): Unsubscribe {
  const { schoolId, enabled, onAnnouncements } = params;
  if (!enabled || !schoolId) {
    onAnnouncements([]);
    return () => {};
  }

  const colRef = collection(db, 'schools', schoolId, 'announcements');
  const q = query(colRef, where('schoolId', '==', schoolId), limit(30));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SchoolAnnouncementRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (typeof data.title !== 'string' || typeof data.message !== 'string') return;
        list.push({
          id: typeof data.id === 'string' && data.id ? data.id : docSnap.id,
          schoolId: typeof data.schoolId === 'string' ? data.schoolId : schoolId,
          title: data.title,
          message: data.message,
          priority: data.priority === 'important' ? 'important' : 'normal',
          createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
          createdAt: parseDate(data.createdAt),
        });
      });
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onAnnouncements(list);
    },
    () => {
      // Gracefully fall back if membership mirror doc has not been initialized yet
      onAnnouncements([]);
    }
  );
}

export async function markNotificationAsRead(uid: string, notificationId: string): Promise<void> {
  const path = `users/${uid}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), {
      status: 'read',
      readAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsAsRead(
  uid: string,
  notifications: AppNotification[]
): Promise<number> {
  const unreadIds = notifications.filter((n) => n.status === 'unread').map((n) => n.id);
  if (unreadIds.length === 0) return 0;

  const chunkSize = 400;
  let updated = 0;

  try {
    for (let i = 0; i < unreadIds.length; i += chunkSize) {
      const chunk = unreadIds.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.update(doc(db, 'users', uid, 'notifications', id), {
          status: 'read',
          readAt: serverTimestamp(),
        });
      }
      await batch.commit();
      updated += chunk.length;
    }
    return updated;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/notifications`);
  }
}

export function subscribeToNotificationPreferences(params: {
  uid: string;
  schoolId: string;
  onPreferences: (prefs: NotificationPreferences) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { uid, schoolId, onPreferences, onError } = params;
  const prefRef = doc(db, 'users', uid, 'notificationPreferences', 'settings');

  return onSnapshot(
    prefRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onPreferences(createDefaultNotificationPreferences(uid, schoolId));
        return;
      }
      const data = snapshot.data();
      const sanitized = sanitizeNotificationPreferences(
        {
          reminder24h: data.reminder24h,
          reminder1h: data.reminder1h,
          clubNewEvents: data.clubNewEvents,
          clubEventUpdates: data.clubEventUpdates,
          schoolAnnouncements: data.schoolAnnouncements,
          importantNotices: data.importantNotices,
          inAppEnabled: data.inAppEnabled,
          pushEnabled: data.pushEnabled,
          interestCategories: data.interestCategories,
          updatedAt: data.updatedAt ? parseDate(data.updatedAt) : undefined,
        },
        uid,
        schoolId
      );
      onPreferences(sanitized);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `users/${uid}/notificationPreferences/settings`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveNotificationPreferences(
  uid: string,
  schoolId: string,
  prefs: NotificationPreferences
): Promise<void> {
  const path = `users/${uid}/notificationPreferences/settings`;
  const clean = sanitizeNotificationPreferences(prefs, uid, schoolId);

  try {
    await setDoc(
      doc(db, 'users', uid, 'notificationPreferences', 'settings'),
      {
        uid,
        schoolId,
        reminder24h: clean.reminder24h,
        reminder1h: clean.reminder1h,
        clubNewEvents: clean.clubNewEvents,
        clubEventUpdates: clean.clubEventUpdates,
        schoolAnnouncements: clean.schoolAnnouncements,
        importantNotices: clean.importantNotices,
        inAppEnabled: clean.inAppEnabled,
        pushEnabled: clean.pushEnabled,
        interestCategories: clean.interestCategories,
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function publishSchoolAnnouncement(params: {
  schoolId: string;
  title: string;
  message: string;
  priority: 'normal' | 'important';
  adminUid: string;
}): Promise<string> {
  const cleanTitle = params.title.trim().slice(0, 120);
  const cleanMessage = params.message.trim().slice(0, 380);
  if (cleanTitle.length < 3) {
    throw new Error('Announcement title must be at least 3 characters.');
  }
  if (cleanMessage.length < 5) {
    throw new Error('Announcement message must be at least 5 characters.');
  }

  const rand = Math.random().toString(36).slice(2, 8);
  const announcementId = `ann_${Date.now().toString(36)}_${rand}`;
  const path = `schools/${params.schoolId}/announcements/${announcementId}`;

  try {
    await setDoc(doc(db, 'schools', params.schoolId, 'announcements', announcementId), {
      id: announcementId,
      schoolId: params.schoolId,
      title: cleanTitle,
      message: cleanMessage,
      priority: params.priority,
      createdBy: params.adminUid,
      createdAt: serverTimestamp(),
    });
    return announcementId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}
