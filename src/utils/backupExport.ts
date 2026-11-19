import type { SchoolConfig } from '../config/school';
import type { Club } from '../types/club';
import type { SchoolEvent } from '../types/event';

export interface SchoolBackupSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  privacyNotice: string;
  school: SchoolConfig;
  summary: {
    clubCount: number;
    eventCount: number;
  };
  clubs: Array<{
    id: string;
    schoolId: string;
    name: string;
    slug: string;
    shortDescription?: string;
    description: string;
    category: string;
    visibility: string;
    status: string;
    isOfficial: boolean;
    meetingSchedule?: string;
    meetingLocation?: string;
    contactEmail?: string;
    announcement?: string;
    followerCount: number;
    publicOrganizers: Array<{ displayName: string; roleTitle?: string }>;
  }>;
  events: Array<{
    id: string;
    schoolId: string;
    title: string;
    description: string;
    hostClub: string;
    clubId: string;
    category: string;
    startAt: string;
    endAt: string;
    timezone: string;
    location: string;
    status: string;
    visibility: string;
    rsvpCount: number;
    cancellationReason?: string;
  }>;
}

/**
 * Builds a PII-minimized operational JSON backup for School Administrators on Starter Tier.
 * Excludes student attendee lists, follower rosters, member emails, notification inboxes,
 * device tokens, and raw Firebase UIDs.
 */
export function buildSchoolBackupSnapshot(params: {
  schoolConfig: SchoolConfig;
  clubs: Club[];
  events: SchoolEvent[];
  exportedAt?: Date;
}): SchoolBackupSnapshot {
  const { schoolConfig, clubs, events, exportedAt = new Date() } = params;

  const schoolClubs = clubs
    .filter((c) => c.schoolId === schoolConfig.id)
    .map((c) => ({
      id: c.id,
      schoolId: c.schoolId,
      name: c.name,
      slug: c.slug,
      ...(c.shortDescription ? { shortDescription: c.shortDescription } : {}),
      description: c.description,
      category: c.category,
      visibility: c.visibility,
      status: c.status,
      isOfficial: c.isOfficial,
      ...(c.meetingSchedule ? { meetingSchedule: c.meetingSchedule } : {}),
      ...(c.meetingLocation ? { meetingLocation: c.meetingLocation } : {}),
      ...(c.contactEmail ? { contactEmail: c.contactEmail } : {}),
      ...(c.announcement ? { announcement: c.announcement } : {}),
      followerCount: c.followerCount,
      publicOrganizers: (c.publicOrganizers || []).map((o) => ({
        displayName: o.displayName,
        ...(o.roleTitle ? { roleTitle: o.roleTitle } : {}),
      })),
    }));

  const schoolEvents = events
    .filter((e) => e.schoolId === schoolConfig.id)
    .map((e) => ({
      id: e.id,
      schoolId: e.schoolId,
      title: e.title,
      description: e.description,
      hostClub: e.hostClub,
      clubId: e.clubId,
      category: e.category,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt.toISOString(),
      timezone: e.timezone,
      location: e.location,
      status: e.status,
      visibility: e.visibility,
      rsvpCount: e.rsvpCount,
      ...(e.cancellationReason ? { cancellationReason: e.cancellationReason } : {}),
    }));

  return {
    schemaVersion: 1,
    exportedAt: exportedAt.toISOString(),
    privacyNotice:
      'Operational campus snapshot only. Contains aggregate counts and public/school metadata; student attendee identities, member emails, and raw Firebase UIDs are excluded.',
    school: { ...schoolConfig },
    summary: {
      clubCount: schoolClubs.length,
      eventCount: schoolEvents.length,
    },
    clubs: schoolClubs,
    events: schoolEvents,
  };
}

export function downloadSchoolBackupJson(snapshot: SchoolBackupSnapshot): void {
  const dateStamp = snapshot.exportedAt.slice(0, 10);
  const safeSchoolId = snapshot.school.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `oneplace-backup-${safeSchoolId || 'school'}-${dateStamp}.json`;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
