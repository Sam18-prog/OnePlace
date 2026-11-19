import { ArrowUpRight, Users } from 'lucide-react';
import type { ClubEngagementRow } from '../../types/analytics';
import type { Club } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import { HorizontalBarChart } from './AnalyticsCharts';

interface ClubComparisonSectionProps {
  clubRows: ClubEngagementRow[];
  events: SchoolEvent[];
  isAdmin: boolean;
  onSelectEvent: (event: SchoolEvent) => void;
  onViewClubProfile: (club: Club) => void;
}

export function ClubComparisonSection({
  clubRows,
  events,
  isAdmin,
  onSelectEvent,
  onViewClubProfile,
}: ClubComparisonSectionProps) {
  const eventById = new Map(events.map((e) => [e.id, e]));

  const rsvpsByClubData = [...clubRows]
    .sort((a, b) => b.totalRsvps - a.totalRsvps)
    .map((row) => ({
      id: row.club.id,
      label: row.club.name,
      sublabel: `${row.club.category} · ${row.followerCount} followers`,
      value: row.totalRsvps,
      secondaryValue: `${row.publishedCount} published`,
      onClick: () => onViewClubProfile(row.club),
    }));

  const publishedByClubData = [...clubRows]
    .sort((a, b) => b.publishedCount - a.publishedCount)
    .map((row) => ({
      id: row.club.id,
      label: row.club.name,
      sublabel: row.club.category,
      value: row.publishedCount,
      secondaryValue: `${row.upcomingCount} upcoming`,
      onClick: () => onViewClubProfile(row.club),
    }));

  if (clubRows.length === 0) {
    return (
      <section aria-labelledby="club-analytics-heading">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2
            id="club-analytics-heading"
            className="font-display text-base font-bold text-[#171717]"
          >
            No Authorized Clubs in Scope
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#737373] max-w-md mx-auto">
            {isAdmin
              ? 'No clubs are registered for this school yet.'
              : 'You are not currently assigned as an active organizer for any campus club.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="club-analytics-heading" className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <HorizontalBarChart
          title="Club Engagement by Current RSVPs"
          subtitle="Cumulative current RSVPs across events hosted by each authorized club."
          items={rsvpsByClubData}
          unitLabel="RSVPs"
          barColor="#E85D04"
          maxItems={8}
        />

        <HorizontalBarChart
          title="Publishing Activity by Club"
          subtitle="Number of published events per club in the selected date window."
          items={publishedByClubData}
          unitLabel="published"
          barColor="#171717"
          maxItems={8}
        />
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2
              id="club-analytics-heading"
              className="font-display text-lg font-bold tracking-tight text-[#171717]"
            >
              Club Engagement Comparison
            </h2>
            <p className="mt-0.5 text-xs text-[#737373]">
              Current follower counts reflect trusted Firestore totals; historical follower growth time series require scheduled Blaze snapshots.
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs font-medium text-[#737373] shrink-0">
            {clubRows.length} {clubRows.length === 1 ? 'club' : 'clubs'}
          </span>
        </div>

        <div className="overflow-x-auto -mx-5 sm:mx-0">
          <div className="inline-block min-w-full align-middle px-5 sm:px-0">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  <th scope="col" className="py-3 pr-4">
                    Club
                  </th>
                  <th scope="col" className="py-3 px-3">
                    Status
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Current Followers
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Published
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Upcoming
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Total RSVPs
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Avg / Published
                  </th>
                  <th scope="col" className="py-3 pl-3">
                    Most Popular Event
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] text-xs">
                {clubRows.map((row) => {
                  const popularFullEvent = row.mostPopularEvent
                    ? eventById.get(row.mostPopularEvent.id)
                    : undefined;

                  return (
                    <tr key={row.club.id} className="hover:bg-[#F8F9FA]/80 transition-colors">
                      <td className="py-3 pr-4 max-w-[220px]">
                        <button
                          type="button"
                          onClick={() => onViewClubProfile(row.club)}
                          className="inline-flex items-center gap-1 font-semibold text-[#171717] hover:text-[#E85D04] text-left cursor-pointer"
                        >
                          <span className="truncate">{row.club.name}</span>
                          <ArrowUpRight className="h-3 w-3 shrink-0 text-[#737373]" aria-hidden="true" />
                        </button>
                        <span className="text-[11px] text-[#737373] truncate block">
                          {row.club.category}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-3 font-semibold capitalize whitespace-nowrap ${
                          row.club.status === 'active' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {row.club.status}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-right text-[#171717] whitespace-nowrap">
                        {row.followerCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-right text-[#171717] whitespace-nowrap">
                        {row.publishedCount}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-right text-[#525252] whitespace-nowrap">
                        {row.upcomingCount}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-right font-bold text-[#171717] whitespace-nowrap">
                        {row.totalRsvps.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono tabular-nums text-right text-[#E85D04] font-semibold whitespace-nowrap">
                        {row.avgRsvpsPerPublished}
                      </td>
                      <td className="py-3 pl-3 max-w-[220px]">
                        {row.mostPopularEvent ? (
                          popularFullEvent ? (
                            <button
                              type="button"
                              onClick={() => onSelectEvent(popularFullEvent)}
                              className="text-left group cursor-pointer max-w-full"
                            >
                              <span className="font-medium text-[#171717] group-hover:text-[#E85D04] truncate block">
                                {row.mostPopularEvent.title}
                              </span>
                              <span className="font-mono tabular-nums text-[11px] text-[#737373]">
                                {row.mostPopularEvent.rsvpCount} RSVPs
                              </span>
                            </button>
                          ) : (
                            <div>
                              <span className="font-medium text-[#171717] truncate block">
                                {row.mostPopularEvent.title}
                              </span>
                              <span className="font-mono tabular-nums text-[11px] text-[#737373]">
                                {row.mostPopularEvent.rsvpCount} RSVPs
                              </span>
                            </div>
                          )
                        ) : (
                          <span className="text-[11px] text-[#737373]">No published events</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
