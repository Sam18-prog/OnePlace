import { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Send, Star } from 'lucide-react';
import {
  fetchMyEventFeedback,
  submitPostEventFeedback,
} from '../../services/eventOperationsService';
import type { SchoolEvent } from '../../types/event';
import type {
  EventFeedbackRecord,
  StudentEventLifecycleState,
} from '../../types/eventOperations';
import {
  evaluatePostEventFeedbackEligibility,
  EVENT_FEEDBACK_TEXT_MAX,
  validatePostEventFeedbackInput,
} from '../../utils/eventOperations';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';

interface PostEventFeedbackCardProps {
  event: SchoolEvent;
  userUid: string | null;
  isVerifiedUser: boolean;
  isSuspendedMember: boolean;
  lifecycle: StudentEventLifecycleState;
  onShowToast?: (type: 'error' | 'success', message: string) => void;
}

function RatingRow({
  label,
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <span className="text-xs font-semibold text-[#171717]">{label}</span>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score <= value;
          return (
            <button
              key={score}
              id={`${idPrefix}-${score}`}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${score} out of 5`}
              disabled={disabled}
              onClick={() => onChange(score)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                active
                  ? 'border-[#E85D04]/40 bg-[#E85D04]/10 text-[#E85D04]'
                  : 'border-[#E5E7EB] bg-white text-[#A3A3A3] hover:text-[#525252]'
              }`}
            >
              <Star
                className={`h-4 w-4 ${active ? 'fill-[#E85D04]' : ''}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
        <span className="ml-1.5 font-mono tabular-nums text-xs font-semibold text-[#171717] min-w-[2.2rem]">
          {value > 0 ? `${value}/5` : '—'}
        </span>
      </div>
    </div>
  );
}

export function PostEventFeedbackCard({
  event,
  userUid,
  isVerifiedUser,
  isSuspendedMember,
  lifecycle,
  onShowToast,
}: PostEventFeedbackCardProps) {
  const [existing, setExisting] = useState<EventFeedbackRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [overallRating, setOverallRating] = useState<number>(0);
  const [organizationRating, setOrganizationRating] = useState<number>(0);
  const [writtenFeedback, setWrittenFeedback] = useState('');
  const [improvementSuggestions, setImprovementSuggestions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!userUid) {
      setExisting(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchMyEventFeedback(event.id, userUid)
      .then((rec) => {
        if (!cancelled) setExisting(rec);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, userUid]);

  const eligibility = evaluatePostEventFeedbackEligibility({
    event,
    lifecycle,
    hasAlreadySubmitted: Boolean(existing),
    isVerifiedUser,
    isSuspendedMember,
  });

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4">
        <p className="text-xs text-[#737373]">Checking post-event feedback status...</p>
      </div>
    );
  }

  if (existing) {
    return (
      <section
        aria-label="Submitted event feedback"
        className="rounded-xl border border-[#16A34A]/25 bg-[#16A34A]/5 p-4 space-y-2"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-[#15803D]">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Post-event feedback submitted</span>
        </div>
        <p className="text-xs text-[#525252]">
          Thank you for helping {event.hostClub} improve future campus events. You rated this event{' '}
          <span className="font-mono font-semibold text-[#171717]">{existing.overallRating}/5</span>{' '}
          overall and{' '}
          <span className="font-mono font-semibold text-[#171717]">
            {existing.organizationRating}/5
          </span>{' '}
          for organization.
        </p>
      </section>
    );
  }

  if (!eligibility.eligible) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUid) return;
    setErrorMsg(null);

    const check = validatePostEventFeedbackInput({
      overallRating,
      organizationRating,
      writtenFeedback,
      improvementSuggestions,
    });
    if (!check.valid) {
      setErrorMsg(
        check.errors.overallRating ||
          check.errors.organizationRating ||
          check.errors.writtenFeedback ||
          check.errors.improvementSuggestions ||
          'Please select both ratings before submitting.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const saved = await submitPostEventFeedback({
        eventId: event.id,
        schoolId: event.schoolId,
        uid: userUid,
        overallRating,
        organizationRating,
        writtenFeedback,
        improvementSuggestions,
      });
      setExisting(saved);
      onShowToast?.('success', 'Thank you—your post-event feedback was recorded.');
    } catch (err) {
      setErrorMsg(toUserFriendlyErrorMessage(err, 'Could not submit feedback right now.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="post-event-feedback-heading"
      className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 sm:p-5 space-y-4"
    >
      <div>
        <p className="font-mono text-[11px] font-medium text-[#E85D04]">Post-Event Feedback</p>
        <h3
          id="post-event-feedback-heading"
          className="mt-0.5 font-display text-base font-bold text-[#171717]"
        >
          How was {event.title}?
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#737373]">
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Private from other students. Organizers see aggregate ratings and anonymized comments.
          </span>
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
        <RatingRow
          label="Overall event rating"
          value={overallRating}
          onChange={setOverallRating}
          disabled={submitting}
          idPrefix="fb-overall"
        />

        <RatingRow
          label="Organization & clarity"
          value={organizationRating}
          onChange={setOrganizationRating}
          disabled={submitting}
          idPrefix="fb-org"
        />

        <div>
          <label
            htmlFor="fb-written"
            className="block text-xs font-semibold text-[#171717] mb-1"
          >
            What went well? <span className="font-normal text-[#737373]">(optional)</span>
          </label>
          <textarea
            id="fb-written"
            rows={2}
            maxLength={EVENT_FEEDBACK_TEXT_MAX}
            value={writtenFeedback}
            onChange={(e) => setWrittenFeedback(e.target.value)}
            placeholder="Share highlights or what you enjoyed most..."
            className="w-full rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-xs sm:text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
        </div>

        <div>
          <label
            htmlFor="fb-suggestions"
            className="block text-xs font-semibold text-[#171717] mb-1"
          >
            Suggestions for next time{' '}
            <span className="font-normal text-[#737373]">(optional)</span>
          </label>
          <textarea
            id="fb-suggestions"
            rows={2}
            maxLength={EVENT_FEEDBACK_TEXT_MAX}
            value={improvementSuggestions}
            onChange={(e) => setImprovementSuggestions(e.target.value)}
            placeholder="Timing, venue setup, materials, or topics to improve..."
            className="w-full rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-xs sm:text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
        </div>

        {errorMsg && (
          <p role="alert" className="text-xs font-medium text-[#DC2626]">
            {errorMsg}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || overallRating === 0 || organizationRating === 0}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333333] disabled:opacity-50 cursor-pointer transition-colors"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
