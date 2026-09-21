export type UploadedRecordPhoto = {
  url: string;
  cleanup: () => Promise<void>;
};

type PersistRecordPhotoOptions = {
  upload: () => Promise<UploadedRecordPhoto>;
  persist: (url: string) => Promise<void>;
  commit: (url: string) => void;
  onCleanupFailure?: (uploaded: UploadedRecordPhoto) => void | Promise<void>;
};

const PENDING_RECORD_PHOTO_CLEANUP_KEY = 'haru2026_pending_record_photo_cleanup';

function readPendingRecordPhotoCleanupPaths(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_RECORD_PHOTO_CLEANUP_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((path) => typeof path === 'string') : [];
  } catch {
    return [];
  }
}

function writePendingRecordPhotoCleanupPaths(paths: string[]) {
  localStorage.setItem(PENDING_RECORD_PHOTO_CLEANUP_KEY, JSON.stringify(Array.from(new Set(paths))));
}

export function enqueuePendingRecordPhotoCleanup(path: string) {
  if (!path) return;
  writePendingRecordPhotoCleanupPaths([...readPendingRecordPhotoCleanupPaths(), path]);
}

function isObjectAlreadyDeleted(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code || '').toLowerCase();
  return code === 'storage/object-not-found' || code.includes('object-not-found');
}

export async function retryPendingRecordPhotoCleanup(
  uid: string,
  deletePath: (path: string) => Promise<void>,
): Promise<{ deletedPaths: string[]; failedPaths: string[] }> {
  const ownerPrefix = `users/${uid}/format_photos/`;
  const ownedPaths = readPendingRecordPhotoCleanupPaths().filter((path) => path.startsWith(ownerPrefix));
  const unownedPaths = readPendingRecordPhotoCleanupPaths().filter((path) => !path.startsWith(ownerPrefix));
  const deletedPaths: string[] = [];
  const failedPaths: string[] = [];
  for (const path of ownedPaths) {
    try {
      await deletePath(path);
      deletedPaths.push(path);
    } catch (error) {
      if (isObjectAlreadyDeleted(error)) deletedPaths.push(path);
      else failedPaths.push(path);
    }
  }
  writePendingRecordPhotoCleanupPaths([...unownedPaths, ...failedPaths]);
  return { deletedPaths, failedPaths };
}

export async function persistRecordPhoto({
  upload,
  persist,
  commit,
  onCleanupFailure,
}: PersistRecordPhotoOptions): Promise<string> {
  let uploaded: UploadedRecordPhoto | null = null;
  try {
    uploaded = await upload();
    await persist(uploaded.url);
    commit(uploaded.url);
    return uploaded.url;
  } catch (error) {
    if (uploaded) {
      try {
        await uploaded.cleanup();
      } catch {
        await onCleanupFailure?.(uploaded);
      }
    }
    throw error;
  }
}

export function excludeCommittedRecordPhotoUrls(trackedUrls: string[], committedUrls: string[]): string[] {
  const committed = new Set(committedUrls);
  return trackedUrls.filter((url) => !committed.has(url));
}

export async function cleanupTrackedRecordPhotos(
  urls: string[],
  deleteUrl: (url: string) => Promise<void>,
): Promise<{ deletedUrls: string[]; failedUrls: string[] }> {
  const uniqueUrls = Array.from(new Set(urls));
  const results = await Promise.all(uniqueUrls.map(async (url) => {
    try {
      await deleteUrl(url);
      return { url, deleted: true };
    } catch (error) {
      return { url, deleted: isObjectAlreadyDeleted(error) };
    }
  }));
  return {
    deletedUrls: results.filter((result) => result.deleted).map((result) => result.url),
    failedUrls: results.filter((result) => !result.deleted).map((result) => result.url),
  };
}

export async function decodeConvertedJpeg(data: unknown): Promise<Blob> {
  const result = data as { imageBase64?: unknown; contentType?: unknown; url?: unknown };
  if (typeof result?.imageBase64 === 'string' && result.contentType === 'image/jpeg') {
    const binary = atob(result.imageBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: 'image/jpeg' });
  }

  if (typeof result?.url === 'string' && result.url) {
    const response = await fetch(result.url);
    if (!response.ok) throw new Error('변환된 JPG를 내려받지 못했습니다.');
    const blob = await response.blob();
    if (blob.type && blob.type !== 'image/jpeg') {
      throw new Error('HEIC 변환 결과가 JPEG 형식이 아닙니다.');
    }
    return blob;
  }

  throw new Error('HEIC 변환 결과가 올바르지 않습니다.');
}
