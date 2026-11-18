import { useMemo, useState } from 'react';
import { CalendarOff, Plus, Search, X } from 'lucide-react';
import type { SchoolEvent } from '../../types/event';
import { isPastEvent } from '../../utils/eventValidation';
import { EventManagementCard } from './EventManagementCard';

export type ManagedEventFilter = 'all' | 'published' | 'draft' | 'cancelled' | 'past';

interface OrganizerEventListProps {
  events: SchoolEvent[];
  schoolTimezone: string;
  busyEventId: string | null;
  isAdmin: boolean;
  onCreateEvent: () => void;
  onView: (event: SchoolEvent) => void;
  onEdit: (event: SchoolEvent) => void;
  onPublish: (event: SchoolEvent) => void;
  onRequestCancel: (event: SchoolEvent) => void;
}

export function OrganizerEventList({
  events,
  schoolTimezone,
  busyEventId,
  isAdmin,
  onCreateEvent,
  onView,
  onEdit,
  onPublish,
  onRequestCancel,
}: OrganizerEventListProps) {
  const [filter, setFilter] = useState<ManagedEventFilter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const now = new Date();
    return {
      all: events.length,
      published: events.filter((e) => e.status === 'published').length,
      draft: events.filter((e) => e.status === 'draft').length,
      cancelled: events.filter((e) => e.status === 'cancelled').length,
      past: events.filter((e) => isPastEvent(e, now)).length,
    };
  }, [events]);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const q = query.trim().toLowerCase();
    return events.filter((evt) => {
      if (filter === 'published' && evt.status !== 'published') return false;
      if (filter === 'draft' && evt.status !== 'draft') return false;
      if (filter === 'cancelled' && evt.status !== 'cancelled') return false;
      if (filter === 'past' && !isPastEvent(evt, now)) return false;

      if (!q) return true;
      return (
        evt.title.toLowerCase().includes(q) ||
        evt.hostClub.toLowerCase().includes(q) ||
        evt.location.toLowerCase().includes(q)
      );
    });
  }, [events, filter, query]);

  const tabs: { id: ManagedEventFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'published', label: 'Published', count: counts.published },
    { id: 'draft', label: 'Drafts', count: counts.draft },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { id: 'past', label: 'Past', count: counts.past },
  ];

  return (
    <section aria-labelledby="organizer-events-heading" className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2
            id="organizer-events-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717]"
          >
            {isAdmin ? 'School Events Directory' : 'My Events'}
          </h2>
          <p className="text-xs text-[#737373]">
            {isAdmin
              ? 'View and manage events across all student clubs in this school.'
              : 'Create drafts, publish upcoming events, edit details, or cancel scheduled sessions.'}
          </p>
        </div>

        <div className="relative md:w-72">
          <label htmlFor="managed-events-search" className="sr-only">
            Filter managed events
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]"
            aria-hidden="true"
          />
          <input
            id="managed-events-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, club, or room..."
            className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-8 text-xs sm:text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear filter"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter managed events by status"
      >
        {tabs.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              aria-pressed={active}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#E5E7EB] bg-white text-[#737373] hover:text-[#171717]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  active ? 'text-white/80' : 'text-[#737373]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
            <CalendarOff className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="font-display text-base font-semibold text-[#171717]">
            {events.length === 0 ? 'No events created yet' : 'No matching events'}
          </p>
          <p className="mt-1 text-sm text-[#737373]">
            {events.length === 0
              ? 'Create your first campus event draft or publish directly to students.'
              : 'Try switching status tabs or clearing your search query.'}
          </p>
          {events.length === 0 && (
            <button
              type="button"
              onClick={onCreateEvent}
              className="mt-5 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Create Event</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredEvents.map((event) => (
            <EventManagementCard
              key={event.id}
              event={event}
              schoolTimezone={schoolTimezone}
              isBusy={busyEventId === event.id}
              onView={onView}
              onEdit={onEdit}
              onPublish={onPublish}
              onRequestCancel={onRequestCancel}
            />
          ))}
        </div>
      )}
    </section>
  );
}
