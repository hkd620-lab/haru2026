const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export type SelectedRecordPhoto =
  | { ok: true; file: File; buffer: ArrayBuffer }
  | { ok: false; message: string };

// Start every read in the input change handler, before inspecting size/EXIF or
// awaiting another file. Android picker metadata snapshots can otherwise cause
// ERR_UPLOAD_FILE_CHANGED. Only memory-backed files reach downstream readers.
export function startSelectedRecordPhotoReads(files: File[]): Promise<SelectedRecordPhoto>[] {
  return files.map(async (source): Promise<SelectedRecordPhoto> => {
    const isHeic = /image\/(heic|heif)/i.test(source.type) || /\.(heic|heif)$/i.test(source.name);
    if (!source.type.startsWith('image/') && !isHeic) {
      return { ok: false, message: '이미지 형식으로 인식하지 못한 파일이 있습니다.' };
    }
    try {
      // Do not read source.size/source.lastModified or slice the source here.
      const buffer = await source.arrayBuffer();
      if (buffer.byteLength > MAX_PHOTO_BYTES) {
        return { ok: false, message: '20MB를 초과한 사진이 있습니다.' };
      }
      return { ok: true, file: new File([buffer], source.name, { type: source.type }), buffer };
    } catch {
      return { ok: false, message: '사진 원본을 읽지 못했습니다. 사진을 기기에 다운로드한 뒤 다시 선택해주세요.' };
    }
  });
}
