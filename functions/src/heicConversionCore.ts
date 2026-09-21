export const CONVERTED_JPEG_MAX_BYTES = 6 * 1024 * 1024;
export const CONVERT_HEIC_MAX_SERIALIZED_RESPONSE_BYTES = 30 * 1024 * 1024;
export const HEIC_TEMP_MAX_AGE_MS = 60 * 60 * 1000;
export const HEIC_UPLOAD_TRANSFORMATION = {
  width: 2560,
  height: 2560,
  crop: 'limit',
  angle: 'auto',
  quality: 80,
  flags: 'strip_profile',
} as const;

export type ConvertHeicResponse = {
  imageBase64: string;
  contentType: 'image/jpeg';
  url: string;
};

type CloudinaryUploadResult = {
  public_id?: string;
  secure_url?: string;
};

type ConvertHeicDependencies = {
  upload: (dataUri: string, publicId: string) => Promise<CloudinaryUploadResult>;
  download: (url: string, maxBytes: number) => Promise<Buffer>;
  destroy: (publicId: string) => Promise<void>;
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

async function destroyTemporaryObject(publicId: string, destroy: (publicId: string) => Promise<void>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await destroy(publicId);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

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

export async function convertHeicToJpegBase64(
  imageBase64: string,
  temporaryPublicId: string,
  dependencies: ConvertHeicDependencies,
): Promise<ConvertHeicResponse> {
  try {
    const uploaded = await dependencies.upload(`data:image/heic;base64,${imageBase64}`, temporaryPublicId);
    if (uploaded.public_id && uploaded.public_id !== temporaryPublicId) {
      throw new Error('Cloudinary temporary object id mismatch');
    }
    if (!uploaded.secure_url) {
      throw new Error('Cloudinary conversion URL is missing');
    }

    const jpeg = await dependencies.download(uploaded.secure_url, CONVERTED_JPEG_MAX_BYTES);
    return buildConvertHeicResponse(jpeg);
  } finally {
    await destroyTemporaryObject(temporaryPublicId, dependencies.destroy);
  }
}
