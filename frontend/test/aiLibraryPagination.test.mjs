import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AiLibraryPageRequestGuard,
  hasAiLibraryNextPage,
  mergeAiLibraryLogs,
} from '../src/app/utils/aiLibraryPagination.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function guardedRequest(guard, generation, key, fetchPage, applyPage) {
  const ticket = guard.startRequest(generation, key);
  if (!ticket) return false;
  try {
    const page = await fetchPage();
    if (!guard.isCurrent(generation)) return false;
    applyPage(page);
    return true;
  } catch (error) {
    if (guard.isCurrent(generation)) throw error;
    return false;
  } finally {
    guard.finishRequest(ticket);
  }
}

test('first page replaces the empty list and a later page appends unique document ids', () => {
  const firstPage = [{ id: 'newest' }, { id: 'middle' }];
  assert.deepEqual(mergeAiLibraryLogs([], firstPage), firstPage);
  assert.deepEqual(
    mergeAiLibraryLogs(firstPage, [{ id: 'middle' }, { id: 'oldest' }]),
    [{ id: 'newest' }, { id: 'middle' }, { id: 'oldest' }],
  );
});

test('the same next-page cursor cannot start duplicate requests in one render cycle', async () => {
  const guard = new AiLibraryPageRequestGuard();
  const generation = guard.startSession();
  const pending = deferred();
  let calls = 0;
  const fetchPage = () => {
    calls += 1;
    return pending.promise;
  };
  const first = guardedRequest(guard, generation, 'next:cursor-1', fetchPage, () => {});
  const duplicate = await guardedRequest(guard, generation, 'next:cursor-1', fetchPage, () => {});
  assert.equal(duplicate, false);
  assert.equal(calls, 1);
  pending.resolve({ logs: [], nextCursor: undefined });
  assert.equal(await first, true);
});

test('account changes, A-B-A changes, and screen exit ignore stale success and failure', async () => {
  const guard = new AiLibraryPageRequestGuard();
  const generationA1 = guard.startSession();
  const oldSuccess = deferred();
  const oldFailure = deferred();
  const applied = [];
  const successRequest = guardedRequest(
    guard,
    generationA1,
    'first-page',
    () => oldSuccess.promise,
    page => applied.push(page),
  );
  const failureRequest = guardedRequest(
    guard,
    generationA1,
    'next:old',
    () => oldFailure.promise,
    page => applied.push(page),
  );

  const generationB = guard.startSession();
  const generationA2 = guard.startSession();
  assert.notEqual(generationA1, generationB);
  assert.notEqual(generationA1, generationA2);
  oldSuccess.resolve({ logs: [{ id: 'stale' }] });
  oldFailure.reject(new Error('stale failure'));
  assert.equal(await successRequest, false);
  assert.equal(await failureRequest, false);
  assert.deepEqual(applied, []);

  guard.endSession(generationA2);
  assert.equal(guard.isCurrent(generationA2), false);
});

test('failed current-page request releases the cursor lock for retry', async () => {
  const guard = new AiLibraryPageRequestGuard();
  const generation = guard.startSession();
  await assert.rejects(
    guardedRequest(
      guard,
      generation,
      'next:retry',
      async () => { throw new Error('temporary failure'); },
      () => {},
    ),
    /temporary failure/,
  );
  assert.notEqual(guard.startRequest(generation, 'next:retry'), null);
});

test('load-more availability follows only a non-empty next cursor', () => {
  assert.equal(hasAiLibraryNextPage('cursor'), true);
  assert.equal(hasAiLibraryNextPage(''), false);
  assert.equal(hasAiLibraryNextPage(undefined), false);
});
