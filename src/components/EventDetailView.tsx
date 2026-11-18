import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import type { SchoolEvent } from '../types/event';
import {
  buildGoogleCalendarUrl,
  formatEventTimeOnly,
  formatFullEventDate,
} from '../utils/events';
import { CategoryBadge } from './CategoryBadge';
import { EventImage } from './EventImage';

interface EventDetailViewProps {
  event: SchoolEvent | null;
  rsvpCount: number;
  isGoing: boolean;
  isSignedIn: boolean;
  onRsvpClick: (event: SchoolEvent) => void;
  onClose: () => void;
}

export function EventDetailView({
  event,
  rsvpCount,
  isGoing,
  isSignedIn,
  onRsvpClick,
  onClose,
}: EventDetailViewProps) {
  useEffect(() => {
    if (!event) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [event, onClose]);

  if (!event) return null;

  const googleCalendarUrl = buildGoogleCalendarUrl(event);
  const fullDate = formatFullEventDate(event.dateTime);
  const timeOnly = formatEventTimeOnly(event.dateTime);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#171717]/45 p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col w-full md:max-w-3xl max-h-[92dvh] md:max-h-[86vh] overflow-hidden rounded-t-2xl md:rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar (Mobile Back + Desktop Close) */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 sm:px-6 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2 py-1 text-xs sm:text-sm font-medium text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to events</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close event details"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-7">
          <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-6 md:gap-7 items-start">
            {/* Left Column: Cover Image & Quick Facts */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                <EventImage
                  eventId={event.id}
                  title={event.title}
                  category={event.category}
                  className="aspect-[16/10] w-full"
                />
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium text-[#737373]">Date</p>
                    <p className="text-sm font-semibold text-[#171717]">{fullDate}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium text-[#737373]">Time</p>
                    <p className="font-mono text-sm font-semibold text-[#171717]">{timeOnly}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium text-[#737373]">Venue</p>
                    <p className="text-sm font-semibold text-[#171717]">{event.location}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Title, Club, Description & Actions */}
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <CategoryBadge category={event.category} size="md" />
                  <span className="text-xs font-medium text-[#737373]">
                    Hosted by {event.hostClub}
                  </span>
                </div>

                <h2
                  id="event-detail-title"
                  className="font-display text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#171717] leading-tight"
                >
                  {event.title}
                </h2>

                <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5">
                  <Users className="h-4 w-4 text-[#737373]" aria-hidden="true" />
                  <span className="font-mono tabular-nums text-xs font-semibold text-[#171717]">
                    {rsvpCount} students going
                  </span>
                </div>

                <div className="mt-5 border-t border-[#E5E7EB] pt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-2">
                    About this event
                  </h3>
                  <p className="text-sm sm:text-[15px] text-[#404040] leading-relaxed">
                    {event.description || 'Details provided by the hosting student organization.'}
                  </p>
                </div>
              </div>

              {/* Desktop Action Buttons */}
              <div className="hidden md:flex flex-col gap-2.5 mt-7 pt-5 border-t border-[#E5E7EB]">
                <motion.button
                  type="button"
                  onClick={() => onRsvpClick(event)}
                  aria-pressed={isGoing}
                  whileTap={{ scale: 0.98 }}
                  className={`inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
                    isGoing
                      ? 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                      : 'bg-[#E85D04] text-white hover:bg-[#DC2F02]'
                  }`}
                >
                  {isGoing ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>You're going!</span>
                    </>
                  ) : (
                    <span>{isSignedIn ? 'RSVP to this event' : 'Sign in to RSVP'}</span>
                  )}
                </motion.button>

                <a
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
                >
                  <CalendarPlus className="h-4 w-4 text-[#737373]" aria-hidden="true" />
                  <span>Add to Google Calendar</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Action Footer */}
        <div className="md:hidden border-t border-[#E5E7EB] bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2.5 shrink-0">
          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Add ${event.title} to Google Calendar`}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] shrink-0"
          >
            <CalendarPlus className="h-4 w-4 text-[#737373]" aria-hidden="true" />
            <span>Calendar</span>
          </a>

          <button
            type="button"
            onClick={() => onRsvpClick(event)}
            aria-pressed={isGoing}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              isGoing
                ? 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                : 'bg-[#E85D04] text-white hover:bg-[#DC2F02]'
            }`}
          >
            {isGoing ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>You're going!</span>
              </>
            ) : (
              <span>{isSignedIn ? 'RSVP' : 'Sign in to RSVP'}</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
