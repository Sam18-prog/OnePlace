import type { Club, ClubCategory } from './club';
import type { EventCategory, EventStatus, SchoolEvent } from './event';

export type AnalyticsDatePreset =
  | '7d'
  | '30d'
  | '90d'
  | 'semester'
  | 'year'
  | 'custom'
  | 'all';

export type AnalyticsDateAxis = 'startAt' | 'createdAt';

export type EventAnalyticsFilterStatus =
  | 'all'
  | 'published'
  | 'upcoming'
  | 'past'
  | 'draft'
  | 'cancelled';

export type EventAnalyticsSortKey =
  | 'rsvpCount'
  | 'startAt'
  | 'createdAt'
  | 'title'
  | 'hostClub'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface DateRangeBounds {
  preset: AnalyticsDatePreset;
  label: string;
  start: Date | null;
  end: Date | null;
  isValidCustomRange: boolean;
}

export interface MostActiveClubMetric {
  clubId: string;
  clubName: string;
  publishedCount: number;
  totalRsvps: number;
}

export interface OrganizerKpis {
  totalCreated: number;
  published: number;
  draft: number;
  cancelled: number;
  upcoming: number;
  totalCurrentRsvps: number;
  avgRsvpsPerPublished: number;
  mostActiveClub: MostActiveClubMetric | null;
}

export interface EventPerformanceRow {
  event: SchoolEvent;
  isUpcoming: boolean;
  isPast: boolean;
  /** Ratio of event RSVPs to average RSVPs per published event (1.0 = average). Null for draft/cancelled or 0-avg baseline. */
  relativeToPublishedAvg: number | null;
  /** Percentage delta vs average published event RSVPs (e.g. +40 or -25). Null when baseline avg is 0 or event is not published. */
  deltaPctFromAvg: number | null;
  relativeLabel: string;
  rsvpSharePct: number;
}

export interface EventPerformanceSummary {
  totalRsvps: number;
  avgRsvpsAcrossPublished: number;
  highestRsvpEvent: { id: string; title: string; hostClub: string; rsvpCount: number } | null;
  lowestRsvpEvent: { id: string; title: string; hostClub: string; rsvpCount: number } | null;
}

export interface CategoryBreakdownItem {
  category: EventCategory;
  eventCount: number;
  publishedCount: number;
  totalRsvps: number;
  sharePct: number;
}

export interface RsvpDistributionBucket {
  id: string;
  label: string;
  eventCount: number;
  rsvpSum: number;
}

export interface ClubEngagementRow {
  club: Club;
  publishedCount: number;
  upcomingCount: number;
  draftCount: number;
  cancelledCount: number;
  totalEventsCount: number;
  totalRsvps: number;
  avgRsvpsPerPublished: number;
  mostPopularEvent: {
    id: string;
    title: string;
    rsvpCount: number;
  } | null;
  followerCount: number;
}

export interface ClubCategoryDistributionItem {
  category: ClubCategory;
  clubCount: number;
  activeCount: number;
  totalFollowers: number;
}

export interface MonthlyActivityPoint {
  monthKey: string; // YYYY-MM in school timezone
  label: string; // e.g. "Nov 2026"
  eventCount: number;
  publishedCount: number;
  rsvpTotal: number;
}

export interface SchoolAdminAnalytics {
  schoolId: string;
  totalClubs: number;
  activeClubs: number;
  suspendedClubs: number;
  kpis: OrganizerKpis;
  mostActiveClubsByPublished: ClubEngagementRow[];
  mostEngagedClubsByRsvps: ClubEngagementRow[];
  clubCategoryDistribution: ClubCategoryDistributionItem[];
  upcomingEventsByClub: ClubEngagementRow[];
  statusCounts: Record<EventStatus, number>;
  categoryBreakdown: CategoryBreakdownItem[];
  monthlyActivity: MonthlyActivityPoint[];
  topEvents: SchoolEvent[];
}

export interface TrackedEngagementCapabilities {
  eventDetailViews: false;
  eventSaves: false;
  rsvpEventHistory: false;
  rsvpCancellationHistory: false;
  publicationHistoryLog: false;
  physicalCheckInAttendance: false;
}

export interface AnalyticsLimitationItem {
  id: string;
  metric: string;
  whyUnavailable: string;
  requiredInfrastructure: string;
}

/**
 * Future-compatible backend aggregation document contract (Blaze + Cloud Functions + Admin SDK).
 * Intended paths:
 * - schools/{schoolId}/analytics/{periodId}
 * - clubs/{clubId}/analytics/{periodId}
 * - events/{eventId}/analytics/{periodId}
 */
export interface FutureAnalyticsAggregateContract {
  schemaVersion: 1;
  scopeType: 'school' | 'club' | 'event';
  scopeId: string;
  schoolId: string;
  periodId: string; // e.g. "2026-11" or "2026-11-18"
  granularity: 'daily' | 'monthly' | 'semester';
  eventsCreatedCount: number;
  eventsPublishedCount: number;
  rsvpsCreatedCount: number;
  rsvpsCancelledCount: number;
  uniqueViewCount?: number;
  saveCount?: number;
  followerDelta?: number;
  computedAtIso: string;
  source: 'cloud_function_aggregator';
}
