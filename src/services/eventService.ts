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
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_SCHOOL_ID, DEFAULT_SCHOOL_TIMEZONE } from '../config/school';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  EventCategory,
  EventFormValues,
  EventStatus,
  EventVisibility,
  SchoolEvent,
} from '../types/event';
import type { EventRegistrationAvailability } from '../types/eventOperations';
import type { MemberRole } from '../types/membership';
import { computeClubDiscoverKey, mapEventCategoryToClubCategory, slugifyClubName } from '../utils/clubValidation';
import { isSafeMediaUrl } from '../utils/eventMedia';
import {
  ALL_EVENT_CATEGORIES,
  CANCELLATION_REASON_MAX,
  computeDiscoverKey,
  EVENT_CLUB_MAX,
  EVENT_DESC_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  slugifyClubId,
  validateEventForm,
} from '../utils/eventValidation';
import { inferEventCategory, parseDemoEvents, sanitizeId, sortEventsAscending } from '../utils/events';

export const DEFAULT_DISCOVERY_PAGE_SIZE = 20;

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
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

export function mapFirestoreEventDoc(id: string, data: DocumentData): SchoolEvent | null {
  if (typeof data.title !== 'string' || typeof data.hostClub !== 'string') {
    return null;
  }

  const startAt = parseFirestoreDate(data.startAt ?? data.dateTime);
  if (Number.isNaN(startAt.getTime())) return null;

  const endCandidate = data.endAt ? parseFirestoreDate(data.endAt, startAt) : null;
  const endAt =
    endCandidate && endCandidate.getTime() > startAt.getTime()
      ? endCandidate
      : new Date(startAt.getTime() + 60 * 60 * 1000);

  const schoolId =
    typeof data.schoolId === 'string' && data.schoolId.trim()
      ? data.schoolId.trim()
      : DEFAULT_SCHOOL_ID;

  const isLegacyRecord = typeof data.schoolId !== 'string' || !data.startAt;

  const title = data.title.trim().slice(0, EVENT_TITLE_MAX);
  const hostClub = data.hostClub.trim().slice(0, EVENT_CLUB_MAX);
  const category: EventCategory = ALL_EVENT_CATEGORIES.includes(data.category)
    ? data.category
    : inferEventCategory({ id, title, hostClub });

  const status: EventStatus =
    data.status === 'draft' || data.status === 'cancelled' || data.status === 'published'
      ? data.status
      : 'published';

  const visibility: EventVisibility = data.visibility === 'school' ? 'school' : 'public';
  const createdBy =
    typeof data.createdBy === 'string' && data.createdBy.trim() ? data.createdBy.trim() : 'school-seed';

  const imageUrl = isSafeMediaUrl(data.imageUrl) ? data.imageUrl.trim() : undefined;

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : id,
    schoolId,
    title,
    description:
      typeof data.description === 'string' ? data.description.trim().slice(0, EVENT_DESC_MAX) : '',
    hostClub,
    clubId:
      typeof data.clubId === 'string' && data.clubId.trim()
        ? data.clubId.trim()
        : slugifyClubId(hostClub),
    category,
    dateTime: startAt,
    startAt,
    endAt,
    timezone:
      typeof data.timezone === 'string' && data.timezone.trim()
        ? data.timezone.trim()
        : DEFAULT_SCHOOL_TIMEZONE,
    location:
      typeof data.location === 'string' ? data.location.trim().slice(0, EVENT_LOCATION_MAX) : '',
    ...(imageUrl ? { imageUrl } : {}),
    createdBy,
    createdAt: parseFirestoreDate(data.createdAt, startAt),
    updatedAt: parseFirestoreDate(data.updatedAt, startAt),
    status,
    visibility,
    rsvpCount:
      typeof data.rsvpCount === 'number' && Number.isFinite(data.rsvpCount) && data.rsvpCount >= 0
        ? Math.floor(data.rsvpCount)
        : 0,
    discoverKey:
      typeof data.discoverKey === 'string'
        ? data.discoverKey
        : computeDiscoverKey(schoolId, status, visibility, createdBy),
    isDemoSeed: typeof data.isDemoSeed === 'boolean' ? data.isDemoSeed : undefined,
    cancelledAt: data.cancelledAt ? parseFirestoreDate(data.cancelledAt) : undefined,
    cancellationReason:
      typeof data.cancellationReason === 'string' ? data.cancellationReason : undefined,
    isLegacyRecord,
    // Phase 8 optional event operations fields
    capacityLimit:
      typeof data.capacityLimit === 'number' &&
      Number.isInteger(data.capacityLimit) &&
      data.capacityLimit >= 1
        ? data.capacityLimit
        : null,
    registrationOpensAt: data.registrationOpensAt
      ? parseFirestoreDate(data.registrationOpensAt)
      : undefined,
    registrationClosesAt: data.registrationClosesAt
      ? parseFirestoreDate(data.registrationClosesAt)
      : undefined,
    allowWaitlist: typeof data.allowWaitlist === 'boolean' ? data.allowWaitlist : undefined,
    requireApproval: typeof data.requireApproval === 'boolean' ? data.requireApproval : undefined,
    registrationStatus:
      data.registrationStatus === 'open' ||
      data.registrationStatus === 'closed' ||
      data.registrationStatus === 'full' ||
      data.registrationStatus === 'cancelled'
        ? (data.registrationStatus as EventRegistrationAvailability)
        : undefined,
    confirmedCount:
      typeof data.confirmedCount === 'number' && Number.isFinite(data.confirmedCount) && data.confirmedCount >= 0
        ? Math.floor(data.confirmedCount)
        : undefined,
    pendingApprovalCount:
      typeof data.pendingApprovalCount === 'number' &&
      Number.isFinite(data.pendingApprovalCount) &&
      data.pendingApprovalCount >= 0
        ? Math.floor(data.pendingApprovalCount)
        : undefined,
    waitlistCount:
      typeof data.waitlistCount === 'number' && Number.isFinite(data.waitlistCount) && data.waitlistCount >= 0
        ? Math.floor(data.waitlistCount)
        : undefined,
    checkedInCount:
      typeof data.checkedInCount === 'number' && Number.isFinite(data.checkedInCount) && data.checkedInCount >= 0
        ? Math.floor(data.checkedInCount)
        : undefined,
    cancelledCount:
      typeof data.cancelledCount === 'number' && Number.isFinite(data.cancelledCount) && data.cancelledCount >= 0
        ? Math.floor(data.cancelledCount)
        : undefined,
    feedbackCount:
      typeof data.feedbackCount === 'number' && Number.isFinite(data.feedbackCount) && data.feedbackCount >= 0
        ? Math.floor(data.feedbackCount)
        : undefined,
    feedbackRatingSum:
      typeof data.feedbackRatingSum === 'number' &&
      Number.isFinite(data.feedbackRatingSum) &&
      data.feedbackRatingSum >= 0
        ? Math.floor(data.feedbackRatingSum)
        : undefined,
    latestAnnouncementAt: data.latestAnnouncementAt
      ? parseFirestoreDate(data.latestAnnouncementAt)
      : undefined,
  };
}

export function subscribeToDiscoverEvents(params: {
  schoolId: string;
  isSchoolMember: boolean;
  pageLimit: number;
  onEvents: (events: SchoolEvent[], hasMore: boolean) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { schoolId, isSchoolMember, pageLimit, onEvents, onError } = params;
  const publicMap = new Map<string, SchoolEvent>();
  const schoolMap = new Map<string, SchoolEvent>();
  let publicLoaded = false;
  let schoolLoaded = !isSchoolMember;

  const emitMerged = () => {
    if (!publicLoaded || !schoolLoaded) return;
    const merged = new Map<string, SchoolEvent>();
    publicMap.forEach((evt, key) => merged.set(key, evt));
    schoolMap.forEach((evt, key) => merged.set(key, evt));
    const sorted = sortEventsAscending(Array.from(merged.values()));
    const hasMore = publicMap.size >= pageLimit || schoolMap.size >= pageLimit;
    onEvents(sorted, hasMore);
  };

  const publicQuery = query(
    collection(db, 'events'),
    where('discoverKey', '==', `public:${schoolId}`),
    limit(pageLimit)
  );

  const unsubPublic = onSnapshot(
    publicQuery,
    (snapshot) => {
      publicMap.clear();
      snapshot.forEach((docSnap) => {
        const mapped = mapFirestoreEventDoc(docSnap.id, docSnap.data());
        if (mapped && (mapped.status === 'published' || mapped.status === 'cancelled')) {
          publicMap.set(mapped.id, mapped);
        }
      });
      publicLoaded = true;
      emitMerged();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'events(public)');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );

  let unsubSchool: Unsubscribe = () => {};
  if (isSchoolMember) {
    const schoolQuery = query(
      collection(db, 'events'),
      where('discoverKey', '==', `school:${schoolId}`),
      limit(pageLimit)
    );
    unsubSchool = onSnapshot(
      schoolQuery,
      (snapshot) => {
        schoolMap.clear();
        snapshot.forEach((docSnap) => {
          const mapped = mapFirestoreEventDoc(docSnap.id, docSnap.data());
          if (mapped && (mapped.status === 'published' || mapped.status === 'cancelled')) {
            schoolMap.set(mapped.id, mapped);
          }
        });
        schoolLoaded = true;
        emitMerged();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'events(school)');
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

export function subscribeToManagedEvents(params: {
  schoolId: string;
  uid: string;
  isAdmin: boolean;
  onEvents: (events: SchoolEvent[]) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const { schoolId, uid, isAdmin, onEvents, onError } = params;
  const q = isAdmin
    ? query(collection(db, 'events'), where('schoolId', '==', schoolId), limit(200))
    : query(collection(db, 'events'), where('createdBy', '==', uid), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SchoolEvent[] = [];
      snapshot.forEach((docSnap) => {
        const mapped = mapFirestoreEventDoc(docSnap.id, docSnap.data());
        if (mapped && mapped.schoolId === schoolId) {
          list.push(mapped);
        }
      });
      onEvents(sortEventsAscending(list));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'events(managed)');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

function generateEventId(title: string): string {
  const slug = sanitizeId(
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
  );
  const rand = Math.random().toString(36).slice(2, 8);
  return `evt-${slug || 'campus'}-${rand}`;
}

async function touchClubActivity(schoolId: string, clubId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'schools', schoolId, 'clubs', clubId), {
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
  } catch {
    // Best-effort club activity bump
  }
}

export async function createManagedEvent(params: {
  values: EventFormValues;
  status: 'draft' | 'published';
  schoolId: string;
  timezone: string;
  creatorUid: string;
}): Promise<string> {
  const { values, status, schoolId, timezone, creatorUid } = params;
  const validation = validateEventForm(values, status, timezone, { requireClubId: true });
  if (!validation.valid || !validation.startAt || !validation.endAt) {
    const firstError = Object.values(validation.errors)[0] || 'Event details are invalid.';
    throw new Error(firstError);
  }

  const eventId = generateEventId(values.title);
  const path = `events/${eventId}`;
  const cleanImage = values.imageUrl.trim();
  const resolvedClubId = (values.clubId || slugifyClubId(values.hostClub)).trim();

  const payload: Record<string, unknown> = {
    id: eventId,
    schoolId,
    title: values.title.trim().slice(0, EVENT_TITLE_MAX),
    description: values.description.trim().slice(0, EVENT_DESC_MAX),
    hostClub: values.hostClub.trim().slice(0, EVENT_CLUB_MAX),
    clubId: resolvedClubId,
    category: values.category,
    startAt: Timestamp.fromDate(validation.startAt),
    endAt: Timestamp.fromDate(validation.endAt),
    timezone,
    location: values.location.trim().slice(0, EVENT_LOCATION_MAX),
    ...(cleanImage ? { imageUrl: cleanImage } : {}),
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status,
    visibility: values.visibility,
    rsvpCount: 0,
    confirmedCount: 0,
    pendingApprovalCount: 0,
    waitlistCount: 0,
    checkedInCount: 0,
    cancelledCount: 0,
    capacityLimit: validation.capacityLimit,
    allowWaitlist: Boolean(values.allowWaitlist),
    requireApproval: Boolean(values.requireApproval),
    registrationStatus: values.registrationStatus ?? 'open',
    ...(validation.registrationOpensAt
      ? { registrationOpensAt: Timestamp.fromDate(validation.registrationOpensAt) }
      : {}),
    ...(validation.registrationClosesAt
      ? { registrationClosesAt: Timestamp.fromDate(validation.registrationClosesAt) }
      : {}),
    discoverKey: computeDiscoverKey(schoolId, status, values.visibility, creatorUid),
  };

  try {
    await setDoc(doc(db, 'events', eventId), payload);
    if (status === 'published') {
      void touchClubActivity(schoolId, resolvedClubId);
    }
    return eventId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateManagedEvent(params: {
  existing: SchoolEvent;
  values: EventFormValues;
  targetStatus: EventStatus;
  timezone: string;
}): Promise<void> {
  const { existing, values, targetStatus, timezone } = params;
  const validation = validateEventForm(values, targetStatus, timezone, {
    isEditingExistingPublished: existing.status === 'published' && targetStatus === 'published',
    minConfirmedCount: existing.rsvpCount,
  });

  if (!validation.valid || !validation.startAt || !validation.endAt) {
    const firstError = Object.values(validation.errors)[0] || 'Event details are invalid.';
    throw new Error(firstError);
  }

  const path = `events/${existing.id}`;
  const cleanImage = values.imageUrl.trim();
  const resolvedClubId = (values.clubId || existing.clubId || slugifyClubId(values.hostClub)).trim();

  const updatePayload: Record<string, unknown> = {
    title: values.title.trim().slice(0, EVENT_TITLE_MAX),
    description: values.description.trim().slice(0, EVENT_DESC_MAX),
    hostClub: values.hostClub.trim().slice(0, EVENT_CLUB_MAX),
    clubId: resolvedClubId,
    category: values.category,
    startAt: Timestamp.fromDate(validation.startAt),
    endAt: Timestamp.fromDate(validation.endAt),
    timezone,
    location: values.location.trim().slice(0, EVENT_LOCATION_MAX),
    updatedAt: serverTimestamp(),
    status: targetStatus,
    visibility: values.visibility,
    capacityLimit: validation.capacityLimit,
    allowWaitlist: Boolean(values.allowWaitlist),
    requireApproval: Boolean(values.requireApproval),
    registrationStatus:
      targetStatus === 'cancelled' ? 'cancelled' : values.registrationStatus ?? 'open',
    registrationOpensAt: validation.registrationOpensAt
      ? Timestamp.fromDate(validation.registrationOpensAt)
      : null,
    registrationClosesAt: validation.registrationClosesAt
      ? Timestamp.fromDate(validation.registrationClosesAt)
      : null,
    discoverKey: computeDiscoverKey(
      existing.schoolId,
      targetStatus,
      values.visibility,
      existing.createdBy
    ),
  };

  if (cleanImage) {
    updatePayload.imageUrl = cleanImage;
  }

  try {
    await updateDoc(doc(db, 'events', existing.id), updatePayload);
    if (targetStatus === 'published') {
      void touchClubActivity(existing.schoolId, resolvedClubId);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateEventRegistrationControls(params: {
  event: SchoolEvent;
  capacityLimit?: number | null;
  allowWaitlist?: boolean;
  requireApproval?: boolean;
  registrationStatus?: EventRegistrationAvailability;
}): Promise<void> {
  const { event, capacityLimit, allowWaitlist, requireApproval, registrationStatus } = params;
  const path = `events/${event.id}`;

  if (
    capacityLimit !== undefined &&
    capacityLimit !== null &&
    (!Number.isInteger(capacityLimit) || capacityLimit < event.rsvpCount || capacityLimit > 100_000)
  ) {
    throw new Error(
      `Capacity must be at least ${Math.max(1, event.rsvpCount)} (current confirmed count).`
    );
  }

  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (capacityLimit !== undefined) patch.capacityLimit = capacityLimit;
  if (allowWaitlist !== undefined) patch.allowWaitlist = allowWaitlist;
  if (requireApproval !== undefined) patch.requireApproval = requireApproval;
  if (registrationStatus !== undefined) patch.registrationStatus = registrationStatus;

  try {
    await updateDoc(doc(db, 'events', event.id), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function publishDraftEvent(existing: SchoolEvent): Promise<void> {
  const path = `events/${existing.id}`;
  const graceMs = 15 * 60 * 1000;
  if (existing.startAt.getTime() < Date.now() - graceMs) {
    throw new Error('Update the event date to an upcoming time before publishing.');
  }

  try {
    await updateDoc(doc(db, 'events', existing.id), {
      status: 'published',
      updatedAt: serverTimestamp(),
      discoverKey: computeDiscoverKey(
        existing.schoolId,
        'published',
        existing.visibility,
        existing.createdBy
      ),
    });
    void touchClubActivity(existing.schoolId, existing.clubId);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function cancelManagedEvent(
  existing: SchoolEvent,
  reason: string,
  actorRole: MemberRole
): Promise<void> {
  if (actorRole === 'student') {
    throw new Error('Only authorized organizers or admins can cancel events.');
  }
  const path = `events/${existing.id}`;
  const cleanReason = reason.trim().slice(0, CANCELLATION_REASON_MAX);

  try {
    await updateDoc(doc(db, 'events', existing.id), {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      ...(cleanReason ? { cancellationReason: cleanReason } : {}),
      updatedAt: serverTimestamp(),
      discoverKey: computeDiscoverKey(
        existing.schoolId,
        'cancelled',
        existing.visibility,
        existing.createdBy
      ),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export interface MigrationReport {
  legacyDocsCount: number;
  unseededDemoCount: number;
  upToDateCount: number;
  legacyIds: string[];
  unseededDemoIds: string[];
  demoEvents: SchoolEvent[];
}

export async function inspectMigrationState(
  schoolId: string,
  timezone: string,
  adminUid: string
): Promise<MigrationReport> {
  const path = 'events';
  try {
    const response = await fetch(`/demo-events.json?t=${Date.now()}`, { cache: 'no-store' });
    const rawDemo: unknown = response.ok ? await response.json() : [];
    const demoEvents = Array.isArray(rawDemo)
      ? parseDemoEvents(rawDemo, { schoolId, timezone, createdBy: adminUid })
      : [];

    const snap = await getDocs(collection(db, 'events'));
    const existingIds = new Set<string>();
    const legacyIds: string[] = [];
    let upToDateCount = 0;

    snap.forEach((docSnap) => {
      existingIds.add(docSnap.id);
      const data = docSnap.data();
      if (!data.schoolId || !data.startAt || !data.status || !data.discoverKey) {
        legacyIds.push(docSnap.id);
      } else {
        upToDateCount += 1;
      }
    });

    const unseededDemoIds = demoEvents
      .filter((evt) => !existingIds.has(evt.id))
      .map((evt) => evt.id);

    return {
      legacyDocsCount: legacyIds.length,
      unseededDemoCount: unseededDemoIds.length,
      upToDateCount,
      legacyIds,
      unseededDemoIds,
      demoEvents,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

async function ensureClubExistsForSeed(params: {
  schoolId: string;
  clubId: string;
  clubName: string;
  category: EventCategory;
  location: string;
  adminUid: string;
}): Promise<void> {
  const clubRef = doc(db, 'schools', params.schoolId, 'clubs', params.clubId);
  const existing = await getDoc(clubRef);
  if (existing.exists()) return;

  const clubCategory = mapEventCategoryToClubCategory(params.category, params.clubName);
  const slug = slugifyClubName(params.clubId);
  await setDoc(clubRef, {
    id: params.clubId,
    schoolId: params.schoolId,
    name: params.clubName.slice(0, 80),
    slug,
    shortDescription: `Official campus chapter hosting ${clubCategory.toLowerCase()} activities and student meetups.`,
    description: `${params.clubName} brings students together around ${clubCategory.toLowerCase()} workshops, collaborative sessions, and campus events. Open to interested students across all grade levels.`,
    category: clubCategory,
    visibility: 'public',
    status: 'active',
    isOfficial: true,
    discoverKey: computeClubDiscoverKey(params.schoolId, 'active', 'public'),
    meetingLocation: params.location.slice(0, 120),
    followerCount: 0,
    isDemoSeed: true,
    createdBy: params.adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
}

export async function runControlledMigration(
  schoolId: string,
  timezone: string,
  adminUid: string
): Promise<{ migratedLegacy: number; seededDemo: number }> {
  const path = 'events';
  try {
    const response = await fetch(`/demo-events.json?t=${Date.now()}`, { cache: 'no-store' });
    const rawDemo: unknown = response.ok ? await response.json() : [];
    const demoEvents = Array.isArray(rawDemo)
      ? parseDemoEvents(rawDemo, { schoolId, timezone, createdBy: adminUid })
      : [];
    const demoById = new Map(demoEvents.map((e) => [e.id, e]));

    const snap = await getDocs(collection(db, 'events'));
    const existingIds = new Set<string>();
    let migratedLegacy = 0;
    let seededDemo = 0;

    for (const docSnap of snap.docs) {
      existingIds.add(docSnap.id);
      const data = docSnap.data();
      const needsMigration =
        !data.schoolId || !data.startAt || !data.status || !data.discoverKey || !data.id;

      const mapped = mapFirestoreEventDoc(docSnap.id, data);
      if (!mapped) continue;

      await ensureClubExistsForSeed({
        schoolId,
        clubId: mapped.clubId,
        clubName: mapped.hostClub,
        category: mapped.category,
        location: mapped.location || 'Main Campus',
        adminUid,
      });

      if (!needsMigration) continue;

      const demoMatch = demoById.get(docSnap.id);
      const startAt = mapped.startAt;
      const endAt = mapped.endAt;
      const status: EventStatus = 'published';
      const visibility: EventVisibility = 'public';

      await setDoc(doc(db, 'events', docSnap.id), {
        id: docSnap.id,
        schoolId,
        title: mapped.title,
        description: mapped.description || demoMatch?.description || 'Campus event details.',
        hostClub: mapped.hostClub,
        clubId: mapped.clubId,
        category: demoMatch?.category ?? mapped.category,
        startAt: Timestamp.fromDate(startAt),
        endAt: Timestamp.fromDate(endAt),
        timezone,
        location: mapped.location,
        ...(mapped.imageUrl ? { imageUrl: mapped.imageUrl } : {}),
        createdBy: adminUid,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
        status,
        visibility,
        rsvpCount: mapped.rsvpCount,
        discoverKey: computeDiscoverKey(schoolId, status, visibility, adminUid),
        isDemoSeed: true,
      });
      migratedLegacy += 1;
    }

    for (const demoEvt of demoEvents) {
      await ensureClubExistsForSeed({
        schoolId,
        clubId: demoEvt.clubId,
        clubName: demoEvt.hostClub,
        category: demoEvt.category,
        location: demoEvt.location || 'Main Campus',
        adminUid,
      });

      if (existingIds.has(demoEvt.id)) continue;
      await setDoc(doc(db, 'events', demoEvt.id), {
        id: demoEvt.id,
        schoolId,
        title: demoEvt.title,
        description: demoEvt.description,
        hostClub: demoEvt.hostClub,
        clubId: demoEvt.clubId,
        category: demoEvt.category,
        startAt: Timestamp.fromDate(demoEvt.startAt),
        endAt: Timestamp.fromDate(demoEvt.endAt),
        timezone,
        location: demoEvt.location,
        ...(demoEvt.imageUrl ? { imageUrl: demoEvt.imageUrl } : {}),
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'published',
        visibility: 'public',
        rsvpCount: demoEvt.rsvpCount,
        discoverKey: computeDiscoverKey(schoolId, 'published', 'public', adminUid),
        isDemoSeed: true,
      });
      seededDemo += 1;
    }

    return { migratedLegacy, seededDemo };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
