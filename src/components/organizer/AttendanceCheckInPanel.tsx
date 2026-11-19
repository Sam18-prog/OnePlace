import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { organizerSetAttendanceStatus } from '../../services/eventOperationsService';
import type { SchoolEvent } from '../../types/event';
import type {
  AttendanceStatus,
  EventAttendanceRecord,
  EventRegistrationRecord,
} from '../../types/eventOperations';
import { formatEventDateTime } from '../../utils/events';
import {
  computeAttendanceSummary,
  evaluateOrganizerCheckInAction,
} from '../../utils/eventOperations';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';

type CheckInFilter = 'all' | 'pending' | 'checked_in';

interface AttendanceCheckInPanelProps {
  event: SchoolEvent;
  organizerUid: string;
  registrations: EventRegistrationRecord[];
  attendance: EventAttendanceRecord[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

export function AttendanceCheckInPanel({
  event,
  organizerUid,
  registrations,
  attendance,
  loading,
  onRefresh,
  onShowToast,
}: AttendanceCheckInPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<CheckInFilter>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [editingCorrectionUid, setEditingCorrectionUid] = useState<string | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');

  const summary = useMemo(
    () =>
      computeAttendanceSummary({
        registrations,
        attendance,
        fallbackConfirmedCount: event.rsvpCount,
        fallbackCheckedInCount: event.checkedInCount ?? 0,
      }),
    [attendance, event.checkedInCount, event.rsvpCount, registrations]
  );

  const attendanceByUid = useMemo(() => {
    const map = new Map<string, EventAttendanceRecord>();
    for (const rec of attendance) {
      map.set(rec.uid, rec);
    }
    return map;
  }, [attendance]);

  const confirmedRows = useMemo(() => {
    const confirmed = registrations.filter((r) => r.status === 'confirmed');
    const q = searchQuery.trim().toLowerCase();

    return confirmed
      .filter((reg) => {
        const att = attendanceByUid.get(reg.uid);
        const isCheckedIn = att?.status === 'checked_in';
        if (filter === 'pending' && isCheckedIn) return false;
        if (filter === 'checked_in' && !isCheckedIn) return false;
        if (!q) return true;
        return (
          (reg.displayName || '').toLowerCase().includes(q) ||
          reg.uid.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aChecked = attendanceByUid.get(a.uid)?.status === 'checked_in' ? 1 : 0;
        const bChecked = attendanceByUid.get(b.uid)?.status === 'checked_in' ? 1 : 0;
        if (aChecked !== bChecked) return aChecked - bChecked;
        return (a.displayName || a.uid).localeCompare(b.displayName || b.uid);
      });
  }, [attendanceByUid, filter, registrations, searchQuery]);

  const handleSetAttendance = async (
    reg: EventRegistrationRecord,
    nextStatus: AttendanceStatus,
    note?: string
  ) => {
    const existing = attendanceByUid.get(reg.uid) ?? null;
    const evaluation = evaluateOrganizerCheckInAction({
      isAuthorizedOrganizer: true,
      eventStatus: event.status,
      targetRegistrationStatus: reg.status,
      existingAttendance: existing,
      nextStatus,
    });

    if (!evaluation.allowed) {
      onShowToast('error', evaluation.reason || 'Attendance action not allowed.');
      return;
    }

    setBusyUid(reg.uid);
    try {
      const result = await organizerSetAttendanceStatus({
        eventId: event.id,
        schoolId: event.schoolId,
        targetUid: reg.uid,
        organizerUid,
        nextStatus,
        method: 'manual',
        correctionNote: note,
      });

      if (result.alreadyInTargetState) {
        onShowToast('error', `${reg.displayName || 'Attendee'} is already in that attendance state.`);
      } else if (nextStatus === 'checked_in') {
        onShowToast('success', `Checked in ${reg.displayName || 'attendee'}.`);
      } else {
        onShowToast(
          'success',
          `Updated attendance for ${reg.displayName || 'attendee'} to ${nextStatus.replace('_', ' ')}.`
        );
      }
      setEditingCorrectionUid(null);
      setCorrectionNote('');
      await onRefresh();
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not update attendance record.'));
    } finally {
      setBusyUid(null);
    }
  };

  const canCheckInEvent = event.status === 'published';

  return (
    <div className="space-y-6">
      {/* Attendance Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white">
        <div className="p-4">
          <p className="text-[11px] font-medium text-[#737373]">Confirmed</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#171717]">
            {summary.confirmedCount}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-medium text-[#737373]">Checked In</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#15803D]">
            {summary.checkedInCount}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-medium text-[#737373]">Not Checked In</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#171717]">
            {summary.notYetCheckedInCount}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-medium text-[#737373]">Cancelled</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#737373]">
            {summary.cancelledCount}
          </p>
        </div>
        <div className="p-4 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium text-[#737373]">Attendance Rate</p>
          <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#E85D04]">
            {summary.attendanceRatePercent !== null ? `${summary.attendanceRatePercent}%` : '—'}
          </p>
        </div>
      </div>

      {/* Honest Starter Tier QR Check-In Disclosure */}
      <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3.5 text-xs text-[#525252]">
        <QrCode className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-[#171717]">
            Starter Tier Check-In Mode: Authorized Roster Check-In Active
          </p>
          <p className="leading-relaxed">
            Cryptographically signed QR pass scanning is disabled on Starter Tier because secure token signing and server-side verification require Firebase Cloud Functions (Blaze). OnePlace intentionally refuses to mint predictable client-side QR codes (such as raw event or user IDs). Use the mobile-friendly roster below for fast, duplicate-safe entrance check-in.
          </p>
        </div>
      </div>

      {!canCheckInEvent && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span>Attendance check-in is only enabled for published events.</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search confirmed attendees by name..."
            aria-label="Search confirmed attendees"
            className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-3 py-2 text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Awaiting Check-In' },
              { id: 'checked_in', label: 'Checked In' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`inline-flex min-h-[40px] items-center rounded-xl px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                filter === item.id
                  ? 'bg-[#171717] text-white'
                  : 'border border-[#E5E7EB] bg-white text-[#525252] hover:text-[#171717]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={() => void onRefresh()}
            aria-label="Refresh attendance roster"
            className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#525252] hover:text-[#171717] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile-Friendly Large Touch Check-In Roster */}
      {loading ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-xs text-[#737373]">
          Loading check-in roster...
        </div>
      ) : confirmedRows.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center space-y-1">
          <UserCheck className="mx-auto h-5 w-5 text-[#A3A3A3]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#171717]">
            {searchQuery.trim()
              ? 'No matching attendees found'
              : filter === 'checked_in'
                ? 'No attendees checked in yet'
                : 'No confirmed Phase 8 registrations to check in'}
          </p>
          {event.rsvpCount > 0 && registrations.length === 0 && (
            <p className="text-xs text-[#737373]">
              Students who RSVP'd before Phase 8 can re-confirm or register on the updated flow to appear in the check-in roster.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          {confirmedRows.map((reg) => {
            const att = attendanceByUid.get(reg.uid);
            const isCheckedIn = att?.status === 'checked_in';
            const isExcused = att?.status === 'excused';
            const isBusy = busyUid === reg.uid;
            const isEditingNote = editingCorrectionUid === reg.uid;
            const label = reg.displayName || `Student (${reg.uid.slice(0, 8)})`;

            return (
              <div key={reg.uid} className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-[#171717] truncate">
                        {label}
                      </span>
                      {isCheckedIn && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#16A34A]/30 bg-[#16A34A]/10 px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>Checked In</span>
                        </span>
                      )}
                      {isExcused && (
                        <span className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-semibold text-[#525252]">
                          Excused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#737373]">
                      {isCheckedIn && att?.checkedInAt
                        ? `Checked in ${formatEventDateTime(att.checkedInAt, new Date(), event.timezone)}`
                        : `Confirmed ${formatEventDateTime(reg.registeredAt, new Date(), event.timezone)}`}
                      {att?.correctionNote ? ` · Note: ${att.correctionNote}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isCheckedIn ? (
                      <button
                        type="button"
                        disabled={!canCheckInEvent || isBusy}
                        onClick={() => void handleSetAttendance(reg, 'checked_in')}
                        className="inline-flex min-h-[46px] min-w-[136px] items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        <UserCheck className="h-4 w-4" aria-hidden="true" />
                        <span>{isBusy ? 'Checking In...' : 'Check In'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canCheckInEvent || isBusy}
                        onClick={() => {
                          setEditingCorrectionUid(isEditingNote ? null : reg.uid);
                          setCorrectionNote('');
                        }}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#525252] hover:bg-[#F8F9FA] hover:text-[#171717] disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Correct / Undo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Authorized Correction Drawer */}
                {isEditingNote && (
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 space-y-3">
                    <p className="text-xs font-semibold text-[#171717]">
                      Apply Authorized Attendance Correction
                    </p>
                    <input
                      type="text"
                      maxLength={240}
                      value={correctionNote}
                      onChange={(e) => setCorrectionNote(e.target.value)}
                      placeholder="Optional note (e.g., checked in by mistake, excused absence)"
                      className="w-full min-h-[38px] rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleSetAttendance(reg, 'not_checked_in', correctionNote)
                        }
                        className="inline-flex min-h-[34px] items-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-red-50 cursor-pointer"
                      >
                        Mark Not Checked In
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleSetAttendance(reg, 'excused', correctionNote)}
                        className="inline-flex min-h-[34px] items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F3F4F6] cursor-pointer"
                      >
                        Mark Excused
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCorrectionUid(null);
                          setCorrectionNote('');
                        }}
                        className="inline-flex min-h-[34px] items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
