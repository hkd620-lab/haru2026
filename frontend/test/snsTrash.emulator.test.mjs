// Run with Node >= 22.18 and the Firestore emulator loaded with ../firestore.rules.
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8087 node --test test/snsTrash.emulator.test.mjs
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { createSnsTrashActions } from '../src/app/services/snsTrash.ts';
import { activeSnsRecords, readSnsRecord, snsRecordRevision } from '../src/app/utils/snsRecordState.ts';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error('Only a loopback Firestore emulator is allowed. Never run against production.');
}
const projectId = 'demo-haru-sns-trash';
const baseUrl = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
const apps = [];
function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'emulator-only' }, `sns-test-${uid}-${apps.length}`);
  apps.push(app);
  const db = getFirestore(app);
  const [hostname, port] = host.split(':');
  connectFirestoreEmulator(db, hostname, Number(port), { mockUserToken: { sub: uid } });
  return db;
}
const alice = client('alice');
const aliceOtherDevice = client('alice');
const bob = client('bob');
after(async () => { await Promise.all(apps.map(deleteApp)); });

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
}
async function seed(id, fields, uid = 'alice') {
  const response = await fetch(`${baseUrl}/users/${uid}/snsRecords/${id}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encode(fields).mapValue.fields }),
  });
  assert.equal(response.ok, true, await response.text());
}
async function data(db, id, uid = 'alice') {
  const snapshot = await getDocFromServer(doc(db, 'users', uid, 'snsRecords', id));
  return snapshot.data();
}
const original = (text = '생일축하합니다', thumbnails = []) => ({
  source: 'facebook', timestamp: 1320620400, text, thumbnails,
  date: '2011-11-07', originalMetadata: { imported: true, order: [1, 2] },
});
function withoutTrashMetadata(value) {
  const { isDeleted, deletedAt, restoredAt, updatedAt, ...rest } = value;
  return rest;
}

for (const [kind, text, photos] of [
  ['text-photo', '소중한 하루', ['users/alice/snsThumbnails/one.jpg']],
  ['photo-only', '', ['users/alice/snsThumbnails/two.jpg']],
  ['text-only', '생일축하합니다', []],
]) {
  test(`${kind}: trash/restore preserves all original fields and original date`, async () => {
    const before = original(text, photos);
    await seed(kind, before);
    const actions = createSnsTrashActions(alice, 'alice', () => true);
    assert.equal(await actions.change(readSnsRecord(kind, before), true), true);
    const trashed = await data(alice, kind);
    assert.equal(trashed.isDeleted, true);
    assert.deepEqual(activeSnsRecords([readSnsRecord(kind, trashed)]), []);
    assert.deepEqual(withoutTrashMetadata(trashed), before);
    assert.equal(await actions.change(readSnsRecord(kind, trashed), false), true);
    const restored = await data(aliceOtherDevice, kind);
    assert.equal(restored.isDeleted, false);
    assert.equal('deletedAt' in restored, false);
    assert.deepEqual(withoutTrashMetadata(restored), before);
    assert.equal(activeSnsRecords([readSnsRecord(kind, restored)]).length, 1);
  });
}

test('identical same-date records remain individually selectable; photo refs never migrate', async () => {
  const canonical = original('', ['users/alice/snsThumbnails/canonical.jpg']);
  const duplicate = original('', []);
  await seed('canonical', canonical);
  await seed('duplicate', duplicate);
  const actions = createSnsTrashActions(alice, 'alice', () => true);
  await actions.change(readSnsRecord('canonical', canonical), true);
  assert.deepEqual(await data(alice, 'duplicate'), duplicate);
  assert.deepEqual((await data(alice, 'canonical')).thumbnails, canonical.thumbnails);
  const latest = await data(alice, 'canonical');
  await actions.change(readSnsRecord('canonical', latest), false);
  assert.deepEqual(withoutTrashMetadata(await data(alice, 'canonical')), canonical);
});

test('stale screen cannot overwrite a newly edited record', async () => {
  const before = original();
  await seed('stale', before);
  const selected = readSnsRecord('stale', await data(alice, 'stale'));
  const edited = { ...before, text: '다른 기기에서 수정한 글' };
  await seed('stale', edited);
  await assert.rejects(createSnsTrashActions(alice, 'alice', () => true).change(selected, true), { code: 'conflict' });
  assert.deepEqual(await data(alice, 'stale'), edited);
});

test('duplicate clicks share a request and opposite overlapping actions are blocked', async () => {
  const before = original();
  await seed('clicks', before);
  const record = readSnsRecord('clicks', before);
  const actions = createSnsTrashActions(alice, 'alice', () => true);
  const first = actions.change(record, true);
  assert.equal(actions.change(record, true), first);
  await assert.rejects(actions.change(record, false), { code: 'busy' });
  assert.equal(await first, true);
  const once = await data(alice, 'clicks');
  assert.equal(await actions.change(record, true), false);
  assert.deepEqual(await data(alice, 'clicks'), once, 'idempotent retry must not refresh timestamps');
});

test('two devices concurrently deleting produce one transition, without lost original data', async () => {
  const before = original('경쟁 테스트', ['users/alice/snsThumbnails/race.jpg']);
  await seed('concurrent', before);
  const selected = readSnsRecord('concurrent', before);
  const results = await Promise.all([
    createSnsTrashActions(alice, 'alice', () => true).change(selected, true),
    createSnsTrashActions(aliceOtherDevice, 'alice', () => true).change(selected, true),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.deepEqual(withoutTrashMetadata(await data(alice, 'concurrent')), before);
});

test('late delete from before a delete/restore cycle cannot undo the restoration', async () => {
  const before = original();
  await seed('cycle', before);
  const oldSelection = readSnsRecord('cycle', before);
  const actions = createSnsTrashActions(alice, 'alice', () => true);
  await actions.change(oldSelection, true);
  await actions.change(readSnsRecord('cycle', await data(alice, 'cycle')), false);
  await assert.rejects(
    createSnsTrashActions(aliceOtherDevice, 'alice', () => true).change(oldSelection, true),
    { code: 'conflict' },
  );
  assert.equal((await data(alice, 'cycle')).isDeleted, false);
});

test('session invalidation before action and during transaction read prevents writes', async () => {
  const before = original();
  await seed('session', before);
  const selected = readSnsRecord('session', before);
  await assert.rejects(createSnsTrashActions(alice, 'alice', () => false).change(selected, true), { code: 'session' });
  let checks = 0;
  await assert.rejects(createSnsTrashActions(alice, 'alice', () => ++checks < 3).change(selected, true), { code: 'session' });
  assert.deepEqual(await data(alice, 'session'), before);
});

test('repository Rules block cross-user reads and trash/restore writes', async () => {
  const before = original();
  await seed('private', before, 'bob');
  await assert.rejects(data(alice, 'private', 'bob'), { code: 'permission-denied' });
  await assert.rejects(
    createSnsTrashActions(alice, 'bob', () => true).change(readSnsRecord('private', before), true),
    { code: 'permission-denied' },
  );
  const owner = createSnsTrashActions(bob, 'bob', () => true);
  await owner.change(readSnsRecord('private', before), true);
  const trashed = await data(bob, 'private', 'bob');
  await assert.rejects(
    createSnsTrashActions(alice, 'bob', () => true).change(readSnsRecord('private', trashed), false),
    { code: 'permission-denied' },
  );
  assert.equal((await data(bob, 'private', 'bob')).isDeleted, true);
});

test('a new client session reads the persisted deletion and can restore it', async () => {
  const before = original();
  await seed('relogin', before);
  await createSnsTrashActions(alice, 'alice', () => true).change(readSnsRecord('relogin', before), true);
  const returningUser = client('alice');
  const loaded = await data(returningUser, 'relogin');
  assert.equal(loaded.isDeleted, true);
  await createSnsTrashActions(returningUser, 'alice', () => true).change(readSnsRecord('relogin', loaded), false);
  assert.deepEqual(withoutTrashMetadata(await data(alice, 'relogin')), before);
});

test('revision preserves nanosecond differences; active filtering retains legacy records', () => {
  assert.notEqual(snsRecordRevision({ seconds: 1, nanoseconds: 1 }), snsRecordRevision({ seconds: 1, nanoseconds: 2 }));
  assert.equal(snsRecordRevision({ b: 2, a: { y: 1, x: 0 } }), snsRecordRevision({ a: { x: 0, y: 1 }, b: 2 }));
  assert.deepEqual(activeSnsRecords([{ id: 'legacy' }, { id: 'active', isDeleted: false }, { id: 'trash', isDeleted: true }]).map((r) => r.id), ['legacy', 'active']);
});
