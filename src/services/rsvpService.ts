import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { SchoolEvent } from '../types/event';
import { RSVP_TIMEOUT_MS, withTimeout } from '../utils/rsvp';

function buildSeedPayload(event: SchoolEvent) {
  return {
    title: event.title.slice(0, 120),
    hostClub: event.hostClub.slice(0, 80),
    dateTime: Timestamp.fromDate(event.dateTime),
    location: event.location.slice(0, 120),
    description: event.description.slice(0, 600),
    rsvpCount: Math.min(Math.max(0, Math.floor(event.rsvpCount)), 1000),
  };
}

export async function ensureDemoEventsSeeded(events: SchoolEvent[]): Promise<void> {
  const path = 'events';
  try {
    const existingSnap = await withTimeout(
      getDocs(collection(db, path)),
      RSVP_TIMEOUT_MS,
      'Connection timed out'
    );
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    const missingEvents = events.filter((evt) => !existingIds.has(evt.id));
    if (missingEvents.length === 0) return;

    await Promise.all(
      missingEvents.map(async (evt) => {
        const eventPath = `events/${evt.id}`;
        try {
          await withTimeout(
            setDoc(doc(db, 'events', evt.id), buildSeedPayload(evt)),
            RSVP_TIMEOUT_MS,
            'Connection timed out'
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, eventPath);
        }
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function ensureEventExists(event: SchoolEvent): Promise<void> {
  const eventPath = `events/${event.id}`;
  try {
    const eventRef = doc(db, 'events', event.id);
    const snap = await getDoc(eventRef);
    if (!snap.exists()) {
      await setDoc(eventRef, buildSeedPayload(event));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, eventPath);
  }
}

export function subscribeToEventCounts(
  onCounts: (countsById: Record<string, number>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'events';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (typeof data.rsvpCount === 'number' && Number.isFinite(data.rsvpCount)) {
          counts[docSnap.id] = Math.max(0, Math.floor(data.rsvpCount));
        }
      });
      onCounts(counts);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

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

export async function toggleEventRsvp(
  event: SchoolEvent,
  uid: string,
  currentlyGoing: boolean
): Promise<void> {
  const attendeePath = `events/${event.id}/attendees/${uid}`;
  const eventRef = doc(db, 'events', event.id);
  const attendeeRef = doc(db, 'events', event.id, 'attendees', uid);

  const commitOperation = async () => {
    await ensureEventExists(event);

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
