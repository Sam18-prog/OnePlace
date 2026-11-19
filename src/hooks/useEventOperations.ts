import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  cancelStudentRegistration,
  fetchActiveAnnouncementsForEvents,
  fetchUserEventOperationsForEvents,
  registerStudentForEvent,
} from '../services/eventOperationsService';
import type { SchoolEvent } from '../types/event';
import type {
  EventAnnouncementRecord,
  EventAttendanceRecord,
  EventRegistrationRecord,
  StudentEventLifecycleState,
} from '../types/eventOperations';
import type { MembershipCapabilities, SchoolMembership } from '../types/membership';
import {
  evaluateStudentCancellationAttempt,
  evaluateStudentRegistrationAttempt,
  resolveStudentEventLifecycleState,
} from '../utils/eventRegistration';
import { logClientDiagnostic, toUserFriendlyErrorMessage } from '../utils/errorHandling';

export function useEventOperations(params: {
  user: User | null;
  authLoading: boolean;
  events: SchoolEvent[];
  membership: SchoolMembership | null;
  capabilities: MembershipCapabilities;
  getEffectiveRsvp: (event: SchoolEvent) => { isGoing: boolean; rsvpCount: number };
  onShowToast: (type: 'error' | 'success', message: string) => void;
}) {
  const {
    user,
    authLoading,
    events,
    membership,
    capabilities,
    getEffectiveRsvp,
    onShowToast,
  } = params;

  const [registrationsByEventId, setRegistrationsByEventId] = useState<
    Record<string, EventRegistrationRecord | null>
  >({});
  const [attendanceByEventId, setAttendanceByEventId] = useState<
    Record<string, EventAttendanceRecord | null>
  >({});
  const [announcementsByEventId, setAnnouncementsByEventId] = useState<
    Record<string, EventAnnouncementRecord[]>
  >({});
  const [busyEventIds, setBusyEventIds] = useState<ReadonlySet<string>>(() => new Set());

  const inflightRef = useRef<Set<string>>(new Set());

  const eventIdsSignature = useMemo(() => events.map((e) => e.id).join(','), [events]);

  // Load owner-scoped registration and attendance records for visible events
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRegistrationsByEventId({});
      setAttendanceByEventId({});
      setAnnouncementsByEventId({});
      return;
    }

    const ids = eventIdsSignature ? eventIdsSignature.split(',') : [];
    if (ids.length === 0) return;

    let cancelled = false;
    void fetchUserEventOperationsForEvents(ids, user.uid)
      .then((res) => {
        if (cancelled) return;
        setRegistrationsByEventId(res.registrationsByEventId);
        setAttendanceByEventId(res.attendanceByEventId);
      })
      .catch((err) => {
        logClientDiagnostic('Fetch user event operations failed', err);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, eventIdsSignature, user]);

  const getLifecycleState = useCallback(
    (event: SchoolEvent): StudentEventLifecycleState => {
      const legacyIsGoing = getEffectiveRsvp(event).isGoing;
      const registration = registrationsByEventId[event.id] ?? null;
      const attendance = attendanceByEventId[event.id] ?? null;
      return resolveStudentEventLifecycleState({
        legacyIsGoing,
        registration,
        attendance,
      });
    },
    [attendanceByEventId, getEffectiveRsvp, registrationsByEventId]
  );

  // Determine which events the student is actively registered/attending/waitlisted for
  const trackedEventIdsKey = useMemo(() => {
    if (!user) return '';
    const ids: string[] = [];
    for (const evt of events) {
      const state = getLifecycleState(evt);
      if (
        state.status === 'confirmed' ||
        state.status === 'waitlisted' ||
        state.status === 'pending_approval' ||
        state.status === 'attended'
      ) {
        ids.push(evt.id);
      }
    }
    return ids.join(',');
  }, [events, getLifecycleState, user]);

  // Fetch active event announcements for registered/waitlisted/attended events
  useEffect(() => {
    if (!user || !trackedEventIdsKey) {
      setAnnouncementsByEventId({});
      return;
    }
    const ids = trackedEventIdsKey.split(',');
    let cancelled = false;

    void fetchActiveAnnouncementsForEvents(ids)
      .then((map) => {
        if (!cancelled) setAnnouncementsByEventId(map);
      })
      .catch(() => {
        // Non-blocking
      });

    return () => {
      cancelled = true;
    };
  }, [trackedEventIdsKey, user]);

  const registerForEvent = useCallback(
    async (event: SchoolEvent): Promise<boolean> => {
      if (!user) return false;
      if (inflightRef.current.has(event.id)) return false;

      const currentLifecycle = getLifecycleState(event);
      const isSuspended = membership?.status === 'suspended';
      const eligibility = evaluateStudentRegistrationAttempt({
        event,
        currentLifecycle,
        isVerifiedUser: Boolean(user.emailVerified),
        isActiveSchoolMember: capabilities.isActiveMember,
        isSuspendedMember: isSuspended,
      });

      if (!eligibility.allowed) {
        onShowToast('error', eligibility.reason || 'Registration is not available right now.');
        return false;
      }

      inflightRef.current.add(event.id);
      setBusyEventIds(new Set(inflightRef.current));

      try {
        const result = await registerStudentForEvent({
          event,
          uid: user.uid,
          displayName: user.displayName,
        });

        setRegistrationsByEventId((prev) => ({
          ...prev,
          [event.id]: result.registration,
        }));

        if (result.status === 'confirmed') {
          onShowToast('success', `You're registered for "${event.title}".`);
        } else if (result.status === 'pending_approval') {
          onShowToast('success', `Registration requested for "${event.title}". Awaiting organizer approval.`);
        } else if (result.status === 'waitlisted') {
          onShowToast('success', `Added to the waitlist for "${event.title}".`);
        }
        return true;
      } catch (err) {
        logClientDiagnostic('Event registration error', err);
        onShowToast(
          'error',
          toUserFriendlyErrorMessage(err, 'Could not complete your registration. Please try again.')
        );
        return false;
      } finally {
        inflightRef.current.delete(event.id);
        setBusyEventIds(new Set(inflightRef.current));
      }
    },
    [capabilities.isActiveMember, getLifecycleState, membership?.status, onShowToast, user]
  );

  const cancelRegistration = useCallback(
    async (event: SchoolEvent): Promise<boolean> => {
      if (!user) return false;
      if (inflightRef.current.has(event.id)) return false;

      const currentLifecycle = getLifecycleState(event);
      const check = evaluateStudentCancellationAttempt({
        event,
        currentLifecycle,
      });
      if (!check.allowed) {
        onShowToast('error', check.reason || 'Cannot cancel this registration.');
        return false;
      }

      inflightRef.current.add(event.id);
      setBusyEventIds(new Set(inflightRef.current));

      try {
        const res = await cancelStudentRegistration({
          event,
          uid: user.uid,
        });

        if (res.previousStatus !== 'legacy_rsvp') {
          const existing = registrationsByEventId[event.id];
          setRegistrationsByEventId((prev) => ({
            ...prev,
            [event.id]: existing
              ? { ...existing, status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() }
              : null,
          }));
        }

        onShowToast(
          'success',
          res.previousStatus === 'waitlisted'
            ? `Removed from waitlist for "${event.title}".`
            : `Registration cancelled for "${event.title}".`
        );
        return true;
      } catch (err) {
        logClientDiagnostic('Event cancellation error', err);
        onShowToast(
          'error',
          toUserFriendlyErrorMessage(err, 'Could not cancel your registration right now.')
        );
        return false;
      } finally {
        inflightRef.current.delete(event.id);
        setBusyEventIds(new Set(inflightRef.current));
      }
    },
    [getLifecycleState, onShowToast, registrationsByEventId, user]
  );

  const isEventActionBusy = useCallback(
    (eventId: string) => busyEventIds.has(eventId),
    [busyEventIds]
  );

  return {
    registrationsByEventId,
    attendanceByEventId,
    announcementsByEventId,
    getLifecycleState,
    registerForEvent,
    cancelRegistration,
    isEventActionBusy,
  };
}
