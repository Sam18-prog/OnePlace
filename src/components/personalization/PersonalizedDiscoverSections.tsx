import { ArrowRight, CalendarDays, Check, MapPin, Sparkles, Users } from 'lucide-react';
import type { SchoolEvent } from '../../types/event';
import type { PersonalizedEventRecommendation } from '../../types/notification';
import { formatEventDateTime, getDateTileParts } from '../../utils/events';

interface PersonalizedDiscoverSectionsProps {
  isSignedIn: boolean;
  recommendations: PersonalizedEventRecommendation[];
  followedClubEvents: SchoolEvent[];
  recentlyAddedEvents: SchoolEvent[];
  followedClubsCount: number;
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSelectClubById: (clubId: string) => void;
  onExploreClubs: () => void;
  onExploreEvents: () => void;
  onOpenInterests: () => void;
}

export function PersonalizedDiscoverSections({
  isSignedIn,
  recommendations,
  followedClubEvents,
  recentlyAddedEvents,
  followedClubsCount,
  getEffectiveRsvp,
  onRsvpClick,
  onSelectEvent,
  onSelectClubById,
  onExploreClubs,
  onExploreEvents,
  onOpenInterests,
}: PersonalizedDiscoverSectionsProps) {
  return (
    <div className="space-y-8">
      {/* 1. Recommended for You */}
      {recommendations.length > 0 && (
        <section aria-labelledby="section-recommended" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h2
                id="section-recommended"
                className="font-display text-base font-bold tracking-tight text-[#171717] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <span>Recommended for You</span>
              </h2>
              <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
            </div>

            {isSignedIn && (
              <button
                type="button"
                onClick={onOpenInterests}
                className="text-xs font-semibold text-[#E85D04] hover:text-[#DC2F02] whitespace-nowrap cursor-pointer"
              >
                Tune interests
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map(({ event, reason }) => {
              const tile = getDateTileParts(event.startAt, event.timezone);
              const { rsvpCount, isGoing } = getEffectiveRsvp(event);
              return (
                <article
                  key={`rec-${event.id}`}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]"
                      aria-hidden="true"
                    >
                      <span className="font-mono text-[10px] font-bold text-[#E85D04] leading-none">
                        {tile.month}
                      </span>
                      <span className="mt-0.5 font-display text-base font-extrabold text-[#171717] leading-none">
                        {tile.day}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-2 py-0.5 text-[11px] font-medium text-[#525252]">
                          {event.category}
                        </span>
                        <span className="text-[11px] font-medium text-[#E85D04] truncate">
                          {reason.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectEvent(event)}
                        className="mt-1.5 block text-left font-display text-base font-bold text-[#171717] hover:text-[#E85D04] transition-colors line-clamp-2 cursor-pointer"
                      >
                        {event.title}
                      </button>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#737373]">
                        <button
                          type="button"
                          onClick={() => onSelectClubById(event.clubId)}
                          className="font-medium text-[#171717] hover:text-[#E85D04] transition-colors cursor-pointer"
                        >
                          {event.hostClub}
                        </button>
                        <span aria-hidden="true">·</span>
                        <span>{formatEventDateTime(event.startAt, new Date(), event.timezone)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 truncate max-w-[170px]">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{event.location}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E5E7EB]">
                    <span className="font-mono tabular-nums text-xs text-[#737373]">
                      {rsvpCount} {rsvpCount === 1 ? 'student going' : 'students going'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectEvent(event)}
                        className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => onRsvpClick(event)}
                        aria-pressed={isGoing}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                          isGoing
                            ? 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                            : 'bg-[#E85D04] text-white hover:bg-[#DC2F02]'
                        }`}
                      >
                        {isGoing && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        <span>{isGoing ? "You're going" : 'RSVP'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. From Clubs You Follow */}
      {isSignedIn && (
        <section aria-labelledby="section-followed-clubs" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h2
                id="section-followed-clubs"
                className="font-display text-base font-bold tracking-tight text-[#171717] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Users className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <span>From Clubs You Follow</span>
              </h2>
              <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
            </div>

            <button
              type="button"
              onClick={onExploreClubs}
              className="text-xs font-semibold text-[#E85D04] hover:text-[#DC2F02] whitespace-nowrap cursor-pointer"
            >
              Manage followed clubs
            </button>
          </div>

          {followedClubsCount === 0 ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <p className="font-display text-sm font-bold text-[#171717]">
                  Follow your favorite campus clubs
                </p>
                <p className="mt-0.5 text-xs text-[#737373]">
                  Events from clubs you follow will appear right here and trigger timely club notifications.
                </p>
              </div>
              <button
                type="button"
                onClick={onExploreClubs}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#E5E7EB]/60 shrink-0 cursor-pointer"
              >
                <span>Browse Clubs</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : followedClubEvents.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <p className="text-xs sm:text-sm text-[#737373]">
                None of your <span className="font-mono font-semibold text-[#171717]">{followedClubsCount}</span>{' '}
                followed {followedClubsCount === 1 ? 'club has' : 'clubs have'} an upcoming published event yet.
              </p>
              <button
                type="button"
                onClick={onExploreEvents}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#E5E7EB]/60 shrink-0 cursor-pointer"
              >
                <span>Explore all events</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {followedClubEvents.slice(0, 3).map((evt) => {
                const tile = getDateTileParts(evt.startAt, evt.timezone);
                return (
                  <button
                    key={`followed-${evt.id}`}
                    type="button"
                    onClick={() => onSelectEvent(evt)}
                    className="group rounded-xl border border-[#E5E7EB] bg-white p-4 text-left shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-start gap-3"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F8F9FA]"
                      aria-hidden="true"
                    >
                      <span className="font-mono text-[9px] font-bold text-[#E85D04] leading-none">
                        {tile.month}
                      </span>
                      <span className="mt-0.5 font-display text-sm font-extrabold text-[#171717] leading-none">
                        {tile.day}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[#E85D04] truncate">
                        {evt.hostClub}
                      </p>
                      <p className="mt-0.5 font-display text-sm font-bold text-[#171717] group-hover:text-[#E85D04] transition-colors truncate">
                        {evt.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[#737373] truncate">
                        {formatEventDateTime(evt.startAt, new Date(), evt.timezone)} · {evt.location}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 3. Recently Added */}
      {recentlyAddedEvents.length > 0 && (
        <section aria-labelledby="section-recently-added" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h2
                id="section-recently-added"
                className="font-display text-base font-bold tracking-tight text-[#171717] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <CalendarDays className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <span>Recently Added</span>
              </h2>
              <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
            </div>

            <button
              type="button"
              onClick={onExploreEvents}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#E85D04] hover:text-[#DC2F02] whitespace-nowrap cursor-pointer"
            >
              <span>Explore more</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentlyAddedEvents.map((evt) => (
              <button
                key={`recent-${evt.id}`}
                type="button"
                onClick={() => onSelectEvent(evt)}
                className="group rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-left shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-[#E85D04]">
                    {evt.category}
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-[#737373] shrink-0">
                    {evt.rsvpCount} going
                  </span>
                </div>
                <p className="mt-1 font-display text-sm font-bold text-[#171717] group-hover:text-[#E85D04] transition-colors truncate">
                  {evt.title}
                </p>
                <p className="mt-0.5 text-xs text-[#737373] truncate">
                  {evt.hostClub}
                </p>
                <p className="mt-1 text-[11px] text-[#525252] truncate">
                  {formatEventDateTime(evt.startAt, new Date(), evt.timezone)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
