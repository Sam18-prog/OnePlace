import type { SchoolEvent } from '../types/event';
import type {
  AnonymizedEventFeedbackComment,
  AttendanceStatus,
  AttendanceSummaryMetrics,
  EventAnnouncementRecord,
  EventAttendanceRecord,
  EventFeedbackRecord,
  EventFeedbackSummary,
  EventRegistrationRecord,
  QrCheckInTokenPayload,
  QrCheckInValidationResult,
  StudentEventLifecycleState,
} from '../types/eventOperations';
import type { SchoolMembership } from '../types/membership';
import { isPastEvent } from './eventValidation';

export const EVENT_ANNOUNCEMENT_TITLE_MIN = 3;
export const EVENT_ANNOUNCEMENT_TITLE_MAX = 120;
export const EVENT_ANNOUNCEMENT_MESSAGE_MIN = 5;
export const EVENT_ANNOUNCEMENT_MESSAGE_MAX = 600;
export const EVENT_FEEDBACK_TEXT_MAX = 1000;
export const ATTENDANCE_CORRECTION_NOTE_MAX = 240;

/**
 * Checks whether a signed-in user is authorized to manage operations (registrations,
 * check-in, attendance corrections, announcements, feedback summary) for a given event.
 * Matches firestore.rules: active School Admin of event.schoolId OR active assigned Club Organizer
 * of event.clubId (or creator with active club organizer role).
 */
export function canOperateEvent(
  event: Pick<SchoolEvent, 'schoolId' | 'clubId' | 'createdBy'>,
  membership: Pick<SchoolMembership, 'uid' | 'schoolId' | 'role' | 'status'> | null,
  managedClubIds: ReadonlySet<string> = new Set()
): boolean {
  if (!membership || membership.status !== 'active') return false;
  if (membership.schoolId !== event.schoolId) return false;
  if (membership.role === 'admin') return true;
  if (membership.role === 'organizer') {
    return managedClubIds.has(event.clubId) || event.createdBy === membership.uid;
  }
  return false;
}

/**
 * Pure attendance metrics calculation for an event operations view.
 * Attendance rate is explicitly defined as checkedIn / confirmed (0..100),
 * or null when confirmed == 0 to avoid misleading 0% or NaN values.
 */
export function computeAttendanceSummary(params: {
  registrations: readonly EventRegistrationRecord[];
  attendance: readonly EventAttendanceRecord[];
  fallbackConfirmedCount?: number;
  fallbackCheckedInCount?: number;
}): AttendanceSummaryMetrics {
  const { registrations, attendance, fallbackConfirmedCount, fallbackCheckedInCount } = params;

  const confirmedUids = new Set<string>();
  let waitlistCount = 0;
  let pendingApprovalCount = 0;
  let cancelledCount = 0;

  for (const reg of registrations) {
    if (reg.status === 'confirmed') confirmedUids.add(reg.uid);
    else if (reg.status === 'waitlisted') waitlistCount += 1;
    else if (reg.status === 'pending_approval') pendingApprovalCount += 1;
    else if (reg.status === 'cancelled') cancelledCount += 1;
  }

  let checkedInCount = 0;
  let excusedCount = 0;
  const checkedInUids = new Set<string>();

  for (const att of attendance) {
    if (att.status === 'checked_in') {
      checkedInCount += 1;
      checkedInUids.add(att.uid);
    } else if (att.status === 'excused') {
      excusedCount += 1;
    }
  }

  // Account for any legacy RSVP attendees who have not yet migrated to registrations subcollection
  const confirmedCount = Math.max(
    confirmedUids.size,
    typeof fallbackConfirmedCount === 'number' && Number.isFinite(fallbackConfirmedCount)
      ? Math.max(0, Math.floor(fallbackConfirmedCount))
      : 0
  );

  const effectiveCheckedIn = Math.max(
    checkedInCount,
    typeof fallbackCheckedInCount === 'number' && Number.isFinite(fallbackCheckedInCount)
      ? Math.max(0, Math.floor(fallbackCheckedInCount))
      : 0
  );

  const notYetCheckedInCount = Math.max(0, confirmedCount - effectiveCheckedIn - excusedCount);
  const attendanceRatePercent =
    confirmedCount > 0
      ? Math.min(100, Math.round((effectiveCheckedIn / confirmedCount) * 100))
      : null;

  return {
    confirmedCount,
    checkedInCount: effectiveCheckedIn,
    notYetCheckedInCount,
    excusedCount,
    cancelledCount,
    waitlistCount,
    pendingApprovalCount,
    attendanceRatePercent,
  };
}

/**
 * Pure check-in transition helper enforcing authorization, duplicate check-in detection,
 * and accurate checkedInCount delta.
 */
export function evaluateOrganizerCheckInAction(params: {
  isAuthorizedOrganizer: boolean;
  eventStatus: SchoolEvent['status'];
  targetRegistrationStatus?: EventRegistrationRecord['status'] | 'legacy_confirmed' | null;
  existingAttendance?: EventAttendanceRecord | null;
  nextStatus: AttendanceStatus;
}): {
  allowed: boolean;
  isDuplicate: boolean;
  checkedInCountDelta: number;
  reason?: string;
} {
  const {
    isAuthorizedOrganizer,
    eventStatus,
    targetRegistrationStatus,
    existingAttendance,
    nextStatus,
  } = params;

  if (!isAuthorizedOrganizer) {
    return {
      allowed: false,
      isDuplicate: false,
      checkedInCountDelta: 0,
      reason: 'Only authorized event organizers or school admins can record attendance.',
    };
  }

  if (eventStatus === 'cancelled' || eventStatus === 'draft') {
    return {
      allowed: false,
      isDuplicate: false,
      checkedInCountDelta: 0,
      reason: 'Attendance cannot be recorded for draft or cancelled events.',
    };
  }

  if (
    nextStatus === 'checked_in' &&
    targetRegistrationStatus !== 'confirmed' &&
    targetRegistrationStatus !== 'legacy_confirmed'
  ) {
    return {
      allowed: false,
      isDuplicate: false,
      checkedInCountDelta: 0,
      reason: 'Only confirmed registrants can be checked in.',
    };
  }

  const prevStatus: AttendanceStatus = existingAttendance?.status ?? 'not_checked_in';
  if (prevStatus === nextStatus) {
    return {
      allowed: false,
      isDuplicate: true,
      checkedInCountDelta: 0,
      reason:
        nextStatus === 'checked_in'
          ? 'Attendee is already checked in.'
          : `Attendance status is already set to ${nextStatus.replace('_', ' ')}.`,
    };
  }

  let checkedInCountDelta = 0;
  if (prevStatus !== 'checked_in' && nextStatus === 'checked_in') {
    checkedInCountDelta = 1;
  } else if (prevStatus === 'checked_in' && nextStatus !== 'checked_in') {
    checkedInCountDelta = -1;
  }

  return {
    allowed: true,
    isDuplicate: false,
    checkedInCountDelta,
  };
}

/**
 * Trusted QR check-in verification state machine (ready for Blaze Cloud Functions signed tokens).
 * Strictly rejects unsigned/unverified tokens, expired tokens, wrong-event tokens,
 * unauthorized scanners, revoked tokens, unregistered users, and duplicate check-ins.
 */
export function validateQrCheckInAttempt(params: {
  token: QrCheckInTokenPayload | null;
  expectedEventId: string;
  expectedSchoolId: string;
  eventStatus: SchoolEvent['status'];
  scannerAuthorized: boolean;
  attendeeRegistrationStatus: EventRegistrationRecord['status'] | 'legacy_confirmed' | null;
  existingAttendanceStatus: AttendanceStatus | null;
  seenTokenIds?: ReadonlySet<string>;
  nowMs?: number;
}): QrCheckInValidationResult {
  const {
    token,
    expectedEventId,
    expectedSchoolId,
    eventStatus,
    scannerAuthorized,
    attendeeRegistrationStatus,
    existingAttendanceStatus,
    seenTokenIds,
    nowMs = Date.now(),
  } = params;

  if (!scannerAuthorized) {
    return {
      allowed: false,
      code: 'unauthorized_scanner',
      message: 'Scanner account is not authorized to check in attendees for this event.',
    };
  }

  if (!token || !token.signatureVerified) {
    return {
      allowed: false,
      code: 'invalid_signature',
      message: 'Check-in pass signature is missing or invalid.',
    };
  }

  if (token.revoked) {
    return {
      allowed: false,
      code: 'revoked_token',
      message: 'This check-in pass has been revoked.',
    };
  }

  if (nowMs > token.expiresAtMs || token.expiresAtMs <= token.issuedAtMs) {
    return {
      allowed: false,
      code: 'expired_token',
      message: 'This check-in pass has expired.',
    };
  }

  if (token.eventId !== expectedEventId) {
    return {
      allowed: false,
      code: 'wrong_event',
      message: 'This check-in pass belongs to a different event.',
    };
  }

  if (token.schoolId !== expectedSchoolId) {
    return {
      allowed: false,
      code: 'wrong_school',
      message: 'This check-in pass belongs to a different school.',
    };
  }

  if (eventStatus !== 'published') {
    return {
      allowed: false,
      code: 'event_cancelled',
      message: 'Check-in is unavailable because this event is not active.',
    };
  }

  if (seenTokenIds?.has(token.tokenId)) {
    return {
      allowed: false,
      code: 'duplicate_scan',
      message: 'This check-in pass was already scanned.',
    };
  }

  if (
    attendeeRegistrationStatus !== 'confirmed' &&
    attendeeRegistrationStatus !== 'legacy_confirmed'
  ) {
    return {
      allowed: false,
      code: 'not_registered',
      message: 'Student does not have a confirmed registration for this event.',
    };
  }

  if (existingAttendanceStatus === 'checked_in') {
    return {
      allowed: false,
      code: 'already_checked_in',
      message: 'Student has already been checked in to this event.',
    };
  }

  return {
    allowed: true,
    code: 'valid',
    message: 'Check-in pass verified.',
  };
}

/**
 * Validates event announcement input prior to publishing.
 */
export function validateEventAnnouncementInput(input: {
  title: string;
  message: string;
}): { valid: boolean; errors: { title?: string; message?: string } } {
  const errors: { title?: string; message?: string } = {};
  const title = input.title.trim();
  const message = input.message.trim();

  if (title.length < EVENT_ANNOUNCEMENT_TITLE_MIN) {
    errors.title = `Headline must be at least ${EVENT_ANNOUNCEMENT_TITLE_MIN} characters.`;
  } else if (title.length > EVENT_ANNOUNCEMENT_TITLE_MAX) {
    errors.title = `Headline must be ${EVENT_ANNOUNCEMENT_TITLE_MAX} characters or fewer.`;
  }

  if (message.length < EVENT_ANNOUNCEMENT_MESSAGE_MIN) {
    errors.message = `Message must be at least ${EVENT_ANNOUNCEMENT_MESSAGE_MIN} characters.`;
  } else if (message.length > EVENT_ANNOUNCEMENT_MESSAGE_MAX) {
    errors.message = `Message must be ${EVENT_ANNOUNCEMENT_MESSAGE_MAX} characters or fewer.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Filters active announcements for student display and sorts newest first.
 */
export function getVisibleEventAnnouncements(
  announcements: readonly EventAnnouncementRecord[]
): EventAnnouncementRecord[] {
  return announcements
    .filter((a) => a.status === 'active')
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Determines whether a student is eligible to submit post-event feedback.
 * Allowed ONLY after the event ends (now > endAt), for confirmed or attended participants,
 * and blocked if feedback was already submitted.
 */
export function evaluatePostEventFeedbackEligibility(params: {
  event: Pick<SchoolEvent, 'status' | 'startAt' | 'endAt'>;
  lifecycle: StudentEventLifecycleState;
  hasAlreadySubmitted: boolean;
  isVerifiedUser: boolean;
  isSuspendedMember: boolean;
  now?: Date;
}): { eligible: boolean; reason?: string } {
  const {
    event,
    lifecycle,
    hasAlreadySubmitted,
    isVerifiedUser,
    isSuspendedMember,
    now = new Date(),
  } = params;

  if (!isVerifiedUser) {
    return { eligible: false, reason: 'Sign in with a verified account to submit feedback.' };
  }
  if (isSuspendedMember) {
    return { eligible: false, reason: 'Suspended members cannot submit event feedback.' };
  }
  if (event.status !== 'published') {
    return { eligible: false, reason: 'Feedback is only collected for completed campus events.' };
  }
  if (!isPastEvent(event, now)) {
    return { eligible: false, reason: 'Feedback opens after the event ends.' };
  }
  if (hasAlreadySubmitted) {
    return { eligible: false, reason: 'You have already submitted feedback for this event.' };
  }
  if (lifecycle.status !== 'confirmed' && lifecycle.status !== 'attended') {
    return {
      eligible: false,
      reason: 'Only confirmed registrants and checked-in attendees can submit post-event feedback.',
    };
  }

  return { eligible: true };
}

export function validatePostEventFeedbackInput(input: {
  overallRating: number;
  organizationRating: number;
  writtenFeedback?: string;
  improvementSuggestions?: string;
}): {
  valid: boolean;
  errors: {
    overallRating?: string;
    organizationRating?: string;
    writtenFeedback?: string;
    improvementSuggestions?: string;
  };
} {
  const errors: {
    overallRating?: string;
    organizationRating?: string;
    writtenFeedback?: string;
    improvementSuggestions?: string;
  } = {};

  if (
    !Number.isInteger(input.overallRating) ||
    input.overallRating < 1 ||
    input.overallRating > 5
  ) {
    errors.overallRating = 'Choose an overall rating between 1 and 5.';
  }

  if (
    !Number.isInteger(input.organizationRating) ||
    input.organizationRating < 1 ||
    input.organizationRating > 5
  ) {
    errors.organizationRating = 'Choose an organization rating between 1 and 5.';
  }

  if (input.writtenFeedback && input.writtenFeedback.trim().length > EVENT_FEEDBACK_TEXT_MAX) {
    errors.writtenFeedback = `Feedback must be ${EVENT_FEEDBACK_TEXT_MAX} characters or fewer.`;
  }

  if (
    input.improvementSuggestions &&
    input.improvementSuggestions.trim().length > EVENT_FEEDBACK_TEXT_MAX
  ) {
    errors.improvementSuggestions = `Suggestions must be ${EVENT_FEEDBACK_TEXT_MAX} characters or fewer.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Aggregates post-event feedback for organizers/admins while strictly stripping submitter UIDs
 * so individual student identities are never exposed in feedback summaries.
 */
export function aggregateEventFeedbackSummary(
  records: readonly EventFeedbackRecord[]
): EventFeedbackSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  if (records.length === 0) {
    return {
      responseCount: 0,
      averageOverallRating: null,
      averageOrganizationRating: null,
      ratingDistribution: distribution,
      comments: [],
    };
  }

  let overallSum = 0;
  let orgSum = 0;
  const comments: AnonymizedEventFeedbackComment[] = [];

  for (const rec of records) {
    const overall = Math.min(5, Math.max(1, Math.round(rec.overallRating))) as 1 | 2 | 3 | 4 | 5;
    const org = Math.min(5, Math.max(1, Math.round(rec.organizationRating)));
    overallSum += overall;
    orgSum += org;
    distribution[overall] += 1;

    const cleanFeedback = rec.writtenFeedback?.trim();
    const cleanSuggestions = rec.improvementSuggestions?.trim();
    if (cleanFeedback || cleanSuggestions) {
      comments.push({
        id: `anon_${comments.length + 1}_${rec.createdAt.getTime()}`,
        overallRating: overall,
        organizationRating: org,
        writtenFeedback: cleanFeedback || undefined,
        improvementSuggestions: cleanSuggestions || undefined,
        createdAt: rec.createdAt,
      });
    }
  }

  comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    responseCount: records.length,
    averageOverallRating: Math.round((overallSum / records.length) * 10) / 10,
    averageOrganizationRating: Math.round((orgSum / records.length) * 10) / 10,
    ratingDistribution: distribution,
    comments,
  };
}
