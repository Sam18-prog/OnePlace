import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { SchoolEvent } from '../types/event';
import type {
  AttendanceStatus,
  CheckInMethod,
  EventAnnouncementRecord,
  EventAttendanceRecord,
  EventFeedbackRecord,
  EventRegistrationRecord,
  RegistrationStatus,
} from '../types/eventOperations';
import {
  computeRegistrationCounterDeltas,
  DEFAULT_WAITLIST_OFFER_HOURS,
} from '../utils/eventRegistration';
import {
  ATTENDANCE_CORRECTION_NOTE_MAX,
  validateEventAnnouncementInput,
  validatePostEventFeedbackInput,
} from '../utils/eventOperations';
import { withTimeout, RSVP_TIMEOUT_MS } from '../utils/rsvp';

const OPERATIONS_QUERY_LIMIT = 100;
const ANNOUNCEMENTS_QUERY_LIMIT = 25;

function toDateOrUndefined(val: unknown): Date | undefined {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const parsed = new Date(val);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

function toSafeInt(val: unknown): number {
  return typeof val === 'number' && Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
}

function mapRegistrationDoc(id: string, data: DocumentData): EventRegistrationRecord {
  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    eventId: typeof data.eventId === 'string' ? data.eventId : '',
    schoolId: typeof data.schoolId === 'string' ? data.schoolId : '',
    status: (data.status as RegistrationStatus) ?? 'confirmed',
    displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
    registeredAt: toDateOrUndefined(data.registeredAt) ?? new Date(),
    updatedAt: toDateOrUndefined(data.updatedAt) ?? new Date(),
    cancelledAt: toDateOrUndefined(data.cancelledAt),
    waitlistTimestamp: toDateOrUndefined(data.waitlistTimestamp),
    promotedAt: toDateOrUndefined(data.promotedAt),
    offerExpiresAt: toDateOrUndefined(data.offerExpiresAt),
    approvedBy: typeof data.approvedBy === 'string' ? data.approvedBy : undefined,
    approvedAt: toDateOrUndefined(data.approvedAt),
  };
}

function mapAttendanceDoc(id: string, data: DocumentData): EventAttendanceRecord {
  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    eventId: typeof data.eventId === 'string' ? data.eventId : '',
    schoolId: typeof data.schoolId === 'string' ? data.schoolId : '',
    status: (data.status as AttendanceStatus) ?? 'not_checked_in',
    method: (data.method as CheckInMethod) ?? 'manual',
    checkedInAt: toDateOrUndefined(data.checkedInAt),
    checkedInBy: typeof data.checkedInBy === 'string' ? data.checkedInBy : '',
    updatedAt: toDateOrUndefined(data.updatedAt) ?? new Date(),
    correctionNote: typeof data.correctionNote === 'string' ? data.correctionNote : undefined,
  };
}

function mapAnnouncementDoc(id: string, data: DocumentData): EventAnnouncementRecord {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    eventId: typeof data.eventId === 'string' ? data.eventId : '',
    schoolId: typeof data.schoolId === 'string' ? data.schoolId : '',
    title: typeof data.title === 'string' ? data.title : '',
    message: typeof data.message === 'string' ? data.message : '',
    status: data.status === 'archived' ? 'archived' : 'active',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdAt: toDateOrUndefined(data.createdAt) ?? new Date(),
    updatedAt: toDateOrUndefined(data.updatedAt) ?? new Date(),
  };
}

function mapFeedbackDoc(id: string, data: DocumentData): EventFeedbackRecord {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    eventId: typeof data.eventId === 'string' ? data.eventId : '',
    schoolId: typeof data.schoolId === 'string' ? data.schoolId : '',
    submittedBy: typeof data.submittedBy === 'string' ? data.submittedBy : id,
    overallRating: toSafeInt(data.overallRating) || 5,
    organizationRating: toSafeInt(data.organizationRating) || 5,
    writtenFeedback: typeof data.writtenFeedback === 'string' ? data.writtenFeedback : undefined,
    improvementSuggestions:
      typeof data.improvementSuggestions === 'string' ? data.improvementSuggestions : undefined,
    createdAt: toDateOrUndefined(data.createdAt) ?? new Date(),
    updatedAt: toDateOrUndefined(data.updatedAt) ?? new Date(),
  };
}

/**
 * Fetches the signed-in student's Phase 8 registration and attendance records
 * across the visible events in bounded parallel gets (strictly owner-scoped).
 */
export async function fetchUserEventOperationsForEvents(
  eventIds: string[],
  uid: string
): Promise<{
  registrationsByEventId: Record<string, EventRegistrationRecord | null>;
  attendanceByEventId: Record<string, EventAttendanceRecord | null>;
}> {
  if (eventIds.length === 0 || !uid) {
    return { registrationsByEventId: {}, attendanceByEventId: {} };
  }

  const boundedIds = eventIds.slice(0, 60);
  const regEntries: [string, EventRegistrationRecord | null][] = [];
  const attEntries: [string, EventAttendanceRecord | null][] = [];

  await Promise.all(
    boundedIds.map(async (eventId) => {
      try {
        const [regSnap, attSnap] = await Promise.all([
          withTimeout(
            getDoc(doc(db, 'events', eventId, 'registrations', uid)),
            RSVP_TIMEOUT_MS,
            'Connection timed out'
          ),
          withTimeout(
            getDoc(doc(db, 'events', eventId, 'attendance', uid)),
            RSVP_TIMEOUT_MS,
            'Connection timed out'
          ),
        ]);
        regEntries.push([
          eventId,
          regSnap.exists() ? mapRegistrationDoc(regSnap.id, regSnap.data()) : null,
        ]);
        attEntries.push([
          eventId,
          attSnap.exists() ? mapAttendanceDoc(attSnap.id, attSnap.data()) : null,
        ]);
      } catch {
        regEntries.push([eventId, null]);
        attEntries.push([eventId, null]);
      }
    })
  );

  return {
    registrationsByEventId: Object.fromEntries(regEntries),
    attendanceByEventId: Object.fromEntries(attEntries),
  };
}

/**
 * Atomically registers a verified student for an event (confirmed, pending_approval, or waitlisted).
 * Enforces capacity, registration windows, and duplicate protection inside a Firestore transaction
 * backed by firestore.rules.
 */
export async function registerStudentForEvent(params: {
  event: SchoolEvent;
  uid: string;
  displayName?: string | null;
}): Promise<{ status: RegistrationStatus; registration: EventRegistrationRecord }> {
  const { event, uid, displayName } = params;
  const eventRef = doc(db, 'events', event.id);
  const regRef = doc(db, 'events', event.id, 'registrations', uid);
  const legacyAttendeeRef = doc(db, 'events', event.id, 'attendees', uid);

  const runTx = async () =>
    runTransaction(db, async (tx) => {
      const [eventSnap, regSnap, legacySnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(regRef),
        tx.get(legacyAttendeeRef),
      ]);

      if (!eventSnap.exists()) {
        throw new Error('This event no longer exists.');
      }

      const evData = eventSnap.data();
      if (evData.status !== 'published') {
        throw new Error('This event is no longer open for registration.');
      }
      if (evData.registrationStatus === 'closed' || evData.registrationStatus === 'cancelled') {
        throw new Error('Registration is currently closed for this event.');
      }

      const nowMs = Date.now();
      const opensAt = toDateOrUndefined(evData.registrationOpensAt);
      const closesAt = toDateOrUndefined(evData.registrationClosesAt);
      const endAt = toDateOrUndefined(evData.endAt);
      if (endAt && nowMs >= endAt.getTime()) {
        throw new Error('This event has already ended.');
      }
      if (opensAt && nowMs < opensAt.getTime()) {
        throw new Error('Registration has not opened yet.');
      }
      if (closesAt && nowMs > closesAt.getTime()) {
        throw new Error('The registration deadline has passed.');
      }

      if (legacySnap.exists()) {
        throw new Error('You are already registered for this event.');
      }

      const prevStatus: RegistrationStatus | null = regSnap.exists()
        ? (regSnap.data().status as RegistrationStatus)
        : null;

      if (
        prevStatus === 'confirmed' ||
        prevStatus === 'pending_approval' ||
        prevStatus === 'waitlisted'
      ) {
        throw new Error('You already have an active registration for this event.');
      }

      const currentRsvp = toSafeInt(evData.rsvpCount);
      const capacityLimit =
        typeof evData.capacityLimit === 'number' && Number.isInteger(evData.capacityLimit)
          ? evData.capacityLimit
          : null;
      const isFull = capacityLimit !== null && currentRsvp >= capacityLimit;
      const requireApproval = evData.requireApproval === true;
      const allowWaitlist = evData.allowWaitlist === true;

      let targetStatus: RegistrationStatus;
      if (isFull) {
        if (!allowWaitlist) {
          throw new Error('This event is full and does not have a waitlist.');
        }
        targetStatus = 'waitlisted';
      } else if (requireApproval) {
        targetStatus = 'pending_approval';
      } else {
        targetStatus = 'confirmed';
      }

      const deltas = computeRegistrationCounterDeltas(prevStatus, targetStatus);
      const nextRsvp = Math.max(0, currentRsvp + deltas.rsvpDelta);
      const nextPending = Math.max(0, toSafeInt(evData.pendingApprovalCount) + deltas.pendingApprovalDelta);
      const nextWaitlist = Math.max(0, toSafeInt(evData.waitlistCount) + deltas.waitlistDelta);
      const nextCancelled = Math.max(0, toSafeInt(evData.cancelledCount) + deltas.cancelledDelta);

      const cleanDisplayName = (displayName || '').trim().slice(0, 120);
      const baseRegPayload: Record<string, unknown> = {
        uid,
        eventId: event.id,
        schoolId: typeof evData.schoolId === 'string' ? evData.schoolId : event.schoolId,
        status: targetStatus,
        registeredAt: regSnap.exists() ? regSnap.data().registeredAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanDisplayName) {
        baseRegPayload.displayName = cleanDisplayName;
      } else if (regSnap.exists() && typeof regSnap.data().displayName === 'string') {
        baseRegPayload.displayName = regSnap.data().displayName;
      }
      if (targetStatus === 'waitlisted') {
        baseRegPayload.waitlistTimestamp = serverTimestamp();
      }

      tx.set(regRef, baseRegPayload);
      tx.update(eventRef, {
        rsvpCount: nextRsvp,
        confirmedCount: nextRsvp,
        pendingApprovalCount: nextPending,
        waitlistCount: nextWaitlist,
        cancelledCount: nextCancelled,
      });

      const now = new Date();
      return {
        status: targetStatus,
        registration: {
          uid,
          eventId: event.id,
          schoolId: typeof evData.schoolId === 'string' ? evData.schoolId : event.schoolId,
          status: targetStatus,
          displayName: cleanDisplayName || undefined,
          registeredAt: regSnap.exists()
            ? toDateOrUndefined(regSnap.data().registeredAt) ?? now
            : now,
          updatedAt: now,
          waitlistTimestamp: targetStatus === 'waitlisted' ? now : undefined,
        },
      };
    });

  try {
    return await withTimeout(runTx(), RSVP_TIMEOUT_MS + 2000, 'Connection timed out while registering.');
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `events/${event.id}/registrations/${uid}`);
  }
}

/**
 * Atomically cancels a student's Phase 8 registration (or legacy Phase 1–7 RSVP) and reconciles counters.
 */
export async function cancelStudentRegistration(params: {
  event: SchoolEvent;
  uid: string;
}): Promise<{ previousStatus: RegistrationStatus | 'legacy_rsvp' }> {
  const { event, uid } = params;
  const eventRef = doc(db, 'events', event.id);
  const regRef = doc(db, 'events', event.id, 'registrations', uid);
  const legacyAttendeeRef = doc(db, 'events', event.id, 'attendees', uid);

  const runTx = async () =>
    runTransaction(db, async (tx) => {
      const [eventSnap, regSnap, legacySnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(regRef),
        tx.get(legacyAttendeeRef),
      ]);

      if (!eventSnap.exists()) {
        throw new Error('This event no longer exists.');
      }

      const evData = eventSnap.data();
      const currentRsvp = toSafeInt(evData.rsvpCount);

      if (regSnap.exists()) {
        const prevStatus = regSnap.data().status as RegistrationStatus;
        if (prevStatus === 'cancelled') {
          throw new Error('This registration is already cancelled.');
        }

        const deltas = computeRegistrationCounterDeltas(prevStatus, 'cancelled');
        const nextRsvp = Math.max(0, currentRsvp + deltas.rsvpDelta);
        const nextPending = Math.max(0, toSafeInt(evData.pendingApprovalCount) + deltas.pendingApprovalDelta);
        const nextWaitlist = Math.max(0, toSafeInt(evData.waitlistCount) + deltas.waitlistDelta);
        const nextCancelled = Math.max(0, toSafeInt(evData.cancelledCount) + deltas.cancelledDelta);

        tx.update(regRef, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        tx.update(eventRef, {
          rsvpCount: nextRsvp,
          confirmedCount: nextRsvp,
          pendingApprovalCount: nextPending,
          waitlistCount: nextWaitlist,
          cancelledCount: nextCancelled,
        });

        return { previousStatus: prevStatus };
      }

      if (legacySnap.exists()) {
        const nextRsvp = Math.max(0, currentRsvp - 1);
        tx.delete(legacyAttendeeRef);
        tx.update(eventRef, {
          rsvpCount: nextRsvp,
          confirmedCount: nextRsvp,
        });
        return { previousStatus: 'legacy_rsvp' as const };
      }

      throw new Error('No active registration found to cancel.');
    });

  try {
    return await withTimeout(runTx(), RSVP_TIMEOUT_MS + 2000, 'Connection timed out while cancelling.');
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `events/${event.id}/registrations/${uid}`);
  }
}

/**
 * Organizer / Admin: Lists bounded registrations for an event (max 100 per query).
 */
export async function listEventRegistrations(eventId: string): Promise<EventRegistrationRecord[]> {
  const path = `events/${eventId}/registrations`;
  try {
    const q = query(
      collection(db, 'events', eventId, 'registrations'),
      where('eventId', '==', eventId),
      limit(OPERATIONS_QUERY_LIMIT)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapRegistrationDoc(d.id, d.data()))
      .sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Organizer / Admin: Approves a pending registration OR promotes a waitlisted registrant
 * atomically with capacity verification.
 */
export async function organizerApproveOrPromoteRegistration(params: {
  eventId: string;
  targetUid: string;
  organizerUid: string;
}): Promise<void> {
  const { eventId, targetUid, organizerUid } = params;
  const eventRef = doc(db, 'events', eventId);
  const regRef = doc(db, 'events', eventId, 'registrations', targetUid);

  try {
    await runTransaction(db, async (tx) => {
      const [eventSnap, regSnap] = await Promise.all([tx.get(eventRef), tx.get(regRef)]);
      if (!eventSnap.exists() || !regSnap.exists()) {
        throw new Error('Registration or event record not found.');
      }

      const evData = eventSnap.data();
      const regData = regSnap.data();
      const prevStatus = regData.status as RegistrationStatus;
      if (prevStatus !== 'pending_approval' && prevStatus !== 'waitlisted') {
        throw new Error('Only pending or waitlisted registrations can be confirmed.');
      }

      const currentRsvp = toSafeInt(evData.rsvpCount);
      const capacityLimit =
        typeof evData.capacityLimit === 'number' && Number.isInteger(evData.capacityLimit)
          ? evData.capacityLimit
          : null;
      if (capacityLimit !== null && currentRsvp + 1 > capacityLimit) {
        throw new Error(
          `Event is at full capacity (${currentRsvp}/${capacityLimit}). Increase capacity or free a spot first.`
        );
      }

      const deltas = computeRegistrationCounterDeltas(prevStatus, 'confirmed');
      const nextRsvp = Math.max(0, currentRsvp + deltas.rsvpDelta);
      const nextPending = Math.max(0, toSafeInt(evData.pendingApprovalCount) + deltas.pendingApprovalDelta);
      const nextWaitlist = Math.max(0, toSafeInt(evData.waitlistCount) + deltas.waitlistDelta);

      const updatePayload: Record<string, unknown> = {
        status: 'confirmed',
        approvedBy: organizerUid,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (prevStatus === 'waitlisted') {
        updatePayload.promotedAt = serverTimestamp();
      }

      tx.update(regRef, updatePayload);
      tx.update(eventRef, {
        rsvpCount: nextRsvp,
        confirmedCount: nextRsvp,
        pendingApprovalCount: nextPending,
        waitlistCount: nextWaitlist,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}/registrations/${targetUid}`);
  }
}

/**
 * Organizer / Admin: Sets a timed waitlist offer expiration window on a waitlisted student.
 */
export async function organizerSetWaitlistOfferExpiry(params: {
  eventId: string;
  targetUid: string;
  hoursFromNow?: number;
}): Promise<Date> {
  const { eventId, targetUid, hoursFromNow = DEFAULT_WAITLIST_OFFER_HOURS } = params;
  const regRef = doc(db, 'events', eventId, 'registrations', targetUid);
  const expiresAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(regRef);
      if (!snap.exists() || snap.data().status !== 'waitlisted') {
        throw new Error('Student is not currently on the waitlist.');
      }
      tx.update(regRef, {
        offerExpiresAt: Timestamp.fromDate(expiresAt),
        updatedAt: serverTimestamp(),
      });
    });
    return expiresAt;
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}/registrations/${targetUid}`);
  }
}

/**
 * Organizer / Admin: Cancels a student registration or expires a waitlist entry atomically.
 */
export async function organizerCancelRegistration(params: {
  eventId: string;
  targetUid: string;
}): Promise<void> {
  const { eventId, targetUid } = params;
  const eventRef = doc(db, 'events', eventId);
  const regRef = doc(db, 'events', eventId, 'registrations', targetUid);

  try {
    await runTransaction(db, async (tx) => {
      const [eventSnap, regSnap] = await Promise.all([tx.get(eventRef), tx.get(regRef)]);
      if (!eventSnap.exists() || !regSnap.exists()) {
        throw new Error('Registration record not found.');
      }

      const evData = eventSnap.data();
      const prevStatus = regSnap.data().status as RegistrationStatus;
      if (prevStatus === 'cancelled') return;

      const deltas = computeRegistrationCounterDeltas(prevStatus, 'cancelled');
      const nextRsvp = Math.max(0, toSafeInt(evData.rsvpCount) + deltas.rsvpDelta);
      const nextPending = Math.max(0, toSafeInt(evData.pendingApprovalCount) + deltas.pendingApprovalDelta);
      const nextWaitlist = Math.max(0, toSafeInt(evData.waitlistCount) + deltas.waitlistDelta);
      const nextCancelled = Math.max(0, toSafeInt(evData.cancelledCount) + deltas.cancelledDelta);

      tx.update(regRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.update(eventRef, {
        rsvpCount: nextRsvp,
        confirmedCount: nextRsvp,
        pendingApprovalCount: nextPending,
        waitlistCount: nextWaitlist,
        cancelledCount: nextCancelled,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}/registrations/${targetUid}`);
  }
}

/**
 * Organizer / Admin: Lists bounded attendance records for an event.
 */
export async function listEventAttendance(eventId: string): Promise<EventAttendanceRecord[]> {
  const path = `events/${eventId}/attendance`;
  try {
    const q = query(
      collection(db, 'events', eventId, 'attendance'),
      where('eventId', '==', eventId),
      limit(OPERATIONS_QUERY_LIMIT)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapAttendanceDoc(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Organizer / Admin: Records check-in or applies an authorized attendance correction atomically.
 * Prevents duplicate check-in increments and enforces organizer authority in firestore.rules.
 */
export async function organizerSetAttendanceStatus(params: {
  eventId: string;
  schoolId: string;
  targetUid: string;
  organizerUid: string;
  nextStatus: AttendanceStatus;
  method?: CheckInMethod;
  correctionNote?: string;
}): Promise<{ alreadyInTargetState: boolean }> {
  const {
    eventId,
    schoolId,
    targetUid,
    organizerUid,
    nextStatus,
    method = 'manual',
    correctionNote,
  } = params;
  const eventRef = doc(db, 'events', eventId);
  const attRef = doc(db, 'events', eventId, 'attendance', targetUid);

  try {
    return await runTransaction(db, async (tx) => {
      const [eventSnap, attSnap] = await Promise.all([tx.get(eventRef), tx.get(attRef)]);
      if (!eventSnap.exists()) {
        throw new Error('Event record not found.');
      }

      const evData = eventSnap.data();
      if (evData.status !== 'published') {
        throw new Error('Attendance can only be updated for published events.');
      }

      const prevStatus: AttendanceStatus = attSnap.exists()
        ? (attSnap.data().status as AttendanceStatus)
        : 'not_checked_in';

      if (prevStatus === nextStatus) {
        return { alreadyInTargetState: true };
      }

      let checkedInDelta = 0;
      if (prevStatus !== 'checked_in' && nextStatus === 'checked_in') {
        checkedInDelta = 1;
      } else if (prevStatus === 'checked_in' && nextStatus !== 'checked_in') {
        checkedInDelta = -1;
      }

      const nextCheckedInCount = Math.max(0, toSafeInt(evData.checkedInCount) + checkedInDelta);
      const cleanNote = (correctionNote || '').trim().slice(0, ATTENDANCE_CORRECTION_NOTE_MAX);

      const attPayload: Record<string, unknown> = {
        uid: targetUid,
        eventId,
        schoolId: typeof evData.schoolId === 'string' ? evData.schoolId : schoolId,
        status: nextStatus,
        method,
        checkedInBy: organizerUid,
        updatedAt: serverTimestamp(),
      };
      if (nextStatus === 'checked_in') {
        attPayload.checkedInAt = serverTimestamp();
      } else if (attSnap.exists() && attSnap.data().checkedInAt) {
        attPayload.checkedInAt = attSnap.data().checkedInAt;
      }
      if (cleanNote) {
        attPayload.correctionNote = cleanNote;
      }

      if (attSnap.exists()) {
        tx.update(attRef, attPayload);
      } else {
        tx.set(attRef, attPayload);
      }

      tx.update(eventRef, {
        checkedInCount: nextCheckedInCount,
        updatedAt: serverTimestamp(),
      });

      return { alreadyInTargetState: false };
    });
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `events/${eventId}/attendance/${targetUid}`);
  }
}

/**
 * Lists active (or all for organizers) announcements for a single event.
 */
export async function listEventAnnouncements(
  eventId: string,
  includeArchived: boolean = false
): Promise<EventAnnouncementRecord[]> {
  const path = `events/${eventId}/announcements`;
  try {
    const constraints = includeArchived
      ? [where('eventId', '==', eventId), limit(ANNOUNCEMENTS_QUERY_LIMIT)]
      : [
          where('eventId', '==', eventId),
          where('status', '==', 'active'),
          limit(ANNOUNCEMENTS_QUERY_LIMIT),
        ];
    const q = query(collection(db, 'events', eventId, 'announcements'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapAnnouncementDoc(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

/**
 * Fetches latest active announcements across multiple events for My Events preparation
 * and Phase 4 Starter Tier in-app notifications.
 */
export async function fetchActiveAnnouncementsForEvents(
  eventIds: string[]
): Promise<Record<string, EventAnnouncementRecord[]>> {
  if (eventIds.length === 0) return {};
  const bounded = eventIds.slice(0, 20);
  const entries = await Promise.all(
    bounded.map(async (eventId): Promise<[string, EventAnnouncementRecord[]]> => {
      const items = await listEventAnnouncements(eventId, false);
      return [eventId, items];
    })
  );
  return Object.fromEntries(entries);
}

/**
 * Organizer / Admin: Publishes a new event-specific announcement and updates latestAnnouncementAt.
 */
export async function publishEventAnnouncement(params: {
  eventId: string;
  schoolId: string;
  organizerUid: string;
  title: string;
  message: string;
}): Promise<EventAnnouncementRecord> {
  const { eventId, schoolId, organizerUid, title, message } = params;
  const validation = validateEventAnnouncementInput({ title, message });
  if (!validation.valid) {
    throw new Error(validation.errors.title || validation.errors.message || 'Invalid announcement.');
  }

  const colRef = collection(db, 'events', eventId, 'announcements');
  const newDocRef = doc(colRef);
  const eventRef = doc(db, 'events', eventId);

  const cleanTitle = title.trim();
  const cleanMessage = message.trim();

  try {
    const batch = writeBatch(db);
    batch.set(newDocRef, {
      id: newDocRef.id,
      eventId,
      schoolId,
      title: cleanTitle,
      message: cleanMessage,
      status: 'active',
      createdBy: organizerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(eventRef, {
      latestAnnouncementAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const now = new Date();
    return {
      id: newDocRef.id,
      eventId,
      schoolId,
      title: cleanTitle,
      message: cleanMessage,
      status: 'active',
      createdBy: organizerUid,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `events/${eventId}/announcements/${newDocRef.id}`);
  }
}

export async function archiveEventAnnouncement(
  eventId: string,
  announcementId: string
): Promise<void> {
  const ref = doc(db, 'events', eventId, 'announcements', announcementId);
  try {
    const batch = writeBatch(db);
    batch.update(ref, {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}/announcements/${announcementId}`);
  }
}

/**
 * Student: Reads their own post-event feedback submission (if already submitted).
 */
export async function fetchMyEventFeedback(
  eventId: string,
  uid: string
): Promise<EventFeedbackRecord | null> {
  if (!eventId || !uid) return null;
  try {
    const snap = await getDoc(doc(db, 'events', eventId, 'feedback', uid));
    return snap.exists() ? mapFeedbackDoc(snap.id, snap.data()) : null;
  } catch {
    return null;
  }
}

/**
 * Student: Submits post-event feedback atomically (keyed by uid to prevent duplicates,
 * strictly enforced after event.endAt by firestore.rules).
 */
export async function submitPostEventFeedback(params: {
  eventId: string;
  schoolId: string;
  uid: string;
  overallRating: number;
  organizationRating: number;
  writtenFeedback?: string;
  improvementSuggestions?: string;
}): Promise<EventFeedbackRecord> {
  const {
    eventId,
    schoolId,
    uid,
    overallRating,
    organizationRating,
    writtenFeedback,
    improvementSuggestions,
  } = params;

  const validation = validatePostEventFeedbackInput({
    overallRating,
    organizationRating,
    writtenFeedback,
    improvementSuggestions,
  });
  if (!validation.valid) {
    throw new Error(
      validation.errors.overallRating ||
        validation.errors.organizationRating ||
        validation.errors.writtenFeedback ||
        validation.errors.improvementSuggestions ||
        'Please review your feedback before submitting.'
    );
  }

  const eventRef = doc(db, 'events', eventId);
  const feedbackRef = doc(db, 'events', eventId, 'feedback', uid);

  try {
    await runTransaction(db, async (tx) => {
      const [eventSnap, existingFeedback] = await Promise.all([
        tx.get(eventRef),
        tx.get(feedbackRef),
      ]);

      if (!eventSnap.exists()) {
        throw new Error('This event no longer exists.');
      }
      if (existingFeedback.exists()) {
        throw new Error('You have already submitted feedback for this event.');
      }

      const evData = eventSnap.data();
      const endAt = toDateOrUndefined(evData.endAt);
      if (endAt && Date.now() < endAt.getTime()) {
        throw new Error('Feedback opens once the event has ended.');
      }

      const payload: Record<string, unknown> = {
        id: uid,
        eventId,
        schoolId: typeof evData.schoolId === 'string' ? evData.schoolId : schoolId,
        submittedBy: uid,
        overallRating,
        organizationRating,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const cleanWritten = writtenFeedback?.trim();
      const cleanSuggestions = improvementSuggestions?.trim();
      if (cleanWritten) payload.writtenFeedback = cleanWritten;
      if (cleanSuggestions) payload.improvementSuggestions = cleanSuggestions;

      tx.set(feedbackRef, payload);
      tx.update(eventRef, {
        feedbackCount: toSafeInt(evData.feedbackCount) + 1,
        feedbackRatingSum: toSafeInt(evData.feedbackRatingSum) + overallRating,
      });
    });

    const now = new Date();
    return {
      id: uid,
      eventId,
      schoolId,
      submittedBy: uid,
      overallRating,
      organizationRating,
      writtenFeedback: writtenFeedback?.trim() || undefined,
      improvementSuggestions: improvementSuggestions?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    if (error instanceof Error && !('code' in error)) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, `events/${eventId}/feedback/${uid}`);
  }
}

/**
 * Organizer / Admin: Lists bounded post-event feedback records for aggregation.
 * UI layer always passes these through aggregateEventFeedbackSummary to strip submitter UIDs.
 */
export async function listEventFeedbackForOrganizer(
  eventId: string
): Promise<EventFeedbackRecord[]> {
  const path = `events/${eventId}/feedback`;
  try {
    const q = query(
      collection(db, 'events', eventId, 'feedback'),
      where('eventId', '==', eventId),
      orderBy('createdAt', 'desc'),
      limit(OPERATIONS_QUERY_LIMIT)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapFeedbackDoc(d.id, d.data()));
  } catch {
    // Fallback query without composite index requirement if index is not yet built
    try {
      const qFallback = query(
        collection(db, 'events', eventId, 'feedback'),
        where('eventId', '==', eventId),
        limit(OPERATIONS_QUERY_LIMIT)
      );
      const snap = await getDocs(qFallback);
      return snap.docs
        .map((d) => mapFeedbackDoc(d.id, d.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
}
