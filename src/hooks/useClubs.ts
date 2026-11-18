import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Club, ManagedClubAssignment, UserFollowedClub } from '../types/club';
import type { MembershipCapabilities } from '../types/membership';
import {
  DEFAULT_CLUB_PAGE_SIZE,
  fetchClubById,
  subscribeToAdminSchoolClubs,
  subscribeToDiscoverClubs,
  subscribeToUserManagedClubAssignments,
} from '../services/clubService';
import {
  subscribeToUserFollowedClubs,
  toggleClubFollow,
  updateClubFollowNotifications,
} from '../services/clubFollowService';
import { computeOptimisticFollow } from '../utils/clubValidation';

export function useClubs(params: {
  user: User | null;
  authLoading: boolean;
  schoolId: string;
  membershipLoading: boolean;
  capabilities: MembershipCapabilities;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}) {
  const { user, authLoading, schoolId, membershipLoading, capabilities, onShowToast } = params;

  const [clubs, setClubs] = useState<Club[]>([]);
  const [adminClubs, setAdminClubs] = useState<Club[]>([]);
  const [organizerClubs, setOrganizerClubs] = useState<Club[]>([]);
  const [managedAssignments, setManagedAssignments] = useState<ManagedClubAssignment[]>([]);
  const [followedById, setFollowedById] = useState<Record<string, UserFollowedClub>>({});
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(DEFAULT_CLUB_PAGE_SIZE);
  const [hasMoreClubs, setHasMoreClubs] = useState(false);

  const [optimisticFollows, setOptimisticFollows] = useState<
    Record<string, { isFollowing: boolean; followerCount: number }>
  >({});
  const followInFlightRef = useRef<Set<string>>(new Set());

  // Public / active school clubs listener
  useEffect(() => {
    if (authLoading || membershipLoading) return;

    setClubsError(null);
    let active = true;

    const unsubscribe = subscribeToDiscoverClubs({
      schoolId,
      isSchoolMember: capabilities.isActiveMember,
      pageLimit,
      onClubs: (nextClubs, more) => {
        if (!active) return;
        setClubs(nextClubs);
        setHasMoreClubs(more);
        setClubsLoading(false);
      },
      onError: (err) => {
        if (!active) return;
        setClubsError(err.message || 'Could not load campus clubs.');
        setClubsLoading(false);
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, membershipLoading, schoolId, capabilities.isActiveMember, pageLimit]);

  // Admin full clubs listener (includes suspended clubs)
  useEffect(() => {
    if (authLoading || membershipLoading || !user || !capabilities.canManageAllSchoolEvents) {
      setAdminClubs([]);
      return;
    }

    let active = true;
    const unsubscribe = subscribeToAdminSchoolClubs({
      schoolId,
      onClubs: (next) => {
        if (active) setAdminClubs(next);
      },
      onError: (err) => {
        if (active) console.warn('Admin clubs listener error:', err);
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, membershipLoading, user, schoolId, capabilities.canManageAllSchoolEvents]);

  // Signed-in user followed clubs listener
  useEffect(() => {
    if (!user || authLoading) {
      setFollowedById({});
      setOptimisticFollows({});
      return;
    }

    let active = true;
    const unsubscribe = subscribeToUserFollowedClubs({
      uid: user.uid,
      schoolId,
      onFollowed: (next) => {
        if (active) setFollowedById(next);
      },
      onError: (err) => {
        if (active) console.warn('Followed clubs listener error:', err);
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, user, schoolId]);

  // Signed-in user assigned club organizer listener
  useEffect(() => {
    if (!user || authLoading) {
      setManagedAssignments([]);
      setOrganizerClubs([]);
      return;
    }

    let active = true;
    const unsubscribe = subscribeToUserManagedClubAssignments({
      uid: user.uid,
      schoolId,
      onAssignments: (next) => {
        if (active) setManagedAssignments(next);
      },
      onError: (err) => {
        if (active) console.warn('Managed club assignments listener error:', err);
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, user, schoolId]);

  // Resolve full Club docs for assigned clubs (including suspended clubs an organizer owns)
  const assignmentIdsSignature = useMemo(
    () => managedAssignments.map((a) => a.clubId).sort().join(','),
    [managedAssignments]
  );

  useEffect(() => {
    if (!assignmentIdsSignature) {
      setOrganizerClubs([]);
      return;
    }
    let active = true;
    const ids = assignmentIdsSignature.split(',').filter(Boolean);

    Promise.all(ids.map((id) => fetchClubById(schoolId, id).catch(() => null))).then((resolved) => {
      if (!active) return;
      setOrganizerClubs(resolved.filter((c): c is Club => c !== null));
    });

    return () => {
      active = false;
    };
  }, [assignmentIdsSignature, schoolId]);

  const managedClubIds = useMemo(
    () => new Set(managedAssignments.map((a) => a.clubId)),
    [managedAssignments]
  );

  const followedClubIds = useMemo(() => new Set(Object.keys(followedById)), [followedById]);

  const getEffectiveFollow = useCallback(
    (club: Club) => {
      const override = optimisticFollows[club.id];
      const followerCount = override ? override.followerCount : club.followerCount;
      const isFollowing = override ? override.isFollowing : Boolean(followedById[club.id]);
      const notificationsEnabled = followedById[club.id]?.notificationsEnabled ?? true;
      return { followerCount, isFollowing, notificationsEnabled };
    },
    [followedById, optimisticFollows]
  );

  const handleToggleFollow = useCallback(
    (club: Club) => {
      if (!user || followInFlightRef.current.has(club.id)) return;
      const { isFollowing, followerCount } = getEffectiveFollow(club);

      if (!isFollowing && club.status !== 'active') {
        onShowToast('error', 'Suspended clubs cannot accept new followers.');
        return;
      }

      const { nextFollowing, nextCount } = computeOptimisticFollow(isFollowing, followerCount);

      setOptimisticFollows((prev) => ({
        ...prev,
        [club.id]: { isFollowing: nextFollowing, followerCount: nextCount },
      }));
      followInFlightRef.current.add(club.id);

      void toggleClubFollow(club, user.uid, isFollowing)
        .then(() => {
          setOptimisticFollows((prev) => {
            const next = { ...prev };
            delete next[club.id];
            return next;
          });
          onShowToast(
            'success',
            nextFollowing ? `Following ${club.name}.` : `Unfollowed ${club.name}.`
          );
        })
        .catch(() => {
          setOptimisticFollows((prev) => {
            const next = { ...prev };
            delete next[club.id];
            return next;
          });
          onShowToast('error', 'Could not update club follow status. Please try again.');
        })
        .finally(() => {
          followInFlightRef.current.delete(club.id);
        });
    },
    [getEffectiveFollow, onShowToast, user]
  );

  const handleToggleFollowNotifications = useCallback(
    async (club: Club, nextEnabled: boolean) => {
      if (!user) return;
      try {
        await updateClubFollowNotifications(club.schoolId, club.id, user.uid, nextEnabled);
        onShowToast(
          'success',
          nextEnabled
            ? `Club updates enabled for ${club.name}.`
            : `Club updates muted for ${club.name}.`
        );
      } catch (err) {
        onShowToast(
          'error',
          err instanceof Error ? err.message : 'Could not update notification preference.'
        );
      }
    },
    [onShowToast, user]
  );

  const loadMoreClubs = useCallback(() => {
    setPageLimit((prev) => prev + DEFAULT_CLUB_PAGE_SIZE);
  }, []);

  const allManagedClubs = useMemo(() => {
    if (capabilities.canManageAllSchoolEvents) return adminClubs;
    return organizerClubs;
  }, [adminClubs, capabilities.canManageAllSchoolEvents, organizerClubs]);

  return {
    clubs,
    adminClubs,
    allManagedClubs,
    managedAssignments,
    managedClubIds,
    followedById,
    followedClubIds,
    clubsLoading,
    clubsError,
    hasMoreClubs,
    loadMoreClubs,
    getEffectiveFollow,
    toggleFollow: handleToggleFollow,
    toggleFollowNotifications: handleToggleFollowNotifications,
  };
}
