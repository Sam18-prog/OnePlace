import type { User } from 'firebase/auth';
import { BookmarkCheck, Calendar, Compass } from 'lucide-react';
import type { SchoolEvent } from '../types/event';
import { getDateTileParts, groupEventsByDate, splitMyEvents } from '../utils/events';
import { EventCard } from './EventCard';

interface MyEventsViewProps {
  user: User | null;
  events: SchoolEvent[];
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSelectClubById?: (clubId: string) => void;
  onSignIn: () => void;
  onExplore: () => void;
}

function DateGroupedSchedule({
  events,
  getEffectiveRsvp,
  isSignedIn,
  onRsvpClick,
  onSelectEvent,
  onSelectClubById,
}: {
  events: SchoolEvent[];
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  isSignedIn: boolean;
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSelectClubById?: (clubId: string) => void;
}) {
  const dateGroups = groupEventsByDate(events);
  let cardIndex = 0;

  return (
    <div className="space-y-6">
      {dateGroups.map((group) => {
        const firstDate = group.events[0]?.dateTime;
        const tile = firstDate ? getDateTileParts(firstDate) : null;

        return (
          <div key={group.dateKey} className="space-y-3">
            <div className="flex items-center gap-3">
              {tile && (
                <div
                  className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-white shadow-xs"
                  aria-hidden="true"
                >
                  <span className="font-mono text-[9px] font-bold tracking-wider text-[#E85D04] leading-none">
                    {tile.month}
                  </span>
                  <span className="mt-0.5 font-display text-sm font-extrabold text-[#171717] leading-none">
                    {tile.day}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-display text-sm sm:text-base font-bold text-[#171717]">
                  {group.label}
                </h3>
                <span className="font-mono tabular-nums text-xs text-[#737373]">
                  · {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
                </span>
              </div>
            </div>

            <div className="space-y-3.5">
              {group.events.map((event) => {
                const { rsvpCount, isGoing } = getEffectiveRsvp(event);
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    index={cardIndex++}
                    rsvpCount={rsvpCount}
                    isGoing={isGoing}
                    isSignedIn={isSignedIn}
                    onRsvpClick={onRsvpClick}
                    onSelectEvent={onSelectEvent}
                    onSelectClubById={onSelectClubById}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MyEventsView({
  user,
  events,
  getEffectiveRsvp,
  onRsvpClick,
  onSelectEvent,
  onSelectClubById,
  onSignIn,
  onExplore,
}: MyEventsViewProps) {
  if (!user) {
    return (
      <section className="mx-auto max-w-2xl py-6 sm:py-10">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#E85D04]">
            <BookmarkCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#171717]">
            Your saved campus schedule
          </h1>
          <p className="mt-2 text-sm text-[#737373] max-w-md mx-auto leading-relaxed">
            Sign in with your Google account to track events you're attending and keep your upcoming campus plans organized.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-xl bg-[#E85D04] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
            >
              Sign in with Google
            </button>
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            >
              <Compass className="h-4 w-4 text-[#737373]" aria-hidden="true" />
              <span>Explore Events</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const attendingMap: Record<string, boolean> = {};
  for (const event of events) {
    attendingMap[event.id] = getEffectiveRsvp(event).isGoing;
  }

  const { attending, upcoming, past } = splitMyEvents(events, attendingMap);

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E7EB] pb-6">
        <div>
          <p className="font-mono text-xs font-medium text-[#E85D04]">My Schedule</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
            My RSVPs & Events
          </h1>
          <p className="mt-1 text-sm text-[#737373]">
            Signed in as {user.displayName || user.email}. Manage your campus participation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 shadow-xs">
            <p className="text-[11px] font-medium text-[#737373]">Attending</p>
            <p className="font-mono tabular-nums text-lg font-bold text-[#171717]">
              {attending.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 shadow-xs">
            <p className="text-[11px] font-medium text-[#737373]">Upcoming</p>
            <p className="font-mono tabular-nums text-lg font-bold text-[#171717]">
              {upcoming.length}
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Events I'm Attending */}
      <section aria-labelledby="my-attending-heading">
        <div className="mb-4 flex items-center gap-3">
          <h2
            id="my-attending-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
          >
            Events I'm Attending
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {attending.length} {attending.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {attending.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
            <p className="font-display text-base font-semibold text-[#171717]">
              No RSVPs yet
            </p>
            <p className="mt-1 text-sm text-[#737373]">
              Tap RSVP on any campus event to save it here and reserve your spot.
            </p>
            <button
              type="button"
              onClick={onExplore}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
            >
              Browse upcoming events
            </button>
          </div>
        ) : (
          <DateGroupedSchedule
            events={attending}
            getEffectiveRsvp={getEffectiveRsvp}
            isSignedIn={Boolean(user)}
            onRsvpClick={onRsvpClick}
            onSelectEvent={onSelectEvent}
            onSelectClubById={onSelectClubById}
          />
        )}
      </section>

      {/* Section 2: Upcoming Events */}
      <section aria-labelledby="my-upcoming-heading">
        <div className="mb-4 flex items-center gap-3">
          <h2
            id="my-upcoming-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
          >
            Upcoming Campus Events
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {upcoming.length} {upcoming.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
            <p className="text-sm text-[#737373]">No upcoming events scheduled right now.</p>
          </div>
        ) : (
          <DateGroupedSchedule
            events={upcoming}
            getEffectiveRsvp={getEffectiveRsvp}
            isSignedIn={Boolean(user)}
            onRsvpClick={onRsvpClick}
            onSelectEvent={onSelectEvent}
            onSelectClubById={onSelectClubById}
          />
        )}
      </section>

      {/* Section 3: Past Events */}
      <section aria-labelledby="my-past-heading">
        <div className="mb-4 flex items-center gap-3">
          <h2
            id="my-past-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
          >
            Past Events
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {past.length} {past.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {past.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white px-6 py-5 flex items-center gap-3 text-sm text-[#737373]">
            <Calendar className="h-4 w-4 text-[#737373] shrink-0" aria-hidden="true" />
            <span>You have no past events from this semester yet.</span>
          </div>
        ) : (
          <DateGroupedSchedule
            events={past}
            getEffectiveRsvp={getEffectiveRsvp}
            isSignedIn={Boolean(user)}
            onRsvpClick={onRsvpClick}
            onSelectEvent={onSelectEvent}
            onSelectClubById={onSelectClubById}
          />
        )}
      </section>
    </div>
  );
}
