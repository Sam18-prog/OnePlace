import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { SchoolEvent } from '../types/event';
import type { MembershipCapabilities } from '../types/membership';
import { computeOptimisticRsvp } from '../utils/rsvp';
import {
  DEFAULT_DISCOVERY_PAGE_SIZE,
  subscribeToDiscoverEvents,
  subscribeToManagedEvents,
} from '../services/eventService';
import {
  fetchUserRsvps,
  reconcileEventRsvp,
  toggleEventRsvp,
} from '../services/rsvpService';

export interface ToastNotice {
  type: 'error' | 'success';
  message: string;
}

export function useEvents(params: {
  user: User | null;
  authLoading: boolean;
  schoolId: string;
  membershipLoading: boolean;
  capabilities: MembershipCapabilities;
}) {
  const { user, authLoading, schoolId, membershipLoading, capabilities } = params;

  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [managedEvents, setManagedEvents] = useState<SchoolEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(DEFAULT_DISCOVERY_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);

  const [userRsvps, setUserRsvps] = useState<Record<string, boolean>>({});
  const [optimisticState, setOptimisticState] = useState<
    Record<string, { isGoing: boolean; rsvpCount: number }>
  >({});
  const [toast, setToast] = useState<ToastNotice | null>(null);

  const inFlightRef = useRef<Set<string>>(new Set());
  const refreshCounterRef = useRef(0);
  const [subscriptionGeneration, setSubscriptionGeneration] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Real-time Cloud Firestore discovery feed (public + school-restricted if active member)
  useEffect(() => {
    if (authLoading || membershipLoading) return;

    setLoadError(null);
    let active = true;

    const unsubscribe = subscribeToDiscoverEvents({
      schoolId,
      isSchoolMember: capabilities.isActiveMember,
      pageLimit,
      onEvents: (nextEvents, more) => {
        if (!active) return;
        setEvents(nextEvents);
        setHasMore(more);
        setIsLoading(false);
        setIsRefreshing(false);
      },
      onError: (err) => {
        if (!active) return;
        setLoadError(err.message || 'Could not load campus events.');
        setIsLoading(false);
        setIsRefreshing(false);
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    authLoading,
    membershipLoading,
    schoolId,
    capabilities.isActiveMember,
    pageLimit,
    subscriptionGeneration,
  ]);

  // Real-time Cloud Firestore managed events for authorized organizers / admins
  useEffect(() => {
    if (authLoading || membershipLoading || !user || !capabilities.canAccessOrganizer) {
      setManagedEvents([]);
      return;
    }

    let active = true;
    const unsubscribe = subscribeToManagedEvents({
      schoolId,
      uid: user.uid,
      isAdmin: capabilities.canManageAllSchoolEvents,
      onEvents: (nextManaged) => {
        if (active) setManagedEvents(nextManaged);
      },
      onError: (err) => {
        if (active) {
          console.warn('Managed events listener error:', err);
        }
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    authLoading,
    membershipLoading,
    user,
    schoolId,
    capabilities.canAccessOrganizer,
    capabilities.canManageAllSchoolEvents,
    subscriptionGeneration,
  ]);

  // Fetch user's RSVP flags cleanly for loaded discover events
  const eventIdsSignature = useMemo(() => events.map((e) => e.id).join(','), [events]);

  useEffect(() => {
    if (!user) {
      setUserRsvps({});
      setOptimisticState({});
      return;
    }
    if (authLoading || !eventIdsSignature) return;

    let active = true;
    const ids = eventIdsSignature.split(',').filter(Boolean);
    fetchUserRsvps(ids, user.uid)
      .then((rsvps) => {
        if (active) setUserRsvps(rsvps);
      })
      .catch((err) => {
        if (active) console.warn('Initial user RSVP fetch deferred:', err);
      });

    return () => {
      active = false;
    };
  }, [authLoading, user, eventIdsSignature]);

  const refreshEvents = useCallback(() => {
    setIsRefreshing(true);
    refreshCounterRef.current += 1;
    setSubscriptionGeneration((g) => g + 1);
    window.setTimeout(() => setIsRefreshing(false), 600);
  }, []);

  const loadMoreEvents = useCallback(() => {
    setPageLimit((prev) => prev + DEFAULT_DISCOVERY_PAGE_SIZE);
  }, []);

  const getEffectiveRsvp = useCallback(
    (event: SchoolEvent) => {
      const override = optimisticState[event.id];
      const rsvpCount = override ? override.rsvpCount : event.rsvpCount;
      const isGoing = override ? override.isGoing : Boolean(userRsvps[event.id]);
      return { rsvpCount, isGoing };
    },
    [optimisticState, userRsvps]
  );

  const toggleRsvp = useCallback(
    (event: SchoolEvent) => {
      if (!user || inFlightRef.current.has(event.id)) {
        return;
      }

      const { isGoing: currentlyGoing, rsvpCount: currentCount } = getEffectiveRsvp(event);

      if (!currentlyGoing && event.status !== 'published') {
        setToast({
          type: 'error',
          message:
            event.status === 'cancelled'
              ? 'This event has been cancelled and is no longer accepting RSVPs.'
              : 'Draft events cannot accept RSVPs.',
        });
        return;
      }

      const { nextGoing, nextCount } = computeOptimisticRsvp(currentlyGoing, currentCount);

      setToast(null);
      setOptimisticState((prev) => ({
        ...prev,
        [event.id]: { isGoing: nextGoing, rsvpCount: nextCount },
      }));
      inFlightRef.current.add(event.id);

      void toggleEventRsvp(event, user.uid, currentlyGoing)
        .then(() => {
          setUserRsvps((prev) => ({ ...prev, [event.id]: nextGoing }));
          setOptimisticState((prev) => {
            const next = { ...prev };
            delete next[event.id];
            return next;
          });
        })
        .catch(() => {
          setOptimisticState((prev) => {
            const next = { ...prev };
            delete next[event.id];
            return next;
          });
          setToast({ type: 'error', message: 'Connection failed. RSVP could not be saved.' });

          void reconcileEventRsvp(event.id, user.uid)
            .then((reconciled) => {
              setUserRsvps((prev) => ({ ...prev, [event.id]: reconciled.isGoing }));
            })
            .catch(() => {
              // Silent background reconciliation
            });
        })
        .finally(() => {
          inFlightRef.current.delete(event.id);
        });
    },
    [getEffectiveRsvp, user]
  );

  const showToast = useCallback((type: 'error' | 'success', message: string) => {
    setToast({ type, message });
  }, []);

  return {
    events,
    managedEvents,
    isLoading,
    isRefreshing,
    loadError,
    hasMore,
    toast,
    setToast,
    showToast,
    refreshEvents,
    loadMoreEvents,
    getEffectiveRsvp,
    toggleRsvp,
  };
}
