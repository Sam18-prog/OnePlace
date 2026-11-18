import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { SchoolEvent } from '../types/event';
import { RSVP_TIMEOUT_MS, withTimeout } from '../utils/rsvp';

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

export async function reconcileEventRsvp(
  eventId: string,
  uid: string
): Promise<{ isGoing: boolean; rsvpCount?: number }> {
  const [attendeeSnap, eventSnap] = await withTimeout(
    Promise.all([
      getDoc(doc(db, 'events', eventId, 'attendees', uid)),
      getDoc(doc(db, 'events', eventId)),
    ]),
    RSVP_TIMEOUT_MS,
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
  if (!currentlyGoing && event.status !== 'published') {
    throw new Error(
      event.status === 'cancelled'
        ? 'This event has been cancelled and is no longer accepting RSVPs.'
        : 'Draft events cannot accept RSVPs.'
    );
  }

  if (currentlyGoing && event.status === 'draft') {
    throw new Error('Draft events cannot be modified by students.');
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
    await withTimeout(commitOperation(), RSVP_TIMEOUT_MS, 'Connection failed.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, attendeePath);
  }
}
