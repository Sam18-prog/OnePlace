import type {
  DemoEventRaw,
  EventCategory,
  GroupedEvents,
  SchoolEvent,
  TimeframeBucket,
} from '../types/event';

const MAX_TITLE_LEN = 120;
const MAX_CLUB_LEN = 80;
const MAX_LOCATION_LEN = 120;
const MAX_DESC_LEN = 600;
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export const EVENT_CATEGORIES: EventCategory[] = [
  'STEM & Makers',
  'Leadership',
  'Athletics',
  'Academic',
  'Arts & Music',
];

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

export function parseDemoEvents(raw: unknown): SchoolEvent[] {
  if (!Array.isArray(raw)) {
    throw new Error('Invalid events payload: expected an array.');
  }

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

    const date = new Date(candidate.dateTime);
    if (Number.isNaN(date.getTime())) continue;

    const id = VALID_ID_REGEX.test(candidate.id)
      ? candidate.id.slice(0, 128)
      : sanitizeId(candidate.id);

    const title = candidate.title.trim().slice(0, MAX_TITLE_LEN);
    const hostClub = candidate.hostClub.trim().slice(0, MAX_CLUB_LEN);

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

    parsed.push({
      id,
      title,
      hostClub,
      dateTime: date,
      location: candidate.location.trim().slice(0, MAX_LOCATION_LEN),
      description:
        typeof candidate.description === 'string'
          ? candidate.description.trim().slice(0, MAX_DESC_LEN)
          : '',
      rsvpCount,
      category,
    });
  }

  return sortEventsAscending(parsed);
}

export function sortEventsAscending(events: SchoolEvent[]): SchoolEvent[] {
  return [...events].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
}

export function getTimeframeBucket(eventDate: Date, now: Date = new Date()): TimeframeBucket {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (eventDate.getTime() <= endOfToday.getTime() && eventDate.getTime() >= startOfToday.getTime()) {
    return 'today';
  }

  // Past events from earlier days still belong to the top bucket if present
  if (eventDate.getTime() < startOfToday.getTime()) {
    return 'today';
  }

  // End of current week (Sunday 23:59:59.999)
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
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
    if (bucketFilter !== 'all' && getTimeframeBucket(event.dateTime, now) !== bucketFilter) {
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
  const upcoming = sorted.filter((event) => event.dateTime.getTime() >= startOfToday.getTime());
  const past = sorted.filter((event) => event.dateTime.getTime() < startOfToday.getTime());

  return { attending, upcoming, past };
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
    const bucket = getTimeframeBucket(event.dateTime, now);
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

export function formatEventDateTime(date: Date, now: Date = new Date()): string {
  const bucket = getTimeframeBucket(date, now);
  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);

  return `${dateStr} · ${timeStr}`;
}

export function formatFullEventDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatEventTimeOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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

export function buildIcsContent(event: SchoolEvent, durationMinutes: number = 60): string {
  const start = event.dateTime;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
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
  durationMinutes: number = 60
): string {
  const start = event.dateTime;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
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
