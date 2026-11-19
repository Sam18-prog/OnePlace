import type { Club, UserFollowedClub } from '../types/club';
import type { SchoolEvent } from '../types/event';
import type { EventAnnouncementRecord } from '../types/eventOperations';
import type { AppNotification, NotificationPreferences } from '../types/notification';
import { buildSafeDedupId, formatTimeInZone } from './notificationValidation';

export interface SchoolAnnouncementRecord {
  id: string;
  schoolId: string;
  title: string;
  message: string;
  priority: 'normal' | 'important';
  createdBy: string;
  createdAt: Date;
}

export interface StarterNotificationInputs {
  uid: string;
  schoolId: string;
  preferences: NotificationPreferences;
  announcements: SchoolAnnouncementRecord[];
  eventAnnouncementsByEventId?: Record<string, EventAnnouncementRecord[]>;
  clubs: Club[];
  events: SchoolEvent[];
  followedById: Record<string, UserFollowedClub>;
  isEventGoing: (event: SchoolEvent) => boolean;
  now?: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function deriveStarterTierNotifications(
  inputs: StarterNotificationInputs
): AppNotification[] {
  const {
    uid,
    schoolId,
    preferences,
    announcements,
    eventAnnouncementsByEventId = {},
    clubs,
    events,
    followedById,
    isEventGoing,
    now = new Date(),
  } = inputs;

  if (!uid || !preferences.inAppEnabled) {
    return [];
  }

  const items: AppNotification[] = [];

  // 0. Phase 8 Event-specific organizer announcements for events the student is registered for
  if (preferences.clubEventUpdates) {
    const eventById = new Map(events.map((e) => [e.id, e]));
    for (const [eventId, list] of Object.entries(eventAnnouncementsByEventId)) {
      const evt = eventById.get(eventId);
      if (!evt || !isEventGoing(evt)) continue;
      for (const ann of list) {
        if (ann.status !== 'active') continue;
        items.push({
          id: buildSafeDedupId(`starter_evt_ann_${eventId}_${ann.id}`),
          recipientUid: uid,
          schoolId,
          type: 'event_update',
          title: `${evt.title}: ${ann.title}`,
          message: ann.message,
          createdAt: ann.createdAt,
          entityType: 'event',
          entityId: eventId,
          actionUrl: `/?view=event&id=${eventId}`,
          status: 'unread',
          dedupKey: buildSafeDedupId(`evt_ann_${eventId}_${ann.id}_${uid}`),
        });
      }
    }
  }

  // 1. School-wide announcements stored in Firestore
  for (const ann of announcements) {
    const allowed =
      ann.priority === 'important'
        ? preferences.importantNotices
        : preferences.schoolAnnouncements;
    if (!allowed) continue;

    items.push({
      id: buildSafeDedupId(`starter_ann_${ann.id}`),
      recipientUid: uid,
      schoolId,
      type: 'announcement',
      title: ann.title,
      message: ann.message,
      createdAt: ann.createdAt,
      entityType: 'school',
      entityId: schoolId,
      actionUrl: '/?view=notifications',
      status: 'unread',
      dedupKey: buildSafeDedupId(`school_ann_${ann.id}_${uid}`),
    });
  }

  // 2. Pinned updates from followed clubs
  if (preferences.clubEventUpdates) {
    for (const club of clubs) {
      const follow = followedById[club.id];
      if (!follow || !follow.notificationsEnabled || club.status !== 'active') continue;
      const note = club.announcement?.trim();
      if (!note) continue;

      const updatedMs = club.updatedAt.getTime();
      items.push({
        id: buildSafeDedupId(`starter_club_ann_${club.id}_${updatedMs}`),
        recipientUid: uid,
        schoolId,
        type: 'club_activity',
        title: `Update from ${club.name}`,
        message: note,
        createdAt: club.updatedAt,
        entityType: 'club',
        entityId: club.id,
        actionUrl: `/?view=club&id=${club.id}`,
        status: 'unread',
        dedupKey: buildSafeDedupId(`club_ann_${club.id}_${updatedMs}_${uid}`),
      });
    }
  }

  // 3. Events from followed clubs, cancellations, and live RSVP reminder windows
  const nowMs = now.getTime();
  for (const evt of events) {
    const follow = followedById[evt.clubId];
    const isFollowedWithAlerts = Boolean(follow && follow.notificationsEnabled);
    const going = isEventGoing(evt);
    const startMs = evt.startAt.getTime();
    const diffMs = startMs - nowMs;

    if (evt.status === 'cancelled' && (going || isFollowedWithAlerts)) {
      if (preferences.clubEventUpdates) {
        const reasonSuffix = evt.cancellationReason?.trim()
          ? ` Reason: ${evt.cancellationReason.trim()}`
          : '';
        items.push({
          id: buildSafeDedupId(`starter_evt_cancel_${evt.id}`),
          recipientUid: uid,
          schoolId,
          type: 'event_update',
          title: `Cancelled: ${evt.title}`,
          message: `${evt.hostClub} cancelled this event.${reasonSuffix}`.trim(),
          createdAt: evt.cancelledAt ?? evt.updatedAt,
          entityType: 'event',
          entityId: evt.id,
          actionUrl: `/?view=event&id=${evt.id}`,
          status: 'unread',
          dedupKey: buildSafeDedupId(`evt_cancel_${evt.id}_${uid}`),
        });
      }
      continue;
    }

    if (evt.status !== 'published') continue;

    if (isFollowedWithAlerts && diffMs > 0 && preferences.clubNewEvents) {
      items.push({
        id: buildSafeDedupId(`starter_evt_pub_${evt.id}`),
        recipientUid: uid,
        schoolId,
        type: 'club_activity',
        title: `New from ${evt.hostClub}: ${evt.title}`,
        message: `${formatTimeInZone(evt.startAt, evt.timezone)} · ${evt.location}`,
        createdAt: evt.createdAt,
        entityType: 'event',
        entityId: evt.id,
        actionUrl: `/?view=event&id=${evt.id}`,
        status: 'unread',
        dedupKey: buildSafeDedupId(`evt_pub_${evt.id}_${uid}`),
      });
    }

    if (going && diffMs > 0) {
      if (diffMs <= HOUR_MS && preferences.reminder1h) {
        items.push({
          id: buildSafeDedupId(`starter_rem_1h_${evt.id}_${startMs}`),
          recipientUid: uid,
          schoolId,
          type: 'event_reminder',
          title: `Starting soon: ${evt.title}`,
          message: `Begins at ${formatTimeInZone(evt.startAt, evt.timezone)} · ${evt.location}`,
          createdAt: new Date(Math.min(nowMs, startMs - HOUR_MS + 60 * 1000)),
          entityType: 'event',
          entityId: evt.id,
          actionUrl: `/?view=event&id=${evt.id}`,
          status: 'unread',
          dedupKey: buildSafeDedupId(`rem_1h_${evt.id}_${startMs}_${uid}`),
        });
      } else if (diffMs <= DAY_MS && preferences.reminder24h) {
        items.push({
          id: buildSafeDedupId(`starter_rem_24h_${evt.id}_${startMs}`),
          recipientUid: uid,
          schoolId,
          type: 'event_reminder',
          title: `Upcoming RSVP: ${evt.title}`,
          message: `${formatTimeInZone(evt.startAt, evt.timezone)} · ${evt.location}`,
          createdAt: new Date(Math.min(nowMs, startMs - DAY_MS + 60 * 1000)),
          entityType: 'event',
          entityId: evt.id,
          actionUrl: `/?view=event&id=${evt.id}`,
          status: 'unread',
          dedupKey: buildSafeDedupId(`rem_24h_${evt.id}_${startMs}_${uid}`),
        });
      }
    }
  }

  return items;
}

export function mergeInAppNotifications(
  persisted: AppNotification[],
  derived: AppNotification[],
  readLocalIds: ReadonlySet<string>
): AppNotification[] {
  const seenDedupKeys = new Set<string>();
  const seenIds = new Set<string>();
  const merged: AppNotification[] = [];

  for (const item of persisted) {
    seenDedupKeys.add(item.dedupKey);
    seenIds.add(item.id);
    merged.push(item);
  }

  for (const item of derived) {
    if (seenIds.has(item.id) || seenDedupKeys.has(item.dedupKey)) continue;
    seenIds.add(item.id);
    seenDedupKeys.add(item.dedupKey);
    merged.push({
      ...item,
      status: readLocalIds.has(item.id) ? 'read' : 'unread',
      readAt: readLocalIds.has(item.id) ? item.readAt ?? new Date() : undefined,
    });
  }

  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return merged;
}
