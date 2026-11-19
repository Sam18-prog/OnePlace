import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarRange,
  Download,
  Info,
  Layers,
  Users,
} from 'lucide-react';
import type { SchoolConfig } from '../../config/school';
import type {
  AnalyticsDateAxis,
  AnalyticsDatePreset,
  EventAnalyticsFilterStatus,
  EventAnalyticsSortKey,
  SortDirection,
} from '../../types/analytics';
import type { Club } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import type { MembershipCapabilities, SchoolMembership } from '../../types/membership';
import {
  ANALYTICS_DATA_LIMITATIONS,
  buildRsvpDistributionBuckets,
  computeCategoryBreakdown,
  computeClubEngagementRows,
  computeEventPerformanceRows,
  computeEventPerformanceSummary,
  computeOrganizerKpis,
  computeSchoolAdminAnalytics,
  filterEventsByDateRange,
  resolveDateRangeBounds,
} from '../../utils/analytics';
import {
  buildAnalyticsCsvFilename,
  buildClubSummaryCsv,
  buildEventPerformanceCsv,
  buildRsvpAggregateCsv,
  buildSchoolAggregateCsv,
  downloadCsvFile,
} from '../../utils/analyticsCsv';
import { formatDateInTimezone } from '../../utils/eventValidation';
import {
  categoryBreakdownToDonutSlices,
  DonutBreakdownChart,
  EventComparisonPanel,
  HorizontalBarChart,
  RsvpDistributionChart,
} from './AnalyticsCharts';
import { ClubComparisonSection } from './ClubComparisonSection';
import { EventPerformanceTable } from './EventPerformanceTable';
import { SchoolAdminAnalyticsSection } from './SchoolAdminAnalyticsSection';

type AnalyticsSubTab = 'rsvp' | 'events' | 'clubs' | 'school';

interface AnalyticsDashboardProps {
  membership: SchoolMembership;
  capabilities: MembershipCapabilities;
  schoolConfig: SchoolConfig;
  authorizedEvents: SchoolEvent[];
  authorizedClubs: Club[];
  isAdminScopeCapped?: boolean;
  onSelectEvent: (event: SchoolEvent) => void;
  onViewClubProfile: (club: Club) => void;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

const DATE_PRESETS: { id: AnalyticsDatePreset; label: string }[] = [
  { id: 'all', label: 'All Time' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'semester', label: 'This Semester' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

export function AnalyticsDashboard({
  membership,
  capabilities,
  schoolConfig,
  authorizedEvents,
  authorizedClubs,
  isAdminScopeCapped = false,
  onSelectEvent,
  onViewClubProfile,
  onShowToast,
}: AnalyticsDashboardProps) {
  const isAdmin = capabilities.canManageAllSchoolEvents;
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('rsvp');

  // Time-based filter controls
  const [datePreset, setDatePreset] = useState<AnalyticsDatePreset>('all');
  const [dateAxis, setDateAxis] = useState<AnalyticsDateAxis>('startAt');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Event Performance table filters
  const [eventStatusFilter, setEventStatusFilter] = useState<EventAnalyticsFilterStatus>('all');
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('all');
  const [eventSearchQuery, setEventSearchQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<EventAnalyticsSortKey>('rsvpCount');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const dateBounds = useMemo(
    () =>
      resolveDateRangeBounds(
        datePreset,
        schoolConfig.timezone,
        new Date(),
        customStart,
        customEnd
      ),
    [customEnd, customStart, datePreset, schoolConfig.timezone]
  );

  const rangedEvents = useMemo(
    () => filterEventsByDateRange(authorizedEvents, dateBounds, dateAxis),
    [authorizedEvents, dateAxis, dateBounds]
  );

  const kpis = useMemo(() => computeOrganizerKpis(rangedEvents), [rangedEvents]);

  const performanceRows = useMemo(
    () =>
      computeEventPerformanceRows(rangedEvents, new Date(), {
        statusFilter: eventStatusFilter,
        categoryFilter: eventCategoryFilter,
        searchQuery: eventSearchQuery,
        sortKey,
        sortDir,
      }),
    [eventCategoryFilter, eventSearchQuery, eventStatusFilter, rangedEvents, sortDir, sortKey]
  );

  const performanceSummary = useMemo(
    () => computeEventPerformanceSummary(rangedEvents),
    [rangedEvents]
  );

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(rangedEvents),
    [rangedEvents]
  );

  const distributionBuckets = useMemo(
    () => buildRsvpDistributionBuckets(rangedEvents),
    [rangedEvents]
  );

  const clubRows = useMemo(
    () => computeClubEngagementRows(authorizedClubs, rangedEvents),
    [authorizedClubs, rangedEvents]
  );

  const adminAnalytics = useMemo(() => {
    if (!isAdmin) return null;
    return computeSchoolAdminAnalytics(
      schoolConfig.id,
      authorizedClubs,
      rangedEvents,
      schoolConfig.timezone
    );
  }, [authorizedClubs, isAdmin, rangedEvents, schoolConfig.id, schoolConfig.timezone]);

  const handleToggleSort = (key: EventAnalyticsSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'title' || key === 'hostClub' || key === 'status' ? 'asc' : 'desc');
    }
  };

  const handleExportCsv = (
    reportType: 'events' | 'clubs' | 'rsvps' | 'school'
  ) => {
    let csvContent = '';
    let slug = '';

    if (reportType === 'events') {
      csvContent = buildEventPerformanceCsv(performanceRows, schoolConfig.timezone);
      slug = 'event-performance';
    } else if (reportType === 'clubs') {
      csvContent = buildClubSummaryCsv(clubRows);
      slug = 'club-summary';
    } else if (reportType === 'rsvps') {
      csvContent = buildRsvpAggregateCsv(categoryBreakdown, clubRows, kpis);
      slug = 'rsvp-aggregate';
    } else if (reportType === 'school') {
      if (!isAdmin || !adminAnalytics) {
        onShowToast('error', 'School-wide exports require School Administrator permission.');
        return;
      }
      csvContent = buildSchoolAggregateCsv(
        adminAnalytics,
        clubRows,
        categoryBreakdown,
        adminAnalytics.monthlyActivity
      );
      slug = 'school-summary';
    }

    const filename = buildAnalyticsCsvFilename(slug, new Date(), schoolConfig.timezone);
    const result = downloadCsvFile(filename, csvContent);
    if (result.ok) {
      onShowToast('success', `Exported ${filename}`);
    } else {
      onShowToast('error', result.error);
    }
  };

  const rsvpByEventBars = useMemo(
    () =>
      [...rangedEvents]
        .filter((e) => e.status !== 'draft')
        .sort((a, b) => b.rsvpCount - a.rsvpCount)
        .map((evt) => ({
          id: evt.id,
          label: evt.title,
          sublabel: `${evt.hostClub} · ${formatDateInTimezone(evt.startAt, schoolConfig.timezone).date}`,
          value: evt.rsvpCount,
          secondaryValue: evt.status === 'cancelled' ? 'cancelled' : evt.category,
          onClick: () => onSelectEvent(evt),
        })),
    [onSelectEvent, rangedEvents, schoolConfig.timezone]
  );

  const rsvpByClubBars = useMemo(
    () =>
      clubRows.map((row) => ({
        id: row.club.id,
        label: row.club.name,
        sublabel: `${row.publishedCount} published · ${row.followerCount} followers`,
        value: row.totalRsvps,
        secondaryValue: `${row.avgRsvpsPerPublished} avg`,
        onClick: () => onViewClubProfile(row.club),
      })),
    [clubRows, onViewClubProfile]
  );

  const categoryDonutSlices = useMemo(
    () => categoryBreakdownToDonutSlices(categoryBreakdown),
    [categoryBreakdown]
  );

  const kpiCards = [
    {
      label: 'Total Events Created',
      value: kpis.totalCreated.toLocaleString(),
      sublabel: `${dateBounds.label} (${dateAxis === 'startAt' ? 'event date' : 'created'})`,
      tone: 'text-[#171717]',
    },
    {
      label: 'Published Events',
      value: kpis.published.toLocaleString(),
      sublabel: 'Visible to students',
      tone: 'text-[#16A34A]',
    },
    {
      label: 'Draft Events',
      value: kpis.draft.toLocaleString(),
      sublabel: 'Unpublished drafts',
      tone: 'text-[#D97706]',
    },
    {
      label: 'Cancelled Events',
      value: kpis.cancelled.toLocaleString(),
      sublabel: 'Soft-cancelled records',
      tone: 'text-[#DC2626]',
    },
    {
      label: 'Upcoming Events',
      value: kpis.upcoming.toLocaleString(),
      sublabel: 'Published & future',
      tone: 'text-[#2563EB]',
    },
    {
      label: 'Total Current RSVPs',
      value: kpis.totalCurrentRsvps.toLocaleString(),
      sublabel: 'Intent to attend (not check-in)',
      tone: 'text-[#E85D04]',
    },
    {
      label: 'Avg RSVPs / Published',
      value: String(kpis.avgRsvpsPerPublished),
      sublabel: 'Published events mean',
      tone: 'text-[#171717]',
    },
    {
      label: 'Most Active Club',
      value: kpis.mostActiveClub ? kpis.mostActiveClub.clubName : '—',
      sublabel: kpis.mostActiveClub
        ? `${kpis.mostActiveClub.publishedCount} published · ${kpis.mostActiveClub.totalRsvps} RSVPs`
        : 'No published clubs in range',
      tone: 'text-[#171717]',
      isTextValue: true,
    },
  ];

  const subTabs: { id: AnalyticsSubTab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'rsvp', label: 'RSVP Insights', icon: BarChart3 },
    { id: 'events', label: 'Event Performance', icon: Layers },
    { id: 'clubs', label: 'Club Engagement', icon: Users },
    ...(isAdmin
      ? [{ id: 'school' as const, label: 'School Overview', icon: Building2 }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Scope & Time Window Bar */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-[#171717]">
              {isAdmin ? 'Campus & Organizer Analytics' : 'Organizer Analytics'}
            </h2>
            <p className="mt-0.5 text-xs text-[#737373]">
              Real-time metrics computed from{' '}
              <span className="font-medium text-[#171717]">
                {isAdmin
                  ? `${schoolConfig.name} (${authorizedClubs.length} clubs, ${authorizedEvents.length} events)`
                  : `your owned events & assigned clubs (${authorizedClubs.length} clubs)`}
              </span>{' '}
              in <span className="font-mono text-[#171717]">{schoolConfig.timezone}</span>.
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportCsv('events')}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
              <span>Events CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportCsv('clubs')}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
              <span>Clubs CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportCsv('rsvps')}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
              <span>RSVP Summary CSV</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => handleExportCsv('school')}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#171717] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#333333] cursor-pointer transition-colors"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>School Report CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-[#F3F4F6] pt-4">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Time period filter">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#737373] mr-1">
              <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Period:</span>
            </span>
            {DATE_PRESETS.map((preset) => {
              const active = datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDatePreset(preset.id)}
                  className={`inline-flex min-h-[34px] items-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#E5E7EB] bg-[#F8F9FA] text-[#525252] hover:text-[#171717]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="analytics-date-axis" className="text-[#737373] font-medium whitespace-nowrap">
              Filter by:
            </label>
            <select
              id="analytics-date-axis"
              value={dateAxis}
              onChange={(e) => setDateAxis(e.target.value as AnalyticsDateAxis)}
              className="h-9 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            >
              <option value="startAt">Event Date (startAt)</option>
              <option value="createdAt">Created Date (createdAt)</option>
            </select>
          </div>
        </div>

        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
            <div>
              <label htmlFor="analytics-custom-start" className="block text-[11px] font-medium text-[#525252]">
                Start date
              </label>
              <input
                id="analytics-custom-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="mt-1 h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#171717]"
              />
            </div>
            <div>
              <label htmlFor="analytics-custom-end" className="block text-[11px] font-medium text-[#525252]">
                End date
              </label>
              <input
                id="analytics-custom-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#171717]"
              />
            </div>
            {!dateBounds.isValidCustomRange && (
              <p className="text-xs font-medium text-[#DC2626] pb-1.5">
                Choose a valid start and end date (start on or before end).
              </p>
            )}
          </div>
        )}

        {isAdminScopeCapped && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[#D97706]/30 bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Showing the latest bounded query window of 200 school events. Upgrade to Blaze server-side aggregation (<code className="font-mono">schools/{schoolConfig.id}/analytics</code>) for unbounded historical totals.
            </p>
          </div>
        )}
      </section>

      {/* KPI Overview Grid */}
      <section aria-labelledby="analytics-kpis-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3
            id="analytics-kpis-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717]"
          >
            KPI Overview
          </h3>
          <span className="font-mono text-[11px] text-[#737373]">
            Role: {membership.role} · Intent-to-attend counts only
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col justify-between"
            >
              <p className="text-xs font-medium text-[#737373]">{card.label}</p>
              <p
                className={`mt-1.5 font-bold ${card.tone} ${
                  card.isTextValue
                    ? 'font-display text-base sm:text-lg truncate'
                    : 'font-mono tabular-nums text-2xl'
                }`}
                title={card.value}
              >
                {card.value}
              </p>
              <p className="mt-1 text-[11px] text-[#737373] truncate">{card.sublabel}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Analytics Section Switcher */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-[#E5E7EB] pb-3"
        role="tablist"
        aria-label="Analytics detail views"
      >
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#E5E7EB] bg-white text-[#525252] hover:text-[#171717]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Content */}
      {subTab === 'rsvp' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <HorizontalBarChart
              title="Current RSVPs by Event"
              subtitle="Stated student RSVP intent per published or cancelled event. Click a row to open details."
              items={rsvpByEventBars}
              unitLabel="RSVPs"
              barColor="#E85D04"
              maxItems={8}
            />

            <DonutBreakdownChart
              title="Current RSVPs by Category"
              subtitle="Share of current RSVPs grouped by event category."
              centerLabel="total RSVPs"
              slices={categoryDonutSlices}
              unitLabel="RSVPs"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <HorizontalBarChart
              title="Current RSVPs by Club"
              subtitle="Total current RSVPs grouped by hosting club."
              items={rsvpByClubBars}
              unitLabel="RSVPs"
              barColor="#171717"
              maxItems={8}
            />

            <RsvpDistributionChart buckets={distributionBuckets} />
          </div>

          <EventComparisonPanel
            events={rangedEvents}
            schoolTimezone={schoolConfig.timezone}
            onSelectEvent={onSelectEvent}
          />
        </div>
      )}

      {subTab === 'events' && (
        <EventPerformanceTable
          rows={performanceRows}
          summary={performanceSummary}
          schoolTimezone={schoolConfig.timezone}
          statusFilter={eventStatusFilter}
          categoryFilter={eventCategoryFilter}
          searchQuery={eventSearchQuery}
          sortKey={sortKey}
          sortDir={sortDir}
          onStatusFilterChange={setEventStatusFilter}
          onCategoryFilterChange={setEventCategoryFilter}
          onSearchQueryChange={setEventSearchQuery}
          onToggleSort={handleToggleSort}
          onSelectEvent={onSelectEvent}
        />
      )}

      {subTab === 'clubs' && (
        <ClubComparisonSection
          clubRows={clubRows}
          events={rangedEvents}
          isAdmin={isAdmin}
          onSelectEvent={onSelectEvent}
          onViewClubProfile={onViewClubProfile}
        />
      )}

      {subTab === 'school' && isAdmin && adminAnalytics && (
        <SchoolAdminAnalyticsSection
          adminAnalytics={adminAnalytics}
          schoolName={schoolConfig.name}
          schoolTimezone={schoolConfig.timezone}
          onSelectEvent={onSelectEvent}
          onViewClubProfile={onViewClubProfile}
        />
      )}

      {/* Honest Data Limitations & Future Architecture Note */}
      <section
        aria-labelledby="analytics-limitations-heading"
        className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-[#737373] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3
              id="analytics-limitations-heading"
              className="font-display text-sm font-bold text-[#171717]"
            >
              Measurement Scope &amp; Starter Tier Compatibility
            </h3>
            <p className="mt-0.5 text-xs text-[#737373]">
              OnePlace displays only real, permission-verified Firestore totals and never fabricates attendance, view counts, or historical snapshots. No student attendee emails or UIDs are exposed in analytics or CSV exports.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ANALYTICS_DATA_LIMITATIONS.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 text-xs space-y-1"
            >
              <p className="font-semibold text-[#171717]">{item.metric}</p>
              <p className="text-[#525252]">{item.whyUnavailable}</p>
              <p className="text-[11px] text-[#737373]">
                <span className="font-medium text-[#171717]">Blaze path:</span>{' '}
                {item.requiredInfrastructure}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
