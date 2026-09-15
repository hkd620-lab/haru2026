import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

interface SnsPrivateThumbnailsProps {
  thumbnails?: string[];
  userUid?: string | null;
}

const SNS_THUMBNAIL_DISPLAY_LIMIT = 12;
const thumbnailDataCache = new Map<string, { contentType: string; dataBase64: string }>();

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
    if (!userUid) {
      setObjectUrls([]);
      return;
    }

    let active = true;
    let createdUrls: string[] = [];

    const load = async () => {
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

      const missingPaths = paths.filter((path) => !thumbnailDataCache.has(path));
      if (missingPaths.length > 0) {
        const callable = httpsCallable(functions, 'getSnsThumbnailData');
        const result = await callable({ thumbnails: missingPaths });
        const data = result.data as {
          images?: { ok?: boolean; contentType?: string; dataBase64?: string; code?: string }[];
        };

        (data.images || []).forEach((image, index) => {
          if (!image?.ok || !image.dataBase64) return;
          thumbnailDataCache.set(missingPaths[index], {
            contentType: image.contentType || 'image/jpeg',
            dataBase64: image.dataBase64,
          });
        });

        const failedCodes = (data.images || [])
          .filter((image) => !image?.ok)
          .map((image) => image?.code || 'unknown');
        if (failedCodes.length > 0) {
          console.warn('SNS 썸네일 일부 조회 실패', { count: failedCodes.length, codes: failedCodes });
        }
      }

      const urls = paths
        .map((path) => thumbnailDataCache.get(path))
        .filter((image): image is { contentType: string; dataBase64: string } => Boolean(image))
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
