import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  DEFAULT_USER_ONBOARDING_PROGRESS,
  type UserOnboardingProgress,
} from '../types/school';

const LOCAL_STUDENT_TOUR_KEY = 'oneplace_student_tour_dismissed_v1';

export function getLocalStudentTourDismissed(schoolId: string): boolean {
  try {
    return window.localStorage.getItem(`${LOCAL_STUDENT_TOUR_KEY}:${schoolId}`) === '1';
  } catch {
    return false;
  }
}

export function setLocalStudentTourDismissed(schoolId: string, dismissed: boolean): void {
  try {
    if (dismissed) {
      window.localStorage.setItem(`${LOCAL_STUDENT_TOUR_KEY}:${schoolId}`, '1');
    } else {
      window.localStorage.removeItem(`${LOCAL_STUDENT_TOUR_KEY}:${schoolId}`);
    }
  } catch {
    // Ignore storage restriction in private browsing
  }
}

export async function fetchUserOnboardingProgress(
  uid: string,
  schoolId: string
): Promise<UserOnboardingProgress> {
  const path = `users/${uid}/onboarding/progress`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'onboarding', 'progress'));
    if (!snap.exists()) {
      return DEFAULT_USER_ONBOARDING_PROGRESS(uid, schoolId);
    }
    const data = snap.data();
    return {
      uid,
      schoolId: typeof data.schoolId === 'string' ? data.schoolId : schoolId,
      studentCompleted: Boolean(data.studentCompleted),
      studentDismissed: Boolean(data.studentDismissed),
      organizerDismissed: Boolean(data.organizerDismissed),
      clubProfileReviewed: Boolean(data.clubProfileReviewed),
      eventManagementReviewed: Boolean(data.eventManagementReviewed),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('permission-denied')) {
      handleFirestoreError(err, OperationType.GET, path);
    }
    return DEFAULT_USER_ONBOARDING_PROGRESS(uid, schoolId);
  }
}

export async function saveUserOnboardingProgress(
  progress: UserOnboardingProgress
): Promise<void> {
  const path = `users/${progress.uid}/onboarding/progress`;
  try {
    await setDoc(doc(db, 'users', progress.uid, 'onboarding', 'progress'), {
      uid: progress.uid,
      schoolId: progress.schoolId,
      studentCompleted: Boolean(progress.studentCompleted),
      studentDismissed: Boolean(progress.studentDismissed),
      organizerDismissed: Boolean(progress.organizerDismissed),
      clubProfileReviewed: Boolean(progress.clubProfileReviewed),
      eventManagementReviewed: Boolean(progress.eventManagementReviewed),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
