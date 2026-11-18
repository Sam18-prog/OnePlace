import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarOff, CheckCircle2, Lock, Users, X } from 'lucide-react';
import { fetchClubById } from './services/clubService';
import type { Club } from './types/club';
import type { AppView, EventCategory, SchoolEvent } from './types/event';
import type { AppNotification } from './types/notification';
import { canManageClub, countUpcomingClubEvents } from './utils/clubValidation';
import { filterEvents, groupEventsByTimeframe } from './utils/events';
import {
  getFollowedClubUpcomingEvents,
  getPersonalizedRecommendations,
  getRecentlyAddedEvents,
  mapClubCategoryToEventCategory,
} from './utils/personalization';
import { useAuth } from './hooks/useAuth';
import { useClubs } from './hooks/useClubs';
import { useEvents } from './hooks/useEvents';
import { useMembership } from './hooks/useMembership';
import { useNotifications } from './hooks/useNotifications';
import { ClubDiscoveryPage } from './components/clubs/ClubDiscoveryPage';
import { ClubProfilePage } from './components/clubs/ClubProfilePage';
import {
  DiscoveryToolbar,
  type CategoryFilter,
  type TimeFilter,
} from './components/DiscoveryToolbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EventCard } from './components/EventCard';
import { EventDetailView } from './components/EventDetailView';
import { EventSkeleton } from './components/EventSkeleton';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MyEventsView } from './components/MyEventsView';
import { NotificationCenterView } from './components/notifications/NotificationCenterView';
import { NotificationPreferencesView } from './components/notifications/NotificationPreferencesView';
import {
  OrganizerDashboard,
  type OrganizerStudioTab,
} from './components/organizer/OrganizerDashboard';
import { PersonalizedDiscoverSections } from './components/personalization/PersonalizedDiscoverSections';
import { ProfileView } from './components/ProfileView';
import { SignInPromptModal } from './components/SignInPromptModal';

function OnePlaceFeed() {
  const { user, authLoading, isSigningIn, authError, setAuthError, signIn, logOut } = useAuth();
  const {
    schoolId,
    schoolConfig,
    membership,
    membershipLoading,
    capabilities,
    refreshMembership,
  } = useMembership(user, authLoading);

  const {
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
  } = useEvents({
    user,
    authLoading,
    schoolId,
    membershipLoading,
    capabilities,
  });

  const {
    clubs,
    allManagedClubs,
    managedClubIds,
    followedById,
    followedClubIds,
    clubsLoading,
    clubsError,
    hasMoreClubs,
    loadMoreClubs,
    getEffectiveFollow,
    toggleFollow,
    toggleFollowNotifications,
  } = useClubs({
    user,
    authLoading,
    schoolId,
    membershipLoading,
    capabilities,
    onShowToast: showToast,
  });

  const isEventGoingForFeed = useCallback(
    (event: SchoolEvent) => getEffectiveRsvp(event).isGoing,
    [getEffectiveRsvp]
  );

  const starterFeedContext = useMemo(
    () => ({
      isSchoolMember: capabilities.isActiveMember,
      events,
      clubs,
      followedById,
      isEventGoing: isEventGoingForFeed,
    }),
    [capabilities.isActiveMember, clubs, events, followedById, isEventGoingForFeed]
  );

  const {
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
  } = useNotifications({
    user,
    authLoading,
    schoolId,
    onShowToast: showToast,
    starterFeedContext,
  });

  const [activeView, setActiveView] = useState<AppView>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [clubFilterId, setClubFilterId] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [fetchedFallbackClub, setFetchedFallbackClub] = useState<Club | null>(null);
  const [isLoadingSelectedClub, setIsLoadingSelectedClub] = useState(false);

  const [organizerInitialTab, setOrganizerInitialTab] = useState<OrganizerStudioTab>('events');
  const [promptEvent, setPromptEvent] = useState<SchoolEvent | null>(null);
  const [promptClub, setPromptClub] = useState<Club | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const feedSectionRef = useRef<HTMLDivElement | null>(null);

  // Support deep links from background push notifications (?view=event&id=... | club | notifications)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const idParam = params.get('id');
    if (viewParam === 'event' && idParam) {
      setSelectedEventId(idParam);
    } else if (viewParam === 'club' && idParam) {
      setSelectedClubId(idParam);
      setActiveView('club-profile');
    } else if (viewParam === 'notifications') {
      setActiveView('notifications');
    } else if (viewParam === 'notification-preferences') {
      setActiveView('notification-preferences');
    }
  }, []);

  const handleConfirmSignIn = async () => {
    const ok = await signIn();
    if (ok) {
      setIsSignInModalOpen(false);
      setPromptEvent(null);
      setPromptClub(null);
    }
  };

  const handleOpenSignIn = () => {
    setAuthError(null);
    setPromptEvent(null);
    setPromptClub(null);
    setIsSignInModalOpen(true);
  };

  const handleRsvpClick = (event: SchoolEvent) => {
    if (!user) {
      setAuthError(null);
      setPromptClub(null);
      setPromptEvent(event);
      setIsSignInModalOpen(true);
      return;
    }
    toggleRsvp(event);
  };

  const handleFollowClubClick = (club: Club) => {
    if (!user) {
      setAuthError(null);
      setPromptEvent(null);
      setPromptClub(club);
      setIsSignInModalOpen(true);
      return;
    }
    toggleFollow(club);
  };

  const handleSelectClub = useCallback((club: Club) => {
    setSelectedClubId(club.id);
    setFetchedFallbackClub(club);
    setActiveView('club-profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectClubById = useCallback(
    async (clubId: string) => {
      if (!clubId) return;
      const inMemory =
        clubs.find((c) => c.id === clubId) ??
        allManagedClubs.find((c) => c.id === clubId) ??
        null;

      setSelectedClubId(clubId);
      setActiveView('club-profile');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (inMemory) {
        setFetchedFallbackClub(inMemory);
        return;
      }

      setFetchedFallbackClub(null);
      setIsLoadingSelectedClub(true);
      try {
        const fetched = await fetchClubById(schoolId, clubId);
        setFetchedFallbackClub(fetched);
      } catch {
        setFetchedFallbackClub(null);
      } finally {
        setIsLoadingSelectedClub(false);
      }
    },
    [allManagedClubs, clubs, schoolId]
  );

  const handleExploreAllClubEvents = useCallback((club: Club) => {
    setSearchQuery('');
    setTimeFilter('all');
    setCategoryFilter('all');
    setClubFilterId(club.id);
    setActiveView('explore');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleManageClub = useCallback(
    (club: Club) => {
      if (!capabilities.canAccessOrganizer) return;
      setSelectedClubId(club.id);
      setOrganizerInitialTab('clubs');
      setActiveView('organizer');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [capabilities.canAccessOrganizer]
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setTimeFilter('all');
    setCategoryFilter('all');
    setClubFilterId(null);
  };

  const handleSelectCategoryShortcut = (category: CategoryFilter) => {
    if (category === 'all') {
      setCategoryFilter('all');
      return;
    }
    setCategoryFilter((prev) => (prev === category ? 'all' : category));
  };

  const activeClubFilterId = activeView === 'explore' ? clubFilterId : null;
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    timeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    Boolean(activeClubFilterId);

  const filteredEvents = useMemo(
    () =>
      filterEvents(
        events,
        searchQuery,
        timeFilter,
        new Date(),
        categoryFilter,
        activeClubFilterId ?? 'all'
      ),
    [events, searchQuery, timeFilter, categoryFilter, activeClubFilterId]
  );

  const featuredEvent = useMemo(() => {
    if (activeView !== 'discover' || hasActiveFilters || filteredEvents.length === 0) {
      return null;
    }
    return filteredEvents.find((e) => e.status === 'published') ?? filteredEvents[0];
  }, [activeView, filteredEvents, hasActiveFilters]);

  const chronologicalEvents = useMemo(() => {
    if (!featuredEvent) return filteredEvents;
    return filteredEvents.filter((event) => event.id !== featuredEvent.id);
  }, [featuredEvent, filteredEvents]);

  const groupedEvents = useMemo(
    () => groupEventsByTimeframe(chronologicalEvents),
    [chronologicalEvents]
  );

  const selectedEvent = useMemo(
    () =>
      events.find((e) => e.id === selectedEventId) ??
      managedEvents.find((e) => e.id === selectedEventId) ??
      null,
    [events, managedEvents, selectedEventId]
  );

  const selectedClub = useMemo(() => {
    if (!selectedClubId) return null;
    return (
      clubs.find((c) => c.id === selectedClubId) ??
      allManagedClubs.find((c) => c.id === selectedClubId) ??
      (fetchedFallbackClub?.id === selectedClubId ? fetchedFallbackClub : null)
    );
  }, [allManagedClubs, clubs, fetchedFallbackClub, selectedClubId]);

  const clubFilterLabel = useMemo(() => {
    if (!activeClubFilterId) return null;
    const fromClub =
      clubs.find((c) => c.id === activeClubFilterId) ??
      allManagedClubs.find((c) => c.id === activeClubFilterId) ??
      (fetchedFallbackClub?.id === activeClubFilterId ? fetchedFallbackClub : null);
    if (fromClub) return fromClub.name;
    const fromEvent = events.find((e) => e.clubId === activeClubFilterId);
    return fromEvent?.hostClub ?? activeClubFilterId;
  }, [activeClubFilterId, allManagedClubs, clubs, events, fetchedFallbackClub]);

  const upcomingCountsByClub = useMemo(() => countUpcomingClubEvents(events), [events]);

  const activeRsvpCount = useMemo(() => {
    if (!user) return 0;
    return events.reduce((acc, event) => (getEffectiveRsvp(event).isGoing ? acc + 1 : acc), 0);
  }, [events, getEffectiveRsvp, user]);

  const rsvpedEventIds = useMemo(() => {
    const set = new Set<string>();
    if (!user) return set;
    for (const evt of events) {
      if (getEffectiveRsvp(evt).isGoing) set.add(evt.id);
    }
    return set;
  }, [events, getEffectiveRsvp, user]);

  const followedClubCategories = useMemo(() => {
    const set = new Set<EventCategory>();
    for (const club of clubs) {
      if (followedClubIds.has(club.id)) {
        set.add(mapClubCategoryToEventCategory(club.category));
      }
    }
    return set;
  }, [clubs, followedClubIds]);

  const recommendations = useMemo(
    () =>
      getPersonalizedRecommendations(
        events,
        {
          now: new Date(),
          isSchoolMember: capabilities.isActiveMember,
          followedClubIds,
          followedClubCategories,
          interestCategories: preferences.interestCategories,
          rsvpedEventIds,
        },
        4
      ),
    [
      capabilities.isActiveMember,
      events,
      followedClubCategories,
      followedClubIds,
      preferences.interestCategories,
      rsvpedEventIds,
    ]
  );

  const followedClubEvents = useMemo(
    () =>
      getFollowedClubUpcomingEvents(
        events,
        followedClubIds,
        new Date(),
        capabilities.isActiveMember,
        6
      ),
    [capabilities.isActiveMember, events, followedClubIds]
  );

  const recentlyAddedEvents = useMemo(
    () => getRecentlyAddedEvents(events, new Date(), capabilities.isActiveMember, 4),
    [capabilities.isActiveMember, events]
  );

  const handleSelectNotification = useCallback(
    (notification: AppNotification) => {
      if (notification.status === 'unread') {
        void markAsRead(notification.id);
      }
      if (notification.entityType === 'event' && notification.entityId) {
        setSelectedEventId(notification.entityId);
        return;
      }
      if (notification.entityType === 'club' && notification.entityId) {
        void handleSelectClubById(notification.entityId);
        return;
      }
      setActiveView('notifications');
    },
    [handleSelectClubById, markAsRead]
  );

  const handleNavigate = (view: AppView) => {
    if (view === 'organizer' && !capabilities.canAccessOrganizer) {
      showToast('error', 'Organizer access requires an active Organizer or Admin role.');
      return;
    }
    if (view === 'explore') {
      setClubFilterId(null);
    }
    if (view === 'organizer') {
      setOrganizerInitialTab('events');
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFocusSearch = () => {
    if (
      activeView === 'my-rsvps' ||
      activeView === 'profile' ||
      activeView === 'organizer' ||
      activeView === 'clubs' ||
      activeView === 'club-profile' ||
      activeView === 'notifications' ||
      activeView === 'notification-preferences'
    ) {
      setClubFilterId(null);
      setActiveView('explore');
      window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      return;
    }

    if (activeView === 'discover') {
      const heroInput = document.getElementById('hero-event-search') as HTMLInputElement | null;
      if (heroInput) {
        heroInput.focus();
        heroInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handleExploreCta = () => {
    setClubFilterId(null);
    setActiveView('explore');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showSkeleton = isLoading || isRefreshing;
  let cardCounter = featuredEvent ? 1 : 0;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#171717]">
      <Header
        activeView={activeView}
        onNavigate={handleNavigate}
        onFocusSearch={handleFocusSearch}
        user={user}
        authLoading={authLoading}
        isRefreshing={isRefreshing}
        rsvpTotalCount={activeRsvpCount}
        notifications={notifications}
        unreadNotificationCount={unreadCount}
        onSelectNotification={handleSelectNotification}
        onMarkAllNotificationsRead={() => void markAllRead()}
        canAccessOrganizer={capabilities.canAccessOrganizer}
        onRefresh={refreshEvents}
        onSignIn={handleOpenSignIn}
        onSignOut={logOut}
      />

      <main className="flex-1 w-full mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:pt-8 md:pb-10">
        <AnimatePresence mode="wait">
          {activeView === 'organizer' ? (
            <motion.div
              key="view-organizer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {user && membership && capabilities.canAccessOrganizer ? (
                <OrganizerDashboard
                  user={user}
                  membership={membership}
                  capabilities={capabilities}
                  schoolConfig={schoolConfig}
                  managedEvents={managedEvents}
                  allManagedClubs={allManagedClubs}
                  allDiscoverClubs={clubs}
                  managedClubIds={managedClubIds}
                  initialTab={organizerInitialTab}
                  onSelectEvent={(evt) => setSelectedEventId(evt.id)}
                  onViewClubProfile={handleSelectClub}
                  onViewPublishedFeed={() => handleNavigate('discover')}
                  onSchoolConfigUpdated={refreshMembership}
                  onShowToast={showToast}
                />
              ) : (
                <section className="mx-auto max-w-lg py-8">
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
                      <Lock className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h1 className="font-display text-xl font-extrabold text-[#171717]">
                      Organizer Access Restricted
                    </h1>
                    <p className="mt-2 text-sm text-[#737373]">
                      Only verified club organizers and school administrators can access the Organizer Studio.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavigate('discover')}
                      className="mt-6 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#E85D04] px-5 py-2 text-sm font-semibold text-white hover:bg-[#DC2F02] cursor-pointer"
                    >
                      Back to Campus Feed
                    </button>
                  </div>
                </section>
              )}
            </motion.div>
          ) : activeView === 'clubs' ? (
            <motion.div
              key="view-clubs"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <ClubDiscoveryPage
                user={user}
                schoolName={schoolConfig.name}
                clubs={clubs}
                events={events}
                followedClubIds={followedClubIds}
                followedById={followedById}
                clubsLoading={clubsLoading}
                clubsError={clubsError}
                hasMoreClubs={hasMoreClubs}
                canAccessOrganizer={capabilities.canAccessOrganizer}
                getEffectiveFollow={getEffectiveFollow}
                getEffectiveRsvp={getEffectiveRsvp}
                onLoadMoreClubs={loadMoreClubs}
                onFollowClick={handleFollowClubClick}
                onSelectClub={handleSelectClub}
                onRsvpClick={handleRsvpClick}
                onSelectEvent={(evt) => setSelectedEventId(evt.id)}
                onSignIn={handleOpenSignIn}
                onOpenOrganizer={() => {
                  setOrganizerInitialTab('clubs');
                  setActiveView('organizer');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </motion.div>
          ) : activeView === 'club-profile' ? (
            <motion.div
              key={`view-club-${selectedClubId || 'unknown'}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {isLoadingSelectedClub && !selectedClub ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-xs">
                  <p className="text-sm text-[#737373]">Loading club profile...</p>
                </div>
              ) : selectedClub ? (
                (() => {
                  const eff = getEffectiveFollow(selectedClub);
                  const clubEvents =
                    canManageClub(selectedClub, membership, managedClubIds) &&
                    managedEvents.length > 0
                      ? managedEvents.filter((e) => e.clubId === selectedClub.id)
                      : events.filter((e) => e.clubId === selectedClub.id);
                  return (
                    <ClubProfilePage
                      club={selectedClub}
                      schoolName={schoolConfig.name}
                      events={clubEvents}
                      followerCount={eff.followerCount}
                      isFollowing={eff.isFollowing}
                      notificationsEnabled={eff.notificationsEnabled}
                      isSignedIn={Boolean(user)}
                      canManage={canManageClub(selectedClub, membership, managedClubIds)}
                      getEffectiveRsvp={getEffectiveRsvp}
                      onBack={() => handleNavigate('clubs')}
                      onFollowClick={handleFollowClubClick}
                      onToggleNotifications={toggleFollowNotifications}
                      onRsvpClick={handleRsvpClick}
                      onSelectEvent={(evt) => setSelectedEventId(evt.id)}
                      onExploreAllClubEvents={handleExploreAllClubEvents}
                      onManageClub={handleManageClub}
                    />
                  );
                })()
              ) : (
                <section className="mx-auto max-w-lg py-8">
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
                      <Users className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h1 className="font-display text-xl font-extrabold text-[#171717]">
                      Club Profile Unavailable
                    </h1>
                    <p className="mt-2 text-sm text-[#737373]">
                      This club profile has not been registered yet or is restricted to school members.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavigate('clubs')}
                      className="mt-6 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-5 py-2 text-sm font-semibold text-white hover:bg-[#DC2F02] cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      <span>Browse Campus Clubs</span>
                    </button>
                  </div>
                </section>
              )}
            </motion.div>
          ) : activeView === 'my-rsvps' ? (
            <motion.div
              key="view-my-rsvps"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <MyEventsView
                user={user}
                events={events}
                getEffectiveRsvp={getEffectiveRsvp}
                onRsvpClick={handleRsvpClick}
                onSelectEvent={(evt) => setSelectedEventId(evt.id)}
                onSelectClubById={(cid) => void handleSelectClubById(cid)}
                onSignIn={handleOpenSignIn}
                onExplore={handleExploreCta}
              />
            </motion.div>
          ) : activeView === 'notifications' ? (
            <motion.div
              key="view-notifications"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <NotificationCenterView
                isSignedIn={Boolean(user)}
                notifications={notifications}
                unreadCount={unreadCount}
                loading={notificationsLoading}
                error={notificationsError}
                hasMore={hasMoreNotifications}
                onLoadMore={loadMoreNotifications}
                onSelectNotification={handleSelectNotification}
                onMarkAsRead={(id) => void markAsRead(id)}
                onMarkAllRead={() => void markAllRead()}
                onOpenPreferences={() => handleNavigate('notification-preferences')}
                onSignIn={handleOpenSignIn}
              />
            </motion.div>
          ) : activeView === 'notification-preferences' ? (
            <motion.div
              key="view-notification-preferences"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <NotificationPreferencesView
                isSignedIn={Boolean(user)}
                preferences={preferences}
                loading={preferencesLoading}
                saving={savingPreferences}
                pushPermission={pushPermission}
                pushBusy={pushBusy}
                pushStatusNote={pushStatusNote}
                vapidConfigured={vapidConfigured}
                onBack={() => handleNavigate('notifications')}
                onSave={savePreferences}
                onEnableAll={enableAllPreferences}
                onDisableAll={disableAllPreferences}
                onEnablePush={enablePushNotifications}
                onDisablePush={disablePushNotifications}
                onSignIn={handleOpenSignIn}
              />
            </motion.div>
          ) : activeView === 'profile' ? (
            <motion.div
              key="view-profile"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProfileView
                user={user}
                events={events}
                rsvpCount={activeRsvpCount}
                followedClubsCount={followedClubIds.size}
                unreadNotificationCount={unreadCount}
                selectedInterests={preferences.interestCategories}
                onToggleInterest={(cat) => void toggleInterestCategory(cat)}
                membership={membership}
                capabilities={capabilities}
                getEffectiveRsvp={getEffectiveRsvp}
                onSignIn={handleOpenSignIn}
                onSignOut={logOut}
                onOpenMyEvents={() => handleNavigate('my-rsvps')}
                onOpenClubs={() => handleNavigate('clubs')}
                onOpenNotifications={() => handleNavigate('notifications')}
                onOpenNotificationPreferences={() => handleNavigate('notification-preferences')}
                onOpenOrganizer={() => {
                  setOrganizerInitialTab('events');
                  handleNavigate('organizer');
                }}
                onSelectEvent={(evt) => setSelectedEventId(evt.id)}
                onExplore={handleExploreCta}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`view-${activeView}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-7 sm:space-y-8"
            >
              {/* Editorial Hero (Discover) or Page Header (Explore) */}
              {activeView === 'discover' ? (
                <HeroSection
                  events={events}
                  displayName={user?.displayName}
                  isSignedIn={Boolean(user)}
                  selectedInterests={preferences.interestCategories}
                  onToggleInterest={(cat) => void toggleInterestCategory(cat)}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  categoryFilter={categoryFilter}
                  onSelectCategoryShortcut={handleSelectCategoryShortcut}
                  onExploreCta={handleExploreCta}
                />
              ) : (
                <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E5E7EB] pb-5">
                  <div>
                    <p className="font-mono text-xs font-medium text-[#E85D04]">Explore</p>
                    <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
                      All campus events
                    </h1>
                    <p className="mt-1 text-sm text-[#737373]">
                      Filter by timeframe, club category, or room to find what fits your week.
                    </p>
                  </div>
                  <p className="font-mono tabular-nums text-xs font-medium text-[#737373]">
                    Showing {filteredEvents.length} of {events.length} events
                  </p>
                </section>
              )}

              {/* Club-specific Explore banner */}
              {activeView === 'explore' && activeClubFilterId && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E85D04]/25 bg-white px-4 py-3 shadow-xs">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Users className="h-4 w-4 text-[#E85D04] shrink-0" aria-hidden="true" />
                    <span className="text-[#737373]">Filtered by club:</span>
                    <span className="font-semibold text-[#171717]">{clubFilterLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSelectClubById(activeClubFilterId)}
                      className="rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#E5E7EB]/60 transition-colors cursor-pointer"
                    >
                      View Club Page
                    </button>
                    <button
                      type="button"
                      onClick={() => setClubFilterId(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Show all events</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Discovery Filter Bar (Search hidden on Discover since Hero provides search) */}
              <DiscoveryToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                timeFilter={timeFilter}
                onTimeFilterChange={setTimeFilter}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
                onClearAll={handleClearFilters}
                showSearchInput={activeView === 'explore'}
                showCategoryPills={activeView === 'explore'}
                searchInputRef={searchInputRef}
              />

              {/* Quick Club Highlights Row (Discover unfiltered) */}
              {activeView === 'discover' && !hasActiveFilters && clubs.length > 0 && (
                <section aria-label="Active campus clubs spotlight" className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <h2 className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap">
                        Active Campus Clubs
                      </h2>
                      <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('clubs')}
                      className="text-xs font-semibold text-[#E85D04] hover:text-[#DC2F02] whitespace-nowrap cursor-pointer"
                    >
                      Explore all clubs
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {clubs.slice(0, 4).map((club) => {
                      const eff = getEffectiveFollow(club);
                      const upcoming = upcomingCountsByClub[club.id] || 0;
                      return (
                        <button
                          key={club.id}
                          type="button"
                          onClick={() => handleSelectClub(club)}
                          className="group rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-left shadow-xs hover:border-[#D1D5DB] hover:shadow-sm transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] font-medium text-[#E85D04]">
                              {club.category}
                            </span>
                            <span className="font-mono tabular-nums text-[11px] text-[#737373] shrink-0">
                              {eff.followerCount} followers
                            </span>
                          </div>
                          <p className="mt-1 font-display text-sm font-bold text-[#171717] group-hover:text-[#E85D04] transition-colors truncate">
                            {club.name}
                          </p>
                          <p className="mt-0.5 text-xs text-[#737373] truncate">
                            {upcoming} upcoming {upcoming === 1 ? 'event' : 'events'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Dedicated Featured Upcoming Event Spotlight (Discover unfiltered) */}
              {!loadError && !showSkeleton && featuredEvent && (
                <section aria-labelledby="section-featured">
                  <div className="mb-4 flex items-center gap-3">
                    <h2
                      id="section-featured"
                      className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
                    >
                      Featured Upcoming
                    </h2>
                    <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
                    <span className="font-mono text-xs text-[#E85D04] whitespace-nowrap">
                      Spotlight
                    </span>
                  </div>

                  <EventCard
                    event={featuredEvent}
                    index={0}
                    variant="featured"
                    rsvpCount={getEffectiveRsvp(featuredEvent).rsvpCount}
                    isGoing={getEffectiveRsvp(featuredEvent).isGoing}
                    isSignedIn={Boolean(user)}
                    onRsvpClick={handleRsvpClick}
                    onSelectEvent={(evt) => setSelectedEventId(evt.id)}
                    onSelectClubById={(cid) => void handleSelectClubById(cid)}
                  />
                </section>
              )}

              {/* Personalized Discover Sections: Recommended for You, From Clubs You Follow, Recently Added */}
              {activeView === 'discover' && !hasActiveFilters && !loadError && !showSkeleton && (
                <PersonalizedDiscoverSections
                  isSignedIn={Boolean(user)}
                  recommendations={recommendations}
                  followedClubEvents={followedClubEvents}
                  recentlyAddedEvents={recentlyAddedEvents}
                  followedClubsCount={followedClubIds.size}
                  getEffectiveRsvp={getEffectiveRsvp}
                  onRsvpClick={handleRsvpClick}
                  onSelectEvent={(evt) => setSelectedEventId(evt.id)}
                  onSelectClubById={(cid) => void handleSelectClubById(cid)}
                  onExploreClubs={() => handleNavigate('clubs')}
                  onExploreEvents={handleExploreCta}
                  onOpenInterests={() => handleNavigate('notification-preferences')}
                />
              )}

              {/* Chronological Feed */}
              <div ref={feedSectionRef} className="space-y-6">
                {loadError ? (
                  <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
                    <p className="font-display text-base font-bold text-[#171717]">
                      Couldn't load the event feed
                    </p>
                    <p className="mt-1 text-sm text-[#737373]">{loadError}</p>
                    <button
                      type="button"
                      onClick={refreshEvents}
                      className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#E85D04] px-5 py-2 text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : showSkeleton ? (
                  <EventSkeleton />
                ) : filteredEvents.length === 0 ? (
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-xs">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
                      <CalendarOff className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="font-display text-base font-semibold text-[#171717]">
                      {hasActiveFilters
                        ? 'No matching events found'
                        : 'No published campus events yet'}
                    </p>
                    <p className="mt-1 text-sm text-[#737373]">
                      {hasActiveFilters
                        ? 'Try clearing your search term or switching timeframe, club, and category filters.'
                        : capabilities.canAccessOrganizer
                          ? 'Open Organizer Studio to publish your first club event or run the admin migration.'
                          : 'New club meetings and campus activities will appear here once published by organizers.'}
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                      >
                        Reset search &amp; filters
                      </button>
                    ) : (
                      capabilities.canAccessOrganizer && (
                        <button
                          type="button"
                          onClick={() => handleNavigate('organizer')}
                          className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
                        >
                          Open Organizer Studio
                        </button>
                      )
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-9">
                      {groupedEvents.map((group) => (
                        <section key={group.bucket} aria-labelledby={`section-${group.bucket}`}>
                          <div className="mb-4 flex items-center gap-3">
                            <h2
                              id={`section-${group.bucket}`}
                              className="font-display text-base font-bold tracking-tight text-[#171717] whitespace-nowrap"
                            >
                              {group.label}
                            </h2>
                            <div className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
                            <span className="font-mono tabular-nums text-xs text-[#737373] whitespace-nowrap">
                              {group.events.length}{' '}
                              {group.events.length === 1 ? 'event' : 'events'}
                            </span>
                          </div>

                          <div className="space-y-4">
                            {group.events.map((event) => {
                              const { rsvpCount, isGoing } = getEffectiveRsvp(event);
                              const cardIndex = cardCounter++;
                              return (
                                <EventCard
                                  key={event.id}
                                  event={event}
                                  index={cardIndex}
                                  rsvpCount={rsvpCount}
                                  isGoing={isGoing}
                                  isSignedIn={Boolean(user)}
                                  onRsvpClick={handleRsvpClick}
                                  onSelectEvent={(evt) => setSelectedEventId(evt.id)}
                                  onSelectClubById={(cid) => void handleSelectClubById(cid)}
                                />
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>

                    {hasMore && (
                      <div className="flex justify-center pt-2">
                        <button
                          type="button"
                          onClick={loadMoreEvents}
                          className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-5 py-2 text-xs sm:text-sm font-semibold text-[#171717] hover:bg-[#F8F9FA] hover:border-[#D1D5DB] transition-colors cursor-pointer"
                        >
                          Load more events
                        </button>
                      </div>
                    )}

                    {activeView === 'discover' && !hasActiveFilters && (
                      <div className="flex justify-center pt-2">
                        <button
                          type="button"
                          onClick={handleExploreCta}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#171717] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#333333] transition-colors cursor-pointer"
                        >
                          <span>Explore All Campus Events</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer
        onNavigate={handleNavigate}
        totalEvents={events.length}
        totalClubs={clubs.length}
        canAccessOrganizer={capabilities.canAccessOrganizer}
        schoolName={schoolConfig.name}
      />

      <MobileBottomNav
        activeView={activeView}
        onNavigate={handleNavigate}
        rsvpCount={activeRsvpCount}
        isSignedIn={Boolean(user)}
      />

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          className={`fixed bottom-20 md:bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success'
              ? 'border-[#15803D] bg-[#16A34A]'
              : 'border-red-700 bg-red-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </motion.div>
      )}

      <EventDetailView
        event={selectedEvent}
        rsvpCount={selectedEvent ? getEffectiveRsvp(selectedEvent).rsvpCount : 0}
        isGoing={selectedEvent ? getEffectiveRsvp(selectedEvent).isGoing : false}
        isSignedIn={Boolean(user)}
        onRsvpClick={handleRsvpClick}
        onSelectClubById={(cid) => void handleSelectClubById(cid)}
        onClose={() => setSelectedEventId(null)}
      />

      <SignInPromptModal
        isOpen={isSignInModalOpen}
        event={promptEvent}
        club={promptClub}
        isSigningIn={isSigningIn}
        authError={authError}
        onConfirmSignIn={handleConfirmSignIn}
        onClose={() => {
          setIsSignInModalOpen(false);
          setPromptEvent(null);
          setPromptClub(null);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <OnePlaceFeed />
      </ErrorBoundary>
    </MotionConfig>
  );
}
