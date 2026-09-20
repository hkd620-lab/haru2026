import assert from 'node:assert/strict';
import { persistRecordPhoto } from '../src/app/services/recordPhotoUploadCore.ts';

const originalImages = ['https://storage.test/existing.jpg'];

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
  let committed = false;
  await assert.rejects(() => persistRecordPhoto({
    upload: async () => { throw new Error('Firebase upload failed'); },
    persist: async () => { throw new Error('must not run'); },
    commit: () => { committed = true; },
  }), /Firebase upload failed/);
  assert.equal(committed, false);
}

console.log('record photo upload transaction behavior tests passed');
