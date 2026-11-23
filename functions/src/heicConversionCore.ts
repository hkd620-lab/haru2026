export const CONVERTED_JPEG_MAX_BYTES = 6 * 1024 * 1024;
export const CONVERT_HEIC_MAX_SERIALIZED_RESPONSE_BYTES = 30 * 1024 * 1024;
export const HEIC_TEMP_MAX_AGE_MS = 60 * 60 * 1000;

export type ConvertHeicResponse = {
  imageBase64: string;
  contentType: 'image/jpeg';
  url: string;
};

type HeicTempResource = {
  public_id?: string;
  created_at?: string;
};

type HeicTempResourcePage = {
  resources?: HeicTempResource[];
  next_cursor?: string;
};

type SweepHeicTempDependencies = {
  list: (nextCursor?: string) => Promise<HeicTempResourcePage>;
  destroy: (publicId: string) => Promise<void>;
};

export function buildConvertHeicResponse(jpeg: Buffer): ConvertHeicResponse {
  if (jpeg.length === 0 || jpeg.length > CONVERTED_JPEG_MAX_BYTES) {
    throw new Error('Converted JPEG exceeds the response size limit');
  }
  const imageBase64 = jpeg.toString('base64');
  const response: ConvertHeicResponse = {
    imageBase64,
    contentType: 'image/jpeg',
    url: `data:image/jpeg;base64,${imageBase64}`,
  };
  const callablePayloadBytes = Buffer.byteLength(JSON.stringify({ data: response }), 'utf8');
  if (callablePayloadBytes > CONVERT_HEIC_MAX_SERIALIZED_RESPONSE_BYTES) {
    throw new Error('Converted JPEG callable response exceeds the serialized size limit');
  }
  return response;
}

export async function sweepExpiredHeicTempObjects(
  nowMs: number,
  dependencies: SweepHeicTempDependencies,
): Promise<{ deleted: string[]; failed: string[] }> {
  const expiredPublicIds: string[] = [];
  let nextCursor: string | undefined;
  do {
    const page = await dependencies.list(nextCursor);
    for (const resource of page.resources || []) {
      const publicId = String(resource.public_id || '');
      const createdAtMs = Date.parse(String(resource.created_at || ''));
      if (
        publicId.startsWith('heic_temp/') &&
        Number.isFinite(createdAtMs) &&
        nowMs - createdAtMs >= HEIC_TEMP_MAX_AGE_MS
      ) {
        expiredPublicIds.push(publicId);
      }
    }
    nextCursor = page.next_cursor;
  } while (nextCursor);

  const deleted: string[] = [];
  const failed: string[] = [];
  for (const publicId of expiredPublicIds) {
    try {
      await dependencies.destroy(publicId);
      deleted.push(publicId);
    } catch {
      failed.push(publicId);
    }
  }
  return { deleted, failed };
}

// 서버 내부 변환 경로. convert는 HEIC 원본 바이트를 받아 메타데이터 없는 JPEG를 돌려준다
// (index.ts에서 heicLocalConversion.convertHeicBufferToJpeg를 주입).
export async function convertHeicLocallyToJpegBase64(
  imageBase64: string,
  convert: (input: Buffer) => Promise<Buffer>,
): Promise<ConvertHeicResponse> {
  const jpeg = await convert(Buffer.from(imageBase64, 'base64'));
  if (!Buffer.isBuffer(jpeg) || jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error('Local HEIC conversion did not return JPEG data');
  }
  return buildConvertHeicResponse(jpeg);
}
