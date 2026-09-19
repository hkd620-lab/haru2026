// SNS thumbnail persistent cache policy (pure JS, storage injected).
//
// The browser-only IndexedDB adapter lives in snsThumbnailIdbStore.js. Everything
// that decides *what* may be stored, returned, expired or deleted lives here so it
// can be exercised in Node with a fake store.
//
// Store contract (every method is async and may throw/reject/hang):
//   getMany(ids)            -> Array<record | null>          (aligned with ids)
//   putMany(records)        -> void                          (records carry `id`)
//   deleteMany(ids)         -> void
//   touchMany(ids, ts)      -> void                          (updates lastUsedAt only)
//   deleteUser(uid)         -> void
//   deleteExceptUser(uid)   -> void                          (uid === null deletes everything)
//   listMeta()              -> Array<meta>                   (no image bodies)
//
// Every failure (open error, read/write error, quota, corruption, no response) is
// swallowed here and turned into "miss" / `false`, so a broken cache can never
// break or slow down showing photos over the network.

export const PERSISTENT_THUMBNAIL_SCHEMA_VERSION = 1;
export const PERSISTENT_THUMBNAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PERSISTENT_THUMBNAIL_MAX_ENTRIES = 1000;
// Sum of dataBase64.length. 64M chars stays under the 100MB hand-over ceiling.
export const PERSISTENT_THUMBNAIL_MAX_BASE64_CHARS = 64 * 1024 * 1024;

const PRUNE_TARGET_RATIO = 0.9;
const QUOTA_EVICT_RATIO = 0.25;
const DEFAULT_READ_TIMEOUT_MS = 1000;
const DEFAULT_WRITE_TIMEOUT_MS = 10000;
const READ_SUSPEND_MS = 30000;
const LAST_USED_REFRESH_MS = 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const HEX64 = /^[0-9a-f]{64}$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function makeRecordId(uid, path) {
  return `${uid}|${path}`;
}

export function thumbnailPathPrefix(uid) {
  return `users/${uid}/snsThumbnails/`;
}

function isQuotaError(error) {
  return Boolean(error) && (error.name === 'QuotaExceededError' || error.code === 22);
}

function withTimeout(run, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error('persistent-cache-timeout');
      error.code = 'timeout';
      reject(error);
    }, timeoutMs);
    Promise.resolve()
      .then(run)
      .then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
  });
}

function defaultSchedule(callback) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback, { timeout: 10000 });
    return;
  }
  setTimeout(callback, 3000);
}

export function createPersistentThumbnailCache(options = {}) {
  const store = options.store;
  const now = options.now || (() => Date.now());
  const schedule = options.schedule || defaultSchedule;
  const readTimeoutMs = options.readTimeoutMs || DEFAULT_READ_TIMEOUT_MS;
  const writeTimeoutMs = options.writeTimeoutMs || DEFAULT_WRITE_TIMEOUT_MS;
  const ttlMs = options.ttlMs || PERSISTENT_THUMBNAIL_TTL_MS;
  const maxEntries = options.maxEntries || PERSISTENT_THUMBNAIL_MAX_ENTRIES;
  const maxBase64Chars = options.maxBase64Chars || PERSISTENT_THUMBNAIL_MAX_BASE64_CHARS;
  const schemaVersion = options.schemaVersion || PERSISTENT_THUMBNAIL_SCHEMA_VERSION;
  const estimateStorage = options.estimateStorage || null;

  const stats = {
    hits: 0,
    misses: 0,
    invalid: 0,
    errors: 0,
    timeouts: 0,
    writes: 0,
    writeSkips: 0,
    deletes: 0,
    evicted: 0,
    storageUsage: null,
    storageQuota: null,
  };

  let readsSuspendedUntil = 0;
  let storeUnavailable = false;
  let writesDisabled = false;
  let maintenancePending = false;

  const noteFailure = (error) => {
    stats.errors += 1;
    if (error && error.code === 'timeout') {
      stats.timeouts += 1;
      readsSuspendedUntil = Math.max(readsSuspendedUntil, now() + READ_SUSPEND_MS);
    }
    if (error && error.code === 'idb-open-failed') {
      storeUnavailable = true;
      writesDisabled = true;
      readsSuspendedUntil = Infinity;
    }
  };

  // Never rejects. Returns true when the store call finished.
  const guarded = async (run, timeoutMs = writeTimeoutMs) => {
    if (!store || storeUnavailable) return false;
    try {
      await withTimeout(run, timeoutMs);
      return true;
    } catch (error) {
      noteFailure(error);
      return false;
    }
  };

  const toItem = (record) => ({
    contentType: record.contentType,
    dataBase64: record.dataBase64,
    contentHash: typeof record.contentHash === 'string' ? record.contentHash : undefined,
    fallbackKey: record.fallbackKey,
  });

  const isValidRecord = (record, uid, path, stamp) => {
    if (!record || typeof record !== 'object') return false;
    if (record.uid !== uid || record.path !== path) return false;
    if (!path.startsWith(thumbnailPathPrefix(uid))) return false;
    if (record.schemaVersion !== schemaVersion) return false;
    if (typeof record.contentType !== 'string' || !record.contentType.startsWith('image/')) return false;
    if (typeof record.dataBase64 !== 'string' || record.dataBase64.length === 0) return false;
    if (record.size !== record.dataBase64.length) return false;
    if (record.dataBase64.length % 4 !== 0 || !BASE64.test(record.dataBase64)) return false;
    if (record.contentHash != null && (typeof record.contentHash !== 'string' || !HEX64.test(record.contentHash))) {
      return false;
    }
    if (typeof record.fallbackKey !== 'string' || record.fallbackKey.length === 0) return false;
    if (!Number.isFinite(record.cachedAt)) return false;
    if (record.cachedAt > stamp + MAX_FUTURE_SKEW_MS) return false;
    if (stamp - record.cachedAt > ttlMs) return false;
    return true;
  };

  const deleteMany = (uid, paths) => {
    if (!uid || !paths || paths.length === 0) return Promise.resolve(false);
    stats.deletes += paths.length;
    const ids = paths.map((path) => makeRecordId(uid, path));
    return guarded(() => store.deleteMany(ids));
  };

  const getMany = async (uid, paths) => {
    const misses = () => (Array.isArray(paths) ? paths.map(() => null) : []);
    if (!uid || !Array.isArray(paths) || paths.length === 0) return misses();
    if (!store || now() < readsSuspendedUntil) {
      stats.misses += paths.length;
      return misses();
    }

    let records;
    try {
      const ids = paths.map((path) => makeRecordId(uid, path));
      records = await withTimeout(() => store.getMany(ids), readTimeoutMs);
      if (!Array.isArray(records)) throw new Error('persistent-cache-bad-response');
    } catch (error) {
      noteFailure(error);
      stats.misses += paths.length;
      return misses();
    }

    const stamp = now();
    const invalidPaths = [];
    const touchIds = [];
    const items = paths.map((path, index) => {
      const record = records[index];
      if (record == null) {
        stats.misses += 1;
        return null;
      }
      if (!isValidRecord(record, uid, path, stamp)) {
        stats.invalid += 1;
        stats.misses += 1;
        invalidPaths.push(path);
        return null;
      }
      stats.hits += 1;
      if (!Number.isFinite(record.lastUsedAt) || stamp - record.lastUsedAt >= LAST_USED_REFRESH_MS) {
        touchIds.push(makeRecordId(uid, path));
      }
      return toItem(record);
    });

    if (invalidPaths.length > 0) void deleteMany(uid, invalidPaths);
    if (touchIds.length > 0) void guarded(() => store.touchMany(touchIds, stamp));
    return items;
  };

  const evictOldest = async (ratio) => {
    const metas = await withTimeout(() => store.listMeta(), writeTimeoutMs);
    if (!Array.isArray(metas) || metas.length === 0) return;
    const sorted = [...metas].sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0));
    const victims = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * ratio))).map((meta) => meta.id);
    stats.evicted += victims.length;
    await withTimeout(() => store.deleteMany(victims), writeTimeoutMs);
  };

  const runMaintenance = async () => {
    if (!store || storeUnavailable) return false;
    if (estimateStorage) {
      try {
        const estimate = await estimateStorage();
        stats.storageUsage = estimate && Number.isFinite(estimate.usage) ? estimate.usage : null;
        stats.storageQuota = estimate && Number.isFinite(estimate.quota) ? estimate.quota : null;
      } catch {
        // informational only
      }
    }

    let metas;
    try {
      metas = await withTimeout(() => store.listMeta(), writeTimeoutMs);
      if (!Array.isArray(metas)) return false;
    } catch (error) {
      noteFailure(error);
      return false;
    }

    const stamp = now();
    const remove = [];
    const keep = [];
    for (const meta of metas) {
      const valid = meta
        && typeof meta.id === 'string'
        && meta.schemaVersion === schemaVersion
        && Number.isFinite(meta.cachedAt)
        && Number.isFinite(meta.size)
        && stamp - meta.cachedAt <= ttlMs
        && meta.cachedAt <= stamp + MAX_FUTURE_SKEW_MS;
      if (valid) keep.push(meta);
      else if (meta && typeof meta.id === 'string') remove.push(meta.id);
    }

    let count = keep.length;
    let chars = keep.reduce((sum, meta) => sum + meta.size, 0);
    if (count > maxEntries || chars > maxBase64Chars) {
      const targetCount = Math.floor(maxEntries * PRUNE_TARGET_RATIO);
      const targetChars = Math.floor(maxBase64Chars * PRUNE_TARGET_RATIO);
      keep.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0));
      for (const meta of keep) {
        if (count <= targetCount && chars <= targetChars) break;
        remove.push(meta.id);
        count -= 1;
        chars -= meta.size;
      }
    }

    if (remove.length === 0) return true;
    stats.evicted += remove.length;
    return guarded(() => store.deleteMany(remove));
  };

  const scheduleMaintenance = () => {
    if (maintenancePending || !store || storeUnavailable) return;
    maintenancePending = true;
    try {
      schedule(() => {
        maintenancePending = false;
        void runMaintenance();
      });
    } catch {
      maintenancePending = false;
    }
  };

  const write = (records) => guarded(() => store.putMany(records));

  const putMany = async (uid, entries, isCurrent = () => true) => {
    if (!uid || !Array.isArray(entries) || !store || writesDisabled) return false;

    const stamp = now();
    const prefix = thumbnailPathPrefix(uid);
    const records = [];
    for (const entry of entries) {
      const item = entry && entry.item;
      if (
        !entry
        || typeof entry.path !== 'string'
        || !entry.path.startsWith(prefix)
        || !item
        || typeof item.dataBase64 !== 'string'
        || item.dataBase64.length === 0
        || typeof item.contentType !== 'string'
        || typeof item.fallbackKey !== 'string'
      ) {
        continue;
      }
      records.push({
        id: makeRecordId(uid, entry.path),
        uid,
        path: entry.path,
        schemaVersion,
        contentType: item.contentType,
        dataBase64: item.dataBase64,
        contentHash: item.contentHash,
        fallbackKey: item.fallbackKey,
        cachedAt: stamp,
        lastUsedAt: stamp,
        size: item.dataBase64.length,
      });
    }
    if (records.length === 0) return false;
    if (!isCurrent()) {
      stats.writeSkips += records.length;
      return false;
    }

    let firstError = null;
    let done = false;
    try {
      await withTimeout(() => store.putMany(records), writeTimeoutMs);
      done = true;
    } catch (error) {
      firstError = error;
    }

    if (!done && isQuotaError(firstError)) {
      try {
        await evictOldest(QUOTA_EVICT_RATIO);
        if (!isCurrent()) return false;
        await withTimeout(() => store.putMany(records), writeTimeoutMs);
        done = true;
      } catch (retryError) {
        writesDisabled = true;
        noteFailure(retryError);
        return false;
      }
    } else if (!done) {
      noteFailure(firstError);
      return false;
    }

    stats.writes += records.length;
    scheduleMaintenance();
    return true;
  };

  return {
    getMany,
    putMany,
    deleteMany,
    deleteUser: (uid) => (uid ? guarded(() => store.deleteUser(uid)) : Promise.resolve(false)),
    deleteExceptUser: (uid) => guarded(() => store.deleteExceptUser(uid || null)),
    scheduleMaintenance,
    runMaintenance,
    getStats: () => ({ ...stats, writesDisabled, storeUnavailable }),
  };
}
