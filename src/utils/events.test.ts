import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleCalendarUrl,
  buildIcsContent,
  filterEvents,
  formatEventDateTime,
  getIcsFilename,
  getTimeframeBucket,
  groupEventsByTimeframe,
  inferEventCategory,
  parseDemoEvents,
  splitMyEvents,
} from './events';

const NOW = new Date('2026-11-17T09:00:00'); // Tuesday local

const SAMPLE_RAW = [
  {
    id: 'evt-later',
    title: 'Winter Hackathon Team Mixer',
    hostClub: 'CS & Makers Club',
    dateTime: '2026-12-03T15:30:00',
    location: 'Media Center 202',
    description: 'Pitch ideas, form teams.',
    rsvpCount: 18,
  },
  {
    id: 'evt-today',
    title: 'Robotics Club Build Night',
    hostClub: 'FRC Team 4210',
    dateTime: '2026-11-17T15:30:00',
    location: 'Engineering Lab 104',
    description: 'Drivetrain assembly, wiring & testing.',
    rsvpCount: 14,
  },
  {
    id: 'evt-week',
    title: 'Varsity Basketball Home Opener',
    hostClub: 'Oakridge Athletics',
    dateTime: '2026-11-19T18:30:00',
    location: 'Main Gymnasium',
    description: 'Tip-off against Northside Prep.',
    rsvpCount: 42,
  },
];

test('parseDemoEvents sorts chronologically ascending regardless of input order', () => {
  const events = parseDemoEvents(SAMPLE_RAW);
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((e) => e.id),
    ['evt-today', 'evt-week', 'evt-later']
  );
  assert.equal(events[0].category, 'STEM & Makers');
  assert.equal(events[1].category, 'Athletics');
});

test('inferEventCategory maps club and event keywords deterministically', () => {
  assert.equal(
    inferEventCategory({ id: '1', title: 'Fall Acoustic & Jazz Coffeehouse', hostClub: 'Music' }),
    'Arts & Music'
  );
  assert.equal(
    inferEventCategory({ id: '2', title: 'Student Council Open Forum', hostClub: 'ASB' }),
    'Leadership'
  );
  assert.equal(
    inferEventCategory({ id: '3', title: 'Model UN & Debate Mock Session', hostClub: 'Debate' }),
    'Academic'
  );
});

test('getTimeframeBucket assigns Today, This Week, and Later accurately', () => {
  const events = parseDemoEvents(SAMPLE_RAW);
  assert.equal(getTimeframeBucket(events[0].dateTime, NOW), 'today');
  assert.equal(getTimeframeBucket(events[1].dateTime, NOW), 'this-week');
  assert.equal(getTimeframeBucket(events[2].dateTime, NOW), 'later');
});

test('groupEventsByTimeframe produces ordered sections with dividers', () => {
  const events = parseDemoEvents(SAMPLE_RAW);
  const groups = groupEventsByTimeframe(events, NOW);
  assert.deepEqual(
    groups.map((g) => g.label),
    ['Today', 'This Week', 'Later']
  );
  assert.equal(groups[0].events[0].title, 'Robotics Club Build Night');
});

test('filterEvents matches by title, hostClub, bucket, and category filter', () => {
  const events = parseDemoEvents(SAMPLE_RAW);
  const byTitle = filterEvents(events, 'robotics', 'all', NOW);
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].id, 'evt-today');

  const byClub = filterEvents(events, 'oakridge', 'all', NOW);
  assert.equal(byClub.length, 1);
  assert.equal(byClub[0].id, 'evt-week');

  const byBucket = filterEvents(events, '', 'later', NOW);
  assert.equal(byBucket.length, 1);
  assert.equal(byBucket[0].id, 'evt-later');

  const byCategory = filterEvents(events, '', 'all', NOW, 'Athletics');
  assert.equal(byCategory.length, 1);
  assert.equal(byCategory[0].id, 'evt-week');

  const empty = filterEvents(events, 'nonexistent-club', 'all', NOW);
  assert.equal(empty.length, 0);
});

test('splitMyEvents partitions attending, upcoming, and past events cleanly', () => {
  const events = parseDemoEvents([
    ...SAMPLE_RAW,
    {
      id: 'evt-past',
      title: 'October Club Fair',
      hostClub: 'ASB',
      dateTime: '2026-10-10T12:00:00',
      location: 'Main Quad',
      description: 'Past club fair.',
      rsvpCount: 55,
    },
  ]);

  const result = splitMyEvents(events, { 'evt-today': true, 'evt-past': true }, NOW);
  assert.deepEqual(
    result.attending.map((e) => e.id),
    ['evt-past', 'evt-today']
  );
  assert.deepEqual(
    result.upcoming.map((e) => e.id),
    ['evt-today', 'evt-week', 'evt-later']
  );
  assert.deepEqual(
    result.past.map((e) => e.id),
    ['evt-past']
  );
});

test('formatEventDateTime formats Today concisely and future dates with weekday', () => {
  const events = parseDemoEvents(SAMPLE_RAW);
  assert.match(formatEventDateTime(events[0].dateTime, NOW), /^Today · 3:30 PM$/);
  assert.match(formatEventDateTime(events[1].dateTime, NOW), /^Thu, Nov 19 · 6:30 PM$/);
});

test('buildIcsContent generates valid RFC 5545 VCALENDAR output with escaped commas', () => {
  const events = parseDemoEvents(SAMPLE_RAW);
  const ics = buildIcsContent(events[0]);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('SUMMARY:Robotics Club Build Night'));
  assert.ok(ics.includes('LOCATION:Engineering Lab 104'));
  assert.ok(ics.includes('DESCRIPTION:Hosted by FRC Team 4210\\n\\nDrivetrain assembly\\, wiring & testing.'));
  assert.ok(ics.endsWith('END:VCALENDAR'));
  assert.equal(getIcsFilename(events[0].title), 'robotics-club-build-night.ics');
});

test('buildGoogleCalendarUrl encodes fields and formats UTC date range', () => {
  const events = parseDemoEvents(SAMPLE_RAW);
  const url = buildGoogleCalendarUrl(events[0]);
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  assert.ok(url.includes('&text=Robotics%20Club%20Build%20Night'));
  assert.ok(url.includes('&location=Engineering%20Lab%20104'));
  assert.match(url, /&dates=\d{8}T\d{6}Z\/\d{8}T\d{6}Z/);
  assert.ok(url.includes(`&details=${encodeURIComponent('Hosted by FRC Team 4210\n\nDrivetrain assembly, wiring & testing.')}`));
});
