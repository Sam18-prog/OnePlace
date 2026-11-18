import { CalendarCheck2, RotateCcw, Search, X } from 'lucide-react';
import type { ClubCategory, ClubSortMode } from '../../types/club';
import { ALL_CLUB_CATEGORIES } from '../../utils/clubValidation';

export type ClubCategoryFilterValue = ClubCategory | 'all';

interface ClubCategoryFilterProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: ClubCategoryFilterValue;
  onCategoryFilterChange: (value: ClubCategoryFilterValue) => void;
  sortMode: ClubSortMode;
  onSortModeChange: (value: ClubSortMode) => void;
  onlyWithUpcoming: boolean;
  onOnlyWithUpcomingChange: (value: boolean) => void;
  categoryCounts: Record<ClubCategory, number>;
  totalActiveClubs: number;
  onClearAll: () => void;
}

const SORT_OPTIONS: { id: ClubSortMode; label: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'recently-active', label: 'Recently Active' },
  { id: 'alphabetical', label: 'A–Z' },
];

export function ClubCategoryFilter({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  sortMode,
  onSortModeChange,
  onlyWithUpcoming,
  onOnlyWithUpcomingChange,
  categoryCounts,
  totalActiveClubs,
  onClearAll,
}: ClubCategoryFilterProps) {
  const hasFilters =
    Boolean(searchQuery.trim()) || categoryFilter !== 'all' || onlyWithUpcoming;

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <label htmlFor="club-directory-search" className="sr-only">
            Search clubs by name, topic, or meeting room
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]"
            aria-hidden="true"
          />
          <input
            id="club-directory-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search clubs, interests, or rooms..."
            className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-10 text-sm text-[#171717] placeholder:text-[#737373] shadow-xs transition-colors focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear club search"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex w-fit items-center gap-1 rounded-full border border-[#E5E7EB] bg-white p-1 shadow-xs"
            role="group"
            aria-label="Sort clubs"
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sortMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSortModeChange(opt.id)}
                  aria-pressed={active}
                  className={`min-h-[34px] rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#171717] text-white'
                      : 'text-[#737373] hover:text-[#171717] hover:bg-[#F8F9FA]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onOnlyWithUpcomingChange(!onlyWithUpcoming)}
            aria-pressed={onlyWithUpcoming}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              onlyWithUpcoming
                ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#DC2F02]'
                : 'border-[#E5E7EB] bg-white text-[#737373] hover:text-[#171717]'
            }`}
          >
            <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upcoming events</span>
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-2 overflow-x-auto md:overflow-visible md:flex-wrap pb-1"
        role="group"
        aria-label="Filter clubs by category"
      >
        <button
          type="button"
          onClick={() => onCategoryFilterChange('all')}
          aria-pressed={categoryFilter === 'all'}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            categoryFilter === 'all'
              ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#DC2F02]'
              : 'border-[#E5E7EB] bg-white text-[#737373] hover:text-[#171717] hover:border-[#D1D5DB]'
          }`}
        >
          <span>All Clubs</span>
          <span className="font-mono tabular-nums text-[11px] opacity-75">{totalActiveClubs}</span>
        </button>

        {ALL_CLUB_CATEGORIES.map((category) => {
          const count = categoryCounts[category] || 0;
          const active = categoryFilter === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryFilterChange(category)}
              aria-pressed={active}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#DC2F02]'
                  : 'border-[#E5E7EB] bg-white text-[#737373] hover:text-[#171717] hover:border-[#D1D5DB]'
              }`}
            >
              <span>{category}</span>
              {count > 0 && (
                <span className="font-mono tabular-nums text-[11px] opacity-75">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
