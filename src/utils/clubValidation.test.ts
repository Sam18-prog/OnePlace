import test from 'node:test';
import assert from 'node:assert/strict';
import type { Club, ClubFormValues } from '../types/club';
import type { SchoolEvent } from '../types/event';
import type { SchoolMembership } from '../types/membership';
import {
  buildClubNotificationPayload,
  canCreateEventForClub,
  canManageClub,
  computeClubDiscoverKey,
  computeOptimisticFollow,
  countUpcomingClubEvents,
  filterAndSortClubs,
  getAuthorizedClubsForEventForm,
  getSuggestedClubs,
  slugifyClubName,
  validateClubForm,
  validateClubOrganizerEditForm,
} from './clubValidation';
import { filterEvents } from './events';

const NOW = new Date('2026-11-17T18:00:00.000Z');

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'robotics-club',
    schoolId: 'oakridge-high',
    name: 'FRC Team 4210 · Robotics Club',
    slug: 'robotics-club',
    shortDescription: 'Autonomous robotics & engineering builds.',
    description: 'Students design, machine, and program competition robots each semester.',
    category: 'Robotics & Engineering',
    visibility: 'public',
    status: 'active',
    isOfficial: true,
    discoverKey: 'public:oakridge-high',
    followerCount: 24,
    createdBy: 'admin-1',
    createdAt: NOW,
    updatedAt: NOW,
    lastActivityAt: NOW,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SchoolEvent> = {}): SchoolEvent {
  return {
    id: 'evt-1',
    schoolId: 'oakridge-high',
    title: 'Robot Chassis Build Night',
    description: 'Drivetrain and wiring session.',
    hostClub: 'FRC Team 4210 · Robotics Club',
    clubId: 'robotics-club',
    category: 'STEM & Makers',
    dateTime: new Date(NOW.getTime() + 3_600_000),
    startAt: new Date(NOW.getTime() + 3_600_000),
    endAt: new Date(NOW.getTime() + 7_200_000),
    timezone: 'America/Los_Angeles',
    location: 'Engineering Lab 104',
    createdBy: 'org-1',
    createdAt: NOW,
    updatedAt: NOW,
    status: 'published',
    visibility: 'public',
    rsvpCount: 12,
    discoverKey: 'public:oakridge-high',
    ...overrides,
  };
}

const VALID_CLUB_FORM: ClubFormValues = {
  name: 'Robotics & Makers Club',
  slug: 'robotics-makers-club',
  shortDescription: 'Weekly hardware and software build nights.',
  description: 'A welcoming campus club where students learn CAD, soldering, and autonomous coding.',
  category: 'Robotics & Engineering',
  visibility: 'public',
  isOfficial: true,
  coverImageUrl: 'https://cdn.example.com/robotics.jpg',
  logoUrl: '',
  meetingSchedule: 'Tuesdays · 3:30 PM',
  meetingLocation: 'Engineering Lab 104',
  contactEmail: 'robotics@oakridge.edu',
  announcement: 'Next scrimmage prep begins Tuesday!',
};

test('slugifyClubName and computeClubDiscoverKey produce valid canonical identifiers', () => {
  assert.equal(slugifyClubName('FRC Team #4210 · Robotics Club'), 'frc-team-4210-robotics-club');
  assert.equal(slugifyClubName('X'), 'campus-club');

  assert.equal(computeClubDiscoverKey('oakridge-high', 'active', 'public'), 'public:oakridge-high');
  assert.equal(computeClubDiscoverKey('oakridge-high', 'active', 'school'), 'school:oakridge-high');
  assert.equal(
    computeClubDiscoverKey('oakridge-high', 'suspended', 'public'),
    'suspended:oakridge-high'
  );
});

test('validateClubForm and validateClubOrganizerEditForm enforce bounds, URLs, and email format', () => {
  assert.equal(validateClubForm(VALID_CLUB_FORM).valid, true);

  const badUrl = validateClubForm({
    ...VALID_CLUB_FORM,
    coverImageUrl: 'http://insecure.example.com/cover.jpg',
  });
  assert.equal(badUrl.valid, false);
  assert.ok(badUrl.errors.coverImageUrl);

  const badEmail = validateClubForm({ ...VALID_CLUB_FORM, contactEmail: 'not-an-email' });
  assert.equal(badEmail.valid, false);
  assert.ok(badEmail.errors.contactEmail);

  const shortDesc = validateClubOrganizerEditForm({
    shortDescription: 'Hi',
    description: 'Too short',
    coverImageUrl: '',
    logoUrl: '',
    meetingSchedule: '',
    meetingLocation: '',
    contactEmail: '',
    announcement: '',
  });
  assert.equal(shortDesc.valid, false);
  assert.ok(shortDesc.errors.description);
});

test('club-scoped permission helpers enforce school isolation, assigned clubs, and suspended club publish blocks', () => {
  const admin: SchoolMembership = {
    uid: 'admin-1',
    schoolId: 'oakridge-high',
    role: 'admin',
    status: 'active',
    createdAt: NOW,
  };
  const organizer: SchoolMembership = {
    uid: 'org-1',
    schoolId: 'oakridge-high',
    role: 'organizer',
    status: 'active',
    createdAt: NOW,
  };
  const student: SchoolMembership = {
    uid: 'stu-1',
    schoolId: 'oakridge-high',
    role: 'student',
    status: 'active',
    createdAt: NOW,
  };

  const robotics = makeClub({ id: 'robotics-club', status: 'active' });
  const debate = makeClub({ id: 'debate-club', status: 'active', name: 'Speech & Debate' });
  const suspendedClub = makeClub({ id: 'suspended-club', status: 'suspended', name: 'Paused Club' });
  const otherSchoolClub = makeClub({ id: 'west-club', schoolId: 'westview-high', status: 'active' });

  const managedIds = new Set(['robotics-club', 'suspended-club']);

  // Club management scoping
  assert.equal(canManageClub(robotics, organizer, managedIds), true);
  assert.equal(canManageClub(debate, organizer, managedIds), false);
  assert.equal(canManageClub(suspendedClub, organizer, managedIds), false);
  assert.equal(canManageClub(debate, admin, new Set()), true);
  assert.equal(canManageClub(otherSchoolClub, admin, new Set()), false);
  assert.equal(canManageClub(robotics, student, managedIds), false);

  // Event creation blocked on suspended clubs even for assigned organizer or admin
  assert.equal(canCreateEventForClub(robotics, organizer, managedIds), true);
  assert.equal(canCreateEventForClub(suspendedClub, organizer, managedIds), false);
  assert.equal(canCreateEventForClub(suspendedClub, admin, managedIds), false);

  // Authorized clubs selector list for EventForm
  const orgClubs = getAuthorizedClubsForEventForm(
    [robotics, debate, suspendedClub, otherSchoolClub],
    organizer,
    managedIds
  );
  assert.deepEqual(
    orgClubs.map((c) => c.id),
    ['robotics-club']
  );

  const adminClubs = getAuthorizedClubsForEventForm(
    [robotics, debate, suspendedClub, otherSchoolClub],
    admin,
    new Set()
  );
  assert.deepEqual(
    adminClubs.map((c) => c.id),
    ['robotics-club', 'debate-club']
  );
});

test('computeOptimisticFollow handles follow/unfollow toggles without negative counts', () => {
  assert.deepEqual(computeOptimisticFollow(false, 10), { nextFollowing: true, nextCount: 11 });
  assert.deepEqual(computeOptimisticFollow(true, 10), { nextFollowing: false, nextCount: 9 });
  assert.deepEqual(computeOptimisticFollow(true, 0), { nextFollowing: false, nextCount: 0 });
});

test('countUpcomingClubEvents, filterAndSortClubs, and filterEvents by clubId work accurately', () => {
  const robotics = makeClub({
    id: 'robotics-club',
    name: 'Robotics Club',
    followerCount: 15,
    lastActivityAt: new Date(NOW.getTime() - 100_000),
  });
  const jazz = makeClub({
    id: 'jazz-club',
    name: 'Jazz Collective',
    category: 'Arts & Music',
    followerCount: 30,
    lastActivityAt: new Date(NOW.getTime() - 500_000),
  });
  const suspended = makeClub({
    id: 'paused-club',
    name: 'Paused Club',
    status: 'suspended',
    followerCount: 50,
  });

  const events = [
    makeEvent({ id: 'e1', clubId: 'robotics-club', status: 'published' }),
    makeEvent({ id: 'e2', clubId: 'robotics-club', status: 'cancelled' }),
    makeEvent({
      id: 'e3',
      clubId: 'jazz-club',
      status: 'published',
      startAt: new Date(NOW.getTime() - 7_200_000),
      endAt: new Date(NOW.getTime() - 3_600_000),
    }),
  ];

  const upcomingCounts = countUpcomingClubEvents(events, NOW);
  assert.deepEqual(upcomingCounts, { 'robotics-club': 1 });

  // Suspended clubs excluded by default
  const popular = filterAndSortClubs([robotics, jazz, suspended], {
    sortMode: 'popular',
    upcomingCountsByClub: upcomingCounts,
  });
  assert.deepEqual(
    popular.map((c) => c.id),
    ['jazz-club', 'robotics-club']
  );

  // Recently active sorts by lastActivityAt desc
  const recent = filterAndSortClubs([robotics, jazz, suspended], {
    sortMode: 'recently-active',
    upcomingCountsByClub: upcomingCounts,
  });
  assert.deepEqual(
    recent.map((c) => c.id),
    ['robotics-club', 'jazz-club']
  );

  // Only with upcoming events
  const withUpcoming = filterAndSortClubs([robotics, jazz], {
    onlyWithUpcomingEvents: true,
    upcomingCountsByClub: upcomingCounts,
  });
  assert.deepEqual(
    withUpcoming.map((c) => c.id),
    ['robotics-club']
  );

  // Filter events by clubId
  const roboticsEvents = filterEvents(events, '', 'all', NOW, 'all', 'robotics-club');
  assert.deepEqual(
    roboticsEvents.map((e) => e.id),
    ['e1', 'e2']
  );
});

test('getSuggestedClubs excludes followed and suspended clubs and explains recommendation reasons', () => {
  const followedStem = makeClub({
    id: 'robotics-club',
    category: 'Robotics & Engineering',
    followerCount: 20,
  });
  const unfollowedStem = makeClub({
    id: 'cs-makers',
    name: 'CS & Makers Club',
    category: 'Robotics & Engineering',
    followerCount: 18,
  });
  const unfollowedArts = makeClub({
    id: 'jazz-club',
    name: 'Jazz Collective',
    category: 'Arts & Music',
    followerCount: 40,
  });
  const suspended = makeClub({
    id: 'paused-club',
    status: 'suspended',
    category: 'Robotics & Engineering',
  });

  const events = [
    makeEvent({ id: 'e1', clubId: 'cs-makers', status: 'published' }),
  ];

  const suggestions = getSuggestedClubs(
    [followedStem, unfollowedStem, unfollowedArts, suspended],
    new Set(['robotics-club']),
    events,
    {},
    4,
    NOW
  );

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].club.id, 'cs-makers');
  assert.match(suggestions[0].reason, /Matches your Robotics & Engineering interest/);
});

test('buildClubNotificationPayload constructs valid notification-ready contracts', () => {
  const payload = buildClubNotificationPayload({
    eventType: 'club_event_published',
    schoolId: 'oakridge-high',
    clubId: 'robotics-club',
    clubName: 'Robotics Club',
    eventId: 'evt-1',
    title: 'Robot Build Night',
    summary: 'Join us in Engineering Lab 104.',
    actorUid: 'org-1',
    now: NOW,
  });
  assert.equal(payload.eventType, 'club_event_published');
  assert.equal(payload.targetAudience, 'club_followers');
  assert.equal(payload.clubId, 'robotics-club');
  assert.equal(payload.createdAtIso, NOW.toISOString());
});
