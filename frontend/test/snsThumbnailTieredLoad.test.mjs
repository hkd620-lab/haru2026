import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuthScopedThumbnailCache } from '../src/app/utils/snsThumbnailAuthCache.js';
import { createBatchedRequestQueue } from '../src/app/utils/snsThumbnailRequestQueue.js';
import {
  createPersistentThumbnailCache,
  makeRecordId,
  PERSISTENT_THUMBNAIL_SCHEMA_VERSION,
  PERSISTENT_THUMBNAIL_TTL_MS,
} from '../src/app/utils/snsThumbnailPersistentCache.js';
import {
  createSnsThumbnailCounters,
  createTieredThumbnailLoad,
  handleAuthSessionInvalidated,
  handleAuthUserTransition,
} from '../src/app/utils/snsThumbnailTieredLoad.js';

const unhandled = [];
process.on('unhandledRejection', (reason) => unhandled.push(reason));

const DAY = 24 * 60 * 60 * 1000;
const UID_A = 'uid-a';
const UID_B = 'uid-b';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = () => wait(25);
const pathOf = (uid, group, n) => `users/${uid}/snsThumbnails/${group}/${n}.jpg`;

function createFakeStore() {
  const rows = new Map();
  const store = {
    rows,
    delays: {},
    failures: {},
    calls: { getMany: 0, putMany: 0 },
    async step(name) {
      if (name in store.calls) store.calls[name] += 1;
      if (store.delays[name]) await wait(store.delays[name]);
      const failure = store.failures[name];
      if (failure?.hang) await new Promise(() => {});
      if (failure?.error) throw failure.error;
    },
    async getMany(ids) {
      await store.step('getMany');
      return ids.map((id) => (rows.has(id) ? structuredClone(rows.get(id)) : null));
    },
    async putMany(records) {
      await store.step('putMany');
      records.forEach((record) => rows.set(record.id, structuredClone(record)));
    },
    async deleteMany(ids) {
      await store.step('deleteMany');
      ids.forEach((id) => rows.delete(id));
    },
    async touchMany(ids, timestamp) {
      ids.forEach((id) => rows.has(id) && (rows.get(id).lastUsedAt = timestamp));
    },
    async deleteUser(uid) {
      await store.step('deleteUser');
      for (const [id, row] of [...rows]) if (row.uid === uid) rows.delete(id);
    },
    async deleteExceptUser(uid) {
      await store.step('deleteExceptUser');
      for (const [id, row] of [...rows]) if (!uid || row.uid !== uid) rows.delete(id);
    },
    async listMeta() {
      return [...rows.values()].map(({ dataBase64, ...meta }) => structuredClone(meta));
    },
  };
  return store;
}

// Mirrors the wiring in snsPrivateThumbnailState.ts: real memory cache, real queue,
// real persistent policy, fake IndexedDB store and fake callable.
function createHarness({ store = createFakeStore(), clock = { value: 1_800_000_000_000 }, callableDelayMs = 2 } = {}) {
  const memory = createAuthScopedThumbnailCache({ maxEntries: 300, maxWeight: 12 * 1024 * 1024 });
  const persistent = createPersistentThumbnailCache({
    store,
    now: () => clock.value,
    schedule: () => {},
    readTimeoutMs: 40,
    writeTimeoutMs: 200,
  });
  const counters = createSnsThumbnailCounters();
  const callableCalls = [];
  const server = {
    // Server-side "file content" per path; bump `version` to model a replaced thumbnail.
    version: new Map(),
    missing: new Set(),
    body: (thumbPath) => Buffer.from(`${thumbPath}#${server.version.get(thumbPath) || 1}`).toString('base64'),
    hash: (thumbPath) => crypto.createHash('sha256').update(`${thumbPath}#${server.version.get(thumbPath) || 1}`).digest('hex'),
  };

  const queue = createBatchedRequestQueue(async (requests) => {
    callableCalls.push(requests.map((request) => request.path));
    counters.networkBatches += 1;
    await wait(callableDelayMs);
    const persistEntries = [];
    const results = requests.map((request) => {
      if (!memory.isCurrent(request.scope)) return { ok: false, code: 'auth-user-changed' };
      if (server.missing.has(request.path)) return { ok: false, code: 'not-found' };
      const dataBase64 = server.body(request.path);
      const item = {
        contentType: 'image/jpeg',
        dataBase64,
        contentHash: server.hash(request.path),
        fallbackKey: request.cacheKey,
      };
      memory.set(request.scope, request.cacheKey, item, dataBase64.length);
      persistEntries.push({ path: request.path, item });
      return { ok: true, item };
    });
    if (persistEntries.length > 0) {
      const persistScope = requests[0].scope;
      void persistent.putMany(requests[0].userUid, persistEntries, () => memory.isCurrent(persistScope));
    }
    return results;
  }, { batchSize: 4 });

  const harness = {
    memory,
    persistent,
    counters,
    callableCalls,
    server,
    store,
    clock,
    setUser(uid) {
      const previousUid = memory.snapshot().activeUserUid;
      if (memory.setUser(uid)) {
        queue.clear('auth-user-changed');
        handleAuthUserTransition({ previousUid, nextUid: uid || null, persistentCache: persistent });
      }
    },
    invalidate() {
      const activeUid = memory.snapshot().activeUserUid;
      memory.invalidate();
      queue.clear('auth-session-invalidated');
      handleAuthSessionInvalidated({ activeUid, persistentCache: persistent });
    },
    load(uid, paths, options = {}) {
      const scope = memory.captureScope(uid);
      const load = createTieredThumbnailLoad({
        userUid: uid,
        paths,
        scope,
        cacheKeyFor: (thumbPath) => `${uid}:${thumbPath}`,
        memoryCache: memory,
        persistentCache: persistent,
        requestFromNetwork: (thumbPath, cacheKey) => queue.request({
          key: cacheKey,
          batchKey: `${uid}:${scope.generation}`,
          value: { userUid: uid, path: thumbPath, cacheKey, scope },
        }),
        releaseNetworkRequest: (cacheKey) => queue.release(cacheKey),
        isCurrent: () => memory.isCurrent(scope),
        bypassCache: Boolean(options.bypassCache),
        counters,
      });
      return { ...load, isCurrent: () => memory.isCurrent(scope) };
    },
    /** A fresh page load: new memory cache and queue, same "IndexedDB". */
    reload() {
      return createHarness({ store, clock, callableDelayMs });
    },
  };
  return harness;
}

const group = (uid, name, count) => Array.from({ length: count }, (_, n) => pathOf(uid, name, n));
const fourFields = ({ contentType, dataBase64, contentHash, fallbackKey }) => ({ contentType, dataBase64, contentHash, fallbackKey });

// 1. First request: one callable call (<= 4 paths), memory and persistent both filled.
{
  const h = createHarness();
  h.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 4);
  const results = await h.load(UID_A, paths).promise;
  await settle();
  assert.equal(h.callableCalls.length, 1);
  assert.ok(h.callableCalls[0].length <= 4);
  assert.ok(results.every((result) => result.ok));
  assert.equal(h.memory.snapshot().size, 4);
  assert.equal(h.store.rows.size, 4, 'network responses are persisted');
  assert.equal(h.counters.networkRequests, 4);
  assert.equal(h.counters.memoryHits + h.counters.persistentHits, 0);
}

// 2. Second request after a "reload" (new memory + queue, same store): zero callable calls.
{
  const first = createHarness();
  first.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 8);
  const firstResults = await first.load(UID_A, paths).promise;
  await settle();

  const second = first.reload();
  second.setUser(UID_A);
  const secondResults = await second.load(UID_A, paths).promise;
  assert.equal(second.callableCalls.length, 0, 'persisted thumbnails need no callable');
  assert.equal(second.counters.networkRequests, 0);
  assert.equal(second.counters.persistentHits, 8);
  assert.deepEqual(secondResults.map((r) => fourFields(r.item)), firstResults.map((r) => fourFields(r.item)));
  assert.equal(second.memory.snapshot().size, 8, 'persistent hits refill the memory cache');

  const third = await second.load(UID_A, paths).promise;
  assert.equal(second.counters.memoryHits, 8, 'same-session re-entry is served from memory');
  assert.equal(second.callableCalls.length, 0);
  assert.equal(third.length, 8);
}

// 3. Concurrent identical loads share one network request.
{
  const h = createHarness();
  h.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 3);
  const [one, two] = await Promise.all([h.load(UID_A, paths).promise, h.load(UID_A, paths).promise]);
  assert.equal(h.callableCalls.length, 1);
  assert.equal(h.callableCalls[0].length, 3);
  assert.deepEqual(one.map((r) => r.item.contentHash), two.map((r) => r.item.contentHash));
}

// 4. UID separation: B never sees A's persisted thumbnails, even for the same path.
{
  const first = createHarness();
  first.setUser(UID_A);
  const pathsA = group(UID_A, 'doc1', 2);
  await first.load(UID_A, pathsA).promise;
  await settle();
  const validRowOfA = structuredClone([...first.store.rows.values()][0]);

  const second = first.reload();
  second.setUser(UID_B);
  await settle();
  assert.equal([...second.store.rows.values()].some((row) => row.uid === UID_A), false, 'A rows are removed when B signs in');
  const results = await second.load(UID_B, group(UID_B, 'doc9', 2)).promise;
  assert.equal(second.counters.persistentHits, 0);
  assert.ok(results.every((result) => result.item.fallbackKey.startsWith(`${UID_B}:`)));
  assert.equal(second.callableCalls.length, 1);

  // A well-formed A row planted under B's key must still never be served to B.
  const third = second.reload();
  third.setUser(UID_B);
  await settle();
  third.store.rows.set(makeRecordId(UID_B, pathsA[0]), structuredClone(validRowOfA));
  const leak = await third.load(UID_B, [pathsA[0]]).promise;
  assert.equal(third.counters.persistentHits, 0, 'a planted A row under B key is not served');
  assert.equal(third.callableCalls.flat().length, 1, 'B falls back to the (server-authorised) network path');
  assert.equal(leak[0].ok, true);
}

// 5. Logout / account switch.
{
  // explicit sign-out deletes the persistent cache of the active user and clears memory
  const h = createHarness();
  h.setUser(UID_A);
  await h.load(UID_A, group(UID_A, 'doc1', 4)).promise;
  await settle();
  assert.equal(h.store.rows.size, 4);
  h.invalidate(); // AuthContext.signOut() runs this before firebaseSignOut resolves
  await settle();
  assert.equal(h.store.rows.size, 0, 'explicit sign-out removes A persistent thumbnails immediately');
  assert.equal(h.memory.snapshot().size, 0, 'sign-out clears memory');
  h.setUser(null); // what onAuthStateChanged reports afterwards
  await settle();
  assert.equal(h.store.rows.size, 0);
}
{
  // the auth listener alone (session ended elsewhere, no signOut() call) also removes the previous user
  const h = createHarness();
  h.setUser(UID_A);
  await h.load(UID_A, group(UID_A, 'doc1', 4)).promise;
  await settle();
  assert.equal(h.store.rows.size, 4);
  h.setUser(null);
  await settle();
  assert.equal(h.store.rows.size, 0, 'A -> null via onAuthStateChanged deletes A');
}
{
  // A -> B switch deletes A, and B's results never contain A's photos
  const h = createHarness();
  h.setUser(UID_A);
  await h.load(UID_A, group(UID_A, 'doc1', 4)).promise;
  await settle();
  h.setUser(UID_B);
  await settle();
  assert.equal(h.store.rows.size, 0);
  const results = await h.load(UID_B, group(UID_B, 'doc1', 2)).promise;
  assert.ok(results.every((result) => result.item.fallbackKey.startsWith(`${UID_B}:`)));
}
{
  // late response from A arriving after the switch is stored neither in memory nor persistently
  const h = createHarness({ callableDelayMs: 40 });
  h.setUser(UID_A);
  const pending = h.load(UID_A, group(UID_A, 'late', 2));
  const outcome = pending.promise.then(() => 'resolved', (error) => error.message);
  await wait(10); // request is now in flight
  h.setUser(UID_B);
  assert.equal(await outcome, 'auth-user-changed');
  await wait(80);
  assert.equal(h.memory.snapshot().size, 0, 'late A response must not refill memory');
  assert.equal(h.store.rows.size, 0, 'late A response must not be persisted');
  assert.equal(h.store.calls.putMany, 0);
}
{
  // A signs out while the response is on its way (no A -> B switch): nothing is persisted either
  const h = createHarness({ callableDelayMs: 40 });
  h.setUser(UID_A);
  const pending = h.load(UID_A, group(UID_A, 'late', 2));
  const outcome = pending.promise.then(() => 'resolved', (error) => error.message);
  await wait(10);
  h.invalidate();
  assert.equal(await outcome, 'auth-session-invalidated');
  await wait(80);
  assert.equal(h.store.rows.size, 0);
}
{
  // app start: persisted A cache survives null -> A, other users' rows are cleaned
  const first = createHarness();
  first.setUser(UID_A);
  await first.load(UID_A, group(UID_A, 'doc1', 2)).promise;
  await settle();
  first.store.rows.set(makeRecordId(UID_B, pathOf(UID_B, 'x', 0)), {
    id: makeRecordId(UID_B, pathOf(UID_B, 'x', 0)), uid: UID_B, path: pathOf(UID_B, 'x', 0),
  });

  const reloaded = first.reload();
  reloaded.setUser(null); // transient logged-out state before Firebase restores the session
  await settle();
  assert.equal(reloaded.store.rows.size, 3, 'a null with no previous active user must not delete anything');
  reloaded.setUser(UID_A);
  await settle();
  assert.deepEqual([...reloaded.store.rows.values()].map((row) => row.uid), [UID_A, UID_A], 'A kept, B leftovers removed');
  const results = await reloaded.load(UID_A, group(UID_A, 'doc1', 2)).promise;
  assert.equal(reloaded.callableCalls.length, 0);
  assert.ok(results.every((result) => result.ok));
}

// 6. Versioning: schema mismatch / TTL expiry go back to the network and are re-stored.
{
  const first = createHarness();
  first.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 2);
  await first.load(UID_A, paths).promise;
  await settle();

  const wrongSchema = first.reload();
  wrongSchema.setUser(UID_A);
  wrongSchema.store.rows.get(makeRecordId(UID_A, paths[0])).schemaVersion = PERSISTENT_THUMBNAIL_SCHEMA_VERSION + 1;
  await wrongSchema.load(UID_A, paths).promise;
  await settle();
  assert.equal(wrongSchema.callableCalls.flat().length, 1, 'only the wrong-schema path is re-requested');
  assert.equal(wrongSchema.store.rows.get(makeRecordId(UID_A, paths[0])).schemaVersion, PERSISTENT_THUMBNAIL_SCHEMA_VERSION);

  const expired = wrongSchema.reload();
  expired.setUser(UID_A);
  expired.clock.value += PERSISTENT_THUMBNAIL_TTL_MS + DAY;
  await expired.load(UID_A, paths).promise;
  await settle();
  assert.equal(expired.callableCalls.flat().length, 2, 'expired thumbnails are fetched again');
  assert.equal(expired.store.rows.size, 2, 'and stored again');
  assert.ok([...expired.store.rows.values()].every((row) => row.cachedAt === expired.clock.value));
}
{
  // a replaced thumbnail (new content at the same path) overwrites the stored copy
  const h = createHarness();
  h.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 1);
  const before = (await h.load(UID_A, paths).promise)[0].item;
  await settle();
  h.server.version.set(paths[0], 2);
  const after = (await h.load(UID_A, paths, { bypassCache: true }).promise)[0].item;
  await settle();
  assert.notEqual(after.contentHash, before.contentHash);
  assert.equal(h.store.rows.get(makeRecordId(UID_A, paths[0])).contentHash, after.contentHash, 'new contentHash replaces the stored one');
}

// 7. Corrupted stored rows recover through the network.
{
  const first = createHarness();
  first.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 3);
  await first.load(UID_A, paths).promise;
  await settle();

  const h = first.reload();
  h.setUser(UID_A);
  h.store.rows.get(makeRecordId(UID_A, paths[0])).dataBase64 = 42;
  h.store.rows.get(makeRecordId(UID_A, paths[1])).contentType = 'application/json';
  const results = await h.load(UID_A, paths).promise;
  await settle();
  assert.ok(results.every((result) => result.ok && typeof result.item.dataBase64 === 'string'));
  assert.equal(h.counters.persistentHits, 1);
  assert.equal(h.callableCalls.flat().length, 2, 'only the corrupted rows hit the network');
  assert.equal(typeof h.store.rows.get(makeRecordId(UID_A, paths[0])).dataBase64, 'string', 'row was rewritten with good data');
}

// 8. Store outages never change what the card shows.
for (const [label, configure] of Object.entries({
  'read throws': (store) => { store.failures.getMany = { error: new Error('boom') }; },
  'write throws': (store) => { store.failures.putMany = { error: new Error('boom') }; },
  'quota exceeded': (store) => { store.failures.putMany = { error: Object.assign(new Error('quota'), { name: 'QuotaExceededError' }) }; },
  'read hangs': (store) => { store.failures.getMany = { hang: true }; },
  'write hangs': (store) => { store.failures.putMany = { hang: true }; },
  'cannot open': (store) => { store.failures.getMany = { error: Object.assign(new Error('x'), { code: 'idb-open-failed' }) }; },
})) {
  const h = createHarness();
  configure(h.store);
  h.setUser(UID_A);
  const startedAt = Date.now();
  const paths = group(UID_A, 'doc1', 4);
  const results = await h.load(UID_A, paths).promise;
  assert.ok(results.every((result) => result.ok), `${label}: photos still load over the network`);
  assert.equal(h.callableCalls.flat().length, 4, `${label}: network path used`);
  assert.ok(Date.now() - startedAt < 500, `${label}: bounded wait`);
  await settle();
}
{
  // after a write outage, reads keep serving what is already stored
  const first = createHarness();
  first.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 8);
  await first.load(UID_A, paths).promise;
  await settle();
  const h = first.reload();
  h.setUser(UID_A);
  h.store.failures.putMany = { error: Object.assign(new Error('quota'), { name: 'QuotaExceededError' }) };
  await h.load(UID_A, group(UID_A, 'fresh', 2)).promise; // its persistent write fails: oldest quarter evicted, retry fails
  await settle();
  assert.equal(h.persistent.getStats().writesDisabled, true);
  const results = await h.load(UID_A, paths).promise;
  assert.equal(h.counters.persistentHits, 6, 'reads still work after writes were switched off (8 stored - 2 evicted)');
  assert.ok(results.every((result) => result.ok), 'evicted ones simply come back over the network');
}

// 9. Retry / undecodable image: bypass skips memory and persistent reads and rewrites the stored copy.
{
  const h = createHarness();
  h.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 2);
  await h.load(UID_A, paths).promise;
  await settle();
  assert.equal(h.callableCalls.flat().length, 2);

  const results = await h.load(UID_A, paths, { bypassCache: true }).promise;
  await settle();
  assert.equal(h.callableCalls.flat().length, 4, 'bypass always refetches');
  assert.ok(results.every((result) => result.ok));
  assert.equal(h.store.rows.size, 2, 'fresh copies are written back');
}
{
  // if the refetch fails, the stored (possibly corrupt) copy is gone rather than served again later
  const h = createHarness();
  h.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 2);
  await h.load(UID_A, paths).promise;
  await settle();
  h.server.missing.add(paths[0]);
  const results = await h.load(UID_A, paths, { bypassCache: true }).promise;
  await settle();
  assert.equal(results[0].ok, false);
  assert.equal(h.store.rows.has(makeRecordId(UID_A, paths[0])), false, 'stored copy of the failed path is removed');
  assert.equal(h.store.rows.has(makeRecordId(UID_A, paths[1])), true);
}

// 10. Cancelling while the persistent lookup is pending: no queue registration, no callable.
{
  const h = createHarness();
  h.setUser(UID_A);
  h.store.delays.getMany = 30;
  const load = h.load(UID_A, group(UID_A, 'doc1', 4));
  const outcome = load.promise.then(() => 'resolved', (error) => error.message);
  load.release();
  assert.equal(await outcome, 'request-cancelled');
  await settle();
  assert.equal(h.callableCalls.length, 0, 'released cards never reach the network');
  assert.equal(h.counters.networkRequests, 0);
}
{
  // user switch while the lookup is pending: result discarded, nothing reaches memory
  const h = createHarness();
  h.setUser(UID_A);
  const paths = group(UID_A, 'doc1', 2);
  await h.load(UID_A, paths).promise;
  await settle();
  const reloaded = h.reload();
  reloaded.setUser(UID_A);
  reloaded.store.delays.getMany = 30;
  const load = reloaded.load(UID_A, paths);
  const outcome = load.promise.then(() => 'resolved', (error) => error.message);
  reloaded.setUser(UID_B);
  assert.equal(await outcome, 'auth-user-changed');
  assert.equal(reloaded.memory.snapshot().size, 0);
  assert.equal(reloaded.callableCalls.length, 0);
}

// 11. Regression: dedupe identity (contentHash, else fallbackKey) survives the round trip.
{
  const identityOf = (item) => item.contentHash || item.fallbackKey;
  const first = createHarness();
  first.setUser(UID_A);
  const photoOnly = group(UID_A, 'photo-only', 4);
  const textAndPhoto = group(UID_A, 'text-and-photo', 2);
  // photos 1 and 3 are the same picture (same contentHash), so 4 paths collapse to 3 identities
  first.server.hash = (thumbPath) => (
    thumbPath.endsWith('/1.jpg') || thumbPath.endsWith('/3.jpg')
      ? 'f'.repeat(64)
      : crypto.createHash('sha256').update(thumbPath).digest('hex')
  );
  const beforePhotoOnly = (await first.load(UID_A, photoOnly).promise).map((r) => r.item);
  const beforeTextAndPhoto = (await first.load(UID_A, textAndPhoto).promise).map((r) => r.item);
  await settle();

  const second = first.reload();
  second.setUser(UID_A);
  const afterPhotoOnly = (await second.load(UID_A, photoOnly).promise).map((r) => r.item);
  const afterTextAndPhoto = (await second.load(UID_A, textAndPhoto).promise).map((r) => r.item);
  assert.equal(second.callableCalls.length, 0);
  assert.deepEqual(afterPhotoOnly.map(identityOf), beforePhotoOnly.map(identityOf));
  assert.deepEqual(afterTextAndPhoto.map(identityOf), beforeTextAndPhoto.map(identityOf));
  assert.deepEqual(afterPhotoOnly.map(fourFields), beforePhotoOnly.map(fourFields));
  assert.equal(new Set(afterPhotoOnly.map(identityOf)).size, 3, 'identical hashes still collapse to one identity');

  // Use the real helper when this Node can import TypeScript sources directly.
  try {
    const { uniqueSnsThumbnailsByContentHash } = await import('../src/app/utils/snsRecords.ts');
    assert.deepEqual(uniqueSnsThumbnailsByContentHash(afterPhotoOnly), uniqueSnsThumbnailsByContentHash(beforePhotoOnly));
    assert.deepEqual(uniqueSnsThumbnailsByContentHash(afterTextAndPhoto), uniqueSnsThumbnailsByContentHash(beforeTextAndPhoto));
  } catch (error) {
    if (error?.code !== 'ERR_UNKNOWN_FILE_EXTENSION' && error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }
}

// 12. Wiring guard: the app module uses these pieces and none of the forbidden storage APIs.
{
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const state = fs.readFileSync(path.join(root, 'src/app/utils/snsPrivateThumbnailState.ts'), 'utf8');
  assert(state.includes('createTieredThumbnailLoad'));
  assert(state.includes('handleAuthUserTransition') && state.includes('handleAuthSessionInvalidated'));
  assert(state.includes('persistentThumbnailCache.putMany'), 'network responses must be persisted');
  assert(state.includes('SNS_THUMBNAIL_REQUEST_BATCH_SIZE = 4'), 'batch size stays 4');

  for (const file of ['snsThumbnailPersistentCache.js', 'snsThumbnailIdbStore.js', 'snsThumbnailTieredLoad.js']) {
    const source = fs.readFileSync(path.join(root, 'src/app/utils', file), 'utf8');
    assert(!/localStorage|sessionStorage|document\.cookie|\bcaches\.|serviceWorker|console\.log/.test(source), `${file} must not use forbidden storage/log APIs`);
    assert(!/getDownloadURL|makePublic/.test(source), `${file} must not create public URLs`);
  }
  const store = fs.readFileSync(path.join(root, 'src/app/utils/snsThumbnailIdbStore.js'), 'utf8');
  assert(!/^\s*(const|let|var)\s.*=\s*(globalThis\.)?indexedDB\b/m.test(store.split('export function createIdbThumbnailStore')[0]), 'no indexedDB access at module load');
}

await wait(50);
assert.deepEqual(unhandled, [], 'no unhandled rejections');
console.log('sns thumbnail tiered load tests passed');
