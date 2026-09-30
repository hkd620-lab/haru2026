const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('firebase-admin');
const functionsTest = require('firebase-functions-test')({ projectId: 'demo-haru-ai-library-callable' });

if (!process.env.FIRESTORE_EMULATOR_HOST?.match(/^(127\.0\.0\.1|localhost):/)) {
  throw new Error('로컬 Firestore emulator에서만 실행할 수 있습니다.');
}
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-haru-ai-library-callable' });

const {
  listAiLibraryLogs,
  saveAiLibraryImport,
  deleteAiLibraryLogs,
} = require('../lib/aiLibrary');
const { convertToBookMaterial } = require('../lib/bookMaterial');

const listLogs = functionsTest.wrap(listAiLibraryLogs);
const saveImport = functionsTest.wrap(saveAiLibraryImport);
const deleteLogs = functionsTest.wrap(deleteAiLibraryLogs);
const convertMaterial = functionsTest.wrap(convertToBookMaterial);

function callableRequest(data, auth) {
  return { data, auth, rawRequest: {} };
}

async function expectCode(promise, expectedCode) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test('비로그인·일반·비검증 이메일은 실제 Callable에서 거부된다', async () => {
  await expectCode(listLogs(callableRequest({}, undefined)), 'unauthenticated');
  await expectCode(listLogs(callableRequest({}, {
    uid: 'ordinary', token: { email: 'ordinary@example.com', email_verified: true },
  })), 'permission-denied');
  for (const token of [
    { email: 'hkd620@gmail.com' },
    { email: 'hkd620@gmail.com', email_verified: false },
  ]) {
    const auth = { uid: 'unverified', token };
    await expectCode(listLogs(callableRequest({}, auth)), 'permission-denied');
    await expectCode(saveImport(callableRequest({}, auth)), 'permission-denied');
    await expectCode(deleteLogs(callableRequest({ ids: ['x'] }, auth)), 'permission-denied');
    await expectCode(convertMaterial(callableRequest({ logId: 'x' }, auth)), 'permission-denied');
  }
});

test('검증된 개발자 토큰은 본인 UID 경로에서 저장·조회·삭제한다', async () => {
  const auth = {
    uid: 'verified-developer',
    token: { email: 'hkd620@gmail.com', email_verified: true },
  };
  const importId = 'a'.repeat(64);
  const saved = await saveImport(callableRequest({
    importId,
    content: '검증된 Callable 수집 테스트',
    source: 'slack',
    capturedAt: '2026-09-30T00:00:00.000Z',
  }, auth));
  assert.equal(saved.recordId, `ai_import_${importId}`);
  assert.equal(saved.duplicate, false);

  const ownRef = admin.firestore().doc(`users/${auth.uid}/records/${saved.recordId}`);
  const otherRef = admin.firestore().doc(`users/other/records/${saved.recordId}`);
  assert.equal((await ownRef.get()).exists, true);
  assert.equal((await otherRef.get()).exists, false);

  const listed = await listLogs(callableRequest({}, auth));
  assert.equal(listed.logs.some((item) => item.id === saved.recordId), true);
  const deleted = await deleteLogs(callableRequest({ ids: [saved.recordId] }, auth));
  assert.equal(deleted.deleted, 1);
  assert.equal((await ownRef.get()).exists, false);
});

test('10개 삭제는 성공하고 11개 요청은 트랜잭션 전에 거부한다', async () => {
  const auth = {
    uid: 'bulk-developer',
    token: { email: 'hkd620@gmail.com', email_verified: true },
  };
  const ids = Array.from({ length: 10 }, (_, index) => `bulk-${index}`);
  const batch = admin.firestore().batch();
  for (const id of ids) {
    batch.set(admin.firestore().doc(`users/${auth.uid}/records/${id}`), { type: 'ai_log' });
  }
  await batch.commit();

  const deleted = await deleteLogs(callableRequest({ ids }, auth));
  assert.equal(deleted.deleted, 10);

  await expectCode(
    deleteLogs(callableRequest({ ids: [...ids, 'bulk-10'] }, auth)),
    'invalid-argument',
  );
});

test('최대 크기에 가까운 멀티바이트 본문 10건을 트랜잭션으로 삭제한다', async () => {
  const auth = {
    uid: 'large-content-developer',
    token: { email: 'hkd620@gmail.com', email_verified: true },
  };
  const ids = Array.from({ length: 10 }, (_, index) => `large-${index}`);
  const nearLimitMultibyteContent = '하'.repeat(199_000);
  assert.equal(Buffer.byteLength(nearLimitMultibyteContent, 'utf8'), 597_000);

  const batch = admin.firestore().batch();
  for (const id of ids) {
    batch.set(admin.firestore().doc(`users/${auth.uid}/records/${id}`), {
      type: 'ai_log',
      content: nearLimitMultibyteContent,
    });
  }
  await batch.commit();

  const deleted = await deleteLogs(callableRequest({ ids }, auth));
  assert.equal(deleted.deleted, 10);
  const remaining = await admin.firestore().getAll(
    ...ids.map((id) => admin.firestore().doc(`users/${auth.uid}/records/${id}`)),
  );
  assert.equal(remaining.some((snap) => snap.exists), false);
});

test('없는 문서나 ai_log가 아닌 문서가 포함되면 전체 삭제를 시작하지 않는다', async () => {
  const auth = {
    uid: 'atomic-developer',
    token: { email: 'hkd620@gmail.com', email_verified: true },
  };
  const validRef = admin.firestore().doc(`users/${auth.uid}/records/valid-ai-log`);
  const wrongTypeRef = admin.firestore().doc(`users/${auth.uid}/records/not-ai-log`);
  await validRef.set({ type: 'ai_log' });
  await wrongTypeRef.set({ type: '일기' });

  for (const invalidId of ['missing-ai-log', 'not-ai-log']) {
    await expectCode(
      deleteLogs(callableRequest({ ids: ['valid-ai-log', invalidId] }, auth)),
      'failed-precondition',
    );
    assert.equal((await validRef.get()).exists, true);
  }
});
