import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventFormValues } from '../types/event';
import type { SchoolMembership } from '../types/membership';
import {
  canAcceptRsvp,
  canManageEvent,
  canTransitionEventStatus,
  computeDiscoverKey,
  formatDateInTimezone,
  getMembershipCapabilities,
  isPastEvent,
  parseSchoolDateTime,
  slugifyClubId,
  validateEventForm,
} from './eventValidation';

const NOW = new Date('2026-11-17T18:00:00.000Z'); // 10:00 AM America/Los_Angeles

const BASE_VALUES: EventFormValues = {
  title: 'Spring Robotics Showcase',
  hostClub: 'Robotics & Makers Club',
  category: 'STEM & Makers',
  eventDate: '2026-11-20',
  startTime: '15:30',
  endTime: '17:00',
  location: 'Engineering Lab 204',
  description: 'Live robot demos, driver trials, and Q&A for new members.',
  imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
  visibility: 'public',
};

test('slugifyClubId and computeDiscoverKey generate canonical rule-aligned keys', () => {
  assert.equal(slugifyClubId('FRC Team #4210 — Oakridge'), 'frc-team-4210-oakridge');
  assert.equal(slugifyClubId('A'), 'campus-club');

  assert.equal(
    computeDiscoverKey('oakridge-high', 'draft', 'public', 'user-123'),
    'draft:user-123'
  );
  assert.equal(
    computeDiscoverKey('oakridge-high', 'published', 'public', 'user-123'),
    'public:oakridge-high'
  );
  assert.equal(
    computeDiscoverKey('oakridge-high', 'cancelled', 'school', 'user-123'),
    'school:oakridge-high'
  );
});

test('parseSchoolDateTime converts school-local wall time to exact UTC instant across PST and DST', () => {
  // November 2026 is standard time (PST = UTC-8)
  const pstInstant = parseSchoolDateTime('2026-11-20', '15:30', 'America/Los_Angeles');
  assert.ok(pstInstant);
  assert.equal(pstInstant.toISOString(), '2026-11-20T23:30:00.000Z');
  assert.deepEqual(formatDateInTimezone(pstInstant, 'America/Los_Angeles'), {
    date: '2026-11-20',
    time: '15:30',
  });

  // July 2026 is daylight saving time (PDT = UTC-7)
  const pdtInstant = parseSchoolDateTime('2026-07-15', '10:00', 'America/Los_Angeles');
  assert.ok(pdtInstant);
  assert.equal(pdtInstant.toISOString(), '2026-07-15T17:00:00.000Z');

  // Invalid calendar dates like Feb 30 must return null
  assert.equal(parseSchoolDateTime('2026-02-30', '12:00', 'America/Los_Angeles'), null);
});

test('validateEventForm enforces required fields, image protocol, time ordering, and future publish check', () => {
  const okPublish = validateEventForm(BASE_VALUES, 'published', 'America/Los_Angeles', {
    now: NOW,
  });
  assert.equal(okPublish.valid, true);
  assert.ok(okPublish.startAt);
  assert.ok(okPublish.endAt);
  assert.ok(okPublish.endAt.getTime() > okPublish.startAt.getTime());

  // End before start must fail
  const badTimes = validateEventForm(
    { ...BASE_VALUES, startTime: '16:00', endTime: '15:00' },
    'published',
    'America/Los_Angeles',
    { now: NOW }
  );
  assert.equal(badTimes.valid, false);
  assert.ok(badTimes.errors.endTime);

  // Unsafe javascript: or http: imageUrl must fail
  const badImg = validateEventForm(
    { ...BASE_VALUES, imageUrl: 'http://insecure.example.com/img.png' },
    'published',
    'America/Los_Angeles',
    { now: NOW }
  );
  assert.equal(badImg.valid, false);
  assert.ok(badImg.errors.imageUrl);

  // Past event cannot be newly published, though draft is allowed
  const pastValues: EventFormValues = {
    ...BASE_VALUES,
    eventDate: '2026-11-10',
  };
  const pastPublish = validateEventForm(pastValues, 'published', 'America/Los_Angeles', {
    now: NOW,
  });
  assert.equal(pastPublish.valid, false);
  assert.ok(pastPublish.errors.eventDate);

  const pastDraft = validateEventForm(
    { ...pastValues, description: '' },
    'draft',
    'America/Los_Angeles',
    { now: NOW }
  );
  assert.equal(pastDraft.valid, true);

  // Existing published edit preserves valid edits
  const editPublished = validateEventForm(pastValues, 'published', 'America/Los_Angeles', {
    now: NOW,
    isEditingExistingPublished: true,
  });
  assert.equal(editPublished.valid, true);
});

test('canTransitionEventStatus enforces organizer and admin lifecycle transitions', () => {
  assert.equal(canTransitionEventStatus('draft', 'published', 'student'), false);
  assert.equal(canTransitionEventStatus('draft', 'published', 'organizer'), true);
  assert.equal(canTransitionEventStatus('published', 'cancelled', 'organizer'), true);
  // Organizers cannot reopen cancelled events
  assert.equal(canTransitionEventStatus('cancelled', 'published', 'organizer'), false);
  // School admins can restore if required
  assert.equal(canTransitionEventStatus('cancelled', 'published', 'admin'), true);
});

test('getMembershipCapabilities and canManageEvent enforce active status, school isolation, and ownership', () => {
  const organizer: SchoolMembership = {
    uid: 'org-1',
    schoolId: 'oakridge-high',
    role: 'organizer',
    status: 'active',
    createdAt: NOW,
  };
  const suspendedOrganizer: SchoolMembership = { ...organizer, status: 'suspended' };
  const admin: SchoolMembership = { ...organizer, uid: 'admin-1', role: 'admin' };
  const student: SchoolMembership = { ...organizer, uid: 'stu-1', role: 'student' };

  assert.equal(getMembershipCapabilities(null).canAccessOrganizer, false);
  assert.equal(getMembershipCapabilities(student).canAccessOrganizer, false);
  assert.equal(getMembershipCapabilities(student).isActiveMember, true);
  assert.equal(getMembershipCapabilities(suspendedOrganizer).isActiveMember, false);
  assert.equal(getMembershipCapabilities(suspendedOrganizer).canAccessOrganizer, false);
  assert.equal(getMembershipCapabilities(organizer).canAccessOrganizer, true);
  assert.equal(getMembershipCapabilities(organizer).canManageRoles, false);
  assert.equal(getMembershipCapabilities(admin).canManageRoles, true);

  const ownEvent = { schoolId: 'oakridge-high', createdBy: 'org-1' };
  const otherEvent = { schoolId: 'oakridge-high', createdBy: 'org-2' };
  const otherSchoolEvent = { schoolId: 'westview-high', createdBy: 'org-1' };

  assert.equal(canManageEvent(ownEvent, organizer), true);
  assert.equal(canManageEvent(otherEvent, organizer), false);
  assert.equal(canManageEvent(otherEvent, admin), true);
  assert.equal(canManageEvent(otherSchoolEvent, admin), false);
});

test('canAcceptRsvp blocks draft, cancelled, past, and non-member school-only events', () => {
  const futureStart = new Date(NOW.getTime() + 60 * 60 * 1000);
  const futureEnd = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
  const pastStart = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
  const pastEnd = new Date(NOW.getTime() - 60 * 60 * 1000);

  assert.equal(
    canAcceptRsvp({ status: 'published', visibility: 'public', startAt: futureStart, endAt: futureEnd }, false, NOW),
    true
  );
  assert.equal(
    canAcceptRsvp({ status: 'draft', visibility: 'public', startAt: futureStart, endAt: futureEnd }, true, NOW),
    false
  );
  assert.equal(
    canAcceptRsvp({ status: 'cancelled', visibility: 'public', startAt: futureStart, endAt: futureEnd }, true, NOW),
    false
  );
  assert.equal(
    canAcceptRsvp({ status: 'published', visibility: 'public', startAt: pastStart, endAt: pastEnd }, true, NOW),
    false
  );
  assert.equal(
    canAcceptRsvp({ status: 'published', visibility: 'school', startAt: futureStart, endAt: futureEnd }, false, NOW),
    false
  );
  assert.equal(
    canAcceptRsvp({ status: 'published', visibility: 'school', startAt: futureStart, endAt: futureEnd }, true, NOW),
    true
  );

  assert.equal(isPastEvent({ startAt: pastStart, endAt: pastEnd }, NOW), true);
  assert.equal(isPastEvent({ startAt: futureStart, endAt: futureEnd }, NOW), false);
});
