import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { AlertCircle, ArrowRight, CalendarDays, CalendarOff, X } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import type { AppView, SchoolEvent } from './types/event';
import { filterEvents, groupEventsByTimeframe, parseDemoEvents } from './utils/events';
import { computeOptimisticRsvp } from './utils/rsvp';
import {
  ensureDemoEventsSeeded,
  fetchUserRsvps,
  subscribeToEventCounts,
  toggleEventRsvp,
} from './services/rsvpService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
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
import { EventSkeleton } from './components/EventSkeleton';
import { SignInPromptModal } from './components/SignInPromptModal';

function OnePlaceFeed() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [userRsvps, setUserRsvps] = useState<Record<string, boolean>>({});
  const [optimisticState, setOptimisticState] = useState<
    Record<string, { isGoing: boolean; rsvpCount: number }>
  >({});
  const inFlightRef = useRef<Set<string>>(new Set());

  const [activeView, setActiveView] = useState<AppView>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [promptEvent, setPromptEvent] = useState<SchoolEvent | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const feedSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const loadStaticEvents = useCallback(async (isManualRefresh: boolean) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);

    const startedAt = Date.now();
    try {
      const response = await fetch(`/demo-events.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Unable to load events (${response.status})`);
      }
      const json: unknown = await response.json();
      const parsed = parseDemoEvents(json);

      if (isManualRefresh) {
        const elapsed = Date.now() - startedAt;
        if (elapsed < 300) {
          await new Promise((resolve) => setTimeout(resolve, 300 - elapsed));
        }
      }

      setEvents(parsed);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load campus events.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStaticEvents(false);
  }, [loadStaticEvents]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      if (!nextUser) {
        setUserRsvps({});
        setLiveCounts({});
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authLoading || !user || events.length === 0) return;

    let active = true;
    const eventIds = events.map((e) => e.id);

    ensureDemoEventsSeeded(events).catch((err) => {
      if (active) {
        console.warn('Demo event seeding deferred:', err);
      }
    });

    fetchUserRsvps(eventIds, user.uid)
      .then((rsvps) => {
        if (active) setUserRsvps(rsvps);
      })
      .catch((err) => {
        if (active) {
          console.warn('Initial user RSVP fetch deferred:', err);
        }
      });

    const unsubCounts = subscribeToEventCounts(
      (counts) => {
        if (active) setLiveCounts(counts);
      },
      (err) => {
        if (active) {
          console.warn('Firestore count listener error:', err);
        }
      }
    );

    return () => {
      active = false;
      unsubCounts();
    };
  }, [authLoading, user, events]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsSignInModalOpen(false);
      setPromptEvent(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.';
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    setOptimisticState({});
    await signOut(auth);
  };

  const getEffectiveRsvp = useCallback(
    (event: SchoolEvent) => {
      const baseCount =
        typeof liveCounts[event.id] === 'number' ? liveCounts[event.id] : event.rsvpCount;
      const override = optimisticState[event.id];
      const rsvpCount = override ? override.rsvpCount : baseCount;
      const isGoing = override ? override.isGoing : Boolean(userRsvps[event.id]);
      return { rsvpCount, isGoing };
    },
    [liveCounts, optimisticState, userRsvps]
  );

  const handleRsvpClick = (event: SchoolEvent) => {
    if (!user) {
      setAuthError(null);
      setPromptEvent(event);
      setIsSignInModalOpen(true);
      return;
    }

    if (inFlightRef.current.has(event.id)) {
      return;
    }

    const { isGoing: currentlyGoing, rsvpCount: currentCount } = getEffectiveRsvp(event);
    const { nextGoing, nextCount } = computeOptimisticRsvp(currentlyGoing, currentCount);

    setToastMessage(null);
    setOptimisticState((prev) => ({
      ...prev,
      [event.id]: { isGoing: nextGoing, rsvpCount: nextCount },
    }));
    inFlightRef.current.add(event.id);

    void toggleEventRsvp(event, user.uid, currentlyGoing)
      .then(() => {
        setUserRsvps((prev) => ({ ...prev, [event.id]: nextGoing }));
        setLiveCounts((prev) => ({ ...prev, [event.id]: nextCount }));
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
        setToastMessage('Connection failed.');
      })
      .finally(() => {
        inFlightRef.current.delete(event.id);
      });
  };

  const filteredEvents = useMemo(
    () => filterEvents(events, searchQuery, timeFilter, new Date(), categoryFilter),
    [events, searchQuery, timeFilter, categoryFilter]
  );

  const groupedEvents = useMemo(
    () => groupEventsByTimeframe(filteredEvents),
    [filteredEvents]
  );

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const activeRsvpCount = useMemo(() => {
    if (!user) return 0;
    return events.reduce((acc, event) => (getEffectiveRsvp(event).isGoing ? acc + 1 : acc), 0);
  }, [events, getEffectiveRsvp, user]);

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFocusSearch = () => {
    if (activeView === 'my-rsvps' || activeView === 'profile') {
      setActiveView('explore');
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
  const hasActiveFilters =
    Boolean(searchQuery.trim()) || timeFilter !== 'all' || categoryFilter !== 'all';

  let cardCounter = 0;

  return (
    <div id="top" className="min-h-screen bg-[#F8F9FA] text-[#171717]">
      <Header
        activeView={activeView}
        onNavigate={handleNavigate}
        onFocusSearch={handleFocusSearch}
        user={user}
        authLoading={authLoading}
        isRefreshing={isRefreshing}
        rsvpTotalCount={activeRsvpCount}
        onRefresh={() => loadStaticEvents(true)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:pt-8 md:pb-14">
        <AnimatePresence mode="wait">
          {activeView === 'my-rsvps' ? (
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
                onSignIn={handleSignIn}
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
                rsvpCount={activeRsvpCount}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                onOpenMyEvents={() => handleNavigate('my-rsvps')}
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
              {/* Hero (Discover) or Compact Page Header (Explore) */}
              {activeView === 'discover' ? (
                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-7 md:p-8 shadow-xs">
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="max-w-2xl">
                      <p className="font-mono text-xs font-medium text-[#E85D04]">
                        Everything happening. All in OnePlace.
                      </p>
                      <h1 className="mt-2 font-display text-2xl sm:text-3xl md:text-[38px] font-extrabold tracking-tight text-[#171717] leading-[1.15] [text-wrap:balance]">
                        Your campus. Your community.{' '}
                        <span className="text-[#737373]">Your next experience.</span>
                      </h1>
                      <p className="mt-2.5 text-sm sm:text-[15px] text-[#737373] leading-relaxed max-w-xl">
                        Discover what's happening around you. Find your people, explore events, and never miss a moment.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2 text-xs text-[#737373]">
                        <CalendarDays className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                        <span className="font-mono tabular-nums font-semibold text-[#171717]">
                          {events.length}
                        </span>
                        <span>upcoming events</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleExploreCta}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
                      >
                        <span>Explore Events</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </section>
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

              {/* Unified Search, Timeframe & Category Controls */}
              <DiscoveryToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                timeFilter={timeFilter}
                onTimeFilterChange={setTimeFilter}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
                searchInputRef={searchInputRef}
              />

              {/* Chronological Feed */}
              <div ref={feedSectionRef}>
                {loadError ? (
                  <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
                    <p className="font-display text-base font-bold text-[#171717]">
                      Couldn't load the event feed
                    </p>
                    <p className="mt-1 text-sm text-[#737373]">{loadError}</p>
                    <button
                      type="button"
                      onClick={() => loadStaticEvents(true)}
                      className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#E85D04] px-5 py-2 text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : showSkeleton ? (
                  <EventSkeleton />
                ) : groupedEvents.length === 0 ? (
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-xs">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
                      <CalendarOff className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="font-display text-base font-semibold text-[#171717]">
                      {hasActiveFilters
                        ? 'No matching events found'
                        : 'No events on the radar yet. Check back soon!'}
                    </p>
                    <p className="mt-1 text-sm text-[#737373]">
                      {hasActiveFilters
                        ? 'Try clearing your search term or switching timeframe and category filters.'
                        : 'New club meetings and campus activities will appear here once posted.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setTimeFilter('all');
                          setCategoryFilter('all');
                        }}
                        className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                      >
                        Reset search & filters
                      </button>
                    )}
                  </div>
                ) : (
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
                            const isFeaturedLead =
                              activeView === 'discover' &&
                              !hasActiveFilters &&
                              cardIndex === 0;
                            return (
                              <EventCard
                                key={event.id}
                                event={event}
                                index={cardIndex}
                                variant={isFeaturedLead ? 'featured' : 'standard'}
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
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <MobileBottomNav
        activeView={activeView}
        onNavigate={handleNavigate}
        rsvpCount={activeRsvpCount}
        isSignedIn={Boolean(user)}
      />

      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          role="alert"
          aria-live="assertive"
          className="fixed bottom-20 md:bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2.5 rounded-xl border border-red-700 bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
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
        onConfirmSignIn={handleSignIn}
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
