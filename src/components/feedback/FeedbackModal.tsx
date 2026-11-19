import { useRef, useState } from 'react';
import { CheckCircle2, MessageSquarePlus, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { submitSchoolFeedback } from '../../services/feedbackService';
import {
  FEEDBACK_RELATED_FEATURES,
  FEEDBACK_TYPES,
  type FeedbackRelatedFeature,
  type FeedbackType,
} from '../../types/feedback';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';

interface FeedbackModalProps {
  isOpen: boolean;
  schoolId: string;
  schoolName: string;
  userUid: string | null;
  onSignIn: () => void;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function FeedbackModal({
  isOpen,
  schoolId,
  schoolName,
  userUid,
  onSignIn,
  onClose,
  onSubmitted,
}: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('usability');
  const [relatedFeature, setRelatedFeature] = useState<FeedbackRelatedFeature>('Event Discovery');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap({ isOpen, containerRef: dialogRef, onClose });

  if (!isOpen) return null;

  const handleClose = () => {
    setError(null);
    setSubmittedId(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUid) return;
    setError(null);
    setSubmitting(true);
    try {
      const id = await submitSchoolFeedback({
        schoolId,
        uid: userUid,
        input: {
          type,
          relatedFeature,
          description,
        },
      });
      setSubmittedId(id);
      setDescription('');
      onSubmitted?.();
    } catch (err) {
      setError(toUserFriendlyErrorMessage(err, 'Could not submit feedback right now.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full max-w-lg rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-medium text-[#E85D04]">Campus Feedback</p>
            <h2
              id="feedback-modal-title"
              className="mt-1 font-display text-lg font-extrabold tracking-tight text-[#171717]"
            >
              Share feedback for {schoolName}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close feedback dialog"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F3F4F6] hover:text-[#171717] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {!userUid ? (
          <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-5 text-center">
            <MessageSquarePlus className="mx-auto h-6 w-6 text-[#E85D04]" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-[#171717]">Sign in to submit feedback</p>
            <p className="mt-1 text-xs text-[#737373] leading-relaxed">
              Verified school accounts help prevent spam while keeping submissions private to your school&apos;s administrators.
            </p>
            <button
              type="button"
              onClick={() => {
                handleClose();
                onSignIn();
              }}
              className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC2F02] cursor-pointer"
            >
              Sign in with Google
            </button>
          </div>
        ) : submittedId ? (
          <div className="mt-5 rounded-xl border border-[#16A34A]/25 bg-[#16A34A]/5 p-5 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-[#16A34A]" aria-hidden="true" />
            <h3 className="mt-2 font-display text-base font-bold text-[#171717]">
              Feedback recorded
            </h3>
            <p className="mt-1 text-xs text-[#525252] leading-relaxed">
              Thank you for helping improve OnePlace for {schoolName}. Your submission is stored privately for review by your school&apos;s administrators and is never shown to other students.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setSubmittedId(null)}
                className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
              >
                Send another
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-[#171717] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333333] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
            <p className="text-xs text-[#737373] leading-relaxed">
              Report an issue, suggest a feature, or share usability feedback. No extra personal details are collected—only your feedback message and school context are saved for administrators.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="feedback-type" className="block text-xs font-semibold text-[#171717] mb-1">
                  Feedback type
                </label>
                <select
                  id="feedback-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as FeedbackType)}
                  className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
                >
                  {FEEDBACK_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="feedback-feature" className="block text-xs font-semibold text-[#171717] mb-1">
                  Related area
                </label>
                <select
                  id="feedback-feature"
                  value={relatedFeature}
                  onChange={(e) => setRelatedFeature(e.target.value as FeedbackRelatedFeature)}
                  className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
                >
                  {FEEDBACK_RELATED_FEATURES.map((feat) => (
                    <option key={feat} value={feat}>
                      {feat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="feedback-desc" className="block text-xs font-semibold text-[#171717] mb-1">
                Details <span className="text-[#DC2626]">*</span>
              </label>
              <textarea
                id="feedback-desc"
                rows={4}
                required
                minLength={10}
                maxLength={1200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what worked well, what was confusing, or steps to reproduce an issue..."
                className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm text-[#171717] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
              />
              <p className="mt-1 text-right font-mono tabular-nums text-[11px] text-[#737373]">
                {description.trim().length} / 1200
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#DC2626]"
              >
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || description.trim().length < 10}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
