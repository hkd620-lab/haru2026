import assert from 'node:assert/strict';
import { createBatchedRequestQueue } from '../src/app/utils/snsThumbnailRequestQueue.js';

async function flushScheduled(callbacks) {
  while (callbacks.length > 0) {
    const callback = callbacks.shift();
    callback();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

{
  const scheduled = [];
  const batches = [];
  const queue = createBatchedRequestQueue(
    async (items) => {
      batches.push(items);
      return items.map((item) => ({ ok: true, value: item.path }));
    },
    { batchSize: 12, schedule: (callback) => scheduled.push(callback) }
  );

  const first = queue.request({ key: 'u:a', batchKey: 'u', value: { path: 'a' } });
  const duplicate = queue.request({ key: 'u:a', batchKey: 'u', value: { path: 'a' } });
  const second = queue.request({ key: 'u:b', batchKey: 'u', value: { path: 'b' } });
  await flushScheduled(scheduled);

  assert.deepEqual(await Promise.all([first, duplicate, second]), [
    { ok: true, value: 'a' },
    { ok: true, value: 'a' },
    { ok: true, value: 'b' },
  ]);
  assert.equal(batches.length, 1, 'simultaneous card requests must share one batch');
  assert.deepEqual(batches[0].map((item) => item.path), ['a', 'b']);
}

{
  const scheduled = [];
  const batchSizes = [];
  const queue = createBatchedRequestQueue(
    async (items) => {
      batchSizes.push(items.length);
      return items.map(() => ({ ok: true }));
    },
    { batchSize: 12, schedule: (callback) => scheduled.push(callback) }
  );
  const requests = Array.from({ length: 15 }, (_, index) => queue.request({
    key: `u:${index}`,
    batchKey: 'u',
    value: { path: String(index) },
  }));
  await flushScheduled(scheduled);
  await Promise.all(requests);

  assert.deepEqual(batchSizes, [12, 3], 'large pages must be fetched in bounded sequential batches');
}

{
  const scheduled = [];
  let attempts = 0;
  const queue = createBatchedRequestQueue(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary failure');
      return [{ ok: true }];
    },
    { schedule: (callback) => scheduled.push(callback) }
  );

  const failed = queue.request({ key: 'u:retry', batchKey: 'u', value: { path: 'retry' } });
  const failedAssertion = assert.rejects(failed, /temporary failure/);
  await flushScheduled(scheduled);
  await failedAssertion;

  const retried = queue.request({ key: 'u:retry', batchKey: 'u', value: { path: 'retry' } });
  await flushScheduled(scheduled);
  assert.deepEqual(await retried, { ok: true });
  assert.equal(attempts, 2, 'failed requests must leave the in-flight map so one-card retry can run');
}

{
  const scheduled = [];
  let fetchCount = 0;
  const queue = createBatchedRequestQueue(
    async (items) => {
      fetchCount += 1;
      return items.map(() => ({ ok: true }));
    },
    { schedule: (callback) => scheduled.push(callback) }
  );

  const stale = queue.request({ key: 'u:stale', batchKey: 'u', value: { path: 'stale' } });
  const staleAssertion = assert.rejects(stale, /request-cancelled/);
  queue.release('u:stale');
  await flushScheduled(scheduled);
  await staleAssertion;

  assert.equal(fetchCount, 0, 'unmounted cards must leave the queue before their request starts');
}

console.log('sns thumbnail request queue tests passed');
