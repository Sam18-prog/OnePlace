import { CheckCircle2, FileEdit, Globe, Lock, XCircle } from 'lucide-react';
import type { EventStatus, EventVisibility } from '../../types/event';

interface EventStatusBadgeProps {
  status: EventStatus;
  visibility?: EventVisibility;
  isPast?: boolean;
}

const STATUS_STYLES: Record<
  EventStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  published: {
    label: 'Published',
    className: 'bg-[#16A34A]/10 text-[#15803D] border-[#16A34A]/20',
    Icon: CheckCircle2,
  },
  draft: {
    label: 'Draft',
    className: 'bg-[#D97706]/10 text-[#B45309] border-[#D97706]/25',
    Icon: FileEdit,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-[#DC2626]/10 text-[#B91C1C] border-[#DC2626]/20',
    Icon: XCircle,
  },
};

export function EventStatusBadge({ status, visibility, isPast }: EventStatusBadgeProps) {
  const meta = STATUS_STYLES[status];
  const Icon = meta.Icon;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap shrink-0 ${meta.className}`}
      >
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{meta.label}</span>
      </span>

      {isPast && status !== 'cancelled' && (
        <span className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#525252] whitespace-nowrap shrink-0">
          Past
        </span>
      )}

      {visibility && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#737373] whitespace-nowrap shrink-0">
          {visibility === 'school' ? (
            <>
              <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>School only</span>
            </>
          ) : (
            <>
              <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Public</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
