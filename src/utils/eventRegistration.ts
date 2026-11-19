import type { SchoolEvent } from '../types/event';
import type {
  EventAttendanceRecord,
  EventRegistrationAvailability,
  EventRegistrationRecord,
  RegistrationStatus,
  StudentEventLifecycleState,
} from '../types/eventOperations';
import { isPastEvent } from './eventValidation';

export const EVENT_CAPACITY_MIN = 1;
export const EVENT_CAPACITY_MAX = 100_000;
export const DEFAULT_WAITLIST_OFFER_HOURS = 24;

export interface EventCapacitySnapshot {
  confirmedCount: number;
  capacityLimit: number | null;
  remainingSpots: number | null;
  isUnlimited: boolean;
  isFull: boolean;
  waitlistCount: number;
  pendingApprovalCount: number;
  checkedInCount: number;
  cancelledCount: number;
  utilizationPercent: number | null;
  effectiveRegistrationStatus: EventRegistrationAvailability;
}

export interface RegistrationActionEligibility {
  allowed: boolean;
  targetStatus?: RegistrationStatus;
  reason?: string;
}

/**
 * Returns the canonical confirmed registration count for an event.
 * Keeps Phase 1–7 legacy rsvpCount and Phase 8 confirmedCount reconciled as a single source of truth.
 */
export function getCanonicalConfirmedCount(
  event: Pick<SchoolEvent, 'rsvpCount' | 'confirmedCount'>
): number {
  const base =
    typeof event.confirmedCount === 'number' && Number.isFinite(event.confirmedCount)
      ? event.confirmedCount
      : event.rsvpCount;
  return Math.max(0, Math.floor(Number.isFinite(base) ? base : 0));
}

export function normalizeCapacityLimit(limit: unknown): number | null {
  if (limit === null || limit === undefined || limit === '') return null;
  const parsed = typeof limit === 'number' ? limit : Number(limit);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < EVENT_CAPACITY_MIN || parsed > EVENT_CAPACITY_MAX) return null;
  return parsed;
}

/**
 * Computes authoritative capacity & effective registration availability for an event.
 */
export function getEventCapacitySnapshot(
  event: Pick<
    SchoolEvent,
    | 'status'
    | 'startAt'
    | 'endAt'
    | 'rsvpCount'
    | 'confirmedCount'
    | 'capacityLimit'
    | 'waitlistCount'
    | 'pendingApprovalCount'
    | 'checkedInCount'
    | 'cancelledCount'
    | 'registrationStatus'
    | 'registrationOpensAt'
    | 'registrationClosesAt'
  >,
  now: Date = new Date()
): EventCapacitySnapshot {
  const confirmedCount = getCanonicalConfirmedCount(event);
  const capacityLimit = normalizeCapacityLimit(event.capacityLimit);
  const isUnlimited = capacityLimit === null;
  const remainingSpots = isUnlimited ? null : Math.max(0, capacityLimit - confirmedCount);
  const isFull = !isUnlimited && confirmedCount >= capacityLimit;
  const waitlistCount = Math.max(0, Math.floor(event.waitlistCount ?? 0));
  const pendingApprovalCount = Math.max(0, Math.floor(event.pendingApprovalCount ?? 0));
  const checkedInCount = Math.max(0, Math.floor(event.checkedInCount ?? 0));
  const cancelledCount = Math.max(0, Math.floor(event.cancelledCount ?? 0));
  const utilizationPercent =
    isUnlimited || capacityLimit === 0
      ? null
      : Math.min(100, Math.round((confirmedCount / capacityLimit) * 100));

  let effectiveRegistrationStatus: EventRegistrationAvailability = 'open';
  if (event.status === 'cancelled' || event.registrationStatus === 'cancelled') {
    effectiveRegistrationStatus = 'cancelled';
  } else if (
    event.status === 'draft' ||
    event.registrationStatus === 'closed' ||
    isPastEvent(event, now) ||
    (event.registrationOpensAt && now.getTime() < event.registrationOpensAt.getTime()) ||
    (event.registrationClosesAt && now.getTime() > event.registrationClosesAt.getTime())
  ) {
    effectiveRegistrationStatus = 'closed';
  } else if (isFull || event.registrationStatus === 'full') {
    effectiveRegistrationStatus = 'full';
  }

  return {
    confirmedCount,
    capacityLimit,
    remainingSpots,
    isUnlimited,
    isFull,
    waitlistCount,
    pendingApprovalCount,
    checkedInCount,
    cancelledCount,
    utilizationPercent,
    effectiveRegistrationStatus,
  };
}

/**
 * Resolves a student's unambiguous lifecycle state for an event, reconciling
 * Phase 8 attendance + registration records with legacy Phase 1–7 RSVP records.
 */
export function resolveStudentEventLifecycleState(params: {
  legacyIsGoing: boolean;
  registration?: EventRegistrationRecord | null;
  attendance?: EventAttendanceRecord | null;
  waitlistPosition?: number | null;
}): StudentEventLifecycleState {
  const { legacyIsGoing, registration, attendance, waitlistPosition = null } = params;

  if (attendance && attendance.status === 'checked_in') {
    return {
      status: 'attended',
      source: 'attendance',
      registration: registration ?? null,
      attendance,
      waitlistPosition: null,
    };
  }

  if (registration) {
    return {
      status: registration.status,
      source: 'registration',
      registration,
      attendance: attendance ?? null,
      waitlistPosition: registration.status === 'waitlisted' ? waitlistPosition : null,
    };
  }

  if (legacyIsGoing) {
    return {
      status: 'confirmed',
      source: 'legacy_rsvp',
      registration: null,
      attendance: attendance ?? null,
      waitlistPosition: null,
    };
  }

  return {
    status: 'not_registered',
    source: 'none',
    registration: null,
    attendance: attendance ?? null,
    waitlistPosition: null,
  };
}

/**
 * Pure state machine deciding whether a student may register or join waitlist,
 * and which target RegistrationStatus applies.
 */
export function evaluateStudentRegistrationAttempt(params: {
  event: Pick<
    SchoolEvent,
    | 'status'
    | 'visibility'
    | 'startAt'
    | 'endAt'
    | 'rsvpCount'
    | 'confirmedCount'
    | 'capacityLimit'
    | 'allowWaitlist'
    | 'requireApproval'
    | 'registrationStatus'
    | 'registrationOpensAt'
    | 'registrationClosesAt'
  >;
  currentLifecycle: StudentEventLifecycleState;
  isVerifiedUser: boolean;
  isActiveSchoolMember: boolean;
  isSuspendedMember: boolean;
  now?: Date;
}): RegistrationActionEligibility {
  const {
    event,
    currentLifecycle,
    isVerifiedUser,
    isActiveSchoolMember,
    isSuspendedMember,
    now = new Date(),
  } = params;

  if (!isVerifiedUser) {
    return { allowed: false, reason: 'Please sign in with a verified account to register.' };
  }
  if (isSuspendedMember) {
    return {
      allowed: false,
      reason: 'Suspended school members cannot create new event registrations.',
    };
  }
  if (event.status === 'draft') {
    return { allowed: false, reason: 'Draft events are not open for registration.' };
  }
  if (event.status === 'cancelled' || event.registrationStatus === 'cancelled') {
    return { allowed: false, reason: 'This event has been cancelled.' };
  }
  if (event.visibility === 'school' && !isActiveSchoolMember) {
    return {
      allowed: false,
      reason: 'This event is restricted to verified members of this school.',
    };
  }
  if (isPastEvent(event, now)) {
    return { allowed: false, reason: 'Registration is closed because this event has ended.' };
  }
  if (event.registrationStatus === 'closed') {
    return { allowed: false, reason: 'Registration has been closed by the organizer.' };
  }
  if (event.registrationOpensAt && now.getTime() < event.registrationOpensAt.getTime()) {
    return { allowed: false, reason: 'Registration has not opened yet.' };
  }
  if (event.registrationClosesAt && now.getTime() > event.registrationClosesAt.getTime()) {
    return { allowed: false, reason: 'The registration deadline has passed.' };
  }

  // Prevent duplicate active registrations
  if (
    currentLifecycle.status === 'confirmed' ||
    currentLifecycle.status === 'attended'
  ) {
    return { allowed: false, reason: 'You are already confirmed for this event.' };
  }
  if (currentLifecycle.status === 'pending_approval') {
    return { allowed: false, reason: 'Your registration request is already pending approval.' };
  }
  if (currentLifecycle.status === 'waitlisted') {
    return { allowed: false, reason: 'You are already on the waitlist for this event.' };
  }

  const capacity = getEventCapacitySnapshot(event, now);

  if (capacity.isFull) {
    if (event.allowWaitlist) {
      return { allowed: true, targetStatus: 'waitlisted' };
    }
    return { allowed: false, reason: 'This event is full and does not have a waitlist.' };
  }

  if (event.requireApproval) {
    return { allowed: true, targetStatus: 'pending_approval' };
  }

  return { allowed: true, targetStatus: 'confirmed' };
}

/**
 * Pure check for whether a student can cancel their current registration or leave waitlist.
 */
export function evaluateStudentCancellationAttempt(params: {
  event: Pick<SchoolEvent, 'status' | 'endAt' | 'startAt'>;
  currentLifecycle: StudentEventLifecycleState;
  now?: Date;
}): { allowed: boolean; reason?: string } {
  const { event, currentLifecycle, now = new Date() } = params;

  if (currentLifecycle.status === 'attended') {
    return {
      allowed: false,
      reason: 'You have already been checked in to this event.',
    };
  }

  if (
    currentLifecycle.status !== 'confirmed' &&
    currentLifecycle.status !== 'pending_approval' &&
    currentLifecycle.status !== 'waitlisted'
  ) {
    return {
      allowed: false,
      reason: 'You do not have an active registration to cancel.',
    };
  }

  if (event.status === 'published' && isPastEvent(event, now)) {
    return {
      allowed: false,
      reason: 'Past event registrations can no longer be cancelled.',
    };
  }

  return { allowed: true };
}

/**
 * Computes deterministic Firestore counter deltas when transitioning between registration states.
 */
export interface RegistrationCounterDeltas {
  rsvpDelta: number;
  confirmedDelta: number;
  pendingApprovalDelta: number;
  waitlistDelta: number;
  cancelledDelta: number;
}

export function computeRegistrationCounterDeltas(
  from: RegistrationStatus | null,
  to: RegistrationStatus
): RegistrationCounterDeltas {
  if (from === to) {
    return {
      rsvpDelta: 0,
      confirmedDelta: 0,
      pendingApprovalDelta: 0,
      waitlistDelta: 0,
      cancelledDelta: 0,
    };
  }

  let rsvpDelta = 0;
  let confirmedDelta = 0;
  let pendingApprovalDelta = 0;
  let waitlistDelta = 0;
  let cancelledDelta = 0;

  if (from === 'confirmed') {
    rsvpDelta -= 1;
    confirmedDelta -= 1;
  } else if (from === 'pending_approval') {
    pendingApprovalDelta -= 1;
  } else if (from === 'waitlisted') {
    waitlistDelta -= 1;
  } else if (from === 'cancelled') {
    cancelledDelta -= 1;
  }

  if (to === 'confirmed') {
    rsvpDelta += 1;
    confirmedDelta += 1;
  } else if (to === 'pending_approval') {
    pendingApprovalDelta += 1;
  } else if (to === 'waitlisted') {
    waitlistDelta += 1;
  } else if (to === 'cancelled') {
    cancelledDelta += 1;
  }

  return {
    rsvpDelta,
    confirmedDelta,
    pendingApprovalDelta,
    waitlistDelta,
    cancelledDelta,
  };
}

/**
 * Sorts waitlisted registrations strictly by server waitlistTimestamp ascending (FIFO),
 * using registeredAt and uid as deterministic tie-breakers.
 */
export function sortWaitlistQueue(
  registrations: readonly EventRegistrationRecord[]
): EventRegistrationRecord[] {
  return registrations
    .filter((r) => r.status === 'waitlisted')
    .slice()
    .sort((a, b) => {
      const aTime = (a.waitlistTimestamp ?? a.registeredAt).getTime();
      const bTime = (b.waitlistTimestamp ?? b.registeredAt).getTime();
      if (aTime !== bTime) return aTime - bTime;
      const aReg = a.registeredAt.getTime();
      const bReg = b.registeredAt.getTime();
      if (aReg !== bReg) return aReg - bReg;
      return a.uid.localeCompare(b.uid);
    });
}

/**
 * Safely computes 1-based waitlist position only when the complete waitlist snapshot is available
 * (e.g., for authorized organizers). Returns null if the user is not waitlisted or queue is incomplete.
 */
export function computeWaitlistPosition(
  uid: string,
  registrations: readonly EventRegistrationRecord[],
  isCompleteQueue: boolean = true
): number | null {
  if (!isCompleteQueue) return null;
  const sorted = sortWaitlistQueue(registrations);
  const idx = sorted.findIndex((r) => r.uid === uid);
  return idx >= 0 ? idx + 1 : null;
}

/**
 * Identifies the next eligible waitlisted registration for promotion, skipping any expired offers.
 */
export function selectNextWaitlistPromotionCandidate(
  registrations: readonly EventRegistrationRecord[],
  now: Date = new Date()
): EventRegistrationRecord | null {
  const sorted = sortWaitlistQueue(registrations);
  for (const reg of sorted) {
    if (reg.offerExpiresAt && reg.offerExpiresAt.getTime() < now.getTime()) {
      continue;
    }
    return reg;
  }
  return null;
}

export function isWaitlistOfferExpired(
  registration: Pick<EventRegistrationRecord, 'status' | 'offerExpiresAt'>,
  now: Date = new Date()
): boolean {
  if (registration.status !== 'waitlisted' || !registration.offerExpiresAt) return false;
  return registration.offerExpiresAt.getTime() < now.getTime();
}

/**
 * Pure atomic capacity admission simulator used by unit tests to verify concurrent race handling
 * (only the first `capacityLimit` requests get confirmed; extras route to waitlist or rejection).
 */
export function simulateAtomicCapacityBatch(params: {
  initialConfirmed: number;
  capacityLimit: number;
  allowWaitlist: boolean;
  applicantUids: string[];
}): {
  confirmedUids: string[];
  waitlistedUids: string[];
  rejectedUids: string[];
  finalConfirmedCount: number;
} {
  let confirmed = Math.max(0, Math.floor(params.initialConfirmed));
  const seen = new Set<string>();
  const confirmedUids: string[] = [];
  const waitlistedUids: string[] = [];
  const rejectedUids: string[] = [];

  for (const uid of params.applicantUids) {
    if (seen.has(uid)) {
      rejectedUids.push(uid);
      continue;
    }
    seen.add(uid);

    if (confirmed < params.capacityLimit) {
      confirmed += 1;
      confirmedUids.push(uid);
    } else if (params.allowWaitlist) {
      waitlistedUids.push(uid);
    } else {
      rejectedUids.push(uid);
    }
  }

  return {
    confirmedUids,
    waitlistedUids,
    rejectedUids,
    finalConfirmedCount: confirmed,
  };
}

/**
 * Validates organizer capacity adjustments so capacity cannot drop below existing confirmed count
 * unless explicitly handled, and validates optional registration open/close windows.
 */
export function validateRegistrationConfigUpdate(params: {
  capacityLimit: number | null;
  currentConfirmedCount: number;
  registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null;
  eventEndAt: Date;
}): { valid: boolean; error?: string } {
  const {
    capacityLimit,
    currentConfirmedCount,
    registrationOpensAt,
    registrationClosesAt,
    eventEndAt,
  } = params;

  if (capacityLimit !== null) {
    if (!Number.isInteger(capacityLimit) || capacityLimit < EVENT_CAPACITY_MIN || capacityLimit > EVENT_CAPACITY_MAX) {
      return {
        valid: false,
        error: `Capacity must be a whole number between ${EVENT_CAPACITY_MIN} and ${EVENT_CAPACITY_MAX.toLocaleString()}.`,
      };
    }
    if (capacityLimit < currentConfirmedCount) {
      return {
        valid: false,
        error: `Capacity cannot be lower than the ${currentConfirmedCount} already confirmed attendees.`,
      };
    }
  }

  if (
    registrationOpensAt &&
    registrationClosesAt &&
    registrationClosesAt.getTime() <= registrationOpensAt.getTime()
  ) {
    return {
      valid: false,
      error: 'Registration closing time must be after the opening time.',
    };
  }

  if (registrationOpensAt && registrationOpensAt.getTime() >= eventEndAt.getTime()) {
    return {
      valid: false,
      error: 'Registration opening time must be before the event ends.',
    };
  }

  if (registrationClosesAt && registrationClosesAt.getTime() > eventEndAt.getTime()) {
    return {
      valid: false,
      error: 'Registration closing time cannot be after the event ends.',
    };
  }

  return { valid: true };
}
