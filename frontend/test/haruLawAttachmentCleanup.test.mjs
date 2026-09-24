import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  cleanupHaruLawAttachments,
  enqueueHaruLawAttachmentCleanup,
  isOwnedHaruLawAttachmentPath,
  retryPendingHaruLawAttachmentCleanup,
  scheduleDeferredHaruLawAttachmentCleanup,
} from '../src/app/services/haruLawAttachmentCleanup.ts';

const localStorageValues = new Map();
globalThis.localStorage = {
  getItem: (key) => localStorageValues.get(key) ?? null,
  setItem: (key, value) => localStorageValues.set(key, String(value)),
  removeItem: (key) => localStorageValues.delete(key),
};

const makeEntry = (overrides = {}) => ({
  uid: 'user-a',
  recordId: 'record-a',
  threadId: 'haruraw_sayu',
  storagePath: 'users/user-a/haruLawAttachments/record-a/file-a.pdf',
  mimeType: 'application/pdf',
  fileName: 'file-a.pdf',
  verifyReference: false,
  ...overrides,
});

const cases = [];
const check = async (name, run) => {
  localStorageValues.clear();
  await run();
  cases.push(name);
};

await check('1. 본인 UID·기록 경로 허용', async () => {
  assert.equal(isOwnedHaruLawAttachmentPath('user-a', 'record-a', makeEntry().storagePath), true);
});

await check('2. 다른 UID 경로 차단', async () => {
  assert.equal(isOwnedHaruLawAttachmentPath('user-a', 'record-a', 'users/user-b/haruLawAttachments/record-a/file.pdf'), false);
});

await check('3. 다른 기록·중첩 경로 차단', async () => {
  assert.equal(isOwnedHaruLawAttachmentPath('user-a', 'record-a', 'users/user-a/haruLawAttachments/record-b/file.pdf'), false);
  assert.equal(isOwnedHaruLawAttachmentPath('user-a', 'record-a', 'users/user-a/haruLawAttachments/record-a/nested/file.pdf'), false);
  assert.equal(isOwnedHaruLawAttachmentPath('user-a', 'record-a', 'users/user-a/haruLawAttachments/record-a/123_contract..pdf'), true);
});

await check('4. 삭제 큐 중복 방지', async () => {
  const entry = makeEntry();
  enqueueHaruLawAttachmentCleanup(entry);
  enqueueHaruLawAttachmentCleanup(entry);
  const deleted = [];
  const result = await retryPendingHaruLawAttachmentCleanup('user-a', {
    deletePath: async (path) => { deleted.push(path); },
    isReferenced: async () => false,
  });
  assert.deepEqual(deleted, [entry.storagePath]);
  assert.deepEqual(result.deletedPaths, [entry.storagePath]);
});

await check('5. 계정 전환 시 다른 UID 삭제 차단', async () => {
  const owner = makeEntry();
  const other = makeEntry({
    uid: 'user-b',
    storagePath: 'users/user-b/haruLawAttachments/record-a/file-b.pdf',
    fileName: 'file-b.pdf',
  });
  enqueueHaruLawAttachmentCleanup(owner);
  enqueueHaruLawAttachmentCleanup(other);
  await retryPendingHaruLawAttachmentCleanup('user-a', {
    deletePath: async (path) => assert.equal(path, owner.storagePath),
    isReferenced: async () => false,
  });
  const retriedOther = await retryPendingHaruLawAttachmentCleanup('user-b', {
    deletePath: async (path) => assert.equal(path, other.storagePath),
    isReferenced: async () => false,
  });
  assert.deepEqual(retriedOther.deletedPaths, [other.storagePath]);
});

await check('6. 이미 없는 객체는 정리 성공 처리', async () => {
  const entry = makeEntry();
  const result = await cleanupHaruLawAttachments([entry], {
    deletePath: async () => { throw { code: 'storage/object-not-found' }; },
    isReferenced: async () => false,
  });
  assert.deepEqual(result.deletedPaths, [entry.storagePath]);
  assert.deepEqual(result.failedPaths, []);
});

await check('7. Firestore 참조 첨부 보존', async () => {
  const entry = makeEntry({ verifyReference: true });
  let deleteCalls = 0;
  const result = await cleanupHaruLawAttachments([entry], {
    deletePath: async () => { deleteCalls += 1; },
    isReferenced: async () => true,
  });
  assert.equal(deleteCalls, 0);
  assert.deepEqual(result.preservedPaths, [entry.storagePath]);
});

await check('8. 참조되지 않은 attempted 첨부 삭제', async () => {
  const entry = makeEntry({ verifyReference: true });
  const result = await cleanupHaruLawAttachments([entry], {
    deletePath: async () => {},
    isReferenced: async () => false,
  });
  assert.deepEqual(result.deletedPaths, [entry.storagePath]);
});

await check('9. 참조 확인 실패 시 삭제하지 않고 재시도 유지', async () => {
  const entry = makeEntry({ verifyReference: true });
  let deleteCalls = 0;
  const first = await cleanupHaruLawAttachments([entry], {
    deletePath: async () => { deleteCalls += 1; },
    isReferenced: async () => { throw new Error('offline'); },
  });
  assert.equal(deleteCalls, 0);
  assert.deepEqual(first.failedPaths, [entry.storagePath]);
  const retry = await retryPendingHaruLawAttachmentCleanup('user-a', {
    deletePath: async () => { deleteCalls += 1; },
    isReferenced: async () => false,
  });
  assert.equal(deleteCalls, 1);
  assert.deepEqual(retry.deletedPaths, [entry.storagePath]);
});

await check('10. 삭제 실패 큐 영속 재시도', async () => {
  const entry = makeEntry();
  const first = await cleanupHaruLawAttachments([entry], {
    deletePath: async () => { throw new Error('offline'); },
    isReferenced: async () => false,
  });
  assert.deepEqual(first.failedPaths, [entry.storagePath]);
  const retry = await retryPendingHaruLawAttachmentCleanup('user-a', {
    deletePath: async () => {},
    isReferenced: async () => false,
  });
  assert.deepEqual(retry.deletedPaths, [entry.storagePath]);
});

await check('11. 전송 중 이탈 항목 지연 후 안전 정리', async () => {
  const entry = makeEntry({ verifyReference: true, notBefore: 5_000 });
  enqueueHaruLawAttachmentCleanup(entry);
  const early = await retryPendingHaruLawAttachmentCleanup('user-a', {
    deletePath: async () => { throw new Error('too early'); },
    isReferenced: async () => false,
    now: () => 4_999,
  });
  assert.deepEqual(early.deferredPaths, [entry.storagePath]);
  const later = await retryPendingHaruLawAttachmentCleanup('user-a', {
    deletePath: async () => {},
    isReferenced: async () => false,
    now: () => 5_000,
  });
  assert.deepEqual(later.deletedPaths, [entry.storagePath]);

  const scheduledEntry = makeEntry({
    storagePath: 'users/user-a/haruLawAttachments/record-a/scheduled.pdf',
    fileName: 'scheduled.pdf',
    notBefore: Date.now() + 10,
  });
  enqueueHaruLawAttachmentCleanup(scheduledEntry);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('예약 정리 시간 초과')), 500);
    scheduleDeferredHaruLawAttachmentCleanup('user-a', scheduledEntry.notBefore, {
      deletePath: async (path) => {
        assert.equal(path, scheduledEntry.storagePath);
        clearTimeout(timeout);
        resolve();
      },
      isReferenced: async () => false,
    });
  });
});

await check('12. UI 제거·닫기·부분 업로드 실패·성공 커밋 경계 연결', async () => {
  const source = await readFile(new URL('../src/app/components/ResultChatModal.tsx', import.meta.url), 'utf8');
  const firestoreService = await readFile(new URL('../src/app/services/firestoreService.ts', import.meta.url), 'utf8');
  assert.match(source, /deleteObject/);
  assert.match(source, /closeWithPendingCleanup/);
  assert.match(source, /uploaded\.length > 0/);
  assert.match(source, /uploadingAttachmentsRef\.current = \[\.\.\.uploaded\]/);
  assert.match(source, /attachmentScopeRef\.current !== uploadScopeId/);
  assert.match(source, /scheduleDeferredHaruLawAttachmentCleanup/);
  assert.match(source, /requestInFlightRef\.current \|\| closingAttachmentsRef\.current/);
  assert.match(source, /choiceActionDisabled = loading \|\| closingAttachments/);
  assert.match(source, /cleanupHaruLawAttachments/);
  assert.match(source, /pendingAttachmentsRef\.current = \[\];[\s\S]*attemptedAttachmentPathsRef\.current\.clear\(\);[\s\S]*setPendingAttachments\(\[\]\);/);
  assert.match(source, /catch \(error: any\)[\s\S]*setQuestion\(trimmed\);/);
  assert.match(firestoreService, /key === 'haruraw_attachments'/);
  assert.match(firestoreService, /else addImageMeta\(item\)/);
});

assert.equal(cases.length, 12);
console.log(`하루LAW 첨부 정리 ${cases.length}개 시나리오 통과`);
