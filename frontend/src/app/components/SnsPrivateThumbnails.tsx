import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { RotateCw } from 'lucide-react';
import { functions } from '../../firebase';
import { uniqueSnsThumbnailsByContentHash } from '../utils/snsRecords';
import { createBatchedRequestQueue } from '../utils/snsThumbnailRequestQueue';

interface SnsPrivateThumbnailsProps {
  thumbnails?: string[];
  userUid?: string | null;
}

const SNS_THUMBNAIL_DISPLAY_LIMIT = 12;
const SNS_THUMBNAIL_REQUEST_BATCH_SIZE = 4;
const THUMBNAIL_CACHE_MAX_ENTRIES = 300;
const THUMBNAIL_CACHE_MAX_BASE64_CHARS = 12 * 1024 * 1024;
interface ThumbnailCacheItem {
  contentType: string;
  dataBase64: string;
  base64Chars: number;
  contentHash?: string;
}

interface ThumbnailRequest {
  userUid: string;
  path: string;
  cacheKey: string;
}

interface ThumbnailLoadResult {
  ok: boolean;
  item?: ThumbnailCacheItem;
  code?: string;
}

type ThumbnailStatus = 'idle' | 'loading' | 'success' | 'error';

const thumbnailDataCache = new Map<string, ThumbnailCacheItem>();
let thumbnailCacheUid: string | null = null;
let thumbnailCacheBase64Chars = 0;

function clearThumbnailDataCache() {
  thumbnailDataCache.clear();
  thumbnailCacheBase64Chars = 0;
}

function syncThumbnailCacheUser(userUid: string | null) {
  if (thumbnailCacheUid === userUid) return;
  clearThumbnailDataCache();
  thumbnailCacheUid = userUid;
}

function thumbnailCacheKey(userUid: string, path: string): string {
  return `${userUid}:${path}`;
}

function getThumbnailCacheItem(cacheKey: string) {
  const cached = thumbnailDataCache.get(cacheKey);
  if (!cached) return null;
  thumbnailDataCache.delete(cacheKey);
  thumbnailDataCache.set(cacheKey, cached);
  return cached;
}

function setThumbnailCacheItem(cacheKey: string, contentType: string, dataBase64: string, contentHash?: string) {
  const existing = thumbnailDataCache.get(cacheKey);
  if (existing) {
    thumbnailDataCache.delete(cacheKey);
    thumbnailCacheBase64Chars -= existing.base64Chars;
  }

  const base64Chars = dataBase64.length;
  thumbnailDataCache.set(cacheKey, { contentType, dataBase64, base64Chars, contentHash });
  thumbnailCacheBase64Chars += base64Chars;

  while (
    thumbnailDataCache.size > THUMBNAIL_CACHE_MAX_ENTRIES ||
    thumbnailCacheBase64Chars > THUMBNAIL_CACHE_MAX_BASE64_CHARS
  ) {
    const oldestKey = thumbnailDataCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = thumbnailDataCache.get(oldestKey);
    if (oldest) thumbnailCacheBase64Chars -= oldest.base64Chars;
    thumbnailDataCache.delete(oldestKey);
  }
}

const thumbnailRequestQueue = createBatchedRequestQueue(
  async (requests: ThumbnailRequest[]): Promise<ThumbnailLoadResult[]> => {
    const callable = httpsCallable(functions, 'getSnsThumbnailData');
    const result = await callable({ thumbnails: requests.map((request) => request.path) });
    const data = result.data as {
      images?: { ok?: boolean; contentType?: string; dataBase64?: string; contentHash?: string; code?: string }[];
    };

    return requests.map((request, index) => {
      const image = data.images?.[index];
      if (!image?.ok || !image.dataBase64) {
        return { ok: false, code: image?.code || 'missing-response' };
      }

      const item = {
        contentType: image.contentType || 'image/jpeg',
        dataBase64: image.dataBase64,
        base64Chars: image.dataBase64.length,
        contentHash: image.contentHash,
      };
      if (thumbnailCacheUid === request.userUid) {
        setThumbnailCacheItem(
          request.cacheKey,
          item.contentType,
          item.dataBase64,
          item.contentHash
        );
      }
      return { ok: true, item };
    });
  },
  { batchSize: SNS_THUMBNAIL_REQUEST_BATCH_SIZE }
);

function createThumbnailLoad(requests: ThumbnailRequest[]) {
  const queuedKeys: string[] = [];
  const promise = Promise.all(requests.map((request) => {
    const cached = getThumbnailCacheItem(request.cacheKey);
    if (cached) return Promise.resolve({ ok: true, item: cached });

    queuedKeys.push(request.cacheKey);
    return thumbnailRequestQueue.request({
      key: request.cacheKey,
      batchKey: request.userUid,
      value: request,
    }) as Promise<ThumbnailLoadResult>;
  }));

  return {
    promise,
    release: () => queuedKeys.forEach((key) => thumbnailRequestQueue.release(key)),
  };
}

function extractSnsThumbnailPath(value: string, userUid: string): string | null {
  const marker = `/users/${userUid}/snsThumbnails/`;

  if (value.startsWith(`users/${userUid}/snsThumbnails/`)) {
    return value;
  }

  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) {
    return value.slice(markerIndex + 1).split('?')[0];
  }

  try {
    const url = new URL(value);
    if (url.pathname.includes('/o/')) {
      const encodedPath = url.pathname.split('/o/')[1]?.split('/')[0] || '';
      const decodedPath = decodeURIComponent(encodedPath);
      return decodedPath.startsWith(`users/${userUid}/snsThumbnails/`) ? decodedPath : null;
    }
  } catch {
    return null;
  }

  return null;
}

function base64ToObjectUrl(dataBase64: string, contentType: string): string {
  const bytes = Uint8Array.from(atob(dataBase64), (char) => char.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: contentType || 'image/jpeg' }));
}

function classifyThumbnailValue(value: string): string {
  if (value.startsWith('users/')) return 'bare-path';
  if (value.includes('storage.googleapis.com')) return 'storage.googleapis.com-url';
  if (value.includes('/o/')) return 'firebase-o-url';
  return 'unknown';
}

export function SnsPrivateThumbnails({ thumbnails = [], userUid }: SnsPrivateThumbnailsProps) {
  const [objectUrls, setObjectUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<ThumbnailStatus>('idle');
  const [retryVersion, setRetryVersion] = useState(0);
  const sourceValues = useMemo(
    () => thumbnails
      .slice(0, SNS_THUMBNAIL_DISPLAY_LIMIT)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    [thumbnails]
  );
  const hasThumbnails = sourceValues.length > 0;

  useEffect(() => {
    if (!hasThumbnails) {
      setObjectUrls([]);
      setStatus('idle');
      return;
    }
    if (!userUid) {
      syncThumbnailCacheUser(null);
      setObjectUrls([]);
      setStatus('error');
      return;
    }
    syncThumbnailCacheUser(userUid);
    setObjectUrls([]);
    setStatus('loading');

    let active = true;
    let createdUrls: string[] = [];
    let releaseRequests = () => {};

    const load = async () => {
      // 2026-09-16 read-only production audit: all 72 merged photo groups
      // fit within 12 thumbnails (4: 52 groups, 8: 4, 12: 16; max 12).
      const paths = sourceValues
        .map((value) => extractSnsThumbnailPath(value, userUid))
        .filter((value): value is string => Boolean(value));

      if (paths.length === 0) {
        console.warn('SNS 썸네일 경로 변환 실패', {
          count: sourceValues.length,
          kinds: sourceValues.map(classifyThumbnailValue),
        });
        if (active) setStatus('error');
        return;
      }

      const pathRequests = paths.map((path) => ({ path, cacheKey: thumbnailCacheKey(userUid, path) }));
      const thumbnailLoad = createThumbnailLoad(pathRequests.map((request) => ({
        ...request,
        userUid,
      })));
      releaseRequests = thumbnailLoad.release;
      const results = await thumbnailLoad.promise;
      if (!active) return;

      const failedCodes = results
        .filter((result) => !result.ok)
        .map((result) => result.code || 'unknown');
      const invalidPathCount = sourceValues.length - paths.length;
      if (failedCodes.length > 0 || invalidPathCount > 0) {
        console.warn('SNS 썸네일 일부 조회 실패', {
          count: failedCodes.length + invalidPathCount,
          codes: [...failedCodes, ...Array(invalidPathCount).fill('invalid-thumbnail')],
        });
      }

      const thumbnailImages = results
        .map((result, index) => result.ok && result.item
          ? { ...result.item, fallbackKey: pathRequests[index].cacheKey }
          : null)
        .filter((image): image is ThumbnailCacheItem & { fallbackKey: string } => Boolean(image));
      const urls = uniqueSnsThumbnailsByContentHash(thumbnailImages)
        .map((image) => base64ToObjectUrl(image.dataBase64, image.contentType));

      createdUrls = urls;
      setObjectUrls(urls);
      setStatus(failedCodes.length > 0 || invalidPathCount > 0 ? 'error' : 'success');
    };

    load().catch((error) => {
      if (!active) return;
      console.error('SNS 썸네일 조회 실패', {
        code: error?.code || error?.name || 'unknown',
      });
      setObjectUrls([]);
      setStatus('error');
    });

    return () => {
      active = false;
      releaseRequests();
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [hasThumbnails, retryVersion, sourceValues, userUid]);

  if (!hasThumbnails) return null;

  return (
    <div style={{ marginTop: 10 }}>
      {objectUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {objectUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, background: '#eee' }}
            />
          ))}
        </div>
      )}
      {status === 'loading' && (
        <div role="status" style={{ fontSize: 12, color: '#666', padding: '8px 0' }}>
          사진 불러오는 중…
        </div>
      )}
      {status === 'error' && (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9b3a32', padding: '8px 0' }}
        >
          <span>사진을 불러오지 못했습니다 ·</span>
          <button
            type="button"
            onClick={() => setRetryVersion((version) => version + 1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: 0,
              padding: 0,
              background: 'transparent',
              color: '#9b3a32',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RotateCw size={13} aria-hidden="true" />
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
