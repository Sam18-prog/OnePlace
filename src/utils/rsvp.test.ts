import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOptimisticRsvp, withTimeout } from './rsvp';

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
