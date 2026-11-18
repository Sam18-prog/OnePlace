import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Club, UserFollowedClub } from '../types/club';
import type { EventCategory, SchoolEvent } from '../types/event';
import type {
  AppNotification,
  NotificationPreferences,
  PushPermissionState,
} from '../types/notification';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  saveNotificationPreferences,
  subscribeToNotificationPreferences,
  subscribeToNotifications,
  subscribeToSchoolAnnouncements,
} from '../services/notificationService';
import {
  disableUserDeviceTokens,
  enableBrowserPush,
  getBrowserPushPermissionState,
  hasVapidKeyConfigured,
  subscribeForegroundPushMessages,
  syncExistingPushToken,
} from '../services/pushService';
import {
  applyDisableAllPreferences,
  applyEnableAllPreferences,
  countUnreadNotifications,
  createDefaultNotificationPreferences,
  NOTIFICATION_PAGE_SIZE,
} from '../utils/notificationValidation';
import {
  deriveStarterTierNotifications,
  mergeInAppNotifications,
  type SchoolAnnouncementRecord,
} from '../utils/starterNotifications';

export interface StarterFeedContext {
  isSchoolMember: boolean;
  events: SchoolEvent[];
  clubs: Club[];
  followedById: Record<string, UserFollowedClub>;
  isEventGoing: (event: SchoolEvent) => boolean;
}

function loadReadLocalIds(uid: string): Set<string> {
  if (typeof window === 'undefined' || !uid) return new Set();
  try {
    const raw = window.localStorage.getItem(`oneplace_read_notif_ids_${uid}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

function saveReadLocalIds(uid: string, ids: ReadonlySet<string>): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const capped = Array.from(ids).slice(-200);
    window.localStorage.setItem(`oneplace_read_notif_ids_${uid}`, JSON.stringify(capped));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function useNotifications(params: {
  user: User | null;
  authLoading: boolean;
  schoolId: string;
  onShowToast: (type: 'error' | 'success', message: string) => void;
  starterFeedContext?: StarterFeedContext;
}) {
  const { user, authLoading, schoolId, onShowToast, starterFeedContext } = params;

  const [persistedNotifications, setPersistedNotifications] = useState<AppNotification[]>([]);
  const [schoolAnnouncements, setSchoolAnnouncements] = useState<SchoolAnnouncementRecord[]>([]);
  const [readLocalIds, setReadLocalIds] = useState<Set<string>>(() => new Set());
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(NOTIFICATION_PAGE_SIZE);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);

  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    createDefaultNotificationPreferences('', schoolId)
  );
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() =>
    getBrowserPushPermissionState()
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatusNote, setPushStatusNote] = useState<string | null>(null);
  const vapidConfigured = hasVapidKeyConfigured();

  // Load persisted per-user read IDs for live Firestore-derived Starter Tier alerts
  useEffect(() => {
    if (!user) {
      setReadLocalIds(new Set());
      return;
    }
    setReadLocalIds(loadReadLocalIds(user.uid));
  }, [user]);

  // Subscribe to persisted user notifications (strictly owner-scoped)
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPersistedNotifications([]);
      setNotificationsError(null);
      setNotificationsLoading(false);
      setHasMoreNotifications(false);
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError(null);
    let active = true;

    const unsub = subscribeToNotifications({
      uid: user.uid,
      pageLimit,
      onNotifications: (items, more) => {
        if (!active) return;
        setPersistedNotifications(items);
        setHasMoreNotifications(more);
        setNotificationsLoading(false);
      },
      onError: (err) => {
        if (!active) return;
        setNotificationsError(err.message || 'Could not load notifications.');
        setNotificationsLoading(false);
      },
    });

    return () => {
      active = false;
      unsub();
    };
  }, [authLoading, pageLimit, user]);

  // Subscribe to school announcements for active school members (Starter-tier supported Firestore read)
  useEffect(() => {
    if (authLoading || !user || !starterFeedContext?.isSchoolMember) {
      setSchoolAnnouncements([]);
      return;
    }
    return subscribeToSchoolAnnouncements({
      schoolId,
      enabled: true,
      onAnnouncements: setSchoolAnnouncements,
    });
  }, [authLoading, schoolId, starterFeedContext?.isSchoolMember, user]);

  // Subscribe to user notification preferences & interests
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPreferences(createDefaultNotificationPreferences('', schoolId));
      setPreferencesLoading(false);
      return;
    }

    setPreferencesLoading(true);
    let active = true;

    const unsub = subscribeToNotificationPreferences({
      uid: user.uid,
      schoolId,
      onPreferences: (next) => {
        if (!active) return;
        setPreferences(next);
        setPreferencesLoading(false);
      },
      onError: () => {
        if (!active) return;
        setPreferences(createDefaultNotificationPreferences(user.uid, schoolId));
        setPreferencesLoading(false);
      },
    });

    return () => {
      active = false;
      unsub();
    };
  }, [authLoading, schoolId, user]);

  // Sync existing granted push token silently ONLY when VAPID key is configured
  useEffect(() => {
    if (!user || authLoading || preferencesLoading || !vapidConfigured) return;
    const perm = getBrowserPushPermissionState();
    setPushPermission(perm);
    void syncExistingPushToken({
      uid: user.uid,
      schoolId,
      pushEnabledInPrefs: preferences.pushEnabled,
    });
  }, [authLoading, preferences.pushEnabled, preferencesLoading, schoolId, user, vapidConfigured]);

  // Foreground FCM listener (strictly optional; skipped when VAPID is missing)
  useEffect(() => {
    if (!user || !vapidConfigured || pushPermission !== 'granted') return;
    let cleanup: () => void = () => {};
    let active = true;

    void subscribeForegroundPushMessages(({ title, body }) => {
      if (!active) return;
      onShowToast('success', body ? `${title} — ${body}` : title);
    }).then((unsub) => {
      if (active) {
        cleanup = unsub;
      } else {
        unsub();
      }
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [onShowToast, pushPermission, user, vapidConfigured]);

  const starterDerivedNotifications = useMemo(() => {
    if (!user) return [];
    return deriveStarterTierNotifications({
      uid: user.uid,
      schoolId,
      preferences,
      announcements: schoolAnnouncements,
      clubs: starterFeedContext?.clubs ?? [],
      events: starterFeedContext?.events ?? [],
      followedById: starterFeedContext?.followedById ?? {},
      isEventGoing: starterFeedContext?.isEventGoing ?? (() => false),
    });
  }, [
    preferences,
    schoolAnnouncements,
    schoolId,
    starterFeedContext?.clubs,
    starterFeedContext?.events,
    starterFeedContext?.followedById,
    starterFeedContext?.isEventGoing,
    user,
  ]);

  const notifications = useMemo(
    () => mergeInAppNotifications(persistedNotifications, starterDerivedNotifications, readLocalIds),
    [persistedNotifications, readLocalIds, starterDerivedNotifications]
  );

  const unreadCount = useMemo(() => countUnreadNotifications(notifications), [notifications]);

  const loadMoreNotifications = useCallback(() => {
    setPageLimit((prev) => prev + NOTIFICATION_PAGE_SIZE);
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user) return;
      const target = notifications.find((n) => n.id === notificationId);
      if (!target || target.status === 'read') return;

      const isPersisted = persistedNotifications.some((n) => n.id === notificationId);
      if (!isPersisted) {
        setReadLocalIds((prev) => {
          const next = new Set(prev);
          next.add(notificationId);
          saveReadLocalIds(user.uid, next);
          return next;
        });
        return;
      }

      // Optimistic update while persisting to Firestore
      setPersistedNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, status: 'read', readAt: new Date() } : n
        )
      );
      try {
        await markNotificationAsRead(user.uid, notificationId);
      } catch {
        onShowToast('error', 'Could not update notification read state.');
      }
    },
    [notifications, onShowToast, persistedNotifications, user]
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unread = notifications.filter((n) => n.status === 'unread');
    if (unread.length === 0) return;

    const persistedIds = new Set(persistedNotifications.map((n) => n.id));
    const unreadPersisted = persistedNotifications.filter((n) => n.status === 'unread');
    const unreadDerivedIds = unread.filter((n) => !persistedIds.has(n.id)).map((n) => n.id);

    if (unreadDerivedIds.length > 0) {
      setReadLocalIds((prev) => {
        const next = new Set(prev);
        for (const id of unreadDerivedIds) next.add(id);
        saveReadLocalIds(user.uid, next);
        return next;
      });
    }

    if (unreadPersisted.length > 0) {
      const now = new Date();
      setPersistedNotifications((prev) =>
        prev.map((n) => (n.status === 'unread' ? { ...n, status: 'read', readAt: now } : n))
      );
      try {
        await markAllNotificationsAsRead(user.uid, persistedNotifications);
      } catch {
        onShowToast('error', 'Failed to mark all notifications as read.');
        return;
      }
    }

    onShowToast('success', 'All notifications marked as read.');
  }, [notifications, onShowToast, persistedNotifications, user]);

  const savePreferences = useCallback(
    async (nextPrefs: NotificationPreferences): Promise<boolean> => {
      if (!user) return false;
      setSavingPreferences(true);
      try {
        const sanitizedNext = vapidConfigured
          ? nextPrefs
          : { ...nextPrefs, pushEnabled: false };
        await saveNotificationPreferences(user.uid, schoolId, sanitizedNext);
        setPreferences(sanitizedNext);
        onShowToast('success', 'Notification preferences saved.');
        return true;
      } catch (err) {
        onShowToast(
          'error',
          err instanceof Error ? err.message : 'Could not save notification preferences.'
        );
        return false;
      } finally {
        setSavingPreferences(false);
      }
    },
    [onShowToast, schoolId, user, vapidConfigured]
  );

  const enableAllPreferences = useCallback(async (): Promise<void> => {
    if (!user) return;
    const perm = getBrowserPushPermissionState();
    setPushPermission(perm);
    const updated = applyEnableAllPreferences(preferences, perm, vapidConfigured);
    await savePreferences(updated);
  }, [preferences, savePreferences, user, vapidConfigured]);

  const disableAllPreferences = useCallback(async (): Promise<void> => {
    if (!user) return;
    const updated = applyDisableAllPreferences(preferences);
    if (vapidConfigured) {
      await disableUserDeviceTokens(user.uid);
    }
    await savePreferences(updated);
  }, [preferences, savePreferences, user, vapidConfigured]);

  const toggleInterestCategory = useCallback(
    async (category: EventCategory): Promise<void> => {
      if (!user) return;
      const exists = preferences.interestCategories.includes(category);
      const nextInterests = exists
        ? preferences.interestCategories.filter((c) => c !== category)
        : [...preferences.interestCategories, category];
      const nextPrefs: NotificationPreferences = {
        ...preferences,
        interestCategories: nextInterests,
      };
      setPreferences(nextPrefs);
      try {
        await saveNotificationPreferences(user.uid, schoolId, nextPrefs);
      } catch (err) {
        onShowToast(
          'error',
          err instanceof Error ? err.message : 'Could not update campus interests.'
        );
      }
    },
    [onShowToast, preferences, schoolId, user]
  );

  const enablePushNotifications = useCallback(async (): Promise<void> => {
    if (!user) return;
    if (!vapidConfigured) {
      setPushStatusNote(
        'Browser push notifications are not configured on this Starter Tier project. In-app notifications remain active.'
      );
      return;
    }

    setPushBusy(true);
    setPushStatusNote(null);
    try {
      const result = await enableBrowserPush({ uid: user.uid, schoolId });
      setPushPermission(result.permissionState);
      setPushStatusNote(result.message);

      if (result.status === 'enabled') {
        const nextPrefs: NotificationPreferences = {
          ...preferences,
          pushEnabled: true,
        };
        await saveNotificationPreferences(user.uid, schoolId, nextPrefs);
        setPreferences(nextPrefs);
        onShowToast('success', result.message);
      } else {
        onShowToast('error', result.message);
      }
    } finally {
      setPushBusy(false);
    }
  }, [onShowToast, preferences, schoolId, user, vapidConfigured]);

  const disablePushNotifications = useCallback(async (): Promise<void> => {
    if (!user) return;
    setPushBusy(true);
    try {
      await disableUserDeviceTokens(user.uid);
      const nextPrefs: NotificationPreferences = {
        ...preferences,
        pushEnabled: false,
      };
      await saveNotificationPreferences(user.uid, schoolId, nextPrefs);
      setPreferences(nextPrefs);
      setPushStatusNote('Browser push notifications disabled for this device.');
      onShowToast('success', 'Browser push notifications disabled.');
    } finally {
      setPushBusy(false);
    }
  }, [onShowToast, preferences, schoolId, user]);

  return {
    notifications,
    unreadCount,
    notificationsLoading,
    notificationsError,
    hasMoreNotifications,
    loadMoreNotifications,
    markAsRead,
    markAllRead,
    preferences,
    preferencesLoading,
    savingPreferences,
    savePreferences,
    enableAllPreferences,
    disableAllPreferences,
    toggleInterestCategory,
    pushPermission,
    pushBusy,
    pushStatusNote,
    vapidConfigured,
    enablePushNotifications,
    disablePushNotifications,
  };
}
