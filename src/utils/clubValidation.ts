import type {
  Club,
  ClubCategory,
  ClubFormValues,
  ClubOrganizerEditValues,
  ClubSortMode,
  ClubStatus,
  ClubVisibility,
  NotificationTriggerPayload,
  NotificationTriggerType,
} from '../types/club';
import type { EventCategory, SchoolEvent } from '../types/event';
import type { SchoolMembership } from '../types/membership';
import { isPastEvent, isValidEventImageInput } from './eventValidation';

export const CLUB_NAME_MIN = 2;
export const CLUB_NAME_MAX = 80;
export const CLUB_SLUG_MIN = 2;
export const CLUB_SLUG_MAX = 80;
export const CLUB_SHORT_DESC_MAX = 180;
export const CLUB_DESC_MIN = 10;
export const CLUB_DESC_MAX = 1200;
export const CLUB_SCHEDULE_MAX = 120;
export const CLUB_LOCATION_MAX = 120;
export const CLUB_EMAIL_MAX = 160;
export const CLUB_ANNOUNCEMENT_MAX = 280;

export const ALL_CLUB_CATEGORIES: ClubCategory[] = [
  'Technology & Computing',
  'Robotics & Engineering',
  'Arts & Music',
  'Sports & Athletics',
  'Leadership & Student Government',
  'Academic & Research',
  'Culture & Community',
  'Entrepreneurship',
  'Social & Volunteering',
];

export function isValidClubCategory(value: unknown): value is ClubCategory {
  return typeof value === 'string' && ALL_CLUB_CATEGORIES.includes(value as ClubCategory);
}

export function mapEventCategoryToClubCategory(
  category: EventCategory,
  clubName: string = ''
): ClubCategory {
  const lower = clubName.toLowerCase();
  if (lower.includes('robot') || lower.includes('frc') || lower.includes('engineering')) {
    return 'Robotics & Engineering';
  }
  if (lower.includes('entrepreneur') || lower.includes('venture') || lower.includes('startup')) {
    return 'Entrepreneurship';
  }
  switch (category) {
    case 'STEM & Makers':
      return 'Technology & Computing';
    case 'Leadership':
      return 'Leadership & Student Government';
    case 'Athletics':
      return 'Sports & Athletics';
    case 'Academic':
      return 'Academic & Research';
    case 'Arts & Music':
      return 'Arts & Music';
    case 'Social & Community':
      return 'Social & Volunteering';
  }
}

export function mapClubCategoryToEventCategory(category: ClubCategory): EventCategory {
  switch (category) {
    case 'Technology & Computing':
    case 'Robotics & Engineering':
      return 'STEM & Makers';
    case 'Arts & Music':
      return 'Arts & Music';
    case 'Sports & Athletics':
      return 'Athletics';
    case 'Leadership & Student Government':
      return 'Leadership';
    case 'Academic & Research':
      return 'Academic';
    case 'Culture & Community':
    case 'Entrepreneurship':
    case 'Social & Volunteering':
      return 'Social & Community';
  }
}

export function slugifyClubName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CLUB_SLUG_MAX);
  return cleaned.length >= CLUB_SLUG_MIN ? cleaned : 'campus-club';
}

export function computeClubDiscoverKey(
  schoolId: string,
  status: ClubStatus,
  visibility: ClubVisibility
): string {
  if (status === 'suspended') {
    return `suspended:${schoolId}`;
  }
  return visibility === 'school' ? `school:${schoolId}` : `public:${schoolId}`;
}

export interface ClubFormErrors {
  name?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  category?: string;
  visibility?: string;
  coverImageUrl?: string;
  logoUrl?: string;
  meetingSchedule?: string;
  meetingLocation?: string;
  contactEmail?: string;
  announcement?: string;
}

export function validateClubForm(values: ClubFormValues): {
  valid: boolean;
  errors: ClubFormErrors;
} {
  const errors: ClubFormErrors = {};

  const name = values.name.trim();
  if (name.length < CLUB_NAME_MIN) {
    errors.name = `Club name must be at least ${CLUB_NAME_MIN} characters.`;
  } else if (name.length > CLUB_NAME_MAX) {
    errors.name = `Club name must be ${CLUB_NAME_MAX} characters or fewer.`;
  }

  const slug = values.slug.trim();
  if (!/^[a-z0-9-]+$/.test(slug) || slug.length < CLUB_SLUG_MIN || slug.length > CLUB_SLUG_MAX) {
    errors.slug = 'Slug must use lowercase letters, numbers, and hyphens (2–80 chars).';
  }

  if (values.shortDescription.trim().length > CLUB_SHORT_DESC_MAX) {
    errors.shortDescription = `Tagline must be ${CLUB_SHORT_DESC_MAX} characters or fewer.`;
  }

  const description = values.description.trim();
  if (description.length < CLUB_DESC_MIN) {
    errors.description = `Description must be at least ${CLUB_DESC_MIN} characters.`;
  } else if (description.length > CLUB_DESC_MAX) {
    errors.description = `Description must be ${CLUB_DESC_MAX} characters or fewer.`;
  }

  if (!isValidClubCategory(values.category)) {
    errors.category = 'Choose a valid club category.';
  }

  if (values.visibility !== 'public' && values.visibility !== 'school') {
    errors.visibility = 'Visibility must be Public or School-only.';
  }

  if (!isValidEventImageInput(values.coverImageUrl)) {
    errors.coverImageUrl = 'Enter a valid HTTPS image URL or leave blank.';
  }

  if (!isValidEventImageInput(values.logoUrl)) {
    errors.logoUrl = 'Enter a valid HTTPS logo URL or leave blank.';
  }

  if (values.meetingSchedule.trim().length > CLUB_SCHEDULE_MAX) {
    errors.meetingSchedule = `Meeting schedule must be ${CLUB_SCHEDULE_MAX} characters or fewer.`;
  }

  if (values.meetingLocation.trim().length > CLUB_LOCATION_MAX) {
    errors.meetingLocation = `Meeting location must be ${CLUB_LOCATION_MAX} characters or fewer.`;
  }

  const email = values.contactEmail.trim();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > CLUB_EMAIL_MAX)) {
    errors.contactEmail = 'Enter a valid email address or leave blank.';
  }

  if (values.announcement.trim().length > CLUB_ANNOUNCEMENT_MAX) {
    errors.announcement = `Announcement must be ${CLUB_ANNOUNCEMENT_MAX} characters or fewer.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateClubOrganizerEditForm(values: ClubOrganizerEditValues): {
  valid: boolean;
  errors: ClubFormErrors;
} {
  const errors: ClubFormErrors = {};

  if (values.shortDescription.trim().length > CLUB_SHORT_DESC_MAX) {
    errors.shortDescription = `Tagline must be ${CLUB_SHORT_DESC_MAX} characters or fewer.`;
  }

  const description = values.description.trim();
  if (description.length < CLUB_DESC_MIN) {
    errors.description = `Description must be at least ${CLUB_DESC_MIN} characters.`;
  } else if (description.length > CLUB_DESC_MAX) {
    errors.description = `Description must be ${CLUB_DESC_MAX} characters or fewer.`;
  }

  if (!isValidEventImageInput(values.coverImageUrl)) {
    errors.coverImageUrl = 'Enter a valid HTTPS image URL or leave blank.';
  }

  if (!isValidEventImageInput(values.logoUrl)) {
    errors.logoUrl = 'Enter a valid HTTPS logo URL or leave blank.';
  }

  if (values.meetingSchedule.trim().length > CLUB_SCHEDULE_MAX) {
    errors.meetingSchedule = `Meeting schedule must be ${CLUB_SCHEDULE_MAX} characters or fewer.`;
  }

  if (values.meetingLocation.trim().length > CLUB_LOCATION_MAX) {
    errors.meetingLocation = `Meeting location must be ${CLUB_LOCATION_MAX} characters or fewer.`;
  }

  const email = values.contactEmail.trim();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > CLUB_EMAIL_MAX)) {
    errors.contactEmail = 'Enter a valid email address or leave blank.';
  }

  if (values.announcement.trim().length > CLUB_ANNOUNCEMENT_MAX) {
    errors.announcement = `Announcement must be ${CLUB_ANNOUNCEMENT_MAX} characters or fewer.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function computeOptimisticFollow(
  isCurrentlyFollowing: boolean,
  currentFollowerCount: number
): { nextFollowing: boolean; nextCount: number } {
  if (isCurrentlyFollowing) {
    return {
      nextFollowing: false,
      nextCount: Math.max(0, currentFollowerCount - 1),
    };
  }
  return {
    nextFollowing: true,
    nextCount: Math.max(0, currentFollowerCount) + 1,
  };
}

export function canManageClub(
  club: Pick<Club, 'id' | 'schoolId' | 'status'>,
  membership: Pick<SchoolMembership, 'uid' | 'schoolId' | 'role' | 'status'> | null,
  managedClubIds: ReadonlySet<string> | readonly string[]
): boolean {
  if (!membership || membership.status !== 'active') return false;
  if (membership.schoolId !== club.schoolId) return false;
  if (membership.role === 'admin') return true;
  if (membership.role !== 'organizer') return false;
  if (club.status !== 'active') return false;
  const set = managedClubIds instanceof Set ? managedClubIds : new Set(managedClubIds);
  return set.has(club.id);
}

export function canCreateEventForClub(
  club: Pick<Club, 'id' | 'schoolId' | 'status'>,
  membership: Pick<SchoolMembership, 'uid' | 'schoolId' | 'role' | 'status'> | null,
  managedClubIds: ReadonlySet<string> | readonly string[]
): boolean {
  if (club.status !== 'active') return false;
  return canManageClub(club, membership, managedClubIds);
}

export function getAuthorizedClubsForEventForm(
  clubs: Club[],
  membership: Pick<SchoolMembership, 'uid' | 'schoolId' | 'role' | 'status'> | null,
  managedClubIds: ReadonlySet<string> | readonly string[]
): Club[] {
  if (!membership || membership.status !== 'active') return [];
  const activeSchoolClubs = clubs.filter(
    (c) => c.schoolId === membership.schoolId && c.status === 'active'
  );
  if (membership.role === 'admin') {
    return [...activeSchoolClubs].sort((a, b) => a.name.localeCompare(b.name));
  }
  const set = managedClubIds instanceof Set ? managedClubIds : new Set(managedClubIds);
  return activeSchoolClubs
    .filter((c) => set.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function countUpcomingClubEvents(
  events: SchoolEvent[],
  now: Date = new Date()
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const evt of events) {
    if (evt.status !== 'published') continue;
    if (isPastEvent(evt, now)) continue;
    counts[evt.clubId] = (counts[evt.clubId] || 0) + 1;
  }
  return counts;
}

export function getClubCategoryCounts(clubs: Club[]): Record<ClubCategory, number> {
  const counts = ALL_CLUB_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = 0;
      return acc;
    },
    {} as Record<ClubCategory, number>
  );
  for (const club of clubs) {
    if (club.status !== 'active') continue;
    counts[club.category] = (counts[club.category] || 0) + 1;
  }
  return counts;
}

export function filterAndSortClubs(
  clubs: Club[],
  options: {
    searchQuery?: string;
    categoryFilter?: ClubCategory | 'all';
    sortMode?: ClubSortMode;
    onlyWithUpcomingEvents?: boolean;
    upcomingCountsByClub?: Record<string, number>;
    includeSuspended?: boolean;
  }
): Club[] {
  const q = (options.searchQuery || '').trim().toLowerCase();
  const cat = options.categoryFilter ?? 'all';
  const sortMode = options.sortMode ?? 'popular';
  const upcomingCounts = options.upcomingCountsByClub ?? {};

  const filtered = clubs.filter((club) => {
    if (!options.includeSuspended && club.status !== 'active') return false;
    if (cat !== 'all' && club.category !== cat) return false;
    if (options.onlyWithUpcomingEvents && (upcomingCounts[club.id] || 0) === 0) return false;
    if (!q) return true;
    return (
      club.name.toLowerCase().includes(q) ||
      club.description.toLowerCase().includes(q) ||
      (club.shortDescription || '').toLowerCase().includes(q) ||
      club.category.toLowerCase().includes(q) ||
      (club.meetingLocation || '').toLowerCase().includes(q)
    );
  });

  return filtered.sort((a, b) => {
    if (sortMode === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }
    if (sortMode === 'recently-active') {
      const diff = b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
      if (diff !== 0) return diff;
      return b.followerCount - a.followerCount;
    }
    // 'popular': prioritize followerCount + upcoming events, then alphabetical
    const scoreA = a.followerCount * 2 + (upcomingCounts[a.id] || 0) * 3;
    const scoreB = b.followerCount * 2 + (upcomingCounts[b.id] || 0) * 3;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.name.localeCompare(b.name);
  });
}

export interface SuggestedClubRecommendation {
  club: Club;
  reason: string;
  upcomingCount: number;
}

/**
 * Lightweight, explainable campus club recommendation engine.
 * Uses only real user followed categories, RSVPed event categories, and upcoming event counts.
 */
export function getSuggestedClubs(
  clubs: Club[],
  followedClubIds: ReadonlySet<string>,
  events: SchoolEvent[],
  userRsvpsById: Record<string, boolean>,
  maxResults: number = 4,
  now: Date = new Date()
): SuggestedClubRecommendation[] {
  const upcomingCounts = countUpcomingClubEvents(events, now);
  const preferredCategories = new Set<ClubCategory>();

  for (const club of clubs) {
    if (followedClubIds.has(club.id)) {
      preferredCategories.add(club.category);
    }
  }

  for (const evt of events) {
    if (userRsvpsById[evt.id]) {
      preferredCategories.add(mapEventCategoryToClubCategory(evt.category, evt.hostClub));
    }
  }

  const candidates = clubs.filter((club) => club.status === 'active' && !followedClubIds.has(club.id));

  const scored = candidates.map((club) => {
    const upcomingCount = upcomingCounts[club.id] || 0;
    const categoryMatch = preferredCategories.has(club.category);

    let score = 0;
    if (categoryMatch) score += 10;
    if (upcomingCount > 0) score += 5 + Math.min(upcomingCount, 3);
    if (club.followerCount > 0) score += Math.min(club.followerCount, 5) * 0.2;

    let reason = 'Active campus organization';
    if (categoryMatch && upcomingCount > 0) {
      reason = `Matches your ${club.category} interest · ${upcomingCount} upcoming`;
    } else if (categoryMatch) {
      reason = `Matches your ${club.category} interest`;
    } else if (upcomingCount > 0) {
      reason = `${upcomingCount} upcoming ${upcomingCount === 1 ? 'event' : 'events'} on campus`;
    } else if (club.isOfficial) {
      reason = 'Official campus organization';
    }

    return { club, score, reason, upcomingCount };
  });

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.club.followerCount - a.club.followerCount;
    })
    .slice(0, maxResults)
    .map(({ club, reason, upcomingCount }) => ({ club, reason, upcomingCount }));
}

export function buildClubNotificationPayload(params: {
  eventType: NotificationTriggerType;
  schoolId: string;
  clubId: string;
  clubName: string;
  eventId?: string;
  title: string;
  summary: string;
  actorUid: string;
  now?: Date;
}): NotificationTriggerPayload {
  return {
    eventType: params.eventType,
    schoolId: params.schoolId,
    clubId: params.clubId,
    clubName: params.clubName,
    ...(params.eventId ? { eventId: params.eventId } : {}),
    title: params.title.trim(),
    summary: params.summary.trim(),
    actorUid: params.actorUid,
    createdAtIso: (params.now ?? new Date()).toISOString(),
    targetAudience: 'club_followers',
  };
}
