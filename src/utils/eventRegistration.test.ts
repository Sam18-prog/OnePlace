import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SchoolEvent } from '../types/event';
import type { EventRegistrationRecord } from '../types/eventOperations';
import {
  computeRegistrationCounterDeltas,
  computeWaitlistPosition,
  evaluateStudentCancellationAttempt,
  evaluateStudentRegistrationAttempt,
  getEventCapacitySnapshot,
  isWaitlistOfferExpired,
  resolveStudentEventLifecycleState,
  selectNextWaitlistPromotionCandidate,
  simulateAtomicCapacityBatch,
  sortWaitlistQueue,
  validateRegistrationConfigUpdate,
} from './eventRegistration';

const NOW = new Date('2026-05-10T12:00:00Z');

function makeEvent(overrides: Partial<SchoolEvent> = {}): SchoolEvent {
  return {
    id: 'evt-1',
    schoolId: 'oakridge-high',
    title: 'Robotics Showcase',
    description: 'Annual student prototype expo in the engineering lab.',
    hostClub: 'Robotics Club',
    clubId: 'robotics-club',
    category: 'STEM & Makers',
    dateTime: new Date('2026-05-15T18:00:00Z'),
    startAt: new Date('2026-05-15T18:00:00Z'),
    endAt: new Date('2026-05-15T20:00:00Z'),
    timezone: 'America/New_York',
    location: 'Lab B-204',
    createdBy: 'org-1',
    createdAt: new Date('2026-05-01T10:00:00Z'),
    updatedAt: new Date('2026-05-01T10:00:00Z'),
    status: 'published',
    visibility: 'public',
    rsvpCount: 0,
    discoverKey: 'public:oakridge-high',
    ...overrides,
  };
}

function makeRegistration(overrides: Partial<EventRegistrationRecord> = {}): EventRegistrationRecord {
  return {
    uid: 'student-1',
    eventId: 'evt-1',
    schoolId: 'oakridge-high',
    status: 'confirmed',
    registeredAt: new Date('2026-05-05T10:00:00Z'),
    updatedAt: new Date('2026-05-05T10:00:00Z'),
    ...overrides,
  };
}

describe('Phase 8 — Registration & Capacity Logic', () => {
  it('computes unlimited vs capped capacity snapshots accurately', () => {
    const unlimited = getEventCapacitySnapshot(makeEvent({ rsvpCount: 12 }), NOW);
    assert.equal(unlimited.isUnlimited, true);
    assert.equal(unlimited.isFull, false);
    assert.equal(unlimited.remainingSpots, null);
    assert.equal(unlimited.effectiveRegistrationStatus, 'open');

    const capped = getEventCapacitySnapshot(
      makeEvent({ rsvpCount: 18, confirmedCount: 18, capacityLimit: 20 }),
      NOW
    );
    assert.equal(capped.isUnlimited, false);
    assert.equal(capped.isFull, false);
    assert.equal(capped.remainingSpots, 2);
    assert.equal(capped.utilizationPercent, 90);
    assert.equal(capped.effectiveRegistrationStatus, 'open');

    const full = getEventCapacitySnapshot(
      makeEvent({ rsvpCount: 20, confirmedCount: 20, capacityLimit: 20 }),
      NOW
    );
    assert.equal(full.isFull, true);
    assert.equal(full.remainingSpots, 0);
    assert.equal(full.effectiveRegistrationStatus, 'full');
  });

  it('enforces registration open/close windows, closed status, and suspended accounts', () => {
    const emptyLifecycle = resolveStudentEventLifecycleState({ legacyIsGoing: false });

    const notYetOpen = evaluateStudentRegistrationAttempt({
      event: makeEvent({ registrationOpensAt: new Date('2026-05-12T00:00:00Z') }),
      currentLifecycle: emptyLifecycle,
      isVerifiedUser: true,
      isActiveSchoolMember: true,
      isSuspendedMember: false,
      now: NOW,
    });
    assert.equal(notYetOpen.allowed, false);

    const closedWindow = evaluateStudentRegistrationAttempt({
      event: makeEvent({ registrationClosesAt: new Date('2026-05-09T23:59:00Z') }),
      currentLifecycle: emptyLifecycle,
      isVerifiedUser: true,
      isActiveSchoolMember: true,
      isSuspendedMember: false,
      now: NOW,
    });
    assert.equal(closedWindow.allowed, false);

    const suspended = evaluateStudentRegistrationAttempt({
      event: makeEvent(),
      currentLifecycle: emptyLifecycle,
      isVerifiedUser: true,
      isActiveSchoolMember: false,
      isSuspendedMember: true,
      now: NOW,
    });
    assert.equal(suspended.allowed, false);
  });

  it('routes registrations to confirmed, pending_approval, or waitlisted and prevents duplicates', () => {
    const none = resolveStudentEventLifecycleState({ legacyIsGoing: false });

    const confirmed = evaluateStudentRegistrationAttempt({
      event: makeEvent({ capacityLimit: 10, rsvpCount: 4 }),
      currentLifecycle: none,
      isVerifiedUser: true,
      isActiveSchoolMember: true,
      isSuspendedMember: false,
      now: NOW,
    });
    assert.equal(confirmed.allowed, true);
    assert.equal(confirmed.targetStatus, 'confirmed');

    const pending = evaluateStudentRegistrationAttempt({
      event: makeEvent({ capacityLimit: 10, rsvpCount: 4, requireApproval: true }),
      currentLifecycle: none,
      isVerifiedUser: true,
      isActiveSchoolMember: true,
      isSuspendedMember: false,
      now: NOW,
    });
    assert.equal(pending.allowed, true);
    assert.equal(pending.targetStatus, 'pending_approval');

    const waitlisted = evaluateStudentRegistrationAttempt({
      event: makeEvent({ capacityLimit: 10, rsvpCount: 10, allowWaitlist: true }),
      currentLifecycle: none,
      isVerifiedUser: true,
      isActiveSchoolMember: true,
      isSuspendedMember: false,
      now: NOW,
    });
    assert.equal(waitlisted.allowed, true);
    assert.equal(waitlisted.targetStatus, 'waitlisted');

    const fullNoWaitlist = evaluateStudentRegistrationAttempt({
      event: makeEvent({ capacityLimit: 10, rsvpCount: 10, allowWaitlist: false }),
      currentLifecycle: none,
      isVerifiedUser: true,
      isActiveSchoolMember: true,
      isSuspendedMember: false,
      now: NOW,
    });
    assert.equal(fullNoWaitlist.allowed, false);

    const alreadyConfirmed = resolveStudentEventLifecycleState({
      legacyIsGoing: false,
      registration: makeRegistration({ status: 'confirmed' }),
    });
    const duplicateAttempt = evaluateStudentRegistrationAttempt({
      event: makeEvent({ capacityLimit: 10, rsvpCount: 4 }),
      currentLifecycle: alreadyConfirmed,
      isVerifiedUser: true,
      isActiveSchoolMember: true,
      isSuspendedMember: false,
      now: NOW,
    });
    assert.equal(duplicateAttempt.allowed, false);
  });

  it('prevents concurrent capacity overbooking in atomic admission simulation', () => {
    const result = simulateAtomicCapacityBatch({
      initialConfirmed: 8,
      capacityLimit: 10,
      allowWaitlist: true,
      applicantUids: ['u1', 'u2', 'u3', 'u4', 'u2'],
    });
    assert.deepEqual(result.confirmedUids, ['u1', 'u2']);
    assert.deepEqual(result.waitlistedUids, ['u3', 'u4']);
    assert.deepEqual(result.rejectedUids, ['u2']);
    assert.equal(result.finalConfirmedCount, 10);
  });

  it('orders waitlist strictly FIFO, calculates safe position, and skips expired offers', () => {
    const regs: EventRegistrationRecord[] = [
      makeRegistration({
        uid: 'u-late',
        status: 'waitlisted',
        waitlistTimestamp: new Date('2026-05-05T10:10:00Z'),
      }),
      makeRegistration({
        uid: 'u-expired',
        status: 'waitlisted',
        waitlistTimestamp: new Date('2026-05-05T10:00:00Z'),
        offerExpiresAt: new Date('2026-05-09T10:00:00Z'),
      }),
      makeRegistration({
        uid: 'u-next',
        status: 'waitlisted',
        waitlistTimestamp: new Date('2026-05-05T10:05:00Z'),
      }),
      makeRegistration({ uid: 'u-confirmed', status: 'confirmed' }),
    ];

    const sorted = sortWaitlistQueue(regs);
    assert.deepEqual(
      sorted.map((r) => r.uid),
      ['u-expired', 'u-next', 'u-late']
    );
    assert.equal(computeWaitlistPosition('u-next', regs, true), 2);
    assert.equal(computeWaitlistPosition('u-next', regs, false), null);
    assert.equal(isWaitlistOfferExpired(regs[1], NOW), true);

    const candidate = selectNextWaitlistPromotionCandidate(regs, NOW);
    assert.equal(candidate?.uid, 'u-next');
  });

  it('computes accurate counter deltas and enforces cancellation + capacity adjustment guards', () => {
    assert.deepEqual(computeRegistrationCounterDeltas('waitlisted', 'confirmed'), {
      rsvpDelta: 1,
      confirmedDelta: 1,
      pendingApprovalDelta: 0,
      waitlistDelta: -1,
      cancelledDelta: 0,
    });
    assert.deepEqual(computeRegistrationCounterDeltas('confirmed', 'cancelled'), {
      rsvpDelta: -1,
      confirmedDelta: -1,
      pendingApprovalDelta: 0,
      waitlistDelta: 0,
      cancelledDelta: 1,
    });

    const attendedState = resolveStudentEventLifecycleState({
      legacyIsGoing: true,
      attendance: {
        uid: 'student-1',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'checked_in',
        method: 'manual',
        checkedInAt: NOW,
        checkedInBy: 'org-1',
        updatedAt: NOW,
      },
    });
    assert.equal(attendedState.status, 'attended');
    const cancelAttended = evaluateStudentCancellationAttempt({
      event: makeEvent(),
      currentLifecycle: attendedState,
      now: NOW,
    });
    assert.equal(cancelAttended.allowed, false);

    const badCapacity = validateRegistrationConfigUpdate({
      capacityLimit: 5,
      currentConfirmedCount: 12,
      eventEndAt: new Date('2026-05-15T20:00:00Z'),
    });
    assert.equal(badCapacity.valid, false);
  });
});
