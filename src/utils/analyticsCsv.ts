import type {
  CategoryBreakdownItem,
  ClubEngagementRow,
  EventPerformanceRow,
  MonthlyActivityPoint,
  OrganizerKpis,
  SchoolAdminAnalytics,
} from '../types/analytics';
import { formatDateInTimezone } from './eventValidation';

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const needsQuotes = /[",\r\n]/.test(raw);
  const escaped = raw.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function toCsvString(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map((h) => escapeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export function buildAnalyticsCsvFilename(
  reportType: string,
  now: Date = new Date(),
  timeZone: string = 'America/Los_Angeles'
): string {
  const safeSlug = reportType
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const datePart = formatDateInTimezone(now, timeZone).date;
  return `oneplace-${safeSlug || 'analytics'}-${datePart}.csv`;
}

/**
 * Exports event-level aggregate performance without student UIDs or emails.
 */
export function buildEventPerformanceCsv(
  rows: EventPerformanceRow[],
  timeZone: string
): string {
  const headers = [
    'Event ID',
    'Title',
    'Hosting Club',
    'Category',
    'Event Date (School TZ)',
    'Start Time',
    'Status',
    'Visibility',
    'Current RSVPs',
    'Created Date (School TZ)',
    'Relative Performance',
    'Share of Filtered RSVPs (%)',
  ];

  const csvRows = rows.map((row) => {
    const startFormatted = formatDateInTimezone(row.event.startAt, timeZone);
    const createdFormatted = formatDateInTimezone(row.event.createdAt, timeZone);
    return [
      row.event.id,
      row.event.title,
      row.event.hostClub,
      row.event.category,
      startFormatted.date,
      startFormatted.time,
      row.event.status,
      row.event.visibility,
      row.event.rsvpCount,
      createdFormatted.date,
      row.relativeLabel,
      row.rsvpSharePct,
    ];
  });

  return toCsvString(headers, csvRows);
}

/**
 * Exports authorized club-level engagement totals without private membership rosters or emails.
 */
export function buildClubSummaryCsv(clubRows: ClubEngagementRow[]): string {
  const headers = [
    'Club ID',
    'Club Name',
    'Category',
    'Status',
    'Visibility',
    'Current Followers',
    'Published Events',
    'Upcoming Events',
    'Draft Events',
    'Cancelled Events',
    'Total Current RSVPs',
    'Avg RSVPs Per Published Event',
    'Most Popular Event',
    'Top Event Current RSVPs',
  ];

  const csvRows = clubRows.map((row) => [
    row.club.id,
    row.club.name,
    row.club.category,
    row.club.status,
    row.club.visibility,
    row.followerCount,
    row.publishedCount,
    row.upcomingCount,
    row.draftCount,
    row.cancelledCount,
    row.totalRsvps,
    row.avgRsvpsPerPublished,
    row.mostPopularEvent?.title ?? 'None',
    row.mostPopularEvent?.rsvpCount ?? 0,
  ]);

  return toCsvString(headers, csvRows);
}

/**
 * Exports aggregate RSVP totals by category and club (no individual student data).
 */
export function buildRsvpAggregateCsv(
  categoryBreakdown: CategoryBreakdownItem[],
  clubRows: ClubEngagementRow[],
  kpis: OrganizerKpis
): string {
  const headers = [
    'Breakdown Dimension',
    'Group Name',
    'Published Events',
    'Total Events',
    'Total Current RSVPs',
    'RSVP Share (%)',
  ];

  const rows: (string | number)[][] = [
    [
      'Overview Total',
      'All Authorized Events',
      kpis.published,
      kpis.totalCreated,
      kpis.totalCurrentRsvps,
      100,
    ],
  ];

  for (const cat of categoryBreakdown) {
    rows.push([
      'Event Category',
      cat.category,
      cat.publishedCount,
      cat.eventCount,
      cat.totalRsvps,
      cat.sharePct,
    ]);
  }

  const totalClubRsvps = clubRows.reduce((acc, c) => acc + c.totalRsvps, 0);
  for (const clubRow of clubRows) {
    const share =
      totalClubRsvps > 0 ? Math.round((clubRow.totalRsvps / totalClubRsvps) * 100) : 0;
    rows.push([
      'Club',
      clubRow.club.name,
      clubRow.publishedCount,
      clubRow.totalEventsCount,
      clubRow.totalRsvps,
      share,
    ]);
  }

  return toCsvString(headers, rows);
}

/**
 * Exports school-wide administrator aggregate analytics scoped strictly to one school.
 */
export function buildSchoolAggregateCsv(
  adminAnalytics: SchoolAdminAnalytics,
  clubRows: ClubEngagementRow[],
  categoryBreakdown: CategoryBreakdownItem[],
  monthlyActivity: MonthlyActivityPoint[]
): string {
  const headers = [
    'Report Section',
    'School ID',
    'Label',
    'Primary Count',
    'Secondary Metric',
    'Total Current RSVPs',
  ];

  const rows: (string | number)[][] = [
    [
      'Campus Overview',
      adminAnalytics.schoolId,
      'Registered Clubs (Active / Total)',
      adminAnalytics.activeClubs,
      adminAnalytics.totalClubs,
      adminAnalytics.kpis.totalCurrentRsvps,
    ],
    [
      'Campus Overview',
      adminAnalytics.schoolId,
      'Events (Published / Created)',
      adminAnalytics.kpis.published,
      adminAnalytics.kpis.totalCreated,
      adminAnalytics.kpis.totalCurrentRsvps,
    ],
    [
      'Campus Overview',
      adminAnalytics.schoolId,
      'Upcoming Published Events',
      adminAnalytics.kpis.upcoming,
      adminAnalytics.kpis.cancelled,
      adminAnalytics.kpis.avgRsvpsPerPublished,
    ],
  ];

  for (const cat of categoryBreakdown) {
    rows.push([
      'Category Distribution',
      adminAnalytics.schoolId,
      cat.category,
      cat.eventCount,
      cat.publishedCount,
      cat.totalRsvps,
    ]);
  }

  for (const month of monthlyActivity) {
    rows.push([
      'Events by Scheduled Month',
      adminAnalytics.schoolId,
      month.label,
      month.eventCount,
      month.publishedCount,
      month.rsvpTotal,
    ]);
  }

  for (const clubRow of clubRows) {
    rows.push([
      'Club Activity',
      adminAnalytics.schoolId,
      clubRow.club.name,
      clubRow.publishedCount,
      clubRow.followerCount,
      clubRow.totalRsvps,
    ]);
  }

  return toCsvString(headers, rows);
}

export function downloadCsvFile(
  filename: string,
  csvContent: string
): { ok: true } | { ok: false; error: string } {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { ok: false, error: 'CSV download is only available in a browser.' };
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to generate CSV download.',
    };
  }
}
