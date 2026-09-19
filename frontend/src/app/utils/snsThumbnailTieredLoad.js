// Memory -> persistent (IndexedDB) -> network lookup order for SNS thumbnails.
//
// The persistent lookup deliberately happens *before* the batched request queue:
// the queue awaits its 4-image batches one after another, so a lookup inside it
// would push cached photos behind network batches and defeat "instant" display.
// All collaborators are injected so this file stays pure JS and Node-testable.

export function createSnsThumbnailCounters() {
  return { memoryHits: 0, persistentHits: 0, networkRequests: 0, networkBatches: 0 };
}

/**
 * Loads `paths` for `userUid`, consulting the in-memory cache first, then the
 * persistent cache (one lookup for everything the memory cache missed) and
 * finally the network queue.
 *
 * Deps:
 *   userUid, paths, scope, cacheKeyFor(path)
 *   memoryCache            createAuthScopedThumbnailCache() instance
 *   persistentCache        createPersistentThumbnailCache() instance (getMany never rejects)
 *   requestFromNetwork(path, cacheKey) -> Promise<{ ok, item?, code? }>
 *   releaseNetworkRequest(cacheKey)
 *   isCurrent()            -> boolean, false once the auth user/session changed
 *   bypassCache            skip memory + persistent reads (retry / corrupted image)
 *   counters               createSnsThumbnailCounters()
 */
export function createTieredThumbnailLoad(deps) {
  const {
    userUid,
    paths,
    scope,
    cacheKeyFor,
    memoryCache,
    persistentCache,
    requestFromNetwork,
    releaseNetworkRequest,
    isCurrent,
    bypassCache = false,
    counters,
  } = deps;

  let released = false;
  const queuedKeys = [];
  const results = new Array(paths.length);
  const missing = [];

  paths.forEach((path, index) => {
    if (!bypassCache) {
      const cached = memoryCache.get(scope, cacheKeyFor(path));
      if (cached) {
        counters.memoryHits += 1;
        results[index] = { ok: true, item: cached };
        return;
      }
    }
    missing.push(index);
  });

  const fetchFromNetwork = (index) => {
    const key = cacheKeyFor(paths[index]);
    queuedKeys.push(key);
    counters.networkRequests += 1;
    return Promise.resolve(requestFromNetwork(paths[index], key)).then((result) => {
      results[index] = result;
    });
  };

  const run = async () => {
    let persistentItems = [];
    if (bypassCache) {
      // Drop any stored copy before the fresh response is written back.
      void persistentCache.deleteMany(userUid, missing.map((index) => paths[index]));
    } else {
      persistentItems = await persistentCache.getMany(userUid, missing.map((index) => paths[index]));
    }

    // The lookup is async: the card may have unmounted or the user may have changed.
    if (released) throw new Error('request-cancelled');
    if (!isCurrent()) throw new Error('auth-user-changed');

    const stillMissing = [];
    missing.forEach((index, position) => {
      const item = persistentItems[position];
      if (item) {
        counters.persistentHits += 1;
        memoryCache.set(scope, cacheKeyFor(paths[index]), item, item.dataBase64.length);
        results[index] = { ok: true, item };
      } else {
        stillMissing.push(index);
      }
    });

    await Promise.all(stillMissing.map(fetchFromNetwork));
    return results;
  };

  const promise = missing.length === 0 ? Promise.resolve(results) : run();

  return {
    promise,
    release: () => {
      released = true;
      queuedKeys.forEach((key) => releaseNetworkRequest(key));
    },
  };
}

/**
 * Auth user change (onAuthStateChanged -> setSnsThumbnailAuthUser).
 * Deletes only on a real transition. A `null` with no previously active user
 * (app start) must never wipe the cache, or every reload would lose it.
 */
export function handleAuthUserTransition({ previousUid, nextUid, persistentCache }) {
  if (previousUid && previousUid !== nextUid) {
    void persistentCache.deleteUser(previousUid);
  }
  if (nextUid) {
    void persistentCache.deleteExceptUser(nextUid);
    persistentCache.scheduleMaintenance();
  }
}

/** Explicit sign-out / account removal. `activeUid` is read before invalidation. */
export function handleAuthSessionInvalidated({ activeUid, persistentCache }) {
  if (activeUid) void persistentCache.deleteUser(activeUid);
}
