import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_SCHOOL_ID,
  DEFAULT_SCHOOL_NAME,
  DEFAULT_SCHOOL_TIMEZONE,
  type SchoolConfig,
} from '../config/school';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { MemberRole, MemberStatus, SchoolMembership } from '../types/membership';
import { isValidMemberRole, isValidMemberStatus } from '../utils/eventValidation';

function parseTimestamp(value: unknown, fallback: Date = new Date()): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return fallback;
}

export function isBootstrappedAdminUser(user: User | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
}

export async function fetchSchoolConfig(schoolId: string = DEFAULT_SCHOOL_ID): Promise<SchoolConfig> {
  const path = `schools/${schoolId}`;
  try {
    const snap = await getDoc(doc(db, 'schools', schoolId));
    if (!snap.exists()) {
      return {
        id: schoolId,
        name: DEFAULT_SCHOOL_NAME,
        timezone: DEFAULT_SCHOOL_TIMEZONE,
        allowPublicDiscovery: true,
      };
    }
    const data = snap.data();
    return {
      id: typeof data.id === 'string' ? data.id : schoolId,
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : DEFAULT_SCHOOL_NAME,
      timezone:
        typeof data.timezone === 'string' && data.timezone.trim()
          ? data.timezone.trim()
          : DEFAULT_SCHOOL_TIMEZONE,
      allowPublicDiscovery:
        typeof data.allowPublicDiscovery === 'boolean' ? data.allowPublicDiscovery : true,
    };
  } catch (err) {
    // Gracefully fall back to env defaults if school doc does not exist or network fails
    if (err instanceof Error && err.message.includes('permission-denied')) {
      handleFirestoreError(err, OperationType.GET, path);
    }
    return {
      id: schoolId,
      name: DEFAULT_SCHOOL_NAME,
      timezone: DEFAULT_SCHOOL_TIMEZONE,
      allowPublicDiscovery: true,
    };
  }
}

export async function saveSchoolConfig(
  schoolId: string,
  config: Pick<SchoolConfig, 'name' | 'timezone' | 'allowPublicDiscovery'>,
  adminUid: string
): Promise<void> {
  const path = `schools/${schoolId}`;
  const ref = doc(db, 'schools', schoolId);
  try {
    const existingSnap = await getDoc(ref);
    const payload = {
      id: schoolId,
      name: config.name.trim().slice(0, 120),
      timezone: config.timezone.trim().slice(0, 64),
      allowPublicDiscovery: Boolean(config.allowPublicDiscovery),
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    };
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        name: payload.name,
        timezone: payload.timezone,
        allowPublicDiscovery: payload.allowPublicDiscovery,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
    } else {
      await setDoc(ref, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchUserMembership(
  schoolId: string,
  user: User
): Promise<SchoolMembership | null> {
  const path = `schools/${schoolId}/members/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'schools', schoolId, 'members', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      const role: MemberRole = isValidMemberRole(data.role) ? data.role : 'student';
      const status: MemberStatus = isValidMemberStatus(data.status) ? data.status : 'active';
      return {
        uid: typeof data.uid === 'string' ? data.uid : user.uid,
        schoolId: typeof data.schoolId === 'string' ? data.schoolId : schoolId,
        role,
        status,
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        email: typeof data.email === 'string' ? data.email : undefined,
        assignedBy: typeof data.assignedBy === 'string' ? data.assignedBy : undefined,
        createdAt: parseTimestamp(data.createdAt),
        updatedAt: data.updatedAt ? parseTimestamp(data.updatedAt) : undefined,
        isBootstrappedAdmin: isBootstrappedAdminUser(user),
      };
    }

    if (isBootstrappedAdminUser(user)) {
      return {
        uid: user.uid,
        schoolId,
        role: 'admin',
        status: 'active',
        displayName: user.displayName || 'School Administrator',
        email: user.email || undefined,
        createdAt: new Date(),
        isBootstrappedAdmin: true,
      };
    }

    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function listSchoolMembers(schoolId: string): Promise<SchoolMembership[]> {
  const path = `schools/${schoolId}/members`;
  try {
    const snap = await getDocs(collection(db, 'schools', schoolId, 'members'));
    const list: SchoolMembership[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        uid: typeof data.uid === 'string' ? data.uid : docSnap.id,
        schoolId: typeof data.schoolId === 'string' ? data.schoolId : schoolId,
        role: isValidMemberRole(data.role) ? data.role : 'student',
        status: isValidMemberStatus(data.status) ? data.status : 'active',
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        email: typeof data.email === 'string' ? data.email : undefined,
        assignedBy: typeof data.assignedBy === 'string' ? data.assignedBy : undefined,
        createdAt: parseTimestamp(data.createdAt),
        updatedAt: data.updatedAt ? parseTimestamp(data.updatedAt) : undefined,
      });
    });
    return list.sort((a, b) => a.uid.localeCompare(b.uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function upsertSchoolMember(
  schoolId: string,
  input: {
    uid: string;
    role: MemberRole;
    status: MemberStatus;
    displayName?: string;
    email?: string;
  },
  adminUid: string
): Promise<void> {
  const cleanUid = input.uid.trim();
  const path = `schools/${schoolId}/members/${cleanUid}`;
  const memberRef = doc(db, 'schools', schoolId, 'members', cleanUid);
  const mirrorRef = doc(db, 'userMemberships', cleanUid);

  try {
    const snap = await getDoc(memberRef);
    const cleanDisplayName = input.displayName?.trim().slice(0, 120);
    const cleanEmail = input.email?.trim().slice(0, 160);
    const batch = writeBatch(db);

    if (snap.exists()) {
      batch.update(memberRef, {
        role: input.role,
        status: input.status,
        ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
        ...(cleanEmail ? { email: cleanEmail } : {}),
        assignedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(memberRef, {
        uid: cleanUid,
        schoolId,
        role: input.role,
        status: input.status,
        ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
        ...(cleanEmail ? { email: cleanEmail } : {}),
        assignedBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(mirrorRef, {
      uid: cleanUid,
      schoolId,
      role: input.role,
      status: input.status,
      assignedBy: adminUid,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
