import type { EventCategory, EventFormValues, EventStatus, EventVisibility, SchoolEvent } from '../types/event';
import type { MemberRole, MemberStatus, MembershipCapabilities, SchoolMembership } from '../types/membership';

export const EVENT_TITLE_MIN = 3;
export const EVENT_TITLE_MAX = 120;
export const EVENT_CLUB_MIN = 2;
export const EVENT_CLUB_MAX = 80;
export const EVENT_LOCATION_MIN = 2;
export const EVENT_LOCATION_MAX = 120;
export const EVENT_DESC_MIN = 10;
export const EVENT_DESC_MAX = 1000;
export const EVENT_IMAGE_URL_MAX = 500;
export const CANCELLATION_REASON_MAX = 240;

export const ALL_EVENT_CATEGORIES: EventCategory[] = [
  'STEM & Makers',
  'Leadership',
  'Athletics',
  'Academic',
  'Arts & Music',
  'Social & Community',
];

export interface EventFormErrors {
  title?: string;
  hostClub?: string;
  category?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  visibility?: string;
}

export interface EventValidationResult {
  valid: boolean;
  errors: EventFormErrors;
  startAt: Date | null;
  endAt: Date | null;
}

export function slugifyClubId(hostClub: string): string {
  const cleaned = hostClub
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned.length >= 2 ? cleaned : 'campus-club';
}

export function computeDiscoverKey(
  schoolId: string,
  status: EventStatus,
  visibility: EventVisibility,
  createdBy: string
): string {
  if (status === 'draft') {
    return `draft:${createdBy}`;
  }
  return visibility === 'school' ? `school:${schoolId}` : `public:${schoolId}`;
}

export function isValidEventImageInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length > EVENT_IMAGE_URL_MAX) return false;
  if (trimmed.startsWith('/src/assets/images/')) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Computes the UTC offset in milliseconds for a given IANA timezone at a rough UTC instant.
 */
function getTimezoneOffsetMs(utcDate: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(utcDate);
    const lookup: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        lookup[part.type] = Number(part.value);
      }
    }
    const hour = lookup.hour === 24 ? 0 : lookup.hour;
    const tzAsUtc = Date.UTC(
      lookup.year,
      lookup.month - 1,
      lookup.day,
      hour,
      lookup.minute,
      lookup.second
    );
    return tzAsUtc - utcDate.getTime();
  } catch {
    return -utcDate.getTimezoneOffset() * 60_000;
  }
}

/**
 * Parses YYYY-MM-DD + HH:mm strictly in the configured school timezone into a real JS Date.
 */
export function parseSchoolDateTime(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return null;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Two-pass offset refinement handles DST transitions accurately
  const offset1 = getTimezoneOffsetMs(new Date(naiveUtc), timeZone);
  const candidate = naiveUtc - offset1;
  const offset2 = getTimezoneOffsetMs(new Date(candidate), timeZone);
  const finalDate = new Date(naiveUtc - offset2);

  if (Number.isNaN(finalDate.getTime())) return null;

  // Verify calendar date didn't overflow (e.g. Feb 30 -> Mar 2)
  const check = formatDateInTimezone(finalDate, timeZone);
  if (check.date !== dateStr) return null;

  return finalDate;
}

export function formatDateInTimezone(
  date: Date,
  timeZone: string
): { date: string; time: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        map[part.type] = part.value;
      }
    }
    const hh = map.hour === '24' ? '00' : map.hour;
    return {
      date: `${map.year}-${map.month}-${map.day}`,
      time: `${hh}:${map.minute}`,
    };
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
  }
}

export function validateEventForm(
  values: EventFormValues,
  targetStatus: EventStatus,
  timeZone: string,
  options: {
    now?: Date;
    isEditingExistingPublished?: boolean;
  } = {}
): EventValidationResult {
  const now = options.now ?? new Date();
  const errors: EventFormErrors = {};

  const title = values.title.trim();
  if (title.length < EVENT_TITLE_MIN) {
    errors.title = `Title must be at least ${EVENT_TITLE_MIN} characters.`;
  } else if (title.length > EVENT_TITLE_MAX) {
    errors.title = `Title must be ${EVENT_TITLE_MAX} characters or fewer.`;
  }

  const hostClub = values.hostClub.trim();
  if (hostClub.length < EVENT_CLUB_MIN) {
    errors.hostClub = `Hosting club must be at least ${EVENT_CLUB_MIN} characters.`;
  } else if (hostClub.length > EVENT_CLUB_MAX) {
    errors.hostClub = `Hosting club must be ${EVENT_CLUB_MAX} characters or fewer.`;
  }

  if (!ALL_EVENT_CATEGORIES.includes(values.category)) {
    errors.category = 'Choose a valid campus category.';
  }

  const location = values.location.trim();
  if (location.length < EVENT_LOCATION_MIN) {
    errors.location = `Venue must be at least ${EVENT_LOCATION_MIN} characters.`;
  } else if (location.length > EVENT_LOCATION_MAX) {
    errors.location = `Venue must be ${EVENT_LOCATION_MAX} characters or fewer.`;
  }

  const description = values.description.trim();
  if (targetStatus === 'published' && description.length < EVENT_DESC_MIN) {
    errors.description = `Description must be at least ${EVENT_DESC_MIN} characters to publish.`;
  } else if (description.length > EVENT_DESC_MAX) {
    errors.description = `Description must be ${EVENT_DESC_MAX} characters or fewer.`;
  }

  if (!isValidEventImageInput(values.imageUrl)) {
    errors.imageUrl = 'Enter a valid HTTPS image URL (e.g., https://...) or leave blank.';
  }

  if (values.visibility !== 'public' && values.visibility !== 'school') {
    errors.visibility = 'Visibility must be Public or School-only.';
  }

  const startAt = parseSchoolDateTime(values.eventDate, values.startTime, timeZone);
  if (!startAt) {
    errors.eventDate = 'Enter a valid event date and start time.';
  }

  const endAt = parseSchoolDateTime(values.eventDate, values.endTime, timeZone);
  if (!endAt) {
    errors.endTime = 'Enter a valid end time.';
  } else if (startAt && endAt.getTime() <= startAt.getTime()) {
    errors.endTime = 'End time must be after the start time.';
  }

  // Enforce future/current schedule when publishing a new/draft event
  const graceMs = 15 * 60 * 1000;
  if (
    startAt &&
    targetStatus === 'published' &&
    !options.isEditingExistingPublished &&
    startAt.getTime() < now.getTime() - graceMs
  ) {
    errors.eventDate =
      'Newly published events cannot be in the past. Save as Draft or choose an upcoming date.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    startAt,
    endAt,
  };
}

export function isPastEvent(event: Pick<SchoolEvent, 'endAt' | 'startAt'>, now: Date = new Date()): boolean {
  return event.endAt.getTime() < now.getTime();
}

export function canAcceptRsvp(
  event: Pick<SchoolEvent, 'status' | 'visibility' | 'endAt' | 'startAt'>,
  isActiveMember: boolean,
  now: Date = new Date()
): boolean {
  if (event.status !== 'published') return false;
  if (isPastEvent(event, now)) return false;
  if (event.visibility === 'school' && !isActiveMember) return false;
  return true;
}

export function canTransitionEventStatus(
  from: EventStatus,
  to: EventStatus,
  role: MemberRole
): boolean {
  if (role === 'student') return false;
  if (from === to) return true;
  if (from === 'draft') {
    return to === 'published' || to === 'cancelled';
  }
  if (from === 'published') {
    return to === 'cancelled';
  }
  // Cancelled events are terminal for organizers; admins may restore if needed
  if (from === 'cancelled') {
    return role === 'admin' && (to === 'draft' || to === 'published');
  }
  return false;
}

export function getMembershipCapabilities(
  membership: Pick<SchoolMembership, 'role' | 'status'> | null
): MembershipCapabilities {
  if (!membership || membership.status !== 'active') {
    return {
      isActiveMember: false,
      canAccessOrganizer: false,
      canManageAllSchoolEvents: false,
      canManageRoles: false,
      canManageSchoolSettings: false,
    };
  }
  const isOrganizerOrAdmin = membership.role === 'organizer' || membership.role === 'admin';
  const isAdmin = membership.role === 'admin';
  return {
    isActiveMember: true,
    canAccessOrganizer: isOrganizerOrAdmin,
    canManageAllSchoolEvents: isAdmin,
    canManageRoles: isAdmin,
    canManageSchoolSettings: isAdmin,
  };
}

export function canManageEvent(
  event: Pick<SchoolEvent, 'schoolId' | 'createdBy'>,
  membership: Pick<SchoolMembership, 'uid' | 'schoolId' | 'role' | 'status'> | null
): boolean {
  if (!membership || membership.status !== 'active') return false;
  if (membership.schoolId !== event.schoolId) return false;
  if (membership.role === 'admin') return true;
  if (membership.role === 'organizer') return event.createdBy === membership.uid;
  return false;
}

export function isValidMemberRole(role: unknown): role is MemberRole {
  return role === 'student' || role === 'organizer' || role === 'admin';
}

export function isValidMemberStatus(status: unknown): status is MemberStatus {
  return status === 'active' || status === 'suspended';
}
