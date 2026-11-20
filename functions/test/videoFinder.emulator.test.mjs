// '내 영상 찾기' Firestore 저장소·Rules 에뮬레이터 시험. 실제 트랜잭션 경계를 확인한다.
// 실행: npm run test:video-finder:emulator (빌드 후 lib/videoFinderStore.js 사용, 루프백 에뮬레이터·demo 프로젝트 전용)
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error('Only a loopback Firestore emulator is allowed. Never run against production.');
}
const projectId = process.env.GCLOUD_PROJECT || 'demo-haru-video-finder';
if (!projectId.startsWith('demo-')) throw new Error('The emulator test must use a demo project only.');

const currentFile = fileURLToPath(import.meta.url);
const frontendRequire = createRequire(path.resolve(path.dirname(currentFile), '../../frontend/package.json'));
const functionsRequire = createRequire(path.resolve(path.dirname(currentFile), '../package.json'));
const { deleteApp: deleteClientApp, initializeApp: initializeClientApp } = frontendRequire('firebase/app');
const { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, setDoc } = frontendRequire('firebase/firestore');
const { deleteApp: deleteAdminApp, initializeApp: initializeAdminApp } = functionsRequire('firebase-admin/app');
const { getFirestore: getAdminFirestore } = functionsRequire('firebase-admin/firestore');
const { createFirestoreVideoFinderAccessStore, createFirestoreVideoFinderStore, expireSavedMetaIfStale } = functionsRequire('./lib/videoFinderStore.js');
const core = functionsRequire('./lib/videoFinderCore.js');

const adminApp = initializeAdminApp({ projectId }, `video-finder-admin-${Date.now()}`);
const db = getAdminFirestore(adminApp);
const fakeAuth = { getUser: async () => ({ disabled: false, emailVerified: true, providerData: [], tokensValidAfterTime: undefined }) };
const store = createFirestoreVideoFinderStore(db, fakeAuth);

const [hostname, portText] = host.split(':');
const clientApp = initializeClientApp({ projectId, apiKey: 'emulator-only' }, `video-finder-client-${Date.now()}`);
const clientDb = getFirestore(clientApp);
connectFirestoreEmulator(clientDb, hostname, Number(portText), { mockUserToken: { sub: 'vf-owner' } });

after(async () => {
  await deleteClientApp(clientApp);
  await deleteAdminApp(adminApp);
});

const NOW = Date.UTC(2026, 10, 20, 3, 0, 0);
const vid = (n) => `vid${String(n).padStart(8, '0')}`;
const meta = (id, title = `영상 ${id}`) => ({ videoId: id, title, channel: '채널', channelId: 'ch', publishedAt: '', thumbnail: '', duration: '', views: null, subscribers: null, description: '' });
const savedDoc = (id, at = NOW) => ({ videoId: id, category: '전체 분야', note: '', tags: [], favorite: false, savedAt: at, updatedAt: at, meta: meta(id), metaFetchedAt: at, metaStatus: 'fresh', metaCheckedAt: at });

async function activeUser(uid) {
  await db.doc(`users/${uid}`).set({ consents: { terms: true } });
}

test('동시에 담기를 몰아도 트랜잭션 레지스터 덕분에 최대 개수를 넘지 않는다', async () => {
  const uid = `vf-max-${Date.now()}`;
  await activeUser(uid);
  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => store.createSaved(uid, savedDoc(vid(i)), 3)));
  const created = results.filter((r) => r.status === 'fulfilled' && r.value.created === true).length;
  assert.equal(created, 3);
  assert.equal((await db.collection(`users/${uid}/videoFinderSaved`).count().get()).data().count, 3);
});

test('바꾸기는 지운 문서를 되살리지 않고, 영상 정보 갱신은 메모를 덮지 않는다', async () => {
  const uid = `vf-race-${Date.now()}`;
  await activeUser(uid);
  await store.createSaved(uid, savedDoc(vid(1)), 10);
  await store.updateSavedFields(uid, vid(1), () => ({ note: '메모', favorite: true, updatedAt: NOW + 1 }));
  const r = await store.updateSavedFields(uid, vid(1), (current) => core.planMetaUpdate(current, { kind: 'fresh', meta: meta(vid(1), '새 제목'), checkedAt: NOW + 2 }));
  assert.equal(r.doc.note, '메모');
  const stored = (await db.doc(`users/${uid}/videoFinderSaved/${vid(1)}`).get()).data();
  assert.equal(stored.note, '메모');
  assert.equal(stored.favorite, true);
  assert.equal(stored.meta.title, '새 제목');
  await store.deleteSaved(uid, vid(1));
  assert.deepEqual(await store.updateSavedFields(uid, vid(1), () => ({ note: '늦은 메모' })), { doc: null });
  assert.equal((await db.doc(`users/${uid}/videoFinderSaved/${vid(1)}`).get()).exists, false);
});

test('탈퇴 신청·삭제 시작 뒤에는 담기·편집·이력·세션 쓰기가 커밋되지 않는다', async () => {
  const uid = `vf-del-${Date.now()}`;
  await activeUser(uid);
  await store.createSaved(uid, savedDoc(vid(1)), 10);
  await db.doc(`users/${uid}`).update({ accountStatus: 'pending_deletion', deletionStartedAt: NOW });
  await assert.rejects(store.createSaved(uid, savedDoc(vid(2)), 10), (e) => e.code === 'failed-precondition');
  await assert.rejects(store.updateSavedFields(uid, vid(1), () => ({ note: 'x' })), (e) => e.code === 'failed-precondition');
  await assert.rejects(store.putHistory(uid, { id: 'a'.repeat(32), createdAt: NOW }), (e) => e.code === 'failed-precondition');
  await assert.rejects(store.reserveQuota(uid, 102, true, NOW, { enabled: true, standaloneSignIn: true, userDailySearches: 5, globalDailyUnits: 1000 }));
  await assert.rejects(store.createSession('h'.repeat(64), { uid, audience: 'https://videos.haru2026.com', createdAt: NOW, expiresAt: NOW + 1 }));
  assert.equal((await db.collection(`users/${uid}/videoFinderSaved`).count().get()).data().count, 1);
  assert.equal((await db.doc(`users/${uid}/videoFinderSaved/${vid(1)}`).get()).data().note, '');
  assert.equal((await db.doc(`videoFinderSessions/${'h'.repeat(64)}`).get()).exists, false);
});

test('정리 작업은 지워진 문서를 만들지 않고, 그사이 최신화된 문서는 건드리지 않는다', async () => {
  const uid = `vf-purge-${Date.now()}`;
  await activeUser(uid);
  const later = NOW + core.META_MAX_AGE_MS;
  const missingRef = db.doc(`users/${uid}/videoFinderSaved/${vid(9)}`);
  assert.equal(await expireSavedMetaIfStale(db, missingRef, later), 'missing');
  assert.equal((await missingRef.get()).exists, false);
  await store.createSaved(uid, savedDoc(vid(1), NOW + 1000), 10);
  assert.equal(await expireSavedMetaIfStale(db, db.doc(`users/${uid}/videoFinderSaved/${vid(1)}`), later), 'skipped');
  await store.createSaved(uid, savedDoc(vid(2), NOW), 10);
  await store.updateSavedFields(uid, vid(2), () => ({ note: '남길 메모' }));
  assert.equal(await expireSavedMetaIfStale(db, db.doc(`users/${uid}/videoFinderSaved/${vid(2)}`), later), 'expired');
  const expired = (await db.doc(`users/${uid}/videoFinderSaved/${vid(2)}`).get()).data();
  assert.equal(expired.meta, null);
  assert.equal(expired.note, '남길 메모');
});

test('Rules 기본 거부: 로그인한 본인도 내 영상 찾기·세션·레지스터 문서를 읽거나 쓸 수 없다', async () => {
  const uid = 'vf-owner';
  await activeUser(uid);
  await db.doc(`users/${uid}/videoFinderSaved/${vid(1)}`).set(savedDoc(vid(1)));
  await db.doc(`videoFinderSessions/${'a'.repeat(64)}`).set({ uid, audience: 'https://videos.haru2026.com', createdAt: NOW, expiresAt: NOW + 1 });
  const denied = (p) => assert.rejects(p, (e) => e?.code === 'permission-denied');
  for (const p of [
    `users/${uid}/videoFinderSaved/${vid(1)}`,
    `users/${uid}/videoFinderHistory/${'b'.repeat(32)}`,
    `users/${uid}/rateLimits/videoFinderSavedLock`,
    `users/${uid}/videoFinderAccess/policy`,
    `users/${uid}/videoFinderAccess/usage`,
    `users/${uid}/videoFinderAiCache/recap_${vid(1)}`,
    `videoFinderSessions/${'a'.repeat(64)}`,
    'videoFinderQuota/2026-11-19',
    'config/videoFinder',
  ]) {
    await denied(getDocFromServer(doc(clientDb, p)));
    await denied(setDoc(doc(clientDb, p), { uid, injected: true }));
  }
});

test('실제 Firestore에서 프리미엄만 예약하고 동시 호출·재시도에도 한 번만 확정한다', async () => {
  const uid = `vf-premium-emulator-${Date.now()}`;
  await activeUser(uid);
  await db.doc('config/videoFinder').set({ questionsEnabled: true }, { merge: true });
  const subscription = db.doc(`users/${uid}/subscription/info`);
  await subscription.set({ plan: 'basic', status: 'active', endDate: new Date(NOW + 7 * 86400000).toISOString() });
  let modelCalls = 0;
  let modelStarted;
  const started = new Promise((resolve) => { modelStarted = resolve; });
  let respond;
  const answer = new Promise((resolve) => { respond = resolve; });
  const access = core.createVideoFinderAccessService({
    store: createFirestoreVideoFinderAccessStore(db),
    now: () => NOW,
    youtube: () => ({ analysisInfo: async () => ({ isPublic: true, durationSeconds: 600 }) }),
    model: () => ({
      analyzeVideo: async () => { modelCalls++; modelStarted(); return answer; },
      answerFromRecap: async () => { throw new Error('unexpected follow-up'); },
    }),
  });
  const question = { action: 'ask', videoId: vid(31), question: '어떤 이야기인가요?', requestId: 'emulator-test-01' };
  assert.equal((await access.handle(uid, { action: 'status' })).policyAccepted, false);
  await assert.rejects(access.requirePolicyFor(uid, 'search', {}), (error) => error.code === 'failed-precondition');
  const accepted = await access.handle(uid, { action: 'acceptPolicy', version: core.VIDEO_FINDER_POLICY_VERSION });
  assert.equal(accepted.questionAccess, 'premium-required');
  await assert.rejects(access.handle(uid, question), (error) => error.code === 'permission-denied');
  assert.equal(modelCalls, 0);
  await subscription.update({ plan: 'premium' });

  const first = access.handle(uid, question);
  await Promise.race([started, first.then(() => { throw new Error('모의 모델 호출을 기다리지 않고 종료했습니다.'); })]);
  try {
    await assert.rejects(access.handle(uid, { ...question, requestId: 'emulator-test-02' }), (error) => error.code === 'unavailable');
  } finally {
    respond({ supported: true, answer: '모의 답변', timestamps: [60], recap: { summary: '모의 요약', segments: [{ t: 60, text: '모의 근거' }] } });
  }
  const result = await first;
  assert.equal(result.status.remainingQuestions, 9);
  assert.equal(result.status.remainingAnalysisSeconds, 6600);
  assert.deepEqual(await access.handle(uid, question), result);
  assert.equal(modelCalls, 1);

  await store.deleteAll(uid);
  assert.equal((await db.collection(`users/${uid}/videoFinderAiCache`).get()).size, 0);
  assert.equal((await access.handle(uid, { action: 'status' })).remainingQuestions, 9);
});
