import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type {
  CategoryBreakdownItem,
  MonthlyActivityPoint,
  RsvpDistributionBucket,
} from '../../types/analytics';
import type { SchoolEvent } from '../../types/event';
import { formatDateInTimezone } from '../../utils/eventValidation';

export interface HorizontalBarDatum {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  secondaryValue?: string;
  onClick?: () => void;
}

interface HorizontalBarChartProps {
  title: string;
  subtitle: string;
  items: HorizontalBarDatum[];
  unitLabel: string;
  barColor?: string;
  maxItems?: number;
  emptyTitle?: string;
  emptyMessage?: string;
}

export function HorizontalBarChart({
  title,
  subtitle,
  items,
  unitLabel,
  barColor = '#E85D04',
  maxItems = 8,
  emptyTitle = 'No data in this window',
  emptyMessage = 'Adjust the date range or publish events to view this breakdown.',
}: HorizontalBarChartProps) {
  const visible = items.slice(0, maxItems);
  const maxVal = Math.max(1, ...visible.map((d) => d.value));

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="font-display text-base font-bold tracking-tight text-[#171717]">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-[#737373]">{subtitle}</p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-8 text-center">
          <BarChart3 className="mx-auto h-5 w-5 text-[#737373]" aria-hidden="true" />
          <p className="mt-2 text-xs font-semibold text-[#171717]">{emptyTitle}</p>
          <p className="mt-0.5 text-[11px] text-[#737373]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-label={title}>
          {visible.map((item) => {
            const pct = Math.max(item.value > 0 ? 3 : 0, Math.round((item.value / maxVal) * 100));
            const rowContent = (
              <>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-[#171717] truncate block">
                      {item.label}
                    </span>
                    {item.sublabel && (
                      <span className="text-[11px] text-[#737373] truncate block">
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right font-mono tabular-nums">
                    <span className="font-bold text-[#171717]">{item.value.toLocaleString()}</span>
                    <span className="ml-1 text-[11px] text-[#737373]">{unitLabel}</span>
                    {item.secondaryValue && (
                      <span className="ml-2 text-[11px] text-[#737373]">
                        · {item.secondaryValue}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
              </>
            );

            if (item.onClick) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  role="listitem"
                  className="block w-full rounded-lg p-1.5 -mx-1.5 text-left hover:bg-[#F8F9FA] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
                >
                  {rowContent}
                </button>
              );
            }

            return (
              <div key={item.id} role="listitem" className="py-0.5">
                {rowContent}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SLICE_PALETTE = [
  '#E85D04', // Terracotta primary
  '#171717', // Ink slate
  '#16A34A', // Emerald
  '#2563EB', // Cobalt blue
  '#D97706', // Amber
  '#64748B', // Muted slate
];

export interface DonutSliceDatum {
  id: string;
  label: string;
  value: number;
  secondaryLabel?: string;
}

interface DonutBreakdownChartProps {
  title: string;
  subtitle: string;
  centerLabel: string;
  slices: DonutSliceDatum[];
  unitLabel: string;
  emptyMessage?: string;
}

export function DonutBreakdownChart({
  title,
  subtitle,
  centerLabel,
  slices,
  unitLabel,
  emptyMessage = 'No records match this period.',
}: DonutBreakdownChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const nonZero = slices.filter((s) => s.value > 0);
  const total = nonZero.reduce((acc, s) => acc + s.value, 0);

  const radius = 56;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  const arcSegments = useMemo(() => {
    if (total === 0) return [];
    let offset = 0;
    return nonZero.map((slice, idx) => {
      const fraction = slice.value / total;
      const dashLength = fraction * circumference;
      const segment = {
        ...slice,
        color: SLICE_PALETTE[idx % SLICE_PALETTE.length],
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset: -offset,
        pct: Math.round(fraction * 100),
      };
      offset += dashLength;
      return segment;
    });
  }, [circumference, nonZero, total]);

  const activeSegment = arcSegments.find((s) => s.id === hoveredId) ?? null;

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="font-display text-base font-bold tracking-tight text-[#171717]">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-[#737373]">{subtitle}</p>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-8 text-center">
          <p className="text-xs font-semibold text-[#171717]">No {unitLabel} recorded</p>
          <p className="mt-0.5 text-[11px] text-[#737373]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="relative mx-auto sm:mx-0 h-40 w-40 shrink-0">
            <svg
              viewBox="0 0 148 148"
              className="h-full w-full -rotate-90"
              role="img"
              aria-label={`${title}: total ${total} ${unitLabel}`}
            >
              <title>{title}</title>
              <circle
                cx="74"
                cy="74"
                r={radius}
                fill="none"
                stroke="#F3F4F6"
                strokeWidth={strokeWidth}
              />
              {arcSegments.map((seg) => (
                <circle
                  key={seg.id}
                  cx="74"
                  cy="74"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={hoveredId === seg.id ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-3">
              <span className="font-mono tabular-nums text-xl font-bold text-[#171717]">
                {(activeSegment ? activeSegment.value : total).toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-[#737373] truncate max-w-[90px]">
                {activeSegment ? `${activeSegment.pct}%` : centerLabel}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0 divide-y divide-[#F3F4F6]">
            {arcSegments.map((seg) => (
              <div
                key={seg.id}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`flex items-center justify-between gap-3 py-2 text-xs transition-colors ${
                  hoveredId === seg.id ? 'bg-[#F8F9FA] px-2 -mx-2 rounded-lg' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-[#171717] truncate">{seg.label}</span>
                  {seg.secondaryLabel && (
                    <span className="text-[11px] text-[#737373] hidden md:inline">
                      · {seg.secondaryLabel}
                    </span>
                  )}
                </div>
                <div className="font-mono tabular-nums shrink-0 text-right">
                  <span className="font-semibold text-[#171717]">
                    {seg.value.toLocaleString()}
                  </span>
                  <span className="ml-1.5 text-[11px] text-[#737373]">({seg.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface RsvpDistributionChartProps {
  buckets: RsvpDistributionBucket[];
}

export function RsvpDistributionChart({ buckets }: RsvpDistributionChartProps) {
  const maxEvents = Math.max(1, ...buckets.map((b) => b.eventCount));
  const totalNonDraft = buckets.reduce((acc, b) => acc + b.eventCount, 0);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="font-display text-base font-bold tracking-tight text-[#171717]">
          RSVP Distribution Across Events
        </h3>
        <p className="mt-0.5 text-xs text-[#737373]">
          Number of published &amp; cancelled events grouped by current RSVP size tier.
        </p>
      </div>

      {totalNonDraft === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-8 text-center">
          <p className="text-xs font-semibold text-[#171717]">No published events in range</p>
          <p className="mt-0.5 text-[11px] text-[#737373]">
            Publish an event or widen your date range to see RSVP tiers.
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-5 gap-3 items-end pt-4"
          role="list"
          aria-label="RSVP distribution histogram"
        >
          {buckets.map((bucket) => {
            const heightPct =
              bucket.eventCount > 0
                ? Math.max(12, Math.round((bucket.eventCount / maxEvents) * 100))
                : 4;
            return (
              <div
                key={bucket.id}
                role="listitem"
                className="flex flex-col items-center text-center"
              >
                <span className="font-mono tabular-nums text-xs font-bold text-[#171717]">
                  {bucket.eventCount}
                </span>
                <span className="text-[10px] text-[#737373] mb-2">
                  {bucket.eventCount === 1 ? 'event' : 'events'}
                </span>
                <div className="flex h-32 w-full items-end justify-center rounded-lg bg-[#F8F9FA] px-2 pb-1">
                  <div
                    className={`w-full max-w-[44px] rounded-t-md transition-all duration-300 ${
                      bucket.eventCount > 0 ? 'bg-[#E85D04]' : 'bg-[#E5E7EB]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`${bucket.label}: ${bucket.eventCount} events (${bucket.rsvpSum} total RSVPs)`}
                  />
                </div>
                <span className="mt-2 font-mono text-[11px] font-medium text-[#525252]">
                  {bucket.label.replace(' RSVPs', '')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MonthlyScheduleChartProps {
  points: MonthlyActivityPoint[];
}

export function MonthlyScheduleChart({ points }: MonthlyScheduleChartProps) {
  const maxRsvps = Math.max(1, ...points.map((p) => p.rsvpTotal));
  const maxEvents = Math.max(1, ...points.map((p) => p.eventCount));

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display text-base font-bold tracking-tight text-[#171717]">
            Events &amp; Current RSVPs by Scheduled Month
          </h3>
          <p className="mt-0.5 text-xs text-[#737373]">
            Grouped by event start month (<code className="font-mono text-[#171717]">startAt</code>). Reflects current cumulative RSVPs, not daily RSVP timestamps.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[#525252] shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#171717]" aria-hidden="true" />
            Events
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#E85D04]" aria-hidden="true" />
            Current RSVPs
          </span>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-8 text-center">
          <p className="text-xs font-semibold text-[#171717]">No scheduled events in range</p>
          <p className="mt-0.5 text-[11px] text-[#737373]">
            Adjust your date filter to inspect monthly campus scheduling volume.
          </p>
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Monthly scheduled event activity">
          {points.map((point) => {
            const eventPct = Math.max(4, Math.round((point.eventCount / maxEvents) * 100));
            const rsvpPct =
              point.rsvpTotal > 0 ? Math.max(4, Math.round((point.rsvpTotal / maxRsvps) * 100)) : 0;
            return (
              <div key={point.monthKey} role="listitem" className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-[#171717]">{point.label}</span>
                  <div className="font-mono tabular-nums text-[11px] text-[#525252]">
                    <span>{point.eventCount} events</span>
                    <span className="mx-1.5 text-[#D1D5DB]" aria-hidden="true">·</span>
                    <span>{point.publishedCount} published</span>
                    <span className="mx-1.5 text-[#D1D5DB]" aria-hidden="true">·</span>
                    <span className="font-semibold text-[#171717]">{point.rsvpTotal} RSVPs</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                  <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                    <div
                      className="h-full rounded-full bg-[#171717]"
                      style={{ width: `${eventPct}%` }}
                    />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                    <div
                      className="h-full rounded-full bg-[#E85D04]"
                      style={{ width: `${rsvpPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface EventComparisonPanelProps {
  events: SchoolEvent[];
  schoolTimezone: string;
  onSelectEvent: (event: SchoolEvent) => void;
}

export function EventComparisonPanel({
  events,
  schoolTimezone,
  onSelectEvent,
}: EventComparisonPanelProps) {
  const candidates = useMemo(
    () => [...events].sort((a, b) => b.rsvpCount - a.rsvpCount).slice(0, 24),
    [events]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    candidates.slice(0, 3).map((e) => e.id)
  );

  const activeIds = useMemo(() => {
    const valid = selectedIds.filter((id) => candidates.some((e) => e.id === id));
    if (valid.length > 0) return valid;
    return candidates.slice(0, 3).map((e) => e.id);
  }, [candidates, selectedIds]);

  const comparedEvents = candidates.filter((e) => activeIds.includes(e.id));
  const maxRsvp = Math.max(1, ...comparedEvents.map((e) => e.rsvpCount));

  const toggleCandidate = (eventId: string) => {
    setSelectedIds((prev) => {
      const current = prev.filter((id) => candidates.some((e) => e.id === id));
      if (current.includes(eventId)) {
        return current.length > 1 ? current.filter((id) => id !== eventId) : current;
      }
      if (current.length >= 4) {
        return [...current.slice(1), eventId];
      }
      return [...current, eventId];
    });
  };

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="font-display text-base font-bold tracking-tight text-[#171717]">
          Event Comparison
        </h3>
        <p className="mt-0.5 text-xs text-[#737373]">
          Select up to 4 authorized events to compare current RSVP counts side by side.
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-8 text-center">
          <p className="text-xs font-semibold text-[#171717]">No events available to compare</p>
          <p className="mt-0.5 text-[11px] text-[#737373]">
            Create or widen your date range to compare events.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select events to compare">
            {candidates.slice(0, 10).map((evt) => {
              const selected = activeIds.includes(evt.id);
              return (
                <button
                  key={evt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCandidate(evt.id)}
                  className={`inline-flex min-h-[34px] items-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    selected
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#E5E7EB] bg-[#F8F9FA] text-[#525252] hover:text-[#171717]'
                  }`}
                >
                  <span className="truncate max-w-[180px]">{evt.title}</span>
                </button>
              );
            })}
          </div>

          <div className="divide-y divide-[#E5E7EB] border-t border-[#E5E7EB]">
            {comparedEvents.map((evt) => {
              const pct = Math.max(evt.rsvpCount > 0 ? 4 : 0, Math.round((evt.rsvpCount / maxRsvp) * 100));
              const dateInfo = formatDateInTimezone(evt.startAt, schoolTimezone);
              return (
                <div key={evt.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="sm:w-64 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectEvent(evt)}
                      className="text-xs font-semibold text-[#171717] hover:text-[#E85D04] truncate block text-left cursor-pointer"
                    >
                      {evt.title}
                    </button>
                    <p className="text-[11px] text-[#737373] truncate">
                      {evt.hostClub} · {evt.category} · {dateInfo.date}
                    </p>
                  </div>

                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-[#F3F4F6]">
                      <div
                        className="h-full rounded-full bg-[#E85D04] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-[#171717] w-20 text-right shrink-0">
                      {evt.rsvpCount} RSVPs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function categoryBreakdownToDonutSlices(items: CategoryBreakdownItem[]): DonutSliceDatum[] {
  return items.map((item) => ({
    id: item.category,
    label: item.category,
    value: item.totalRsvps,
    secondaryLabel: `${item.eventCount} events`,
  }));
}
