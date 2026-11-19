import { Building2 } from 'lucide-react';
import type { SchoolAdminAnalytics } from '../../types/analytics';
import type { Club } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import { formatDateInTimezone } from '../../utils/eventValidation';
import {
  categoryBreakdownToDonutSlices,
  DonutBreakdownChart,
  HorizontalBarChart,
  MonthlyScheduleChart,
} from './AnalyticsCharts';

interface SchoolAdminAnalyticsSectionProps {
  adminAnalytics: SchoolAdminAnalytics;
  schoolName: string;
  schoolTimezone: string;
  onSelectEvent: (event: SchoolEvent) => void;
  onViewClubProfile: (club: Club) => void;
}

export function SchoolAdminAnalyticsSection({
  adminAnalytics,
  schoolName,
  schoolTimezone,
  onSelectEvent,
  onViewClubProfile,
}: SchoolAdminAnalyticsSectionProps) {
  const overviewStats = [
    { label: 'Total Clubs', value: adminAnalytics.totalClubs, tone: 'text-[#171717]' },
    { label: 'Active Clubs', value: adminAnalytics.activeClubs, tone: 'text-[#16A34A]' },
    { label: 'Suspended Clubs', value: adminAnalytics.suspendedClubs, tone: 'text-[#DC2626]' },
    { label: 'Total Events', value: adminAnalytics.kpis.totalCreated, tone: 'text-[#171717]' },
    { label: 'Published', value: adminAnalytics.kpis.published, tone: 'text-[#16A34A]' },
    { label: 'Upcoming', value: adminAnalytics.kpis.upcoming, tone: 'text-[#2563EB]' },
    { label: 'Cancelled', value: adminAnalytics.kpis.cancelled, tone: 'text-[#DC2626]' },
    {
      label: 'Total Current RSVPs',
      value: adminAnalytics.kpis.totalCurrentRsvps,
      tone: 'text-[#E85D04]',
    },
  ];

  const statusSlices = [
    { id: 'published', label: 'Published', value: adminAnalytics.statusCounts.published },
    { id: 'draft', label: 'Draft', value: adminAnalytics.statusCounts.draft },
    { id: 'cancelled', label: 'Cancelled', value: adminAnalytics.statusCounts.cancelled },
  ];

  const categorySlices = categoryBreakdownToDonutSlices(adminAnalytics.categoryBreakdown);

  const mostActiveClubItems = adminAnalytics.mostActiveClubsByPublished.map((row) => ({
    id: row.club.id,
    label: row.club.name,
    sublabel: row.club.category,
    value: row.publishedCount,
    secondaryValue: `${row.totalRsvps} RSVPs`,
    onClick: () => onViewClubProfile(row.club),
  }));

  const mostEngagedClubItems = adminAnalytics.mostEngagedClubsByRsvps.map((row) => ({
    id: row.club.id,
    label: row.club.name,
    sublabel: `${row.followerCount} followers · ${row.publishedCount} published`,
    value: row.totalRsvps,
    secondaryValue: `${row.avgRsvpsPerPublished} avg`,
    onClick: () => onViewClubProfile(row.club),
  }));

  const upcomingClubItems = adminAnalytics.upcomingEventsByClub.map((row) => ({
    id: row.club.id,
    label: row.club.name,
    sublabel: row.club.category,
    value: row.upcomingCount,
    secondaryValue: `${row.followerCount} followers`,
    onClick: () => onViewClubProfile(row.club),
  }));

  const clubCategoryItems = adminAnalytics.clubCategoryDistribution.map((item) => ({
    id: item.category,
    label: item.category,
    sublabel: `${item.activeCount} active · ${item.totalFollowers.toLocaleString()} followers`,
    value: item.clubCount,
  }));

  const topEventItems = adminAnalytics.topEvents.map((evt) => ({
    id: evt.id,
    label: evt.title,
    sublabel: `${evt.hostClub} · ${formatDateInTimezone(evt.startAt, schoolTimezone).date}`,
    value: evt.rsvpCount,
    secondaryValue: evt.category,
    onClick: () => onSelectEvent(evt),
  }));

  return (
    <section aria-labelledby="school-admin-analytics-heading" className="space-y-6">
      {/* Campus Overview */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#E85D04]">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              <span>School Administrator Scope</span>
            </div>
            <h2
              id="school-admin-analytics-heading"
              className="mt-1 font-display text-lg font-bold tracking-tight text-[#171717]"
            >
              {schoolName} — Campus Activity Overview
            </h2>
            <p className="mt-0.5 text-xs text-[#737373]">
              Aggregated strictly across clubs and events belonging to{' '}
              <code className="font-mono text-[#171717]">{adminAnalytics.schoolId}</code>.
            </p>
          </div>
          <span className="font-mono text-xs text-[#737373] shrink-0">
            Avg RSVPs / published:{' '}
            <strong className="text-[#171717]">{adminAnalytics.kpis.avgRsvpsPerPublished}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]">
          {overviewStats.slice(0, 4).map((stat) => (
            <div key={stat.label} className="p-4">
              <p className="text-[11px] font-medium text-[#737373]">{stat.label}</p>
              <p className={`mt-1 font-mono tabular-nums text-2xl font-bold ${stat.tone}`}>
                {stat.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]">
          {overviewStats.slice(4, 8).map((stat) => (
            <div key={stat.label} className="p-4">
              <p className="text-[11px] font-medium text-[#737373]">{stat.label}</p>
              <p className={`mt-1 font-mono tabular-nums text-2xl font-bold ${stat.tone}`}>
                {stat.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Club Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <HorizontalBarChart
          title="Most Active Clubs (Published Events)"
          subtitle="Clubs ranked by published events in the selected period."
          items={mostActiveClubItems}
          unitLabel="published"
          barColor="#171717"
          maxItems={8}
        />

        <HorizontalBarChart
          title="Most Engaged Clubs (Current RSVPs)"
          subtitle="Clubs ranked by cumulative current student RSVPs."
          items={mostEngagedClubItems}
          unitLabel="RSVPs"
          barColor="#E85D04"
          maxItems={8}
        />

        <HorizontalBarChart
          title="Club Category Distribution"
          subtitle="Registered campus clubs grouped by official directory category."
          items={clubCategoryItems}
          unitLabel="clubs"
          barColor="#2563EB"
          maxItems={9}
        />

        <HorizontalBarChart
          title="Upcoming Published Events by Club"
          subtitle="Clubs with scheduled upcoming sessions."
          items={upcomingClubItems}
          unitLabel="upcoming"
          barColor="#16A34A"
          maxItems={8}
          emptyTitle="No upcoming club events"
          emptyMessage="Published events scheduled after today will appear here."
        />
      </div>

      {/* Event Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DonutBreakdownChart
          title="School Events by Status"
          subtitle="Distribution of published, draft, and cancelled records."
          centerLabel="total events"
          slices={statusSlices}
          unitLabel="events"
        />

        <DonutBreakdownChart
          title="Campus RSVPs by Event Category"
          subtitle="Share of current student RSVPs across event categories."
          centerLabel="total RSVPs"
          slices={categorySlices}
          unitLabel="RSVPs"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MonthlyScheduleChart points={adminAnalytics.monthlyActivity} />

        <HorizontalBarChart
          title="Top Popular Published Events"
          subtitle="Highest current RSVP counts across the school."
          items={topEventItems}
          unitLabel="RSVPs"
          barColor="#E85D04"
          maxItems={8}
        />
      </div>
    </section>
  );
}
