export const RSVP_TIMEOUT_MS = 5000;

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
