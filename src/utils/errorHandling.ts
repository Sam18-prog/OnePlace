export interface ParsedFirestoreErrorInfo {
  error: string;
  operationType?: string;
  path?: string | null;
}

const RAW_FIREBASE_PREFIX = /^Firebase:\s*/i;

/**
 * Safely parses serialized FirestoreErrorInfo JSON thrown by handleFirestoreError.
 * Returns null if the message is plain text or invalid JSON.
 */
export function parseFirestoreErrorInfo(error: unknown): ParsedFirestoreErrorInfo | null {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.error === 'string') {
      return {
        error: parsed.error,
        operationType: typeof parsed.operationType === 'string' ? parsed.operationType : undefined,
        path: typeof parsed.path === 'string' || parsed.path === null ? parsed.path : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function extractErrorCodeAndText(error: unknown): { code: string; text: string; isSerialized: boolean } {
  const parsed = parseFirestoreErrorInfo(error);
  if (parsed) {
    return {
      code: '',
      text: parsed.error,
      isSerialized: true,
    };
  }

  let code = '';
  let text = '';
  if (error && typeof error === 'object') {
    const rec = error as { code?: unknown; message?: unknown };
    if (typeof rec.code === 'string') code = rec.code;
    if (typeof rec.message === 'string') text = rec.message;
  } else if (typeof error === 'string') {
    text = error;
  }

  return { code, text, isSerialized: false };
}

export function isPermissionDeniedError(error: unknown): boolean {
  const { code, text } = extractErrorCodeAndText(error);
  const combined = `${code} ${text}`.toLowerCase();
  return (
    combined.includes('permission-denied') ||
    combined.includes('missing or insufficient permissions')
  );
}

export function isTimeoutOrNetworkError(error: unknown): boolean {
  const { code, text } = extractErrorCodeAndText(error);
  const combined = `${code} ${text}`.toLowerCase();
  return (
    combined.includes('timed out') ||
    combined.includes('timeout') ||
    combined.includes('deadline-exceeded') ||
    combined.includes('unavailable') ||
    combined.includes('connection failed') ||
    combined.includes('network-request-failed') ||
    combined.includes('failed to fetch') ||
    combined.includes('client is offline')
  );
}

/**
 * Converts Firebase Authentication errors into calm, actionable user copy without exposing internals.
 */
export function toFriendlyAuthError(error: unknown): string {
  const { code, text } = extractErrorCodeAndText(error);
  const combined = `${code} ${text}`.toLowerCase();

  if (combined.includes('auth/popup-closed-by-user')) {
    return 'Sign-in was cancelled before completing. Click "Continue with Google" whenever you are ready.';
  }
  if (combined.includes('auth/cancelled-popup-request')) {
    return 'A previous sign-in window was closed. Please try signing in again.';
  }
  if (combined.includes('auth/popup-blocked')) {
    return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.';
  }
  if (combined.includes('auth/network-request-failed')) {
    return 'Unable to reach Google Sign-In. Check your internet connection and try again.';
  }
  if (combined.includes('auth/user-disabled')) {
    return 'This account has been disabled. Contact your school administrator for assistance.';
  }
  if (combined.includes('auth/too-many-requests')) {
    return 'Too many sign-in attempts in a short time. Please wait a moment and try again.';
  }
  if (combined.includes('auth/unauthorized-domain')) {
    return 'Sign-in is not enabled on this domain yet. Contact your site administrator.';
  }
  if (combined.includes('auth/account-exists-with-different-credential')) {
    return 'An account already exists with this email using a different sign-in method.';
  }

  return 'Could not complete Google Sign-In. Please try again.';
}

/**
 * Converts any thrown Error (including serialized FirestoreErrorInfo) into safe user-facing copy.
 * Never exposes internal Firestore collection paths, JSON error blobs, or stack traces.
 */
export function toUserFriendlyErrorMessage(
  error: unknown,
  fallback: string = 'Something went wrong. Please try again.'
): string {
  const { code, text, isSerialized } = extractErrorCodeAndText(error);
  const combined = `${code} ${text}`.toLowerCase();

  if (isPermissionDeniedError(error)) {
    return 'You do not have permission to perform this action. Verify your school account status or sign in again.';
  }
  if (combined.includes('unauthenticated')) {
    return 'Please sign in with your verified Google account to continue.';
  }
  if (combined.includes('client is offline')) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  if (isTimeoutOrNetworkError(error)) {
    return 'The connection took longer than expected. Please check your network and try again.';
  }
  if (combined.includes('resource-exhausted')) {
    return 'The campus service is temporarily busy. Please wait a moment and try again.';
  }
  if (combined.includes('failed-precondition') || combined.includes('requires an index')) {
    return 'This view is temporarily unavailable while data indexes finish updating. Please try again shortly.';
  }
  if (combined.includes('not-found')) {
    return 'The requested item could not be found or is no longer available.';
  }
  if (combined.includes('already-exists')) {
    return 'An item with this identifier already exists. Try a different name or slug.';
  }

  // Never leak serialized FirestoreErrorInfo JSON or raw Firebase SDK prefixes
  if (isSerialized || !text.trim()) {
    return fallback;
  }

  const cleaned = text.replace(RAW_FIREBASE_PREFIX, '').trim();
  // Guard against leaking collection paths or raw error codes
  if (
    cleaned.startsWith('{') ||
    cleaned.includes('schools/') ||
    cleaned.includes('users/') ||
    cleaned.includes('firestore') ||
    cleaned.includes('auth/')
  ) {
    return fallback;
  }

  // Preserve concise, safe domain validation strings (e.g. "This event has been cancelled...")
  return cleaned.length <= 220 ? cleaned : fallback;
}

/**
 * Redacts obvious email addresses or long token-like identifiers before logging in production.
 */
export function sanitizeDiagnosticMessage(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[redacted-id]');
}

export function logClientDiagnostic(context: string, error: unknown): void {
  const isProd = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.PROD);
  const { text } = extractErrorCodeAndText(error);
  const summary = text || (error instanceof Error ? error.message : String(error));
  if (isProd) {
    console.warn(`[OnePlace] ${context}: ${sanitizeDiagnosticMessage(summary)}`);
  } else {
    console.warn(`[OnePlace] ${context}:`, error);
  }
}
