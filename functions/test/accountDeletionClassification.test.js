// All storage, Auth, payment and Firestore calls are in-memory fakes. No app/credentials/network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Timestamp } = require('firebase-admin/firestore');
const load = require('./aiLibraryClassificationSource');
const { CLASSIFICATION_PRIVATE_ROOT, createClassificationStore } = load('aiLibraryClassificationStore');
const { classificationManifestHash, planClassification } = load('aiLibraryClassification');
const deleted = Symbol('delete');
const started = Timestamp.fromMillis(1);
const owner = 'synthetic-withdrawn';
const due = () => ({ accountStatus: 'pending_deletion', deletionScheduledAt: Timestamp.fromMillis(0) });

function fixture() {
  const docs = new Map([['config/accountDeletion', { enabled: true }], ['users/' + owner, due()]]);
  const events = [];
  const logs = [];
  const hooks = {};
  const snapshot = ref => ({ id: ref.path.split('/').at(-1), ref, exists: docs.has(ref.path), data: () => docs.get(ref.path) });
  const ref = pathname => ({
    path: pathname, collection: id => ref(pathname + '/' + id), doc: id => ref(pathname + '/' + id),
    get: async () => snapshot(ref(pathname)),
    delete: async () => { events.push('delete:' + pathname); docs.delete(pathname); },
    set: async (value, options) => { docs.set(pathname, options?.merge ? { ...docs.get(pathname), ...value } : value); },
    update: async patch => update(pathname, patch),
    where(field, op, value) { return query(pathname, [[field, op, value]]); },
  });
  const query = (pathname, filters) => ({
    where: (field, op, value) => query(pathname, [...filters, [field, op, value]]),
    limit: () => query(pathname, filters),
    get: async () => {
      const rows = [...docs].filter(([key, data]) => key.startsWith(pathname + '/') && key.split('/').length === pathname.split('/').length + 1 &&
        filters.every(([field, op, value]) => op === '==' ? data[field] === value : data[field]?.toMillis() <= value.toMillis()))
        .map(([key]) => snapshot(ref(key)));
      if (pathname === 'users') await hooks.afterQuery?.();
      return { docs: rows, size: rows.length };
    },
  });
  function update(pathname, patch) {
    assert.ok(docs.has(pathname), 'update cannot recreate a missing document');
    const next = { ...docs.get(pathname) };
    for (const [key, value] of Object.entries(patch)) value === deleted ? delete next[key] : next[key] = value;
    docs.set(pathname, next);
  }
  const db = {
    doc: ref, collection: ref,
    runTransaction: async work => {
      const writes = [];
      const result = await work({
        get: async r => snapshot(r),
        update: (r, patch) => writes.push(() => { events.push('update:' + r.path); update(r.path, patch); }),
        set: (r, value) => writes.push(() => docs.set(r.path, value)),
        create: (r, value) => writes.push(() => { assert.ok(!docs.has(r.path)); docs.set(r.path, value); }),
      });
      writes.forEach(write => write());
      return result;
    },
    recursiveDelete: async r => {
      events.push('recursiveDelete:' + r.path);
      if (r.path === CLASSIFICATION_PRIVATE_ROOT + '/' + owner) await hooks.privateSweep?.();
      for (const key of docs.keys()) if (key === r.path || key.startsWith(r.path + '/')) docs.delete(key);
    },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/accountDeletion.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  }).outputText;
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const dependencies = {
    'firebase-functions/v2/https': { onCall: (_options, handler) => handler, HttpsError },
    'firebase-functions/v2/scheduler': { onSchedule: (_options, handler) => handler },
    'firebase-admin/firestore': { Timestamp, FieldValue: { delete: () => deleted, serverTimestamp: () => started } },
    'firebase-admin/storage': { getStorage: () => ({ bucket: () => ({ getFiles: async () => { events.push('storage'); return [[]]; } }) }) },
    'firebase-functions/logger': { info: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    'firebase-admin': { apps: [{}], firestore: () => db, auth: () => ({ deleteUser: async uid => { events.push('auth:' + uid); await hooks.auth?.(); } }) },
    './subscriptionHelpers': { cancelSubscriptionForUid: async () => {}, revokeBillingKeyForWithdrawal: async () => { await hooks.revoke?.(); }, PORTONE_API_SECRET: { value: () => 'synthetic-only' } },
    './aiLibraryClassificationStore': { CLASSIFICATION_PRIVATE_ROOT },
  };
  vm.runInThisContext(`(function(require,exports){${code}\n})`)(id => { assert.ok(id in dependencies, id); return dependencies[id]; }, exports);
  return { docs, events, hooks, logs, db, api: exports };
}

function seedPrivateTree(f, uid = owner) {
  const root = CLASSIFICATION_PRIVATE_ROOT + '/' + uid;
  for (const suffix of ['control/runtime', 'plans/p', 'approvals/a', 'reviews/r', 'attempts/a', 'jobs/j', 'jobs/j/restorations/r', 'jobs/missing/restorations/nested']) f.docs.set(root + '/' + suffix, { synthetic: true });
  return root;
}

test('scheduled deletion sweeps the entire missing-root owner tree before Auth/users, preserves other owners', async () => {
  const f = fixture(); const root = seedPrivateTree(f); seedPrivateTree(f, owner + '-other');
  f.docs.set('unrelated/retained', { synthetic: true });
  assert.equal(f.docs.has(root), false);
  await f.api.executeScheduledDeletion();
  assert.ok(![...f.docs.keys()].some(key => key === root || key.startsWith(root + '/')));
  assert.ok(f.docs.has(CLASSIFICATION_PRIVATE_ROOT + '/' + owner + '-other/jobs/j/restorations/r'));
  assert.ok(f.docs.has('unrelated/retained'));
  assert.ok(!f.docs.has('users/' + owner));
  assert.ok(f.events.indexOf('update:users/' + owner) < f.events.indexOf('recursiveDelete:' + root));
  assert.ok(f.events.indexOf('recursiveDelete:' + root) < f.events.indexOf('auth:' + owner));
  assert.ok(f.events.indexOf('auth:' + owner) < f.events.indexOf('delete:users/' + owner));
  assert.equal(f.logs.filter(args => String(args[0]).includes('✅ 계정 삭제 완료')).length, 1);
  await f.api.executeScheduledDeletion();
  assert.equal(f.events.filter(event => event === 'auth:' + owner).length, 1);
});

test('partial sweep failure keeps Auth/root retryable, reports failure, and retries idempotently', async () => {
  const f = fixture(); const root = seedPrivateTree(f);
  f.hooks.privateSweep = async () => { f.docs.delete(root + '/plans/p'); throw Error('synthetic sweep failure'); };
  await f.api.executeScheduledDeletion();
  assert.ok(f.docs.has(root + '/jobs/j/restorations/r'));
  assert.equal(f.docs.get('users/' + owner).accountStatus, 'pending_deletion');
  assert.equal(f.docs.get('users/' + owner).deletionStartedAt, started);
  assert.ok(!f.events.some(event => event.startsWith('auth:') || event.startsWith('storage')));
  assert.equal(f.logs.filter(args => String(args[0]).includes('✅ 계정 삭제 완료')).length, 0);
  assert.equal(f.logs.filter(args => String(args[0]).includes('❌ 계정 삭제 실패')).length, 1);
  delete f.hooks.privateSweep;
  await f.api.executeScheduledDeletion();
  assert.ok(!f.docs.has('users/' + owner));
  assert.ok(![...f.docs.keys()].some(key => key.startsWith(root + '/')));
});

test('Auth failure keeps the irreversible claim and repeat sweep succeeds without a private root', async () => {
  const f = fixture(); seedPrivateTree(f);
  f.hooks.auth = async () => { throw Error('synthetic Auth failure'); };
  await f.api.executeScheduledDeletion();
  assert.equal(f.docs.get('users/' + owner).deletionStartedAt, started);
  await assert.rejects(f.api.cancelAccountDeletion({ auth: { uid: owner } }), error => error.code === 'failed-precondition');
  delete f.hooks.auth;
  await f.api.executeScheduledDeletion();
  assert.ok(!f.docs.has('users/' + owner));
});

test('cancellation winning after query prevents every destructive step; claim winning blocks cancellation', async () => {
  const f = fixture(); const root = seedPrivateTree(f);
  f.hooks.afterQuery = () => f.api.cancelAccountDeletion({ auth: { uid: owner } });
  await f.api.executeScheduledDeletion();
  assert.ok(f.docs.has(root + '/plans/p'));
  assert.equal(f.docs.get('users/' + owner).accountStatus, undefined);
  assert.ok(!f.events.some(event => event.startsWith('recursiveDelete:') || event.startsWith('auth:') || event === 'storage'));
  const g = fixture(); seedPrivateTree(g);
  g.hooks.privateSweep = async () => {
    await assert.rejects(g.api.cancelAccountDeletion({ auth: { uid: owner } }), error => error.code === 'failed-precondition');
  };
  await g.api.executeScheduledDeletion();
  await assert.rejects(g.api.cancelAccountDeletion({ auth: { uid: owner } }), error => error.code === 'failed-precondition');
  assert.ok(!g.docs.has('users/' + owner), 'late cancellation must not recreate a user root');
});

test('kill switch, future schedule, and authentication retain existing deletion protections', async () => {
  const f = fixture(); seedPrivateTree(f);
  f.docs.set('config/accountDeletion', { enabled: false });
  await f.api.executeScheduledDeletion(); assert.equal(f.events.length, 0);
  await assert.rejects(f.api.cancelAccountDeletion({}), error => error.code === 'unauthenticated');
  f.docs.set('config/accountDeletion', { enabled: true });
  f.docs.set('users/' + owner, { ...due(), deletionScheduledAt: Timestamp.fromMillis(Date.now() + 100000) });
  await f.api.executeScheduledDeletion(); assert.equal(f.events.length, 0);
});

test('delayed deletion request cannot postpone a claimed deletion or recreate a finished user', async () => {
  for (const state of ['claimed', 'deleted']) {
    const f = fixture(); let calls = 0;
    f.hooks.revoke = async () => {
      if (++calls !== 2) return;
      if (state === 'claimed') f.docs.set('users/' + owner, { ...due(), deletionStartedAt: started });
      else f.docs.delete('users/' + owner);
    };
    await assert.rejects(f.api.requestAccountDeletion({ auth: { uid: owner } }), error => error.code === 'failed-precondition');
    assert.equal(calls, 2, 'billing cleanup order is unchanged');
    if (state === 'claimed') assert.equal(f.docs.get('users/' + owner).deletionScheduledAt.toMillis(), 0);
    else assert.ok(!f.docs.has('users/' + owner));
  }
  const f = fixture();
  const result = await f.api.requestAccountDeletion({ auth: { uid: owner } });
  assert.equal(result.success, true);
  const remaining = Date.parse(result.deletionScheduledAt) - Date.now();
  assert.ok(remaining > 29.99 * 86400000 && remaining <= 30 * 86400000, '30-day grace remains');
});

test('store denies missing/pending/deleting users before running caller work', async () => {
  for (const state of [undefined, due(), { deletionStartedAt: started }]) {
    const f = fixture(); state ? f.docs.set('users/' + owner, state) : f.docs.delete('users/' + owner);
    const store = createClassificationStore(f.db, owner); let calls = 0;
    await assert.rejects(store.transaction(async () => { calls++; }), /account_unavailable/);
    assert.equal(calls, 0);
  }
});

test('active owner ledger is retained; a stale request with a recreated user cannot recreate a swept private job', async () => {
  const f = fixture(); f.docs.set('users/' + owner, {});
  const manifest = planClassification(owner, [], Date.now() + 60000, 2753); const key = classificationManifestHash(manifest);
  const root = CLASSIFICATION_PRIVATE_ROOT + '/' + owner;
  f.docs.set(root + '/plans/' + key, { manifest });
  const store = createClassificationStore(f.db, owner);
  await store.transaction(async tx => { tx.putAttempt('a', { manifestHash: key }); tx.putJob(key, { synthetic: true }); });
  assert.ok(f.docs.has(root + '/attempts/a'));
  assert.ok(await store.transaction(tx => tx.getJob(key)));
  assert.ok(f.docs.has(root + '/attempts/a'));
  await f.db.recursiveDelete(f.db.doc(root));
  // Same shape as a stale valid token recreating an allowed minimal attribution root.
  f.docs.set('users/' + owner, { signupReferrerOrigin: 'synthetic' });
  for (const work of [tx => tx.getJob(key), async tx => tx.putJob(key, { synthetic: true }), async tx => tx.putAttempt('a', { manifestHash: key })]) {
    await assert.rejects(store.transaction(work), /plan_not_found/);
  }
  assert.ok(![...f.docs.keys()].some(path => path.startsWith(root + '/')));
});
