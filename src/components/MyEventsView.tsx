import type { User } from 'firebase/auth';
import {
  BookmarkCheck,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Compass,
  Hourglass,
  ListPlus,
  MapPin,
  Megaphone,
  MessageSquarePlus,
  QrCode,
} from 'lucide-react';
import type { SchoolEvent } from '../types/event';
import type {
  EventAnnouncementRecord,
  StudentEventLifecycleState,
} from '../types/eventOperations';
import {
  buildGoogleCalendarUrl,
  formatEventDateTime,
  getDateTileParts,
  groupEventsByDate,
} from '../utils/events';
import { isPastEvent } from '../utils/eventValidation';
import { EventCard } from './EventCard';

interface MyEventsViewProps {
  user: User | null;
  events: SchoolEvent[];
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  getLifecycleState?: (event: SchoolEvent) => StudentEventLifecycleState;
  announcementsByEventId?: Record<string, EventAnnouncementRecord[]>;
  isEventActionBusy?: (eventId: string) => boolean;
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSelectClubById?: (clubId: string) => void;
  onSignIn: () => void;
  onExplore: () => void;
}

function lifecycleLabelAndTone(status: StudentEventLifecycleState['status']) {
  switch (status) {
    case 'attended':
      return {
        label: 'Attended · Checked In',
        tone: 'text-[#15803D] bg-[#16A34A]/10 border-[#16A34A]/25',
        icon: CheckCircle2,
      };
    case 'confirmed':
      return {
        label: 'Confirmed',
        tone: 'text-[#15803D] bg-[#16A34A]/10 border-[#16A34A]/25',
        icon: CheckCircle2,
      };
    case 'pending_approval':
      return {
        label: 'Pending Approval',
        tone: 'text-amber-800 bg-amber-50 border-amber-200',
        icon: Hourglass,
      };
    case 'waitlisted':
      return {
        label: 'Waitlisted',
        tone: 'text-amber-800 bg-amber-50 border-amber-200',
        icon: ListPlus,
      };
    default:
      return {
        label: 'Not Registered',
        tone: 'text-[#525252] bg-[#F3F4F6] border-[#E5E7EB]',
        icon: Calendar,
      };
  }
}

function DateGroupedSchedule({
  events,
  getEffectiveRsvp,
  getLifecycleState,
  isEventActionBusy,
  isSignedIn,
  showFeedbackCue = false,
  onRsvpClick,
  onSelectEvent,
  onSelectClubById,
}: {
  events: SchoolEvent[];
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  getLifecycleState?: (event: SchoolEvent) => StudentEventLifecycleState;
  isEventActionBusy?: (eventId: string) => boolean;
  isSignedIn: boolean;
  showFeedbackCue?: boolean;
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSelectClubById?: (clubId: string) => void;
}) {
  const dateGroups = groupEventsByDate(events);
  let cardIndex = 0;

  return (
    <div className="space-y-6">
      {dateGroups.map((group) => {
        const firstDate = group.events[0]?.startAt ?? group.events[0]?.dateTime;
        const tile = firstDate ? getDateTileParts(firstDate, group.events[0]?.timezone) : null;

        return (
          <div key={group.dateKey} className="space-y-3">
            <div className="flex items-center gap-3">
              {tile && (
                <div
                  className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-white shadow-xs"
                  aria-hidden="true"
                >
                  <span className="font-mono text-[9px] font-bold tracking-wider text-[#E85D04] leading-none">
                    {tile.month}
                  </span>
                  <span className="mt-0.5 font-display text-sm font-extrabold text-[#171717] leading-none">
                    {tile.day}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-display text-sm sm:text-base font-bold text-[#171717]">
                  {group.label}
                </h3>
                <span className="font-mono tabular-nums text-xs text-[#737373]">
                  · {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
                </span>
              </div>
            </div>

            <div className="space-y-3.5">
              {group.events.map((event) => {
                const { rsvpCount, isGoing } = getEffectiveRsvp(event);
                const lifecycle = getLifecycleState ? getLifecycleState(event) : undefined;
                const canLeaveFeedback =
                  showFeedbackCue &&
                  event.status === 'published' &&
                  (lifecycle
                    ? lifecycle.status === 'confirmed' || lifecycle.status === 'attended'
                    : isGoing);

                return (
                  <div key={event.id} className="space-y-2">
                    <EventCard
                      event={event}
                      index={cardIndex++}
                      rsvpCount={rsvpCount}
                      isGoing={isGoing}
                      isSignedIn={isSignedIn}
                      lifecycle={lifecycle}
                      isBusy={isEventActionBusy ? isEventActionBusy(event.id) : false}
                      onRsvpClick={onRsvpClick}
                      onSelectEvent={onSelectEvent}
                      onSelectClubById={onSelectClubById}
                    />
                    {canLeaveFeedback && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => onSelectEvent(event)}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:border-[#E85D04]/40 hover:text-[#E85D04] transition-colors cursor-pointer"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Share Post-Event Feedback</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MyEventsView({
  user,
  events,
  getEffectiveRsvp,
  getLifecycleState,
  announcementsByEventId = {},
  isEventActionBusy,
  onRsvpClick,
  onSelectEvent,
  onSelectClubById,
  onSignIn,
  onExplore,
}: MyEventsViewProps) {
  if (!user) {
    return (
      <section className="mx-auto max-w-2xl py-6 sm:py-10">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#E85D04]">
            <BookmarkCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#171717]">
            Your saved campus schedule
          </h1>
          <p className="mt-2 text-sm text-[#737373] max-w-md mx-auto leading-relaxed">
            Sign in with your Google account to track registered events, waitlist status, organizer updates, and post-event feedback.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-xl bg-[#E85D04] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
            >
              Sign in with Google
            </button>
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            >
              <Compass className="h-4 w-4 text-[#737373]" aria-hidden="true" />
              <span>Explore Events</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const now = new Date();

  const resolveState = (event: SchoolEvent): StudentEventLifecycleState => {
    if (getLifecycleState) return getLifecycleState(event);
    const { isGoing } = getEffectiveRsvp(event);
    return {
      status: isGoing ? 'confirmed' : 'not_registered',
      source: isGoing ? 'legacy_rsvp' : 'none',
      registration: null,
      attendance: null,
      waitlistPosition: null,
    };
  };

  const myActiveUpcoming: { event: SchoolEvent; lifecycle: StudentEventLifecycleState }[] = [];
  const otherUpcoming: SchoolEvent[] = [];
  const pastEvents: SchoolEvent[] = [];

  for (const event of events) {
    const lc = resolveState(event);
    const isTracked =
      lc.status === 'confirmed' ||
      lc.status === 'pending_approval' ||
      lc.status === 'waitlisted' ||
      lc.status === 'attended';
    const past = isPastEvent(event, now);

    if (past) {
      if (isTracked) {
        pastEvents.push(event);
      }
    } else if (isTracked) {
      myActiveUpcoming.push({ event, lifecycle: lc });
    } else {
      otherUpcoming.push(event);
    }
  }

  const confirmedCount = myActiveUpcoming.filter(
    (item) => item.lifecycle.status === 'confirmed' || item.lifecycle.status === 'attended'
  ).length;
  const waitlistOrPendingCount = myActiveUpcoming.filter(
    (item) =>
      item.lifecycle.status === 'waitlisted' || item.lifecycle.status === 'pending_approval'
  ).length;

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E7EB] pb-6">
        <div>
          <p className="font-mono text-xs font-medium text-[#E85D04]">My Schedule &amp; Preparation</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
            My Events
          </h1>
          <p className="mt-1 text-sm text-[#737373]">
            Signed in as {user.displayName || user.email}. Track confirmations, waitlists, organizer announcements, and check-in readiness.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 shadow-xs">
            <p className="text-[11px] font-medium text-[#737373]">Confirmed</p>
            <p className="font-mono tabular-nums text-lg font-bold text-[#171717]">
              {confirmedCount}
            </p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 shadow-xs">
            <p className="text-[11px] font-medium text-[#737373]">Waitlist / Pending</p>
            <p className="font-mono tabular-nums text-lg font-bold text-[#171717]">
              {waitlistOrPendingCount}
            </p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 shadow-xs">
            <p className="text-[11px] font-medium text-[#737373]">Past</p>
            <p className="font-mono tabular-nums text-lg font-bold text-[#171717]">
              {pastEvents.length}
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Event Preparation Cards (Confirmed, Pending Approval, Waitlisted, Attended) */}
      <section aria-labelledby="my-attending-heading">
        <div className="mb-4 flex items-center gap-3">
          <h2
            id="my-attending-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
          >
            Upcoming Registrations &amp; Preparation
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {myActiveUpcoming.length} {myActiveUpcoming.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {myActiveUpcoming.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
            <p className="font-display text-base font-semibold text-[#171717]">
              No active registrations yet
            </p>
            <p className="mt-1 text-sm text-[#737373]">
              Register for any upcoming campus event to see preparation details, announcements, and check-in readiness here.
            </p>
            <button
              type="button"
              onClick={onExplore}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
            >
              Browse upcoming events
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myActiveUpcoming.map(({ event, lifecycle }) => {
              const badge = lifecycleLabelAndTone(lifecycle.status);
              const StatusIcon = badge.icon;
              const eventAnnouncements = announcementsByEventId[event.id] ?? [];
              const latestAnnouncement = eventAnnouncements[0] ?? null;
              const busy = isEventActionBusy ? isEventActionBusy(event.id) : false;
              const isCancelled = event.status === 'cancelled';
              const canCancel = lifecycle.status !== 'attended';
              const googleCalendarUrl = buildGoogleCalendarUrl(event);

              return (
                <article
                  key={event.id}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}
                        >
                          <StatusIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>{badge.label}</span>
                        </span>
                        {isCancelled && (
                          <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#B91C1C]">
                            Event Cancelled
                          </span>
                        )}
                        <span className="text-xs font-medium text-[#737373] truncate">
                          {event.hostClub}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectEvent(event)}
                        className="block text-left font-display text-lg sm:text-xl font-bold text-[#171717] hover:text-[#E85D04] transition-colors cursor-pointer"
                      >
                        {event.title}
                      </button>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#525252]">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                          <span className="font-mono font-medium text-[#171717]">
                            {formatEventDateTime(event.startAt, now, event.timezone)}
                          </span>
                        </span>
                        <span aria-hidden="true" className="text-[#D1D5DB]">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                          <span>{event.location}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isCancelled && (
                        <a
                          href={googleCalendarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors"
                        >
                          <CalendarPlus className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                          <span>Calendar</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectEvent(event)}
                        className="inline-flex min-h-[38px] items-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#E5E7EB]/60 transition-colors cursor-pointer"
                      >
                        Event Details
                      </button>
                      {canCancel && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onRsvpClick(event)}
                          className="inline-flex min-h-[38px] items-center rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {busy
                            ? 'Updating...'
                            : lifecycle.status === 'waitlisted'
                              ? 'Leave Waitlist'
                              : lifecycle.status === 'pending_approval'
                                ? 'Cancel Request'
                                : 'Cancel Registration'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Check-in readiness + latest organizer announcement strip */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#E5E7EB]/80 text-xs">
                    <div className="flex items-start gap-2 text-[#525252]">
                      <QrCode className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-[#171717]">Check-In Status</p>
                        <p className="mt-0.5 leading-relaxed">
                          {lifecycle.status === 'attended'
                            ? 'Checked in by organizer.'
                            : lifecycle.status === 'confirmed'
                              ? 'Ready for venue check-in via organizer roster (signed QR passes require Blaze Cloud Functions).'
                              : lifecycle.status === 'pending_approval'
                                ? 'Awaiting organizer confirmation before check-in opens.'
                                : 'Waitlisted — check-in activates if promoted to confirmed.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-[#525252]">
                      <Megaphone className="h-4 w-4 text-[#737373] mt-0.5 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-semibold text-[#171717]">
                          Latest Organizer Update
                          {eventAnnouncements.length > 1 ? ` (${eventAnnouncements.length})` : ''}
                        </p>
                        {latestAnnouncement ? (
                          <p className="mt-0.5 leading-relaxed line-clamp-2">
                            <span className="font-medium text-[#171717]">
                              {latestAnnouncement.title}:
                            </span>{' '}
                            {latestAnnouncement.message}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[#737373]">
                            No event updates posted yet. Check back before start time.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: More Upcoming Events */}
      <section aria-labelledby="my-upcoming-heading">
        <div className="mb-4 flex items-center gap-3">
          <h2
            id="my-upcoming-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
          >
            More Upcoming Campus Events
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {otherUpcoming.length} {otherUpcoming.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {otherUpcoming.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
            <p className="text-sm text-[#737373]">No other upcoming events scheduled right now.</p>
          </div>
        ) : (
          <DateGroupedSchedule
            events={otherUpcoming}
            getEffectiveRsvp={getEffectiveRsvp}
            getLifecycleState={getLifecycleState}
            isEventActionBusy={isEventActionBusy}
            isSignedIn={Boolean(user)}
            onRsvpClick={onRsvpClick}
            onSelectEvent={onSelectEvent}
            onSelectClubById={onSelectClubById}
          />
        )}
      </section>

      {/* Section 3: Past Registered / Attended Events with Post-Event Feedback */}
      <section aria-labelledby="my-past-heading">
        <div className="mb-4 flex items-center gap-3">
          <h2
            id="my-past-heading"
            className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
          >
            Past Events &amp; Feedback
          </h2>
          <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
          <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
            {pastEvents.length} {pastEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {pastEvents.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white px-6 py-5 flex items-center gap-3 text-sm text-[#737373]">
            <Calendar className="h-4 w-4 text-[#737373] shrink-0" aria-hidden="true" />
            <span>You have no past registered events from this semester yet.</span>
          </div>
        ) : (
          <DateGroupedSchedule
            events={pastEvents}
            getEffectiveRsvp={getEffectiveRsvp}
            getLifecycleState={getLifecycleState}
            isEventActionBusy={isEventActionBusy}
            isSignedIn={Boolean(user)}
            showFeedbackCue
            onRsvpClick={onRsvpClick}
            onSelectEvent={onSelectEvent}
            onSelectClubById={onSelectClubById}
          />
        )}
      </section>
    </div>
  );
}

