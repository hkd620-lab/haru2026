import { useEffect, useState } from 'react';
import { getBlob, ref as storageRef } from 'firebase/storage';
import { storage } from '../../firebase';

interface SnsPrivateThumbnailsProps {
  thumbnails?: string[];
  userUid?: string | null;
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
      const paths = thumbnails
        .slice(0, 3)
        .map((value) => extractSnsThumbnailPath(value, userUid))
        .filter((value): value is string => Boolean(value));

      const urls = await Promise.all(
        paths.map(async (path) => {
          const blob = await getBlob(storageRef(storage, path));
          return URL.createObjectURL(blob);
        })
      );

      createdUrls = urls;
      if (active) {
        setObjectUrls(urls);
      } else {
        urls.forEach((url) => URL.revokeObjectURL(url));
      }
    };

    load().catch((error) => {
      console.error('SNS 썸네일 조회 실패:', error);
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
