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
import {
  DEFAULT_SCHOOL_ONBOARDING_CHECKLIST,
  type PilotStage,
  type SchoolOnboardingChecklist,
  type SchoolStatus,
} from '../types/school';
import { isSafeMediaUrl } from '../utils/eventMedia';
import { isValidMemberRole, isValidMemberStatus } from '../utils/eventValidation';

function parseTimestamp(value: unknown, fallback: Date = new Date()): Date {
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
  return fallback;
}

function parseSchoolStatus(raw: unknown): SchoolStatus {
  if (raw === 'pending_setup') return 'pending_setup';
  if (raw === 'suspended' || raw === 'inactive') return 'suspended';
  return 'active';
}

function parsePilotStage(raw: unknown): PilotStage | undefined {
  if (
    raw === 'internal_validation' ||
    raw === 'student_trial' ||
    raw === 'club_expansion' ||
    raw === 'school_wide'
  ) {
    return raw;
  }
  return undefined;
}

function parseChecklist(raw: unknown): SchoolOnboardingChecklist | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    profileReviewed: Boolean(obj.profileReviewed),
    visibilityVerified: Boolean(obj.visibilityVerified),
    permissionsReviewed: Boolean(obj.permissionsReviewed),
    privacyReviewed: Boolean(obj.privacyReviewed),
    notificationsReviewed: Boolean(obj.notificationsReviewed),
    launchConfirmed: Boolean(obj.launchConfirmed),
  };
}

export function isBootstrappedAdminUser(user: User | null, schoolId: string = DEFAULT_SCHOOL_ID): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  if (schoolId !== 'oakridge-high') return false;
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
        status: 'active',
        allowPublicDiscovery: true,
        pilotStage: 'internal_validation',
        onboardingChecklist: { ...DEFAULT_SCHOOL_ONBOARDING_CHECKLIST },
      };
    }
    const data = snap.data();
    const logoUrl = isSafeMediaUrl(data.logoUrl) ? data.logoUrl.trim() : undefined;
    const coverImageUrl = isSafeMediaUrl(data.coverImageUrl) ? data.coverImageUrl.trim() : undefined;

    return {
      id: typeof data.id === 'string' ? data.id : schoolId,
      name:
        typeof data.name === 'string' && data.name.trim()
          ? data.name.trim().slice(0, 120)
          : DEFAULT_SCHOOL_NAME,
      ...(typeof data.slug === 'string' && data.slug.trim() ? { slug: data.slug.trim() } : {}),
      ...(logoUrl ? { logoUrl } : {}),
      ...(coverImageUrl ? { coverImageUrl } : {}),
      ...(typeof data.description === 'string' && data.description.trim()
        ? { description: data.description.trim().slice(0, 600) }
        : {}),
      ...(typeof data.location === 'string' && data.location.trim()
        ? { location: data.location.trim().slice(0, 160) }
        : {}),
      timezone:
        typeof data.timezone === 'string' && data.timezone.trim()
          ? data.timezone.trim().slice(0, 64)
          : DEFAULT_SCHOOL_TIMEZONE,
      ...(typeof data.contactEmail === 'string' && data.contactEmail.trim()
        ? { contactEmail: data.contactEmail.trim().slice(0, 160) }
        : {}),
      ...(typeof data.contactName === 'string' && data.contactName.trim()
        ? { contactName: data.contactName.trim().slice(0, 120) }
        : {}),
      status: parseSchoolStatus(data.status),
      allowPublicDiscovery:
        typeof data.allowPublicDiscovery === 'boolean' ? data.allowPublicDiscovery : true,
      pilotStage: parsePilotStage(data.pilotStage) ?? 'internal_validation',
      onboardingChecklist: parseChecklist(data.onboardingChecklist) ?? {
        ...DEFAULT_SCHOOL_ONBOARDING_CHECKLIST,
      },
      ...(data.createdAt ? { createdAt: parseTimestamp(data.createdAt) } : {}),
      ...(data.updatedAt ? { updatedAt: parseTimestamp(data.updatedAt) } : {}),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('permission-denied')) {
      handleFirestoreError(err, OperationType.GET, path);
    }
    return {
      id: schoolId,
      name: DEFAULT_SCHOOL_NAME,
      timezone: DEFAULT_SCHOOL_TIMEZONE,
      status: 'active',
      allowPublicDiscovery: true,
      pilotStage: 'internal_validation',
      onboardingChecklist: { ...DEFAULT_SCHOOL_ONBOARDING_CHECKLIST },
    };
  }
}

export interface SaveSchoolConfigInput {
  name: string;
  timezone: string;
  allowPublicDiscovery: boolean;
  status?: SchoolStatus;
  description?: string;
  location?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  contactEmail?: string;
  contactName?: string;
  pilotStage?: PilotStage;
  onboardingChecklist?: SchoolOnboardingChecklist;
}

export async function saveSchoolConfig(
  schoolId: string,
  config: SaveSchoolConfigInput,
  adminUid: string
): Promise<void> {
  const path = `schools/${schoolId}`;
  const ref = doc(db, 'schools', schoolId);

  const cleanLogo = config.logoUrl?.trim() || '';
  const cleanCover = config.coverImageUrl?.trim() || '';
  if (cleanLogo && !isSafeMediaUrl(cleanLogo)) {
    throw new Error('School logo URL must be a valid https:// URL.');
  }
  if (cleanCover && !isSafeMediaUrl(cleanCover)) {
    throw new Error('School cover image URL must be a valid https:// URL.');
  }

  const cleanEmail = config.contactEmail?.trim() || '';
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('School contact email must be a valid email address.');
  }

  try {
    const existingSnap = await getDoc(ref);
    const slug = schoolId.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

    const fields: Record<string, unknown> = {
      name: config.name.trim().slice(0, 120),
      slug: slug.slice(0, 128),
      timezone: config.timezone.trim().slice(0, 64),
      allowPublicDiscovery: Boolean(config.allowPublicDiscovery),
      status: config.status ?? 'active',
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    };

    if (config.description !== undefined) {
      fields.description = config.description.trim().slice(0, 600);
    }
    if (config.location !== undefined) {
      fields.location = config.location.trim().slice(0, 160);
    }
    if (config.logoUrl !== undefined) {
      fields.logoUrl = cleanLogo ? cleanLogo.slice(0, 500) : '';
    }
    if (config.coverImageUrl !== undefined) {
      fields.coverImageUrl = cleanCover ? cleanCover.slice(0, 500) : '';
    }
    if (config.contactEmail !== undefined) {
      fields.contactEmail = cleanEmail.slice(0, 160);
    }
    if (config.contactName !== undefined) {
      fields.contactName = config.contactName.trim().slice(0, 120);
    }
    if (config.pilotStage) {
      fields.pilotStage = config.pilotStage;
    }
    if (config.onboardingChecklist) {
      fields.onboardingChecklist = {
        profileReviewed: Boolean(config.onboardingChecklist.profileReviewed),
        visibilityVerified: Boolean(config.onboardingChecklist.visibilityVerified),
        permissionsReviewed: Boolean(config.onboardingChecklist.permissionsReviewed),
        privacyReviewed: Boolean(config.onboardingChecklist.privacyReviewed),
        notificationsReviewed: Boolean(config.onboardingChecklist.notificationsReviewed),
        launchConfirmed: Boolean(config.onboardingChecklist.launchConfirmed),
      };
    }

    if (existingSnap.exists()) {
      await updateDoc(ref, fields);
    } else {
      await setDoc(ref, {
        id: schoolId,
        createdAt: serverTimestamp(),
        ...fields,
      });
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
        isBootstrappedAdmin: isBootstrappedAdminUser(user, schoolId),
      };
    }

    if (isBootstrappedAdminUser(user, schoolId)) {
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
