export type RegistrationStatus =
  | 'confirmed'
  | 'pending_approval'
  | 'waitlisted'
  | 'cancelled';

export type EventRegistrationAvailability = 'open' | 'closed' | 'full' | 'cancelled';

export type AttendanceStatus = 'checked_in' | 'not_checked_in' | 'excused';

export type CheckInMethod = 'manual' | 'qr_token';

export type EventAnnouncementStatus = 'active' | 'archived';

export interface EventRegistrationRecord {
  uid: string;
  eventId: string;
  schoolId: string;
  status: RegistrationStatus;
  displayName?: string;
  registeredAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  waitlistTimestamp?: Date;
  promotedAt?: Date;
  offerExpiresAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface EventAttendanceRecord {
  uid: string;
  eventId: string;
  schoolId: string;
  status: AttendanceStatus;
  method: CheckInMethod;
  checkedInAt?: Date;
  checkedInBy: string;
  updatedAt: Date;
  correctionNote?: string;
}

export interface EventAnnouncementRecord {
  id: string;
  eventId: string;
  schoolId: string;
  title: string;
  message: string;
  status: EventAnnouncementStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventFeedbackRecord {
  id: string;
  eventId: string;
  schoolId: string;
  submittedBy: string;
  overallRating: number;
  organizationRating: number;
  writtenFeedback?: string;
  improvementSuggestions?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnonymizedEventFeedbackComment {
  id: string;
  overallRating: number;
  organizationRating: number;
  writtenFeedback?: string;
  improvementSuggestions?: string;
  createdAt: Date;
}

export interface EventFeedbackSummary {
  responseCount: number;
  averageOverallRating: number | null;
  averageOrganizationRating: number | null;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  comments: AnonymizedEventFeedbackComment[];
}

export interface AttendanceSummaryMetrics {
  confirmedCount: number;
  checkedInCount: number;
  notYetCheckedInCount: number;
  excusedCount: number;
  cancelledCount: number;
  waitlistCount: number;
  pendingApprovalCount: number;
  /** Defined strictly as checkedIn / confirmed (0..100), or null when confirmed == 0. */
  attendanceRatePercent: number | null;
}

export interface StudentEventLifecycleState {
  status:
    | 'not_registered'
    | 'confirmed'
    | 'pending_approval'
    | 'waitlisted'
    | 'cancelled'
    | 'attended';
  source: 'none' | 'legacy_rsvp' | 'registration' | 'attendance';
  registration?: EventRegistrationRecord | null;
  attendance?: EventAttendanceRecord | null;
  waitlistPosition?: number | null;
}

/**
 * Signed QR check-in token contract for future Blaze Cloud Functions integration.
 * Client code NEVER mints or signs proof-of-attendance tokens on Starter Tier.
 */
export interface QrCheckInTokenPayload {
  tokenId: string;
  eventId: string;
  attendeeUid: string;
  schoolId: string;
  issuedAtMs: number;
  expiresAtMs: number;
  signatureVerified: boolean;
  revoked?: boolean;
}

export type QrCheckInValidationCode =
  | 'valid'
  | 'unauthorized_scanner'
  | 'invalid_signature'
  | 'revoked_token'
  | 'expired_token'
  | 'wrong_event'
  | 'wrong_school'
  | 'not_registered'
  | 'already_checked_in'
  | 'event_cancelled'
  | 'duplicate_scan';

export interface QrCheckInValidationResult {
  allowed: boolean;
  code: QrCheckInValidationCode;
  message: string;
}
