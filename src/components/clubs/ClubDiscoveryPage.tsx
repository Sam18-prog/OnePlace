import { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { Sparkles, Users } from 'lucide-react';
import type { Club, ClubSortMode, UserFollowedClub } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import {
  countUpcomingClubEvents,
  filterAndSortClubs,
  getClubCategoryCounts,
} from '../../utils/clubValidation';
import { ClubCard } from './ClubCard';
import { ClubCategoryFilter, type ClubCategoryFilterValue } from './ClubCategoryFilter';
import { MyClubsView } from './MyClubsView';

interface ClubDiscoveryPageProps {
  user: User | null;
  schoolName: string;
  clubs: Club[];
  events: SchoolEvent[];
  followedClubIds: ReadonlySet<string>;
  followedById: Record<string, UserFollowedClub>;
  clubsLoading: boolean;
  clubsError: string | null;
  hasMoreClubs: boolean;
  canAccessOrganizer: boolean;
  getEffectiveFollow: (club: Club) => {
    followerCount: number;
    isFollowing: boolean;
    notificationsEnabled: boolean;
  };
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  onFollowClick: (club: Club) => void;
  onSelectClub: (club: Club) => void;
  onLoadMoreClubs: () => void;
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSignIn: () => void;
  onOpenOrganizer?: () => void;
}

export function ClubDiscoveryPage({
  user,
  schoolName,
  clubs,
  events,
  followedClubIds,
  followedById,
  clubsLoading,
  clubsError,
  hasMoreClubs,
  canAccessOrganizer,
  getEffectiveFollow,
  getEffectiveRsvp,
  onFollowClick,
  onSelectClub,
  onLoadMoreClubs,
  onRsvpClick,
  onSelectEvent,
  onSignIn,
  onOpenOrganizer,
}: ClubDiscoveryPageProps) {
  const [directoryTab, setDirectoryTab] = useState<'all' | 'my-clubs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ClubCategoryFilterValue>('all');
  const [sortMode, setSortMode] = useState<ClubSortMode>('popular');
  const [onlyWithUpcoming, setOnlyWithUpcoming] = useState(false);

  const upcomingCountsByClub = useMemo(() => countUpcomingClubEvents(events), [events]);
  const categoryCounts = useMemo(() => getClubCategoryCounts(clubs), [clubs]);

  const filteredClubs = useMemo(
    () =>
      filterAndSortClubs(clubs, {
        searchQuery,
        categoryFilter,
        sortMode,
        onlyWithUpcomingEvents: onlyWithUpcoming,
        upcomingCountsByClub,
      }),
    [clubs, searchQuery, categoryFilter, sortMode, onlyWithUpcoming, upcomingCountsByClub]
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setOnlyWithUpcoming(false);
  };

  return (
    <div className="space-y-7">
      {/* Header + All Clubs / My Clubs Segmented Switch */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <p className="font-mono text-xs font-medium text-[#E85D04]">Campus Communities</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
            Clubs at {schoolName}
          </h1>
          <p className="mt-1 text-sm text-[#737373]">
            Discover student organizations, follow the communities you care about, and track their upcoming schedules.
          </p>
        </div>

        <div
          className="flex w-fit items-center gap-1 rounded-full border border-[#E5E7EB] bg-white p-1 shadow-xs shrink-0"
          role="tablist"
          aria-label="Club directory views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={directoryTab === 'all'}
            onClick={() => setDirectoryTab('all')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              directoryTab === 'all'
                ? 'bg-[#171717] text-white'
                : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>All Clubs</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={directoryTab === 'my-clubs'}
            onClick={() => setDirectoryTab('my-clubs')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              directoryTab === 'my-clubs'
                ? 'bg-[#171717] text-white'
                : 'text-[#737373] hover:text-[#171717]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>My Clubs</span>
            {user && followedClubIds.size > 0 && (
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  directoryTab === 'my-clubs' ? 'text-white/80' : 'text-[#E85D04]'
                }`}
              >
                {followedClubIds.size}
              </span>
            )}
          </button>
        </div>
      </section>

      {directoryTab === 'my-clubs' ? (
        <MyClubsView
          user={user}
          clubs={clubs}
          events={events}
          followedClubIds={followedClubIds}
          followedById={followedById}
          upcomingCountsByClub={upcomingCountsByClub}
          getEffectiveFollow={getEffectiveFollow}
          getEffectiveRsvp={getEffectiveRsvp}
          onFollowClick={onFollowClick}
          onSelectClub={onSelectClub}
          onRsvpClick={onRsvpClick}
          onSelectEvent={onSelectEvent}
          onSignIn={onSignIn}
          onBrowseAllClubs={() => setDirectoryTab('all')}
        />
      ) : (
        <>
          <ClubCategoryFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            onlyWithUpcoming={onlyWithUpcoming}
            onOnlyWithUpcomingChange={setOnlyWithUpcoming}
            categoryCounts={categoryCounts}
            totalActiveClubs={clubs.length}
            onClearAll={handleClearFilters}
          />

          {clubsError ? (
            <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
              <p className="font-display text-base font-bold text-[#171717]">
                Couldn&apos;t load campus clubs
              </p>
              <p className="mt-1 text-sm text-[#737373]">{clubsError}</p>
            </div>
          ) : clubsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white animate-pulse"
                >
                  <div className="aspect-[16/9] bg-[#E5E7EB]/70" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-24 rounded bg-[#E5E7EB]" />
                    <div className="h-5 w-44 rounded bg-[#E5E7EB]" />
                    <div className="h-4 w-full rounded bg-[#E5E7EB]/80" />
                    <div className="h-9 w-full rounded-xl bg-[#E5E7EB]/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-xs">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="font-display text-base font-semibold text-[#171717]">
                {clubs.length === 0 ? 'No active clubs published yet' : 'No matching clubs found'}
              </p>
              <p className="mt-1 text-sm text-[#737373] max-w-md mx-auto">
                {clubs.length === 0
                  ? canAccessOrganizer
                    ? 'Open Organizer Studio to create campus clubs or seed clubs from existing events.'
                    : 'Campus clubs will appear here once approved and published by your school administration.'
                  : 'Try clearing your search term or switching category and event filters.'}
              </p>

              {clubs.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                >
                  Reset club filters
                </button>
              ) : (
                canAccessOrganizer &&
                onOpenOrganizer && (
                  <button
                    type="button"
                    onClick={onOpenOrganizer}
                    className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC2F02] cursor-pointer"
                  >
                    Manage Clubs in Studio
                  </button>
                )
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredClubs.map((club, idx) => {
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

              {hasMoreClubs && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={onLoadMoreClubs}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-5 py-2 text-xs sm:text-sm font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                  >
                    Load more clubs
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
