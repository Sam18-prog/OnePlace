import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Hourglass,
  ListPlus,
  MapPin,
  Megaphone,
  QrCode,
  Users,
  X,
} from 'lucide-react';
import { listEventAnnouncements } from '../services/eventOperationsService';
import type { SchoolEvent } from '../types/event';
import type {
  EventAnnouncementRecord,
  StudentEventLifecycleState,
} from '../types/eventOperations';
import {
  buildGoogleCalendarUrl,
  formatEventDateTime,
  formatEventTimeRange,
  formatFullEventDate,
} from '../utils/events';
import { getEventCapacitySnapshot } from '../utils/eventRegistration';
import { isPastEvent } from '../utils/eventValidation';
import { CategoryBadge } from './CategoryBadge';
import { EventImage } from './EventImage';
import { PostEventFeedbackCard } from './events/PostEventFeedbackCard';
import { EventStatusBadge } from './organizer/EventStatusBadge';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface EventDetailViewProps {
  event: SchoolEvent | null;
  rsvpCount: number;
  isGoing: boolean;
  isSignedIn: boolean;
  userUid?: string | null;
  isVerifiedUser?: boolean;
  isSuspendedMember?: boolean;
  lifecycle?: StudentEventLifecycleState;
  isBusy?: boolean;
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectClubById?: (clubId: string) => void;
  onShowToast?: (type: 'error' | 'success', message: string) => void;
  onClose: () => void;
}

export function EventDetailView({
  event,
  rsvpCount,
  isGoing,
  isSignedIn,
  userUid = null,
  isVerifiedUser = false,
  isSuspendedMember = false,
  lifecycle,
  isBusy = false,
  onRsvpClick,
  onSelectClubById,
  onShowToast,
  onClose,
}: EventDetailViewProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [announcements, setAnnouncements] = useState<EventAnnouncementRecord[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  useFocusTrap({
    isOpen: Boolean(event),
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  useEffect(() => {
    if (!event) {
      setAnnouncements([]);
      return;
    }
    let cancelled = false;
    setLoadingAnnouncements(true);
    void listEventAnnouncements(event.id, false)
      .then((items) => {
        if (!cancelled) setAnnouncements(items);
      })
      .finally(() => {
        if (!cancelled) setLoadingAnnouncements(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event]);

  if (!event) return null;

  const googleCalendarUrl = buildGoogleCalendarUrl(event);
  const fullDate = formatFullEventDate(event.startAt, event.timezone);
  const timeRange = formatEventTimeRange(event.startAt, event.endAt, event.timezone);
  const isCancelled = event.status === 'cancelled';
  const isDraft = event.status === 'draft';
  const isPast = isPastEvent(event);

  const capacity = getEventCapacitySnapshot({
    ...event,
    rsvpCount,
    confirmedCount: rsvpCount,
  });

  const resolvedLifecycle: StudentEventLifecycleState = lifecycle ?? {
    status: isGoing ? 'confirmed' : 'not_registered',
    source: isGoing ? 'legacy_rsvp' : 'none',
    registration: null,
    attendance: null,
    waitlistPosition: null,
  };

  const status = resolvedLifecycle.status;
  const isAttended = status === 'attended';
  const isConfirmed = status === 'confirmed';
  const isPending = status === 'pending_approval';
  const isWaitlisted = status === 'waitlisted';
  const hasActiveRegistration = isConfirmed || isPending || isWaitlisted || isAttended;

  const isRegistrationClosed =
    !isCancelled && !isDraft && !isPast && capacity.effectiveRegistrationStatus === 'closed';
  const isFullWithoutWaitlist = !hasActiveRegistration && capacity.isFull && !event.allowWaitlist;
  const isWaitlistEligible =
    !hasActiveRegistration &&
    !isCancelled &&
    !isDraft &&
    !isPast &&
    !isRegistrationClosed &&
    capacity.isFull &&
    Boolean(event.allowWaitlist);

  const canAct =
    !isBusy &&
    !isDraft &&
    !isAttended &&
    (hasActiveRegistration
      ? !isPast || isCancelled
      : !isCancelled && !isPast && !isRegistrationClosed && !isFullWithoutWaitlist);

  const buttonBlocked = !canAct;

  let desktopCtaLabel = isSignedIn ? 'Register for this event' : 'Sign in to register';
  let mobileCtaLabel = isSignedIn ? 'Register' : 'Sign in';
  let ctaTone = 'bg-[#E85D04] text-white hover:bg-[#DC2F02] cursor-pointer';
  let ctaIcon: 'check' | 'attended' | 'pending' | 'waitlist' | null = null;

  if (isBusy) {
    desktopCtaLabel = 'Updating registration...';
    mobileCtaLabel = 'Saving...';
    ctaTone = 'border border-[#E5E7EB] bg-[#F3F4F6] text-[#525252] cursor-wait';
  } else if (isAttended) {
    desktopCtaLabel = 'Checked In · Attendance Recorded';
    mobileCtaLabel = 'Checked In';
    ctaTone = 'border border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] cursor-default';
    ctaIcon = 'attended';
  } else if (isConfirmed) {
    if (isCancelled) {
      desktopCtaLabel = 'Cancel Registration';
      mobileCtaLabel = 'Cancel';
      ctaTone = 'border border-red-200 bg-red-50 text-[#DC2626] hover:bg-red-100 cursor-pointer';
    } else if (isPast) {
      desktopCtaLabel = 'Registered (Event Ended)';
      mobileCtaLabel = 'Registered';
      ctaTone = 'border border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] cursor-default';
      ctaIcon = 'check';
    } else {
      desktopCtaLabel = 'Registered · Cancel Spot';
      mobileCtaLabel = 'Registered';
      ctaTone = 'bg-[#16A34A] text-white hover:bg-[#15803D] cursor-pointer';
      ctaIcon = 'check';
    }
  } else if (isPending) {
    desktopCtaLabel = 'Pending Organizer Approval · Cancel Request';
    mobileCtaLabel = 'Pending Approval';
    ctaTone = 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer';
    ctaIcon = 'pending';
  } else if (isWaitlisted) {
    desktopCtaLabel = 'On Waitlist · Leave Waitlist';
    mobileCtaLabel = 'Waitlisted';
    ctaTone = 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer';
    ctaIcon = 'waitlist';
  } else if (isCancelled) {
    desktopCtaLabel = 'Event Cancelled';
    mobileCtaLabel = 'Cancelled';
    ctaTone = 'border border-[#E5E7EB] bg-[#F3F4F6] text-[#737373] cursor-not-allowed';
  } else if (isDraft) {
    desktopCtaLabel = 'Draft Preview (Not Open)';
    mobileCtaLabel = 'Draft Only';
    ctaTone = 'border border-[#E5E7EB] bg-[#F3F4F6] text-[#737373] cursor-not-allowed';
  } else if (isPast) {
    desktopCtaLabel = 'Event Has Ended';
    mobileCtaLabel = 'Event Ended';
    ctaTone = 'border border-[#E5E7EB] bg-[#F3F4F6] text-[#737373] cursor-not-allowed';
  } else if (isRegistrationClosed) {
    desktopCtaLabel =
      event.registrationOpensAt && Date.now() < event.registrationOpensAt.getTime()
        ? 'Registration Not Open Yet'
        : 'Registration Closed';
    mobileCtaLabel = 'Closed';
    ctaTone = 'border border-[#E5E7EB] bg-[#F3F4F6] text-[#737373] cursor-not-allowed';
  } else if (isFullWithoutWaitlist) {
    desktopCtaLabel = 'Event Full';
    mobileCtaLabel = 'Event Full';
    ctaTone = 'border border-[#E5E7EB] bg-[#F3F4F6] text-[#737373] cursor-not-allowed';
  } else if (isWaitlistEligible) {
    desktopCtaLabel = isSignedIn ? 'Join Event Waitlist' : 'Sign in to Join Waitlist';
    mobileCtaLabel = 'Join Waitlist';
    ctaTone = 'bg-[#171717] text-white hover:bg-[#333333] cursor-pointer';
    ctaIcon = 'waitlist';
  } else if (event.requireApproval) {
    desktopCtaLabel = isSignedIn ? 'Request Registration Spot' : 'Sign in to Request Spot';
    mobileCtaLabel = 'Request Spot';
    ctaTone = 'bg-[#E85D04] text-white hover:bg-[#DC2F02] cursor-pointer';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#171717]/45 p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 18, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col w-full md:max-w-3xl max-h-[92dvh] md:max-h-[88vh] overflow-hidden rounded-t-2xl md:rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar (Mobile Back + Desktop Close) */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 sm:px-6 bg-white shrink-0">
          <button
            ref={closeButtonRef}
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-7 space-y-6">
          {isCancelled && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs sm:text-sm text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-[#DC2626] mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">This event has been cancelled.</p>
                {event.cancellationReason && (
                  <p className="mt-0.5 text-red-700">{event.cancellationReason}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-6 md:gap-7 items-start">
            {/* Left Column: Cover Image & Quick Facts */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                <EventImage
                  eventId={event.id}
                  title={event.title}
                  category={event.category}
                  imageUrl={event.imageUrl}
                  priority
                  className={`aspect-[16/10] w-full ${isCancelled ? 'opacity-70 grayscale-[35%]' : ''}`}
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
                    <p className="font-mono text-sm font-semibold text-[#171717]">{timeRange}</p>
                    <p className="font-mono text-[11px] text-[#737373]">{event.timezone}</p>
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

              {/* Capacity & Registration Window Summary */}
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#171717]">
                    <Users className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                    <span>Registration &amp; Capacity</span>
                  </span>
                  <span className="font-mono tabular-nums text-xs font-semibold text-[#171717]">
                    {capacity.capacityLimit !== null
                      ? `${capacity.confirmedCount} / ${capacity.capacityLimit}`
                      : `${capacity.confirmedCount} confirmed`}
                  </span>
                </div>

                {capacity.capacityLimit !== null && capacity.utilizationPercent !== null && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          capacity.isFull ? 'bg-[#D97706]' : 'bg-[#E85D04]'
                        }`}
                        style={{ width: `${capacity.utilizationPercent}%` }}
                      />
                    </div>
                    <p className="font-mono tabular-nums text-[11px] text-[#737373]">
                      {capacity.isFull
                        ? event.allowWaitlist
                          ? `Full · Waitlist open (${capacity.waitlistCount} waiting)`
                          : 'Event has reached capacity'
                        : `${capacity.remainingSpots} ${capacity.remainingSpots === 1 ? 'spot' : 'spots'} remaining`}
                    </p>
                  </div>
                )}

                {capacity.capacityLimit === null && (
                  <p className="text-[11px] text-[#737373]">
                    Open capacity
                    {event.requireApproval ? ' · Organizer approval required' : ''}
                  </p>
                )}

                {event.requireApproval && capacity.capacityLimit !== null && (
                  <p className="text-[11px] text-[#737373]">
                    Organizer approval required for confirmation.
                  </p>
                )}

                {(event.registrationOpensAt || event.registrationClosesAt) && (
                  <div className="pt-2 border-t border-[#E5E7EB] space-y-1 text-[11px] text-[#737373]">
                    {event.registrationOpensAt && (
                      <p>
                        Opens:{' '}
                        <span className="font-mono text-[#171717]">
                          {formatEventDateTime(event.registrationOpensAt, new Date(), event.timezone)}
                        </span>
                      </p>
                    )}
                    {event.registrationClosesAt && (
                      <p>
                        Closes:{' '}
                        <span className="font-mono text-[#171717]">
                          {formatEventDateTime(event.registrationClosesAt, new Date(), event.timezone)}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Title, Club, Description & Actions */}
            <div className="flex flex-col justify-between h-full space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <CategoryBadge category={event.category} size="md" />
                  {(event.status !== 'published' || event.visibility === 'school' || isPast) && (
                    <EventStatusBadge
                      status={event.status}
                      visibility={event.visibility}
                      isPast={isPast}
                    />
                  )}
                  <span className="text-xs font-medium text-[#737373]">
                    Hosted by{' '}
                    {onSelectClubById ? (
                      <button
                        type="button"
                        onClick={() => {
                          const targetClubId = event.clubId;
                          onClose();
                          onSelectClubById(targetClubId);
                        }}
                        className="font-semibold text-[#171717] hover:text-[#E85D04] hover:underline cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
                      >
                        {event.hostClub}
                      </button>
                    ) : (
                      event.hostClub
                    )}
                  </span>
                </div>

                <h2
                  id="event-detail-title"
                  className="font-display text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#171717] leading-tight"
                >
                  {event.title}
                </h2>

                {/* Student Registration Status Callout */}
                {hasActiveRegistration && (
                  <div
                    className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs ${
                      isAttended || isConfirmed
                        ? 'border-[#16A34A]/25 bg-[#16A34A]/5 text-[#15803D]'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <p className="font-semibold">
                      {isAttended
                        ? 'Checked in — your attendance has been recorded.'
                        : isConfirmed
                          ? 'Your spot is confirmed.'
                          : isPending
                            ? 'Registration requested — awaiting organizer approval.'
                            : 'You are on the waitlist. Organizers promote waitlisted students in queue order when spots open.'}
                    </p>
                    {isWaitlisted && resolvedLifecycle.registration?.offerExpiresAt && (
                      <p className="mt-1 font-mono text-[11px]">
                        Offer window until{' '}
                        {formatEventDateTime(
                          resolvedLifecycle.registration.offerExpiresAt,
                          new Date(),
                          event.timezone
                        )}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-5 border-t border-[#E5E7EB] pt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-2">
                    About this event
                  </h3>
                  <p className="text-sm sm:text-[15px] text-[#404040] leading-relaxed">
                    {event.description || 'Details provided by the hosting student organization.'}
                  </p>
                </div>

                {/* Event-Day Check-In Readiness (Honest Starter Tier architecture) */}
                {(isConfirmed || isAttended) && !isCancelled && (
                  <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#171717]">
                      <QrCode className="h-3.5 w-3.5 text-[#E85D04] shrink-0" aria-hidden="true" />
                      <span>Event-Day Check-In</span>
                    </div>
                    {isAttended && resolvedLifecycle.attendance?.checkedInAt ? (
                      <p className="text-xs text-[#15803D]">
                        Checked in on{' '}
                        <span className="font-mono font-medium">
                          {formatEventDateTime(
                            resolvedLifecycle.attendance.checkedInAt,
                            new Date(),
                            event.timezone
                          )}
                        </span>
                        .
                      </p>
                    ) : (
                      <p className="text-xs text-[#525252] leading-relaxed">
                        Give your name at the venue entrance so the host organizer can record your check-in. Cryptographically signed QR passes are disabled on Starter Tier until server-side token signing is enabled.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop Action Buttons */}
              <div className="hidden md:flex flex-col gap-2.5 pt-5 border-t border-[#E5E7EB]">
                <motion.button
                  type="button"
                  disabled={buttonBlocked}
                  onClick={() => {
                    if (!buttonBlocked) onRsvpClick(event);
                  }}
                  aria-pressed={hasActiveRegistration}
                  whileTap={buttonBlocked ? undefined : { scale: 0.98 }}
                  className={`inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${ctaTone}`}
                >
                  {ctaIcon === 'attended' && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {ctaIcon === 'check' && <Check className="h-4 w-4" aria-hidden="true" />}
                  {ctaIcon === 'pending' && <Hourglass className="h-4 w-4" aria-hidden="true" />}
                  {ctaIcon === 'waitlist' && <ListPlus className="h-4 w-4" aria-hidden="true" />}
                  <span>{desktopCtaLabel}</span>
                </motion.button>

                {!isCancelled && (
                  <a
                    href={googleCalendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
                  >
                    <CalendarPlus className="h-4 w-4 text-[#737373]" aria-hidden="true" />
                    <span>Add to Google Calendar</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Event Announcements Section */}
          {(loadingAnnouncements || announcements.length > 0) && (
            <section
              aria-labelledby="event-announcements-heading"
              className="border-t border-[#E5E7EB] pt-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <h3
                  id="event-announcements-heading"
                  className="font-display text-sm font-bold text-[#171717]"
                >
                  Organizer Announcements
                </h3>
                {announcements.length > 0 && (
                  <span className="font-mono tabular-nums text-xs text-[#737373]">
                    ({announcements.length})
                  </span>
                )}
              </div>

              {loadingAnnouncements ? (
                <p className="text-xs text-[#737373]">Loading event updates...</p>
              ) : (
                <div className="space-y-2.5">
                  {announcements.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-[#171717]">
                          {item.title}
                        </h4>
                        <span className="font-mono text-[11px] text-[#737373]">
                          {formatEventDateTime(item.createdAt, new Date(), event.timezone)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
                        {item.message}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Post-Event Feedback Section (Shown only after event ends for eligible signed-in participants) */}
          {isPast && isSignedIn && (
            <div className="border-t border-[#E5E7EB] pt-5">
              <PostEventFeedbackCard
                event={event}
                userUid={userUid}
                isVerifiedUser={isVerifiedUser}
                isSuspendedMember={isSuspendedMember}
                lifecycle={resolvedLifecycle}
                onShowToast={onShowToast}
              />
            </div>
          )}
        </div>

        {/* Mobile Sticky Action Footer */}
        <div className="md:hidden border-t border-[#E5E7EB] bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2.5 shrink-0">
          {!isCancelled && (
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
          )}

          <button
            type="button"
            disabled={buttonBlocked}
            onClick={() => {
              if (!buttonBlocked) onRsvpClick(event);
            }}
            aria-pressed={hasActiveRegistration}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${ctaTone}`}
          >
            {ctaIcon === 'attended' && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {ctaIcon === 'check' && <Check className="h-4 w-4" aria-hidden="true" />}
            {ctaIcon === 'pending' && <Hourglass className="h-4 w-4" aria-hidden="true" />}
            {ctaIcon === 'waitlist' && <ListPlus className="h-4 w-4" aria-hidden="true" />}
            <span>{mobileCtaLabel}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

