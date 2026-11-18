import type { ClubCategory } from '../types/club';
import type { EventCategory, SchoolEvent } from '../types/event';
import type {
  PersonalizedEventRecommendation,
  RecommendationReason,
} from '../types/notification';
import { getTimeframeBucket, sortEventsAscending } from './events';

export interface PersonalizationContext {
  now?: Date;
  isSchoolMember: boolean;
  followedClubIds: ReadonlySet<string>;
  followedClubCategories?: ReadonlySet<EventCategory>;
  interestCategories: readonly EventCategory[];
  rsvpedEventIds: ReadonlySet<string>;
  pastAttendedClubIds?: ReadonlySet<string>;
  pastAttendedCategories?: ReadonlySet<EventCategory>;
}

export function mapClubCategoryToEventCategory(clubCategory: ClubCategory): EventCategory {
  switch (clubCategory) {
    case 'Technology & Computing':
    case 'Robotics & Engineering':
      return 'STEM & Makers';
    case 'Arts & Music':
      return 'Arts & Music';
    case 'Sports & Athletics':
      return 'Athletics';
    case 'Leadership & Student Government':
    case 'Entrepreneurship':
      return 'Leadership';
    case 'Academic & Research':
      return 'Academic';
    case 'Culture & Community':
    case 'Social & Volunteering':
    default:
      return 'Social & Community';
  }
}

export function isEventEligibleForDiscovery(
  event: SchoolEvent,
  now: Date,
  isSchoolMember: boolean
): boolean {
  if (event.status !== 'published') return false;
  if (event.visibility === 'school' && !isSchoolMember) return false;
  const endMs = event.endAt ? event.endAt.getTime() : event.startAt.getTime() + 60 * 60 * 1000;
  return endMs > now.getTime();
}

export function scoreEventForStudent(
  event: SchoolEvent,
  ctx: PersonalizationContext
): PersonalizedEventRecommendation {
  const now = ctx.now ?? new Date();
  let score = 0;
  let primaryReason: RecommendationReason | null = null;

  const isFollowedClub = ctx.followedClubIds.has(event.clubId);
  if (isFollowedClub) {
    score += 55;
    primaryReason = {
      code: 'followed_club',
      label: `Because you follow ${event.hostClub}`,
    };
  }

  const matchesExplicitInterest = ctx.interestCategories.includes(event.category);
  if (matchesExplicitInterest) {
    score += 38;
    if (!primaryReason) {
      primaryReason = {
        code: 'interest_match',
        label: `Based on your interest in ${event.category}`,
      };
    }
  } else if (ctx.followedClubCategories?.has(event.category)) {
    score += 18;
  }

  const matchesPastClub = ctx.pastAttendedClubIds?.has(event.clubId) ?? false;
  const matchesPastCategory = ctx.pastAttendedCategories?.has(event.category) ?? false;
  if (matchesPastClub || matchesPastCategory) {
    score += matchesPastClub ? 28 : 20;
    if (!primaryReason) {
      primaryReason = {
        code: 'past_rsvp',
        label: `Similar to events you've attended`,
      };
    }
  }

  // Modest upcoming timing relevance boost (soonest 7 days prioritized cleanly)
  const hoursUntilStart = (event.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilStart >= 0 && hoursUntilStart <= 48) {
    score += 12;
  } else if (hoursUntilStart > 48 && hoursUntilStart <= 24 * 7) {
    score += 6;
  }

  // Light popularity signal capped so niche club events still surface
  score += Math.min(event.rsvpCount, 40) * 0.25;

  if (!primaryReason) {
    primaryReason = {
      code: 'upcoming_campus',
      label: hoursUntilStart <= 24 * 7 ? 'Happening on campus this week' : 'Upcoming campus pick',
    };
  }

  return {
    event,
    score: Math.round(score * 10) / 10,
    reason: primaryReason,
  };
}

export function getPersonalizedRecommendations(
  events: SchoolEvent[],
  ctx: PersonalizationContext,
  limitCount: number = 4
): PersonalizedEventRecommendation[] {
  const now = ctx.now ?? new Date();
  const scored: PersonalizedEventRecommendation[] = [];

  for (const event of events) {
    if (!isEventEligibleForDiscovery(event, now, ctx.isSchoolMember)) continue;
    if (ctx.rsvpedEventIds.has(event.id)) continue;
    scored.push(scoreEventForStudent(event, ctx));
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.event.startAt.getTime() - b.event.startAt.getTime();
  });

  return scored.slice(0, Math.max(0, limitCount));
}

export function getFollowedClubUpcomingEvents(
  events: SchoolEvent[],
  followedClubIds: ReadonlySet<string>,
  now: Date,
  isSchoolMember: boolean,
  limitCount: number = 6
): SchoolEvent[] {
  if (followedClubIds.size === 0) return [];
  return sortEventsAscending(
    events.filter(
      (evt) =>
        followedClubIds.has(evt.clubId) && isEventEligibleForDiscovery(evt, now, isSchoolMember)
    )
  ).slice(0, limitCount);
}

export function getHappeningThisWeekEvents(
  events: SchoolEvent[],
  now: Date,
  isSchoolMember: boolean
): SchoolEvent[] {
  return sortEventsAscending(
    events.filter((evt) => {
      if (!isEventEligibleForDiscovery(evt, now, isSchoolMember)) return false;
      const bucket = getTimeframeBucket(evt.startAt, now);
      return bucket === 'today' || bucket === 'this-week';
    })
  );
}

export function getRecentlyAddedEvents(
  events: SchoolEvent[],
  now: Date,
  isSchoolMember: boolean,
  limitCount: number = 4
): SchoolEvent[] {
  return events
    .filter((evt) => isEventEligibleForDiscovery(evt, now, isSchoolMember))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limitCount);
}

export function getTimeOfDayGreeting(
  now: Date = new Date(),
  displayName?: string | null
): string {
  const hour = now.getHours();
  const base =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = displayName?.trim().split(/\s+/)[0];
  return firstName ? `${base}, ${firstName}` : `${base}`;
}
