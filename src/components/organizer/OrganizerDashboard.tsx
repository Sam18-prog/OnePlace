import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Plus,
  Rocket,
  ShieldCheck,
  Sliders,
  Users,
} from 'lucide-react';
import type { SchoolConfig } from '../../config/school';
import {
  cancelManagedEvent,
  createManagedEvent,
  publishDraftEvent,
  updateManagedEvent,
} from '../../services/eventService';
import { listSchoolMembers } from '../../services/membershipService';
import {
  fetchUserOnboardingProgress,
  saveUserOnboardingProgress,
} from '../../services/onboardingService';
import type { Club } from '../../types/club';
import type { EventFormValues, SchoolEvent } from '../../types/event';
import type { MembershipCapabilities, SchoolMembership } from '../../types/membership';
import {
  DEFAULT_USER_ONBOARDING_PROGRESS,
  type UserOnboardingProgress,
} from '../../types/school';
import {
  computeOrganizerKpis,
  filterAuthorizedClubsForAnalytics,
  filterAuthorizedEventsForAnalytics,
  mergeDeduplicatedEvents,
} from '../../utils/analytics';
import { getAuthorizedClubsForEventForm } from '../../utils/clubValidation';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard';
import { ClubManagementView } from '../clubs/ClubManagementView';
import { AdminLaunchPanel } from '../onboarding/AdminLaunchPanel';
import { OrganizerOnboardingCard } from '../onboarding/OrganizerOnboardingCard';
import { AdminManagementPanel } from './AdminManagementPanel';
import { CancelEventModal } from './CancelEventModal';
import { EventForm } from './EventForm';
import { EventOperationsPanel } from './EventOperationsPanel';
import { OrganizerEventList } from './OrganizerEventList';
import { OrganizerOverview } from './OrganizerOverview';

export type OrganizerStudioTab =
  | 'overview'
  | 'events'
  | 'operations'
  | 'clubs'
  | 'analytics'
  | 'launch'
  | 'settings';

interface OrganizerDashboardProps {
  user: User;
  membership: SchoolMembership;
  capabilities: MembershipCapabilities;
  schoolConfig: SchoolConfig;
  managedEvents: SchoolEvent[];
  discoverEvents?: SchoolEvent[];
  allManagedClubs: Club[];
  allDiscoverClubs: Club[];
  managedClubIds: ReadonlySet<string>;
  initialTab?: OrganizerStudioTab;
  onSelectEvent: (event: SchoolEvent) => void;
  onViewClubProfile: (club: Club) => void;
  onViewPublishedFeed: () => void;
  onOpenNotificationPreferences?: () => void;
  onSchoolConfigUpdated: () => Promise<void>;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

export function OrganizerDashboard({
  user,
  membership,
  capabilities,
  schoolConfig,
  managedEvents,
  discoverEvents = [],
  allManagedClubs,
  allDiscoverClubs,
  managedClubIds,
  initialTab = 'overview',
  onSelectEvent,
  onViewClubProfile,
  onViewPublishedFeed,
  onOpenNotificationPreferences,
  onSchoolConfigUpdated,
  onShowToast,
}: OrganizerDashboardProps) {
  const [activeTab, setActiveTab] = useState<OrganizerStudioTab>(initialTab);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [cancellingEvent, setCancellingEvent] = useState<SchoolEvent | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  const [schoolMembers, setSchoolMembers] = useState<SchoolMembership[]>([]);
  const [onboardingProgress, setOnboardingProgress] = useState<UserOnboardingProgress>(() =>
    DEFAULT_USER_ONBOARDING_PROGRESS(user.uid, schoolConfig.id)
  );
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const isAdmin = capabilities.canManageAllSchoolEvents;

  useEffect(() => {
    let cancelled = false;
    void fetchUserOnboardingProgress(user.uid, schoolConfig.id).then((loaded) => {
      if (!cancelled) setOnboardingProgress(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolConfig.id, user.uid]);

  useEffect(() => {
    if (!capabilities.canManageRoles) return;
    let cancelled = false;
    void listSchoolMembers(schoolConfig.id)
      .then((list) => {
        if (!cancelled) setSchoolMembers(list);
      })
      .catch(() => {
        // Non-blocking for initial studio load; AdminManagementPanel surfaces errors explicitly
      });
    return () => {
      cancelled = true;
    };
  }, [capabilities.canManageRoles, schoolConfig.id]);

  const updateOrganizerOnboarding = async (patch: Partial<UserOnboardingProgress>) => {
    const next: UserOnboardingProgress = {
      ...onboardingProgress,
      ...patch,
      uid: user.uid,
      schoolId: schoolConfig.id,
    };
    setOnboardingProgress(next);
    setSavingOnboarding(true);
    try {
      await saveUserOnboardingProgress(next);
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not save onboarding checklist.'));
    } finally {
      setSavingOnboarding(false);
    }
  };

  const authorizedClubs = useMemo(
    () => getAuthorizedClubsForEventForm(allManagedClubs, membership, managedClubIds),
    [allManagedClubs, membership, managedClubIds]
  );

  // Strict RBAC-filtered datasets for Analytics
  const authorizedAnalyticsClubs = useMemo(
    () => filterAuthorizedClubsForAnalytics(allManagedClubs, membership, managedClubIds),
    [allManagedClubs, managedClubIds, membership]
  );

  const authorizedAnalyticsEvents = useMemo(() => {
    const combined = mergeDeduplicatedEvents(managedEvents, discoverEvents);
    return filterAuthorizedEventsForAnalytics(combined, membership, managedClubIds);
  }, [discoverEvents, managedClubIds, managedEvents, membership]);

  const overviewKpis = useMemo(
    () => computeOrganizerKpis(authorizedAnalyticsEvents),
    [authorizedAnalyticsEvents]
  );

  const openCreateModal = () => {
    setEditorMode('create');
    setEditingEvent(null);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (event: SchoolEvent) => {
    setEditorMode('edit');
    setEditingEvent(event);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleSubmitForm = async (
    values: EventFormValues,
    targetStatus: 'draft' | 'published'
  ) => {
    setIsSubmittingForm(true);
    setFormError(null);
    try {
      if (editorMode === 'create') {
        await createManagedEvent({
          values,
          status: targetStatus,
          schoolId: schoolConfig.id,
          timezone: schoolConfig.timezone,
          creatorUid: user.uid,
        });
        onShowToast(
          'success',
          targetStatus === 'published'
            ? `"${values.title.trim()}" published to campus feed.`
            : `"${values.title.trim()}" saved as draft.`
        );
      } else if (editingEvent) {
        await updateManagedEvent({
          existing: editingEvent,
          values,
          targetStatus,
          timezone: schoolConfig.timezone,
        });
        onShowToast('success', `Updated "${values.title.trim()}".`);
      }
      setIsEditorOpen(false);
      setEditingEvent(null);
    } catch (err) {
      setFormError(toUserFriendlyErrorMessage(err, 'Could not save event. Please try again.'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handlePublishDraft = async (event: SchoolEvent) => {
    const matchedClub = (isAdmin ? allManagedClubs : allDiscoverClubs).find(
      (c) => c.id === event.clubId
    );
    if (matchedClub && matchedClub.status !== 'active') {
      onShowToast(
        'error',
        `"${matchedClub.name}" is suspended. Reactivate the club before publishing events.`
      );
      return;
    }

    setBusyEventId(event.id);
    try {
      await publishDraftEvent(event);
      onShowToast('success', `"${event.title}" is now live on the campus feed.`);
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not publish draft.'));
    } finally {
      setBusyEventId(null);
    }
  };

  const handleConfirmCancel = async (event: SchoolEvent, reason: string) => {
    setIsCancelling(true);
    try {
      await cancelManagedEvent(event, reason, membership.role);
      setCancellingEvent(null);
      onShowToast('success', `"${event.title}" marked as cancelled.`);
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not cancel event.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const studioTabs: { id: OrganizerStudioTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'events', label: 'My Events', icon: CalendarDays },
    { id: 'operations', label: 'Operations', icon: ClipboardCheck },
    { id: 'clubs', label: 'Clubs', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ...(capabilities.canManageRoles
      ? [{ id: 'launch' as const, label: 'Launch', icon: Rocket }]
      : []),
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <div className="space-y-7">
      {/* Workspace Header */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-[#E85D04]/25 bg-[#E85D04]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2F02]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isAdmin ? 'School Administrator' : 'Club Organizer'}</span>
              </span>
              <span className="font-mono text-xs text-[#737373]">{schoolConfig.name}</span>
            </div>

            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
              Organizer Studio
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#737373]">
              Manage events, clubs, and campus analytics. Times displayed in{' '}
              <span className="font-mono text-[#171717]">{schoolConfig.timezone}</span>.
            </p>
          </div>

          <div
            className="flex w-full lg:w-fit flex-wrap items-center gap-1 rounded-2xl sm:rounded-full border border-[#E5E7EB] bg-[#F8F9FA] p-1 shrink-0"
            role="tablist"
            aria-label="Organizer studio sections"
          >
            {studioTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#171717] text-white'
                      : 'text-[#737373] hover:text-[#171717]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          {!isAdmin && !onboardingProgress.organizerDismissed && (
            <OrganizerOnboardingCard
              assignedClubs={authorizedAnalyticsClubs}
              managedEvents={managedEvents}
              progress={onboardingProgress}
              saving={savingOnboarding}
              onToggleManualStep={(key) =>
                void updateOrganizerOnboarding({ [key]: !onboardingProgress[key] })
              }
              onNavigateTab={(tab) => setActiveTab(tab)}
              onCreateEvent={openCreateModal}
              onDismiss={() => void updateOrganizerOnboarding({ organizerDismissed: true })}
            />
          )}

          <OrganizerOverview
            events={authorizedAnalyticsEvents}
            onCreateEvent={openCreateModal}
            onFocusManageEvents={() => setActiveTab('events')}
            onViewPublishedEvents={onViewPublishedFeed}
            onOpenAnalytics={() => setActiveTab('analytics')}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] font-medium text-[#E85D04]">
                  Analytics Summary
                </p>
                <h2 className="mt-1 font-display text-lg font-bold text-[#171717]">
                  Engagement Intelligence
                </h2>
                <p className="mt-1 text-xs text-[#737373]">
                  Published events average{' '}
                  <span className="font-mono font-bold text-[#171717]">
                    {overviewKpis.avgRsvpsPerPublished}
                  </span>{' '}
                  RSVPs each.
                  {overviewKpis.mostActiveClub
                    ? ` Most active club: ${overviewKpis.mostActiveClub.clubName} (${overviewKpis.mostActiveClub.publishedCount} published).`
                    : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('analytics')}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333333] cursor-pointer transition-colors"
                >
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Open Full Analytics</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('clubs')}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer transition-colors"
                >
                  <Users className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                  <span>Manage Clubs ({authorizedAnalyticsClubs.length})</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] font-medium text-[#737373]">
                  Event Pipeline
                </p>
                <h2 className="mt-1 font-display text-lg font-bold text-[#171717]">
                  Recent Managed Events
                </h2>
                {managedEvents.length === 0 ? (
                  <p className="mt-1 text-xs text-[#737373]">
                    No managed events yet. Draft or publish your first event to start tracking RSVPs.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-[#F3F4F6]">
                    {managedEvents.slice(0, 3).map((evt) => (
                      <li key={evt.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => onSelectEvent(evt)}
                          className="font-semibold text-[#171717] hover:text-[#E85D04] truncate text-left cursor-pointer"
                        >
                          {evt.title}
                        </button>
                        <span className="font-mono tabular-nums text-[11px] text-[#737373] shrink-0">
                          {evt.status} · {evt.rsvpCount} RSVPs
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E85D04] hover:text-[#DC2F02] cursor-pointer"
                >
                  <span>View all {managedEvents.length} events</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'events' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Create Event</span>
            </button>
          </div>
          <OrganizerEventList
            events={managedEvents}
            schoolTimezone={schoolConfig.timezone}
            busyEventId={busyEventId}
            isAdmin={isAdmin}
            onCreateEvent={openCreateModal}
            onView={onSelectEvent}
            onEdit={openEditModal}
            onPublish={(evt) => void handlePublishDraft(evt)}
            onRequestCancel={(evt) => setCancellingEvent(evt)}
          />
        </div>
      ) : activeTab === 'operations' ? (
        <EventOperationsPanel
          events={managedEvents}
          membership={membership}
          managedClubIds={managedClubIds}
          organizerUid={user.uid}
          onEditEvent={openEditModal}
          onCancelEvent={(evt) => setCancellingEvent(evt)}
          onViewEvent={onSelectEvent}
          onShowToast={onShowToast}
        />
      ) : activeTab === 'clubs' ? (
        <ClubManagementView
          schoolConfig={schoolConfig}
          currentUid={user.uid}
          isAdmin={isAdmin}
          clubs={allManagedClubs}
          events={authorizedAnalyticsEvents}
          onViewClubProfile={onViewClubProfile}
          onShowToast={onShowToast}
        />
      ) : activeTab === 'analytics' ? (
        <AnalyticsDashboard
          membership={membership}
          capabilities={capabilities}
          schoolConfig={schoolConfig}
          authorizedEvents={authorizedAnalyticsEvents}
          authorizedClubs={authorizedAnalyticsClubs}
          isAdminScopeCapped={isAdmin && managedEvents.length >= 200}
          onSelectEvent={onSelectEvent}
          onViewClubProfile={onViewClubProfile}
          onShowToast={onShowToast}
        />
      ) : activeTab === 'launch' && capabilities.canManageRoles ? (
        <AdminLaunchPanel
          schoolConfig={schoolConfig}
          currentAdminUid={user.uid}
          clubs={allManagedClubs}
          events={authorizedAnalyticsEvents}
          members={schoolMembers}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onSchoolConfigUpdated={onSchoolConfigUpdated}
          onShowToast={onShowToast}
        />
      ) : capabilities.canManageRoles ? (
        <AdminManagementPanel
          schoolConfig={schoolConfig}
          currentAdminUid={user.uid}
          schoolClubs={allManagedClubs}
          schoolEvents={authorizedAnalyticsEvents}
          onSchoolConfigUpdated={onSchoolConfigUpdated}
          onMembersChanged={setSchoolMembers}
          onShowToast={onShowToast}
        />
      ) : (
        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold text-[#171717]">
              Organizer Workspace Settings
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#737373]">
              Your role scope, assigned clubs, and notification settings for{' '}
              <span className="font-medium text-[#171717]">{schoolConfig.name}</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]">
            <div className="p-4">
              <p className="text-[11px] font-medium text-[#737373]">Active Role</p>
              <p className="mt-1 font-display text-sm font-bold text-[#171717] capitalize">
                {membership.role}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-medium text-[#737373]">School Timezone</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[#171717]">
                {schoolConfig.timezone}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-medium text-[#737373]">Assigned Clubs</p>
              <p className="mt-1 font-mono tabular-nums text-sm font-bold text-[#171717]">
                {authorizedAnalyticsClubs.length}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373]">
              Assigned Clubs
            </h3>
            {authorizedAnalyticsClubs.length === 0 ? (
              <p className="mt-2 text-xs text-[#737373]">
                No clubs assigned yet. Contact a School Administrator to assign you as a club organizer.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
                {authorizedAnalyticsClubs.map((club) => (
                  <div
                    key={club.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#171717]">{club.name}</p>
                      <p className="text-[11px] text-[#737373]">{club.category}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewClubProfile(club)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                    >
                      <span>View Club</span>
                      <ArrowUpRight className="h-3 w-3 text-[#737373]" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] flex flex-wrap items-center gap-2">
            {onOpenNotificationPreferences && (
              <button
                type="button"
                onClick={onOpenNotificationPreferences}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                <span>Manage Notification Preferences</span>
              </button>
            )}
            {onboardingProgress.organizerDismissed && (
              <button
                type="button"
                onClick={() => {
                  void updateOrganizerOnboarding({ organizerDismissed: false });
                  setActiveTab('overview');
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#E5E7EB]/60 cursor-pointer"
              >
                <Rocket className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
                <span>Reopen Organizer Quick Start</span>
              </button>
            )}
          </div>
        </section>
      )}

      <EventForm
        isOpen={isEditorOpen}
        mode={editorMode}
        initialEvent={editingEvent}
        schoolTimezone={schoolConfig.timezone}
        authorizedClubs={authorizedClubs}
        allSchoolClubs={isAdmin ? allManagedClubs : allDiscoverClubs}
        isSubmitting={isSubmittingForm}
        submitError={formError}
        onSubmit={handleSubmitForm}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingEvent(null);
          setFormError(null);
        }}
      />

      <CancelEventModal
        event={cancellingEvent}
        isSubmitting={isCancelling}
        onConfirmCancel={handleConfirmCancel}
        onClose={() => setCancellingEvent(null)}
      />
    </div>
  );
}
