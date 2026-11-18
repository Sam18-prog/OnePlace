import { Clock, Eye, MapPin, Pencil, Send, Users, XCircle } from 'lucide-react';
import type { SchoolEvent } from '../../types/event';
import { formatEventDateTime, formatEventTimeOnly } from '../../utils/events';
import { isPastEvent } from '../../utils/eventValidation';
import { CategoryBadge } from '../CategoryBadge';
import { EventImage } from '../EventImage';
import { EventStatusBadge } from './EventStatusBadge';

interface EventManagementCardProps {
  event: SchoolEvent;
  schoolTimezone: string;
  isBusy?: boolean;
  canRestoreCancelled?: boolean;
  onView: (event: SchoolEvent) => void;
  onEdit: (event: SchoolEvent) => void;
  onPublish: (event: SchoolEvent) => void;
  onRequestCancel: (event: SchoolEvent) => void;
}

export function EventManagementCard({
  event,
  schoolTimezone,
  isBusy = false,
  onView,
  onEdit,
  onPublish,
  onRequestCancel,
}: EventManagementCardProps) {
  const past = isPastEvent(event);
  const startLabel = formatEventDateTime(event.startAt, new Date(), schoolTimezone);
  const endTimeLabel = formatEventTimeOnly(event.endAt, schoolTimezone);

  return (
    <article
      data-testid={`managed-event-${event.id}`}
      className="rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-sm"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={() => onView(event)}
          aria-label={`Preview ${event.title}`}
          className="relative aspect-[16/9] sm:aspect-auto sm:w-40 md:w-44 shrink-0 overflow-hidden rounded-xl border border-[#E5E7EB] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
        >
          <EventImage
            eventId={event.id}
            title={event.title}
            category={event.category}
            imageUrl={event.imageUrl}
            className="h-full w-full"
          />
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <EventStatusBadge
                status={event.status}
                visibility={event.visibility}
                isPast={past}
              />
              <CategoryBadge category={event.category} />
            </div>

            <button
              type="button"
              onClick={() => onView(event)}
              className="text-left cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] rounded-md"
            >
              <h3 className="font-display text-lg font-bold tracking-tight text-[#171717] group-hover:text-[#E85D04] transition-colors">
                {event.title}
              </h3>
            </button>

            <p className="mt-0.5 text-xs font-medium text-[#737373]">{event.hostClub}</p>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#737373]">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="font-mono font-medium text-[#171717]">
                  {startLabel} – {endTimeLabel}
                </span>
              </span>
              <span aria-hidden="true" className="text-[#D1D5DB]">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate text-[#525252]">{event.location}</span>
              </span>
              <span aria-hidden="true" className="text-[#D1D5DB]">
                ·
              </span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-[#171717]">
                <Users className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                <span>{event.rsvpCount} RSVPs</span>
              </span>
            </div>

            {event.status === 'cancelled' && event.cancellationReason && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                Cancellation note: {event.cancellationReason}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-[#E5E7EB]/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onView(event)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                <span>View</span>
              </button>

              {event.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => onEdit(event)}
                  disabled={isBusy}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                  <span>Edit</span>
                </button>
              )}

              {event.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => onPublish(event)}
                  disabled={isBusy}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#16A34A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Publish</span>
                </button>
              )}
            </div>

            {event.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => onRequestCancel(event)}
                disabled={isBusy}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cancel Event</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
