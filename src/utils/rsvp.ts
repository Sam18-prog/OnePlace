import type { SchoolEvent } from '../types/event';
import { isPastEvent } from './eventValidation';
import { isPermissionDeniedError, isTimeoutOrNetworkError } from './errorHandling';

export const RSVP_TIMEOUT_MS = 5000;
export const RSVP_RECONCILE_TIMEOUT_MS = 6000;

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = RSVP_TIMEOUT_MS,
  timeoutMessage: string = 'Connection timed out'
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  });
}

export interface OptimisticRsvpResult {
  nextGoing: boolean;
  nextCount: number;
}

export function computeOptimisticRsvp(
  currentlyGoing: boolean,
  currentCount: number
): OptimisticRsvpResult {
  const safeCount = Math.max(0, Math.floor(currentCount));
  if (currentlyGoing) {
    return {
      nextGoing: false,
      nextCount: Math.max(0, safeCount - 1),
    };
  }
  return {
    nextGoing: true,
    nextCount: safeCount + 1,
  };
}

export interface RsvpEligibilityResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Pure client-side pre-flight check for RSVP toggles.
 * Allows cancelling an existing RSVP on published or cancelled events,
 * while blocking new RSVPs on cancelled, draft, or already-ended events.
 */
export function canToggleEventRsvp(
  event: Pick<SchoolEvent, 'status' | 'startAt' | 'endAt'>,
  currentlyGoing: boolean,
  now: Date = new Date()
): RsvpEligibilityResult {
  if (event.status === 'draft') {
    return {
      allowed: false,
      reason: 'Draft events cannot accept RSVPs.',
    };
  }

  if (!currentlyGoing && event.status === 'cancelled') {
    return {
      allowed: false,
      reason: 'This event has been cancelled and is no longer accepting RSVPs.',
    };
  }

  if (!currentlyGoing && isPastEvent(event, now)) {
    return {
      allowed: false,
      reason: 'This event has already ended and is no longer accepting RSVPs.',
    };
  }

  return { allowed: true };
}

/**
 * Determines whether a failed RSVP promise might still have committed on Firestore
 * (for example, a client-side timeout via Promise.race or transient network drop).
 */
export function isUncertainRsvpWriteError(error: unknown): boolean {
  if (isPermissionDeniedError(error)) return false;
  return isTimeoutOrNetworkError(error);
}

export interface AuthoritativeRsvpState {
  isGoing: boolean;
  rsvpCount?: number;
}

export interface RsvpReconciliationOutcome {
  status: 'confirmed' | 'reverted' | 'uncertain';
  isGoing?: boolean;
  rsvpCount?: number;
  toastType: 'success' | 'error';
  message: string;
}

/**
 * Evaluates authoritative Firestore state after an RSVP write error/timeout.
 * Prevents false "RSVP failed" notices when a slow commit actually succeeded on the server.
 */
export function evaluateRsvpReconciliation(params: {
  desiredGoing: boolean;
  serverState: AuthoritativeRsvpState | null;
  originalError: unknown;
}): RsvpReconciliationOutcome {
  const { desiredGoing, serverState, originalError } = params;

  if (serverState) {
    if (serverState.isGoing === desiredGoing) {
      return {
        status: 'confirmed',
        isGoing: serverState.isGoing,
        rsvpCount: serverState.rsvpCount,
        toastType: 'success',
        message: desiredGoing ? 'RSVP confirmed.' : 'RSVP cancelled.',
      };
    }

    if (isPermissionDeniedError(originalError)) {
      return {
        status: 'reverted',
        isGoing: serverState.isGoing,
        rsvpCount: serverState.rsvpCount,
        toastType: 'error',
        message: 'RSVP was declined. Make sure your school account is active and verified.',
      };
    }

    return {
      status: 'reverted',
      isGoing: serverState.isGoing,
      rsvpCount: serverState.rsvpCount,
      toastType: 'error',
      message: 'Could not save your RSVP right now. Your previous status has been restored.',
    };
  }

  if (isPermissionDeniedError(originalError)) {
    return {
      status: 'reverted',
      toastType: 'error',
      message: 'You do not have permission to RSVP to this event.',
    };
  }

  return {
    status: 'uncertain',
    toastType: 'error',
    message: 'Connection interrupted while saving RSVP. Tap Refresh to verify your status.',
  };
}
