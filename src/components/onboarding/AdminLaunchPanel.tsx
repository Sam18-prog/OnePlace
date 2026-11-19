import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Info,
  Rocket,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { SchoolConfig } from '../../config/school';
import { saveSchoolConfig } from '../../services/membershipService';
import type { Club } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import type { SchoolMembership } from '../../types/membership';
import {
  DEFAULT_SCHOOL_ONBOARDING_CHECKLIST,
  type PilotStage,
  type SchoolOnboardingChecklist,
  type SchoolStatus,
} from '../../types/school';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';
import {
  computeLaunchReadinessGate,
  evaluateSchoolSetupSteps,
  PILOT_STAGES,
  type LaunchReadinessStatus,
} from '../../utils/onboarding';

interface AdminLaunchPanelProps {
  schoolConfig: SchoolConfig;
  currentAdminUid: string;
  clubs: Club[];
  events: SchoolEvent[];
  members: SchoolMembership[];
  onNavigateTab: (tab: 'overview' | 'events' | 'clubs' | 'analytics' | 'settings' | 'launch') => void;
  onSchoolConfigUpdated: () => Promise<void>;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

function getStatusBadgeClasses(status: LaunchReadinessStatus): string {
  switch (status) {
    case 'Ready':
      return 'border-[#16A34A]/25 bg-[#16A34A]/10 text-[#15803D]';
    case 'Needs attention':
      return 'border-[#D97706]/30 bg-[#FEF3C7] text-[#B45309]';
    case 'Blocked':
      return 'border-red-200 bg-red-50 text-[#DC2626]';
    case 'Not verified':
      return 'border-[#D1D5DB] bg-[#F3F4F6] text-[#525252]';
    default:
      return 'border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]';
  }
}

export function AdminLaunchPanel({
  schoolConfig,
  currentAdminUid,
  clubs,
  events,
  members,
  onNavigateTab,
  onSchoolConfigUpdated,
  onShowToast,
}: AdminLaunchPanelProps) {
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | { kind: 'pilot'; targetStage: PilotStage; label: string }
    | { kind: 'status'; targetStatus: SchoolStatus; label: string }
    | null
  >(null);

  const checklist: SchoolOnboardingChecklist = {
    ...DEFAULT_SCHOOL_ONBOARDING_CHECKLIST,
    ...(schoolConfig.onboardingChecklist ?? {}),
  };

  const setupSummary = evaluateSchoolSetupSteps({
    schoolConfig,
    clubs,
    events,
    members,
  });

  const activeClubs = clubs.filter((c) => c.status === 'active');
  const publishedEvents = events.filter((e) => e.status === 'published');
  const activeOrganizers = members.filter(
    (m) => m.status === 'active' && (m.role === 'organizer' || m.role === 'admin')
  );

  const readinessItems = computeLaunchReadinessGate({
    schoolConfig,
    activeClubCount: activeClubs.length,
    publishedEventCount: publishedEvents.length,
  });

  const currentStage: PilotStage = schoolConfig.pilotStage ?? 'internal_validation';

  const persistSchoolPatch = async (patch: {
    status?: SchoolStatus;
    pilotStage?: PilotStage;
    onboardingChecklist?: SchoolOnboardingChecklist;
  }, successMessage: string) => {
    setSaving(true);
    try {
      await saveSchoolConfig(
        schoolConfig.id,
        {
          name: schoolConfig.name,
          timezone: schoolConfig.timezone,
          allowPublicDiscovery: schoolConfig.allowPublicDiscovery,
          status: patch.status ?? schoolConfig.status,
          description: schoolConfig.description,
          location: schoolConfig.location,
          logoUrl: schoolConfig.logoUrl,
          coverImageUrl: schoolConfig.coverImageUrl,
          contactEmail: schoolConfig.contactEmail,
          contactName: schoolConfig.contactName,
          pilotStage: patch.pilotStage ?? currentStage,
          onboardingChecklist: patch.onboardingChecklist ?? checklist,
        },
        currentAdminUid
      );
      await onSchoolConfigUpdated();
      onShowToast('success', successMessage);
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not update school launch settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChecklistKey = async (key: keyof SchoolOnboardingChecklist) => {
    const nextChecklist: SchoolOnboardingChecklist = {
      ...checklist,
      [key]: !checklist[key],
    };
    await persistSchoolPatch(
      { onboardingChecklist: nextChecklist },
      'School onboarding checklist updated.'
    );
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'pilot') {
      await persistSchoolPatch(
        { pilotStage: pendingAction.targetStage },
        `Pilot stage updated to ${pendingAction.label}.`
      );
    } else {
      await persistSchoolPatch(
        { status: pendingAction.targetStatus },
        `School status updated to ${pendingAction.label}.`
      );
    }
    setPendingAction(null);
  };

  const manualGovernanceItems: {
    key: keyof SchoolOnboardingChecklist;
    label: string;
    detail: string;
  }[] = [
    {
      key: 'profileReviewed',
      label: 'School profile & contact reviewed',
      detail: 'Official school name, timezone, location, and administrator contact are accurate.',
    },
    {
      key: 'visibilityVerified',
      label: 'Public vs. school-only visibility verified',
      detail: 'Confirmed whether signed-out visitors may view public campus events.',
    },
    {
      key: 'permissionsReviewed',
      label: 'Organizer & club-scoped permissions reviewed',
      detail: 'Verified every assigned organizer belongs only to their approved club(s).',
    },
    {
      key: 'privacyReviewed',
      label: 'Student privacy & data handling approved',
      detail: 'Confirmed student RSVP rosters and follower lists remain private.',
    },
    {
      key: 'notificationsReviewed',
      label: 'Notification capabilities reviewed',
      detail: 'Understood Starter Tier in-app notifications vs. Blaze push/scheduled reminders.',
    },
    {
      key: 'launchConfirmed',
      label: 'Launch & backup playbook reviewed',
      detail: 'Reviewed release checklist, incident response steps, and JSON backup export.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Admin Operations Overview */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-medium text-[#E85D04]">
              School Launch &amp; Pilot Operations · {schoolConfig.id}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight text-[#171717]">
              {schoolConfig.name} Onboarding &amp; Readiness
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#737373] max-w-2xl leading-relaxed">
              Track real-world school onboarding progress, advance through controlled pilot stages, and review launch readiness before inviting students.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                schoolConfig.status === 'active'
                  ? 'border-[#16A34A]/25 bg-[#16A34A]/10 text-[#15803D]'
                  : schoolConfig.status === 'suspended'
                    ? 'border-red-200 bg-red-50 text-[#DC2626]'
                    : 'border-[#D97706]/30 bg-[#FEF3C7] text-[#B45309]'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="capitalize">{schoolConfig.status.replace('_', ' ')}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-[#F8F9FA]">
          <div className="p-4">
            <p className="text-[11px] font-medium text-[#737373]">Setup Progress</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#171717]">
              {setupSummary.completedCount}/{setupSummary.totalCount}
            </p>
            <p className="mt-0.5 text-[11px] text-[#737373]">{setupSummary.percent}% complete</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-medium text-[#737373]">Active Clubs</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#171717]">
              {activeClubs.length}
            </p>
            <p className="mt-0.5 text-[11px] text-[#737373]">{clubs.length} total registered</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-medium text-[#737373]">Published Events</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#171717]">
              {publishedEvents.length}
            </p>
            <p className="mt-0.5 text-[11px] text-[#737373]">{events.length} total in school</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-medium text-[#737373]">Authorized Staff</p>
            <p className="mt-1 font-mono tabular-nums text-xl font-bold text-[#171717]">
              {activeOrganizers.length}
            </p>
            <p className="mt-0.5 text-[11px] text-[#737373]">Organizers &amp; admins</p>
          </div>
        </div>

        {/* School Status Switcher with Confirmation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
          <div>
            <p className="text-xs font-bold text-[#171717]">School Operational Status</p>
            <p className="mt-0.5 text-[11px] text-[#737373]">
              Keep status as Pending Setup during Stage 1 validation, switch to Active for students, or Suspended during maintenance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {(
              [
                { id: 'pending_setup', label: 'Pending Setup' },
                { id: 'active', label: 'Active' },
                { id: 'suspended', label: 'Suspended' },
              ] as const
            ).map((opt) => {
              const isCurrent = schoolConfig.status === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={saving || isCurrent}
                  onClick={() =>
                    setPendingAction({
                      kind: 'status',
                      targetStatus: opt.id,
                      label: opt.label,
                    })
                  }
                  className={`inline-flex min-h-[34px] items-center rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default ${
                    isCurrent
                      ? 'bg-[#171717] text-white'
                      : 'border border-[#E5E7EB] bg-[#F8F9FA] text-[#525252] hover:text-[#171717] hover:bg-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Honest Starter Tier Audit-Log Disclosure */}
        <div className="flex items-start gap-2.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-xs text-[#525252]">
          <Info className="h-4 w-4 text-[#737373] mt-0.5 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="text-[#171717]">Starter Tier Governance Note:</strong> Tamper-proof server-side audit logs and scheduled automated Firestore backups require Firebase Blaze (Cloud Functions + Cloud Logging). On Starter Tier, all writes carry server timestamps (<code className="font-mono">updatedAt</code> / <code className="font-mono">updatedBy</code>) and admins can export manual JSON backups anytime from Settings.
          </p>
        </div>
      </section>

      {/* Explicit Confirmation Banner for Critical School Status / Pilot Changes */}
      {pendingAction && (
        <section
          role="alertdialog"
          aria-labelledby="confirm-critical-action-title"
          className="rounded-2xl border border-[#E85D04]/40 bg-[#FFF7ED] p-5 shadow-xs space-y-3"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <h3
                id="confirm-critical-action-title"
                className="font-display text-sm font-bold text-[#171717]"
              >
                Confirm {pendingAction.kind === 'status' ? 'School Status' : 'Pilot Stage'} Change
              </h3>
              <p className="text-xs text-[#525252] leading-relaxed">
                {pendingAction.kind === 'status'
                  ? `You are about to set ${schoolConfig.name} status to "${pendingAction.label}". This updates the campus banner shown to visitors and students.`
                  : `You are about to update ${schoolConfig.name} pilot stage to "${pendingAction.label}". Make sure exit criteria for the previous stage have been verified.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setPendingAction(null)}
              className="inline-flex min-h-[36px] items-center rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleConfirmPendingAction()}
              className="inline-flex min-h-[36px] items-center rounded-xl bg-[#E85D04] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : `Confirm: ${pendingAction.label}`}
            </button>
          </div>
        </section>
      )}

      {/* 2. Controlled 4-Stage Real-World Pilot Program Tracker */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-display text-base font-bold text-[#171717] flex items-center gap-2">
            <Rocket className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
            <span>Controlled Pilot Rollout Stages</span>
          </h3>
          <p className="mt-0.5 text-xs text-[#737373]">
            Expand adoption gradually from internal staff testing to full student release. Never skip internal permission validation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PILOT_STAGES.map((stage) => {
            const isActive = currentStage === stage.id;
            const currentIdx = PILOT_STAGES.findIndex((s) => s.id === currentStage);
            const stageIdx = stage.stepNumber - 1;
            const isPast = stageIdx < currentIdx;

            return (
              <div
                key={stage.id}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isActive
                    ? 'border-[#E85D04] bg-[#FFF7ED]/50'
                    : isPast
                      ? 'border-[#16A34A]/30 bg-[#16A34A]/5'
                      : 'border-[#E5E7EB] bg-white'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#E85D04]">
                      {isActive ? 'Current Stage' : isPast ? 'Completed' : `Stage ${stage.stepNumber}`}
                    </span>
                    {isPast && (
                      <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p className="font-display text-sm font-bold text-[#171717]">{stage.title}</p>
                  <p className="text-[11px] font-medium text-[#525252]">
                    Audience: {stage.audience}
                  </p>
                  <p className="text-xs text-[#737373] leading-relaxed">{stage.goal}</p>
                  <p className="text-[11px] text-[#525252] pt-1 border-t border-[#E5E7EB]/70">
                    <strong className="text-[#171717]">Exit criteria:</strong> {stage.exitCriteria}
                  </p>
                </div>

                {!isActive && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setPendingAction({
                        kind: 'pilot',
                        targetStage: stage.id,
                        label: stage.title,
                      })
                    }
                    className="inline-flex min-h-[34px] items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer self-start"
                  >
                    Set as Active Stage
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. 10-Step School Onboarding Workflow */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-[#171717] flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
              <span>10-Step School Onboarding Workflow</span>
            </h3>
            <p className="mt-0.5 text-xs text-[#737373]">
              Auto-detected steps reflect live Firestore data for {schoolConfig.name}. Manual governance checks are saved to your school profile.
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs font-bold text-[#171717]">
            {setupSummary.completedCount} / {setupSummary.totalCount} ({setupSummary.percent}%)
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
          <div
            className="h-full rounded-full bg-[#E85D04] transition-all duration-300"
            style={{ width: `${setupSummary.percent}%` }}
          />
        </div>

        <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
          {setupSummary.steps.map((step) => (
            <div
              key={step.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {step.completed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 text-[#A3A3A3] shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-[#171717]">{step.label}</p>
                  <p className="text-[11px] text-[#737373]">{step.description}</p>
                </div>
              </div>

              {step.actionTab && step.actionTab !== 'launch' && (
                <button
                  type="button"
                  onClick={() => onNavigateTab(step.actionTab!)}
                  className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer self-start sm:self-center"
                >
                  <span className="capitalize">Open {step.actionTab}</span>
                  <ArrowUpRight className="h-3 w-3 text-[#737373]" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Manual Admin Sign-off Checkboxes */}
        <div className="pt-2 space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#737373]">
            Administrator Governance Sign-Offs
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {manualGovernanceItems.map((item) => {
              const checked = checklist[item.key];
              return (
                <label
                  key={item.key}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                    checked
                      ? 'border-[#16A34A]/30 bg-[#16A34A]/5'
                      : 'border-[#E5E7EB] bg-[#F8F9FA]/60 hover:bg-[#F8F9FA]'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={saving}
                    checked={checked}
                    onChange={() => void handleToggleChecklistKey(item.key)}
                    className="mt-0.5 h-4 w-4 rounded border-[#E5E7EB] accent-[#E85D04]"
                  />
                  <span>
                    <span className="block font-semibold text-[#171717]">{item.label}</span>
                    <span className="block mt-0.5 text-[11px] text-[#737373] leading-relaxed">
                      {item.detail}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Launch Readiness Gate Table */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div>
          <h3 className="font-display text-base font-bold text-[#171717] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
            <span>Launch Readiness Gate</span>
          </h3>
          <p className="mt-0.5 text-xs text-[#737373]">
            Honest assessment of platform readiness for real student adoption. Items marked &ldquo;Needs attention&rdquo; or &ldquo;Not verified&rdquo; must be confirmed by school administrators before Stage 4 release.
          </p>
        </div>

        <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
          {readinessItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-[#171717]">{item.area}</p>
                <p className="mt-0.5 text-xs text-[#737373] leading-relaxed">{item.summary}</p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-0.5 font-mono text-[11px] font-semibold self-start ${getStatusBadgeClasses(
                  item.status
                )}`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
