// Thin IndexedDB adapter for the SNS thumbnail persistent cache.
//
// No policy lives here (validation, TTL, limits, UID rules are in
// snsThumbnailPersistentCache.js). Rules for this file:
//  - never touch `indexedDB` at module load; it is resolved lazily on first use
//    (Safari private mode and blocked storage can throw on access)
//  - only IndexedDB requests inside a transaction, never other awaited promises
//  - image bodies live in their own object store so maintenance reads metadata only

export const SNS_THUMBNAIL_DB_NAME = 'haru2026-sns-thumbnails';
export const SNS_THUMBNAIL_DB_VERSION = 1;
const META_STORE = 'thumbMeta';
const BODY_STORE = 'thumbBody';

function openFailure(cause) {
  const error = new Error('idb-open-failed');
  error.code = 'idb-open-failed';
  error.cause = cause;
  return error;
}

function runTransaction(db, storeNames, mode, work) {
  return new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = db.transaction(storeNames, mode);
    } catch (error) {
      reject(error);
      return;
    }
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('idb-transaction-error'));
    transaction.onabort = () => reject(transaction.error || new Error('idb-transaction-aborted'));
    try {
      result = work(transaction);
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // already finished
      }
      reject(error);
    }
  });
}

export function createIdbThumbnailStore(options = {}) {
  const getFactory = options.getFactory || (() => globalThis.indexedDB);
  const getKeyRange = options.getKeyRange || (() => globalThis.IDBKeyRange);
  let dbPromise = null;

  const open = () => {
    if (dbPromise) return dbPromise;
    const promise = new Promise((resolve, reject) => {
      let request;
      try {
        const factory = getFactory();
        if (!factory) throw new Error('indexeddb-unavailable');
        request = factory.open(SNS_THUMBNAIL_DB_NAME, SNS_THUMBNAIL_DB_VERSION);
      } catch (error) {
        reject(openFailure(error));
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          const meta = db.createObjectStore(META_STORE, { keyPath: 'id' });
          meta.createIndex('uid', 'uid', { unique: false });
        }
        if (!db.objectStoreNames.contains(BODY_STORE)) {
          db.createObjectStore(BODY_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Let a newer tab upgrade the schema, and reopen after the browser drops us.
        db.onversionchange = () => {
          db.close();
          if (dbPromise === promise) dbPromise = null;
        };
        db.onclose = () => {
          if (dbPromise === promise) dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(openFailure(request.error));
      request.onblocked = () => reject(openFailure(new Error('idb-blocked')));
    });
    promise.catch(() => {});
    dbPromise = promise;
    return promise;
  };

  // Safari can close the connection in the background; reopen once on InvalidStateError.
  const run = async (fn) => {
    const db = await open();
    try {
      return await fn(db);
    } catch (error) {
      if (error && error.name === 'InvalidStateError') {
        dbPromise = null;
        return fn(await open());
      }
      throw error;
    }
  };

  const deleteByRange = (metaStore, bodyStore, range) => {
    const cursorRequest = metaStore.index('uid').openKeyCursor(range);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      metaStore.delete(cursor.primaryKey);
      bodyStore.delete(cursor.primaryKey);
      cursor.continue();
    };
  };

  return {
    getMany: (ids) => run((db) => runTransaction(db, [META_STORE, BODY_STORE], 'readonly', (transaction) => {
      const metaStore = transaction.objectStore(META_STORE);
      const bodyStore = transaction.objectStore(BODY_STORE);
      return ids.map((id) => ({ meta: metaStore.get(id), body: bodyStore.get(id) }));
    })).then((pairs) => pairs.map(({ meta, body }) => {
      if (!meta.result) return null;
      return { ...meta.result, dataBase64: body.result ? body.result.dataBase64 : undefined };
    })),

    putMany: (records) => run((db) => runTransaction(db, [META_STORE, BODY_STORE], 'readwrite', (transaction) => {
      const metaStore = transaction.objectStore(META_STORE);
      const bodyStore = transaction.objectStore(BODY_STORE);
      for (const record of records) {
        const { dataBase64, ...meta } = record;
        metaStore.put(meta);
        bodyStore.put({ id: record.id, dataBase64 });
      }
    })),

    deleteMany: (ids) => run((db) => runTransaction(db, [META_STORE, BODY_STORE], 'readwrite', (transaction) => {
      const metaStore = transaction.objectStore(META_STORE);
      const bodyStore = transaction.objectStore(BODY_STORE);
      for (const id of ids) {
        metaStore.delete(id);
        bodyStore.delete(id);
      }
    })),

    touchMany: (ids, timestamp) => run((db) => runTransaction(db, [META_STORE], 'readwrite', (transaction) => {
      const metaStore = transaction.objectStore(META_STORE);
      for (const id of ids) {
        const request = metaStore.get(id);
        request.onsuccess = () => {
          if (request.result) metaStore.put({ ...request.result, lastUsedAt: timestamp });
        };
      }
    })),

    deleteUser: (uid) => run((db) => runTransaction(db, [META_STORE, BODY_STORE], 'readwrite', (transaction) => {
      const KeyRange = getKeyRange();
      deleteByRange(transaction.objectStore(META_STORE), transaction.objectStore(BODY_STORE), KeyRange.only(uid));
    })),

    deleteExceptUser: (keepUid) => run((db) => runTransaction(db, [META_STORE, BODY_STORE], 'readwrite', (transaction) => {
      const metaStore = transaction.objectStore(META_STORE);
      const bodyStore = transaction.objectStore(BODY_STORE);
      if (!keepUid) {
        metaStore.clear();
        bodyStore.clear();
        return;
      }
      const KeyRange = getKeyRange();
      deleteByRange(metaStore, bodyStore, KeyRange.upperBound(keepUid, true));
      deleteByRange(metaStore, bodyStore, KeyRange.lowerBound(keepUid, true));
    })),

    listMeta: () => run((db) => runTransaction(db, [META_STORE], 'readonly', (transaction) => {
      return transaction.objectStore(META_STORE).getAll();
    })).then((request) => request.result || []),
  };
}
