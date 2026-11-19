import { useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Club } from '../types/club';
import type { SchoolEvent } from '../types/event';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SignInPromptModalProps {
  isOpen: boolean;
  event: SchoolEvent | null;
  club?: Club | null;
  isSigningIn: boolean;
  authError: string | null;
  onConfirmSignIn: () => void;
  onClose: () => void;
}

export function SignInPromptModal({
  isOpen,
  event,
  club = null,
  isSigningIn,
  authError,
  onConfirmSignIn,
  onClose,
}: SignInPromptModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
    disableEscape: isSigningIn,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#171717]/45 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E85D04] text-white shrink-0"
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" />
                <rect
                  x="13"
                  y="4"
                  width="7"
                  height="7"
                  rx="2"
                  fill="currentColor"
                  fillOpacity="0.65"
                />
                <rect x="4" y="13" width="16" height="7" rx="2" fill="currentColor" />
              </svg>
            </span>
            <span className="font-display text-base font-extrabold tracking-tight text-[#171717]">
              OnePlace
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close sign-in prompt"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <h2
          id="signin-modal-title"
          className="mt-5 font-display text-xl font-extrabold tracking-tight text-[#171717]"
        >
          Be part of what's happening.
        </h2>
        <p className="mt-2 text-sm text-[#737373] leading-relaxed">
          Sign in to RSVP, follow campus clubs, and stay connected with your school community.
          {event && (
            <>
              {' '}
              Your RSVP for <span className="font-semibold text-[#171717]">{event.title}</span>{' '}
              will be tied to your student identity.
            </>
          )}
          {!event && club && (
            <>
              {' '}
              Follow <span className="font-semibold text-[#171717]">{club.name}</span> to track their upcoming meetings and announcements.
            </>
          )}
        </p>

        {authError && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {authError}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onConfirmSignIn}
            disabled={isSigningIn}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#E85D04] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            <span>{isSigningIn ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            Cancel
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-[#737373]">
          Uses Firebase Authentication · We only display your name and avatar for your RSVPs.
        </p>
      </motion.div>
    </div>
  );
}
