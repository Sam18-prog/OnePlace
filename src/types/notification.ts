import type { EventCategory, SchoolEvent } from './event';

export type NotificationType =
  | 'event_update'
  | 'club_activity'
  | 'event_reminder'
  | 'announcement'
  | 'rsvp_update';

export type NotificationStatus = 'unread' | 'read';

export type NotificationEntityType = 'event' | 'club' | 'school';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface AppNotification {
  id: string;
  recipientUid: string;
  schoolId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: Date;
  readAt?: Date;
  entityType: NotificationEntityType;
  entityId: string;
  actionUrl?: string;
  status: NotificationStatus;
  dedupKey: string;
}

export interface NotificationPreferences {
  uid: string;
  schoolId: string;
  reminder24h: boolean;
  reminder1h: boolean;
  clubNewEvents: boolean;
  clubEventUpdates: boolean;
  schoolAnnouncements: boolean;
  importantNotices: boolean;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  interestCategories: EventCategory[];
  updatedAt?: Date;
}

export interface DeviceTokenRecord {
  tokenId: string;
  uid: string;
  schoolId: string;
  token: string;
  platform: 'web';
  enabled: boolean;
  permissionState: PushPermissionState;
  createdAt: Date;
  updatedAt: Date;
  lastRefreshedAt: Date;
}

export interface SchoolAnnouncement {
  id: string;
  schoolId: string;
  title: string;
  message: string;
  priority: 'normal' | 'important';
  createdBy: string;
  createdAt: Date;
}

export type NotificationJobType =
  | 'event_published'
  | 'event_updated'
  | 'event_cancelled'
  | 'club_announcement'
  | 'school_announcement'
  | 'reminder_24h'
  | 'reminder_1h';

export interface NotificationJob {
  jobId: string;
  schoolId: string;
  jobType: NotificationJobType;
  entityType: NotificationEntityType;
  entityId: string;
  dedupKey: string;
  status: 'processing' | 'completed' | 'failed';
  recipientCount?: number;
  pushSentCount?: number;
  attempts?: number;
  createdAt: Date;
  processedAt?: Date;
  lastError?: string;
}

export interface RecommendationReason {
  code: 'followed_club' | 'interest_match' | 'past_rsvp' | 'upcoming_campus';
  label: string;
}

export interface PersonalizedEventRecommendation {
  event: SchoolEvent;
  score: number;
  reason: RecommendationReason;
}
