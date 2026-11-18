import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import type { SchoolEvent } from '../../types/event';
import { CANCELLATION_REASON_MAX } from '../../utils/eventValidation';

interface CancelEventModalProps {
  event: SchoolEvent | null;
  isSubmitting: boolean;
  onConfirmCancel: (event: SchoolEvent, reason: string) => Promise<void>;
  onClose: () => void;
}

export function CancelEventModal({
  event,
  isSubmitting,
  onConfirmCancel,
  onClose,
}: CancelEventModalProps) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!event) return;
    setReason('');
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [event, isSubmitting, onClose]);

  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-event-title"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#DC2626] border border-red-200 shrink-0">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="cancel-event-title"
                className="font-display text-lg font-extrabold tracking-tight text-[#171717]"
              >
                Cancel this event?
              </h2>
              <p className="text-xs text-[#737373] truncate max-w-[260px]">{event.title}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close cancel confirmation"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-xs sm:text-sm text-[#525252] leading-relaxed">
          Soft-cancelling marks this event as <strong className="text-[#171717]">Cancelled</strong>, stops new student RSVPs, and preserves existing attendee counts for audit integrity.
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="cancel-reason-input" className="text-xs font-semibold text-[#171717]">
              Cancellation note <span className="font-normal text-[#737373]">(optional)</span>
            </label>
            <span className="font-mono text-[11px] text-[#737373]">
              {reason.length}/{CANCELLATION_REASON_MAX}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            id="cancel-reason-input"
            rows={3}
            maxLength={CANCELLATION_REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Rescheduled due to gym floor maintenance."
            className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
          >
            Keep Event
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void onConfirmCancel(event, reason)}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#DC2626] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
