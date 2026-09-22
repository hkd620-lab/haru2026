import assert from 'node:assert/strict';
import {
  cleanupTrackedRecordPhotos,
  decodeConvertedJpeg,
  enqueuePendingRecordPhotoCleanup,
  excludeCommittedRecordPhotoUrls,
  persistRecordPhoto,
  retryPendingRecordPhotoCleanup,
} from '../src/app/services/recordPhotoUploadCore.ts';

const originalImages = ['https://storage.test/existing.jpg'];
const localStorageValues = new Map();
globalThis.localStorage = {
  getItem: (key) => localStorageValues.get(key) ?? null,
  setItem: (key, value) => localStorageValues.set(key, String(value)),
  removeItem: (key) => localStorageValues.delete(key),
};

{
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const imageBase64 = Buffer.from(jpeg).toString('base64');
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(jpeg, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  };
  try {
    const newFrontendOldFunction = await decodeConvertedJpeg({ url: 'https://legacy-cloudinary.test/photo.jpg' });
    assert.deepEqual(new Uint8Array(await newFrontendOldFunction.arrayBuffer()), jpeg);
    assert.equal(fetchCalls, 1, 'new frontend must support the old Function URL contract');

    const newFrontendNewFunction = await decodeConvertedJpeg({ imageBase64, contentType: 'image/jpeg' });
    assert.deepEqual(new Uint8Array(await newFrontendNewFunction.arrayBuffer()), jpeg);
    assert.equal(fetchCalls, 1, 'new frontend must prefer base64 and avoid fetching the compatibility URL');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  let visibleImages = [...originalImages];
  let cleaned = false;
  await persistRecordPhoto({
    upload: async () => ({ url: 'https://storage.test/new.jpg', cleanup: async () => { cleaned = true; } }),
    persist: async () => {},
    commit: (url) => { visibleImages = [...visibleImages, url]; },
  });
  assert.deepEqual(visibleImages, [...originalImages, 'https://storage.test/new.jpg']);
  assert.equal(cleaned, false);
}

{
  const attempts = [];
  const first = await cleanupTrackedRecordPhotos(['deleted-a', 'retry-b', 'deleted-a'], async (url) => {
    attempts.push(url);
    if (url === 'retry-b') throw new Error('offline');
  });
  assert.deepEqual(attempts, ['deleted-a', 'retry-b'], 'cleanup must deduplicate Storage targets');
  assert.deepEqual(first.deletedUrls, ['deleted-a']);
  assert.deepEqual(first.failedUrls, ['retry-b'], 'failed cleanup targets must remain available for retry');

  const second = await cleanupTrackedRecordPhotos(first.failedUrls, async () => {});
  assert.deepEqual(second.deletedUrls, ['retry-b']);
  assert.deepEqual(second.failedUrls, []);

  const alreadyMissing = await cleanupTrackedRecordPhotos(['missing'], async () => {
    throw { code: 'storage/object-not-found' };
  });
  assert.deepEqual(alreadyMissing.deletedUrls, ['missing']);
  assert.deepEqual(alreadyMissing.failedUrls, []);
}

{
  let visibleImages = [...originalImages];
  let cleaned = false;
  let attempts = 0;
  const upload = async () => ({
    url: 'https://storage.test/retry.jpg',
    cleanup: async () => { cleaned = true; },
  });

  await assert.rejects(() => persistRecordPhoto({
    upload,
    persist: async () => { attempts += 1; throw new Error('Firestore update failed'); },
    commit: (url) => { visibleImages = [...visibleImages, url]; },
  }), /Firestore update failed/);
  assert.deepEqual(visibleImages, originalImages, 'failed persistence must not change visible photos or count');
  assert.equal(cleaned, true, 'failed persistence must delete the uploaded Storage object');

  await persistRecordPhoto({
    upload,
    persist: async () => { attempts += 1; },
    commit: (url) => { visibleImages = [...visibleImages, url]; },
  });
  assert.equal(attempts, 2, 'the same photo can be added immediately after failure');
  assert.deepEqual(visibleImages, [...originalImages, 'https://storage.test/retry.jpg']);
}

{
  const ownerPath = 'users/user-a/format_photos/orphan.jpg';
  const otherPath = 'users/user-b/format_photos/other.jpg';
  let cleanupFailureQueued = false;
  await assert.rejects(() => persistRecordPhoto({
    upload: async () => ({
      url: 'https://storage.test/orphan.jpg',
      cleanup: async () => { throw new Error('offline'); },
    }),
    persist: async () => { throw new Error('Firestore update failed'); },
    commit: () => {},
    onCleanupFailure: async () => {
      cleanupFailureQueued = true;
      enqueuePendingRecordPhotoCleanup(ownerPath);
      enqueuePendingRecordPhotoCleanup(otherPath);
    },
  }), /Firestore update failed/);
  assert.equal(cleanupFailureQueued, true);

  let online = false;
  const firstRetry = await retryPendingRecordPhotoCleanup('user-a', async () => {
    if (!online) throw new Error('offline');
  });
  assert.deepEqual(firstRetry.failedPaths, [ownerPath]);

  online = true;
  const afterRestart = await retryPendingRecordPhotoCleanup('user-a', async () => {});
  assert.deepEqual(afterRestart.deletedPaths, [ownerPath]);
  const otherUserRetry = await retryPendingRecordPhotoCleanup('user-b', async (path) => {
    assert.equal(path, otherPath, 'cleanup queue must not let one UID delete another UID path');
  });
  assert.deepEqual(otherUserRetry.deletedPaths, [otherPath]);
}

{
  localStorageValues.clear();
  const deletingPath = 'users/user-a/format_photos/deleting.jpg';
  const concurrentlyQueuedPath = 'users/user-a/format_photos/queued-during-retry.jpg';
  enqueuePendingRecordPhotoCleanup(deletingPath);
  await retryPendingRecordPhotoCleanup('user-a', async () => {
    enqueuePendingRecordPhotoCleanup(concurrentlyQueuedPath);
  });
  const retryAfterConcurrentEnqueue = await retryPendingRecordPhotoCleanup('user-a', async (path) => {
    assert.equal(path, concurrentlyQueuedPath, 'a path queued during retry must not be overwritten');
  });
  assert.deepEqual(retryAfterConcurrentEnqueue.deletedPaths, [concurrentlyQueuedPath]);
}

{
  let committed = false;
  await assert.rejects(() => persistRecordPhoto({
    upload: async () => { throw new Error('Firebase upload failed'); },
    persist: async () => { throw new Error('must not run'); },
    commit: () => { committed = true; },
  }), /Firebase upload failed/);
  assert.equal(committed, false);
}

{
  const tracked = ['saved-a', 'unsaved-b', 'saved-c'];
  assert.deepEqual(
    excludeCommittedRecordPhotoUrls(tracked, ['saved-a', 'saved-c']),
    ['unsaved-b'],
    'period saves must preserve committed photos while retaining unsaved photos for cancel cleanup',
  );
  assert.deepEqual(
    excludeCommittedRecordPhotoUrls(tracked, []),
    tracked,
    'failed period saves must leave all pending photos eligible for cleanup',
  );
}

console.log('record photo upload transaction behavior tests passed');
