import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Compass,
  Users,
  X,
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { Club } from '../../types/club';
import type { EventCategory, SchoolEvent } from '../../types/event';
import { formatEventDateTime } from '../../utils/events';
import { InterestSelector } from '../personalization/InterestSelector';

interface StudentOnboardingModalProps {
  isOpen: boolean;
  schoolName: string;
  isSignedIn: boolean;
  selectedInterests: EventCategory[];
  clubs: Club[];
  events: SchoolEvent[];
  getEffectiveFollow: (club: Club) => { followerCount: number; isFollowing: boolean };
  onToggleInterest: (category: EventCategory) => void;
  onFollowClub: (club: Club) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onComplete: () => void;
  onDismiss: () => void;
}

const TOTAL_STEPS = 4;

export function StudentOnboardingModal({
  isOpen,
  schoolName,
  isSignedIn,
  selectedInterests,
  clubs,
  events,
  getEffectiveFollow,
  onToggleInterest,
  onFollowClub,
  onSelectEvent,
  onComplete,
  onDismiss,
}: StudentOnboardingModalProps) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap({ isOpen, containerRef: dialogRef, onClose: onDismiss });

  if (!isOpen) return null;

  const upcomingEvents = events.filter((e) => e.status === 'published').slice(0, 3);
  const activeClubs = clubs.filter((c) => c.status === 'active').slice(0, 4);

  const handleFinish = () => {
    setStep(0);
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-tour-title"
        className="w-full max-w-xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-medium text-[#E85D04]">
              Step {step + 1} of {TOTAL_STEPS} · {schoolName}
            </p>
            <h2
              id="student-tour-title"
              className="mt-1 font-display text-xl font-extrabold tracking-tight text-[#171717]"
            >
              {step === 0
                ? 'Everything happening. All in OnePlace.'
                : step === 1
                  ? 'Optional: Pick topics you enjoy'
                  : step === 2
                    ? 'Discover campus clubs'
                    : 'See upcoming campus events'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close welcome guide"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F3F4F6] hover:text-[#171717] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Step progress bar */}
        <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-colors ${
                idx <= step ? 'bg-[#E85D04]' : 'bg-[#E5E7EB]'
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-[#525252] leading-relaxed">
              OnePlace brings together student clubs, meetings, and campus activities at{' '}
              <strong className="text-[#171717]">{schoolName}</strong> so you never have to hunt across posters or group chats.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
                <Compass className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <p className="mt-2 text-xs font-bold text-[#171717]">Discover Events</p>
                <p className="mt-0.5 text-[11px] text-[#737373]">
                  Browse Today, This Week, and Later schedules by category or room.
                </p>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
                <Users className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <p className="mt-2 text-xs font-bold text-[#171717]">Follow Clubs</p>
                <p className="mt-0.5 text-[11px] text-[#737373]">
                  Stay updated when student organizations post new events.
                </p>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
                <CalendarDays className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <p className="mt-2 text-xs font-bold text-[#171717]">Quick RSVPs</p>
                <p className="mt-0.5 text-[11px] text-[#737373]">
                  Save events to My Events privately—only aggregate counts are public.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-[#737373]">
              This walkthrough is completely optional. You can skip at any time and browse public events immediately.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
              Select any categories below to tailor your Discover feed. No sensitive personal details are collected, and you can skip or change these anytime.
            </p>
            {isSignedIn ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4">
                <InterestSelector
                  selectedInterests={selectedInterests}
                  onToggleInterest={onToggleInterest}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 text-xs text-[#525252]">
                Sign in with your Google account anytime to save personal category preferences to your profile. You can continue exploring without signing in.
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
              Follow clubs at {schoolName} to keep their upcoming meetings near the top of your feed.
            </p>
            {activeClubs.length === 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-5 text-center text-xs text-[#737373]">
                No campus clubs have been published yet. Check back soon as your school registers student organizations.
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
                {activeClubs.map((club) => {
                  const eff = getEffectiveFollow(club);
                  return (
                    <div
                      key={club.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-[#171717] truncate">
                          {club.name}
                        </p>
                        <p className="text-[11px] text-[#737373] truncate">
                          {club.category} ·{' '}
                          <span className="font-mono tabular-nums">{eff.followerCount}</span>{' '}
                          followers
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onFollowClub(club)}
                        className={`inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                          eff.isFollowing
                            ? 'border border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D]'
                            : 'border border-[#E5E7EB] bg-white text-[#171717] hover:bg-[#F8F9FA]'
                        }`}
                      >
                        {eff.isFollowing && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        <span>{eff.isFollowing ? 'Following' : 'Follow'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
              Here&apos;s what&apos;s published right now on your campus schedule. Tap any event for full details, or jump straight into Discover.
            </p>
            {upcomingEvents.length === 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-5 text-center text-xs text-[#737373]">
                No published events are live yet. Once club organizers publish upcoming activities, they will appear right here.
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
                {upcomingEvents.map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => {
                      handleFinish();
                      onSelectEvent(evt);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-[#171717] truncate">
                        {evt.title}
                      </p>
                      <p className="text-[11px] text-[#737373] truncate">
                        {evt.hostClub} · {formatEventDateTime(evt.startAt, new Date(), evt.timezone)} ·{' '}
                        {evt.location}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#737373] shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E5E7EB]">
          <div>
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs font-medium text-[#737373] hover:text-[#171717] cursor-pointer"
              >
                Skip for now
              </button>
            )}
          </div>

          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#171717] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#333333] cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Go to Campus Feed</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
