import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Globe, Lock, Save, Send, X } from 'lucide-react';
import type { Club } from '../../types/club';
import type { EventFormValues, EventVisibility, SchoolEvent } from '../../types/event';
import { mapClubCategoryToEventCategory } from '../../utils/clubValidation';
import {
  ALL_EVENT_CATEGORIES,
  EVENT_DESC_MAX,
  EVENT_IMAGE_URL_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  formatDateInTimezone,
  validateEventForm,
  type EventFormErrors,
} from '../../utils/eventValidation';
import { EventImage } from '../EventImage';

interface EventFormProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialEvent: SchoolEvent | null;
  schoolTimezone: string;
  authorizedClubs: Club[];
  allSchoolClubs?: Club[];
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (values: EventFormValues, targetStatus: 'draft' | 'published') => Promise<void>;
  onClose: () => void;
}

function getInitialValues(
  event: SchoolEvent | null,
  schoolTimezone: string,
  authorizedClubs: Club[]
): EventFormValues {
  if (event) {
    const startParts = formatDateInTimezone(event.startAt, event.timezone || schoolTimezone);
    const endParts = formatDateInTimezone(event.endAt, event.timezone || schoolTimezone);
    return {
      title: event.title,
      hostClub: event.hostClub,
      clubId: event.clubId,
      category: event.category,
      eventDate: startParts.date,
      startTime: startParts.time,
      endTime: endParts.time,
      location: event.location,
      description: event.description,
      imageUrl: event.imageUrl ?? '',
      visibility: event.visibility,
    };
  }

  const defaultClub = authorizedClubs[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dateParts = formatDateInTimezone(tomorrow, schoolTimezone);
  return {
    title: '',
    hostClub: defaultClub?.name ?? '',
    clubId: defaultClub?.id ?? '',
    category: defaultClub ? mapClubCategoryToEventCategory(defaultClub.category) : 'STEM & Makers',
    eventDate: dateParts.date,
    startTime: '15:30',
    endTime: '16:30',
    location: '',
    description: '',
    imageUrl: '',
    visibility: 'public',
  };
}

export function EventForm({
  isOpen,
  mode,
  initialEvent,
  schoolTimezone,
  authorizedClubs,
  allSchoolClubs = [],
  isSubmitting,
  submitError,
  onSubmit,
  onClose,
}: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(() =>
    getInitialValues(initialEvent, schoolTimezone, authorizedClubs)
  );
  const [errors, setErrors] = useState<EventFormErrors>({});

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(getInitialValues(initialEvent, schoolTimezone, authorizedClubs));
    setErrors({});
  }, [isOpen, initialEvent, schoolTimezone, authorizedClubs]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const selectedActiveClub = authorizedClubs.find((c) => c.id === values.clubId);
  const isSelectedClubSuspended = Boolean(
    values.clubId &&
      !selectedActiveClub &&
      allSchoolClubs.some((c) => c.id === values.clubId && c.status === 'suspended')
  );
  const hasNoAuthorizedClubs = authorizedClubs.length === 0;
  const publishBlockedByClub = !selectedActiveClub || isSelectedClubSuspended;

  const updateField = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof EventFormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof EventFormErrors];
        return next;
      });
    }
  };

  const handleClubSelect = (nextClubId: string) => {
    const matched = authorizedClubs.find((c) => c.id === nextClubId);
    if (!matched) return;
    setValues((prev) => ({
      ...prev,
      clubId: matched.id,
      hostClub: matched.name,
      category:
        mode === 'create'
          ? mapClubCategoryToEventCategory(matched.category)
          : prev.category,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.clubId;
      delete next.hostClub;
      return next;
    });
  };

  const handleAction = async (targetStatus: 'draft' | 'published') => {
    if (targetStatus === 'published' && publishBlockedByClub) {
      setErrors((prev) => ({
        ...prev,
        clubId: isSelectedClubSuspended
          ? 'Suspended clubs cannot publish events until reactivated.'
          : 'Select an active hosting club.',
      }));
      return;
    }

    const isEditingExistingPublished =
      mode === 'edit' && initialEvent?.status === 'published' && targetStatus === 'published';

    const validation = validateEventForm(values, targetStatus, schoolTimezone, {
      isEditingExistingPublished,
      requireClubId: true,
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    await onSubmit(values, targetStatus);
  };

  const isPublishedEdit = mode === 'edit' && initialEvent?.status === 'published';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#171717]/45 p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col w-full md:max-w-2xl max-h-[92dvh] md:max-h-[88vh] overflow-hidden rounded-t-2xl md:rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4 bg-white shrink-0">
          <div>
            <p className="font-mono text-[11px] font-medium text-[#E85D04]">
              {mode === 'create' ? 'New Campus Event' : 'Edit Event Details'}
            </p>
            <h2
              id="event-form-title"
              className="font-display text-lg font-extrabold tracking-tight text-[#171717]"
            >
              {mode === 'create' ? 'Create Event' : initialEvent?.title || 'Update Event'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close event editor"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAction(isPublishedEdit ? 'published' : 'published');
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5"
        >
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm text-red-700"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Event Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="evt-title" className="text-xs font-semibold text-[#171717]">
                Event title <span className="text-[#DC2626]">*</span>
              </label>
              <span className="font-mono text-[11px] text-[#737373]">
                {values.title.length}/{EVENT_TITLE_MAX}
              </span>
            </div>
            <input
              ref={titleInputRef}
              id="evt-title"
              type="text"
              maxLength={EVENT_TITLE_MAX}
              value={values.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g., Spring Robotics Prototype Showcase"
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
            {errors.title && <p className="mt-1 text-xs text-[#DC2626]">{errors.title}</p>}
          </div>

          {hasNoAuthorizedClubs && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
              <span>
                No active clubs are currently available for your account. Create or reactivate a club (or ask an admin to assign you as a club organizer) before publishing events.
              </span>
            </div>
          )}

          {isSelectedClubSuspended && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                This club is currently suspended. Publishing new or updated events is blocked until a school administrator reactivates the club.
              </span>
            </div>
          )}

          {/* Hosting Club & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="evt-club" className="block text-xs font-semibold text-[#171717] mb-1.5">
                Hosting club <span className="text-[#DC2626]">*</span>
              </label>
              <select
                id="evt-club"
                value={values.clubId || ''}
                onChange={(e) => handleClubSelect(e.target.value)}
                disabled={hasNoAuthorizedClubs && !values.clubId}
                className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15 disabled:bg-[#F8F9FA] disabled:text-[#737373]"
              >
                {authorizedClubs.length === 0 && !values.clubId && (
                  <option value="">No active clubs available</option>
                )}
                {values.clubId && !selectedActiveClub && (
                  <option value={values.clubId}>
                    {values.hostClub || values.clubId} (Inactive / Unassigned)
                  </option>
                )}
                {authorizedClubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
              {(errors.clubId || errors.hostClub) && (
                <p className="mt-1 text-xs text-[#DC2626]">
                  {errors.clubId || errors.hostClub}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="evt-category" className="block text-xs font-semibold text-[#171717] mb-1.5">
                Category <span className="text-[#DC2626]">*</span>
              </label>
              <select
                id="evt-category"
                value={values.category}
                onChange={(e) => updateField('category', e.target.value as EventFormValues['category'])}
                className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
              >
                {ALL_EVENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-xs text-[#DC2626]">{errors.category}</p>}
            </div>
          </div>

          {/* Date, Start Time, End Time */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-[#171717]">
                Schedule <span className="text-[#DC2626]">*</span>
              </span>
              <span className="font-mono text-[11px] text-[#737373]">
                Timezone: {schoolTimezone}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="evt-date" className="block text-[11px] font-medium text-[#737373] mb-1">
                  Date
                </label>
                <input
                  id="evt-date"
                  type="date"
                  value={values.eventDate}
                  onChange={(e) => updateField('eventDate', e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
                />
              </div>

              <div>
                <label htmlFor="evt-start" className="block text-[11px] font-medium text-[#737373] mb-1">
                  Start time
                </label>
                <input
                  id="evt-start"
                  type="time"
                  value={values.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
                />
              </div>

              <div>
                <label htmlFor="evt-end" className="block text-[11px] font-medium text-[#737373] mb-1">
                  End time
                </label>
                <input
                  id="evt-end"
                  type="time"
                  value={values.endTime}
                  onChange={(e) => updateField('endTime', e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
                />
              </div>
            </div>
            {errors.eventDate && <p className="mt-1 text-xs text-[#DC2626]">{errors.eventDate}</p>}
            {errors.endTime && <p className="mt-1 text-xs text-[#DC2626]">{errors.endTime}</p>}
          </div>

          {/* Venue */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="evt-location" className="text-xs font-semibold text-[#171717]">
                Location / Venue <span className="text-[#DC2626]">*</span>
              </label>
              <span className="font-mono text-[11px] text-[#737373]">
                {values.location.length}/{EVENT_LOCATION_MAX}
              </span>
            </div>
            <input
              id="evt-location"
              type="text"
              maxLength={EVENT_LOCATION_MAX}
              value={values.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="e.g., Engineering Lab B-204"
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
            {errors.location && <p className="mt-1 text-xs text-[#DC2626]">{errors.location}</p>}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="evt-description" className="text-xs font-semibold text-[#171717]">
                Event description <span className="text-[#DC2626]">*</span>
              </label>
              <span className="font-mono text-[11px] text-[#737373]">
                {values.description.length}/{EVENT_DESC_MAX}
              </span>
            </div>
            <textarea
              id="evt-description"
              rows={4}
              maxLength={EVENT_DESC_MAX}
              value={values.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Share what students can expect, what to bring, and who should attend..."
              className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-[#DC2626]">{errors.description}</p>
            )}
          </div>

          {/* Visibility Scope */}
          <div>
            <span className="block text-xs font-semibold text-[#171717] mb-1.5">Visibility</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'public',
                    title: 'Public Campus Feed',
                    desc: 'Visible to all visitors and students.',
                    Icon: Globe,
                  },
                  {
                    id: 'school',
                    title: 'School Members Only',
                    desc: 'Visible only to verified school members.',
                    Icon: Lock,
                  },
                ] as { id: EventVisibility; title: string; desc: string; Icon: typeof Globe }[]
              ).map(({ id, title, desc, Icon }) => {
                const selected = values.visibility === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateField('visibility', id)}
                    aria-pressed={selected}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#E85D04] bg-[#E85D04]/5'
                        : 'border-[#E5E7EB] bg-white hover:bg-[#F8F9FA]'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        selected ? 'text-[#E85D04]' : 'text-[#737373]'
                      }`}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[#171717]">{title}</p>
                      <p className="text-[11px] text-[#737373]">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Cover Image URL + Preview */}
          <div>
            <label htmlFor="evt-image" className="block text-xs font-semibold text-[#171717] mb-1.5">
              Cover image URL <span className="font-normal text-[#737373]">(optional HTTPS URL)</span>
            </label>
            <input
              id="evt-image"
              type="url"
              maxLength={EVENT_IMAGE_URL_MAX}
              value={values.imageUrl}
              onChange={(e) => updateField('imageUrl', e.target.value)}
              placeholder="Leave blank to use the curated category cover image"
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
            {errors.imageUrl && <p className="mt-1 text-xs text-[#DC2626]">{errors.imageUrl}</p>}

            <div className="mt-2.5 overflow-hidden rounded-xl border border-[#E5E7EB] h-32 w-full sm:w-64">
              <EventImage
                key={`${values.imageUrl.trim()}-${values.category}`}
                eventId={initialEvent?.id || 'preview'}
                title={values.title || 'Event cover preview'}
                category={values.category}
                imageUrl={values.imageUrl.trim() || undefined}
                className="h-full w-full"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#171717] hover:bg-[#F3F4F6] disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {!isPublishedEdit && (
              <button
                type="button"
                disabled={isSubmitting || !selectedActiveClub}
                onClick={() => void handleAction('draft')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#171717] hover:bg-[#F3F4F6] disabled:opacity-50 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                <span>{isSubmitting ? 'Saving...' : 'Save as Draft'}</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSubmitting || publishBlockedByClub}
              onClick={() => void handleAction('published')}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : isPublishedEdit
                    ? 'Save Changes'
                    : 'Publish Event'}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
