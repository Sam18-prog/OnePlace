import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SchoolEvent } from '../types/event';
import type {
  EventAttendanceRecord,
  EventFeedbackRecord,
  EventRegistrationRecord,
  QrCheckInTokenPayload,
} from '../types/eventOperations';
import {
  aggregateEventFeedbackSummary,
  canOperateEvent,
  computeAttendanceSummary,
  evaluateOrganizerCheckInAction,
  evaluatePostEventFeedbackEligibility,
  validateEventAnnouncementInput,
  validatePostEventFeedbackInput,
  validateQrCheckInAttempt,
} from './eventOperations';
import { resolveStudentEventLifecycleState } from './eventRegistration';

const NOW = new Date('2026-05-20T12:00:00Z');

function makeEndedEvent(overrides: Partial<SchoolEvent> = {}): SchoolEvent {
  return {
    id: 'evt-1',
    schoolId: 'oakridge-high',
    title: 'Spring Hackathon',
    description: '24-hour student engineering showcase.',
    hostClub: 'CS Club',
    clubId: 'cs-club',
    category: 'STEM & Makers',
    dateTime: new Date('2026-05-18T14:00:00Z'),
    startAt: new Date('2026-05-18T14:00:00Z'),
    endAt: new Date('2026-05-18T20:00:00Z'),
    timezone: 'America/New_York',
    location: 'Innovation Hall',
    createdBy: 'org-1',
    createdAt: new Date('2026-05-01T10:00:00Z'),
    updatedAt: new Date('2026-05-01T10:00:00Z'),
    status: 'published',
    visibility: 'public',
    rsvpCount: 3,
    discoverKey: 'public:oakridge-high',
    ...overrides,
  };
}

describe('Phase 8 — Operations, QR Check-In, Attendance, Announcements & Feedback', () => {
  it('enforces organizer & admin operational authorization strictly per school and club', () => {
    const evt = makeEndedEvent();
    const assignedClubs = new Set(['cs-club']);

    assert.equal(
      canOperateEvent(
        evt,
        { uid: 'student-1', schoolId: 'oakridge-high', role: 'student', status: 'active' },
        assignedClubs
      ),
      false
    );
    assert.equal(
      canOperateEvent(
        evt,
        { uid: 'org-other', schoolId: 'oakridge-high', role: 'organizer', status: 'active' },
        new Set(['drama-club'])
      ),
      false
    );
    assert.equal(
      canOperateEvent(
        evt,
        { uid: 'org-2', schoolId: 'oakridge-high', role: 'organizer', status: 'active' },
        assignedClubs
      ),
      true
    );
    assert.equal(
      canOperateEvent(
        evt,
        { uid: 'admin-west', schoolId: 'westview-high', role: 'admin', status: 'active' },
        new Set()
      ),
      false
    );
    assert.equal(
      canOperateEvent(
        evt,
        { uid: 'admin-oak', schoolId: 'oakridge-high', role: 'admin', status: 'active' },
        new Set()
      ),
      true
    );
  });

  it('computes accurate attendance summaries and detects duplicate check-ins & corrections', () => {
    const regs: EventRegistrationRecord[] = [
      {
        uid: 'u1',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'confirmed',
        registeredAt: NOW,
        updatedAt: NOW,
      },
      {
        uid: 'u2',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'confirmed',
        registeredAt: NOW,
        updatedAt: NOW,
      },
      {
        uid: 'u3',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'confirmed',
        registeredAt: NOW,
        updatedAt: NOW,
      },
      {
        uid: 'u4',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'confirmed',
        registeredAt: NOW,
        updatedAt: NOW,
      },
      {
        uid: 'u5',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'cancelled',
        registeredAt: NOW,
        updatedAt: NOW,
      },
    ];
    const att: EventAttendanceRecord[] = [
      {
        uid: 'u1',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'checked_in',
        method: 'manual',
        checkedInAt: NOW,
        checkedInBy: 'org-1',
        updatedAt: NOW,
      },
      {
        uid: 'u2',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'checked_in',
        method: 'manual',
        checkedInAt: NOW,
        checkedInBy: 'org-1',
        updatedAt: NOW,
      },
    ];

    const summary = computeAttendanceSummary({ registrations: regs, attendance: att });
    assert.equal(summary.confirmedCount, 4);
    assert.equal(summary.checkedInCount, 2);
    assert.equal(summary.notYetCheckedInCount, 2);
    assert.equal(summary.cancelledCount, 1);
    assert.equal(summary.attendanceRatePercent, 50);

    // Duplicate check-in blocked
    const dup = evaluateOrganizerCheckInAction({
      isAuthorizedOrganizer: true,
      eventStatus: 'published',
      targetRegistrationStatus: 'confirmed',
      existingAttendance: att[0],
      nextStatus: 'checked_in',
    });
    assert.equal(dup.allowed, false);
    assert.equal(dup.isDuplicate, true);
    assert.equal(dup.checkedInCountDelta, 0);

    // Authorized correction decrements count by 1
    const correction = evaluateOrganizerCheckInAction({
      isAuthorizedOrganizer: true,
      eventStatus: 'published',
      targetRegistrationStatus: 'confirmed',
      existingAttendance: att[0],
      nextStatus: 'not_checked_in',
    });
    assert.equal(correction.allowed, true);
    assert.equal(correction.checkedInCountDelta, -1);

    // Unauthorized student blocked
    const unauth = evaluateOrganizerCheckInAction({
      isAuthorizedOrganizer: false,
      eventStatus: 'published',
      targetRegistrationStatus: 'confirmed',
      existingAttendance: null,
      nextStatus: 'checked_in',
    });
    assert.equal(unauth.allowed, false);
  });

  it('validates QR check-in token contract for all valid and adversarial cases', () => {
    const validToken: QrCheckInTokenPayload = {
      tokenId: 'tok-abc',
      eventId: 'evt-1',
      attendeeUid: 'u1',
      schoolId: 'oakridge-high',
      issuedAtMs: NOW.getTime() - 60_000,
      expiresAtMs: NOW.getTime() + 600_000,
      signatureVerified: true,
    };

    const ok = validateQrCheckInAttempt({
      token: validToken,
      expectedEventId: 'evt-1',
      expectedSchoolId: 'oakridge-high',
      eventStatus: 'published',
      scannerAuthorized: true,
      attendeeRegistrationStatus: 'confirmed',
      existingAttendanceStatus: null,
      nowMs: NOW.getTime(),
    });
    assert.equal(ok.allowed, true);
    assert.equal(ok.code, 'valid');

    const badSig = validateQrCheckInAttempt({
      token: { ...validToken, signatureVerified: false },
      expectedEventId: 'evt-1',
      expectedSchoolId: 'oakridge-high',
      eventStatus: 'published',
      scannerAuthorized: true,
      attendeeRegistrationStatus: 'confirmed',
      existingAttendanceStatus: null,
      nowMs: NOW.getTime(),
    });
    assert.equal(badSig.code, 'invalid_signature');

    const expired = validateQrCheckInAttempt({
      token: { ...validToken, expiresAtMs: NOW.getTime() - 1000 },
      expectedEventId: 'evt-1',
      expectedSchoolId: 'oakridge-high',
      eventStatus: 'published',
      scannerAuthorized: true,
      attendeeRegistrationStatus: 'confirmed',
      existingAttendanceStatus: null,
      nowMs: NOW.getTime(),
    });
    assert.equal(expired.code, 'expired_token');

    const wrongEvent = validateQrCheckInAttempt({
      token: { ...validToken, eventId: 'evt-other' },
      expectedEventId: 'evt-1',
      expectedSchoolId: 'oakridge-high',
      eventStatus: 'published',
      scannerAuthorized: true,
      attendeeRegistrationStatus: 'confirmed',
      existingAttendanceStatus: null,
      nowMs: NOW.getTime(),
    });
    assert.equal(wrongEvent.code, 'wrong_event');

    const alreadyCheckedIn = validateQrCheckInAttempt({
      token: validToken,
      expectedEventId: 'evt-1',
      expectedSchoolId: 'oakridge-high',
      eventStatus: 'published',
      scannerAuthorized: true,
      attendeeRegistrationStatus: 'confirmed',
      existingAttendanceStatus: 'checked_in',
      nowMs: NOW.getTime(),
    });
    assert.equal(alreadyCheckedIn.code, 'already_checked_in');

    const duplicateScan = validateQrCheckInAttempt({
      token: validToken,
      expectedEventId: 'evt-1',
      expectedSchoolId: 'oakridge-high',
      eventStatus: 'published',
      scannerAuthorized: true,
      attendeeRegistrationStatus: 'confirmed',
      existingAttendanceStatus: null,
      seenTokenIds: new Set(['tok-abc']),
      nowMs: NOW.getTime(),
    });
    assert.equal(duplicateScan.code, 'duplicate_scan');

    const unauthScanner = validateQrCheckInAttempt({
      token: validToken,
      expectedEventId: 'evt-1',
      expectedSchoolId: 'oakridge-high',
      eventStatus: 'published',
      scannerAuthorized: false,
      attendeeRegistrationStatus: 'confirmed',
      existingAttendanceStatus: null,
      nowMs: NOW.getTime(),
    });
    assert.equal(unauthScanner.code, 'unauthorized_scanner');
  });

  it('validates event announcements, feedback eligibility, and anonymized feedback aggregation', () => {
    assert.equal(validateEventAnnouncementInput({ title: 'Hi', message: 'short' }).valid, false);
    assert.equal(
      validateEventAnnouncementInput({
        title: 'Room Changed to Auditorium B',
        message: 'Please bring your laptop charger and meet at Auditorium B by 3:25 PM.',
      }).valid,
      true
    );

    const endedEvt = makeEndedEvent();
    const upcomingEvt = makeEndedEvent({
      startAt: new Date('2026-05-25T14:00:00Z'),
      endAt: new Date('2026-05-25T16:00:00Z'),
    });
    const confirmedState = resolveStudentEventLifecycleState({ legacyIsGoing: true });
    const cancelledState = resolveStudentEventLifecycleState({
      legacyIsGoing: false,
      registration: {
        uid: 'u9',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        status: 'cancelled',
        registeredAt: NOW,
        updatedAt: NOW,
      },
    });

    // Cannot submit before event ends
    assert.equal(
      evaluatePostEventFeedbackEligibility({
        event: upcomingEvt,
        lifecycle: confirmedState,
        hasAlreadySubmitted: false,
        isVerifiedUser: true,
        isSuspendedMember: false,
        now: NOW,
      }).eligible,
      false
    );

    // Cancelled students cannot submit
    assert.equal(
      evaluatePostEventFeedbackEligibility({
        event: endedEvt,
        lifecycle: cancelledState,
        hasAlreadySubmitted: false,
        isVerifiedUser: true,
        isSuspendedMember: false,
        now: NOW,
      }).eligible,
      false
    );

    // Eligible after event ends, blocked on duplicate
    assert.equal(
      evaluatePostEventFeedbackEligibility({
        event: endedEvt,
        lifecycle: confirmedState,
        hasAlreadySubmitted: false,
        isVerifiedUser: true,
        isSuspendedMember: false,
        now: NOW,
      }).eligible,
      true
    );
    assert.equal(
      evaluatePostEventFeedbackEligibility({
        event: endedEvt,
        lifecycle: confirmedState,
        hasAlreadySubmitted: true,
        isVerifiedUser: true,
        isSuspendedMember: false,
        now: NOW,
      }).eligible,
      false
    );

    assert.equal(
      validatePostEventFeedbackInput({ overallRating: 6, organizationRating: 4 }).valid,
      false
    );

    const records: EventFeedbackRecord[] = [
      {
        id: 'student-a',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        submittedBy: 'student-a',
        overallRating: 5,
        organizationRating: 4,
        writtenFeedback: 'Loved the hands-on demo stations.',
        createdAt: new Date('2026-05-19T10:00:00Z'),
        updatedAt: new Date('2026-05-19T10:00:00Z'),
      },
      {
        id: 'student-b',
        eventId: 'evt-1',
        schoolId: 'oakridge-high',
        submittedBy: 'student-b',
        overallRating: 3,
        organizationRating: 4,
        improvementSuggestions: 'More power strips next time.',
        createdAt: new Date('2026-05-19T12:00:00Z'),
        updatedAt: new Date('2026-05-19T12:00:00Z'),
      },
    ];

    const summary = aggregateEventFeedbackSummary(records);
    assert.equal(summary.responseCount, 2);
    assert.equal(summary.averageOverallRating, 4);
    assert.equal(summary.averageOrganizationRating, 4);
    assert.equal(summary.ratingDistribution[5], 1);
    assert.equal(summary.ratingDistribution[3], 1);
    assert.equal(summary.comments.length, 2);
    // Verify student identity is strictly stripped from anonymized comments
    for (const comment of summary.comments) {
      assert.equal('submittedBy' in comment, false);
      assert.equal(comment.id.includes('student-a'), false);
      assert.equal(comment.id.includes('student-b'), false);
    }
  });
});
