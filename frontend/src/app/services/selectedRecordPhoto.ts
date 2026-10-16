const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export type SelectedRecordPhoto =
  | { ok: true; file: File }
  | { ok: false; message: string };

// Start every stream read in the input change handler, before inspecting
// size/EXIF or awaiting another file. Android picker metadata snapshots can
// otherwise cause ERR_UPLOAD_FILE_CHANGED. Keep only bounded memory Files.
export function startSelectedRecordPhotoReads(files: File[]): Promise<SelectedRecordPhoto>[] {
  return files.map(async (source): Promise<SelectedRecordPhoto> => {
    const isHeic = source.type === 'image/heic' || source.type === 'image/heif' || /\.(heic|heif)$/i.test(source.name);
    if (!source.type.startsWith('image/') && !isHeic) {
      return { ok: false, message: '이미지 형식으로 인식하지 못한 파일이 있습니다.' };
    }
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
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
          await reader.cancel().catch(() => {});
          return { ok: false, message: '20MB를 초과한 사진이 있습니다.' };
        }
        chunks.push(new Uint8Array(value));
      }
      return { ok: true, file: new File(chunks, source.name, { type: source.type }) };
    } catch {
      await reader?.cancel().catch(() => {});
      return { ok: false, message: '사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.' };
    } finally {
      reader?.releaseLock();
    }
  });
}
