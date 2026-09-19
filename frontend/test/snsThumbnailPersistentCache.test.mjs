import assert from 'node:assert/strict';
import {
  createPersistentThumbnailCache,
  makeRecordId,
  PERSISTENT_THUMBNAIL_MAX_BASE64_CHARS,
  PERSISTENT_THUMBNAIL_MAX_ENTRIES,
  PERSISTENT_THUMBNAIL_SCHEMA_VERSION,
  PERSISTENT_THUMBNAIL_TTL_MS,
} from '../src/app/utils/snsThumbnailPersistentCache.js';

const unhandled = [];
process.on('unhandledRejection', (reason) => unhandled.push(reason));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const UID_A = 'uid-a';
const UID_B = 'uid-b';

const pathOf = (uid, n) => `users/${uid}/snsThumbnails/doc-1/${n}.jpg`;
const hashOf = (n) => String(n % 10).repeat(64);
const base64 = (units) => 'QUJD'.repeat(units); // valid base64, 4 chars per unit
const itemOf = (uid, n, extra = {}) => ({
  contentType: 'image/jpeg',
  dataBase64: base64(4),
  contentHash: hashOf(n),
  fallbackKey: `${uid}:${pathOf(uid, n)}`,
  ...extra,
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createFakeStore() {
  const rows = new Map();
  const calls = { getMany: 0, putMany: 0, deleteMany: 0, touchMany: 0, deleteUser: 0, deleteExceptUser: 0, listMeta: 0 };
  const failures = {};
  const guard = async (name) => {
    calls[name] += 1;
    const failure = failures[name];
    if (!failure) return;
    if (failure.hang) await new Promise(() => {});
    if (failure.times !== undefined) {
      if (failure.times <= 0) return;
      failure.times -= 1;
    }
    throw failure.error;
  };
  const store = {
    rows,
    calls,
    failures,
    async getMany(ids) {
      await guard('getMany');
      return ids.map((id) => (rows.has(id) ? structuredClone(rows.get(id)) : null));
    },
    async putMany(records) {
      await guard('putMany');
      records.forEach((record) => rows.set(record.id, structuredClone(record)));
    },
    async deleteMany(ids) {
      await guard('deleteMany');
      ids.forEach((id) => rows.delete(id));
    },
    async touchMany(ids, timestamp) {
      await guard('touchMany');
      ids.forEach((id) => {
        if (rows.has(id)) rows.get(id).lastUsedAt = timestamp;
      });
    },
    async deleteUser(uid) {
      await guard('deleteUser');
      for (const [id, row] of [...rows]) if (row.uid === uid) rows.delete(id);
    },
    async deleteExceptUser(uid) {
      await guard('deleteExceptUser');
      for (const [id, row] of [...rows]) if (!uid || row.uid !== uid) rows.delete(id);
    },
    async listMeta() {
      await guard('listMeta');
      return [...rows.values()].map(({ dataBase64, ...meta }) => structuredClone(meta));
    },
  };
  return store;
}

function createCache(overrides = {}) {
  const clock = { value: 1_800_000_000_000 };
  const scheduled = [];
  const store = overrides.store || createFakeStore();
  const cache = createPersistentThumbnailCache({
    store,
    now: () => clock.value,
    schedule: (callback) => scheduled.push(callback),
    readTimeoutMs: 40,
    writeTimeoutMs: 200,
    ...overrides.options,
  });
  return { cache, store, clock, scheduled };
}

const quotaError = () => Object.assign(new Error('quota'), { name: 'QuotaExceededError' });

// 1. Round trip restores the four ThumbnailCacheItem fields exactly.
{
  const { cache, store } = createCache();
  const item = itemOf(UID_A, 1);
  assert.equal(await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item }]), true);
  assert.equal(store.rows.size, 1);
  const [restored, missing] = await cache.getMany(UID_A, [pathOf(UID_A, 1), pathOf(UID_A, 2)]);
  assert.deepEqual(restored, item);
  assert.equal(missing, null);

  const noHash = itemOf(UID_A, 3, { contentHash: undefined });
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 3), item: noHash }]);
  const [restoredNoHash] = await cache.getMany(UID_A, [pathOf(UID_A, 3)]);
  assert.deepEqual(restoredNoHash, noHash, 'items without a server hash keep working (fallbackKey identity)');
}

// 2. UID isolation: another user can never read, and a planted cross-UID row is discarded.
{
  const { cache, store } = createCache();
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }]);
  assert.deepEqual(await cache.getMany(UID_B, [pathOf(UID_A, 1)]), [null], 'B must not read A rows even by A path');
  assert.deepEqual(await cache.getMany(UID_B, [pathOf(UID_B, 1)]), [null]);

  // A's row planted under B's key (corruption / tampering).
  const planted = { ...store.rows.get(makeRecordId(UID_A, pathOf(UID_A, 1))) };
  store.rows.set(makeRecordId(UID_B, pathOf(UID_A, 1)), planted);
  assert.deepEqual(await cache.getMany(UID_B, [pathOf(UID_A, 1)]), [null], 'uid/path mismatch is invalid');
  await wait(10);
  assert.equal(store.rows.has(makeRecordId(UID_B, pathOf(UID_A, 1))), false, 'invalid planted row is deleted');
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 1))), true, 'A own row untouched');

  // Each guard must hold on its own: wrong uid on a right path, and right uid on a foreign path.
  const base = structuredClone(store.rows.get(makeRecordId(UID_A, pathOf(UID_A, 1))));
  store.rows.set(makeRecordId(UID_B, pathOf(UID_B, 1)), { ...base, uid: UID_A, path: pathOf(UID_B, 1) });
  assert.deepEqual(await cache.getMany(UID_B, [pathOf(UID_B, 1)]), [null], 'row claiming another uid is invalid');
  store.rows.set(makeRecordId(UID_B, pathOf(UID_A, 1)), { ...base, uid: UID_B, path: pathOf(UID_A, 1) });
  assert.deepEqual(await cache.getMany(UID_B, [pathOf(UID_A, 1)]), [null], 'path outside the caller prefix is invalid');

  // Same user, but the row stored under path 2's key actually describes path 1 (mixed-up key).
  store.rows.set(makeRecordId(UID_A, pathOf(UID_A, 2)), structuredClone(base));
  assert.deepEqual(await cache.getMany(UID_A, [pathOf(UID_A, 2)]), [null], 'row whose path differs from its key is invalid');

  // A path that is not under the caller's own snsThumbnails prefix is never stored.
  assert.equal(await cache.putMany(UID_B, [{ path: pathOf(UID_A, 9), item: itemOf(UID_B, 9) }]), false);
  assert.equal(await cache.putMany(UID_B, [{ path: 'users/uid-b/records/2026-01-01', item: itemOf(UID_B, 9) }]), false);
}

// 2b. A write whose auth scope is no longer current is dropped before touching the store.
{
  const { cache, store } = createCache();
  assert.equal(await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }], () => false), false);
  assert.equal(store.calls.putMany, 0);
  assert.equal(store.rows.size, 0);
}

// 3. TTL: valid inside 30 days, deleted after. schemaVersion mismatch is deleted too.
{
  const { cache, store, clock } = createCache();
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }]);
  clock.value += PERSISTENT_THUMBNAIL_TTL_MS - DAY;
  assert.notEqual((await cache.getMany(UID_A, [pathOf(UID_A, 1)]))[0], null);
  clock.value += 2 * DAY;
  assert.deepEqual(await cache.getMany(UID_A, [pathOf(UID_A, 1)]), [null], 'expired after 30 days');
  await wait(10);
  assert.equal(store.rows.size, 0, 'expired rows are deleted on read');

  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 2), item: itemOf(UID_A, 2) }]);
  store.rows.get(makeRecordId(UID_A, pathOf(UID_A, 2))).schemaVersion = PERSISTENT_THUMBNAIL_SCHEMA_VERSION + 1;
  assert.deepEqual(await cache.getMany(UID_A, [pathOf(UID_A, 2)]), [null], 'schemaVersion mismatch is a miss');
  await wait(10);
  assert.equal(store.rows.size, 0);
}

// 4. Corrupted rows are deleted and reported as misses.
{
  const corruptions = {
    'size mismatch': (row) => { row.size += 4; },
    'non-string body': (row) => { row.dataBase64 = 12345; },
    'empty body': (row) => { row.dataBase64 = ''; row.size = 0; },
    'non-image contentType': (row) => { row.contentType = 'text/html'; },
    'bad contentHash': (row) => { row.contentHash = 'not-a-hash'; },
    'non-base64 body': (row) => { row.dataBase64 = '!!!!'.repeat(4); row.size = 16; },
    'length not multiple of 4': (row) => { row.dataBase64 = 'QUJDQ'; row.size = 5; },
    'missing fallbackKey': (row) => { delete row.fallbackKey; },
    'bad cachedAt': (row) => { row.cachedAt = 'yesterday'; },
    'cachedAt in the far future': (row) => { row.cachedAt += 400 * DAY; },
    'null row': null,
  };
  for (const [label, corrupt] of Object.entries(corruptions)) {
    const { cache, store } = createCache();
    await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }]);
    const id = makeRecordId(UID_A, pathOf(UID_A, 1));
    if (corrupt === null) store.rows.set(id, null);
    else corrupt(store.rows.get(id));
    const [result] = await cache.getMany(UID_A, [pathOf(UID_A, 1)]);
    assert.equal(result, null, `${label} must be a miss`);
    await wait(10);
    if (corrupt !== null) assert.equal(store.rows.has(id), false, `${label} must be deleted`);
  }
}

// 5. Store failures never throw, never reject unhandled, and fall back to misses.
{
  const { cache, store } = createCache();
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }]);

  store.failures.getMany = { error: new Error('read failed') };
  assert.deepEqual(await cache.getMany(UID_A, [pathOf(UID_A, 1)]), [null], 'read error is a miss');
  delete store.failures.getMany;
  assert.notEqual((await cache.getMany(UID_A, [pathOf(UID_A, 1)]))[0], null, 'plain read errors do not disable the cache');

  store.failures.putMany = { error: new Error('write failed') };
  assert.equal(await cache.putMany(UID_A, [{ path: pathOf(UID_A, 2), item: itemOf(UID_A, 2) }]), false);
  delete store.failures.putMany;

  store.failures.putMany = { hang: true };
  const startedAt = Date.now();
  assert.equal(await cache.putMany(UID_A, [{ path: pathOf(UID_A, 2), item: itemOf(UID_A, 2) }]), false, 'hung write times out');
  assert.ok(Date.now() - startedAt < 1000);
}

// 6. A hung store times out once, then reads are skipped for a while (no per-card delay).
{
  const { cache, store, clock } = createCache();
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }]);
  store.failures.getMany = { hang: true };

  const startedAt = Date.now();
  assert.deepEqual(await cache.getMany(UID_A, [pathOf(UID_A, 1)]), [null]);
  assert.ok(Date.now() - startedAt < 500, 'timeout keeps the lookup bounded');
  assert.equal(cache.getStats().timeouts, 1);

  const callsBefore = store.calls.getMany;
  assert.deepEqual(await cache.getMany(UID_A, [pathOf(UID_A, 1)]), [null]);
  assert.equal(store.calls.getMany, callsBefore, 'reads are suspended right after a timeout');

  delete store.failures.getMany;
  clock.value += 60_000;
  assert.notEqual((await cache.getMany(UID_A, [pathOf(UID_A, 1)]))[0], null, 'reads resume after the suspension');
}

// 7. IndexedDB cannot be opened: everything is a miss/false for the rest of the session.
{
  const { cache, store, clock } = createCache();
  const openError = Object.assign(new Error('idb-open-failed'), { code: 'idb-open-failed' });
  store.failures.getMany = { error: openError };
  assert.deepEqual(await cache.getMany(UID_A, [pathOf(UID_A, 1)]), [null]);
  delete store.failures.getMany;

  clock.value += 10 * DAY;
  const callsBefore = { ...store.calls };
  assert.deepEqual(await cache.getMany(UID_A, [pathOf(UID_A, 1)]), [null]);
  assert.equal(await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }]), false);
  assert.equal(await cache.deleteUser(UID_A), false);
  assert.deepEqual(store.calls, callsBefore, 'no store calls after an open failure (no retry storm)');
  assert.equal(cache.getStats().storeUnavailable, true);
}

// 8. Quota: evict the oldest quarter and retry once; a second failure stops writes but keeps reads.
{
  const { cache, store, clock } = createCache();
  for (let n = 1; n <= 8; n += 1) {
    clock.value += 1000;
    await cache.putMany(UID_A, [{ path: pathOf(UID_A, n), item: itemOf(UID_A, n) }]);
  }
  store.failures.putMany = { times: 1, error: quotaError() };
  clock.value += 1000;
  assert.equal(await cache.putMany(UID_A, [{ path: pathOf(UID_A, 20), item: itemOf(UID_A, 20) }]), true);
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 1))), false, 'oldest entries evicted first');
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 2))), false);
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 8))), true, 'newest entries kept');
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 20))), true, 'the retried write landed');

  store.failures.putMany = { error: quotaError() };
  assert.equal(await cache.putMany(UID_A, [{ path: pathOf(UID_A, 21), item: itemOf(UID_A, 21) }]), false);
  assert.equal(cache.getStats().writesDisabled, true);
  delete store.failures.putMany;
  const writesBefore = store.calls.putMany;
  assert.equal(await cache.putMany(UID_A, [{ path: pathOf(UID_A, 22), item: itemOf(UID_A, 22) }]), false);
  assert.equal(store.calls.putMany, writesBefore, 'writes stay off for the session');
  assert.notEqual((await cache.getMany(UID_A, [pathOf(UID_A, 8)]))[0], null, 'reads keep working');
}

// 9. Maintenance: expiry, entry limit and size limit, least recently used first, down to 90%.
{
  const { cache, store, clock } = createCache({ options: { maxEntries: 10 } });
  for (let n = 1; n <= 12; n += 1) {
    clock.value += 1000;
    await cache.putMany(UID_A, [{ path: pathOf(UID_A, n), item: itemOf(UID_A, n) }]);
  }
  clock.value += 2 * HOUR;
  // A cache hit refreshes lastUsedAt (batched, at most hourly), protecting entry 1 from eviction.
  assert.notEqual((await cache.getMany(UID_A, [pathOf(UID_A, 1)]))[0], null);
  await wait(10);
  assert.equal(store.rows.get(makeRecordId(UID_A, pathOf(UID_A, 1))).lastUsedAt, clock.value);

  assert.equal(await cache.runMaintenance(), true);
  assert.equal(store.rows.size, 9, 'pruned to 90% of the entry limit');
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 1))), true, 'recently used entry survives');
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 2))), false, 'least recently used goes first');
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 12))), true);
}
{
  const { cache, store, clock } = createCache({ options: { maxBase64Chars: 100 } });
  for (let n = 1; n <= 10; n += 1) {
    clock.value += 1000;
    await cache.putMany(UID_A, [{ path: pathOf(UID_A, n), item: itemOf(UID_A, n) }]); // 16 chars each
  }
  await cache.runMaintenance();
  const total = [...store.rows.values()].reduce((sum, row) => sum + row.size, 0);
  assert.ok(total <= 90, `size limit pruned to 90% (got ${total})`);
  assert.equal(store.rows.has(makeRecordId(UID_A, pathOf(UID_A, 10))), true);
}
{
  const { cache, store, clock } = createCache();
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }]);
  clock.value += PERSISTENT_THUMBNAIL_TTL_MS + DAY;
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 2), item: itemOf(UID_A, 2) }]);
  store.rows.get(makeRecordId(UID_A, pathOf(UID_A, 2))).schemaVersion = 99;
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 3), item: itemOf(UID_A, 3) }]);
  await cache.runMaintenance();
  assert.deepEqual([...store.rows.keys()], [makeRecordId(UID_A, pathOf(UID_A, 3))], 'expired and wrong-schema rows swept');
}
assert.equal(PERSISTENT_THUMBNAIL_MAX_ENTRIES, 1000);
assert.ok(PERSISTENT_THUMBNAIL_MAX_BASE64_CHARS <= 100 * 1024 * 1024, 'stays under the 100MB hand-over ceiling');
assert.equal(PERSISTENT_THUMBNAIL_TTL_MS, 30 * DAY);

// 10. Maintenance is scheduled (coalesced) after writes, never run inline.
{
  const { cache, store, scheduled } = createCache();
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }]);
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 2), item: itemOf(UID_A, 2) }]);
  assert.equal(scheduled.length, 1, 'bursts of writes share one idle maintenance run');
  assert.equal(store.calls.listMeta, 0, 'nothing runs before the idle callback fires');
  scheduled[0]();
  await wait(10);
  assert.equal(store.calls.listMeta, 1);
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 3), item: itemOf(UID_A, 3) }]);
  assert.equal(scheduled.length, 2, 'a later burst schedules again');
}

// 11. User deletion helpers.
{
  const { cache, store } = createCache();
  await cache.putMany(UID_A, [{ path: pathOf(UID_A, 1), item: itemOf(UID_A, 1) }, { path: pathOf(UID_A, 2), item: itemOf(UID_A, 2) }]);
  await cache.putMany(UID_B, [{ path: pathOf(UID_B, 1), item: itemOf(UID_B, 1) }]);
  assert.equal(store.rows.size, 3);
  await cache.deleteMany(UID_A, [pathOf(UID_A, 1)]);
  assert.equal(store.rows.size, 2);
  await cache.deleteExceptUser(UID_B);
  assert.deepEqual([...store.rows.keys()], [makeRecordId(UID_B, pathOf(UID_B, 1))]);
  await cache.deleteUser(UID_B);
  assert.equal(store.rows.size, 0);
}

await wait(20);
assert.deepEqual(unhandled, [], 'no unhandled rejections from any store failure');
console.log('sns thumbnail persistent cache tests passed');
