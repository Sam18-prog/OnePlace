import { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { CalendarDays, ShieldCheck, Sliders } from 'lucide-react';
import type { SchoolConfig } from '../../config/school';
import {
  cancelManagedEvent,
  createManagedEvent,
  publishDraftEvent,
  updateManagedEvent,
} from '../../services/eventService';
import type { EventFormValues, SchoolEvent } from '../../types/event';
import type { MembershipCapabilities, SchoolMembership } from '../../types/membership';
import { AdminManagementPanel } from './AdminManagementPanel';
import { CancelEventModal } from './CancelEventModal';
import { EventForm } from './EventForm';
import { OrganizerEventList } from './OrganizerEventList';
import { OrganizerOverview } from './OrganizerOverview';

interface OrganizerDashboardProps {
  user: User;
  membership: SchoolMembership;
  capabilities: MembershipCapabilities;
  schoolConfig: SchoolConfig;
  managedEvents: SchoolEvent[];
  onSelectEvent: (event: SchoolEvent) => void;
  onViewPublishedFeed: () => void;
  onSchoolConfigUpdated: () => Promise<void>;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

export function OrganizerDashboard({
  user,
  membership,
  capabilities,
  schoolConfig,
  managedEvents,
  onSelectEvent,
  onViewPublishedFeed,
  onSchoolConfigUpdated,
  onShowToast,
}: OrganizerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'events' | 'admin'>('events');
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [cancellingEvent, setCancellingEvent] = useState<SchoolEvent | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  const eventListRef = useRef<HTMLDivElement | null>(null);

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
      const msg = err instanceof Error ? err.message : 'Could not save event.';
      setFormError(msg);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handlePublishDraft = async (event: SchoolEvent) => {
    setBusyEventId(event.id);
    try {
      await publishDraftEvent(event);
      onShowToast('success', `"${event.title}" is now live on the campus feed.`);
    } catch (err) {
      onShowToast('error', err instanceof Error ? err.message : 'Could not publish draft.');
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
      onShowToast('error', err instanceof Error ? err.message : 'Could not cancel event.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleScrollToEvents = () => {
    setActiveTab('events');
    window.setTimeout(() => {
      eventListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const isAdmin = capabilities.canManageAllSchoolEvents;

  return (
    <div className="space-y-7">
      {/* Workspace Header */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              Create, publish, and manage campus club events. Times displayed in{' '}
              <span className="font-mono text-[#171717]">{schoolConfig.timezone}</span>.
            </p>
          </div>

          {capabilities.canManageRoles && (
            <div
              className="flex w-fit items-center gap-1 rounded-full border border-[#E5E7EB] bg-[#F8F9FA] p-1 shrink-0"
              role="tablist"
              aria-label="Organizer studio sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'events'}
                onClick={() => setActiveTab('events')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'events'
                    ? 'bg-[#171717] text-white'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Events</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'admin'}
                onClick={() => setActiveTab('admin')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-[#171717] text-white'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Admin &amp; Roles</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {activeTab === 'admin' && capabilities.canManageRoles ? (
        <AdminManagementPanel
          schoolConfig={schoolConfig}
          currentAdminUid={user.uid}
          onSchoolConfigUpdated={onSchoolConfigUpdated}
          onShowToast={onShowToast}
        />
      ) : (
        <>
          <OrganizerOverview
            events={managedEvents}
            onCreateEvent={openCreateModal}
            onFocusManageEvents={handleScrollToEvents}
            onViewPublishedEvents={onViewPublishedFeed}
          />

          <div ref={eventListRef}>
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
        </>
      )}

      <EventForm
        isOpen={isEditorOpen}
        mode={editorMode}
        initialEvent={editingEvent}
        schoolTimezone={schoolConfig.timezone}
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
