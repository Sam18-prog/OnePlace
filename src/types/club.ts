export type ClubCategory =
  | 'Technology & Computing'
  | 'Robotics & Engineering'
  | 'Arts & Music'
  | 'Sports & Athletics'
  | 'Leadership & Student Government'
  | 'Academic & Research'
  | 'Culture & Community'
  | 'Entrepreneurship'
  | 'Social & Volunteering';

export type ClubStatus = 'active' | 'suspended';

export type ClubVisibility = 'public' | 'school';

export type ClubMemberRole = 'organizer' | 'lead';

export type ClubMemberStatus = 'active' | 'revoked';

export interface ClubPublicOrganizer {
  uid: string;
  displayName: string;
  roleTitle: string;
}

export interface Club {
  id: string;
  schoolId: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  category: ClubCategory;
  visibility: ClubVisibility;
  status: ClubStatus;
  isOfficial: boolean;
  discoverKey: string;
  coverImageUrl?: string;
  logoUrl?: string;
  meetingSchedule?: string;
  meetingLocation?: string;
  contactEmail?: string;
  publicOrganizers?: ClubPublicOrganizer[];
  announcement?: string;
  followerCount: number;
  isDemoSeed?: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface ClubMember {
  uid: string;
  schoolId: string;
  clubId: string;
  role: ClubMemberRole;
  roleTitle?: string;
  displayName?: string;
  status: ClubMemberStatus;
  assignedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedClubAssignment {
  uid: string;
  schoolId: string;
  clubId: string;
  clubName?: string;
  role: ClubMemberRole;
  roleTitle?: string;
  status: ClubMemberStatus;
  assignedBy?: string;
  updatedAt: Date;
}

export interface UserFollowedClub {
  clubId: string;
  schoolId: string;
  clubName: string;
  clubCategory: ClubCategory;
  notificationsEnabled: boolean;
  followedAt: Date;
}

export interface ClubFormValues {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  category: ClubCategory;
  visibility: ClubVisibility;
  isOfficial: boolean;
  coverImageUrl: string;
  logoUrl: string;
  meetingSchedule: string;
  meetingLocation: string;
  contactEmail: string;
  announcement: string;
}

export interface ClubOrganizerEditValues {
  shortDescription: string;
  description: string;
  coverImageUrl: string;
  logoUrl: string;
  meetingSchedule: string;
  meetingLocation: string;
  contactEmail: string;
  announcement: string;
}

export type ClubSortMode = 'popular' | 'recently-active' | 'alphabetical';

/**
 * Notification-ready trigger schema contracts designed for future Cloud Functions / push delivery.
 */
export type NotificationTriggerType =
  | 'club_event_published'
  | 'club_event_updated'
  | 'club_event_cancelled'
  | 'club_announcement';

export interface NotificationTriggerPayload {
  eventType: NotificationTriggerType;
  schoolId: string;
  clubId: string;
  clubName: string;
  eventId?: string;
  title: string;
  summary: string;
  actorUid: string;
  createdAtIso: string;
  targetAudience: 'club_followers';
}
