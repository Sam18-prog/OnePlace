import type {
  DemoEventRaw,
  EventCategory,
  GroupedEvents,
  SchoolEvent,
  TimeframeBucket,
} from '../types/event';
import { DEFAULT_SCHOOL_ID, DEFAULT_SCHOOL_TIMEZONE } from '../config/school';
import { isSafeMediaUrl } from './eventMedia';
import {
  ALL_EVENT_CATEGORIES,
  computeDiscoverKey,
  EVENT_DESC_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  EVENT_CLUB_MAX,
  slugifyClubId,
} from './eventValidation';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export const EVENT_CATEGORIES: EventCategory[] = ALL_EVENT_CATEGORIES;

export function inferEventCategory(
  event: Pick<SchoolEvent, 'id' | 'title' | 'hostClub'>
): EventCategory {
  const haystack = `${event.id} ${event.title} ${event.hostClub}`.toLowerCase();
  if (
    haystack.includes('athletic') ||
    haystack.includes('basketball') ||
    haystack.includes('hoops') ||
    haystack.includes('varsity') ||
    haystack.includes('soccer') ||
    haystack.includes('track')
  ) {
    return 'Athletics';
  }
  if (
    haystack.includes('music') ||
    haystack.includes('jazz') ||
    haystack.includes('coffeehouse') ||
    haystack.includes('theater') ||
    haystack.includes('art')
  ) {
    return 'Arts & Music';
  }
  if (
    haystack.includes('robotics') ||
    haystack.includes('hackathon') ||
    haystack.includes('makers') ||
    haystack.includes('stem') ||
    haystack.includes('coding')
  ) {
    return 'STEM & Makers';
  }
  if (
    haystack.includes('social') ||
    haystack.includes('mixer') ||
    haystack.includes('community') ||
    haystack.includes('spirit') ||
    haystack.includes('picnic')
  ) {
    return 'Social & Community';
  }
  if (
    haystack.includes('council') ||
    haystack.includes('student body') ||
    haystack.includes('leadership') ||
    haystack.includes('forum')
  ) {
    return 'Leadership';
  }
  if (
    haystack.includes('debate') ||
    haystack.includes('model un') ||
    haystack.includes('academic') ||
    haystack.includes('quiz')
  ) {
    return 'Academic';
  }
  return 'STEM & Makers';
}

export function sanitizeId(rawId: string): string {
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  return cleaned.slice(0, 128) || 'event';
}

export function parseDemoEvents(
  raw: unknown,
  options: { schoolId?: string; timezone?: string; createdBy?: string } = {}
): SchoolEvent[] {
  if (!Array.isArray(raw)) {
    throw new Error('Invalid events payload: expected an array.');
  }

  const schoolId = options.schoolId ?? DEFAULT_SCHOOL_ID;
  const timezone = options.timezone ?? DEFAULT_SCHOOL_TIMEZONE;
  const createdBy = options.createdBy ?? 'school-seed';

  const parsed: SchoolEvent[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<DemoEventRaw>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.hostClub !== 'string' ||
      typeof candidate.dateTime !== 'string' ||
      typeof candidate.location !== 'string'
    ) {
      continue;
    }

    const startAt = new Date(candidate.dateTime);
    if (Number.isNaN(startAt.getTime())) continue;

    const endCandidate = candidate.endDateTime ? new Date(candidate.endDateTime) : null;
    const endAt =
      endCandidate && !Number.isNaN(endCandidate.getTime()) && endCandidate > startAt
        ? endCandidate
        : new Date(startAt.getTime() + 60 * 60 * 1000);

    const id = VALID_ID_REGEX.test(candidate.id)
      ? candidate.id.slice(0, 128)
      : sanitizeId(candidate.id);

    const title = candidate.title.trim().slice(0, EVENT_TITLE_MAX);
    const hostClub = candidate.hostClub.trim().slice(0, EVENT_CLUB_MAX);

    const rsvpCount =
      typeof candidate.rsvpCount === 'number' &&
      Number.isFinite(candidate.rsvpCount) &&
      candidate.rsvpCount >= 0
        ? Math.floor(candidate.rsvpCount)
        : 0;

    const category =
      candidate.category && EVENT_CATEGORIES.includes(candidate.category)
        ? candidate.category
        : inferEventCategory({ id, title, hostClub });

    const imageUrl = isSafeMediaUrl(candidate.imageUrl)
      ? candidate.imageUrl.trim()
      : undefined;

    const visibility = candidate.visibility === 'school' ? 'school' : 'public';
    const status = 'published' as const;

    parsed.push({
      id,
      schoolId,
      title,
      hostClub,
      clubId: candidate.clubId ? sanitizeId(candidate.clubId) : slugifyClubId(hostClub),
      dateTime: startAt,
      startAt,
      endAt,
      timezone,
      location: candidate.location.trim().slice(0, EVENT_LOCATION_MAX),
      description:
        typeof candidate.description === 'string'
          ? candidate.description.trim().slice(0, EVENT_DESC_MAX)
          : '',
      rsvpCount,
      category,
      createdBy,
      createdAt: startAt,
      updatedAt: startAt,
      status,
      visibility,
      discoverKey: computeDiscoverKey(schoolId, status, visibility, createdBy),
      isDemoSeed: true,
      ...(imageUrl ? { imageUrl } : {}),
    });
  }

  return sortEventsAscending(parsed);
}

export function sortEventsAscending(events: SchoolEvent[]): SchoolEvent[] {
  return [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export function getTimeframeBucket(eventDate: Date, now: Date = new Date()): TimeframeBucket {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (eventDate.getTime() <= endOfToday.getTime() && eventDate.getTime() >= startOfToday.getTime()) {
    return 'today';
  }

  if (eventDate.getTime() < startOfToday.getTime()) {
    return 'today';
  }

  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysUntilSunday,
    23,
    59,
    59,
    999
  );

  if (eventDate.getTime() <= endOfWeek.getTime()) {
    return 'this-week';
  }

  return 'later';
}

export function filterEvents(
  events: SchoolEvent[],
  query: string,
  bucketFilter: TimeframeBucket | 'all' = 'all',
  now: Date = new Date(),
  categoryFilter: EventCategory | 'all' = 'all'
): SchoolEvent[] {
  const normalizedQuery = query.trim().toLowerCase();

  return sortEventsAscending(events).filter((event) => {
    if (bucketFilter !== 'all' && getTimeframeBucket(event.startAt, now) !== bucketFilter) {
      return false;
    }

    if (categoryFilter !== 'all' && event.category !== categoryFilter) {
      return false;
    }

    if (!normalizedQuery) return true;

    return (
      event.title.toLowerCase().includes(normalizedQuery) ||
      event.hostClub.toLowerCase().includes(normalizedQuery) ||
      event.location.toLowerCase().includes(normalizedQuery) ||
      event.category.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function getCategoryCounts(events: SchoolEvent[]): Record<EventCategory, number> {
  const counts: Record<EventCategory, number> = {
    'STEM & Makers': 0,
    Leadership: 0,
    Athletics: 0,
    Academic: 0,
    'Arts & Music': 0,
    'Social & Community': 0,
  };
  for (const event of events) {
    counts[event.category] = (counts[event.category] || 0) + 1;
  }
  return counts;
}

export interface MyEventsPartition {
  attending: SchoolEvent[];
  upcoming: SchoolEvent[];
  past: SchoolEvent[];
}

export function splitMyEvents(
  events: SchoolEvent[],
  attendingById: Record<string, boolean>,
  now: Date = new Date()
): MyEventsPartition {
  const sorted = sortEventsAscending(events);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const attending = sorted.filter((event) => Boolean(attendingById[event.id]));
  const upcoming = sorted.filter((event) => event.startAt.getTime() >= startOfToday.getTime());
  const past = sorted.filter((event) => event.startAt.getTime() < startOfToday.getTime());

  return { attending, upcoming, past };
}

export interface DateGroup {
  dateKey: string;
  label: string;
  events: SchoolEvent[];
}

export function groupEventsByDate(
  events: SchoolEvent[],
  now: Date = new Date()
): DateGroup[] {
  const sorted = sortEventsAscending(events);
  const groups = new Map<string, DateGroup>();

  for (const event of sorted) {
    const d = event.startAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

    if (!groups.has(key)) {
      const isToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();

      const formatted = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(d);

      groups.set(key, {
        dateKey: key,
        label: isToday ? `Today · ${formatted}` : formatted,
        events: [],
      });
    }

    groups.get(key)!.events.push(event);
  }

  return Array.from(groups.values());
}

export function getDateTileParts(date: Date, timeZone?: string): {
  month: string;
  day: string;
  weekday: string;
} {
  const opts = timeZone ? { timeZone } : undefined;
  return {
    month: new Intl.DateTimeFormat('en-US', { ...opts, month: 'short' })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat('en-US', { ...opts, day: 'numeric' }).format(date),
    weekday: new Intl.DateTimeFormat('en-US', { ...opts, weekday: 'short' }).format(date),
  };
}

const BUCKET_LABELS: Record<TimeframeBucket, string> = {
  today: 'Today',
  'this-week': 'This Week',
  later: 'Later',
};

export function groupEventsByTimeframe(
  events: SchoolEvent[],
  now: Date = new Date()
): GroupedEvents[] {
  const sorted = sortEventsAscending(events);
  const buckets: Record<TimeframeBucket, SchoolEvent[]> = {
    today: [],
    'this-week': [],
    later: [],
  };

  for (const event of sorted) {
    const bucket = getTimeframeBucket(event.startAt, now);
    buckets[bucket].push(event);
  }

  const order: TimeframeBucket[] = ['today', 'this-week', 'later'];
  return order
    .filter((bucket) => buckets[bucket].length > 0)
    .map((bucket) => ({
      bucket,
      label: BUCKET_LABELS[bucket],
      events: buckets[bucket],
    }));
}

export function formatEventDateTime(
  date: Date,
  now: Date = new Date(),
  timeZone?: string
): string {
  const bucket = getTimeframeBucket(date, now);
  const timeStr = formatEventTimeOnly(date, timeZone);

  if (bucket === 'today') {
    const isSameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (isSameDay) {
      return `Today · ${timeStr}`;
    }
  }

  const dateStr = new Intl.DateTimeFormat('en-US', {
    ...(timeZone ? { timeZone } : {}),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);

  return `${dateStr} · ${timeStr}`;
}

export function formatFullEventDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    ...(timeZone ? { timeZone } : {}),
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatEventTimeOnly(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    ...(timeZone ? { timeZone } : {}),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatEventTimeRange(startAt: Date, endAt: Date, timeZone?: string): string {
  return `${formatEventTimeOnly(startAt, timeZone)} – ${formatEventTimeOnly(endAt, timeZone)}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsUtcTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

export function buildIcsContent(event: SchoolEvent, fallbackDurationMinutes: number = 60): string {
  const start = event.startAt;
  const end =
    event.endAt && event.endAt.getTime() > start.getTime()
      ? event.endAt
      : new Date(start.getTime() + fallbackDurationMinutes * 60 * 1000);
  const uid = `${event.id}@oneplace.campus`;
  const dtStamp = formatIcsUtcTimestamp(new Date());
  const dtStart = formatIcsUtcTimestamp(start);
  const dtEnd = formatIcsUtcTimestamp(end);
  const descriptionParts = [`Hosted by ${event.hostClub}`, event.description].filter(Boolean);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OnePlace//Campus Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n\n'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function getIcsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'oneplace-event'}.ics`;
}

export function buildGoogleCalendarUrl(
  event: SchoolEvent,
  fallbackDurationMinutes: number = 60
): string {
  const start = event.startAt;
  const end =
    event.endAt && event.endAt.getTime() > start.getTime()
      ? event.endAt
      : new Date(start.getTime() + fallbackDurationMinutes * 60 * 1000);
  const dates = `${formatIcsUtcTimestamp(start)}/${formatIcsUtcTimestamp(end)}`;
  const details = [`Hosted by ${event.hostClub}`, event.description]
    .filter(Boolean)
    .join('\n\n');

  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(event.title)}` +
    `&dates=${dates}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(event.location)}`
  );
}
