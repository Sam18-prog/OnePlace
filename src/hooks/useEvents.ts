import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { SchoolEvent } from '../types/event';
import type { MembershipCapabilities } from '../types/membership';
import {
  canToggleEventRsvp,
  computeOptimisticRsvp,
  evaluateRsvpReconciliation,
  isUncertainRsvpWriteError,
} from '../utils/rsvp';
import { logClientDiagnostic, toUserFriendlyErrorMessage } from '../utils/errorHandling';
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

interface RsvpSyncBroadcastMessage {
  uid: string;
  eventId: string;
  isGoing: boolean;
}

const RSVP_SYNC_CHANNEL = 'oneplace-rsvp-sync';

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
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Cross-tab RSVP state synchronization (zero extra Firestore listeners)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined' || !user) {
      syncChannelRef.current = null;
      return;
    }

    const channel = new BroadcastChannel(RSVP_SYNC_CHANNEL);
    syncChannelRef.current = channel;
    channel.onmessage = (evt: MessageEvent<RsvpSyncBroadcastMessage>) => {
      const data = evt.data;
      if (!data || data.uid !== user.uid || typeof data.eventId !== 'string') return;
      setUserRsvps((prev) => ({ ...prev, [data.eventId]: Boolean(data.isGoing) }));
      setOptimisticState((prev) => {
        if (!(data.eventId in prev)) return prev;
        const next = { ...prev };
        delete next[data.eventId];
        return next;
      });
    };

    return () => {
      syncChannelRef.current = null;
      channel.close();
    };
  }, [user]);

  const broadcastRsvpUpdate = useCallback(
    (eventId: string, isGoing: boolean) => {
      if (!user || !syncChannelRef.current) return;
      try {
        syncChannelRef.current.postMessage({
          uid: user.uid,
          eventId,
          isGoing,
        } satisfies RsvpSyncBroadcastMessage);
      } catch {
        // Ignore closed channel errors
      }
    },
    [user]
  );

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
        logClientDiagnostic('Discover events listener error', err);
        setLoadError(toUserFriendlyErrorMessage(err, 'Could not load campus events right now.'));
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
          logClientDiagnostic('Managed events listener error', err);
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
        if (active) logClientDiagnostic('Initial user RSVP fetch deferred', err);
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
      const rsvpCount = Math.max(0, override ? override.rsvpCount : event.rsvpCount);
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
      const eligibility = canToggleEventRsvp(event, currentlyGoing);
      if (!eligibility.allowed) {
        setToast({
          type: 'error',
          message: eligibility.reason || 'This event is not accepting RSVPs.',
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

      const clearOptimistic = () => {
        setOptimisticState((prev) => {
          const next = { ...prev };
          delete next[event.id];
          return next;
        });
      };

      void (async () => {
        try {
          await toggleEventRsvp(event, user.uid, currentlyGoing);
          setUserRsvps((prev) => ({ ...prev, [event.id]: nextGoing }));
          clearOptimistic();
          broadcastRsvpUpdate(event.id, nextGoing);
        } catch (err) {
          logClientDiagnostic('RSVP write error, reconciling authoritative state', err);

          // On timeout/network uncertainty, check authoritative Firestore server state first
          // because Promise.race does NOT cancel an already-sent Firestore commit.
          let authoritativeState: { isGoing: boolean; rsvpCount?: number } | null = null;
          if (isUncertainRsvpWriteError(err)) {
            try {
              authoritativeState = await reconcileEventRsvp(event.id, user.uid);
            } catch {
              // Retry once briefly for slow mobile connections
              await new Promise((resolve) => window.setTimeout(resolve, 750));
              try {
                authoritativeState = await reconcileEventRsvp(event.id, user.uid);
              } catch {
                authoritativeState = null;
              }
            }
          } else {
            try {
              authoritativeState = await reconcileEventRsvp(event.id, user.uid);
            } catch {
              authoritativeState = null;
            }
          }

          const outcome = evaluateRsvpReconciliation({
            desiredGoing: nextGoing,
            serverState: authoritativeState,
            originalError: err,
          });

          if (typeof outcome.isGoing === 'boolean') {
            setUserRsvps((prev) => ({ ...prev, [event.id]: outcome.isGoing! }));
            broadcastRsvpUpdate(event.id, outcome.isGoing);
          }

          clearOptimistic();
          setToast({ type: outcome.toastType, message: outcome.message });
        } finally {
          inFlightRef.current.delete(event.id);
        }
      })();
    },
    [broadcastRsvpUpdate, getEffectiveRsvp, user]
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
