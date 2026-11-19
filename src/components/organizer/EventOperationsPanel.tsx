import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Edit3,
  Lock,
  Megaphone,
  MessageSquare,
  QrCode,
  Unlock,
  Users,
  XCircle,
} from 'lucide-react';
import {
  listEventAnnouncements,
  listEventAttendance,
  listEventFeedbackForOrganizer,
  listEventRegistrations,
} from '../../services/eventOperationsService';
import { updateEventRegistrationControls } from '../../services/eventService';
import type { SchoolEvent } from '../../types/event';
import type {
  EventAnnouncementRecord,
  EventAttendanceRecord,
  EventFeedbackRecord,
  EventRegistrationRecord,
} from '../../types/eventOperations';
import type { SchoolMembership } from '../../types/membership';
import { formatEventDateTime } from '../../utils/events';
import { canOperateEvent } from '../../utils/eventOperations';
import { getEventCapacitySnapshot } from '../../utils/eventRegistration';
import { isPastEvent } from '../../utils/eventValidation';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';
import { AttendanceCheckInPanel } from './AttendanceCheckInPanel';
import { EventAnnouncementsManager } from './EventAnnouncementsManager';
import { EventFeedbackSummaryPanel } from './EventFeedbackSummaryPanel';
import { EventStatusBadge } from './EventStatusBadge';
import { RegistrationWaitlistManager } from './RegistrationWaitlistManager';

export type OperationsSubTab = 'registrations' | 'checkin' | 'announcements' | 'feedback';

interface EventOperationsPanelProps {
  events: SchoolEvent[];
  membership: SchoolMembership;
  managedClubIds: ReadonlySet<string>;
  organizerUid: string;
  initialEventId?: string | null;
  initialSubTab?: OperationsSubTab;
  onEditEvent: (event: SchoolEvent) => void;
  onCancelEvent: (event: SchoolEvent) => void;
  onViewEvent: (event: SchoolEvent) => void;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

export function EventOperationsPanel({
  events,
  membership,
  managedClubIds,
  organizerUid,
  initialEventId = null,
  initialSubTab = 'registrations',
  onEditEvent,
  onCancelEvent,
  onViewEvent,
  onShowToast,
}: EventOperationsPanelProps) {
  const authorizedEvents = useMemo(
    () =>
      events
        .filter((evt) => canOperateEvent(evt, membership, managedClubIds))
        .slice()
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
    [events, managedClubIds, membership]
  );

  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [activeSubTab, setActiveSubTab] = useState<OperationsSubTab>(initialSubTab);
  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);

  // Selected event operational subcollections
  const [registrations, setRegistrations] = useState<EventRegistrationRecord[]>([]);
  const [attendance, setAttendance] = useState<EventAttendanceRecord[]>([]);
  const [announcements, setAnnouncements] = useState<EventAnnouncementRecord[]>([]);
  const [feedbackRecords, setFeedbackRecords] = useState<EventFeedbackRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (initialEventId) {
      setSelectedEventId(initialEventId);
      setActiveSubTab(initialSubTab);
    }
  }, [initialEventId, initialSubTab]);

  const selectedEvent = useMemo(
    () => authorizedEvents.find((e) => e.id === selectedEventId) ?? null,
    [authorizedEvents, selectedEventId]
  );

  const loadSelectedEventOperations = useCallback(async (eventId: string) => {
    setLoadingDetails(true);
    try {
      const [regs, att, anns, fbs] = await Promise.all([
        listEventRegistrations(eventId),
        listEventAttendance(eventId),
        listEventAnnouncements(eventId, true),
        listEventFeedbackForOrganizer(eventId),
      ]);
      setRegistrations(regs);
      setAttendance(att);
      setAnnouncements(anns);
      setFeedbackRecords(fbs);
    } catch (err) {
      onShowToast(
        'error',
        toUserFriendlyErrorMessage(err, 'Could not load event operations data.')
      );
    } finally {
      setLoadingDetails(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    if (!selectedEvent) {
      setRegistrations([]);
      setAttendance([]);
      setAnnouncements([]);
      setFeedbackRecords([]);
      return;
    }
    void loadSelectedEventOperations(selectedEvent.id);
  }, [loadSelectedEventOperations, selectedEvent?.id]);

  const handleOpenEventWorkspace = (eventId: string, subTab: OperationsSubTab) => {
    setSelectedEventId(eventId);
    setActiveSubTab(subTab);
  };

  const handleQuickToggleRegistration = async (evt: SchoolEvent) => {
    if (evt.status === 'cancelled') return;
    setBusyToggleId(evt.id);
    try {
      const nextStatus = evt.registrationStatus === 'closed' ? 'open' : 'closed';
      await updateEventRegistrationControls({
        event: evt,
        registrationStatus: nextStatus,
      });
      onShowToast(
        'success',
        nextStatus === 'closed'
          ? `Closed registration for "${evt.title}".`
          : `Reopened registration for "${evt.title}".`
      );
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not toggle registration status.'));
    } finally {
      setBusyToggleId(null);
    }
  };

  // Detail workspace for a selected event
  if (selectedEvent) {
    const capacity = getEventCapacitySnapshot(selectedEvent);
    const isPast = isPastEvent(selectedEvent);

    const subTabs: { id: OperationsSubTab; label: string; icon: typeof Users; badge?: number }[] = [
      {
        id: 'registrations',
        label: 'Registrations & Waitlist',
        icon: Users,
        badge: registrations.filter((r) => r.status !== 'cancelled').length,
      },
      {
        id: 'checkin',
        label: 'Check-In & Attendance',
        icon: QrCode,
        badge: selectedEvent.checkedInCount ?? attendance.filter((a) => a.status === 'checked_in').length,
      },
      {
        id: 'announcements',
        label: 'Announcements',
        icon: Megaphone,
        badge: announcements.filter((a) => a.status === 'active').length,
      },
      {
        id: 'feedback',
        label: 'Post-Event Feedback',
        icon: MessageSquare,
        badge: feedbackRecords.length,
      },
    ];

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedEventId(null)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>All Event Operations</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onViewEvent(selectedEvent)}
                className="inline-flex min-h-[34px] items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
              >
                Preview Page
              </button>
              <button
                type="button"
                onClick={() => onEditEvent(selectedEvent)}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                <span>Edit Event</span>
              </button>
              {selectedEvent.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => onCancelEvent(selectedEvent)}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-red-50 cursor-pointer"
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cancel Event</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <EventStatusBadge
                status={selectedEvent.status}
                visibility={selectedEvent.visibility}
                isPast={isPast}
              />
              <span className="font-mono text-xs text-[#737373]">{selectedEvent.hostClub}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#171717]">
              {selectedEvent.title}
            </h2>
            <p className="text-xs text-[#737373]">
              <span className="font-mono text-[#171717]">
                {formatEventDateTime(selectedEvent.startAt, new Date(), selectedEvent.timezone)}
              </span>
              {' · '}
              {selectedEvent.location}
              {' · '}
              <span className="font-mono tabular-nums text-[#171717]">
                {capacity.confirmedCount}
                {capacity.capacityLimit !== null ? `/${capacity.capacityLimit}` : ''} confirmed
              </span>
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E5E7EB]"
            role="tablist"
            aria-label="Event operations sections"
          >
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#171717] text-white'
                      : 'border border-[#E5E7EB] bg-[#F8F9FA] text-[#525252] hover:text-[#171717]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && (
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        active ? 'text-white/80' : 'text-[#737373]'
                      }`}
                    >
                      ({tab.badge})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
          {activeSubTab === 'registrations' ? (
            <RegistrationWaitlistManager
              event={selectedEvent}
              organizerUid={organizerUid}
              registrations={registrations}
              loading={loadingDetails}
              onRefresh={() => loadSelectedEventOperations(selectedEvent.id)}
              onShowToast={onShowToast}
            />
          ) : activeSubTab === 'checkin' ? (
            <AttendanceCheckInPanel
              event={selectedEvent}
              organizerUid={organizerUid}
              registrations={registrations}
              attendance={attendance}
              loading={loadingDetails}
              onRefresh={() => loadSelectedEventOperations(selectedEvent.id)}
              onShowToast={onShowToast}
            />
          ) : activeSubTab === 'announcements' ? (
            <EventAnnouncementsManager
              event={selectedEvent}
              organizerUid={organizerUid}
              announcements={announcements}
              loading={loadingDetails}
              onRefresh={() => loadSelectedEventOperations(selectedEvent.id)}
              onShowToast={onShowToast}
            />
          ) : (
            <EventFeedbackSummaryPanel
              event={selectedEvent}
              feedbackRecords={feedbackRecords}
              loading={loadingDetails}
            />
          )}
        </div>
      </div>
    );
  }

  // Operations Overview across all authorized managed events
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-medium text-[#E85D04]">Event Operations Center</p>
          <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight text-[#171717]">
            Registrations, Check-In &amp; Feedback
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#737373]">
            Monitor capacity utilization, promote waitlisted students, check in attendees on event day, post live updates, and review anonymized feedback.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 font-mono tabular-nums text-xs text-[#737373]">
          <ClipboardCheck className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
          <span>
            {authorizedEvents.length} {authorizedEvents.length === 1 ? 'event' : 'events'} in scope
          </span>
        </div>
      </div>

      {authorizedEvents.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center space-y-2">
          <CalendarDays className="mx-auto h-6 w-6 text-[#A3A3A3]" aria-hidden="true" />
          <p className="font-display text-base font-bold text-[#171717]">
            No events available for operations
          </p>
          <p className="text-xs sm:text-sm text-[#737373]">
            Create and publish an event from the My Events tab to manage registrations, attendance, announcements, and feedback.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {authorizedEvents.map((evt) => {
            const cap = getEventCapacitySnapshot(evt);
            const isPast = isPastEvent(evt);
            const isClosed = evt.registrationStatus === 'closed';
            const isToggling = busyToggleId === evt.id;

            return (
              <article
                key={evt.id}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 space-y-4 shadow-xs"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <EventStatusBadge
                        status={evt.status}
                        visibility={evt.visibility}
                        isPast={isPast}
                      />
                      <span className="font-mono text-[11px] font-medium text-[#525252]">
                        Reg: {cap.effectiveRegistrationStatus}
                      </span>
                      <span className="text-xs text-[#737373] truncate">· {evt.hostClub}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEventWorkspace(evt.id, 'registrations')}
                      className="block text-left font-display text-lg font-bold text-[#171717] hover:text-[#E85D04] transition-colors cursor-pointer"
                    >
                      {evt.title}
                    </button>

                    <p className="text-xs text-[#737373]">
                      <span className="font-mono text-[#171717]">
                        {formatEventDateTime(evt.startAt, new Date(), evt.timezone)}
                      </span>
                      {' · '}
                      {evt.location}
                    </p>
                  </div>

                  {/* Tabular Operations Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2">
                      <p className="text-[10px] font-medium text-[#737373]">Confirmed</p>
                      <p className="font-mono tabular-nums text-sm font-bold text-[#171717]">
                        {cap.confirmedCount}
                        {cap.capacityLimit !== null ? `/${cap.capacityLimit}` : ''}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2">
                      <p className="text-[10px] font-medium text-[#737373]">Waitlist</p>
                      <p className="font-mono tabular-nums text-sm font-bold text-[#171717]">
                        {cap.waitlistCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2">
                      <p className="text-[10px] font-medium text-[#737373]">Checked In</p>
                      <p className="font-mono tabular-nums text-sm font-bold text-[#15803D]">
                        {cap.checkedInCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2">
                      <p className="text-[10px] font-medium text-[#737373]">Feedback</p>
                      <p className="font-mono tabular-nums text-sm font-bold text-[#171717]">
                        {evt.feedbackCount ?? 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Operations Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5E7EB]">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEventWorkspace(evt.id, 'registrations')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#333333] cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Manage Registrations</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEventWorkspace(evt.id, 'checkin')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#DC2F02] cursor-pointer"
                    >
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Open Check-In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEventWorkspace(evt.id, 'announcements')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                    >
                      <Megaphone className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                      <span>Announcements</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEventWorkspace(evt.id, 'feedback')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                      <span>Feedback</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {evt.status === 'published' && !isPast && (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => void handleQuickToggleRegistration(evt)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#525252] hover:bg-[#F8F9FA] hover:text-[#171717] disabled:opacity-50 cursor-pointer"
                      >
                        {isClosed ? (
                          <>
                            <Unlock className="h-3 w-3" aria-hidden="true" />
                            <span>Reopen Reg</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            <span>Close Reg</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditEvent(evt)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#525252] hover:bg-[#F8F9FA] hover:text-[#171717] cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" aria-hidden="true" />
                      <span>Edit</span>
                    </button>
                    {evt.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => onCancelEvent(evt)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-[#DC2626] hover:bg-red-50 cursor-pointer"
                      >
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
