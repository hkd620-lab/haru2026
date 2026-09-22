import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error('Only a loopback Firestore emulator is allowed. Never run against production.');
}

const projectId = process.env.GCLOUD_PROJECT || 'demo-haru-law-cache';
if (!projectId.startsWith('demo-')) {
  throw new Error('The Rules test must use a demo project only.');
}

const currentFile = fileURLToPath(import.meta.url);
const frontendRequire = createRequire(path.resolve(path.dirname(currentFile), '../../frontend/package.json'));
const functionsRequire = createRequire(path.resolve(path.dirname(currentFile), '../package.json'));
const {
  deleteApp: deleteClientApp,
  initializeApp: initializeClientApp,
} = frontendRequire('firebase/app');
const {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  setDoc,
  updateDoc,
} = frontendRequire('firebase/firestore');
const {
  deleteApp: deleteAdminApp,
  initializeApp: initializeAdminApp,
} = functionsRequire('firebase-admin/app');
const { getFirestore: getAdminFirestore } = functionsRequire('firebase-admin/firestore');

const [hostname, portText] = host.split(':');
const clientApps = [];
function client(name, uid) {
  const app = initializeClientApp(
    { projectId, apiKey: 'emulator-only' },
    `law-cache-${name}-${Date.now()}-${clientApps.length}`,
  );
  clientApps.push(app);
  const firestore = getFirestore(app);
  const options = uid ? { mockUserToken: { sub: uid } } : {};
  connectFirestoreEmulator(firestore, hostname, Number(portText), options);
  return firestore;
}

const unauthenticated = client('unauthenticated');
const authenticated = client('authenticated', 'law-cache-user');
const adminApp = initializeAdminApp({ projectId }, `law-cache-admin-${Date.now()}`);
const adminDb = getAdminFirestore(adminApp);

after(async () => {
  await Promise.all(clientApps.map(deleteClientApp));
  await deleteAdminApp(adminApp);
});

function assertPermissionDenied(promise) {
  return assert.rejects(promise, (error) => error?.code === 'permission-denied');
}

test('lawConsultCache has one deny-all Rules declaration', () => {
  const rules = fs.readFileSync(path.resolve(path.dirname(currentFile), '../../firestore.rules'), 'utf8');
  const declarations = rules.match(/match\s+\/lawConsultCache\/\{[^}]+\}/g) || [];
  assert.equal(declarations.length, 1);
  assert.match(rules, /match\s+\/lawConsultCache\/\{cacheId\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('unauthenticated and authenticated clients cannot read/create/update/delete', async () => {
  const existingId = 'admin-seeded';
  await adminDb.collection('lawConsultCache').doc(existingId).set({ explanation: 'admin only' });

  for (const [name, db] of [
    ['unauthenticated', unauthenticated],
    ['authenticated', authenticated],
  ]) {
    await assertPermissionDenied(getDocFromServer(doc(db, 'lawConsultCache', existingId)), `${name} read`);
    await assertPermissionDenied(setDoc(doc(db, 'lawConsultCache', `${name}-create`), { explanation: 'blocked' }));
    await assertPermissionDenied(updateDoc(doc(db, 'lawConsultCache', existingId), { explanation: 'blocked' }));
    await assertPermissionDenied(deleteDoc(doc(db, 'lawConsultCache', existingId)));
  }
});

test('Admin SDK can read/write/update/delete lawConsultCache', async () => {
  const ref = adminDb.collection('lawConsultCache').doc('admin-access');
  await ref.set({ explanation: 'created' });
  assert.equal((await ref.get()).data().explanation, 'created');
  await ref.update({ explanation: 'updated' });
  assert.equal((await ref.get()).data().explanation, 'updated');
  await ref.delete();
  assert.equal((await ref.get()).exists, false);
});
