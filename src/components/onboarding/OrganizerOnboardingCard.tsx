import { ArrowUpRight, CheckCircle2, Circle, Compass, X } from 'lucide-react';
import type { Club } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import type { UserOnboardingProgress } from '../../types/school';
import { evaluateOrganizerOnboardingSteps } from '../../utils/onboarding';

interface OrganizerOnboardingCardProps {
  assignedClubs: Club[];
  managedEvents: SchoolEvent[];
  progress: UserOnboardingProgress;
  saving?: boolean;
  onToggleManualStep: (key: 'clubProfileReviewed' | 'eventManagementReviewed') => void;
  onNavigateTab: (tab: 'events' | 'clubs' | 'analytics') => void;
  onCreateEvent: () => void;
  onDismiss: () => void;
}

export function OrganizerOnboardingCard({
  assignedClubs,
  managedEvents,
  progress,
  saving = false,
  onToggleManualStep,
  onNavigateTab,
  onCreateEvent,
  onDismiss,
}: OrganizerOnboardingCardProps) {
  const summary = evaluateOrganizerOnboardingSteps({
    assignedClubs,
    managedEvents,
    progress,
  });

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-medium text-[#E85D04]">
            Club Organizer Quick Start · {summary.completedCount}/{summary.totalCount} completed
          </p>
          <h2 className="mt-1 font-display text-lg font-extrabold tracking-tight text-[#171717]">
            Welcome to Organizer Studio
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#737373] leading-relaxed max-w-2xl">
            As an authorized club organizer, you can update profile details for your assigned clubs, draft or publish campus events, monitor aggregate RSVP counts, and review engagement analytics. Completing checklist steps tracks your readiness and does not change account permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hide organizer onboarding guide"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F3F4F6] hover:text-[#171717] cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
          <div
            className="h-full rounded-full bg-[#E85D04] transition-all duration-300"
            style={{ width: `${summary.percent}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#737373]">
          <span>
            Assigned clubs:{' '}
            <strong className="text-[#171717]">
              {assignedClubs.length > 0
                ? assignedClubs.map((c) => c.name).join(', ')
                : 'None assigned yet (ask your School Administrator)'}
            </strong>
          </span>
          <span className="font-mono tabular-nums font-semibold text-[#171717]">
            {summary.percent}%
          </span>
        </div>
      </div>

      {/* Key Workflow Concepts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
          <p className="font-semibold text-[#171717]">Draft vs. Published</p>
          <p className="mt-1 text-[#737373] leading-relaxed">
            Drafts stay visible only to you and school admins until you publish them to the campus feed.
          </p>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
          <p className="font-semibold text-[#171717]">Privacy-First RSVPs</p>
          <p className="mt-1 text-[#737373] leading-relaxed">
            Students RSVP in one tap; you see accurate live attendance counts without exposing private student lists.
          </p>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
          <p className="font-semibold text-[#171717]">Club Analytics</p>
          <p className="mt-1 text-[#737373] leading-relaxed">
            Track RSVP trends, top-performing events, and follower counts for your assigned clubs in the Analytics tab.
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
        {summary.steps.map((item) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {item.manualKey ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onToggleManualStep(item.manualKey!)}
                  aria-pressed={item.completed}
                  aria-label={`Mark ${item.label} as ${item.completed ? 'incomplete' : 'complete'}`}
                  className="mt-0.5 shrink-0 cursor-pointer text-[#E85D04] disabled:opacity-50"
                >
                  {item.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#A3A3A3]" aria-hidden="true" />
                  )}
                </button>
              ) : item.completed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#D4D4D4]" aria-hidden="true" />
              )}

              <div className="min-w-0">
                <p
                  className={`text-xs sm:text-sm font-semibold ${
                    item.completed ? 'text-[#525252] line-through' : 'text-[#171717]'
                  }`}
                >
                  {item.label}
                </p>
                <p className="text-[11px] text-[#737373]">{item.description}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                item.id === 'first-event-created' ? onCreateEvent() : onNavigateTab(item.actionTab)
              }
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer self-start sm:self-center"
            >
              <Compass className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
              <span>
                {item.id === 'first-event-created'
                  ? 'Create Event'
                  : item.actionTab === 'clubs'
                    ? 'Open Clubs'
                    : item.actionTab === 'analytics'
                      ? 'View Analytics'
                      : 'Open Events'}
              </span>
              <ArrowUpRight className="h-3 w-3 text-[#737373]" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
