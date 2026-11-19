import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLUBS_CSV_TEMPLATE,
  EVENTS_CSV_TEMPLATE,
  parseCsvText,
  validateClubCsvImport,
  validateEventCsvImport,
} from './csvImport';
import type { Club } from '../types/club';
import type { SchoolEvent } from '../types/event';

const EXISTING_CLUBS: Club[] = [
  {
    id: 'robotics-club',
    schoolId: 'oakridge-high',
    name: 'Robotics Club',
    slug: 'robotics-club',
    description: 'Autonomous robotics engineering community.',
    category: 'Robotics & Engineering',
    visibility: 'public',
    status: 'active',
    isOfficial: true,
    discoverKey: 'public:oakridge-high',
    followerCount: 12,
    createdBy: 'admin-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    lastActivityAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'suspended-club',
    schoolId: 'oakridge-high',
    name: 'Suspended Club',
    slug: 'suspended-club',
    description: 'Currently paused club.',
    category: 'Academic & Research',
    visibility: 'public',
    status: 'suspended',
    isOfficial: false,
    discoverKey: 'suspended:oakridge-high',
    followerCount: 0,
    createdBy: 'admin-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    lastActivityAt: new Date('2026-01-01T00:00:00Z'),
  },
];

const EXISTING_EVENTS: SchoolEvent[] = [
  {
    id: 'evt-existing',
    schoolId: 'oakridge-high',
    title: 'Existing Demo Night',
    description: 'Live robot showcase in Lab 104.',
    hostClub: 'Robotics Club',
    clubId: 'robotics-club',
    category: 'STEM & Makers',
    dateTime: new Date('2026-10-20T22:30:00Z'),
    startAt: new Date('2026-10-20T22:30:00Z'),
    endAt: new Date('2026-10-21T00:00:00Z'),
    timezone: 'America/Los_Angeles',
    location: 'Lab 104',
    status: 'published',
    visibility: 'public',
    discoverKey: 'public:oakridge-high',
    rsvpCount: 5,
    createdBy: 'admin-1',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  },
];

test('parseCsvText handles quoted commas, escaped quotes, and BOM', () => {
  const csv = '\uFEFFtitle,description\n"Fall, Kickoff","Say ""Hello"" to robotics"';
  const parsed = parseCsvText(csv);
  assert.deepEqual(parsed.headers, ['title', 'description']);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].raw.title, 'Fall, Kickoff');
  assert.equal(parsed.rows[0].raw.description, 'Say "Hello" to robotics');
});

test('validateEventCsvImport approves valid rows and flags missing clubs, bad dates, unsafe URLs, and duplicates', () => {
  const csv = [
    'title,description,clubName,clubId,category,date,startTime,endTime,timezone,location,imageUrl,visibility',
    '"Spring Build Night","Hands-on drivetrain workshop for all members.","Robotics Club","robotics-club","STEM & Makers","2026-10-25","15:30","17:00","America/Los_Angeles","Lab 104","","public"',
    '"Existing Demo Night","Duplicate of an existing event in Firestore.","Robotics Club","robotics-club","STEM & Makers","2026-10-20","15:30","17:00","America/Los_Angeles","Lab 104","","public"',
    '"Spring Build Night","Duplicate inside the same CSV upload.","Robotics Club","robotics-club","STEM & Makers","2026-10-25","15:30","17:00","America/Los_Angeles","Lab 104","","public"',
    '"Orphan Event","Missing club should be rejected.","Ghost Club","","Academic","2026-10-28","15:00","16:00","America/Los_Angeles","Room 12","","public"',
    '"Suspended Host","Suspended club should be rejected.","Suspended Club","suspended-club","Academic","2026-10-28","15:00","16:00","America/Los_Angeles","Room 12","","public"',
    '"Bad Dates & XSS","Invalid date and javascript URL.","Robotics Club","robotics-club","STEM & Makers","2026-02-31","17:00","16:00","America/Los_Angeles","Lab 104","javascript:alert(1)","public"',
  ].join('\n');

  const summary = validateEventCsvImport({
    csvText: csv,
    existingClubs: EXISTING_CLUBS,
    existingEvents: EXISTING_EVENTS,
    schoolTimezone: 'America/Los_Angeles',
  });

  assert.equal(summary.totalRows, 6);
  assert.equal(summary.validRows.length, 1);
  assert.equal(summary.duplicateRows.length, 2);
  assert.equal(summary.errorRows.length, 3);
  assert.equal(summary.validRows[0].values?.clubId, 'robotics-club');
  assert.ok(summary.errorRows[2].errors.some((e) => e.includes('Invalid date')));
  assert.ok(summary.errorRows[2].errors.some((e) => e.includes('endTime must be later')));
  assert.ok(summary.errorRows[2].errors.some((e) => e.includes('https://')));
});

test('validateEventCsvImport accepts bundled EVENTS_CSV_TEMPLATE when club exists', () => {
  const summary = validateEventCsvImport({
    csvText: EVENTS_CSV_TEMPLATE,
    existingClubs: EXISTING_CLUBS,
    existingEvents: EXISTING_EVENTS,
    schoolTimezone: 'America/Los_Angeles',
  });
  assert.equal(summary.validRows.length, 1);
  assert.equal(summary.errorRows.length, 0);
});

test('validateClubCsvImport detects duplicates and validates schema without assigning organizers', () => {
  const csv = [
    'name,shortDescription,description,category,visibility,meetingSchedule,meetingLocation,contactEmail,coverImageUrl,logoUrl,isOfficial',
    '"Robotics Club","Already registered.","Duplicate club that must be skipped cleanly.","Robotics & Engineering","public","Wed 3:30 PM","Lab 104","robotics@school.edu","","","true"',
    '"Debate Society","Weekly parliamentary debates.","Student-led public speaking and debate organization welcoming all grade levels.","Leadership & Student Government","public","Thursdays 4:00 PM","Room 210","debate@school.edu","","","true"',
    '"Bad Club","Short","Too short","Unknown Category","public","","","not-an-email","http://insecure.example/img.png","","true"',
  ].join('\n');

  const summary = validateClubCsvImport({
    csvText: csv,
    existingClubs: EXISTING_CLUBS,
  });

  assert.equal(summary.totalRows, 3);
  assert.equal(summary.validRows.length, 1);
  assert.equal(summary.duplicateRows.length, 1);
  assert.equal(summary.errorRows.length, 1);
  assert.equal(summary.validRows[0].values?.name, 'Debate Society');

  // Template validates cleanly against an empty school
  const templateCheck = validateClubCsvImport({
    csvText: CLUBS_CSV_TEMPLATE,
    existingClubs: [],
  });
  assert.equal(templateCheck.validRows.length, 1);
});
