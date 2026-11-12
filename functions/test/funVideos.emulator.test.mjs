import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test, after } from 'node:test';
import { fileURLToPath } from 'node:url';

const host = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !projectId?.startsWith('demo-')) {
  throw new Error('This test requires a loopback Firestore emulator and demo project.');
}

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRequire = createRequire(path.resolve(here, '../../frontend/package.json'));
const functionsRequire = createRequire(path.resolve(here, '../package.json'));
const { initializeApp, deleteApp } = frontendRequire('firebase/app');
const { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, setDoc } = frontendRequire('firebase/firestore');
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp, getApps } = functionsRequire('firebase-admin/app');
const { getFirestore: getAdminFirestore } = functionsRequire('firebase-admin/firestore');
const { getFunVideos } = functionsRequire('./lib/funVideos.js');
const { getFunVideoMetadata } = functionsRequire('./lib/funVideoMetadata.js');

const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const [hostname, port] = host.split(':');
const clients = [];
function client(name, uid) {
  const app = initializeApp({ projectId, apiKey: 'emulator-only' }, `fun-video-${name}`);
  clients.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, hostname, Number(port), uid ? { mockUserToken: { sub: uid } } : {});
  return db;
}
const adminClient = client('admin', ADMIN_UID);
const paidClient = client('paid', 'fun-video-paid');
const freeClient = client('free', 'fun-video-free');
const anonymousClient = client('anonymous');
const adminApp = getApps().length ? getApps()[0] : initializeAdminApp({ projectId });
const adminDb = getAdminFirestore(adminApp);

after(async () => {
  await Promise.all(clients.map(deleteApp));
  await deleteAdminApp(adminApp);
});

const videoId = 'M7lc1UVf-VE';
const videoPath = `funVideos/${videoId}`;
const validVideo = {
  title: '시험 영상', videoId, url: `https://www.youtube.com/watch?v=${videoId}`,
  createdAt: new Date(),
};
const denied = (promise) => assert.rejects(promise, (error) => error?.code === 'permission-denied');

test('funVideos Rules allow only valid admin writes and block direct subscriber reads', async () => {
  await setDoc(doc(adminClient, videoPath), validVideo);
  assert.equal((await getDocFromServer(doc(adminClient, videoPath))).data().title, '시험 영상');
  for (const db of [paidClient, freeClient, anonymousClient]) {
    await denied(getDocFromServer(doc(db, videoPath)));
    await denied(setDoc(doc(db, `funVideos/${videoId}`), validVideo));
  }
  await denied(setDoc(doc(adminClient, 'funVideos/invalid-id'), { ...validVideo, videoId: 'invalid-id' }));
  await denied(setDoc(doc(adminClient, videoPath), { ...validVideo, url: 'https://example.com/watch' }));
  await denied(setDoc(doc(adminClient, videoPath), { ...validVideo, title: '' }));
  await denied(setDoc(doc(adminClient, videoPath), { ...validVideo, title: 'x'.repeat(101) }));
  await denied(setDoc(doc(adminClient, videoPath), { ...validVideo, extra: true }));
});

test('getFunVideos rejects expired, free and unauthenticated callers', async () => {
  await adminDb.doc(videoPath).set(validVideo);
  await adminDb.doc('users/fun-video-paid/subscription/info').set({
    plan: 'basic', status: 'active', endDate: '2099-01-01T00:00:00.000Z',
  });
  await adminDb.doc('users/fun-video-expired/subscription/info').set({
    plan: 'premium', status: 'cancelled', endDate: '2000-01-01T00:00:00.000Z',
  });
  assert.equal((await getFunVideos.run({ auth: { uid: 'fun-video-paid' } })).videos.length, 1);
  assert.equal((await getFunVideos.run({ auth: { uid: ADMIN_UID } })).videos.length, 1);
  for (const uid of ['fun-video-expired', 'fun-video-free']) {
    await assert.rejects(getFunVideos.run({ auth: { uid } }), (error) => error?.code === 'permission-denied');
  }
  await assert.rejects(getFunVideos.run({}), (error) => error?.code === 'unauthenticated');
});

test('getFunVideoMetadata is admin-only and validates video IDs before any network call', async () => {
  await assert.rejects(
    getFunVideoMetadata.run({ auth: { uid: 'fun-video-paid' }, data: { videoId } }),
    (error) => error?.code === 'permission-denied',
  );
  await assert.rejects(
    getFunVideoMetadata.run({ auth: { uid: ADMIN_UID }, data: { videoId: 'invalid-id' } }),
    (error) => error?.code === 'invalid-argument',
  );
});
