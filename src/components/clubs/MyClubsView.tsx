import type { User } from 'firebase/auth';
import { CalendarOff, Compass, Sparkles, Users } from 'lucide-react';
import type { Club, UserFollowedClub } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import { filterAndSortClubs, getSuggestedClubs } from '../../utils/clubValidation';
import { isPastEvent } from '../../utils/eventValidation';
import { EventCard } from '../EventCard';
import { ClubCard } from './ClubCard';

interface MyClubsViewProps {
  user: User | null;
  clubs: Club[];
  events: SchoolEvent[];
  followedClubIds: ReadonlySet<string>;
  followedById: Record<string, UserFollowedClub>;
  upcomingCountsByClub: Record<string, number>;
  getEffectiveFollow: (club: Club) => {
    followerCount: number;
    isFollowing: boolean;
    notificationsEnabled: boolean;
  };
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  onFollowClick: (club: Club) => void;
  onSelectClub: (club: Club) => void;
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSignIn: () => void;
  onBrowseAllClubs: () => void;
}

export function MyClubsView({
  user,
  clubs,
  events,
  followedClubIds,
  upcomingCountsByClub,
  getEffectiveFollow,
  getEffectiveRsvp,
  onFollowClick,
  onSelectClub,
  onRsvpClick,
  onSelectEvent,
  onSignIn,
  onBrowseAllClubs,
}: MyClubsViewProps) {
  if (!user) {
    return (
      <section className="mx-auto max-w-2xl py-6">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#E85D04]">
            <Users className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#171717]">
            Your campus communities
          </h2>
          <p className="mt-2 text-sm text-[#737373] max-w-md mx-auto leading-relaxed">
            Sign in with your Google account to follow student clubs, see upcoming meetings from your organizations, and discover tailored club recommendations.
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
              onClick={onBrowseAllClubs}
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            >
              <Compass className="h-4 w-4 text-[#737373]" aria-hidden="true" />
              <span>Browse All Clubs</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const now = new Date();
  const followedClubs = clubs.filter((club) => followedClubIds.has(club.id));

  const upcomingFromMyClubs = events.filter(
    (evt) =>
      followedClubIds.has(evt.clubId) &&
      evt.status === 'published' &&
      !isPastEvent(evt, now)
  );

  const recentlyActiveClubs = filterAndSortClubs(clubs, {
    sortMode: 'recently-active',
    upcomingCountsByClub,
  }).slice(0, 3);

  const userRsvpsById: Record<string, boolean> = {};
  for (const evt of events) {
    if (getEffectiveRsvp(evt).isGoing) userRsvpsById[evt.id] = true;
  }

  const suggestedClubs = getSuggestedClubs(clubs, followedClubIds, events, userRsvpsById, 3, now);

  return (
    <div className="space-y-10">
      {/* 1. Clubs I'm Following */}
      <section aria-labelledby="my-followed-clubs-heading" className="space-y-4">
        <div className="flex items-center gap-3">
          <h2
            id="my-followed-clubs-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
          >
            Clubs I&apos;m Following
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {followedClubs.length} {followedClubs.length === 1 ? 'club' : 'clubs'}
          </span>
        </div>

        {followedClubs.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
            <p className="font-display text-base font-semibold text-[#171717]">
              You aren&apos;t following any clubs yet
            </p>
            <p className="mt-1 text-sm text-[#737373]">
              Follow clubs across robotics, arts, athletics, and leadership to keep their events in one feed.
            </p>
            <button
              type="button"
              onClick={onBrowseAllClubs}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
            >
              Explore Campus Clubs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {followedClubs.map((club, idx) => {
              const eff = getEffectiveFollow(club);
              return (
                <ClubCard
                  key={club.id}
                  club={club}
                  index={idx}
                  followerCount={eff.followerCount}
                  upcomingEventCount={upcomingCountsByClub[club.id] || 0}
                  isFollowing={eff.isFollowing}
                  isSignedIn={Boolean(user)}
                  onFollowClick={onFollowClick}
                  onSelectClub={onSelectClub}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Upcoming Events from My Clubs */}
      <section aria-labelledby="my-clubs-upcoming-heading" className="space-y-4">
        <div className="flex items-center gap-3">
          <h2
            id="my-clubs-upcoming-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
          >
            Upcoming Events from My Clubs
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {upcomingFromMyClubs.length} {upcomingFromMyClubs.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {upcomingFromMyClubs.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white px-6 py-5 flex items-center gap-3 text-sm text-[#737373]">
            <CalendarOff className="h-4 w-4 text-[#737373] shrink-0" aria-hidden="true" />
            <span>
              {followedClubs.length === 0
                ? 'Follow a club above to see its upcoming schedule here.'
                : 'None of your followed clubs have upcoming published events right now.'}
            </span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {upcomingFromMyClubs.map((evt, idx) => {
              const { rsvpCount, isGoing } = getEffectiveRsvp(evt);
              return (
                <EventCard
                  key={evt.id}
                  event={evt}
                  index={idx}
                  rsvpCount={rsvpCount}
                  isGoing={isGoing}
                  isSignedIn={Boolean(user)}
                  onRsvpClick={onRsvpClick}
                  onSelectEvent={onSelectEvent}
                  onSelectClubById={(clubId) => {
                    const matched = clubs.find((c) => c.id === clubId);
                    if (matched) onSelectClub(matched);
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Suggested Clubs */}
      {suggestedClubs.length > 0 && (
        <section aria-labelledby="suggested-clubs-heading" className="space-y-4">
          <div className="flex items-center gap-3">
            <h2
              id="suggested-clubs-heading"
              className="font-display text-base font-bold tracking-tight text-[#171717] flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
              <span>Suggested Clubs</span>
            </h2>
            <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
            <span className="text-xs text-[#737373] whitespace-nowrap">Based on your campus interests</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {suggestedClubs.map(({ club, reason, upcomingCount }, idx) => {
              const eff = getEffectiveFollow(club);
              return (
                <ClubCard
                  key={club.id}
                  club={club}
                  index={idx}
                  followerCount={eff.followerCount}
                  upcomingEventCount={upcomingCount}
                  isFollowing={eff.isFollowing}
                  isSignedIn={Boolean(user)}
                  onFollowClick={onFollowClick}
                  onSelectClub={onSelectClub}
                  reasonTag={reason}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Recently Active Clubs */}
      {recentlyActiveClubs.length > 0 && (
        <section aria-labelledby="recently-active-clubs-heading" className="space-y-4">
          <div className="flex items-center gap-3">
            <h2
              id="recently-active-clubs-heading"
              className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
            >
              Recently Active Clubs
            </h2>
            <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
            <button
              type="button"
              onClick={onBrowseAllClubs}
              className="text-xs font-semibold text-[#E85D04] hover:text-[#DC2F02] cursor-pointer whitespace-nowrap"
            >
              See all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentlyActiveClubs.map((club, idx) => {
              const eff = getEffectiveFollow(club);
              return (
                <ClubCard
                  key={club.id}
                  club={club}
                  index={idx}
                  followerCount={eff.followerCount}
                  upcomingEventCount={upcomingCountsByClub[club.id] || 0}
                  isFollowing={eff.isFollowing}
                  isSignedIn={Boolean(user)}
                  onFollowClick={onFollowClick}
                  onSelectClub={onSelectClub}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
