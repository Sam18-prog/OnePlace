import type {
  AnalyticsDateAxis,
  AnalyticsDatePreset,
  AnalyticsLimitationItem,
  CategoryBreakdownItem,
  ClubCategoryDistributionItem,
  ClubEngagementRow,
  DateRangeBounds,
  EventAnalyticsFilterStatus,
  EventAnalyticsSortKey,
  EventPerformanceRow,
  EventPerformanceSummary,
  MonthlyActivityPoint,
  OrganizerKpis,
  RsvpDistributionBucket,
  SchoolAdminAnalytics,
  SortDirection,
  TrackedEngagementCapabilities,
} from '../types/analytics';
import type { Club } from '../types/club';
import type { EventStatus, SchoolEvent } from '../types/event';
import type { SchoolMembership } from '../types/membership';
import { ALL_CLUB_CATEGORIES } from './clubValidation';
import {
  ALL_EVENT_CATEGORIES,
  formatDateInTimezone,
  isPastEvent,
  parseSchoolDateTime,
} from './eventValidation';

export const ANALYTICS_TRACKED_CAPABILITIES: TrackedEngagementCapabilities = {
  eventDetailViews: false,
  eventSaves: false,
  rsvpEventHistory: false,
  rsvpCancellationHistory: false,
  publicationHistoryLog: false,
  physicalCheckInAttendance: false,
};

export const ANALYTICS_DATA_LIMITATIONS: AnalyticsLimitationItem[] = [
  {
    id: 'rsvp-vs-attendance',
    metric: 'Actual Event Attendance (Check-in)',
    whyUnavailable:
      'Current RSVPs measure stated student intent to attend. OnePlace does not collect QR/manual check-in records.',
    requiredInfrastructure:
      'Check-in scanner workflow and server-validated attendee checkInAt timestamps.',
  },
  {
    id: 'historical-rsvp-series',
    metric: 'Daily / Weekly RSVP Growth Curves',
    whyUnavailable:
      'events/{eventId}.rsvpCount stores cumulative current count only; attendees/{uid} timestamps cannot be listed without exposing student identities.',
    requiredInfrastructure:
      'Cloud Functions triggers aggregating anonymized daily deltas into schools/{schoolId}/analytics/{periodId}.',
  },
  {
    id: 'views-and-saves',
    metric: 'Event Detail Views & Bookmarks / Saves',
    whyUnavailable:
      'Client-side telemetry writes are disabled to prevent arbitrary counter spoofing on Starter Tier.',
    requiredInfrastructure:
      'Trusted server endpoint (/api/analytics/view) with deduplicated counters or Firebase Analytics integration.',
  },
  {
    id: 'follower-growth',
    metric: 'Historical Club Follower Growth',
    whyUnavailable:
      'clubs/{clubId}.followerCount stores cumulative followers only, without daily snapshot logs.',
    requiredInfrastructure:
      'Cloud Scheduler snapshot job recording daily followerCount into clubs/{clubId}/analytics/{periodId}.',
  },
];

/**
 * Enforces strict analytics authorization scope for Clubs.
 * - Students, signed-out users, or suspended accounts receive [].
 * - Admins see all clubs belonging strictly to their schoolId.
 * - Organizers see only clubs belonging to their schoolId explicitly assigned in managedClubIds.
 */
export function filterAuthorizedClubsForAnalytics(
  clubs: Club[],
  membership: Pick<SchoolMembership, 'uid' | 'schoolId' | 'role' | 'status'> | null,
  managedClubIds: ReadonlySet<string> | readonly string[]
): Club[] {
  if (!membership || membership.status !== 'active') return [];
  if (membership.role === 'student') return [];

  if (membership.role === 'admin') {
    return clubs.filter((club) => club.schoolId === membership.schoolId);
  }

  const allowedSet = managedClubIds instanceof Set ? managedClubIds : new Set(managedClubIds);
  return clubs.filter(
    (club) => club.schoolId === membership.schoolId && allowedSet.has(club.id)
  );
}

/**
 * Enforces strict analytics authorization scope for Events.
 * - Students, signed-out users, or suspended accounts receive [].
 * - Admins see all events belonging strictly to their schoolId.
 * - Organizers see events in their schoolId that they created OR that belong to their explicitly assigned clubs.
 */
export function filterAuthorizedEventsForAnalytics(
  events: SchoolEvent[],
  membership: Pick<SchoolMembership, 'uid' | 'schoolId' | 'role' | 'status'> | null,
  managedClubIds: ReadonlySet<string> | readonly string[]
): SchoolEvent[] {
  if (!membership || membership.status !== 'active') return [];
  if (membership.role === 'student') return [];

  if (membership.role === 'admin') {
    return events.filter((evt) => evt.schoolId === membership.schoolId);
  }

  const allowedSet = managedClubIds instanceof Set ? managedClubIds : new Set(managedClubIds);
  return events.filter(
    (evt) =>
      evt.schoolId === membership.schoolId &&
      (evt.createdBy === membership.uid || allowedSet.has(evt.clubId))
  );
}

/**
 * Deduplicates merged event lists (e.g. organizer's own drafts + assigned club published events) by ID.
 */
export function mergeDeduplicatedEvents(
  primary: SchoolEvent[],
  secondary: SchoolEvent[]
): SchoolEvent[] {
  const byId = new Map<string, SchoolEvent>();
  for (const evt of secondary) {
    byId.set(evt.id, evt);
  }
  for (const evt of primary) {
    byId.set(evt.id, evt);
  }
  return Array.from(byId.values());
}

function shiftCalendarDate(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function startOfDayInZone(ymd: string, timeZone: string): Date | null {
  return parseSchoolDateTime(ymd, '00:00', timeZone);
}

function endOfDayInZone(ymd: string, timeZone: string): Date | null {
  const nextDay = shiftCalendarDate(ymd, 1);
  const nextStart = parseSchoolDateTime(nextDay, '00:00', timeZone);
  if (!nextStart) return null;
  return new Date(nextStart.getTime() - 1);
}

export function resolveDateRangeBounds(
  preset: AnalyticsDatePreset,
  timeZone: string,
  now: Date = new Date(),
  customStartYmd?: string,
  customEndYmd?: string
): DateRangeBounds {
  if (preset === 'all') {
    return {
      preset,
      label: 'All Time',
      start: null,
      end: null,
      isValidCustomRange: true,
    };
  }

  const todayYmd = formatDateInTimezone(now, timeZone).date;
  const [yearStr, monthStr] = todayYmd.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (preset === '7d' || preset === '30d' || preset === '90d') {
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    const startYmd = shiftCalendarDate(todayYmd, -(days - 1));
    return {
      preset,
      label: `Last ${days} Days`,
      start: startOfDayInZone(startYmd, timeZone),
      end: endOfDayInZone(todayYmd, timeZone),
      isValidCustomRange: true,
    };
  }

  if (preset === 'semester') {
    const isSpring = month <= 6;
    const startYmd = isSpring ? `${year}-01-01` : `${year}-07-01`;
    const endYmd = isSpring ? `${year}-06-30` : `${year}-12-31`;
    return {
      preset,
      label: isSpring ? `Spring ${year}` : `Fall ${year}`,
      start: startOfDayInZone(startYmd, timeZone),
      end: endOfDayInZone(endYmd, timeZone),
      isValidCustomRange: true,
    };
  }

  if (preset === 'year') {
    return {
      preset,
      label: `${year}`,
      start: startOfDayInZone(`${year}-01-01`, timeZone),
      end: endOfDayInZone(`${year}-12-31`, timeZone),
      isValidCustomRange: true,
    };
  }

  // custom range
  const start = customStartYmd ? startOfDayInZone(customStartYmd, timeZone) : null;
  const end = customEndYmd ? endOfDayInZone(customEndYmd, timeZone) : null;
  const isValid =
    Boolean(start && end) && (start as Date).getTime() <= (end as Date).getTime();

  return {
    preset: 'custom',
    label:
      isValid && customStartYmd && customEndYmd
        ? `${customStartYmd} to ${customEndYmd}`
        : 'Custom Range',
    start: isValid ? start : null,
    end: isValid ? end : null,
    isValidCustomRange: isValid,
  };
}

export function filterEventsByDateRange(
  events: SchoolEvent[],
  bounds: DateRangeBounds,
  axis: AnalyticsDateAxis = 'startAt'
): SchoolEvent[] {
  if (!bounds.start && !bounds.end) return events;
  const startMs = bounds.start ? bounds.start.getTime() : -Infinity;
  const endMs = bounds.end ? bounds.end.getTime() : Infinity;

  return events.filter((evt) => {
    const target = axis === 'createdAt' ? evt.createdAt : evt.startAt;
    const ms = target.getTime();
    return ms >= startMs && ms <= endMs;
  });
}

export function computeOrganizerKpis(
  events: SchoolEvent[],
  now: Date = new Date()
): OrganizerKpis {
  let published = 0;
  let draft = 0;
  let cancelled = 0;
  let upcoming = 0;
  let totalCurrentRsvps = 0;
  let publishedRsvpSum = 0;

  const clubMap = new Map<
    string,
    { clubId: string; clubName: string; publishedCount: number; totalRsvps: number }
  >();

  for (const evt of events) {
    totalCurrentRsvps += Math.max(0, evt.rsvpCount);

    if (evt.status === 'published') {
      published += 1;
      publishedRsvpSum += Math.max(0, evt.rsvpCount);
      if (!isPastEvent(evt, now)) {
        upcoming += 1;
      }

      const existing = clubMap.get(evt.clubId) ?? {
        clubId: evt.clubId,
        clubName: evt.hostClub,
        publishedCount: 0,
        totalRsvps: 0,
      };
      existing.publishedCount += 1;
      existing.totalRsvps += Math.max(0, evt.rsvpCount);
      clubMap.set(evt.clubId, existing);
    } else if (evt.status === 'draft') {
      draft += 1;
    } else if (evt.status === 'cancelled') {
      cancelled += 1;
    }
  }

  const avgRsvpsPerPublished =
    published > 0 ? Number((publishedRsvpSum / published).toFixed(1)) : 0;

  const clubsRanked = Array.from(clubMap.values()).sort((a, b) => {
    if (b.publishedCount !== a.publishedCount) return b.publishedCount - a.publishedCount;
    if (b.totalRsvps !== a.totalRsvps) return b.totalRsvps - a.totalRsvps;
    return a.clubName.localeCompare(b.clubName);
  });

  return {
    totalCreated: events.length,
    published,
    draft,
    cancelled,
    upcoming,
    totalCurrentRsvps,
    avgRsvpsPerPublished,
    mostActiveClub: clubsRanked[0] ?? null,
  };
}

export function computeEventPerformanceRows(
  events: SchoolEvent[],
  now: Date = new Date(),
  options: {
    statusFilter?: EventAnalyticsFilterStatus;
    categoryFilter?: string;
    searchQuery?: string;
    sortKey?: EventAnalyticsSortKey;
    sortDir?: SortDirection;
  } = {}
): EventPerformanceRow[] {
  const publishedEvents = events.filter((e) => e.status === 'published');
  const publishedRsvpSum = publishedEvents.reduce((acc, e) => acc + Math.max(0, e.rsvpCount), 0);
  const avgPublishedRsvps =
    publishedEvents.length > 0 ? publishedRsvpSum / publishedEvents.length : 0;
  const totalAllRsvps = events.reduce((acc, e) => acc + Math.max(0, e.rsvpCount), 0);

  const statusFilter = options.statusFilter ?? 'all';
  const categoryFilter = options.categoryFilter ?? 'all';
  const q = (options.searchQuery ?? '').trim().toLowerCase();

  const rows: EventPerformanceRow[] = [];

  for (const evt of events) {
    const past = isPastEvent(evt, now);
    const upcoming = evt.status === 'published' && !past;

    if (statusFilter === 'published' && evt.status !== 'published') continue;
    if (statusFilter === 'upcoming' && !upcoming) continue;
    if (statusFilter === 'past' && !past) continue;
    if (statusFilter === 'draft' && evt.status !== 'draft') continue;
    if (statusFilter === 'cancelled' && evt.status !== 'cancelled') continue;
    if (categoryFilter !== 'all' && evt.category !== categoryFilter) continue;

    if (
      q &&
      !evt.title.toLowerCase().includes(q) &&
      !evt.hostClub.toLowerCase().includes(q) &&
      !evt.location.toLowerCase().includes(q)
    ) {
      continue;
    }

    let relativeToPublishedAvg: number | null = null;
    let deltaPctFromAvg: number | null = null;
    let relativeLabel = 'Not published';

    if (evt.status === 'published') {
      if (avgPublishedRsvps > 0) {
        relativeToPublishedAvg = Number((evt.rsvpCount / avgPublishedRsvps).toFixed(2));
        deltaPctFromAvg = Math.round(((evt.rsvpCount - avgPublishedRsvps) / avgPublishedRsvps) * 100);
        if (deltaPctFromAvg > 0) {
          relativeLabel = `+${deltaPctFromAvg}% vs avg`;
        } else if (deltaPctFromAvg < 0) {
          relativeLabel = `${deltaPctFromAvg}% vs avg`;
        } else {
          relativeLabel = 'At published avg';
        }
      } else {
        relativeLabel = 'Baseline 0 RSVPs';
      }
    } else if (evt.status === 'cancelled') {
      relativeLabel = 'Cancelled';
    } else {
      relativeLabel = 'Draft';
    }

    const rsvpSharePct =
      totalAllRsvps > 0 ? Math.round((Math.max(0, evt.rsvpCount) / totalAllRsvps) * 100) : 0;

    rows.push({
      event: evt,
      isUpcoming: upcoming,
      isPast: past,
      relativeToPublishedAvg,
      deltaPctFromAvg,
      relativeLabel,
      rsvpSharePct,
    });
  }

  const sortKey = options.sortKey ?? 'rsvpCount';
  const sortDir = options.sortDir ?? 'desc';
  const factor = sortDir === 'asc' ? 1 : -1;

  return rows.sort((a, b) => {
    switch (sortKey) {
      case 'rsvpCount':
        if (a.event.rsvpCount !== b.event.rsvpCount) {
          return (a.event.rsvpCount - b.event.rsvpCount) * factor;
        }
        return b.event.startAt.getTime() - a.event.startAt.getTime();
      case 'startAt':
        return (a.event.startAt.getTime() - b.event.startAt.getTime()) * factor;
      case 'createdAt':
        return (a.event.createdAt.getTime() - b.event.createdAt.getTime()) * factor;
      case 'title':
        return a.event.title.localeCompare(b.event.title) * factor;
      case 'hostClub':
        return a.event.hostClub.localeCompare(b.event.hostClub) * factor;
      case 'status':
        return a.event.status.localeCompare(b.event.status) * factor;
    }
  });
}

export function computeEventPerformanceSummary(events: SchoolEvent[]): EventPerformanceSummary {
  const totalRsvps = events.reduce((acc, e) => acc + Math.max(0, e.rsvpCount), 0);
  const published = events.filter((e) => e.status === 'published');
  const publishedRsvps = published.reduce((acc, e) => acc + Math.max(0, e.rsvpCount), 0);
  const avgRsvpsAcrossPublished =
    published.length > 0 ? Number((publishedRsvps / published.length).toFixed(1)) : 0;

  if (published.length === 0) {
    return {
      totalRsvps,
      avgRsvpsAcrossPublished,
      highestRsvpEvent: null,
      lowestRsvpEvent: null,
    };
  }

  const sortedByRsvp = [...published].sort((a, b) => {
    if (b.rsvpCount !== a.rsvpCount) return b.rsvpCount - a.rsvpCount;
    return b.startAt.getTime() - a.startAt.getTime();
  });

  const highest = sortedByRsvp[0];
  const lowest = sortedByRsvp[sortedByRsvp.length - 1];

  return {
    totalRsvps,
    avgRsvpsAcrossPublished,
    highestRsvpEvent: {
      id: highest.id,
      title: highest.title,
      hostClub: highest.hostClub,
      rsvpCount: highest.rsvpCount,
    },
    lowestRsvpEvent: {
      id: lowest.id,
      title: lowest.title,
      hostClub: lowest.hostClub,
      rsvpCount: lowest.rsvpCount,
    },
  };
}

export function computeCategoryBreakdown(events: SchoolEvent[]): CategoryBreakdownItem[] {
  const totalRsvpsAll = events.reduce((acc, e) => acc + Math.max(0, e.rsvpCount), 0);

  return ALL_EVENT_CATEGORIES.map((category) => {
    const matching = events.filter((e) => e.category === category);
    const publishedCount = matching.filter((e) => e.status === 'published').length;
    const totalRsvps = matching.reduce((acc, e) => acc + Math.max(0, e.rsvpCount), 0);
    const sharePct =
      totalRsvpsAll > 0 ? Math.round((totalRsvps / totalRsvpsAll) * 100) : 0;
    return {
      category,
      eventCount: matching.length,
      publishedCount,
      totalRsvps,
      sharePct,
    };
  }).sort((a, b) => {
    if (b.totalRsvps !== a.totalRsvps) return b.totalRsvps - a.totalRsvps;
    return b.eventCount - a.eventCount;
  });
}

export function buildRsvpDistributionBuckets(events: SchoolEvent[]): RsvpDistributionBucket[] {
  const buckets: RsvpDistributionBucket[] = [
    { id: '0', label: '0 RSVPs', eventCount: 0, rsvpSum: 0 },
    { id: '1-5', label: '1–5 RSVPs', eventCount: 0, rsvpSum: 0 },
    { id: '6-15', label: '6–15 RSVPs', eventCount: 0, rsvpSum: 0 },
    { id: '16-30', label: '16–30 RSVPs', eventCount: 0, rsvpSum: 0 },
    { id: '31+', label: '31+ RSVPs', eventCount: 0, rsvpSum: 0 },
  ];

  for (const evt of events) {
    if (evt.status === 'draft') continue;
    const count = Math.max(0, evt.rsvpCount);
    const target =
      count === 0
        ? buckets[0]
        : count <= 5
          ? buckets[1]
          : count <= 15
            ? buckets[2]
            : count <= 30
              ? buckets[3]
              : buckets[4];
    target.eventCount += 1;
    target.rsvpSum += count;
  }

  return buckets;
}

export function computeClubEngagementRows(
  clubs: Club[],
  events: SchoolEvent[],
  now: Date = new Date()
): ClubEngagementRow[] {
  const eventsByClub = new Map<string, SchoolEvent[]>();
  for (const evt of events) {
    const list = eventsByClub.get(evt.clubId) ?? [];
    list.push(evt);
    eventsByClub.set(evt.clubId, list);
  }

  const rows: ClubEngagementRow[] = clubs.map((club) => {
    const clubEvents = eventsByClub.get(club.id) ?? [];
    const published = clubEvents.filter((e) => e.status === 'published');
    const upcomingCount = published.filter((e) => !isPastEvent(e, now)).length;
    const draftCount = clubEvents.filter((e) => e.status === 'draft').length;
    const cancelledCount = clubEvents.filter((e) => e.status === 'cancelled').length;
    const totalRsvps = clubEvents.reduce((acc, e) => acc + Math.max(0, e.rsvpCount), 0);
    const publishedRsvps = published.reduce((acc, e) => acc + Math.max(0, e.rsvpCount), 0);
    const avgRsvpsPerPublished =
      published.length > 0 ? Number((publishedRsvps / published.length).toFixed(1)) : 0;

    const topEvent = [...clubEvents]
      .filter((e) => e.status !== 'draft')
      .sort((a, b) => b.rsvpCount - a.rsvpCount)[0];

    return {
      club,
      publishedCount: published.length,
      upcomingCount,
      draftCount,
      cancelledCount,
      totalEventsCount: clubEvents.length,
      totalRsvps,
      avgRsvpsPerPublished,
      mostPopularEvent: topEvent
        ? { id: topEvent.id, title: topEvent.title, rsvpCount: topEvent.rsvpCount }
        : null,
      followerCount: Math.max(0, club.followerCount),
    };
  });

  return rows.sort((a, b) => {
    if (b.totalRsvps !== a.totalRsvps) return b.totalRsvps - a.totalRsvps;
    if (b.publishedCount !== a.publishedCount) return b.publishedCount - a.publishedCount;
    return a.club.name.localeCompare(b.club.name);
  });
}

export function computeMonthlyEventActivity(
  events: SchoolEvent[],
  timeZone: string
): MonthlyActivityPoint[] {
  const monthMap = new Map<string, MonthlyActivityPoint>();

  for (const evt of events) {
    const ymd = formatDateInTimezone(evt.startAt, timeZone).date;
    const monthKey = ymd.slice(0, 7); // YYYY-MM
    const [yearNum, monthNum] = monthKey.split('-').map(Number);

    let label = monthKey;
    try {
      const refDate = new Date(Date.UTC(yearNum, monthNum - 1, 15, 12, 0, 0));
      label = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'short',
        year: 'numeric',
      }).format(refDate);
    } catch {
      label = monthKey;
    }

    const existing = monthMap.get(monthKey) ?? {
      monthKey,
      label,
      eventCount: 0,
      publishedCount: 0,
      rsvpTotal: 0,
    };
    existing.eventCount += 1;
    if (evt.status === 'published') existing.publishedCount += 1;
    existing.rsvpTotal += Math.max(0, evt.rsvpCount);
    monthMap.set(monthKey, existing);
  }

  return Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export function computeSchoolAdminAnalytics(
  schoolId: string,
  clubs: Club[],
  events: SchoolEvent[],
  timeZone: string,
  now: Date = new Date()
): SchoolAdminAnalytics {
  const schoolClubs = clubs.filter((c) => c.schoolId === schoolId);
  const schoolEvents = events.filter((e) => e.schoolId === schoolId);

  const activeClubs = schoolClubs.filter((c) => c.status === 'active').length;
  const suspendedClubs = schoolClubs.filter((c) => c.status === 'suspended').length;

  const kpis = computeOrganizerKpis(schoolEvents, now);
  const clubRows = computeClubEngagementRows(schoolClubs, schoolEvents, now);

  const mostActiveClubsByPublished = [...clubRows].sort((a, b) => {
    if (b.publishedCount !== a.publishedCount) return b.publishedCount - a.publishedCount;
    return b.totalRsvps - a.totalRsvps;
  });

  const mostEngagedClubsByRsvps = [...clubRows].sort((a, b) => {
    if (b.totalRsvps !== a.totalRsvps) return b.totalRsvps - a.totalRsvps;
    return b.followerCount - a.followerCount;
  });

  const upcomingEventsByClub = [...clubRows]
    .filter((row) => row.upcomingCount > 0)
    .sort((a, b) => b.upcomingCount - a.upcomingCount);

  const clubCategoryDistribution: ClubCategoryDistributionItem[] = ALL_CLUB_CATEGORIES.map(
    (category) => {
      const matches = schoolClubs.filter((c) => c.category === category);
      return {
        category,
        clubCount: matches.length,
        activeCount: matches.filter((c) => c.status === 'active').length,
        totalFollowers: matches.reduce((acc, c) => acc + Math.max(0, c.followerCount), 0),
      };
    }
  )
    .filter((item) => item.clubCount > 0)
    .sort((a, b) => b.clubCount - a.clubCount);

  const statusCounts: Record<EventStatus, number> = {
    published: kpis.published,
    draft: kpis.draft,
    cancelled: kpis.cancelled,
  };

  const categoryBreakdown = computeCategoryBreakdown(schoolEvents);
  const monthlyActivity = computeMonthlyEventActivity(schoolEvents, timeZone);

  const topEvents = [...schoolEvents]
    .filter((e) => e.status === 'published')
    .sort((a, b) => b.rsvpCount - a.rsvpCount)
    .slice(0, 8);

  return {
    schoolId,
    totalClubs: schoolClubs.length,
    activeClubs,
    suspendedClubs,
    kpis,
    mostActiveClubsByPublished,
    mostEngagedClubsByRsvps,
    clubCategoryDistribution,
    upcomingEventsByClub,
    statusCounts,
    categoryBreakdown,
    monthlyActivity,
    topEvents,
  };
}
