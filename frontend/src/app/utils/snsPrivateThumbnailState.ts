import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { createAuthScopedThumbnailCache } from './snsThumbnailAuthCache';
import { createBatchedRequestQueue } from './snsThumbnailRequestQueue';

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

function thumbnailCacheKey(userUid: string, path: string): string {
  return `${userUid}:${path}`;
}

const thumbnailRequestQueue = createBatchedRequestQueue(
  async (requests: ThumbnailRequest[]): Promise<ThumbnailLoadResult[]> => {
    const callable = httpsCallable(functions, 'getSnsThumbnailData');
    const result = await callable({ thumbnails: requests.map((request) => request.path) });
    const data = result.data as {
      images?: { ok?: boolean; contentType?: string; dataBase64?: string; contentHash?: string; code?: string }[];
    };

    return requests.map((request, index) => {
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
      return { ok: true, item };
    });
  },
  { batchSize: SNS_THUMBNAIL_REQUEST_BATCH_SIZE }
);

export function setSnsThumbnailAuthUser(userUid: string | null) {
  if (thumbnailCache.setUser(userUid)) {
    thumbnailRequestQueue.clear('auth-user-changed');
  }
}

export function invalidateSnsThumbnailAuthSession() {
  thumbnailCache.invalidate();
  thumbnailRequestQueue.clear('auth-session-invalidated');
}

export function isSnsThumbnailAuthUserCurrent(userUid: string): boolean {
  return thumbnailCache.isCurrent(thumbnailCache.captureScope(userUid));
}

export function createSnsThumbnailLoad(userUid: string, paths: string[]): ThumbnailLoad {
  const scope = thumbnailCache.captureScope(userUid) as ThumbnailAuthScope;
  if (!thumbnailCache.isCurrent(scope)) {
    return {
      promise: Promise.reject(new Error('auth-user-changed')),
      release: () => {},
      isCurrent: () => false,
    };
  }

  const queuedKeys: string[] = [];
  const requests = paths.map((path) => ({
    userUid,
    path,
    cacheKey: thumbnailCacheKey(userUid, path),
    scope,
  }));
  const promise = Promise.all(requests.map((request) => {
    const cached = thumbnailCache.get(scope, request.cacheKey) as ThumbnailCacheItem | null;
    if (cached) return Promise.resolve({ ok: true, item: cached });

    queuedKeys.push(request.cacheKey);
    return thumbnailRequestQueue.request({
      key: request.cacheKey,
      batchKey: `${userUid}:${scope.generation}`,
      value: request,
    }) as Promise<ThumbnailLoadResult>;
  }));

  return {
    promise,
    release: () => queuedKeys.forEach((key) => thumbnailRequestQueue.release(key)),
    isCurrent: () => thumbnailCache.isCurrent(scope),
  };
}
