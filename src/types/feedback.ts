export type FeedbackType = 'bug' | 'feature' | 'usability' | 'general';

export type FeedbackStatus = 'new' | 'reviewed' | 'resolved';

export type FeedbackRelatedFeature =
  | 'Event Discovery'
  | 'Club Directory'
  | 'RSVPs & My Events'
  | 'Notifications'
  | 'Organizer Studio'
  | 'Analytics'
  | 'Onboarding & Profile'
  | 'Other';

export const FEEDBACK_TYPES: { id: FeedbackType; label: string }[] = [
  { id: 'bug', label: 'Bug report' },
  { id: 'feature', label: 'Feature suggestion' },
  { id: 'usability', label: 'Usability feedback' },
  { id: 'general', label: 'General feedback' },
];

export const FEEDBACK_RELATED_FEATURES: FeedbackRelatedFeature[] = [
  'Event Discovery',
  'Club Directory',
  'RSVPs & My Events',
  'Notifications',
  'Organizer Studio',
  'Analytics',
  'Onboarding & Profile',
  'Other',
];

export interface FeedbackSubmission {
  id: string;
  schoolId: string;
  submittedBy: string;
  type: FeedbackType;
  relatedFeature: FeedbackRelatedFeature;
  description: string;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackFormInput {
  type: FeedbackType;
  relatedFeature: FeedbackRelatedFeature;
  description: string;
}
