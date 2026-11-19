import { useMemo } from 'react';
import { Lock, MessageSquare, Star } from 'lucide-react';
import type { SchoolEvent } from '../../types/event';
import type { EventFeedbackRecord } from '../../types/eventOperations';
import { formatEventDateTime } from '../../utils/events';
import { aggregateEventFeedbackSummary } from '../../utils/eventOperations';
import { isPastEvent } from '../../utils/eventValidation';

interface EventFeedbackSummaryPanelProps {
  event: SchoolEvent;
  feedbackRecords: EventFeedbackRecord[];
  loading: boolean;
}

export function EventFeedbackSummaryPanel({
  event,
  feedbackRecords,
  loading,
}: EventFeedbackSummaryPanelProps) {
  // Always pass raw feedback through aggregateEventFeedbackSummary so student UIDs are stripped
  const summary = useMemo(
    () => aggregateEventFeedbackSummary(feedbackRecords),
    [feedbackRecords]
  );

  const isPast = isPastEvent(event);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-xs text-[#737373]">
        Loading post-event feedback summary...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-xs text-[#525252]">
        <Lock className="h-4 w-4 text-[#737373] mt-0.5 shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          Student identities are automatically stripped from feedback summaries. Feedback opens for confirmed registrants and checked-in attendees once the event ends.
        </p>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB] rounded-xl border border-[#E5E7EB] bg-white">
        <div className="p-4">
          <p className="text-[11px] font-medium text-[#737373]">Total Responses</p>
          <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#171717]">
            {summary.responseCount}
          </p>
        </div>

        <div className="p-4">
          <p className="text-[11px] font-medium text-[#737373]">Avg Overall Rating</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Star className="h-4 w-4 text-[#E85D04] fill-[#E85D04]" aria-hidden="true" />
            <p className="font-mono tabular-nums text-2xl font-bold text-[#171717]">
              {summary.averageOverallRating !== null ? `${summary.averageOverallRating} / 5` : '—'}
            </p>
          </div>
        </div>

        <div className="p-4">
          <p className="text-[11px] font-medium text-[#737373]">Avg Organization Rating</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Star className="h-4 w-4 text-[#171717] fill-[#171717]" aria-hidden="true" />
            <p className="font-mono tabular-nums text-2xl font-bold text-[#171717]">
              {summary.averageOrganizationRating !== null
                ? `${summary.averageOrganizationRating} / 5`
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {summary.responseCount === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center space-y-1">
          <MessageSquare className="mx-auto h-5 w-5 text-[#A3A3A3]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#171717]">
            {isPast ? 'No feedback responses submitted yet' : 'Feedback opens after this event ends'}
          </p>
          <p className="text-xs text-[#737373]">
            {isPast
              ? 'Confirmed attendees can submit ratings and suggestions from Event Details or My Events.'
              : 'Once the scheduled end time passes, attendees can rate the event and share suggestions.'}
          </p>
        </div>
      ) : (
        <>
          {/* 1–5 Overall Rating Distribution */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5 space-y-3">
            <h4 className="font-display text-sm font-bold text-[#171717]">
              Overall Rating Distribution
            </h4>
            <div className="space-y-2">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = summary.ratingDistribution[star];
                const pct =
                  summary.responseCount > 0
                    ? Math.round((count / summary.responseCount) * 100)
                    : 0;
                return (
                  <div key={star} className="grid grid-cols-[52px_1fr_72px] items-center gap-3 text-xs">
                    <span className="font-mono tabular-nums font-medium text-[#171717]">
                      {star} star{star === 1 ? '' : 's'}
                    </span>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                      <div
                        className="h-full rounded-full bg-[#E85D04]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono tabular-nums text-right text-[#737373]">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Anonymized Written Comments */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#737373]">
              Anonymized Attendee Comments ({summary.comments.length})
            </h4>

            {summary.comments.length === 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 text-xs text-[#737373]">
                Attendees submitted numerical ratings only, with no written comments.
              </div>
            ) : (
              <div className="space-y-2.5">
                {summary.comments.map((comment) => (
                  <article
                    key={comment.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[#737373]">
                      <span className="font-mono tabular-nums font-semibold text-[#171717]">
                        Overall {comment.overallRating}/5 · Organization {comment.organizationRating}/5
                      </span>
                      <span className="font-mono text-[11px]">
                        {formatEventDateTime(comment.createdAt, new Date(), event.timezone)}
                      </span>
                    </div>
                    {comment.writtenFeedback && (
                      <div>
                        <p className="text-[11px] font-semibold text-[#737373]">What went well</p>
                        <p className="mt-0.5 text-sm text-[#171717] leading-relaxed">
                          {comment.writtenFeedback}
                        </p>
                      </div>
                    )}
                    {comment.improvementSuggestions && (
                      <div>
                        <p className="text-[11px] font-semibold text-[#737373]">
                          Suggestions for next time
                        </p>
                        <p className="mt-0.5 text-sm text-[#404040] leading-relaxed">
                          {comment.improvementSuggestions}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
