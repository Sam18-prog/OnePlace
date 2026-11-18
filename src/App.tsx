import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { AlertCircle, CalendarOff, CheckCircle2, Lock, X } from 'lucide-react';
import type { AppView, SchoolEvent } from './types/event';
import { filterEvents, groupEventsByTimeframe } from './utils/events';
import { useAuth } from './hooks/useAuth';
import { useMembership } from './hooks/useMembership';
import { useEvents } from './hooks/useEvents';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { MobileBottomNav } from './components/MobileBottomNav';
import {
  DiscoveryToolbar,
  type CategoryFilter,
  type TimeFilter,
} from './components/DiscoveryToolbar';
import { EventCard } from './components/EventCard';
import { EventDetailView } from './components/EventDetailView';
import { MyEventsView } from './components/MyEventsView';
import { ProfileView } from './components/ProfileView';
import { OrganizerDashboard } from './components/organizer/OrganizerDashboard';
import { EventSkeleton } from './components/EventSkeleton';
import { SignInPromptModal } from './components/SignInPromptModal';
import { Footer } from './components/Footer';

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

  const [activeView, setActiveView] = useState<AppView>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [promptEvent, setPromptEvent] = useState<SchoolEvent | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const feedSectionRef = useRef<HTMLDivElement | null>(null);

  const handleConfirmSignIn = async () => {
    const ok = await signIn();
    if (ok) {
      setIsSignInModalOpen(false);
      setPromptEvent(null);
    }
  };

  const handleOpenSignIn = () => {
    setAuthError(null);
    setPromptEvent(null);
    setIsSignInModalOpen(true);
  };

  const handleRsvpClick = (event: SchoolEvent) => {
    if (!user) {
      setAuthError(null);
      setPromptEvent(event);
      setIsSignInModalOpen(true);
      return;
    }
    toggleRsvp(event);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setTimeFilter('all');
    setCategoryFilter('all');
  };

  const handleSelectCategoryShortcut = (category: CategoryFilter) => {
    if (category === 'all') {
      setCategoryFilter('all');
      return;
    }
    setCategoryFilter((prev) => (prev === category ? 'all' : category));
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || timeFilter !== 'all' || categoryFilter !== 'all';

  const filteredEvents = useMemo(
    () => filterEvents(events, searchQuery, timeFilter, new Date(), categoryFilter),
    [events, searchQuery, timeFilter, categoryFilter]
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

  const activeRsvpCount = useMemo(() => {
    if (!user) return 0;
    return events.reduce((acc, event) => (getEffectiveRsvp(event).isGoing ? acc + 1 : acc), 0);
  }, [events, getEffectiveRsvp, user]);

  const handleNavigate = (view: AppView) => {
    if (view === 'organizer' && !capabilities.canAccessOrganizer) {
      showToast('error', 'Organizer access requires an active Organizer or Admin role.');
      return;
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFocusSearch = () => {
    if (activeView === 'my-rsvps' || activeView === 'profile' || activeView === 'organizer') {
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
                  onSelectEvent={(evt) => setSelectedEventId(evt.id)}
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
                onSignIn={handleOpenSignIn}
                onExplore={handleExploreCta}
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
                membership={membership}
                capabilities={capabilities}
                getEffectiveRsvp={getEffectiveRsvp}
                onSignIn={handleOpenSignIn}
                onSignOut={logOut}
                onOpenMyEvents={() => handleNavigate('my-rsvps')}
                onOpenOrganizer={() => handleNavigate('organizer')}
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
                  />
                </section>
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
                        ? 'Try clearing your search term or switching timeframe and category filters.'
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
        canAccessOrganizer={capabilities.canAccessOrganizer}
        schoolName={schoolConfig.name}
      />

      <MobileBottomNav
        activeView={activeView}
        onNavigate={handleNavigate}
        rsvpCount={activeRsvpCount}
        isSignedIn={Boolean(user)}
        canAccessOrganizer={capabilities.canAccessOrganizer}
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
        onClose={() => setSelectedEventId(null)}
      />

      <SignInPromptModal
        isOpen={isSignInModalOpen}
        event={promptEvent}
        isSigningIn={isSigningIn}
        authError={authError}
        onConfirmSignIn={handleConfirmSignIn}
        onClose={() => {
          setIsSignInModalOpen(false);
          setPromptEvent(null);
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
