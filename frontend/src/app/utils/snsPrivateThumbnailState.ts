import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { createAuthScopedThumbnailCache } from './snsThumbnailAuthCache';
import { createBatchedRequestQueue } from './snsThumbnailRequestQueue';
import { createIdbThumbnailStore } from './snsThumbnailIdbStore';
import { createPersistentThumbnailCache } from './snsThumbnailPersistentCache';
import {
  createSnsThumbnailCounters,
  createTieredThumbnailLoad,
  handleAuthSessionInvalidated,
  handleAuthUserTransition,
} from './snsThumbnailTieredLoad';

const SNS_THUMBNAIL_REQUEST_BATCH_SIZE = 4;
const THUMBNAIL_CACHE_MAX_ENTRIES = 300;
const THUMBNAIL_CACHE_MAX_BASE64_CHARS = 12 * 1024 * 1024;

export interface ThumbnailCacheItem {
  contentType: string;
  dataBase64: string;
  contentHash?: string;
  fallbackKey: string;
}

interface ThumbnailAuthScope {
  userUid: string | null;
  generation: number;
}

interface ThumbnailRequest {
  userUid: string;
  path: string;
  cacheKey: string;
  scope: ThumbnailAuthScope;
}

export interface ThumbnailLoadResult {
  ok: boolean;
  item?: ThumbnailCacheItem;
  code?: string;
}

interface ThumbnailLoad {
  promise: Promise<ThumbnailLoadResult[]>;
  release: () => void;
  isCurrent: () => boolean;
}

const thumbnailCache = createAuthScopedThumbnailCache({
  maxEntries: THUMBNAIL_CACHE_MAX_ENTRIES,
  maxWeight: THUMBNAIL_CACHE_MAX_BASE64_CHARS,
});

// Survives reloads (IndexedDB, per UID). Created lazily: nothing touches IndexedDB
// until the first lookup, so module load and first render are never blocked.
const persistentThumbnailCache = createPersistentThumbnailCache({
  store: createIdbThumbnailStore(),
  estimateStorage: () => (
    typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate
      ? navigator.storage.estimate()
      : Promise.resolve(null)
  ),
});
const thumbnailCounters = createSnsThumbnailCounters();

function thumbnailCacheKey(userUid: string, path: string): string {
  return `${userUid}:${path}`;
}

function reportThumbnailCacheStats() {
  if (!import.meta.env.DEV) return;
  console.debug('[sns-thumbnail-cache]', {
    ...thumbnailCounters,
    persistent: persistentThumbnailCache.getStats(),
  });
}

const thumbnailRequestQueue = createBatchedRequestQueue(
  async (requests: ThumbnailRequest[]): Promise<ThumbnailLoadResult[]> => {
    const callable = httpsCallable(functions, 'getSnsThumbnailData');
    const result = await callable({ thumbnails: requests.map((request) => request.path) });
    const data = result.data as {
      images?: { ok?: boolean; contentType?: string; dataBase64?: string; contentHash?: string; code?: string }[];
    };

    thumbnailCounters.networkBatches += 1;
    const persistEntries: { path: string; item: ThumbnailCacheItem }[] = [];
    const results = requests.map((request, index) => {
      if (!thumbnailCache.isCurrent(request.scope)) {
        return { ok: false, code: 'auth-user-changed' };
      }

      const image = data.images?.[index];
      if (!image?.ok || !image.dataBase64) {
        return { ok: false, code: image?.code || 'missing-response' };
      }

      const item: ThumbnailCacheItem = {
        contentType: image.contentType || 'image/jpeg',
        dataBase64: image.dataBase64,
        contentHash: image.contentHash,
        fallbackKey: request.cacheKey,
      };
      thumbnailCache.set(request.scope, request.cacheKey, item, image.dataBase64.length);
      persistEntries.push({ path: request.path, item });
      return { ok: true, item };
    });

    // Fire-and-forget: a slow or failing persistent write must never delay the photos.
    // The write is skipped if the auth scope changed while this batch was in flight.
    if (persistEntries.length > 0) {
      const persistScope = requests[0].scope;
      void persistentThumbnailCache.putMany(
        requests[0].userUid,
        persistEntries,
        () => thumbnailCache.isCurrent(persistScope)
      );
    }
    reportThumbnailCacheStats();
    return results;
  },
  { batchSize: SNS_THUMBNAIL_REQUEST_BATCH_SIZE }
);

export function setSnsThumbnailAuthUser(userUid: string | null) {
  const previousUid = thumbnailCache.snapshot().activeUserUid as string | null;
  if (thumbnailCache.setUser(userUid)) {
    thumbnailRequestQueue.clear('auth-user-changed');
    handleAuthUserTransition({
      previousUid,
      nextUid: userUid || null,
      persistentCache: persistentThumbnailCache,
    });
  }
}

export function invalidateSnsThumbnailAuthSession() {
  const activeUid = thumbnailCache.snapshot().activeUserUid as string | null;
  thumbnailCache.invalidate();
  thumbnailRequestQueue.clear('auth-session-invalidated');
  handleAuthSessionInvalidated({ activeUid, persistentCache: persistentThumbnailCache });
}

export function isSnsThumbnailAuthUserCurrent(userUid: string): boolean {
  return thumbnailCache.isCurrent(thumbnailCache.captureScope(userUid));
}

export function createSnsThumbnailLoad(
  userUid: string,
  paths: string[],
  options: { bypassCache?: boolean } = {}
): ThumbnailLoad {
  const scope = thumbnailCache.captureScope(userUid) as ThumbnailAuthScope;
  if (!thumbnailCache.isCurrent(scope)) {
    return {
      promise: Promise.reject(new Error('auth-user-changed')),
      release: () => {},
      isCurrent: () => false,
    };
  }

  const load = createTieredThumbnailLoad({
    userUid,
    paths,
    scope,
    cacheKeyFor: (path: string) => thumbnailCacheKey(userUid, path),
    memoryCache: thumbnailCache,
    persistentCache: persistentThumbnailCache,
    requestFromNetwork: (path: string, cacheKey: string) => thumbnailRequestQueue.request({
      key: cacheKey,
      batchKey: `${userUid}:${scope.generation}`,
      value: { userUid, path, cacheKey, scope },
    }) as Promise<ThumbnailLoadResult>,
    releaseNetworkRequest: (cacheKey: string) => thumbnailRequestQueue.release(cacheKey),
    isCurrent: () => thumbnailCache.isCurrent(scope),
    bypassCache: Boolean(options.bypassCache),
    counters: thumbnailCounters,
  });

  return {
    promise: load.promise as Promise<ThumbnailLoadResult[]>,
    release: load.release,
    isCurrent: () => thumbnailCache.isCurrent(scope),
  };
}
