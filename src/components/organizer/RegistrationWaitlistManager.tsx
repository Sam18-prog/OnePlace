import { useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  Check,
  Clock,
  Info,
  Lock,
  RefreshCw,
  Save,
  Unlock,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  organizerApproveOrPromoteRegistration,
  organizerCancelRegistration,
  organizerSetWaitlistOfferExpiry,
} from '../../services/eventOperationsService';
import { updateEventRegistrationControls } from '../../services/eventService';
import type { SchoolEvent } from '../../types/event';
import type { EventRegistrationRecord } from '../../types/eventOperations';
import { formatEventDateTime } from '../../utils/events';
import {
  getEventCapacitySnapshot,
  isWaitlistOfferExpired,
  selectNextWaitlistPromotionCandidate,
  sortWaitlistQueue,
  validateRegistrationConfigUpdate,
} from '../../utils/eventRegistration';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';

type RosterFilter = 'confirmed' | 'pending_approval' | 'waitlisted' | 'cancelled';

interface RegistrationWaitlistManagerProps {
  event: SchoolEvent;
  organizerUid: string;
  registrations: EventRegistrationRecord[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

export function RegistrationWaitlistManager({
  event,
  organizerUid,
  registrations,
  loading,
  onRefresh,
  onShowToast,
}: RegistrationWaitlistManagerProps) {
  const [activeFilter, setActiveFilter] = useState<RosterFilter>('confirmed');
  const [capacityDraft, setCapacityDraft] = useState<string>(
    event.capacityLimit ? String(event.capacityLimit) : ''
  );
  const [allowWaitlistDraft, setAllowWaitlistDraft] = useState<boolean>(
    Boolean(event.allowWaitlist)
  );
  const [requireApprovalDraft, setRequireApprovalDraft] = useState<boolean>(
    Boolean(event.requireApproval)
  );
  const [savingControls, setSavingControls] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [promotingNext, setPromotingNext] = useState(false);

  const capacity = getEventCapacitySnapshot(event);
  const isRegistrationClosed = event.registrationStatus === 'closed';
  const isCancelledEvent = event.status === 'cancelled';

  const grouped = useMemo(() => {
    const confirmed = registrations.filter((r) => r.status === 'confirmed');
    const pending = registrations.filter((r) => r.status === 'pending_approval');
    const waitlisted = sortWaitlistQueue(registrations);
    const cancelled = registrations.filter((r) => r.status === 'cancelled');
    return { confirmed, pending, waitlisted, cancelled };
  }, [registrations]);

  const nextCandidate = useMemo(
    () => selectNextWaitlistPromotionCandidate(registrations),
    [registrations]
  );

  const visibleList =
    activeFilter === 'confirmed'
      ? grouped.confirmed
      : activeFilter === 'pending_approval'
        ? grouped.pending
        : activeFilter === 'waitlisted'
          ? grouped.waitlisted
          : grouped.cancelled;

  const handleSaveCapacityControls = async () => {
    const trimmed = capacityDraft.trim();
    const parsedLimit = trimmed === '' ? null : Number(trimmed);

    const check = validateRegistrationConfigUpdate({
      capacityLimit: parsedLimit,
      currentConfirmedCount: capacity.confirmedCount,
      registrationOpensAt: event.registrationOpensAt ?? null,
      registrationClosesAt: event.registrationClosesAt ?? null,
      eventEndAt: event.endAt,
    });

    if (!check.valid) {
      onShowToast('error', check.error || 'Invalid capacity settings.');
      return;
    }

    setSavingControls(true);
    try {
      await updateEventRegistrationControls({
        event,
        capacityLimit: parsedLimit,
        allowWaitlist: allowWaitlistDraft,
        requireApproval: requireApprovalDraft,
      });
      onShowToast('success', 'Registration & capacity settings updated.');
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not update capacity settings.'));
    } finally {
      setSavingControls(false);
    }
  };

  const handleToggleRegistrationOpen = async () => {
    if (isCancelledEvent) return;
    setSavingControls(true);
    try {
      const nextStatus = isRegistrationClosed ? 'open' : 'closed';
      await updateEventRegistrationControls({
        event,
        registrationStatus: nextStatus,
      });
      onShowToast(
        'success',
        nextStatus === 'closed'
          ? 'Registration closed for this event.'
          : 'Registration reopened for this event.'
      );
    } catch (err) {
      onShowToast(
        'error',
        toUserFriendlyErrorMessage(err, 'Could not update registration status.')
      );
    } finally {
      setSavingControls(false);
    }
  };

  const handleApproveOrPromote = async (record: EventRegistrationRecord) => {
    setBusyUid(record.uid);
    try {
      await organizerApproveOrPromoteRegistration({
        eventId: event.id,
        targetUid: record.uid,
        organizerUid,
      });
      onShowToast(
        'success',
        record.status === 'waitlisted'
          ? `Promoted ${record.displayName || 'student'} from waitlist to confirmed.`
          : `Approved ${record.displayName || 'student'}.`
      );
      await onRefresh();
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not confirm registration.'));
    } finally {
      setBusyUid(null);
    }
  };

  const handlePromoteNextWaitlist = async () => {
    if (!nextCandidate) return;
    setPromotingNext(true);
    try {
      await organizerApproveOrPromoteRegistration({
        eventId: event.id,
        targetUid: nextCandidate.uid,
        organizerUid,
      });
      onShowToast(
        'success',
        `Promoted #1 waitlist candidate (${nextCandidate.displayName || nextCandidate.uid.slice(0, 8)}).`
      );
      await onRefresh();
    } catch (err) {
      onShowToast(
        'error',
        toUserFriendlyErrorMessage(err, 'Could not promote next waitlisted student.')
      );
    } finally {
      setPromotingNext(false);
    }
  };

  const handleSetOfferExpiry = async (record: EventRegistrationRecord) => {
    setBusyUid(record.uid);
    try {
      await organizerSetWaitlistOfferExpiry({
        eventId: event.id,
        targetUid: record.uid,
        hoursFromNow: 24,
      });
      onShowToast('success', 'Set a 24-hour waitlist offer window.');
      await onRefresh();
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not set waitlist offer window.'));
    } finally {
      setBusyUid(null);
    }
  };

  const handleCancelStudent = async (record: EventRegistrationRecord) => {
    setBusyUid(record.uid);
    try {
      await organizerCancelRegistration({
        eventId: event.id,
        targetUid: record.uid,
      });
      onShowToast('success', `Cancelled registration for ${record.displayName || 'student'}.`);
      await onRefresh();
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not cancel registration.'));
    } finally {
      setBusyUid(null);
    }
  };

  const filterTabs: { id: RosterFilter; label: string; count: number }[] = [
    { id: 'confirmed', label: 'Confirmed', count: grouped.confirmed.length },
    { id: 'pending_approval', label: 'Pending Approval', count: grouped.pending.length },
    { id: 'waitlisted', label: 'Waitlist (FIFO)', count: grouped.waitlisted.length },
    { id: 'cancelled', label: 'Cancelled', count: grouped.cancelled.length },
  ];

  return (
    <div className="space-y-6">
      {/* Registration Controls Strip */}
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-bold text-[#171717]">
              Capacity &amp; Registration Controls
            </h3>
            <p className="text-xs text-[#737373]">
              Confirmed:{' '}
              <span className="font-mono tabular-nums font-semibold text-[#171717]">
                {capacity.confirmedCount}
                {capacity.capacityLimit !== null ? ` / ${capacity.capacityLimit}` : ' (unlimited)'}
              </span>
              {capacity.waitlistCount > 0 ? ` · ${capacity.waitlistCount} waitlisted` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isCancelledEvent && (
              <button
                type="button"
                disabled={savingControls}
                onClick={() => void handleToggleRegistrationOpen()}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                  isRegistrationClosed
                    ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/15'
                    : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {isRegistrationClosed ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reopen Registration</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Close Registration</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F3F4F6] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3 items-end pt-3 border-t border-[#E5E7EB]">
          <div>
            <label
              htmlFor={`cap-limit-${event.id}`}
              className="block text-[11px] font-semibold text-[#525252] mb-1"
            >
              Capacity Limit (blank = open)
            </label>
            <input
              id={`cap-limit-${event.id}`}
              type="number"
              min={Math.max(1, capacity.confirmedCount)}
              max={100000}
              value={capacityDraft}
              onChange={(e) => setCapacityDraft(e.target.value)}
              placeholder="Unlimited"
              className="w-full min-h-[38px] rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 font-mono text-xs text-[#171717] focus:border-[#E85D04] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 py-1.5 text-xs text-[#171717]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowWaitlistDraft}
                onChange={(e) => setAllowWaitlistDraft(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB] text-[#E85D04] focus:ring-[#E85D04]"
              />
              <span>Allow waitlist when full</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requireApprovalDraft}
                onChange={(e) => setRequireApprovalDraft(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB] text-[#E85D04] focus:ring-[#E85D04]"
              />
              <span>Require organizer approval</span>
            </label>
          </div>

          <button
            type="button"
            disabled={savingControls}
            onClick={() => void handleSaveCapacityControls()}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#171717] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#333333] disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{savingControls ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Starter Tier Waitlist Automation Notice */}
      {grouped.waitlisted.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">
                {grouped.waitlisted.length}{' '}
                {grouped.waitlisted.length === 1 ? 'student is' : 'students are'} waiting in FIFO
                queue order.
              </p>
              <p className="mt-0.5 text-amber-800">
                Automatic background promotion on cancellation requires Blaze Cloud Functions. Promote the next eligible student directly below when spots open.
              </p>
            </div>
          </div>

          {nextCandidate && !capacity.isFull && !isCancelledEvent && (
            <button
              type="button"
              disabled={promotingNext}
              onClick={() => void handlePromoteNextWaitlist()}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#333333] disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{promotingNext ? 'Promoting...' : 'Promote Next in Queue'}</span>
            </button>
          )}
        </div>
      )}

      {/* Segmented Status Filter */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-[#E5E7EB] pb-3"
        role="tablist"
        aria-label="Registration status filter"
      >
        {filterTabs.map((tab) => {
          const active = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveFilter(tab.id)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#171717] text-white'
                  : 'border border-[#E5E7EB] bg-white text-[#525252] hover:text-[#171717]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  active ? 'text-white/80' : 'text-[#737373]'
                }`}
              >
                ({tab.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Registration Rows */}
      {loading ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-xs text-[#737373]">
          Loading event registrations...
        </div>
      ) : visibleList.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center space-y-1">
          <Users className="mx-auto h-5 w-5 text-[#A3A3A3]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#171717]">
            No {activeFilter.replace('_', ' ')} registrations
          </p>
          {activeFilter === 'confirmed' && event.rsvpCount > 0 && (
            <p className="text-xs text-[#737373]">
              This event has {event.rsvpCount} legacy RSVP(s) recorded before Phase 8 registrations were introduced.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          {visibleList.map((reg, index) => {
            const isBusy = busyUid === reg.uid;
            const offerExpired = isWaitlistOfferExpired(reg);
            const label = reg.displayName || `Student (${reg.uid.slice(0, 8)})`;

            return (
              <div
                key={reg.uid}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFilter === 'waitlisted' && (
                      <span className="font-mono tabular-nums text-[11px] font-bold text-[#E85D04]">
                        #{index + 1}
                      </span>
                    )}
                    <span className="font-semibold text-[#171717] truncate">{label}</span>
                    <span className="font-mono text-[11px] text-[#737373]">
                      {reg.uid.slice(0, 10)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#737373]">
                    Registered{' '}
                    <span className="font-mono text-[#525252]">
                      {formatEventDateTime(reg.registeredAt, new Date(), event.timezone)}
                    </span>
                    {reg.waitlistTimestamp && reg.status === 'waitlisted' && (
                      <>
                        {' · '}Queued{' '}
                        <span className="font-mono text-[#525252]">
                          {formatEventDateTime(reg.waitlistTimestamp, new Date(), event.timezone)}
                        </span>
                      </>
                    )}
                    {reg.offerExpiresAt && reg.status === 'waitlisted' && (
                      <>
                        {' · '}
                        <span className={offerExpired ? 'text-[#DC2626] font-semibold' : 'text-amber-700'}>
                          {offerExpired ? 'Offer expired' : 'Offer until'}{' '}
                          {formatEventDateTime(reg.offerExpiresAt, new Date(), event.timezone)}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(reg.status === 'pending_approval' || reg.status === 'waitlisted') &&
                    !isCancelledEvent && (
                      <button
                        type="button"
                        disabled={isBusy || capacity.isFull}
                        title={
                          capacity.isFull
                            ? 'Increase capacity or cancel a confirmed spot before confirming.'
                            : undefined
                        }
                        onClick={() => void handleApproveOrPromote(reg)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D] disabled:opacity-50 cursor-pointer"
                      >
                        {reg.status === 'waitlisted' ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Promote</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Approve</span>
                          </>
                        )}
                      </button>
                    )}

                  {reg.status === 'waitlisted' && !isCancelledEvent && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleSetOfferExpiry(reg)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
                    >
                      <Clock className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                      <span>24h Offer</span>
                    </button>
                  )}

                  {reg.status !== 'cancelled' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleCancelStudent(reg)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
