export type UploadedRecordPhoto = {
  url: string;
  cleanup: () => Promise<void>;
};

type PersistRecordPhotoOptions = {
  upload: () => Promise<UploadedRecordPhoto>;
  persist: (url: string) => Promise<void>;
  commit: (url: string) => void;
};

export async function persistRecordPhoto({ upload, persist, commit }: PersistRecordPhotoOptions): Promise<string> {
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
        // Preserve the original upload or persistence failure.
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
    } catch {
      return { url, deleted: false };
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
