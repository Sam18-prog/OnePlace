import { useMemo, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, Search, X } from 'lucide-react';
import type {
  EventAnalyticsFilterStatus,
  EventAnalyticsSortKey,
  EventPerformanceRow,
  EventPerformanceSummary,
  SortDirection,
} from '../../types/analytics';
import type { SchoolEvent } from '../../types/event';
import { ALL_EVENT_CATEGORIES, formatDateInTimezone } from '../../utils/eventValidation';

interface EventPerformanceTableProps {
  rows: EventPerformanceRow[];
  summary: EventPerformanceSummary;
  schoolTimezone: string;
  statusFilter: EventAnalyticsFilterStatus;
  categoryFilter: string;
  searchQuery: string;
  sortKey: EventAnalyticsSortKey;
  sortDir: SortDirection;
  onStatusFilterChange: (next: EventAnalyticsFilterStatus) => void;
  onCategoryFilterChange: (next: string) => void;
  onSearchQueryChange: (next: string) => void;
  onToggleSort: (key: EventAnalyticsSortKey) => void;
  onSelectEvent: (event: SchoolEvent) => void;
}

const PAGE_SIZE = 10;

export function EventPerformanceTable({
  rows,
  summary,
  schoolTimezone,
  statusFilter,
  categoryFilter,
  searchQuery,
  sortKey,
  sortDir,
  onStatusFilterChange,
  onCategoryFilterChange,
  onSearchQueryChange,
  onToggleSort,
  onSelectEvent,
}: EventPerformanceTableProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  const statusTabs: { id: EventAnalyticsFilterStatus; label: string }[] = [
    { id: 'all', label: 'All Events' },
    { id: 'published', label: 'Published' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'draft', label: 'Drafts' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const renderSortButton = (key: EventAnalyticsSortKey, label: string, alignRight = false) => {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => {
          setPage(1);
          onToggleSort(key);
        }}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider cursor-pointer ${
          alignRight ? 'justify-end w-full' : ''
        } ${active ? 'text-[#171717]' : 'text-[#737373] hover:text-[#171717]'}`}
      >
        <span>{label}</span>
        <ArrowDownUp className="h-3 w-3 shrink-0" aria-hidden="true" />
        {active && <span className="sr-only">sorted {sortDir}</span>}
      </button>
    );
  };

  return (
    <section aria-labelledby="event-performance-heading" className="space-y-5">
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-5">
        <div>
          <h2
            id="event-performance-heading"
            className="font-display text-lg font-bold tracking-tight text-[#171717]"
          >
            Event Performance Analytics
          </h2>
          <p className="mt-0.5 text-xs text-[#737373]">
            Compare current RSVP performance across authorized events. Relative comparison benchmarks published events against the published mean.
          </p>
        </div>

        {/* Performance Indicators Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]">
          <div className="p-4">
            <p className="text-[11px] font-medium text-[#737373]">Total Current RSVPs</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#171717]">
              {summary.totalRsvps.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-[#737373]">Intent to attend</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-medium text-[#737373]">Avg RSVPs / Published</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#E85D04]">
              {summary.avgRsvpsAcrossPublished}
            </p>
            <p className="mt-0.5 text-[11px] text-[#737373]">Across published events</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-medium text-[#737373]">Highest RSVP Event</p>
            {summary.highestRsvpEvent ? (
              <>
                <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#16A34A]">
                  {summary.highestRsvpEvent.rsvpCount}
                </p>
                <p className="mt-0.5 text-[11px] text-[#171717] truncate font-medium">
                  {summary.highestRsvpEvent.title}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-[#737373]">No published events</p>
            )}
          </div>
          <div className="p-4">
            <p className="text-[11px] font-medium text-[#737373]">Lowest RSVP Event</p>
            {summary.lowestRsvpEvent ? (
              <>
                <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#171717]">
                  {summary.lowestRsvpEvent.rsvpCount}
                </p>
                <p className="mt-0.5 text-[11px] text-[#525252] truncate font-medium">
                  {summary.lowestRsvpEvent.title}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-[#737373]">No published events</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0"
            role="group"
            aria-label="Filter event performance by status"
          >
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setPage(1);
                    onStatusFilterChange(tab.id);
                  }}
                  className={`inline-flex min-h-[36px] items-center rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#E5E7EB] bg-white text-[#525252] hover:text-[#171717]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <label htmlFor="analytics-cat-filter" className="sr-only">
              Filter by category
            </label>
            <select
              id="analytics-cat-filter"
              value={categoryFilter}
              onChange={(e) => {
                setPage(1);
                onCategoryFilterChange(e.target.value);
              }}
              className="h-9 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            >
              <option value="all">All Categories</option>
              {ALL_EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <div className="relative sm:w-56">
              <label htmlFor="analytics-event-search" className="sr-only">
                Search event analytics
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#737373]"
                aria-hidden="true"
              />
              <input
                id="analytics-event-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setPage(1);
                  onSearchQueryChange(e.target.value);
                }}
                placeholder="Search title or club..."
                className="h-9 w-full rounded-xl border border-[#E5E7EB] bg-white pl-8 pr-7 text-xs text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    onSearchQueryChange('');
                  }}
                  aria-label="Clear event search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-[#737373] hover:bg-[#F8F9FA] cursor-pointer"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F9FA] p-10 text-center">
            <p className="text-sm font-semibold text-[#171717]">No matching event records</p>
            <p className="mt-1 text-xs text-[#737373]">
              Adjust the status tab, category filter, or date window above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-5 sm:px-0">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th scope="col" className="py-3 pr-4">
                      {renderSortButton('title', 'Event')}
                    </th>
                    <th scope="col" className="py-3 px-3">
                      {renderSortButton('hostClub', 'Hosting Club')}
                    </th>
                    <th scope="col" className="py-3 px-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                        Category
                      </span>
                    </th>
                    <th scope="col" className="py-3 px-3">
                      {renderSortButton('startAt', 'Event Date')}
                    </th>
                    <th scope="col" className="py-3 px-3">
                      {renderSortButton('createdAt', 'Created')}
                    </th>
                    <th scope="col" className="py-3 px-3">
                      {renderSortButton('status', 'Status')}
                    </th>
                    <th scope="col" className="py-3 px-3 text-right">
                      {renderSortButton('rsvpCount', 'RSVPs', true)}
                    </th>
                    <th scope="col" className="py-3 pl-3 text-right">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                        Relative
                      </span>
                    </th>
                    <th scope="col" className="py-3 pl-3 text-right">
                      <span className="sr-only">Open event</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-xs">
                  {paginatedRows.map((row) => {
                    const startFmt = formatDateInTimezone(row.event.startAt, schoolTimezone);
                    const createdFmt = formatDateInTimezone(row.event.createdAt, schoolTimezone);
                    const statusTone =
                      row.event.status === 'published'
                        ? 'text-[#16A34A]'
                        : row.event.status === 'cancelled'
                          ? 'text-[#DC2626]'
                          : 'text-[#D97706]';

                    const relTone =
                      row.deltaPctFromAvg !== null && row.deltaPctFromAvg > 0
                        ? 'text-[#16A34A]'
                        : row.deltaPctFromAvg !== null && row.deltaPctFromAvg < 0
                          ? 'text-[#737373]'
                          : 'text-[#525252]';

                    return (
                      <tr
                        key={row.event.id}
                        className="hover:bg-[#F8F9FA]/80 transition-colors"
                      >
                        <td className="py-3 pr-4 max-w-[240px]">
                          <button
                            type="button"
                            onClick={() => onSelectEvent(row.event)}
                            className="font-semibold text-[#171717] hover:text-[#E85D04] text-left truncate block max-w-full cursor-pointer"
                          >
                            {row.event.title}
                          </button>
                          <span className="text-[11px] text-[#737373] truncate block">
                            {row.event.location}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#525252] whitespace-nowrap">
                          {row.event.hostClub}
                        </td>
                        <td className="py-3 px-3 text-[#525252] whitespace-nowrap">
                          {row.event.category}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-[#525252] whitespace-nowrap">
                          {startFmt.date}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-[#737373] whitespace-nowrap">
                          {createdFmt.date}
                        </td>
                        <td className={`py-3 px-3 font-semibold capitalize whitespace-nowrap ${statusTone}`}>
                          {row.event.status}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums font-bold text-[#171717] text-right whitespace-nowrap">
                          {row.event.rsvpCount.toLocaleString()}
                        </td>
                        <td className={`py-3 pl-3 font-mono tabular-nums text-right whitespace-nowrap ${relTone}`}>
                          {row.relativeLabel}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectEvent(row.event)}
                            aria-label={`Open ${row.event.title}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[11px] font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="h-3 w-3 text-[#737373]" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-4 text-xs text-[#737373]">
            <span className="font-mono tabular-nums">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of{' '}
              {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[34px] items-center rounded-lg border border-[#E5E7EB] bg-white px-3 font-medium text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-[34px] items-center rounded-lg border border-[#E5E7EB] bg-white px-3 font-medium text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
