import { motion } from 'motion/react';
import { CalendarPlus, Check, Clock, Lock, MapPin, Users, XCircle } from 'lucide-react';
import type { SchoolEvent } from '../types/event';
import { buildGoogleCalendarUrl, formatEventDateTime, getDateTileParts } from '../utils/events';
import { isPastEvent } from '../utils/eventValidation';
import { CategoryBadge } from './CategoryBadge';
import { EventImage } from './EventImage';

interface EventCardProps {
  event: SchoolEvent;
  index?: number;
  variant?: 'featured' | 'standard';
  rsvpCount: number;
  isGoing: boolean;
  isSignedIn: boolean;
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSelectClubById?: (clubId: string) => void;
}

export function EventCard({
  event,
  index = 0,
  variant = 'standard',
  rsvpCount,
  isGoing,
  isSignedIn,
  onRsvpClick,
  onSelectEvent,
  onSelectClubById,
}: EventCardProps) {
  const formattedDateTime = formatEventDateTime(event.startAt, new Date(), event.timezone);
  const googleCalendarUrl = buildGoogleCalendarUrl(event);
  const isFeatured = variant === 'featured';
  const dateParts = getDateTileParts(event.startAt, event.timezone);

  const isCancelled = event.status === 'cancelled';
  const isDraft = event.status === 'draft';
  const isPast = isPastEvent(event);
  const canRsvpNow = !isCancelled && !isDraft && (!isPast || isGoing);
  const rsvpBlocked = (!canRsvpNow && !isGoing) || isDraft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index * 0.04, 0.2),
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <article
        data-testid={`event-card-${event.id}`}
        className={`group overflow-hidden rounded-2xl border bg-white transition-all duration-200 ${
          isFeatured
            ? 'grid grid-cols-1 md:grid-cols-[1.12fr_1fr] lg:grid-cols-[1.2fr_1fr] border-[#E5E7EB] shadow-sm hover:shadow-md hover:border-[#D1D5DB]'
            : 'flex flex-col sm:flex-row border-[#E5E7EB] shadow-xs hover:shadow-md hover:border-[#D1D5DB]'
        }`}
      >
        {/* Event Visual Cover */}
        <button
          type="button"
          onClick={() => onSelectEvent(event)}
          aria-label={`View details for ${event.title}`}
          className={`relative block overflow-hidden text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E85D04] ${
            isFeatured
              ? 'aspect-[16/9] md:aspect-auto md:min-h-[290px]'
              : 'aspect-[16/9] sm:aspect-auto sm:w-52 md:w-60 shrink-0'
          }`}
        >
          <EventImage
            eventId={event.id}
            title={event.title}
            category={event.category}
            imageUrl={event.imageUrl}
            priority={isFeatured}
            className={`h-full w-full transition-transform duration-300 group-hover:scale-[1.02] ${
              isCancelled ? 'opacity-70 grayscale-[35%]' : ''
            }`}
          />

          {isFeatured && (
            <div
              className="pointer-events-none absolute top-3.5 left-3.5 flex flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-white/95 px-2.5 py-1.5 shadow-sm"
              aria-hidden="true"
            >
              <span className="font-mono text-[10px] font-bold tracking-wider text-[#E85D04] leading-none">
                {dateParts.month}
              </span>
              <span className="mt-0.5 font-display text-base font-extrabold text-[#171717] leading-none">
                {dateParts.day}
              </span>
            </div>
          )}
        </button>

        {/* Event Content */}
        <div
          className={`flex flex-1 flex-col justify-between min-w-0 ${
            isFeatured ? 'p-5 sm:p-6 md:p-8' : 'p-5 sm:p-6'
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <CategoryBadge category={event.category} size={isFeatured ? 'md' : 'sm'} />
                {isCancelled && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#B91C1C]">
                    <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>Cancelled</span>
                  </span>
                )}
                {event.visibility === 'school' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#737373]">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>School only</span>
                  </span>
                )}
                {onSelectClubById ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClubById(event.clubId);
                    }}
                    className="text-xs font-medium text-[#737373] hover:text-[#E85D04] hover:underline truncate cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
                  >
                    {event.hostClub}
                  </button>
                ) : (
                  <span className="text-xs font-medium text-[#737373] truncate">
                    {event.hostClub}
                  </span>
                )}
              </div>
              {isFeatured && !isCancelled && (
                <span className="font-mono text-[11px] font-medium text-[#E85D04] whitespace-nowrap">
                  Featured · Up Next
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => onSelectEvent(event)}
              className="block w-full text-left cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
            >
              <h3
                className={`font-display font-bold tracking-tight transition-colors leading-snug ${
                  isCancelled
                    ? 'text-[#737373] line-through'
                    : 'text-[#171717] group-hover:text-[#E85D04]'
                } ${isFeatured ? 'text-[22px] sm:text-[26px]' : 'text-lg sm:text-xl'}`}
              >
                {event.title}
              </h3>
            </button>

            {isCancelled && event.cancellationReason && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                {event.cancellationReason}
              </p>
            )}

            {event.description && (
              <p
                className={`mt-2 text-sm text-[#737373] leading-relaxed ${
                  isFeatured ? 'line-clamp-3' : 'line-clamp-2'
                }`}
              >
                {event.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-[13px] text-[#737373]">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Clock className="h-3.5 w-3.5 text-[#737373] shrink-0" aria-hidden="true" />
                <span className="font-mono font-medium text-[#171717]">
                  {formattedDateTime}
                </span>
              </span>

              <span aria-hidden="true" className="text-[#D1D5DB]">
                ·
              </span>

              <span className="inline-flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 text-[#737373] shrink-0" aria-hidden="true" />
                <span className="truncate text-[#525252]">{event.location}</span>
              </span>
            </div>
          </div>

          {/* Actions Row */}
          <div className="mt-5 pt-4 border-t border-[#E5E7EB]/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                disabled={rsvpBlocked}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!rsvpBlocked) onRsvpClick(event);
                }}
                aria-pressed={isGoing}
                aria-label={
                  isGoing
                    ? `Cancel RSVP for ${event.title}`
                    : isCancelled
                      ? `${event.title} is cancelled`
                      : isPast
                        ? `${event.title} has already ended`
                        : isSignedIn
                          ? `RSVP to ${event.title}`
                          : `Sign in to RSVP to ${event.title}`
                }
                animate={isGoing ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                whileTap={rsvpBlocked ? undefined : { scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={`inline-flex min-h-[42px] min-w-[120px] items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
                  rsvpBlocked
                    ? 'border border-[#E5E7EB] bg-[#F3F4F6] text-[#737373] cursor-not-allowed'
                    : isGoing && isCancelled
                      ? 'border border-red-200 bg-red-50 text-[#DC2626] hover:bg-red-100 cursor-pointer'
                      : isGoing
                        ? 'bg-[#16A34A] text-white hover:bg-[#15803D] cursor-pointer'
                        : 'bg-[#E85D04] text-white hover:bg-[#DC2F02] cursor-pointer'
                }`}
              >
                {isGoing ? (
                  isCancelled ? (
                    <span>Cancel RSVP</span>
                  ) : (
                    <>
                      <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>You're going!</span>
                    </>
                  )
                ) : isCancelled ? (
                  <span>Cancelled</span>
                ) : isPast ? (
                  <span>Event ended</span>
                ) : (
                  <span>RSVP</span>
                )}
              </motion.button>

              {!isCancelled && (
                <a
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Add ${event.title} to Google Calendar`}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] hover:border-[#D1D5DB] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
                >
                  <CalendarPlus className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                  <span>Add to Calendar</span>
                </a>
              )}
            </div>

            <div
              aria-live="polite"
              className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs font-medium text-[#737373]"
            >
              <Users className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
              <span>{rsvpCount} going</span>
            </div>
          </div>
        </div>
      </article>
    </motion.div>
  );
}
