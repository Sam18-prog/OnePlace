import { Timestamp } from 'firebase-admin/firestore';
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  buildDedupId,
  detectMeaningfulEventDiff,
  dispatchNotificationBatch,
  FIRESTORE_DATABASE_ID,
  formatEventStartTime,
  getActiveSchoolMemberUids,
  getClubFollowerUids,
  getEventAttendeeUids,
} from './notificationEngine';
import { runNotificationCleanupJob, runScheduledRemindersJob } from './reminders';

export const onEventWritten = onDocumentWritten(
  {
    document: 'events/{eventId}',
    database: FIRESTORE_DATABASE_ID,
  },
  async (event) => {
    const eventId = event.params.eventId;
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    const beforeData = event.data?.before.exists ? event.data.before.data() : undefined;
    const afterData = afterSnap.data();
    if (!afterData) return;

    const diff = detectMeaningfulEventDiff(beforeData, afterData);
    if (diff.kind === 'none') return;

    const schoolId = String(afterData.schoolId || 'oakridge-high');
    const clubId = String(afterData.clubId || '');
    const hostClub = String(afterData.hostClub || 'Campus Club');
    const title = String(afterData.title || 'Campus Event');
    const timezone = String(afterData.timezone || 'America/Los_Angeles');
    const visibility = String(afterData.visibility || 'public');
    const location = String(afterData.location || 'Campus');
    const startAt =
      afterData.startAt instanceof Timestamp ? afterData.startAt.toDate() : new Date();
    const updatedVersion =
      afterData.updatedAt instanceof Timestamp
        ? afterData.updatedAt.toMillis()
        : Date.now();

    if (diff.kind === 'published') {
      if (!clubId) return;
      const followerUids = await getClubFollowerUids(schoolId, clubId);
      if (followerUids.length === 0) return;

      await dispatchNotificationBatch({
        schoolId,
        jobType: 'event_published',
        jobDedupKey: buildDedupId(`evt_pub_${eventId}`),
        recipientUids: followerUids,
        type: 'club_activity',
        prefKey: 'clubNewEvents',
        title: `New event from ${hostClub}`,
        message: `${title} · ${formatEventStartTime(startAt, timezone)} at ${location}`,
        entityType: 'event',
        entityId: eventId,
        actionUrl: `/?view=event&id=${eventId}`,
        visibility,
      });
      return;
    }

    if (diff.kind === 'cancelled') {
      const [attendeeUids, followerUids] = await Promise.all([
        getEventAttendeeUids(eventId),
        clubId ? getClubFollowerUids(schoolId, clubId) : Promise.resolve([]),
      ]);
      const recipients = Array.from(new Set([...attendeeUids, ...followerUids]));
      if (recipients.length === 0) return;

      await dispatchNotificationBatch({
        schoolId,
        jobType: 'event_cancelled',
        jobDedupKey: buildDedupId(`evt_cancel_${eventId}`),
        recipientUids: recipients,
        type: 'event_update',
        prefKey: 'clubEventUpdates',
        title: `Cancelled: ${title}`,
        message: diff.summary,
        entityType: 'event',
        entityId: eventId,
        actionUrl: `/?view=event&id=${eventId}`,
        visibility,
      });
      return;
    }

    if (diff.kind === 'updated') {
      const [attendeeUids, followerUids] = await Promise.all([
        getEventAttendeeUids(eventId),
        clubId ? getClubFollowerUids(schoolId, clubId) : Promise.resolve([]),
      ]);
      const recipients = Array.from(new Set([...attendeeUids, ...followerUids]));
      if (recipients.length === 0) return;

      await dispatchNotificationBatch({
        schoolId,
        jobType: 'event_updated',
        jobDedupKey: buildDedupId(`evt_upd_${eventId}_${updatedVersion}`),
        recipientUids: recipients,
        type: 'event_update',
        prefKey: 'clubEventUpdates',
        title: `Updated: ${title}`,
        message: diff.summary,
        entityType: 'event',
        entityId: eventId,
        actionUrl: `/?view=event&id=${eventId}`,
        visibility,
      });
    }
  }
);

export const onClubUpdated = onDocumentUpdated(
  {
    document: 'schools/{schoolId}/clubs/{clubId}',
    database: FIRESTORE_DATABASE_ID,
  },
  async (event) => {
    const schoolId = event.params.schoolId;
    const clubId = event.params.clubId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    if (after.status !== 'active') return;
    const prevAnnouncement = String(before.announcement || '').trim();
    const nextAnnouncement = String(after.announcement || '').trim();
    if (!nextAnnouncement || prevAnnouncement === nextAnnouncement) return;

    const followerUids = await getClubFollowerUids(schoolId, clubId);
    if (followerUids.length === 0) return;

    const updatedVersion =
      after.updatedAt instanceof Timestamp ? after.updatedAt.toMillis() : Date.now();

    await dispatchNotificationBatch({
      schoolId,
      jobType: 'club_announcement',
      jobDedupKey: buildDedupId(`club_ann_${clubId}_${updatedVersion}`),
      recipientUids: followerUids,
      type: 'club_activity',
      prefKey: 'clubEventUpdates',
      title: `Update from ${String(after.name || 'Club')}`,
      message: nextAnnouncement,
      entityType: 'club',
      entityId: clubId,
      actionUrl: `/?view=club&id=${clubId}`,
      visibility: String(after.visibility || 'public'),
    });
  }
);

export const onSchoolAnnouncementCreated = onDocumentCreated(
  {
    document: 'schools/{schoolId}/announcements/{announcementId}',
    database: FIRESTORE_DATABASE_ID,
  },
  async (event) => {
    const schoolId = event.params.schoolId;
    const announcementId = event.params.announcementId;
    const data = event.data?.data();
    if (!data) return;

    const memberUids = await getActiveSchoolMemberUids(schoolId);
    if (memberUids.length === 0) return;

    const isImportant = data.priority === 'important';
    await dispatchNotificationBatch({
      schoolId,
      jobType: 'school_announcement',
      jobDedupKey: buildDedupId(`school_ann_${announcementId}`),
      recipientUids: memberUids,
      type: 'announcement',
      prefKey: isImportant ? 'importantNotices' : 'schoolAnnouncements',
      title: String(data.title || 'Campus Announcement'),
      message: String(data.message || ''),
      entityType: 'school',
      entityId: schoolId,
      actionUrl: '/?view=notifications',
    });
  }
);

export const sendScheduledEventReminders = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'America/Los_Angeles',
  },
  async () => {
    await runScheduledRemindersJob(new Date());
  }
);

export const cleanupNotificationArtifacts = onSchedule(
  {
    schedule: 'every sunday 03:00',
    timeZone: 'America/Los_Angeles',
  },
  async () => {
    await runNotificationCleanupJob(new Date());
  }
);
