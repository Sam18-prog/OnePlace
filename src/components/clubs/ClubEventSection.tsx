import { ArrowRight, CalendarOff } from 'lucide-react';
import type { SchoolEvent } from '../../types/event';
import { EventCard } from '../EventCard';

interface ClubEventSectionProps {
  title: string;
  events: SchoolEvent[];
  emptyMessage: string;
  isSignedIn: boolean;
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onExploreAllClubEvents?: () => void;
}

export function ClubEventSection({
  title,
  events,
  emptyMessage,
  isSignedIn,
  getEffectiveRsvp,
  onRsvpClick,
  onSelectEvent,
  onExploreAllClubEvents,
}: ClubEventSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h2 className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap">
            {title}
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {onExploreAllClubEvents && events.length > 0 && (
          <button
            type="button"
            onClick={onExploreAllClubEvents}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#E85D04] hover:text-[#DC2F02] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Explore all club events</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 flex items-center gap-3 text-sm text-[#737373]">
          <CalendarOff className="h-4 w-4 text-[#737373] shrink-0" aria-hidden="true" />
          <span>{emptyMessage}</span>
        </div>
      ) : (
        <div className="space-y-3.5">
          {events.map((event, idx) => {
            const { rsvpCount, isGoing } = getEffectiveRsvp(event);
            return (
              <EventCard
                key={event.id}
                event={event}
                index={idx}
                rsvpCount={rsvpCount}
                isGoing={isGoing}
                isSignedIn={isSignedIn}
                onRsvpClick={onRsvpClick}
                onSelectEvent={onSelectEvent}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
