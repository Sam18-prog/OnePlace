import assert from 'node:assert/strict';
import test from 'node:test';
import type { Club } from '../types/club';
import type { SchoolEvent } from '../types/event';
import type { SchoolMembership } from '../types/membership';
import {
  buildRsvpDistributionBuckets,
  computeCategoryBreakdown,
  computeClubEngagementRows,
  computeEventPerformanceRows,
  computeEventPerformanceSummary,
  computeMonthlyEventActivity,
  computeOrganizerKpis,
  computeSchoolAdminAnalytics,
  filterAuthorizedClubsForAnalytics,
  filterAuthorizedEventsForAnalytics,
  filterEventsByDateRange,
  resolveDateRangeBounds,
} from './analytics';
import {
  buildAnalyticsCsvFilename,
  buildClubSummaryCsv,
  buildEventPerformanceCsv,
  buildRsvpAggregateCsv,
  buildSchoolAggregateCsv,
  escapeCsvCell,
} from './analyticsCsv';

const NOW = new Date('2026-11-18T18:00:00.000Z'); // 10:00 AM PST on Nov 18, 2026
const TZ = 'America/Los_Angeles';

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'robotics-club',
    schoolId: 'oakridge-high',
    name: 'Robotics Club',
    slug: 'robotics-club',
    description: 'Robotics build nights and FIRST competitions.',
    category: 'Robotics & Engineering',
    visibility: 'public',
    status: 'active',
    isOfficial: true,
    discoverKey: 'public:oakridge-high',
    contactEmail: 'private-faculty@oakridge.edu',
    followerCount: 24,
    createdBy: 'admin-1',
    createdAt: new Date('2026-09-01T16:00:00.000Z'),
    updatedAt: new Date('2026-11-10T16:00:00.000Z'),
    lastActivityAt: new Date('2026-11-10T16:00:00.000Z'),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SchoolEvent> = {}): SchoolEvent {
  const startAt = new Date('2026-11-22T20:00:00.000Z');
  const endAt = new Date('2026-11-22T22:00:00.000Z');
  return {
    id: 'evt-1',
    schoolId: 'oakridge-high',
    title: 'Robotics Workshop',
    description: 'Hands-on CAD and autonomous sensor lab.',
    hostClub: 'Robotics Club',
    clubId: 'robotics-club',
    category: 'STEM & Makers',
    dateTime: startAt,
    startAt,
    endAt,
    timezone: TZ,
    location: 'STEM Lab 101',
    createdBy: 'org-1',
    createdAt: new Date('2026-11-15T18:00:00.000Z'),
    updatedAt: new Date('2026-11-15T18:00:00.000Z'),
    status: 'published',
    visibility: 'public',
    rsvpCount: 18,
    discoverKey: 'public:oakridge-high',
    ...overrides,
  };
}

test('KPI calculations compute published, draft, cancelled, upcoming, total and avg RSVPs accurately', () => {
  const events: SchoolEvent[] = [
    makeEvent({ id: 'e1', clubId: 'robotics-club', hostClub: 'Robotics Club', status: 'published', rsvpCount: 20, startAt: new Date('2026-11-25T20:00:00.000Z'), endAt: new Date('2026-11-25T22:00:00.000Z') }),
    makeEvent({ id: 'e2', clubId: 'robotics-club', hostClub: 'Robotics Club', status: 'published', rsvpCount: 10, startAt: new Date('2026-11-10T20:00:00.000Z'), endAt: new Date('2026-11-10T22:00:00.000Z') }),
    makeEvent({ id: 'e3', clubId: 'debate-club', hostClub: 'Debate Society', category: 'Academic', status: 'draft', rsvpCount: 0 }),
    makeEvent({ id: 'e4', clubId: 'debate-club', hostClub: 'Debate Society', category: 'Academic', status: 'cancelled', rsvpCount: 6 }),
  ];

  const kpis = computeOrganizerKpis(events, NOW);
  assert.equal(kpis.totalCreated, 4);
  assert.equal(kpis.published, 2);
  assert.equal(kpis.draft, 1);
  assert.equal(kpis.cancelled, 1);
  assert.equal(kpis.upcoming, 1);
  assert.equal(kpis.totalCurrentRsvps, 36);
  assert.equal(kpis.avgRsvpsPerPublished, 15);
  assert.equal(kpis.mostActiveClub?.clubId, 'robotics-club');
  assert.equal(kpis.mostActiveClub?.publishedCount, 2);

  // Zero-published safety
  const emptyKpis = computeOrganizerKpis([], NOW);
  assert.equal(emptyKpis.avgRsvpsPerPublished, 0);
  assert.equal(emptyKpis.mostActiveClub, null);
});

test('Event performance rows, summary, category breakdown, and RSVP buckets compute accurate values', () => {
  const events: SchoolEvent[] = [
    makeEvent({ id: 'e1', category: 'STEM & Makers', status: 'published', rsvpCount: 32 }),
    makeEvent({ id: 'e2', category: 'STEM & Makers', status: 'published', rsvpCount: 8 }),
    makeEvent({ id: 'e3', category: 'Arts & Music', status: 'published', rsvpCount: 0 }),
    makeEvent({ id: 'e4', category: 'Academic', status: 'draft', rsvpCount: 0 }),
  ];

  const summary = computeEventPerformanceSummary(events);
  assert.equal(summary.totalRsvps, 40);
  assert.equal(summary.avgRsvpsAcrossPublished, 13.3);
  assert.equal(summary.highestRsvpEvent?.id, 'e1');
  assert.equal(summary.lowestRsvpEvent?.id, 'e3');

  const rows = computeEventPerformanceRows(events, NOW, { sortKey: 'rsvpCount', sortDir: 'desc' });
  assert.equal(rows[0].event.id, 'e1');
  assert.equal(rows[0].deltaPctFromAvg !== null && rows[0].deltaPctFromAvg > 0, true);
  assert.equal(rows[3].relativeLabel, 'Draft');

  const categories = computeCategoryBreakdown(events);
  const stem = categories.find((c) => c.category === 'STEM & Makers');
  assert.equal(stem?.totalRsvps, 40);
  assert.equal(stem?.sharePct, 100);

  const buckets = buildRsvpDistributionBuckets(events);
  assert.equal(buckets.find((b) => b.id === '0')?.eventCount, 1); // draft excluded
  assert.equal(buckets.find((b) => b.id === '6-15')?.eventCount, 1);
  assert.equal(buckets.find((b) => b.id === '31+')?.eventCount, 1);
});

test('Club engagement analytics and school admin analytics compute accurate rollups and monthly buckets', () => {
  const clubs: Club[] = [
    makeClub({ id: 'robotics-club', name: 'Robotics Club', followerCount: 40, status: 'active' }),
    makeClub({ id: 'debate-club', name: 'Debate Society', category: 'Academic & Research', followerCount: 22, status: 'suspended' }),
  ];
  const events: SchoolEvent[] = [
    makeEvent({ id: 'e1', clubId: 'robotics-club', hostClub: 'Robotics Club', rsvpCount: 25, startAt: new Date('2026-11-24T20:00:00.000Z'), endAt: new Date('2026-11-24T22:00:00.000Z') }),
    makeEvent({ id: 'e2', clubId: 'robotics-club', hostClub: 'Robotics Club', rsvpCount: 15, startAt: new Date('2026-12-03T20:00:00.000Z'), endAt: new Date('2026-12-03T22:00:00.000Z') }),
    makeEvent({ id: 'e3', clubId: 'debate-club', hostClub: 'Debate Society', category: 'Academic', rsvpCount: 5, status: 'cancelled' }),
  ];

  const clubRows = computeClubEngagementRows(clubs, events, NOW);
  assert.equal(clubRows.length, 2);
  assert.equal(clubRows[0].club.id, 'robotics-club');
  assert.equal(clubRows[0].publishedCount, 2);
  assert.equal(clubRows[0].upcomingCount, 2);
  assert.equal(clubRows[0].totalRsvps, 40);
  assert.equal(clubRows[0].avgRsvpsPerPublished, 20);
  assert.equal(clubRows[0].mostPopularEvent?.id, 'e1');
  assert.equal(clubRows[0].followerCount, 40);

  const monthly = computeMonthlyEventActivity(events, TZ);
  assert.equal(monthly.map((m) => m.monthKey).join(','), '2026-11,2026-12');
  assert.equal(monthly[0].rsvpTotal, 30);
  assert.equal(monthly[1].rsvpTotal, 15);

  const adminSummary = computeSchoolAdminAnalytics('oakridge-high', clubs, events, TZ, NOW);
  assert.equal(adminSummary.totalClubs, 2);
  assert.equal(adminSummary.activeClubs, 1);
  assert.equal(adminSummary.suspendedClubs, 1);
  assert.equal(adminSummary.clubCategoryDistribution.length, 2);
  assert.equal(adminSummary.topEvents[0].id, 'e1');
});

test('Security scopes block students, suspended accounts, cross-school leaks, and unauthorized clubs', () => {
  const clubs = [
    makeClub({ id: 'robotics-club', schoolId: 'oakridge-high' }),
    makeClub({ id: 'debate-club', schoolId: 'oakridge-high' }),
    makeClub({ id: 'other-school-club', schoolId: 'westview-high' }),
  ];
  const events = [
    makeEvent({ id: 'e1', clubId: 'robotics-club', createdBy: 'org-1', schoolId: 'oakridge-high' }),
    makeEvent({ id: 'e2', clubId: 'debate-club', createdBy: 'org-2', schoolId: 'oakridge-high' }),
    makeEvent({ id: 'e3', clubId: 'other-school-club', createdBy: 'org-1', schoolId: 'westview-high' }),
  ];

  const studentMember: SchoolMembership = {
    uid: 'stu-1',
    schoolId: 'oakridge-high',
    role: 'student',
    status: 'active',
    createdAt: NOW,
  };
  assert.equal(filterAuthorizedClubsForAnalytics(clubs, studentMember, new Set(['robotics-club'])).length, 0);
  assert.equal(filterAuthorizedEventsForAnalytics(events, studentMember, new Set(['robotics-club'])).length, 0);

  const suspendedOrg: SchoolMembership = {
    uid: 'org-1',
    schoolId: 'oakridge-high',
    role: 'organizer',
    status: 'suspended',
    createdAt: NOW,
  };
  assert.equal(filterAuthorizedClubsForAnalytics(clubs, suspendedOrg, new Set(['robotics-club'])).length, 0);

  const orgMember: SchoolMembership = {
    uid: 'org-1',
    schoolId: 'oakridge-high',
    role: 'organizer',
    status: 'active',
    createdAt: NOW,
  };
  const orgClubs = filterAuthorizedClubsForAnalytics(clubs, orgMember, new Set(['robotics-club']));
  const orgEvents = filterAuthorizedEventsForAnalytics(events, orgMember, new Set(['robotics-club']));
  assert.deepEqual(orgClubs.map((c) => c.id), ['robotics-club']);
  assert.deepEqual(orgEvents.map((e) => e.id), ['e1']); // e2 unauthorized club, e3 wrong school

  const adminMember: SchoolMembership = {
    uid: 'admin-1',
    schoolId: 'oakridge-high',
    role: 'admin',
    status: 'active',
    createdAt: NOW,
  };
  const adminClubs = filterAuthorizedClubsForAnalytics(clubs, adminMember, new Set());
  const adminEvents = filterAuthorizedEventsForAnalytics(events, adminMember, new Set());
  assert.deepEqual(adminClubs.map((c) => c.id), ['robotics-club', 'debate-club']);
  assert.deepEqual(adminEvents.map((e) => e.id), ['e1', 'e2']);
});

test('Date range resolution handles 7d, 30d, 90d, semester, year, custom ranges, and school timezone edges', () => {
  // 2026-11-18T18:00Z -> today in America/Los_Angeles is 2026-11-18
  const bounds7d = resolveDateRangeBounds('7d', TZ, NOW);
  assert.equal(bounds7d.isValidCustomRange, true);
  // Nov 12 00:00 PST == 2026-11-12T08:00:00.000Z
  assert.equal(bounds7d.start?.toISOString(), '2026-11-12T08:00:00.000Z');
  // Nov 18 23:59:59.999 PST == 2026-11-19T07:59:59.999Z
  assert.equal(bounds7d.end?.toISOString(), '2026-11-19T07:59:59.999Z');

  const bounds30d = resolveDateRangeBounds('30d', TZ, NOW);
  assert.equal(bounds30d.label, 'Last 30 Days');
  const bounds90d = resolveDateRangeBounds('90d', TZ, NOW);
  assert.equal(bounds90d.label, 'Last 90 Days');
  const boundsSemester = resolveDateRangeBounds('semester', TZ, NOW);
  assert.equal(boundsSemester.label, 'Fall 2026');
  const boundsYear = resolveDateRangeBounds('year', TZ, NOW);
  assert.equal(boundsYear.label, '2026');

  const invalidCustom = resolveDateRangeBounds('custom', TZ, NOW, '2026-11-20', '2026-11-10');
  assert.equal(invalidCustom.isValidCustomRange, false);

  const validCustom = resolveDateRangeBounds('custom', TZ, NOW, '2026-11-18', '2026-11-18');
  assert.equal(validCustom.isValidCustomRange, true);

  // Event at 11:30 PM PST on Nov 18 is 2026-11-19T07:30:00.000Z in UTC — MUST still fall inside Nov 18 PST
  const latePstEvent = makeEvent({
    id: 'late-pst',
    createdAt: new Date('2026-11-19T07:30:00.000Z'),
    startAt: new Date('2026-11-19T07:30:00.000Z'),
    endAt: new Date('2026-11-19T08:30:00.000Z'),
  });
  const earlyNextDayPst = makeEvent({
    id: 'nov19-pst',
    createdAt: new Date('2026-11-19T08:05:00.000Z'), // 12:05 AM PST Nov 19
    startAt: new Date('2026-11-19T08:05:00.000Z'),
    endAt: new Date('2026-11-19T09:05:00.000Z'),
  });

  const filtered = filterEventsByDateRange([latePstEvent, earlyNextDayPst], validCustom, 'createdAt');
  assert.deepEqual(filtered.map((e) => e.id), ['late-pst']);
});

test('CSV exports properly escape commas/quotes/newlines, handle empty rows, and exclude PII/UIDs', () => {
  assert.equal(escapeCsvCell('Room "A", Floor 2\nWest'), '"Room ""A"", Floor 2\nWest"');

  const trickyEvent = makeEvent({
    id: 'evt-csv',
    title: 'Coding, "AI" & Robotics\nNight',
    hostClub: 'Robotics, Inc.',
    createdBy: 'secret-student-uid-999',
  });
  const club = makeClub({
    contactEmail: 'advisor-secret@oakridge.edu',
  });

  const rows = computeEventPerformanceRows([trickyEvent], NOW);
  const eventCsv = buildEventPerformanceCsv(rows, TZ);
  assert.equal(eventCsv.includes('Event ID,Title,Hosting Club'), true);
  assert.equal(eventCsv.includes('"Coding, ""AI"" & Robotics\nNight"'), true);
  assert.equal(eventCsv.includes('"Robotics, Inc."'), true);
  assert.equal(eventCsv.includes('secret-student-uid-999'), false);

  const emptyCsv = buildEventPerformanceCsv([], TZ);
  assert.equal(emptyCsv.split('\r\n').length, 1);

  const clubRows = computeClubEngagementRows([club], [trickyEvent], NOW);
  const clubCsv = buildClubSummaryCsv(clubRows);
  assert.equal(clubCsv.includes('Club ID,Club Name,Category'), true);
  assert.equal(clubCsv.includes('advisor-secret@oakridge.edu'), false);

  const rsvpCsv = buildRsvpAggregateCsv(
    computeCategoryBreakdown([trickyEvent]),
    clubRows,
    computeOrganizerKpis([trickyEvent], NOW)
  );
  assert.equal(rsvpCsv.includes('Breakdown Dimension,Group Name'), true);
  assert.equal(rsvpCsv.includes('secret-student-uid-999'), false);

  const adminOverview = computeSchoolAdminAnalytics('oakridge-high', [club], [trickyEvent], TZ, NOW);
  const schoolCsv = buildSchoolAggregateCsv(
    adminOverview,
    clubRows,
    adminOverview.categoryBreakdown,
    adminOverview.monthlyActivity
  );
  assert.equal(schoolCsv.includes('Report Section,School ID'), true);
  assert.equal(schoolCsv.includes('advisor-secret@oakridge.edu'), false);

  assert.equal(buildAnalyticsCsvFilename('Event Performance', NOW, TZ), 'oneplace-event-performance-2026-11-18.csv');
});
