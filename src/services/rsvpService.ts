import {
  doc,
  getDoc,
  getDocFromServer,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { SchoolEvent } from '../types/event';
import {
  canToggleEventRsvp,
  RSVP_RECONCILE_TIMEOUT_MS,
  RSVP_TIMEOUT_MS,
  withTimeout,
  type AuthoritativeRsvpState,
} from '../utils/rsvp';

export async function fetchUserRsvps(
  eventIds: string[],
  uid: string
): Promise<Record<string, boolean>> {
  if (eventIds.length === 0) return {};

  const entries = await Promise.all(
    eventIds.map(async (eventId): Promise<[string, boolean]> => {
      const path = `events/${eventId}/attendees/${uid}`;
      try {
        const snap = await withTimeout(
          getDoc(doc(db, 'events', eventId, 'attendees', uid)),
          RSVP_TIMEOUT_MS,
          'Connection timed out'
        );
        return [eventId, snap.exists()];
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Reads authoritative RSVP state directly from the Firestore server (bypassing stale local cache)
 * to confirm whether an uncertain or timed-out RSVP commit actually persisted.
 */
export async function reconcileEventRsvp(
  eventId: string,
  uid: string
): Promise<AuthoritativeRsvpState> {
  const attendeeRef = doc(db, 'events', eventId, 'attendees', uid);
  const eventRef = doc(db, 'events', eventId);

  const readAuthoritative = async () => {
    try {
      return await Promise.all([
        getDocFromServer(attendeeRef),
        getDocFromServer(eventRef),
      ]);
    } catch {
      // Fallback to standard getDoc if server-forced read is temporarily unavailable
      return await Promise.all([getDoc(attendeeRef), getDoc(eventRef)]);
    }
  };

  const [attendeeSnap, eventSnap] = await withTimeout(
    readAuthoritative(),
    RSVP_RECONCILE_TIMEOUT_MS,
    'Connection timed out'
  );

  const rawCount = eventSnap.exists() ? eventSnap.data().rsvpCount : undefined;
  return {
    isGoing: attendeeSnap.exists(),
    rsvpCount:
      typeof rawCount === 'number' && Number.isFinite(rawCount)
        ? Math.max(0, Math.floor(rawCount))
        : undefined,
  };
}

export async function toggleEventRsvp(
  event: SchoolEvent,
  uid: string,
  currentlyGoing: boolean
): Promise<void> {
  const eligibility = canToggleEventRsvp(event, currentlyGoing);
  if (!eligibility.allowed) {
    throw new Error(eligibility.reason || 'This event is not accepting RSVPs.');
  }

  const attendeePath = `events/${event.id}/attendees/${uid}`;
  const eventRef = doc(db, 'events', event.id);
  const attendeeRef = doc(db, 'events', event.id, 'attendees', uid);

  const commitOperation = async () => {
    const batch = writeBatch(db);
    if (currentlyGoing) {
      batch.delete(attendeeRef);
      batch.update(eventRef, { rsvpCount: increment(-1) });
    } else {
      batch.set(attendeeRef, {
        uid,
        createdAt: serverTimestamp(),
      });
      batch.update(eventRef, { rsvpCount: increment(1) });
    }
    await batch.commit();
  };

  try {
    await withTimeout(commitOperation(), RSVP_TIMEOUT_MS, 'Connection timed out.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, attendeePath);
  }
}
