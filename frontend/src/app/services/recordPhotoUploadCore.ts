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

export function decodeConvertedJpeg(data: unknown): Blob {
  const result = data as { imageBase64?: unknown; contentType?: unknown };
  if (typeof result?.imageBase64 !== 'string' || result.contentType !== 'image/jpeg') {
    throw new Error('HEIC 변환 결과가 올바르지 않습니다.');
  }

  const binary = atob(result.imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: 'image/jpeg' });
}
