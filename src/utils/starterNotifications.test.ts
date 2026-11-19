import assert from 'node:assert/strict';
import test from 'node:test';
import type { Club, UserFollowedClub } from '../types/club';
import type { SchoolEvent } from '../types/event';
import type { AppNotification } from '../types/notification';
import { createDefaultNotificationPreferences } from './notificationValidation';
import {
  deriveStarterTierNotifications,
  mergeInAppNotifications,
  type SchoolAnnouncementRecord,
} from './starterNotifications';

const BASE_NOW = new Date('2026-11-18T12:00:00.000Z');

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'robotics-club',
    schoolId: 'oakridge-high',
    name: 'Robotics Club',
    slug: 'robotics-club',
    description: 'Autonomous systems and engineering team.',
    category: 'Robotics & Engineering',
    visibility: 'public',
    status: 'active',
    isOfficial: true,
    discoverKey: 'public:oakridge-high',
    followerCount: 18,
    announcement: 'Bring safety glasses to Thursday build night.',
    createdBy: 'admin-1',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-17T10:00:00.000Z'),
    lastActivityAt: new Date('2026-11-17T10:00:00.000Z'),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SchoolEvent> = {}): SchoolEvent {
  const startAt = new Date('2026-11-18T12:45:00.000Z'); // 45m after BASE_NOW
  const endAt = new Date('2026-11-18T14:00:00.000Z');
  return {
    id: 'evt-1',
    schoolId: 'oakridge-high',
    title: 'Robot Scrimmage',
    description: 'Practice matches in the STEM lab.',
    hostClub: 'Robotics Club',
    clubId: 'robotics-club',
    category: 'STEM & Makers',
    dateTime: startAt,
    startAt,
    endAt,
    timezone: 'America/Los_Angeles',
    location: 'STEM Lab 101',
    createdBy: 'org-1',
    createdAt: new Date('2026-11-15T10:00:00.000Z'),
    updatedAt: new Date('2026-11-15T10:00:00.000Z'),
    status: 'published',
    visibility: 'public',
    rsvpCount: 10,
    discoverKey: 'public:oakridge-high',
    ...overrides,
  };
}

test('deriveStarterTierNotifications creates real-data in-app items filtered by user preferences', () => {
  const prefs = createDefaultNotificationPreferences('u1', 'oakridge-high');
  const announcements: SchoolAnnouncementRecord[] = [
    {
      id: 'ann-1',
      schoolId: 'oakridge-high',
      title: 'Early Release Friday',
      message: 'Classes dismiss at 1:30 PM.',
      priority: 'important',
      createdBy: 'admin-1',
      createdAt: new Date('2026-11-18T11:00:00.000Z'),
    },
  ];
  const followedById: Record<string, UserFollowedClub> = {
    'robotics-club': {
      clubId: 'robotics-club',
      schoolId: 'oakridge-high',
      clubName: 'Robotics Club',
      clubCategory: 'Robotics & Engineering',
      notificationsEnabled: true,
      followedAt: new Date('2026-11-10T10:00:00.000Z'),
    },
  };

  const items = deriveStarterTierNotifications({
    uid: 'u1',
    schoolId: 'oakridge-high',
    preferences: prefs,
    announcements,
    clubs: [makeClub()],
    events: [makeEvent()],
    followedById,
    isEventGoing: () => true,
    now: BASE_NOW,
  });

  // Should contain announcement, followed club announcement, followed club event, and 1h reminder
  assert.equal(items.some((i) => i.type === 'announcement' && i.title === 'Early Release Friday'), true);
  assert.equal(items.some((i) => i.type === 'club_activity' && i.entityType === 'club'), true);
  assert.equal(items.some((i) => i.type === 'club_activity' && i.entityType === 'event'), true);
  assert.equal(items.some((i) => i.type === 'event_reminder' && i.title.startsWith('Starting soon:')), true);

  // Turning off inAppEnabled suppresses all derived notifications
  const muted = deriveStarterTierNotifications({
    uid: 'u1',
    schoolId: 'oakridge-high',
    preferences: { ...prefs, inAppEnabled: false },
    announcements,
    clubs: [makeClub()],
    events: [makeEvent()],
    followedById,
    isEventGoing: () => true,
    now: BASE_NOW,
  });
  assert.equal(muted.length, 0);

  // Disabling reminder1h hides 1h reminder without dropping announcements
  const no1h = deriveStarterTierNotifications({
    uid: 'u1',
    schoolId: 'oakridge-high',
    preferences: { ...prefs, reminder1h: false, reminder24h: false },
    announcements,
    clubs: [makeClub()],
    events: [makeEvent()],
    followedById,
    isEventGoing: () => true,
    now: BASE_NOW,
  });
  assert.equal(no1h.some((i) => i.type === 'event_reminder'), false);
  assert.equal(no1h.some((i) => i.type === 'announcement'), true);
});

test('mergeInAppNotifications deduplicates persisted docs and applies local read state', () => {
  const prefs = createDefaultNotificationPreferences('u1', 'oakridge-high');
  const announcements: SchoolAnnouncementRecord[] = [
    {
      id: 'ann-1',
      schoolId: 'oakridge-high',
      title: 'Spirit Week',
      message: 'Join Friday rally.',
      priority: 'normal',
      createdBy: 'admin-1',
      createdAt: new Date('2026-11-18T11:30:00.000Z'),
    },
  ];

  const derived = deriveStarterTierNotifications({
    uid: 'u1',
    schoolId: 'oakridge-high',
    preferences: prefs,
    announcements,
    clubs: [],
    events: [],
    followedById: {},
    isEventGoing: () => false,
    now: BASE_NOW,
  });
  assert.equal(derived.length, 1);

  const persisted: AppNotification[] = [
    {
      id: 'srv-ann-1',
      recipientUid: 'u1',
      schoolId: 'oakridge-high',
      type: 'announcement',
      title: 'Spirit Week (Server)',
      message: 'Join Friday rally.',
      createdAt: new Date('2026-11-18T11:31:00.000Z'),
      entityType: 'school',
      entityId: 'oakridge-high',
      status: 'read',
      dedupKey: derived[0].dedupKey,
    },
  ];

  const mergedWithPersisted = mergeInAppNotifications(persisted, derived, new Set());
  assert.equal(mergedWithPersisted.length, 1);
  assert.equal(mergedWithPersisted[0].id, 'srv-ann-1');

  const mergedWithLocalRead = mergeInAppNotifications([], derived, new Set([derived[0].id]));
  assert.equal(mergedWithLocalRead.length, 1);
  assert.equal(mergedWithLocalRead[0].status, 'read');
});

test('deriveStarterTierNotifications surfaces active Phase 8 event announcements for registered events', () => {
  const prefs = createDefaultNotificationPreferences('u1', 'oakridge-high');
  const evt = makeEvent({ id: 'evt-ops-1', title: 'Robotics Showcase' });
  const eventAnnouncementsByEventId = {
    'evt-ops-1': [
      {
        id: 'eann-active',
        eventId: 'evt-ops-1',
        schoolId: 'oakridge-high',
        title: 'Room moved to Gym B',
        message: 'Please arrive 10 minutes early for check-in.',
        status: 'active' as const,
        createdBy: 'org-1',
        createdAt: new Date('2026-11-18T11:50:00.000Z'),
        updatedAt: new Date('2026-11-18T11:50:00.000Z'),
      },
      {
        id: 'eann-archived',
        eventId: 'evt-ops-1',
        schoolId: 'oakridge-high',
        title: 'Old update',
        message: 'Superseded notice.',
        status: 'archived' as const,
        createdBy: 'org-1',
        createdAt: new Date('2026-11-18T10:00:00.000Z'),
        updatedAt: new Date('2026-11-18T10:30:00.000Z'),
      },
    ],
  };

  const items = deriveStarterTierNotifications({
    uid: 'u1',
    schoolId: 'oakridge-high',
    preferences: prefs,
    announcements: [],
    clubs: [],
    events: [evt],
    followedById: {},
    isEventGoing: () => true,
    eventAnnouncementsByEventId,
    now: BASE_NOW,
  });

  const annNotifs = items.filter((i) => i.type === 'event_update');
  assert.equal(annNotifs.length, 1);
  assert.match(annNotifs[0].title, /Room moved to Gym B/);
  assert.equal(annNotifs[0].entityId, 'evt-ops-1');

  // Unregistered students should not receive event-specific updates
  const unregistered = deriveStarterTierNotifications({
    uid: 'u1',
    schoolId: 'oakridge-high',
    preferences: prefs,
    announcements: [],
    clubs: [],
    events: [evt],
    followedById: {},
    isEventGoing: () => false,
    eventAnnouncementsByEventId,
    now: BASE_NOW,
  });
  assert.equal(unregistered.filter((i) => i.type === 'event_update').length, 0);
});

