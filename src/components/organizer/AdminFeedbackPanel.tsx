import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MessageSquareText, RefreshCw } from 'lucide-react';
import { listSchoolFeedback, updateFeedbackStatus } from '../../services/feedbackService';
import {
  FEEDBACK_TYPES,
  type FeedbackStatus,
  type FeedbackSubmission,
  type FeedbackType,
} from '../../types/feedback';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';

interface AdminFeedbackPanelProps {
  schoolId: string;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

export function AdminFeedbackPanel({ schoolId, onShowToast }: AdminFeedbackPanelProps) {
  const [items, setItems] = useState<FeedbackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | FeedbackType>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSchoolFeedback(schoolId);
      setItems(list);
      const drafts: Record<string, string> = {};
      for (const item of list) {
        drafts[item.id] = item.adminNote || '';
      }
      setNoteDrafts(drafts);
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not load school feedback.'));
    } finally {
      setLoading(false);
    }
  }, [onShowToast, schoolId]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const handleUpdate = async (item: FeedbackSubmission, nextStatus: FeedbackStatus) => {
    setBusyId(item.id);
    try {
      await updateFeedbackStatus({
        schoolId,
        feedbackId: item.id,
        status: nextStatus,
        adminNote: noteDrafts[item.id] ?? item.adminNote ?? '',
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, status: nextStatus, adminNote: (noteDrafts[item.id] ?? '').trim() }
            : row
        )
      );
      onShowToast('success', `Feedback marked as ${nextStatus}.`);
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not update feedback status.'));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    return true;
  });

  const newCount = items.filter((i) => i.status === 'new').length;

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[#171717] flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
            <span>Campus Feedback Inbox</span>
            {newCount > 0 && (
              <span className="font-mono tabular-nums text-xs font-semibold text-[#E85D04]">
                · {newCount} new
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-[#737373]">
            Review pilot bug reports, usability notes, and feature suggestions submitted privately for this school.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadFeedback()}
          disabled={loading}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-1">
          {(['all', 'new', 'reviewed', 'resolved'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors cursor-pointer ${
                statusFilter === status
                  ? 'bg-white text-[#171717] shadow-xs'
                  : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter feedback by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | FeedbackType)}
          className="h-9 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs text-[#171717] focus:border-[#E85D04] focus:outline-none"
        >
          <option value="all">All types</option>
          {FEEDBACK_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-xs text-[#737373]">Loading school feedback submissions...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-6 text-center">
          <p className="text-xs font-medium text-[#525252]">No feedback submissions match the current filter.</p>
          <p className="mt-1 text-[11px] text-[#737373]">
            Signed-in students and organizers can submit feedback from the footer or Profile tab.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E5E7EB] rounded-xl border border-[#E5E7EB]">
          {filtered.map((item) => {
            const typeLabel = FEEDBACK_TYPES.find((t) => t.id === item.type)?.label ?? item.type;
            return (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                    <span className="font-semibold text-[#171717]">{typeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.relatedFeature}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[11px]">
                      {item.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[11px] font-semibold uppercase ${
                      item.status === 'resolved'
                        ? 'text-[#16A34A]'
                        : item.status === 'reviewed'
                          ? 'text-[#D97706]'
                          : 'text-[#E85D04]'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <p className="text-sm text-[#171717] whitespace-pre-wrap leading-relaxed">
                  {item.description}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <input
                    type="text"
                    maxLength={400}
                    value={noteDrafts[item.id] ?? ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Optional internal admin note..."
                    aria-label={`Internal note for feedback ${item.id}`}
                    className="h-9 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 text-xs text-[#171717] focus:border-[#E85D04] focus:bg-white focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void handleUpdate(item, 'reviewed')}
                      className="inline-flex min-h-[34px] items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void handleUpdate(item, 'resolved')}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#171717] px-3 py-1 text-xs font-semibold text-white hover:bg-[#333333] disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Resolve</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
