import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  FeedbackFormInput,
  FeedbackRelatedFeature,
  FeedbackStatus,
  FeedbackSubmission,
  FeedbackType,
} from '../types/feedback';
import { FEEDBACK_RELATED_FEATURES } from '../types/feedback';

function parseDate(value: unknown): Date {
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

function normalizeType(raw: unknown): FeedbackType {
  if (raw === 'bug' || raw === 'feature' || raw === 'usability' || raw === 'general') {
    return raw;
  }
  return 'general';
}

function normalizeStatus(raw: unknown): FeedbackStatus {
  if (raw === 'new' || raw === 'reviewed' || raw === 'resolved') return raw;
  return 'new';
}

function normalizeFeature(raw: unknown): FeedbackRelatedFeature {
  if (typeof raw === 'string' && (FEEDBACK_RELATED_FEATURES as string[]).includes(raw)) {
    return raw as FeedbackRelatedFeature;
  }
  return 'Other';
}

export async function submitSchoolFeedback(params: {
  schoolId: string;
  uid: string;
  input: FeedbackFormInput;
}): Promise<string> {
  const { schoolId, uid, input } = params;
  const description = input.description.trim().slice(0, 1200);
  if (description.length < 10) {
    throw new Error('Please share at least 10 characters so your school team can understand the feedback.');
  }

  const feedbackRef = doc(collection(db, 'schools', schoolId, 'feedback'));
  const path = `schools/${schoolId}/feedback/${feedbackRef.id}`;

  try {
    await setDoc(feedbackRef, {
      id: feedbackRef.id,
      schoolId,
      submittedBy: uid,
      type: normalizeType(input.type),
      relatedFeature: normalizeFeature(input.relatedFeature),
      description,
      status: 'new',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return feedbackRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function listSchoolFeedback(schoolId: string): Promise<FeedbackSubmission[]> {
  const path = `schools/${schoolId}/feedback`;
  try {
    const q = query(
      collection(db, 'schools', schoolId, 'feedback'),
      where('schoolId', '==', schoolId),
      limit(100)
    );
    const snap = await getDocs(q);
    const items: FeedbackSubmission[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      items.push({
        id: typeof data.id === 'string' ? data.id : docSnap.id,
        schoolId: typeof data.schoolId === 'string' ? data.schoolId : schoolId,
        submittedBy: typeof data.submittedBy === 'string' ? data.submittedBy : 'unknown',
        type: normalizeType(data.type),
        relatedFeature: normalizeFeature(data.relatedFeature),
        description: typeof data.description === 'string' ? data.description : '',
        status: normalizeStatus(data.status),
        adminNote: typeof data.adminNote === 'string' ? data.adminNote : undefined,
        createdAt: parseDate(data.createdAt),
        updatedAt: parseDate(data.updatedAt),
      });
    });
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function updateFeedbackStatus(params: {
  schoolId: string;
  feedbackId: string;
  status: FeedbackStatus;
  adminNote?: string;
}): Promise<void> {
  const { schoolId, feedbackId, status, adminNote } = params;
  const path = `schools/${schoolId}/feedback/${feedbackId}`;
  try {
    await updateDoc(doc(db, 'schools', schoolId, 'feedback', feedbackId), {
      status: normalizeStatus(status),
      adminNote: (adminNote ?? '').trim().slice(0, 400),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}
