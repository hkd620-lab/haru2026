import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../firebase';

interface SnsPrivateThumbnailsProps {
  thumbnails?: string[];
  userUid?: string | null;
}

const SNS_THUMBNAIL_DISPLAY_LIMIT = 12;
const THUMBNAIL_CACHE_MAX_ENTRIES = 300;
const THUMBNAIL_CACHE_MAX_BASE64_CHARS = 12 * 1024 * 1024;
const thumbnailDataCache = new Map<string, { contentType: string; dataBase64: string; base64Chars: number }>();
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

function setThumbnailCacheItem(cacheKey: string, contentType: string, dataBase64: string) {
  const existing = thumbnailDataCache.get(cacheKey);
  if (existing) {
    thumbnailDataCache.delete(cacheKey);
    thumbnailCacheBase64Chars -= existing.base64Chars;
  }

  const base64Chars = dataBase64.length;
  thumbnailDataCache.set(cacheKey, { contentType, dataBase64, base64Chars });
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      syncThumbnailCacheUser(currentUser?.uid || null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!userUid) {
      syncThumbnailCacheUser(null);
      setObjectUrls([]);
      return;
    }
    syncThumbnailCacheUser(userUid);

    let active = true;
    let createdUrls: string[] = [];

    const load = async () => {
      // 2026-09-16 read-only production audit: all 72 merged photo groups
      // fit within 12 thumbnails (4: 52 groups, 8: 4, 12: 16; max 12).
      const sourceValues = thumbnails
        .slice(0, SNS_THUMBNAIL_DISPLAY_LIMIT)
        .filter((value): value is string => typeof value === 'string');
      const paths = thumbnails
        .slice(0, SNS_THUMBNAIL_DISPLAY_LIMIT)
        .map((value) => extractSnsThumbnailPath(value, userUid))
        .filter((value): value is string => Boolean(value));

      if (paths.length === 0 && sourceValues.length > 0) {
        console.warn('SNS 썸네일 경로 변환 실패', {
          count: sourceValues.length,
          kinds: sourceValues.map(classifyThumbnailValue),
        });
        if (active) setObjectUrls([]);
        return;
      }
      if (paths.length === 0) {
        if (active) setObjectUrls([]);
        return;
      }

      const pathRequests = paths.map((path) => ({ path, cacheKey: thumbnailCacheKey(userUid, path) }));
      const missingRequests = pathRequests.filter((request) => !thumbnailDataCache.has(request.cacheKey));
      if (missingRequests.length > 0) {
        const callable = httpsCallable(functions, 'getSnsThumbnailData');
        const result = await callable({ thumbnails: missingRequests.map((request) => request.path) });
        if (!active) return;
        const data = result.data as {
          images?: { ok?: boolean; contentType?: string; dataBase64?: string; code?: string }[];
        };

        (data.images || []).forEach((image, index) => {
          if (!image?.ok || !image.dataBase64) return;
          setThumbnailCacheItem(
            missingRequests[index].cacheKey,
            image.contentType || 'image/jpeg',
            image.dataBase64
          );
        });

        const failedCodes = (data.images || [])
          .filter((image) => !image?.ok)
          .map((image) => image?.code || 'unknown');
        if (failedCodes.length > 0) {
          console.warn('SNS 썸네일 일부 조회 실패', { count: failedCodes.length, codes: failedCodes });
        }
      }

      const urls = pathRequests
        .map((request) => getThumbnailCacheItem(request.cacheKey))
        .filter((image): image is { contentType: string; dataBase64: string; base64Chars: number } => Boolean(image))
        .map((image) => base64ToObjectUrl(image.dataBase64, image.contentType));

      createdUrls = urls;
      if (active) {
        setObjectUrls(urls);
      } else {
        urls.forEach((url) => URL.revokeObjectURL(url));
      }
    };

    load().catch((error) => {
      console.error('SNS 썸네일 조회 실패', {
        code: error?.code || error?.name || 'unknown',
      });
      if (active) setObjectUrls([]);
    });

    return () => {
      active = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [thumbnails, userUid]);

  if (objectUrls.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
      {objectUrls.map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, background: '#eee' }}
        />
      ))}
    </div>
  );
}
