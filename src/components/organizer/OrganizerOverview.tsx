import { ArrowUpRight, BarChart3, CalendarCheck, Compass, Plus } from 'lucide-react';
import type { SchoolEvent } from '../../types/event';
import { computeOrganizerKpis } from '../../utils/analytics';

interface OrganizerOverviewProps {
  events: SchoolEvent[];
  onCreateEvent: () => void;
  onFocusManageEvents: () => void;
  onViewPublishedEvents: () => void;
  onOpenAnalytics?: () => void;
}

export function OrganizerOverview({
  events,
  onCreateEvent,
  onFocusManageEvents,
  onViewPublishedEvents,
  onOpenAnalytics,
}: OrganizerOverviewProps) {
  const kpis = computeOrganizerKpis(events, new Date());

  const metrics = [
    { label: 'Total Created', value: kpis.totalCreated, tone: 'text-[#171717]' },
    { label: 'Published', value: kpis.published, tone: 'text-[#16A34A]' },
    { label: 'Drafts', value: kpis.draft, tone: 'text-[#D97706]' },
    { label: 'Cancelled', value: kpis.cancelled, tone: 'text-[#DC2626]' },
    { label: 'Upcoming Live', value: kpis.upcoming, tone: 'text-[#2563EB]' },
    { label: 'Current RSVPs', value: kpis.totalCurrentRsvps, tone: 'text-[#E85D04]' },
  ];

  return (
    <section aria-labelledby="organizer-overview-heading" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2
          id="organizer-overview-heading"
          className="font-display text-base font-bold tracking-tight text-[#171717]"
        >
          Overview &amp; Quick Actions
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCreateEvent}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Event</span>
          </button>

          <button
            type="button"
            onClick={onFocusManageEvents}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <CalendarCheck className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
            <span>My Events</span>
          </button>

          {onOpenAnalytics && (
            <button
              type="button"
              onClick={onOpenAnalytics}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
            >
              <BarChart3 className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
              <span>Analytics</span>
            </button>
          )}

          <button
            type="button"
            onClick={onViewPublishedEvents}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <Compass className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
            <span>View Published Events</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-[#E5E7EB] bg-white p-4"
          >
            <p className="text-xs font-medium text-[#737373]">{metric.label}</p>
            <p className={`mt-1.5 font-mono tabular-nums text-2xl font-bold ${metric.tone}`}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
