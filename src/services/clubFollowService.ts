import {
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { Club, UserFollowedClub } from '../types/club';

function parseTimestamp(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

export function subscribeToUserFollowedClubs(params: {
  uid: string;
  schoolId: string;
  onFollowed: (followedById: Record<string, UserFollowedClub>) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { uid, schoolId, onFollowed, onError } = params;
  const ref = collection(db, 'users', uid, 'followedClubs');

  return onSnapshot(
    ref,
    (snapshot) => {
      const map: Record<string, UserFollowedClub> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (typeof data.schoolId === 'string' && data.schoolId !== schoolId) return;
        const clubId = typeof data.clubId === 'string' ? data.clubId : docSnap.id;
        map[clubId] = {
          clubId,
          schoolId: typeof data.schoolId === 'string' ? data.schoolId : schoolId,
          clubName: typeof data.clubName === 'string' ? data.clubName : clubId,
          clubCategory:
            typeof data.clubCategory === 'string'
              ? (data.clubCategory as UserFollowedClub['clubCategory'])
              : 'Technology & Computing',
          notificationsEnabled:
            typeof data.notificationsEnabled === 'boolean' ? data.notificationsEnabled : true,
          followedAt: parseTimestamp(data.followedAt),
        };
      });
      onFollowed(map);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/followedClubs`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function toggleClubFollow(
  club: Club,
  uid: string,
  isCurrentlyFollowing: boolean
): Promise<void> {
  const path = `schools/${club.schoolId}/clubs/${club.id}/followers/${uid}`;
  const clubRef = doc(db, 'schools', club.schoolId, 'clubs', club.id);
  const followerRef = doc(db, 'schools', club.schoolId, 'clubs', club.id, 'followers', uid);
  const userFollowRef = doc(db, 'users', uid, 'followedClubs', club.id);

  try {
    const batch = writeBatch(db);
    if (isCurrentlyFollowing) {
      batch.delete(followerRef);
      batch.delete(userFollowRef);
      batch.update(clubRef, { followerCount: increment(-1) });
    } else {
      batch.set(followerRef, {
        uid,
        schoolId: club.schoolId,
        clubId: club.id,
        notificationsEnabled: true,
        createdAt: serverTimestamp(),
      });
      batch.set(userFollowRef, {
        clubId: club.id,
        schoolId: club.schoolId,
        clubName: club.name.slice(0, 80),
        clubCategory: club.category,
        notificationsEnabled: true,
        followedAt: serverTimestamp(),
      });
      batch.update(clubRef, { followerCount: increment(1) });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateClubFollowNotifications(
  schoolId: string,
  clubId: string,
  uid: string,
  notificationsEnabled: boolean
): Promise<void> {
  const path = `users/${uid}/followedClubs/${clubId}`;
  const followerRef = doc(db, 'schools', schoolId, 'clubs', clubId, 'followers', uid);
  const userFollowRef = doc(db, 'users', uid, 'followedClubs', clubId);

  try {
    const batch = writeBatch(db);
    batch.update(followerRef, { notificationsEnabled });
    batch.update(userFollowRef, { notificationsEnabled });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}
