import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canToggleEventRsvp,
  computeOptimisticRsvp,
  evaluateRsvpReconciliation,
  isUncertainRsvpWriteError,
  withTimeout,
} from './rsvp';

test('computeOptimisticRsvp increments count and marks going when joining', () => {
  assert.deepEqual(computeOptimisticRsvp(false, 14), {
    nextGoing: true,
    nextCount: 15,
  });
});

test('computeOptimisticRsvp decrements count safely without going negative', () => {
  assert.deepEqual(computeOptimisticRsvp(true, 15), {
    nextGoing: false,
    nextCount: 14,
  });
  assert.deepEqual(computeOptimisticRsvp(true, 0), {
    nextGoing: false,
    nextCount: 0,
  });
});

test('withTimeout resolves fast promises before timeout', async () => {
  const result = await withTimeout(Promise.resolve('ok'), 100);
  assert.equal(result, 'ok');
});

test('withTimeout rejects when promise exceeds timeout duration', async () => {
  const never = new Promise<string>(() => {});
  await assert.rejects(
    () => withTimeout(never, 30, 'Connection failed.'),
    /Connection failed\./
  );
});

test('canToggleEventRsvp blocks new RSVPs on cancelled, draft, and past events', () => {
  const now = new Date('2026-05-01T18:00:00.000Z');
  const futureStart = new Date('2026-05-02T17:00:00.000Z');
  const futureEnd = new Date('2026-05-02T18:00:00.000Z');
  const pastStart = new Date('2026-04-30T17:00:00.000Z');
  const pastEnd = new Date('2026-04-30T18:00:00.000Z');

  assert.equal(
    canToggleEventRsvp({ status: 'published', startAt: futureStart, endAt: futureEnd }, false, now).allowed,
    true
  );
  assert.equal(
    canToggleEventRsvp({ status: 'published', startAt: pastStart, endAt: pastEnd }, false, now).allowed,
    false
  );
  assert.equal(
    canToggleEventRsvp({ status: 'cancelled', startAt: futureStart, endAt: futureEnd }, false, now).allowed,
    false
  );
  // Existing attendees may still cancel their RSVP on a cancelled event
  assert.equal(
    canToggleEventRsvp({ status: 'cancelled', startAt: futureStart, endAt: futureEnd }, true, now).allowed,
    true
  );
  assert.equal(
    canToggleEventRsvp({ status: 'draft', startAt: futureStart, endAt: futureEnd }, false, now).allowed,
    false
  );
});

test('isUncertainRsvpWriteError distinguishes timeouts from permission denials', () => {
  assert.equal(isUncertainRsvpWriteError(new Error('Connection timed out.')), true);
  assert.equal(
    isUncertainRsvpWriteError(
      new Error(
        JSON.stringify({
          error: 'Connection timed out.',
          operationType: 'write',
          path: 'events/e1/attendees/u1',
        })
      )
    ),
    true
  );
  assert.equal(
    isUncertainRsvpWriteError(
      new Error(
        JSON.stringify({
          error: 'Missing or insufficient permissions.',
          operationType: 'write',
          path: 'events/e1/attendees/u1',
        })
      )
    ),
    false
  );
});

test('evaluateRsvpReconciliation confirms success when slow commit actually persisted on server', () => {
  const outcome = evaluateRsvpReconciliation({
    desiredGoing: true,
    serverState: { isGoing: true, rsvpCount: 22 },
    originalError: new Error('Connection timed out.'),
  });
  assert.equal(outcome.status, 'confirmed');
  assert.equal(outcome.toastType, 'success');
  assert.equal(outcome.isGoing, true);
  assert.equal(outcome.rsvpCount, 22);
});

test('evaluateRsvpReconciliation reverts accurately when server rejected or did not commit', () => {
  const permDenied = evaluateRsvpReconciliation({
    desiredGoing: true,
    serverState: { isGoing: false, rsvpCount: 21 },
    originalError: new Error(
      JSON.stringify({
        error: 'Missing or insufficient permissions.',
        operationType: 'write',
        path: 'events/e1/attendees/u1',
      })
    ),
  });
  assert.equal(permDenied.status, 'reverted');
  assert.equal(permDenied.toastType, 'error');
  assert.equal(permDenied.isGoing, false);

  const uncertain = evaluateRsvpReconciliation({
    desiredGoing: true,
    serverState: null,
    originalError: new Error('Connection timed out.'),
  });
  assert.equal(uncertain.status, 'uncertain');
  assert.equal(uncertain.toastType, 'error');
});
