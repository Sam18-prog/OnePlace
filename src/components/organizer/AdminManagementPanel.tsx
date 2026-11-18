import { useCallback, useEffect, useState } from 'react';
import {
  DatabaseZap,
  Globe,
  RefreshCw,
  Shield,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { SUPPORTED_TIMEZONES, type SchoolConfig } from '../../config/school';
import {
  inspectMigrationState,
  runControlledMigration,
  type MigrationReport,
} from '../../services/eventService';
import {
  listSchoolMembers,
  saveSchoolConfig,
  upsertSchoolMember,
} from '../../services/membershipService';
import type { MemberRole, MemberStatus, SchoolMembership } from '../../types/membership';

interface AdminManagementPanelProps {
  schoolConfig: SchoolConfig;
  currentAdminUid: string;
  onSchoolConfigUpdated: () => Promise<void>;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

export function AdminManagementPanel({
  schoolConfig,
  currentAdminUid,
  onSchoolConfigUpdated,
  onShowToast,
}: AdminManagementPanelProps) {
  const [members, setMembers] = useState<SchoolMembership[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  const [memberUid, setMemberUid] = useState('');
  const [memberDisplayName, setMemberDisplayName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<MemberRole>('organizer');
  const [memberStatus, setMemberStatus] = useState<MemberStatus>('active');
  const [savingMember, setSavingMember] = useState(false);

  const [schoolName, setSchoolName] = useState(schoolConfig.name);
  const [schoolTimezone, setSchoolTimezone] = useState(schoolConfig.timezone);
  const [allowPublicDiscovery, setAllowPublicDiscovery] = useState(schoolConfig.allowPublicDiscovery);
  const [savingSchool, setSavingSchool] = useState(false);

  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [inspectingMigration, setInspectingMigration] = useState(false);
  const [runningMigration, setRunningMigration] = useState(false);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const list = await listSchoolMembers(schoolConfig.id);
      setMembers(list);
    } catch (err) {
      onShowToast(
        'error',
        err instanceof Error ? err.message : 'Could not load school members list.'
      );
    } finally {
      setMembersLoading(false);
    }
  }, [onShowToast, schoolConfig.id]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setSchoolName(schoolConfig.name);
    setSchoolTimezone(schoolConfig.timezone);
    setAllowPublicDiscovery(schoolConfig.allowPublicDiscovery);
  }, [schoolConfig]);

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUid = memberUid.trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(cleanUid)) {
      onShowToast('error', 'Enter a valid Firebase UID (letters, numbers, _ or -).');
      return;
    }

    setSavingMember(true);
    try {
      await upsertSchoolMember(
        schoolConfig.id,
        {
          uid: cleanUid,
          role: memberRole,
          status: memberStatus,
          displayName: memberDisplayName,
          email: memberEmail,
        },
        currentAdminUid
      );
      onShowToast('success', `Updated ${cleanUid} (${memberRole} · ${memberStatus}).`);
      setMemberUid('');
      setMemberDisplayName('');
      setMemberEmail('');
      await loadMembers();
    } catch (err) {
      onShowToast('error', err instanceof Error ? err.message : 'Failed to update member role.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (schoolName.trim().length < 2) {
      onShowToast('error', 'School name must be at least 2 characters.');
      return;
    }
    setSavingSchool(true);
    try {
      await saveSchoolConfig(
        schoolConfig.id,
        {
          name: schoolName.trim(),
          timezone: schoolTimezone,
          allowPublicDiscovery,
        },
        currentAdminUid
      );
      await onSchoolConfigUpdated();
      onShowToast('success', 'School configuration saved.');
    } catch (err) {
      onShowToast('error', err instanceof Error ? err.message : 'Could not save school settings.');
    } finally {
      setSavingSchool(false);
    }
  };

  const handleInspectMigration = async () => {
    setInspectingMigration(true);
    try {
      const report = await inspectMigrationState(
        schoolConfig.id,
        schoolConfig.timezone,
        currentAdminUid
      );
      setMigrationReport(report);
    } catch (err) {
      onShowToast('error', err instanceof Error ? err.message : 'Could not inspect events.');
    } finally {
      setInspectingMigration(false);
    }
  };

  const handleRunMigration = async () => {
    setRunningMigration(true);
    try {
      const result = await runControlledMigration(
        schoolConfig.id,
        schoolConfig.timezone,
        currentAdminUid
      );
      onShowToast(
        'success',
        `Migration complete: ${result.migratedLegacy} legacy upgraded, ${result.seededDemo} demo events imported.`
      );
      const updated = await inspectMigrationState(
        schoolConfig.id,
        schoolConfig.timezone,
        currentAdminUid
      );
      setMigrationReport(updated);
    } catch (err) {
      onShowToast('error', err instanceof Error ? err.message : 'Migration failed.');
    } finally {
      setRunningMigration(false);
    }
  };

  const populateForm = (member: SchoolMembership) => {
    setMemberUid(member.uid);
    setMemberDisplayName(member.displayName || '');
    setMemberEmail(member.email || '');
    setMemberRole(member.role);
    setMemberStatus(member.status);
  };

  return (
    <div className="space-y-6">
      {/* 1. Role & Membership Management */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-[#171717] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
              <span>Club Organizer & Member Roles</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#737373]">
              Assign or revoke organizer and admin permissions by student Firebase UID (shown in each user&apos;s Profile tab).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadMembers()}
            disabled={membersLoading}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer self-start"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${membersLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Reload list</span>
          </button>
        </div>

        <form onSubmit={(e) => void handleSaveMember(e)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <label htmlFor="admin-member-uid" className="block text-[11px] font-semibold text-[#171717] mb-1">
              Firebase User UID <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="admin-member-uid"
              type="text"
              value={memberUid}
              onChange={(e) => setMemberUid(e.target.value)}
              placeholder="Paste Firebase UID..."
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
          </div>

          <div>
            <label htmlFor="admin-member-name" className="block text-[11px] font-semibold text-[#171717] mb-1">
              Display name (optional)
            </label>
            <input
              id="admin-member-name"
              type="text"
              value={memberDisplayName}
              onChange={(e) => setMemberDisplayName(e.target.value)}
              placeholder="e.g., Maya Patel"
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
          </div>

          <div>
            <label htmlFor="admin-member-role" className="block text-[11px] font-semibold text-[#171717] mb-1">
              Role
            </label>
            <select
              id="admin-member-role"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as MemberRole)}
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            >
              <option value="student">Student</option>
              <option value="organizer">Organizer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="admin-member-status" className="block text-[11px] font-semibold text-[#171717] mb-1">
              Status
            </label>
            <select
              id="admin-member-status"
              value={memberStatus}
              onChange={(e) => setMemberStatus(e.target.value as MemberStatus)}
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="admin-member-email" className="block text-[11px] font-semibold text-[#171717] mb-1">
              School Email (optional reference)
            </label>
            <input
              id="admin-member-email"
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="student@oakridge.edu"
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs sm:text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
          </div>

          <button
            type="submit"
            disabled={savingMember}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#E85D04] px-4 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>{savingMember ? 'Saving...' : 'Save Role'}</span>
          </button>
        </form>

        <div className="border-t border-[#E5E7EB] pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373] mb-3">
            Assigned Members ({members.length})
          </h3>
          {membersLoading ? (
            <p className="text-xs text-[#737373]">Loading school membership directory...</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-[#737373]">
              No explicit member documents assigned yet. Add organizer UIDs above to grant dashboard access.
            </p>
          ) : (
            <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]/50">
              {members.map((m) => (
                <div
                  key={m.uid}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-[#171717] truncate">
                        {m.displayName || m.email || m.uid}
                      </span>
                      <span className="rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-[#171717]">
                        {m.role}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          m.status === 'active'
                            ? 'bg-[#16A34A]/10 text-[#15803D]'
                            : 'bg-red-50 text-[#DC2626]'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-[#737373] truncate">
                      UID: {m.uid}
                      {m.email ? ` · ${m.email}` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => populateForm(m)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer self-start sm:self-center shrink-0"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                    <span>Edit Role</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. School Settings */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-[#171717] flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
            <span>School Configuration</span>
          </h2>
          <p className="mt-0.5 text-xs text-[#737373]">
            Configure canonical school name and timezone used across event creation and student schedules (School ID:{' '}
            <code className="font-mono text-[#171717]">{schoolConfig.id}</code>).
          </p>
        </div>

        <form onSubmit={(e) => void handleSaveSchool(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="school-name-input" className="block text-xs font-semibold text-[#171717] mb-1.5">
              School Name
            </label>
            <input
              id="school-name-input"
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            />
          </div>

          <div>
            <label htmlFor="school-tz-select" className="block text-xs font-semibold text-[#171717] mb-1.5">
              Canonical Timezone
            </label>
            <select
              id="school-tz-select"
              value={schoolTimezone}
              onChange={(e) => setSchoolTimezone(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
            >
              {SUPPORTED_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#171717] cursor-pointer">
              <input
                type="checkbox"
                checked={allowPublicDiscovery}
                onChange={(e) => setAllowPublicDiscovery(e.target.checked)}
                className="h-4 w-4 rounded border-[#E5E7EB] accent-[#E85D04]"
              />
              <span>Allow public discovery feed for signed-out campus visitors</span>
            </label>

            <button
              type="submit"
              disabled={savingSchool}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#171717] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#333333] disabled:opacity-60 cursor-pointer"
            >
              {savingSchool ? 'Saving...' : 'Save School Settings'}
            </button>
          </div>
        </form>
      </section>

      {/* 3. Controlled Legacy Migration & Demo Seed */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#171717] flex items-center gap-2">
              <DatabaseZap className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
              <span>Legacy Event Migration &amp; Seed</span>
            </h2>
            <p className="mt-0.5 text-xs text-[#737373]">
              Admin-only tool to non-destructively upgrade Phase 1 documents or import demo events into Firestore while preserving IDs and RSVP counts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleInspectMigration()}
              disabled={inspectingMigration || runningMigration}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${inspectingMigration ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Inspect Database</span>
            </button>

            <button
              type="button"
              onClick={() => void handleRunMigration()}
              disabled={runningMigration || inspectingMigration}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 cursor-pointer"
            >
              <DatabaseZap className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{runningMigration ? 'Migrating...' : 'Run Migration & Seed'}</span>
            </button>
          </div>
        </div>

        {migrationReport && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4">
            <div>
              <p className="text-[11px] font-medium text-[#737373]">Phase 2 Up-to-Date Docs</p>
              <p className="font-mono text-lg font-bold text-[#16A34A]">
                {migrationReport.upToDateCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#737373]">Legacy Docs Needing Upgrade</p>
              <p className="font-mono text-lg font-bold text-[#D97706]">
                {migrationReport.legacyDocsCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#737373]">Unseeded Demo Events</p>
              <p className="font-mono text-lg font-bold text-[#171717]">
                {migrationReport.unseededDemoCount}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
