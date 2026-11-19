import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchoolBackupSnapshot } from './backupExport';
import type { SchoolConfig } from '../config/school';
import type { Club } from '../types/club';
import type { SchoolEvent } from '../types/event';

const SCHOOL: SchoolConfig = {
  id: 'oakridge-high',
  name: 'Oakridge High School',
  timezone: 'America/Los_Angeles',
  status: 'active',
  allowPublicDiscovery: true,
};

test('buildSchoolBackupSnapshot enforces school isolation and strips raw UIDs', () => {
  const clubs: Club[] = [
    {
      id: 'robotics',
      schoolId: 'oakridge-high',
      name: 'Robotics Club',
      slug: 'robotics',
      description: 'Building autonomous robots for regional competitions.',
      category: 'Robotics & Engineering',
      visibility: 'public',
      status: 'active',
      isOfficial: true,
      discoverKey: 'public:oakridge-high',
      followerCount: 18,
      publicOrganizers: [
        { uid: 'secret-organizer-uid-12345', displayName: 'Maya Patel', roleTitle: 'President' },
      ],
      createdBy: 'secret-admin-uid-99999',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      updatedAt: new Date('2026-01-10T00:00:00.000Z'),
      lastActivityAt: new Date('2026-01-10T00:00:00.000Z'),
    },
    {
      id: 'other-school-club',
      schoolId: 'westview-high',
      name: 'Westview Chess',
      slug: 'westview-chess',
      description: 'Should never be included in Oakridge backup.',
      category: 'Academic & Research',
      visibility: 'public',
      status: 'active',
      isOfficial: true,
      discoverKey: 'public:westview-high',
      followerCount: 12,
      createdBy: 'other-admin',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      updatedAt: new Date('2026-01-10T00:00:00.000Z'),
      lastActivityAt: new Date('2026-01-10T00:00:00.000Z'),
    },
  ];

  const events: SchoolEvent[] = [
    {
      id: 'evt-1',
      schoolId: 'oakridge-high',
      title: 'Spring Showcase',
      description: 'Live robot demos in Lab 104.',
      hostClub: 'Robotics Club',
      clubId: 'robotics',
      category: 'STEM & Makers',
      dateTime: new Date('2026-05-10T22:00:00.000Z'),
      startAt: new Date('2026-05-10T22:00:00.000Z'),
      endAt: new Date('2026-05-10T23:30:00.000Z'),
      timezone: 'America/Los_Angeles',
      location: 'Lab 104',
      status: 'published',
      visibility: 'public',
      discoverKey: 'public:oakridge-high',
      rsvpCount: 34,
      createdBy: 'secret-organizer-uid-12345',
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    },
    {
      id: 'evt-westview',
      schoolId: 'westview-high',
      title: 'Westview Match',
      description: 'Cross-school event that must be excluded.',
      hostClub: 'Westview Chess',
      clubId: 'other-school-club',
      category: 'Academic',
      dateTime: new Date('2026-05-10T22:00:00.000Z'),
      startAt: new Date('2026-05-10T22:00:00.000Z'),
      endAt: new Date('2026-05-10T23:30:00.000Z'),
      timezone: 'America/Los_Angeles',
      location: 'Room 202',
      status: 'published',
      visibility: 'public',
      discoverKey: 'public:westview-high',
      rsvpCount: 10,
      createdBy: 'other-admin',
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    },
  ];

  const snapshot = buildSchoolBackupSnapshot({
    schoolConfig: SCHOOL,
    clubs,
    events,
    exportedAt: new Date('2026-05-05T12:00:00.000Z'),
  });

  assert.equal(snapshot.summary.clubCount, 1);
  assert.equal(snapshot.summary.eventCount, 1);
  assert.equal(snapshot.clubs[0].id, 'robotics');
  assert.equal(snapshot.events[0].id, 'evt-1');

  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('secret-organizer-uid-12345'), false);
  assert.equal(serialized.includes('secret-admin-uid-99999'), false);
  assert.equal(serialized.includes('westview-high'), false);
});
