import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_SCHOOL_ID } from '../config/school';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  Club,
  ClubCategory,
  ClubFormValues,
  ClubMember,
  ClubMemberRole,
  ClubOrganizerEditValues,
  ClubPublicOrganizer,
  ClubStatus,
  ClubVisibility,
  ManagedClubAssignment,
} from '../types/club';
import {
  CLUB_ANNOUNCEMENT_MAX,
  CLUB_DESC_MAX,
  CLUB_LOCATION_MAX,
  CLUB_NAME_MAX,
  CLUB_SCHEDULE_MAX,
  CLUB_SHORT_DESC_MAX,
  computeClubDiscoverKey,
  isValidClubCategory,
  slugifyClubName,
  validateClubForm,
  validateClubOrganizerEditForm,
} from '../utils/clubValidation';
import { isSafeMediaUrl } from '../utils/eventMedia';

export const DEFAULT_CLUB_PAGE_SIZE = 40;

function parseFirestoreDate(value: unknown, fallback: Date = new Date()): Date {
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

function parsePublicOrganizers(raw: unknown): ClubPublicOrganizer[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cleaned: ClubPublicOrganizer[] = [];
  for (const item of raw.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.uid === 'string' &&
      candidate.uid.trim() &&
      typeof candidate.displayName === 'string' &&
      candidate.displayName.trim()
    ) {
      cleaned.push({
        uid: candidate.uid.trim(),
        displayName: candidate.displayName.trim().slice(0, 120),
        roleTitle:
          typeof candidate.roleTitle === 'string' && candidate.roleTitle.trim()
            ? candidate.roleTitle.trim().slice(0, 80)
            : 'Club Organizer',
      });
    }
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

export function mapFirestoreClubDoc(
  id: string,
  data: DocumentData,
  fallbackSchoolId: string = DEFAULT_SCHOOL_ID
): Club | null {
  if (typeof data.name !== 'string' || typeof data.description !== 'string') {
    return null;
  }

  const schoolId =
    typeof data.schoolId === 'string' && data.schoolId.trim()
      ? data.schoolId.trim()
      : fallbackSchoolId;

  const name = data.name.trim().slice(0, CLUB_NAME_MAX);
  const slug =
    typeof data.slug === 'string' && data.slug.trim()
      ? slugifyClubName(data.slug)
      : slugifyClubName(name);

  const category: ClubCategory = isValidClubCategory(data.category)
    ? data.category
    : 'Technology & Computing';

  const status: ClubStatus = data.status === 'suspended' ? 'suspended' : 'active';
  const visibility: ClubVisibility = data.visibility === 'school' ? 'school' : 'public';

  const createdAt = parseFirestoreDate(data.createdAt);
  const updatedAt = parseFirestoreDate(data.updatedAt, createdAt);
  const lastActivityAt = parseFirestoreDate(data.lastActivityAt, updatedAt);

  const coverImageUrl = isSafeMediaUrl(data.coverImageUrl) ? data.coverImageUrl.trim() : undefined;
  const logoUrl = isSafeMediaUrl(data.logoUrl) ? data.logoUrl.trim() : undefined;

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : id,
    schoolId,
    name,
    slug,
    ...(typeof data.shortDescription === 'string' && data.shortDescription.trim()
      ? { shortDescription: data.shortDescription.trim().slice(0, CLUB_SHORT_DESC_MAX) }
      : {}),
    description: data.description.trim().slice(0, CLUB_DESC_MAX),
    category,
    visibility,
    status,
    isOfficial: Boolean(data.isOfficial),
    discoverKey:
      typeof data.discoverKey === 'string'
        ? data.discoverKey
        : computeClubDiscoverKey(schoolId, status, visibility),
    ...(coverImageUrl ? { coverImageUrl } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    ...(typeof data.meetingSchedule === 'string' && data.meetingSchedule.trim()
      ? { meetingSchedule: data.meetingSchedule.trim().slice(0, CLUB_SCHEDULE_MAX) }
      : {}),
    ...(typeof data.meetingLocation === 'string' && data.meetingLocation.trim()
      ? { meetingLocation: data.meetingLocation.trim().slice(0, CLUB_LOCATION_MAX) }
      : {}),
    ...(typeof data.contactEmail === 'string' && data.contactEmail.trim()
      ? { contactEmail: data.contactEmail.trim() }
      : {}),
    ...(parsePublicOrganizers(data.publicOrganizers)
      ? { publicOrganizers: parsePublicOrganizers(data.publicOrganizers) }
      : {}),
    ...(typeof data.announcement === 'string' && data.announcement.trim()
      ? { announcement: data.announcement.trim().slice(0, CLUB_ANNOUNCEMENT_MAX) }
      : {}),
    followerCount:
      typeof data.followerCount === 'number' &&
      Number.isFinite(data.followerCount) &&
      data.followerCount >= 0
        ? Math.floor(data.followerCount)
        : 0,
    isDemoSeed: typeof data.isDemoSeed === 'boolean' ? data.isDemoSeed : undefined,
    createdBy:
      typeof data.createdBy === 'string' && data.createdBy.trim()
        ? data.createdBy.trim()
        : 'school-admin',
    createdAt,
    updatedAt,
    lastActivityAt,
  };
}

export function subscribeToDiscoverClubs(params: {
  schoolId: string;
  isSchoolMember: boolean;
  pageLimit?: number;
  onClubs: (clubs: Club[], hasMore: boolean) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const {
    schoolId,
    isSchoolMember,
    pageLimit = DEFAULT_CLUB_PAGE_SIZE,
    onClubs,
    onError,
  } = params;

  const publicMap = new Map<string, Club>();
  const schoolMap = new Map<string, Club>();
  let publicLoaded = false;
  let schoolLoaded = !isSchoolMember;

  const emitMerged = () => {
    if (!publicLoaded || !schoolLoaded) return;
    const merged = new Map<string, Club>();
    publicMap.forEach((club, key) => merged.set(key, club));
    schoolMap.forEach((club, key) => merged.set(key, club));
    const sorted = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
    const hasMore = publicMap.size >= pageLimit || schoolMap.size >= pageLimit;
    onClubs(sorted, hasMore);
  };

  const clubsRef = collection(db, 'schools', schoolId, 'clubs');
  const publicQuery = query(
    clubsRef,
    where('discoverKey', '==', `public:${schoolId}`),
    limit(pageLimit)
  );

  const unsubPublic = onSnapshot(
    publicQuery,
    (snapshot) => {
      publicMap.clear();
      snapshot.forEach((docSnap) => {
        const mapped = mapFirestoreClubDoc(docSnap.id, docSnap.data(), schoolId);
        if (mapped && mapped.status === 'active') {
          publicMap.set(mapped.id, mapped);
        }
      });
      publicLoaded = true;
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `schools/${schoolId}/clubs(public)`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  let unsubSchool: Unsubscribe = () => {};
  if (isSchoolMember) {
    const schoolQuery = query(
      clubsRef,
      where('discoverKey', '==', `school:${schoolId}`),
      limit(pageLimit)
    );
    unsubSchool = onSnapshot(
      schoolQuery,
      (snapshot) => {
        schoolMap.clear();
        snapshot.forEach((docSnap) => {
          const mapped = mapFirestoreClubDoc(docSnap.id, docSnap.data(), schoolId);
          if (mapped && mapped.status === 'active') {
            schoolMap.set(mapped.id, mapped);
          }
        });
        schoolLoaded = true;
        emitMerged();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `schools/${schoolId}/clubs(school)`);
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );
  }

  return () => {
    unsubPublic();
    unsubSchool();
  };
}

export function subscribeToAdminSchoolClubs(params: {
  schoolId: string;
  onClubs: (clubs: Club[]) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { schoolId, onClubs, onError } = params;
  const q = query(collection(db, 'schools', schoolId, 'clubs'), limit(150));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Club[] = [];
      snapshot.forEach((docSnap) => {
        const mapped = mapFirestoreClubDoc(docSnap.id, docSnap.data(), schoolId);
        if (mapped) list.push(mapped);
      });
      onClubs(list.sort((a, b) => a.name.localeCompare(b.name)));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `schools/${schoolId}/clubs(admin)`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToUserManagedClubAssignments(params: {
  uid: string;
  schoolId: string;
  onAssignments: (assignments: ManagedClubAssignment[]) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { uid, schoolId, onAssignments, onError } = params;
  const q = query(collection(db, 'users', uid, 'managedClubs'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ManagedClubAssignment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== 'active') return;
        if (typeof data.schoolId === 'string' && data.schoolId !== schoolId) return;
        list.push({
          uid: typeof data.uid === 'string' ? data.uid : uid,
          schoolId: typeof data.schoolId === 'string' ? data.schoolId : schoolId,
          clubId: typeof data.clubId === 'string' ? data.clubId : docSnap.id,
          clubName: typeof data.clubName === 'string' ? data.clubName : undefined,
          role: data.role === 'lead' ? 'lead' : 'organizer',
          roleTitle: typeof data.roleTitle === 'string' ? data.roleTitle : undefined,
          status: 'active',
          assignedBy: typeof data.assignedBy === 'string' ? data.assignedBy : undefined,
          updatedAt: parseFirestoreDate(data.updatedAt),
        });
      });
      onAssignments(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/managedClubs`);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function fetchClubById(schoolId: string, clubId: string): Promise<Club | null> {
  const path = `schools/${schoolId}/clubs/${clubId}`;
  try {
    const snap = await getDoc(doc(db, 'schools', schoolId, 'clubs', clubId));
    if (!snap.exists()) return null;
    return mapFirestoreClubDoc(snap.id, snap.data(), schoolId);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createClub(params: {
  schoolId: string;
  values: ClubFormValues;
  adminUid: string;
}): Promise<string> {
  const { schoolId, values, adminUid } = params;
  const normalizedSlug = slugifyClubName(values.slug || values.name);
  const candidateValues: ClubFormValues = { ...values, slug: normalizedSlug };

  const validation = validateClubForm(candidateValues);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] || 'Club details are invalid.';
    throw new Error(firstError);
  }

  const clubId = normalizedSlug;
  const clubRef = doc(db, 'schools', schoolId, 'clubs', clubId);
  const path = `schools/${schoolId}/clubs/${clubId}`;

  try {
    const existing = await getDoc(clubRef);
    if (existing.exists()) {
      throw new Error(`A club with ID "${clubId}" already exists. Choose a distinct slug.`);
    }

    const cleanShortDesc = values.shortDescription.trim().slice(0, CLUB_SHORT_DESC_MAX);
    const cleanCover = values.coverImageUrl.trim();
    const cleanLogo = values.logoUrl.trim();
    const cleanSchedule = values.meetingSchedule.trim().slice(0, CLUB_SCHEDULE_MAX);
    const cleanLocation = values.meetingLocation.trim().slice(0, CLUB_LOCATION_MAX);
    const cleanEmail = values.contactEmail.trim();
    const cleanAnnouncement = values.announcement.trim().slice(0, CLUB_ANNOUNCEMENT_MAX);

    await setDoc(clubRef, {
      id: clubId,
      schoolId,
      name: values.name.trim().slice(0, CLUB_NAME_MAX),
      slug: normalizedSlug,
      ...(cleanShortDesc ? { shortDescription: cleanShortDesc } : {}),
      description: values.description.trim().slice(0, CLUB_DESC_MAX),
      category: values.category,
      visibility: values.visibility,
      status: 'active',
      isOfficial: Boolean(values.isOfficial),
      discoverKey: computeClubDiscoverKey(schoolId, 'active', values.visibility),
      ...(cleanCover ? { coverImageUrl: cleanCover } : {}),
      ...(cleanLogo ? { logoUrl: cleanLogo } : {}),
      ...(cleanSchedule ? { meetingSchedule: cleanSchedule } : {}),
      ...(cleanLocation ? { meetingLocation: cleanLocation } : {}),
      ...(cleanEmail ? { contactEmail: cleanEmail } : {}),
      ...(cleanAnnouncement ? { announcement: cleanAnnouncement } : {}),
      followerCount: 0,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });

    return clubId;
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateClubAsAdmin(params: {
  existing: Club;
  values: ClubFormValues;
}): Promise<void> {
  const { existing, values } = params;
  const candidateValues: ClubFormValues = { ...values, slug: existing.slug };
  const validation = validateClubForm(candidateValues);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] || 'Club details are invalid.';
    throw new Error(firstError);
  }

  const path = `schools/${existing.schoolId}/clubs/${existing.id}`;
  const cleanCover = values.coverImageUrl.trim();
  const cleanLogo = values.logoUrl.trim();

  const payload: Record<string, unknown> = {
    name: values.name.trim().slice(0, CLUB_NAME_MAX),
    shortDescription: values.shortDescription.trim().slice(0, CLUB_SHORT_DESC_MAX),
    description: values.description.trim().slice(0, CLUB_DESC_MAX),
    category: values.category,
    visibility: values.visibility,
    isOfficial: Boolean(values.isOfficial),
    discoverKey: computeClubDiscoverKey(existing.schoolId, existing.status, values.visibility),
    meetingSchedule: values.meetingSchedule.trim().slice(0, CLUB_SCHEDULE_MAX),
    meetingLocation: values.meetingLocation.trim().slice(0, CLUB_LOCATION_MAX),
    contactEmail: values.contactEmail.trim(),
    announcement: values.announcement.trim().slice(0, CLUB_ANNOUNCEMENT_MAX),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  };

  if (cleanCover) payload.coverImageUrl = cleanCover;
  if (cleanLogo) payload.logoUrl = cleanLogo;

  try {
    await updateDoc(doc(db, 'schools', existing.schoolId, 'clubs', existing.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateClubAsOrganizer(params: {
  existing: Club;
  values: ClubOrganizerEditValues;
}): Promise<void> {
  const { existing, values } = params;
  const validation = validateClubOrganizerEditForm(values);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] || 'Club profile details are invalid.';
    throw new Error(firstError);
  }

  const path = `schools/${existing.schoolId}/clubs/${existing.id}`;
  const cleanCover = values.coverImageUrl.trim();
  const cleanLogo = values.logoUrl.trim();

  const payload: Record<string, unknown> = {
    shortDescription: values.shortDescription.trim().slice(0, CLUB_SHORT_DESC_MAX),
    description: values.description.trim().slice(0, CLUB_DESC_MAX),
    meetingSchedule: values.meetingSchedule.trim().slice(0, CLUB_SCHEDULE_MAX),
    meetingLocation: values.meetingLocation.trim().slice(0, CLUB_LOCATION_MAX),
    contactEmail: values.contactEmail.trim(),
    announcement: values.announcement.trim().slice(0, CLUB_ANNOUNCEMENT_MAX),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  };

  if (cleanCover) payload.coverImageUrl = cleanCover;
  if (cleanLogo) payload.logoUrl = cleanLogo;

  try {
    await updateDoc(doc(db, 'schools', existing.schoolId, 'clubs', existing.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function setClubStatus(club: Club, nextStatus: ClubStatus): Promise<void> {
  const path = `schools/${club.schoolId}/clubs/${club.id}`;
  try {
    await updateDoc(doc(db, 'schools', club.schoolId, 'clubs', club.id), {
      status: nextStatus,
      discoverKey: computeClubDiscoverKey(club.schoolId, nextStatus, club.visibility),
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function listClubMembers(schoolId: string, clubId: string): Promise<ClubMember[]> {
  const path = `schools/${schoolId}/clubs/${clubId}/members`;
  try {
    const snap = await getDocs(collection(db, 'schools', schoolId, 'clubs', clubId, 'members'));
    const list: ClubMember[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        uid: typeof data.uid === 'string' ? data.uid : docSnap.id,
        schoolId: typeof data.schoolId === 'string' ? data.schoolId : schoolId,
        clubId: typeof data.clubId === 'string' ? data.clubId : clubId,
        role: data.role === 'lead' ? 'lead' : 'organizer',
        roleTitle: typeof data.roleTitle === 'string' ? data.roleTitle : undefined,
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        status: data.status === 'revoked' ? 'revoked' : 'active',
        assignedBy: typeof data.assignedBy === 'string' ? data.assignedBy : 'admin',
        createdAt: parseFirestoreDate(data.createdAt),
        updatedAt: parseFirestoreDate(data.updatedAt),
      });
    });
    return list.sort((a, b) => a.uid.localeCompare(b.uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function assignClubOrganizer(params: {
  schoolId: string;
  club: Club;
  targetUid: string;
  displayName: string;
  role: ClubMemberRole;
  roleTitle: string;
  adminUid: string;
}): Promise<void> {
  const cleanUid = params.targetUid.trim();
  const cleanDisplayName = params.displayName.trim().slice(0, 120) || 'Club Organizer';
  const cleanTitle = params.roleTitle.trim().slice(0, 80) || 'Club Organizer';
  const path = `schools/${params.schoolId}/clubs/${params.club.id}/members/${cleanUid}`;

  const schoolMemberRef = doc(db, 'schools', params.schoolId, 'members', cleanUid);
  const userMembershipMirrorRef = doc(db, 'userMemberships', cleanUid);
  const clubMemberRef = doc(db, 'schools', params.schoolId, 'clubs', params.club.id, 'members', cleanUid);
  const managedClubRef = doc(db, 'users', cleanUid, 'managedClubs', params.club.id);
  const clubRef = doc(db, 'schools', params.schoolId, 'clubs', params.club.id);

  try {
    const [existingSchoolMember, existingClubMember] = await Promise.all([
      getDoc(schoolMemberRef),
      getDoc(clubMemberRef),
    ]);

    const batch = writeBatch(db);

    // Ensure the user has an active school-level organizer (or preserved admin) role
    if (!existingSchoolMember.exists()) {
      batch.set(schoolMemberRef, {
        uid: cleanUid,
        schoolId: params.schoolId,
        role: 'organizer',
        status: 'active',
        displayName: cleanDisplayName,
        assignedBy: params.adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(userMembershipMirrorRef, {
        uid: cleanUid,
        schoolId: params.schoolId,
        role: 'organizer',
        status: 'active',
        assignedBy: params.adminUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      const currentRole = existingSchoolMember.data().role;
      const resolvedRole = currentRole === 'admin' ? 'admin' : 'organizer';
      batch.update(schoolMemberRef, {
        role: resolvedRole,
        status: 'active',
        ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
        assignedBy: params.adminUid,
        updatedAt: serverTimestamp(),
      });
      batch.set(userMembershipMirrorRef, {
        uid: cleanUid,
        schoolId: params.schoolId,
        role: resolvedRole,
        status: 'active',
        assignedBy: params.adminUid,
        updatedAt: serverTimestamp(),
      });
    }

    if (existingClubMember.exists()) {
      batch.update(clubMemberRef, {
        role: params.role,
        roleTitle: cleanTitle,
        displayName: cleanDisplayName,
        status: 'active',
        assignedBy: params.adminUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(clubMemberRef, {
        uid: cleanUid,
        schoolId: params.schoolId,
        clubId: params.club.id,
        role: params.role,
        roleTitle: cleanTitle,
        displayName: cleanDisplayName,
        status: 'active',
        assignedBy: params.adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(managedClubRef, {
      uid: cleanUid,
      schoolId: params.schoolId,
      clubId: params.club.id,
      clubName: params.club.name.slice(0, CLUB_NAME_MAX),
      role: params.role,
      roleTitle: cleanTitle,
      status: 'active',
      assignedBy: params.adminUid,
      updatedAt: serverTimestamp(),
    });

    const nextPublicOrganizers = [
      ...(params.club.publicOrganizers || []).filter((o) => o.uid !== cleanUid),
      {
        uid: cleanUid,
        displayName: cleanDisplayName,
        roleTitle: cleanTitle,
      },
    ].slice(0, 8);

    batch.update(clubRef, {
      publicOrganizers: nextPublicOrganizers,
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function revokeClubOrganizer(params: {
  schoolId: string;
  club: Club;
  targetUid: string;
  adminUid: string;
}): Promise<void> {
  const cleanUid = params.targetUid.trim();
  const path = `schools/${params.schoolId}/clubs/${params.club.id}/members/${cleanUid}`;

  const clubMemberRef = doc(db, 'schools', params.schoolId, 'clubs', params.club.id, 'members', cleanUid);
  const managedClubRef = doc(db, 'users', cleanUid, 'managedClubs', params.club.id);
  const clubRef = doc(db, 'schools', params.schoolId, 'clubs', params.club.id);

  try {
    const batch = writeBatch(db);
    batch.update(clubMemberRef, {
      status: 'revoked',
      assignedBy: params.adminUid,
      updatedAt: serverTimestamp(),
    });
    batch.update(managedClubRef, {
      status: 'revoked',
      assignedBy: params.adminUid,
      updatedAt: serverTimestamp(),
    });
    const nextPublicOrganizers = (params.club.publicOrganizers || []).filter(
      (o) => o.uid !== cleanUid
    );
    batch.update(clubRef, {
      publicOrganizers: nextPublicOrganizers,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
