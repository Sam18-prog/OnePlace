import assert from 'node:assert/strict';
import test from 'node:test';
import type { SchoolEvent } from '../types/event';
import {
  getFollowedClubUpcomingEvents,
  getHappeningThisWeekEvents,
  getPersonalizedRecommendations,
  getRecentlyAddedEvents,
  getTimeOfDayGreeting,
  mapClubCategoryToEventCategory,
} from './personalization';

const NOW = new Date('2026-10-14T15:00:00.000Z');

function makeEvent(id: string, overrides: Partial<SchoolEvent> = {}): SchoolEvent {
  const startAt = new Date('2026-10-15T18:00:00.000Z');
  const endAt = new Date('2026-10-15T19:00:00.000Z');
  return {
    id,
    schoolId: 'oakridge-high',
    title: `Event ${id}`,
    description: 'Campus gathering for students.',
    hostClub: 'Oakridge Robotics',
    clubId: 'robotics-club',
    category: 'STEM & Makers',
    dateTime: startAt,
    startAt,
    endAt,
    timezone: 'America/Los_Angeles',
    location: 'Room 101',
    createdBy: 'org-1',
    createdAt: new Date('2026-10-12T10:00:00.000Z'),
    updatedAt: new Date('2026-10-12T10:00:00.000Z'),
    status: 'published',
    visibility: 'public',
    rsvpCount: 10,
    discoverKey: 'public:oakridge-high',
    ...overrides,
  };
}

test('personalization ranks followed clubs and interest matches highest and attaches concrete reasons', () => {
  const events = [
    makeEvent('e-cold', {
      clubId: 'chess-club',
      hostClub: 'Chess Club',
      category: 'Academic',
      rsvpCount: 5,
    }),
    makeEvent('e-interest', {
      clubId: 'jazz-band',
      hostClub: 'Jazz Collective',
      category: 'Arts & Music',
      rsvpCount: 8,
    }),
    makeEvent('e-followed', {
      clubId: 'robotics-club',
      hostClub: 'Oakridge Robotics',
      category: 'STEM & Makers',
      rsvpCount: 14,
    }),
  ];

  const recs = getPersonalizedRecommendations(
    events,
    {
      now: NOW,
      isSchoolMember: true,
      followedClubIds: new Set(['robotics-club']),
      interestCategories: ['Arts & Music'],
      rsvpedEventIds: new Set(),
    },
    3
  );

  assert.equal(recs.length, 3);
  assert.equal(recs[0].event.id, 'e-followed');
  assert.equal(recs[0].reason.code, 'followed_club');
  assert.match(recs[0].reason.label, /Oakridge Robotics/);

  assert.equal(recs[1].event.id, 'e-interest');
  assert.equal(recs[1].reason.code, 'interest_match');
  assert.match(recs[1].reason.label, /Arts & Music/);
});

test('personalization excludes past, cancelled, draft, school-restricted, and already-RSVPed events', () => {
  const events = [
    makeEvent('e-past', {
      startAt: new Date('2026-10-10T10:00:00.000Z'),
      endAt: new Date('2026-10-10T11:00:00.000Z'),
    }),
    makeEvent('e-cancelled', { status: 'cancelled' }),
    makeEvent('e-draft', { status: 'draft' }),
    makeEvent('e-school-only', { visibility: 'school' }),
    makeEvent('e-already-going'),
    makeEvent('e-valid-public', {
      clubId: 'debate-club',
      hostClub: 'Debate Society',
      category: 'Academic',
    }),
  ];

  const recsGuest = getPersonalizedRecommendations(
    events,
    {
      now: NOW,
      isSchoolMember: false,
      followedClubIds: new Set(['robotics-club']),
      interestCategories: [],
      rsvpedEventIds: new Set(['e-already-going']),
    },
    5
  );

  assert.deepEqual(
    recsGuest.map((r) => r.event.id),
    ['e-valid-public']
  );
  assert.equal(recsGuest[0].reason.code, 'upcoming_campus');

  const recsMember = getPersonalizedRecommendations(
    events,
    {
      now: NOW,
      isSchoolMember: true,
      followedClubIds: new Set(['robotics-club']),
      interestCategories: [],
      rsvpedEventIds: new Set(['e-already-going']),
    },
    5
  );
  assert.deepEqual(
    recsMember.map((r) => r.event.id),
    ['e-school-only', 'e-valid-public']
  );
});

test('followed club feed, happening this week, recently added, category mapping, and greeting', () => {
  const events = [
    makeEvent('e-older', {
      clubId: 'robotics-club',
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
      startAt: new Date('2026-10-15T18:00:00.000Z'),
    }),
    makeEvent('e-newer', {
      clubId: 'varsity-track',
      hostClub: 'Varsity Track',
      category: 'Athletics',
      createdAt: new Date('2026-10-14T08:00:00.000Z'),
      startAt: new Date('2026-10-25T18:00:00.000Z'),
      endAt: new Date('2026-10-25T19:00:00.000Z'),
    }),
  ];

  const followed = getFollowedClubUpcomingEvents(events, new Set(['robotics-club']), NOW, false, 4);
  assert.deepEqual(
    followed.map((e) => e.id),
    ['e-older']
  );

  const thisWeek = getHappeningThisWeekEvents(events, NOW, false);
  assert.deepEqual(
    thisWeek.map((e) => e.id),
    ['e-older']
  );

  const recent = getRecentlyAddedEvents(events, NOW, false, 2);
  assert.deepEqual(
    recent.map((e) => e.id),
    ['e-newer', 'e-older']
  );

  assert.equal(mapClubCategoryToEventCategory('Robotics & Engineering'), 'STEM & Makers');
  assert.equal(mapClubCategoryToEventCategory('Sports & Athletics'), 'Athletics');

  assert.equal(getTimeOfDayGreeting(new Date(2026, 9, 14, 9, 0), 'Maya Patel'), 'Good morning, Maya');
  assert.equal(getTimeOfDayGreeting(new Date(2026, 9, 14, 14, 0), null), 'Good afternoon');
  assert.equal(getTimeOfDayGreeting(new Date(2026, 9, 14, 19, 0), 'Sam'), 'Good evening, Sam');
});
