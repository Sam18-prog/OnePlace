import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPermissionDeniedError,
  isTimeoutOrNetworkError,
  parseFirestoreErrorInfo,
  sanitizeDiagnosticMessage,
  toFriendlyAuthError,
  toUserFriendlyErrorMessage,
} from './errorHandling';

test('parseFirestoreErrorInfo extracts structured FirestoreErrorInfo safely', () => {
  const serialized = JSON.stringify({
    error: 'Missing or insufficient permissions.',
    operationType: 'write',
    path: 'schools/oakridge-high/clubs/robotics',
    authInfo: { emailVerified: true },
  });
  const parsed = parseFirestoreErrorInfo(new Error(serialized));
  assert.deepEqual(parsed, {
    error: 'Missing or insufficient permissions.',
    operationType: 'write',
    path: 'schools/oakridge-high/clubs/robotics',
  });
  assert.equal(parseFirestoreErrorInfo(new Error('Plain message')), null);
});

test('toUserFriendlyErrorMessage never leaks serialized JSON or internal Firestore paths', () => {
  const serialized = JSON.stringify({
    error: 'Missing or insufficient permissions.',
    operationType: 'get',
    path: 'schools/oakridge-high/members/secretUid1234567890123456',
  });
  const msg = toUserFriendlyErrorMessage(new Error(serialized), 'Fallback');
  assert.equal(msg.includes('{'), false);
  assert.equal(msg.includes('schools/'), false);
  assert.equal(msg.includes('secretUid'), false);
  assert.equal(isPermissionDeniedError(new Error(serialized)), true);
});

test('toUserFriendlyErrorMessage maps network/timeout errors and preserves safe domain messages', () => {
  const timeoutErr = new Error('Connection timed out while saving');
  assert.equal(isTimeoutOrNetworkError(timeoutErr), true);
  assert.match(toUserFriendlyErrorMessage(timeoutErr), /longer than expected/i);

  const domainErr = new Error('Suspended clubs cannot accept new followers.');
  assert.equal(
    toUserFriendlyErrorMessage(domainErr),
    'Suspended clubs cannot accept new followers.'
  );
});

test('toFriendlyAuthError maps Firebase Auth popup and network errors cleanly', () => {
  const closed = { code: 'auth/popup-closed-by-user', message: 'Firebase: Error (auth/popup-closed-by-user).' };
  const blocked = { code: 'auth/popup-blocked', message: 'Firebase: Error (auth/popup-blocked).' };
  const net = { code: 'auth/network-request-failed', message: 'Firebase: Error (auth/network-request-failed).' };

  assert.match(toFriendlyAuthError(closed), /cancelled/i);
  assert.equal(toFriendlyAuthError(closed).includes('Firebase:'), false);
  assert.match(toFriendlyAuthError(blocked), /blocked/i);
  assert.match(toFriendlyAuthError(net), /connection/i);
});

test('sanitizeDiagnosticMessage redacts emails and long UIDs/tokens', () => {
  const redacted = sanitizeDiagnosticMessage(
    'Failed for student@oakridge.edu with uid AbCdEfGhIjKlMnOpQrStUvWxYz12'
  );
  assert.equal(redacted.includes('student@oakridge.edu'), false);
  assert.equal(redacted.includes('AbCdEfGhIjKlMnOpQrStUvWxYz12'), false);
  assert.match(redacted, /\[redacted-email\]/);
  assert.match(redacted, /\[redacted-id\]/);
});
