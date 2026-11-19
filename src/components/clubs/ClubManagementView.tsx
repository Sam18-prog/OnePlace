import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Edit3,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Plus,
  Shield,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { SchoolConfig } from '../../config/school';
import {
  assignClubOrganizer,
  createClub,
  listClubMembers,
  revokeClubOrganizer,
  setClubStatus,
  updateClubAsAdmin,
  updateClubAsOrganizer,
} from '../../services/clubService';
import type {
  Club,
  ClubFormValues,
  ClubMember,
  ClubMemberRole,
  ClubOrganizerEditValues,
} from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import {
  ALL_CLUB_CATEGORIES,
  CLUB_ANNOUNCEMENT_MAX,
  CLUB_DESC_MAX,
  CLUB_NAME_MAX,
  CLUB_SHORT_DESC_MAX,
  countUpcomingClubEvents,
  slugifyClubName,
  validateClubForm,
  validateClubOrganizerEditForm,
  type ClubFormErrors,
} from '../../utils/clubValidation';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ClubManagementViewProps {
  schoolConfig: SchoolConfig;
  currentUid: string;
  isAdmin: boolean;
  clubs: Club[];
  events: SchoolEvent[];
  onViewClubProfile: (club: Club) => void;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

const EMPTY_ADMIN_FORM: ClubFormValues = {
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  category: 'Technology & Computing',
  visibility: 'public',
  isOfficial: true,
  coverImageUrl: '',
  logoUrl: '',
  meetingSchedule: '',
  meetingLocation: '',
  contactEmail: '',
  announcement: '',
};

export function ClubManagementView({
  schoolConfig,
  currentUid,
  isAdmin,
  clubs,
  events,
  onViewClubProfile,
  onShowToast,
}: ClubManagementViewProps) {
  const upcomingCounts = useMemo(() => countUpcomingClubEvents(events), [events]);

  // Create / Edit Club modal state
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [formValues, setFormValues] = useState<ClubFormValues>(EMPTY_ADMIN_FORM);
  const [formErrors, setFormErrors] = useState<ClubFormErrors>({});
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Club Organizers Roster modal state
  const [rosterClub, setRosterClub] = useState<Club | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [orgUid, setOrgUid] = useState('');
  const [orgDisplayName, setOrgDisplayName] = useState('');
  const [orgRole, setOrgRole] = useState<ClubMemberRole>('organizer');
  const [orgRoleTitle, setOrgRoleTitle] = useState('Club Organizer');
  const [savingOrg, setSavingOrg] = useState(false);

  const [busyClubId, setBusyClubId] = useState<string | null>(null);
  const editorModalRef = useRef<HTMLDivElement | null>(null);
  const rosterModalRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    isOpen: Boolean(editorMode),
    containerRef: editorModalRef,
    onClose: () => setEditorMode(null),
    disableEscape: isSubmitting,
  });

  useFocusTrap({
    isOpen: Boolean(isAdmin && rosterClub),
    containerRef: rosterModalRef,
    onClose: () => setRosterClub(null),
    disableEscape: savingOrg,
  });

  const openCreateModal = () => {
    setEditorMode('create');
    setEditingClub(null);
    setSlugTouched(false);
    setFormValues(EMPTY_ADMIN_FORM);
    setFormErrors({});
    setFormSubmitError(null);
  };

  const openEditModal = (club: Club) => {
    setEditorMode('edit');
    setEditingClub(club);
    setSlugTouched(true);
    setFormValues({
      name: club.name,
      slug: club.slug,
      shortDescription: club.shortDescription || '',
      description: club.description,
      category: club.category,
      visibility: club.visibility,
      isOfficial: club.isOfficial,
      coverImageUrl: club.coverImageUrl || '',
      logoUrl: club.logoUrl || '',
      meetingSchedule: club.meetingSchedule || '',
      meetingLocation: club.meetingLocation || '',
      contactEmail: club.contactEmail || '',
      announcement: club.announcement || '',
    });
    setFormErrors({});
    setFormSubmitError(null);
  };

  const loadRoster = useCallback(
    async (club: Club) => {
      setMembersLoading(true);
      try {
        const list = await listClubMembers(schoolConfig.id, club.id);
        setClubMembers(list);
      } catch (err) {
        onShowToast(
          'error',
          toUserFriendlyErrorMessage(err, 'Could not load club organizers.')
        );
      } finally {
        setMembersLoading(false);
      }
    },
    [onShowToast, schoolConfig.id]
  );

  useEffect(() => {
    if (!rosterClub) return;
    void loadRoster(rosterClub);
  }, [rosterClub, loadRoster]);

  const handleSaveClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);

    if (editorMode === 'create' || isAdmin) {
      const normalized = {
        ...formValues,
        slug: editingClub ? editingClub.slug : slugifyClubName(formValues.slug || formValues.name),
      };
      const validation = validateClubForm(normalized);
      if (!validation.valid) {
        setFormErrors(validation.errors);
        return;
      }

      setIsSubmitting(true);
      try {
        if (editorMode === 'create') {
          await createClub({
            schoolId: schoolConfig.id,
            values: normalized,
            adminUid: currentUid,
          });
          onShowToast('success', `Created club "${normalized.name.trim()}".`);
        } else if (editingClub) {
          await updateClubAsAdmin({ existing: editingClub, values: normalized });
          onShowToast('success', `Updated club "${normalized.name.trim()}".`);
        }
        setEditorMode(null);
        setEditingClub(null);
      } catch (err) {
        setFormSubmitError(toUserFriendlyErrorMessage(err, 'Could not save club details.'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Club Organizer limited profile edit
    if (editingClub) {
      const orgValues: ClubOrganizerEditValues = {
        shortDescription: formValues.shortDescription,
        description: formValues.description,
        coverImageUrl: formValues.coverImageUrl,
        logoUrl: formValues.logoUrl,
        meetingSchedule: formValues.meetingSchedule,
        meetingLocation: formValues.meetingLocation,
        contactEmail: formValues.contactEmail,
        announcement: formValues.announcement,
      };
      const validation = validateClubOrganizerEditForm(orgValues);
      if (!validation.valid) {
        setFormErrors(validation.errors);
        return;
      }

      setIsSubmitting(true);
      try {
        await updateClubAsOrganizer({ existing: editingClub, values: orgValues });
        onShowToast('success', `Updated profile details for "${editingClub.name}".`);
        setEditorMode(null);
        setEditingClub(null);
      } catch (err) {
        setFormSubmitError(toUserFriendlyErrorMessage(err, 'Could not update club profile.'));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleToggleClubStatus = async (club: Club) => {
    const nextStatus = club.status === 'active' ? 'suspended' : 'active';
    setBusyClubId(club.id);
    try {
      await setClubStatus(club, nextStatus);
      onShowToast(
        'success',
        nextStatus === 'suspended'
          ? `"${club.name}" suspended and hidden from discovery.`
          : `"${club.name}" reactivated.`
      );
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not update club status.'));
    } finally {
      setBusyClubId(null);
    }
  };

  const handleAssignOrganizer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rosterClub) return;
    const cleanUid = orgUid.trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanUid)) {
      onShowToast('error', 'Enter a valid Firebase UID.');
      return;
    }

    setSavingOrg(true);
    try {
      await assignClubOrganizer({
        schoolId: schoolConfig.id,
        club: rosterClub,
        targetUid: cleanUid,
        displayName: orgDisplayName,
        role: orgRole,
        roleTitle: orgRoleTitle,
        adminUid: currentUid,
      });
      onShowToast('success', `Assigned ${orgDisplayName || cleanUid} to ${rosterClub.name}.`);
      setOrgUid('');
      setOrgDisplayName('');
      await loadRoster(rosterClub);
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not assign organizer.'));
    } finally {
      setSavingOrg(false);
    }
  };

  const handleRevokeOrganizer = async (targetUid: string) => {
    if (!rosterClub) return;
    setSavingOrg(true);
    try {
      await revokeClubOrganizer({
        schoolId: schoolConfig.id,
        club: rosterClub,
        targetUid,
        adminUid: currentUid,
      });
      onShowToast('success', `Revoked club access for ${targetUid}.`);
      await loadRoster(rosterClub);
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not revoke organizer.'));
    } finally {
      setSavingOrg(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[#171717]">
            {isAdmin ? 'School Clubs & Ownership' : 'My Assigned Clubs'}
          </h2>
          <p className="text-xs text-[#737373]">
            {isAdmin
              ? 'Create official clubs, assign club organizers, and moderate club status.'
              : 'Manage profile details, announcements, and view real community metrics for your assigned clubs.'}
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Club</span>
          </button>
        )}
      </section>

      {/* Club Cards List */}
      {clubs.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="font-display text-base font-semibold text-[#171717]">
            {isAdmin ? 'No clubs registered yet' : 'No clubs assigned to your account'}
          </p>
          <p className="mt-1 text-sm text-[#737373] max-w-md mx-auto">
            {isAdmin
              ? 'Create your first student club above or run the Migration & Seed tool under Admin & Roles.'
              : 'Ask your school administrator to assign you as an organizer for a campus club.'}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC2F02] cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Create First Club</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {clubs.map((club) => {
            const clubTotalEvents = events.filter((e) => e.clubId === club.id).length;
            const clubUpcoming = upcomingCounts[club.id] || 0;
            const isBusy = busyClubId === club.id;

            return (
              <div
                key={club.id}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-bold text-[#171717] truncate">
                      {club.name}
                    </h3>
                    {club.isOfficial && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E85D04]">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Official</span>
                      </span>
                    )}
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        club.status === 'active'
                          ? 'bg-[#16A34A]/10 text-[#15803D]'
                          : 'bg-red-50 text-[#DC2626]'
                      }`}
                    >
                      {club.status === 'active' ? 'Active' : 'Suspended'}
                    </span>
                    <span className="font-mono text-[11px] text-[#737373]">{club.category}</span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#737373] line-clamp-1">
                    {club.shortDescription || club.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#525252]">
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Users className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                      {club.followerCount} followers
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <CalendarDays className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                      {clubUpcoming} upcoming · {clubTotalEvents} total events
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onViewClubProfile(club)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                    <span>View Profile</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isAdmin && club.status !== 'active'}
                    onClick={() => openEditModal(club)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                    <span>Edit Details</span>
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRosterClub(club)}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                      >
                        <Shield className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
                        <span>Organizers</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleClubStatus(club)}
                        className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                          club.status === 'active'
                            ? 'border-red-200 bg-red-50 text-[#DC2626] hover:bg-red-100'
                            : 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/20'
                        }`}
                      >
                        {club.status === 'active' ? (
                          <>
                            <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Suspend</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Reactivate</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Club Modal */}
      {editorMode && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#171717]/45 p-0 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="club-editor-title"
          onClick={() => !isSubmitting && setEditorMode(null)}
        >
          <div
            ref={editorModalRef}
            tabIndex={-1}
            className="flex flex-col w-full md:max-w-2xl max-h-[92dvh] md:max-h-[88vh] overflow-hidden rounded-t-2xl md:rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4 bg-white shrink-0">
              <div>
                <p className="font-mono text-[11px] font-medium text-[#E85D04]">
                  {editorMode === 'create'
                    ? 'New Campus Club'
                    : isAdmin
                      ? 'Admin Club Editor'
                      : 'Organizer Club Profile Editor'}
                </p>
                <h3
                  id="club-editor-title"
                  className="font-display text-lg font-extrabold text-[#171717]"
                >
                  {editorMode === 'create' ? 'Create Club' : editingClub?.name}
                </h3>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setEditorMode(null)}
                aria-label="Close club editor"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSaveClub(e)}
              className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4"
            >
              {formSubmitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{formSubmitError}</span>
                </div>
              )}

              {(isAdmin || editorMode === 'create') && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="club-name" className="block text-xs font-semibold text-[#171717] mb-1">
                        Club Name <span className="text-[#DC2626]">*</span>
                      </label>
                      <input
                        id="club-name"
                        type="text"
                        maxLength={CLUB_NAME_MAX}
                        value={formValues.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setFormValues((prev) => ({
                            ...prev,
                            name,
                            slug: slugTouched ? prev.slug : slugifyClubName(name),
                          }));
                        }}
                        placeholder="e.g., Robotics & Makers Club"
                        className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none"
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-xs text-[#DC2626]">{formErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="club-slug" className="block text-xs font-semibold text-[#171717] mb-1">
                        Club ID / Slug
                      </label>
                      <input
                        id="club-slug"
                        type="text"
                        disabled={editorMode === 'edit'}
                        value={formValues.slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setFormValues((prev) => ({ ...prev, slug: e.target.value }));
                        }}
                        className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 font-mono text-xs text-[#171717] disabled:opacity-70"
                      />
                      {formErrors.slug && (
                        <p className="mt-1 text-xs text-[#DC2626]">{formErrors.slug}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="club-category" className="block text-xs font-semibold text-[#171717] mb-1">
                        Category
                      </label>
                      <select
                        id="club-category"
                        value={formValues.category}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            category: e.target.value as ClubFormValues['category'],
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717]"
                      >
                        {ALL_CLUB_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="club-visibility" className="block text-xs font-semibold text-[#171717] mb-1">
                        Visibility
                      </label>
                      <select
                        id="club-visibility"
                        value={formValues.visibility}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            visibility: e.target.value as ClubFormValues['visibility'],
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717]"
                      >
                        <option value="public">Public Campus Directory</option>
                        <option value="school">School Members Only</option>
                      </select>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#171717] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formValues.isOfficial}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, isOfficial: e.target.checked }))
                      }
                      className="h-4 w-4 accent-[#E85D04]"
                    />
                    <span>Mark as Official / Verified School Club</span>
                  </label>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="club-short-desc" className="text-xs font-semibold text-[#171717]">
                    Short Tagline
                  </label>
                  <span className="font-mono text-[11px] text-[#737373]">
                    {formValues.shortDescription.length}/{CLUB_SHORT_DESC_MAX}
                  </span>
                </div>
                <input
                  id="club-short-desc"
                  type="text"
                  maxLength={CLUB_SHORT_DESC_MAX}
                  value={formValues.shortDescription}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, shortDescription: e.target.value }))
                  }
                  placeholder="One-line summary shown on club cards..."
                  className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717]"
                />
                {formErrors.shortDescription && (
                  <p className="mt-1 text-xs text-[#DC2626]">{formErrors.shortDescription}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="club-desc" className="text-xs font-semibold text-[#171717]">
                    About &amp; Mission <span className="text-[#DC2626]">*</span>
                  </label>
                  <span className="font-mono text-[11px] text-[#737373]">
                    {formValues.description.length}/{CLUB_DESC_MAX}
                  </span>
                </div>
                <textarea
                  id="club-desc"
                  rows={4}
                  maxLength={CLUB_DESC_MAX}
                  value={formValues.description}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe what your club builds, discusses, and how students can participate..."
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm text-[#171717]"
                />
                {formErrors.description && (
                  <p className="mt-1 text-xs text-[#DC2626]">{formErrors.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="club-schedule" className="block text-xs font-semibold text-[#171717] mb-1">
                    Meeting Schedule
                  </label>
                  <input
                    id="club-schedule"
                    type="text"
                    value={formValues.meetingSchedule}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, meetingSchedule: e.target.value }))
                    }
                    placeholder="Tuesdays · 3:30 PM"
                    className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717]"
                  />
                </div>
                <div>
                  <label htmlFor="club-location" className="block text-xs font-semibold text-[#171717] mb-1">
                    Meeting Location
                  </label>
                  <input
                    id="club-location"
                    type="text"
                    value={formValues.meetingLocation}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, meetingLocation: e.target.value }))
                    }
                    placeholder="Engineering Lab 104"
                    className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717]"
                  />
                </div>
                <div>
                  <label htmlFor="club-email" className="block text-xs font-semibold text-[#171717] mb-1">
                    Public Contact Email
                  </label>
                  <input
                    id="club-email"
                    type="email"
                    value={formValues.contactEmail}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, contactEmail: e.target.value }))
                    }
                    placeholder="club@oakridge.edu"
                    className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717]"
                  />
                  {formErrors.contactEmail && (
                    <p className="mt-1 text-xs text-[#DC2626]">{formErrors.contactEmail}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="club-cover-url" className="block text-xs font-semibold text-[#171717] mb-1">
                    Cover Image URL (optional HTTPS)
                  </label>
                  <input
                    id="club-cover-url"
                    type="url"
                    value={formValues.coverImageUrl}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, coverImageUrl: e.target.value }))
                    }
                    placeholder="Leave blank for category cover"
                    className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717]"
                  />
                  {formErrors.coverImageUrl && (
                    <p className="mt-1 text-xs text-[#DC2626]">{formErrors.coverImageUrl}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="club-logo-url" className="block text-xs font-semibold text-[#171717] mb-1">
                    Logo Image URL (optional HTTPS)
                  </label>
                  <input
                    id="club-logo-url"
                    type="url"
                    value={formValues.logoUrl}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, logoUrl: e.target.value }))
                    }
                    placeholder="Leave blank for club monogram"
                    className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717]"
                  />
                  {formErrors.logoUrl && (
                    <p className="mt-1 text-xs text-[#DC2626]">{formErrors.logoUrl}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="club-announcement" className="text-xs font-semibold text-[#171717]">
                    Pinned Community Update (optional)
                  </label>
                  <span className="font-mono text-[11px] text-[#737373]">
                    {formValues.announcement.length}/{CLUB_ANNOUNCEMENT_MAX}
                  </span>
                </div>
                <input
                  id="club-announcement"
                  type="text"
                  maxLength={CLUB_ANNOUNCEMENT_MAX}
                  value={formValues.announcement}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, announcement: e.target.value }))
                  }
                  placeholder="Share a quick club update or recruiting notice..."
                  className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717]"
                />
              </div>

              <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditorMode(null)}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#E85D04] px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editorMode === 'create'
                      ? 'Create Club'
                      : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Club Organizers Roster Modal */}
      {isAdmin && rosterClub && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#171717]/45 p-0 md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="club-roster-title"
          onClick={() => !savingOrg && setRosterClub(null)}
        >
          <div
            ref={rosterModalRef}
            tabIndex={-1}
            className="flex flex-col w-full md:max-w-xl max-h-[90dvh] overflow-hidden rounded-t-2xl md:rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <p className="font-mono text-[11px] font-medium text-[#E85D04]">
                  Club Organizer Assignment
                </p>
                <h3
                  id="club-roster-title"
                  className="font-display text-lg font-extrabold text-[#171717]"
                >
                  {rosterClub.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRosterClub(null)}
                aria-label="Close organizer roster"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <form onSubmit={(e) => void handleAssignOrganizer(e)} className="space-y-3">
                <p className="text-xs text-[#737373]">
                  Assign a verified user&apos;s Firebase UID (found in their Profile tab) to edit this club and publish events under it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="club-org-uid" className="block text-[11px] font-semibold text-[#171717] mb-1">
                      Firebase UID <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      id="club-org-uid"
                      type="text"
                      value={orgUid}
                      onChange={(e) => setOrgUid(e.target.value)}
                      placeholder="Paste student UID..."
                      className="h-9 w-full rounded-xl border border-[#E5E7EB] px-3 text-xs text-[#171717]"
                    />
                  </div>
                  <div>
                    <label htmlFor="club-org-name" className="block text-[11px] font-semibold text-[#171717] mb-1">
                      Public Display Name
                    </label>
                    <input
                      id="club-org-name"
                      type="text"
                      value={orgDisplayName}
                      onChange={(e) => setOrgDisplayName(e.target.value)}
                      placeholder="e.g., Maya Patel"
                      className="h-9 w-full rounded-xl border border-[#E5E7EB] px-3 text-xs text-[#171717]"
                    />
                  </div>
                  <div>
                    <label htmlFor="club-org-role" className="block text-[11px] font-semibold text-[#171717] mb-1">
                      Permission Level
                    </label>
                    <select
                      id="club-org-role"
                      value={orgRole}
                      onChange={(e) => setOrgRole(e.target.value as ClubMemberRole)}
                      className="h-9 w-full rounded-xl border border-[#E5E7EB] px-3 text-xs text-[#171717]"
                    >
                      <option value="organizer">Organizer</option>
                      <option value="lead">Club Lead</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="club-org-title" className="block text-[11px] font-semibold text-[#171717] mb-1">
                      Public Role Title
                    </label>
                    <input
                      id="club-org-title"
                      type="text"
                      value={orgRoleTitle}
                      onChange={(e) => setOrgRoleTitle(e.target.value)}
                      placeholder="Club President"
                      className="h-9 w-full rounded-xl border border-[#E5E7EB] px-3 text-xs text-[#171717]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingOrg}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{savingOrg ? 'Assigning...' : 'Assign Club Organizer'}</span>
                </button>
              </form>

              <div className="border-t border-[#E5E7EB] pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-2.5">
                  Assigned Organizers
                </h4>
                {membersLoading ? (
                  <p className="text-xs text-[#737373]">Loading organizers...</p>
                ) : clubMembers.length === 0 ? (
                  <p className="text-xs text-[#737373]">No club-specific organizers assigned yet.</p>
                ) : (
                  <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]/50">
                    {clubMembers.map((m) => (
                      <div
                        key={m.uid}
                        className="flex items-center justify-between gap-2 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#171717] truncate">
                              {m.displayName || m.uid}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                m.status === 'active'
                                  ? 'bg-[#16A34A]/10 text-[#15803D]'
                                  : 'bg-red-50 text-[#DC2626]'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-[#737373] truncate">
                            {m.roleTitle || m.role} · {m.uid}
                          </p>
                        </div>
                        {m.status === 'active' && (
                          <button
                            type="button"
                            disabled={savingOrg}
                            onClick={() => void handleRevokeOrganizer(m.uid)}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#DC2626] hover:bg-red-50 cursor-pointer shrink-0"
                          >
                            <UserMinus className="h-3 w-3" aria-hidden="true" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
