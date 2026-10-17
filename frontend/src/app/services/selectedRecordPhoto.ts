const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_SELECTION_BYTES = 60 * 1024 * 1024;

export type SelectedRecordPhoto =
  | { ok: true; file: File }
  | { ok: false; message: string };

// Start every stream read in the input change handler, before inspecting
// size/EXIF or awaiting another file. Android picker metadata snapshots can
// otherwise cause ERR_UPLOAD_FILE_CHANGED. Keep only bounded memory Files.
export function startSelectedRecordPhotoReads(files: File[]): Promise<SelectedRecordPhoto>[] {
  let selectionBytes = 0;
  return files.map(async (source): Promise<SelectedRecordPhoto> => {
    const mimeType = source.type.startsWith('image/') ? source.type
      : ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' } as Record<string, string>)[source.name.split('.').pop()?.toLowerCase() || ''];
    if (!mimeType) {
      return { ok: false, message: '이미지 형식으로 인식하지 못한 파일이 있습니다.' };
    }
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let reservedBytes = 0;
    let succeeded = false;
    const releaseBudget = () => {
      selectionBytes -= reservedBytes;
      reservedBytes = 0;
    };
    try {
      // Do not query source.size/source.lastModified or slice the source.
      reader = source.stream().getReader();
      const chunks: BlobPart[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_PHOTO_BYTES) {
          releaseBudget();
          await reader.cancel().catch(() => {});
          return { ok: false, message: '20MB를 초과한 사진이 있습니다.' };
        }
        if (selectionBytes + value.byteLength > MAX_SELECTION_BYTES) {
          releaseBudget();
          await reader.cancel().catch(() => {});
          return { ok: false, message: '선택한 사진의 합계가 60MB를 초과했습니다. 사진을 나누어 추가해주세요.' };
        }
        selectionBytes += value.byteLength;
        reservedBytes += value.byteLength;
        chunks.push(new Uint8Array(value));
      }
      const file = new File(chunks, source.name, { type: mimeType });
      succeeded = true;
      return { ok: true, file };
    } catch {
      releaseBudget();
      await reader?.cancel().catch(() => {});
      return { ok: false, message: '사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.' };
    } finally {
      if (!succeeded) releaseBudget();
      reader?.releaseLock();
    }
  });
}

// Invoke directly in the selection event, before input reset, EXIF, or any await.
export async function readSelectedRecordPhoto(source: File): Promise<File> {
  const [pending] = startSelectedRecordPhotoReads([source]);
  const result = await pending;
  if (!result.ok) {
    const error = new Error(result.message);
    error.name = 'PhotoReadError';
    throw error;
  }
  return result.file;
}

export async function readSelectedRecordPhotos(
  sources: File[], onFailure: (message: string) => void,
): Promise<File[]> {
  const pending = startSelectedRecordPhotoReads(sources);
  const files: File[] = [];
  while (pending.length) {
    const result = await pending.shift()!;
    if (result.ok) files.push(result.file);
    else onFailure(result.message);
  }
  return files;
}

// PDF attachments keep their existing validation/upload path. Only photos need
// picker snapshots; start every photo read before awaiting any preceding PDF.
export async function readSelectedPhotoAttachments(sources: File[]): Promise<File[]> {
  const photoReads = startSelectedRecordPhotoReads(sources.filter(source => source.type !== 'application/pdf'));
  const pending = sources.map(source => source.type === 'application/pdf'
    ? Promise.resolve({ ok: true as const, file: source })
    : photoReads.shift()!);
  const files: File[] = [];
  while (pending.length) {
    const result = await pending.shift()!;
    if (!result.ok) throw new Error(result.message);
    files.push(result.file);
  }
  return files;
}
