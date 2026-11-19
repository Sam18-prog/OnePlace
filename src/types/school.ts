export type SchoolStatus = 'active' | 'pending_setup' | 'suspended';

export type PilotStage =
  | 'internal_validation'
  | 'student_trial'
  | 'club_expansion'
  | 'school_wide';

export interface SchoolOnboardingChecklist {
  profileReviewed: boolean;
  visibilityVerified: boolean;
  permissionsReviewed: boolean;
  privacyReviewed: boolean;
  notificationsReviewed: boolean;
  launchConfirmed: boolean;
}

export const DEFAULT_SCHOOL_ONBOARDING_CHECKLIST: SchoolOnboardingChecklist = {
  profileReviewed: false,
  visibilityVerified: false,
  permissionsReviewed: false,
  privacyReviewed: false,
  notificationsReviewed: false,
  launchConfirmed: false,
};

export interface UserOnboardingProgress {
  uid: string;
  schoolId: string;
  studentCompleted: boolean;
  studentDismissed: boolean;
  organizerDismissed: boolean;
  clubProfileReviewed: boolean;
  eventManagementReviewed: boolean;
  updatedAt?: Date;
}

export const DEFAULT_USER_ONBOARDING_PROGRESS = (
  uid: string,
  schoolId: string
): UserOnboardingProgress => ({
  uid,
  schoolId,
  studentCompleted: false,
  studentDismissed: false,
  organizerDismissed: false,
  clubProfileReviewed: false,
  eventManagementReviewed: false,
});
