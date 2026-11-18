import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppNotification, NotificationPreferences } from '../types/notification';
import type { SchoolEvent } from '../types/event';
import {
  applyDisableAllPreferences,
  applyEnableAllPreferences,
  buildReminderDedupKey,
  countUnreadNotifications,
  createDefaultNotificationPreferences,
  deriveStableTokenId,
  detectMeaningfulEventChanges,
  evaluateReminderEligibility,
  filterNotifications,
  formatUnreadBadgeCount,
  paginateNotifications,
  sanitizeNotificationPreferences,
  shouldDeliverInAppNotification,
  shouldDeliverPushNotification,
} from './notificationValidation';

function makeEvent(overrides: Partial<SchoolEvent> = {}): SchoolEvent {
  const startAt = new Date('2026-10-15T18:00:00.000Z');
  const endAt = new Date('2026-10-15T19:30:00.000Z');
  return {
    id: 'evt-robotics-1',
    schoolId: 'oakridge-high',
    title: 'Robotics Workshop',
    description: 'Build autonomous bots in the STEM lab.',
    hostClub: 'Robotics Club',
    clubId: 'robotics-club',
    category: 'STEM & Makers',
    dateTime: startAt,
    startAt,
    endAt,
    timezone: 'America/Los_Angeles',
    location: 'STEM Room 204',
    createdBy: 'org-1',
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    status: 'published',
    visibility: 'public',
    rsvpCount: 12,
    discoverKey: 'public:oakridge-high',
    ...overrides,
  };
}

function makeNotif(id: string, status: 'unread' | 'read', type: AppNotification['type'] = 'event_reminder'): AppNotification {
  return {
    id,
    recipientUid: 'student-1',
    schoolId: 'oakridge-high',
    type,
    title: `Notification ${id}`,
    message: 'Details about your campus event.',
    createdAt: new Date('2026-10-14T12:00:00.000Z'),
    entityType: 'event',
    entityId: 'evt-robotics-1',
    status,
    dedupKey: id,
  };
}

test('notification unread counts, badge formatting, filtering, and pagination', () => {
  const list = [
    makeNotif('n1', 'unread', 'event_reminder'),
    makeNotif('n2', 'read', 'club_activity'),
    makeNotif('n3', 'unread', 'announcement'),
    makeNotif('n4', 'unread', 'event_update'),
  ];

  assert.equal(countUnreadNotifications(list), 3);
  assert.equal(formatUnreadBadgeCount(0), '');
  assert.equal(formatUnreadBadgeCount(3), '3');
  assert.equal(formatUnreadBadgeCount(120), '99+');

  assert.equal(filterNotifications(list, 'all').length, 4);
  assert.equal(filterNotifications(list, 'unread').length, 3);
  assert.equal(filterNotifications(list, 'announcement').length, 1);

  const page1 = paginateNotifications(list, 2);
  assert.equal(page1.items.length, 2);
  assert.equal(page1.hasMore, true);

  const page2 = paginateNotifications(list, 4);
  assert.equal(page2.items.length, 4);
  assert.equal(page2.hasMore, false);
});

test('notification preferences enable-all, disable-all, and delivery suppression', () => {
  const defaults = createDefaultNotificationPreferences('u1', 'oakridge-high');
  assert.equal(defaults.inAppEnabled, true);
  assert.equal(defaults.pushEnabled, false);
  assert.equal(shouldDeliverInAppNotification(defaults, 'reminder_24h'), true);
  assert.equal(shouldDeliverPushNotification(defaults, 'reminder_24h'), false);

  const enabledWithGrant = applyEnableAllPreferences(defaults, 'granted');
  assert.equal(enabledWithGrant.pushEnabled, true);
  assert.equal(shouldDeliverPushNotification(enabledWithGrant, 'club_new_event'), true);

  const enabledWithoutGrant = applyEnableAllPreferences(defaults, 'denied');
  assert.equal(enabledWithoutGrant.inAppEnabled, true);
  assert.equal(enabledWithoutGrant.pushEnabled, false);

  const enabledWithoutVapid = applyEnableAllPreferences(defaults, 'granted', false);
  assert.equal(enabledWithoutVapid.inAppEnabled, true);
  assert.equal(enabledWithoutVapid.pushEnabled, false);

  const disabled = applyDisableAllPreferences(enabledWithGrant);
  assert.equal(disabled.inAppEnabled, false);
  assert.equal(disabled.pushEnabled, false);
  assert.equal(disabled.reminder24h, false);
  assert.equal(shouldDeliverInAppNotification(disabled, 'important_notice'), false);

  const sanitized = sanitizeNotificationPreferences(
    {
      reminder1h: false,
      interestCategories: ['STEM & Makers', 'InvalidCategory' as never, 'STEM & Makers', 'Athletics'],
    },
    'u1',
    'oakridge-high'
  );
  assert.equal(sanitized.reminder1h, false);
  assert.deepEqual(sanitized.interestCategories, ['STEM & Makers', 'Athletics']);
});

test('detectMeaningfulEventChanges detects schedule/location/title/cancel changes and ignores minor tweaks', () => {
  const base = makeEvent();
  const minorTweak = makeEvent({
    description: 'Slightly reworded description.',
    rsvpCount: 45,
    updatedAt: new Date('2026-10-05T10:00:00.000Z'),
  });
  const noDiff = detectMeaningfulEventChanges(base, minorTweak);
  assert.equal(noDiff.changed, false);

  const timeAndLocationEdit = makeEvent({
    startAt: new Date('2026-10-15T19:00:00.000Z'),
    location: 'Main Auditorium',
  });
  const editDiff = detectMeaningfulEventChanges(base, timeAndLocationEdit);
  assert.equal(editDiff.changed, true);
  assert.deepEqual(editDiff.changedFields, ['startAt', 'location']);
  assert.match(editDiff.summaryText, /time, location/);

  const cancelled = makeEvent({ status: 'cancelled' });
  const cancelDiff = detectMeaningfulEventChanges(base, cancelled);
  assert.equal(cancelDiff.changed, true);
  assert.equal(cancelDiff.isCancelledTransition, true);

  const draft = makeEvent({ status: 'draft' });
  const publishDiff = detectMeaningfulEventChanges(draft, base);
  assert.equal(publishDiff.changed, true);
  assert.equal(publishDiff.isPublishedTransition, true);
});

test('evaluateReminderEligibility enforces 24h/1h windows, deduplication, rescheduling, and cancellation exclusions', () => {
  const startAt = new Date('2026-10-15T18:00:00.000Z');
  const prefs: NotificationPreferences = {
    ...createDefaultNotificationPreferences('student-1', 'oakridge-high'),
    reminder24h: true,
    reminder1h: true,
  };

  // Exactly 24h before startAt
  const now24h = new Date('2026-10-14T18:00:00.000Z');
  const check24 = evaluateReminderEligibility({
    eventId: 'evt-1',
    status: 'published',
    visibility: 'public',
    startAt,
    timezone: 'America/Los_Angeles',
    now: now24h,
    windowType: '24h',
    uid: 'student-1',
    prefs,
  });
  assert.equal(check24.eligible, true);
  assert.ok(check24.dedupKey);
  assert.ok(check24.formattedStartTime?.includes('11:00 AM'));

  // Duplicate check with same dedup key
  const sentSet = new Set([check24.dedupKey!]);
  const duplicateCheck = evaluateReminderEligibility({
    eventId: 'evt-1',
    status: 'published',
    visibility: 'public',
    startAt,
    timezone: 'America/Los_Angeles',
    now: now24h,
    windowType: '24h',
    uid: 'student-1',
    sentDedupKeys: sentSet,
    prefs,
  });
  assert.equal(duplicateCheck.eligible, false);
  assert.equal(duplicateCheck.reason, 'already_sent');

  // Rescheduling changes startAt -> produces fresh dedupKey and becomes eligible again
  const rescheduledStart = new Date('2026-10-16T18:00:00.000Z');
  const now24hRescheduled = new Date('2026-10-15T18:00:00.000Z');
  const rescheduledCheck = evaluateReminderEligibility({
    eventId: 'evt-1',
    status: 'published',
    visibility: 'public',
    startAt: rescheduledStart,
    timezone: 'America/Los_Angeles',
    now: now24hRescheduled,
    windowType: '24h',
    uid: 'student-1',
    sentDedupKeys: sentSet,
    prefs,
  });
  assert.equal(rescheduledCheck.eligible, true);
  assert.notEqual(rescheduledCheck.dedupKey, check24.dedupKey);

  // 1h window check
  const now1h = new Date('2026-10-15T17:05:00.000Z');
  const check1h = evaluateReminderEligibility({
    eventId: 'evt-1',
    status: 'published',
    visibility: 'public',
    startAt,
    timezone: 'America/Los_Angeles',
    now: now1h,
    windowType: '1h',
    uid: 'student-1',
    prefs,
  });
  assert.equal(check1h.eligible, true);
  assert.equal(
    check1h.dedupKey,
    buildReminderDedupKey('evt-1', '1h', startAt.getTime(), 'student-1')
  );

  // Cancelled event excluded
  const cancelledCheck = evaluateReminderEligibility({
    eventId: 'evt-1',
    status: 'cancelled',
    visibility: 'public',
    startAt,
    timezone: 'America/Los_Angeles',
    now: now1h,
    windowType: '1h',
    uid: 'student-1',
    prefs,
  });
  assert.equal(cancelledCheck.eligible, false);
  assert.equal(cancelledCheck.reason, 'event_not_published');

  // Already started event excluded
  const startedCheck = evaluateReminderEligibility({
    eventId: 'evt-1',
    status: 'published',
    visibility: 'public',
    startAt,
    timezone: 'America/Los_Angeles',
    now: new Date('2026-10-15T18:05:00.000Z'),
    windowType: '1h',
    uid: 'student-1',
    prefs,
  });
  assert.equal(startedCheck.eligible, false);
  assert.equal(startedCheck.reason, 'event_already_started');
});

test('deriveStableTokenId creates safe deterministic Firestore document IDs', () => {
  const token = 'fCm_LongTokenExample:APA91bG_example-1234567890';
  const id1 = deriveStableTokenId(token);
  const id2 = deriveStableTokenId(token);
  assert.equal(id1, id2);
  assert.match(id1, /^[a-zA-Z0-9_-]{5,128}$/);
});
