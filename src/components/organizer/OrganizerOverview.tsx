import { ArrowUpRight, CalendarCheck, Compass, Plus } from 'lucide-react';
import type { SchoolEvent } from '../../types/event';
import { isPastEvent } from '../../utils/eventValidation';

interface OrganizerOverviewProps {
  events: SchoolEvent[];
  onCreateEvent: () => void;
  onFocusManageEvents: () => void;
  onViewPublishedEvents: () => void;
}

export function OrganizerOverview({
  events,
  onCreateEvent,
  onFocusManageEvents,
  onViewPublishedEvents,
}: OrganizerOverviewProps) {
  const now = new Date();
  const totalCreated = events.length;
  const publishedCount = events.filter((e) => e.status === 'published').length;
  const draftCount = events.filter((e) => e.status === 'draft').length;
  const cancelledCount = events.filter((e) => e.status === 'cancelled').length;
  const upcomingCount = events.filter(
    (e) => e.status === 'published' && !isPastEvent(e, now)
  ).length;
  const totalRsvps = events.reduce((acc, e) => acc + e.rsvpCount, 0);

  const metrics = [
    { label: 'Total Created', value: totalCreated, tone: 'text-[#171717]' },
    { label: 'Published', value: publishedCount, tone: 'text-[#16A34A]' },
    { label: 'Drafts', value: draftCount, tone: 'text-[#D97706]' },
    { label: 'Cancelled', value: cancelledCount, tone: 'text-[#DC2626]' },
    { label: 'Upcoming Live', value: upcomingCount, tone: 'text-[#171717]' },
    { label: 'Total RSVPs', value: totalRsvps, tone: 'text-[#E85D04]' },
  ];

  return (
    <section aria-labelledby="organizer-overview-heading" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2
          id="organizer-overview-heading"
          className="font-display text-base font-bold tracking-tight text-[#171717]"
        >
          Overview & Quick Actions
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
            <span>Manage Events</span>
          </button>

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
            className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xs"
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
