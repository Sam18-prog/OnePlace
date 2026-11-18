import { useState } from 'react';
import { ArrowRight, CalendarDays, Search, SlidersHorizontal, X } from 'lucide-react';
import type { EventCategory, SchoolEvent } from '../types/event';
import { EVENT_CATEGORIES, getCategoryCounts } from '../utils/events';
import { getTimeOfDayGreeting } from '../utils/personalization';
import type { CategoryFilter } from './DiscoveryToolbar';
import { InterestSelector } from './personalization/InterestSelector';

interface HeroSectionProps {
  events: SchoolEvent[];
  displayName?: string | null;
  isSignedIn?: boolean;
  selectedInterests?: EventCategory[];
  onToggleInterest?: (category: EventCategory) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: CategoryFilter;
  onSelectCategoryShortcut: (category: CategoryFilter) => void;
  onExploreCta: () => void;
}

export function HeroSection({
  events,
  displayName,
  isSignedIn = false,
  selectedInterests = [],
  onToggleInterest,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onSelectCategoryShortcut,
  onExploreCta,
}: HeroSectionProps) {
  const [showInterests, setShowInterests] = useState(false);
  const categoryCounts = getCategoryCounts(events);
  const greeting = getTimeOfDayGreeting(new Date(), displayName);

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-7 md:p-8 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-medium text-[#E85D04]">
            {greeting} · OnePlace Campus Feed
          </p>

          <h1 className="mt-2 font-display text-3xl sm:text-4xl md:text-[42px] font-extrabold tracking-tight text-[#171717] leading-[1.1] [text-wrap:balance]">
            Your campus is happening.
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[#737373] leading-relaxed max-w-xl">
            Discover what matters. Stay connected to clubs you care about, and never miss an event.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2 text-xs text-[#737373]">
            <CalendarDays className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
            <span className="font-mono tabular-nums font-semibold text-[#171717]">
              {events.length}
            </span>
            <span>events scheduled</span>
          </div>

          {isSignedIn && onToggleInterest && (
            <button
              type="button"
              onClick={() => setShowInterests((prev) => !prev)}
              aria-expanded={showInterests}
              className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showInterests || selectedInterests.length > 0
                  ? 'border-[#E85D04]/30 bg-[#E85D04]/10 text-[#DC2F02]'
                  : 'border-[#E5E7EB] bg-white text-[#171717] hover:bg-[#F8F9FA]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Interests{selectedInterests.length > 0 ? ` (${selectedInterests.length})` : ''}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onExploreCta}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <span>Explore Events</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isSignedIn && onToggleInterest && showInterests && (
        <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4">
          <InterestSelector
            selectedInterests={selectedInterests}
            onToggleInterest={onToggleInterest}
            compact
            subtitle="Choose optional topics to personalize Recommended for You below."
          />
        </div>
      )}

      {/* Prominent Hero Discovery Search & Category Shortcuts */}
      <div className="mt-6 pt-5 border-t border-[#E5E7EB] flex flex-col gap-3">
        <div className="relative w-full md:max-w-sm">
          <label htmlFor="hero-event-search" className="sr-only">
            Search campus events by title, club, or venue
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]"
            aria-hidden="true"
          />
          <input
            id="hero-event-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search events, clubs, or rooms..."
            className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] pl-10 pr-9 text-sm text-[#171717] placeholder:text-[#737373] transition-colors focus:border-[#E85D04] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear hero search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#737373] hover:bg-[#E5E7EB]/60 hover:text-[#171717] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-0.5"
          role="group"
          aria-label="Category shortcuts"
        >
          <button
            type="button"
            onClick={() => onSelectCategoryShortcut('all')}
            aria-pressed={categoryFilter === 'all'}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
              categoryFilter === 'all'
                ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#DC2F02]'
                : 'border-[#E5E7EB] bg-white text-[#525252] hover:border-[#D1D5DB] hover:text-[#171717]'
            }`}
          >
            <span>All</span>
            <span className="font-mono tabular-nums text-[11px] text-[#737373]">
              {events.length}
            </span>
          </button>

          {EVENT_CATEGORIES.map((cat) => {
            const count = categoryCounts[cat];
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategoryShortcut(cat)}
                aria-pressed={active}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
                  active
                    ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#DC2F02]'
                    : 'border-[#E5E7EB] bg-white text-[#525252] hover:border-[#D1D5DB] hover:text-[#171717]'
                }`}
              >
                <span>{cat}</span>
                <span className="font-mono tabular-nums text-[11px] text-[#737373]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
