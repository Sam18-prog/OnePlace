import type { RefObject } from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import type { EventCategory, TimeframeBucket } from '../types/event';
import { EVENT_CATEGORIES } from '../utils/events';

export type TimeFilter = TimeframeBucket | 'all';
export type CategoryFilter = EventCategory | 'all';

const TIME_FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'all', label: 'All Events' },
  { id: 'today', label: 'Today' },
  { id: 'this-week', label: 'This Week' },
  { id: 'later', label: 'Later' },
];

interface DiscoveryToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  timeFilter: TimeFilter;
  onTimeFilterChange: (value: TimeFilter) => void;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (value: CategoryFilter) => void;
  onClearAll?: () => void;
  showSearchInput?: boolean;
  showCategoryPills?: boolean;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

export function DiscoveryToolbar({
  searchQuery,
  onSearchChange,
  timeFilter,
  onTimeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  onClearAll,
  showSearchInput = true,
  showCategoryPills = true,
  searchInputRef,
}: DiscoveryToolbarProps) {
  const hasActiveFilters =
    Boolean(searchQuery.trim()) || timeFilter !== 'all' || categoryFilter !== 'all';

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {showSearchInput && (
          <div className="relative flex-1">
            <label htmlFor="event-search" className="sr-only">
              Search events by title, host club, or location
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              id="event-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search events, clubs, or rooms..."
              className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-10 text-sm text-[#171717] placeholder:text-[#737373] shadow-xs transition-colors focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div
            className="flex w-fit max-w-full items-center gap-1 rounded-full border border-[#E5E7EB] bg-white p-1 overflow-x-auto shadow-xs"
            role="group"
            aria-label="Filter events by timeframe"
          >
            {TIME_FILTERS.map((tab) => {
              const active = timeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTimeFilterChange(tab.id)}
                  aria-pressed={active}
                  className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
                    active
                      ? 'bg-[#171717] text-white'
                      : 'text-[#737373] hover:text-[#171717] hover:bg-[#F8F9FA]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] hover:border-[#D1D5DB] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>

      {showCategoryPills && (
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter events by category"
        >
          <button
            type="button"
            onClick={() => onCategoryFilterChange('all')}
            aria-pressed={categoryFilter === 'all'}
            className={`min-h-[34px] rounded-full border px-3.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
              categoryFilter === 'all'
                ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#DC2F02]'
                : 'border-[#E5E7EB] bg-white text-[#737373] hover:text-[#171717] hover:border-[#D1D5DB]'
            }`}
          >
            All Categories
          </button>

          {EVENT_CATEGORIES.map((category) => {
            const active = categoryFilter === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onCategoryFilterChange(category)}
                aria-pressed={active}
                className={`min-h-[34px] rounded-full border px-3.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
                  active
                    ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#DC2F02]'
                    : 'border-[#E5E7EB] bg-white text-[#737373] hover:text-[#171717] hover:border-[#D1D5DB]'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
