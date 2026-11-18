import type { EventCategory, EventStatus, EventVisibility, SchoolEvent } from '../types/event';
import type {
  AppNotification,
  NotificationPreferences,
  NotificationType,
  PushPermissionState,
} from '../types/notification';
import { ALL_EVENT_CATEGORIES } from './eventValidation';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  event_update: 'Event Updates',
  club_activity: 'Club Activity',
  event_reminder: 'Event Reminders',
  announcement: 'Announcements',
  rsvp_update: 'RSVP Updates',
};

export type NotificationFilterOption = 'all' | 'unread' | NotificationType;

export const NOTIFICATION_PAGE_SIZE = 15;

export function createDefaultNotificationPreferences(
  uid: string,
  schoolId: string
): NotificationPreferences {
  return {
    uid,
    schoolId,
    reminder24h: true,
    reminder1h: true,
    clubNewEvents: true,
    clubEventUpdates: true,
    schoolAnnouncements: true,
    importantNotices: true,
    inAppEnabled: true,
    pushEnabled: false,
    interestCategories: [],
  };
}

export function sanitizeInterestCategories(raw: unknown): EventCategory[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<EventCategory>();
  for (const item of raw) {
    if (typeof item === 'string' && ALL_EVENT_CATEGORIES.includes(item as EventCategory)) {
      unique.add(item as EventCategory);
    }
    if (unique.size >= ALL_EVENT_CATEGORIES.length) break;
  }
  return Array.from(unique);
}

export function sanitizeNotificationPreferences(
  raw: Partial<NotificationPreferences> | null | undefined,
  uid: string,
  schoolId: string
): NotificationPreferences {
  const defaults = createDefaultNotificationPreferences(uid, schoolId);
  if (!raw) return defaults;

  return {
    uid,
    schoolId,
    reminder24h: typeof raw.reminder24h === 'boolean' ? raw.reminder24h : defaults.reminder24h,
    reminder1h: typeof raw.reminder1h === 'boolean' ? raw.reminder1h : defaults.reminder1h,
    clubNewEvents:
      typeof raw.clubNewEvents === 'boolean' ? raw.clubNewEvents : defaults.clubNewEvents,
    clubEventUpdates:
      typeof raw.clubEventUpdates === 'boolean' ? raw.clubEventUpdates : defaults.clubEventUpdates,
    schoolAnnouncements:
      typeof raw.schoolAnnouncements === 'boolean'
        ? raw.schoolAnnouncements
        : defaults.schoolAnnouncements,
    importantNotices:
      typeof raw.importantNotices === 'boolean' ? raw.importantNotices : defaults.importantNotices,
    inAppEnabled: typeof raw.inAppEnabled === 'boolean' ? raw.inAppEnabled : defaults.inAppEnabled,
    pushEnabled: typeof raw.pushEnabled === 'boolean' ? raw.pushEnabled : defaults.pushEnabled,
    interestCategories: sanitizeInterestCategories(raw.interestCategories),
    updatedAt: raw.updatedAt,
  };
}

export function applyEnableAllPreferences(
  current: NotificationPreferences,
  pushPermission: PushPermissionState = 'default',
  vapidConfigured: boolean = true
): NotificationPreferences {
  return {
    ...current,
    reminder24h: true,
    reminder1h: true,
    clubNewEvents: true,
    clubEventUpdates: true,
    schoolAnnouncements: true,
    importantNotices: true,
    inAppEnabled: true,
    pushEnabled: vapidConfigured && pushPermission === 'granted',
  };
}

export function applyDisableAllPreferences(
  current: NotificationPreferences
): NotificationPreferences {
  return {
    ...current,
    reminder24h: false,
    reminder1h: false,
    clubNewEvents: false,
    clubEventUpdates: false,
    schoolAnnouncements: false,
    importantNotices: false,
    inAppEnabled: false,
    pushEnabled: false,
  };
}

export type NotificationPreferenceKey =
  | 'reminder_24h'
  | 'reminder_1h'
  | 'club_new_event'
  | 'club_event_update'
  | 'school_announcement'
  | 'important_notice';

export function shouldDeliverInAppNotification(
  prefs: NotificationPreferences,
  reasonKey: NotificationPreferenceKey
): boolean {
  if (!prefs.inAppEnabled) return false;
  switch (reasonKey) {
    case 'reminder_24h':
      return prefs.reminder24h;
    case 'reminder_1h':
      return prefs.reminder1h;
    case 'club_new_event':
      return prefs.clubNewEvents;
    case 'club_event_update':
      return prefs.clubEventUpdates;
    case 'school_announcement':
      return prefs.schoolAnnouncements;
    case 'important_notice':
      return prefs.importantNotices;
    default:
      return false;
  }
}

export function shouldDeliverPushNotification(
  prefs: NotificationPreferences,
  reasonKey: NotificationPreferenceKey
): boolean {
  if (!prefs.pushEnabled) return false;
  switch (reasonKey) {
    case 'reminder_24h':
      return prefs.reminder24h;
    case 'reminder_1h':
      return prefs.reminder1h;
    case 'club_new_event':
      return prefs.clubNewEvents;
    case 'club_event_update':
      return prefs.clubEventUpdates;
    case 'school_announcement':
      return prefs.schoolAnnouncements;
    case 'important_notice':
      return prefs.importantNotices;
    default:
      return false;
  }
}

/**
 * Produces a deterministic, Firestore-ID-safe dedup identifier (max 120 chars)
 * so concurrent triggers or scheduler retries never deliver duplicate notifications.
 */
export function buildSafeDedupId(rawKey: string): string {
  const clean = rawKey
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (clean.length <= 120 && clean.length > 0) {
    return clean;
  }
  let hash = 2166136261;
  for (let i = 0; i < rawKey.length; i += 1) {
    hash ^= rawKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36);
  return `${clean.slice(0, 100)}_${suffix}`.slice(0, 120);
}

export function buildReminderDedupKey(
  eventId: string,
  windowType: '24h' | '1h',
  startAtMs: number,
  uid: string
): string {
  return buildSafeDedupId(`rem_${windowType}_${eventId}_${startAtMs}_${uid}`);
}

export interface MeaningfulEventDiff {
  changed: boolean;
  isPublishedTransition: boolean;
  isCancelledTransition: boolean;
  changedFields: Array<'title' | 'startAt' | 'endAt' | 'location' | 'visibility' | 'status'>;
  summaryText: string;
}

export function detectMeaningfulEventChanges(
  before: Pick<
    SchoolEvent,
    'title' | 'startAt' | 'endAt' | 'location' | 'visibility' | 'status'
  > | null,
  after: Pick<
    SchoolEvent,
    'title' | 'startAt' | 'endAt' | 'location' | 'visibility' | 'status'
  >
): MeaningfulEventDiff {
  if (!before) {
    return {
      changed: after.status === 'published',
      isPublishedTransition: after.status === 'published',
      isCancelledTransition: false,
      changedFields: after.status === 'published' ? ['status'] : [],
      summaryText: after.status === 'published' ? 'Event published' : '',
    };
  }

  const isPublishedTransition = before.status !== 'published' && after.status === 'published';
  const isCancelledTransition = before.status !== 'cancelled' && after.status === 'cancelled';

  const changedFields: MeaningfulEventDiff['changedFields'] = [];

  if (before.title.trim() !== after.title.trim()) {
    changedFields.push('title');
  }
  if (before.startAt.getTime() !== after.startAt.getTime()) {
    changedFields.push('startAt');
  }
  if (before.endAt.getTime() !== after.endAt.getTime()) {
    changedFields.push('endAt');
  }
  if (before.location.trim() !== after.location.trim()) {
    changedFields.push('location');
  }
  if (before.visibility !== after.visibility) {
    changedFields.push('visibility');
  }
  if (isPublishedTransition || isCancelledTransition) {
    changedFields.push('status');
  }

  // Only emit updates for published events or explicit publish/cancel transitions
  const meaningful =
    isPublishedTransition ||
    isCancelledTransition ||
    (before.status === 'published' && after.status === 'published' && changedFields.length > 0);

  if (!meaningful) {
    return {
      changed: false,
      isPublishedTransition: false,
      isCancelledTransition: false,
      changedFields: [],
      summaryText: '',
    };
  }

  let summaryText = '';
  if (isCancelledTransition) {
    summaryText = 'This event has been cancelled.';
  } else if (isPublishedTransition) {
    summaryText = 'New campus event published.';
  } else {
    const labels: string[] = [];
    if (changedFields.includes('startAt') || changedFields.includes('endAt')) {
      labels.push('time');
    }
    if (changedFields.includes('location')) {
      labels.push('location');
    }
    if (changedFields.includes('title')) {
      labels.push('title');
    }
    if (changedFields.includes('visibility')) {
      labels.push('audience');
    }
    summaryText =
      labels.length > 0
        ? `Updated ${labels.join(', ')} details.`
        : 'Important event details updated.';
  }

  return {
    changed: true,
    isPublishedTransition,
    isCancelledTransition,
    changedFields,
    summaryText,
  };
}

export interface ReminderEligibilityResult {
  eligible: boolean;
  windowType: '24h' | '1h';
  reason?: string;
  dedupKey?: string;
  formattedStartTime?: string;
}

export function formatTimeInZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
}

export function evaluateReminderEligibility(params: {
  eventId: string;
  status: EventStatus;
  visibility: EventVisibility;
  startAt: Date;
  timezone: string;
  now: Date;
  windowType: '24h' | '1h';
  uid: string;
  sentDedupKeys?: ReadonlySet<string>;
  prefs?: NotificationPreferences;
}): ReminderEligibilityResult {
  const {
    eventId,
    status,
    startAt,
    timezone,
    now,
    windowType,
    uid,
    sentDedupKeys,
    prefs,
  } = params;

  if (status !== 'published') {
    return { eligible: false, windowType, reason: 'event_not_published' };
  }

  const diffMs = startAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { eligible: false, windowType, reason: 'event_already_started' };
  }

  const minMs = windowType === '24h' ? 23.5 * 60 * 60 * 1000 : 45 * 60 * 1000;
  const maxMs = windowType === '24h' ? 24.25 * 60 * 60 * 1000 : 75 * 60 * 1000;

  if (diffMs < minMs || diffMs > maxMs) {
    return { eligible: false, windowType, reason: 'outside_reminder_window' };
  }

  const dedupKey = buildReminderDedupKey(eventId, windowType, startAt.getTime(), uid);
  if (sentDedupKeys?.has(dedupKey)) {
    return { eligible: false, windowType, reason: 'already_sent', dedupKey };
  }

  if (prefs) {
    const prefKey: NotificationPreferenceKey =
      windowType === '24h' ? 'reminder_24h' : 'reminder_1h';
    const wantsAnyChannel =
      shouldDeliverInAppNotification(prefs, prefKey) ||
      shouldDeliverPushNotification(prefs, prefKey);
    if (!wantsAnyChannel) {
      return { eligible: false, windowType, reason: 'disabled_by_user_preference', dedupKey };
    }
  }

  return {
    eligible: true,
    windowType,
    dedupKey,
    formattedStartTime: formatTimeInZone(startAt, timezone),
  };
}

export function countUnreadNotifications(notifications: AppNotification[]): number {
  let count = 0;
  for (const n of notifications) {
    if (n.status === 'unread') count += 1;
  }
  return count;
}

export function formatUnreadBadgeCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}

export function filterNotifications(
  notifications: AppNotification[],
  filter: NotificationFilterOption
): AppNotification[] {
  if (filter === 'all') return notifications;
  if (filter === 'unread') return notifications.filter((n) => n.status === 'unread');
  return notifications.filter((n) => n.type === filter);
}

export function paginateNotifications(
  notifications: AppNotification[],
  limitCount: number = NOTIFICATION_PAGE_SIZE
): { items: AppNotification[]; hasMore: boolean } {
  const safeLimit = Math.max(1, limitCount);
  return {
    items: notifications.slice(0, safeLimit),
    hasMore: notifications.length > safeLimit,
  };
}

export function formatRelativeNotificationTime(date: Date, now: Date = new Date()): string {
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function deriveStableTokenId(token: string): string {
  let hashA = 2166136261;
  let hashB = 5381;
  for (let i = 0; i < token.length; i += 1) {
    const code = token.charCodeAt(i);
    hashA ^= code;
    hashA = Math.imul(hashA, 16777619);
    hashB = ((hashB << 5) + hashB) ^ code;
  }
  const partA = (hashA >>> 0).toString(36);
  const partB = (hashB >>> 0).toString(36);
  return `web_${partA}_${partB}`;
}
