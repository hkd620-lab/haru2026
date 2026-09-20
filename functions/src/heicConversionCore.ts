export const CONVERTED_JPEG_MAX_BYTES = 6 * 1024 * 1024;

type CloudinaryUploadResult = {
  public_id?: string;
  secure_url?: string;
};

type ConvertHeicDependencies = {
  upload: (dataUri: string, publicId: string) => Promise<CloudinaryUploadResult>;
  download: (url: string, maxBytes: number) => Promise<Buffer>;
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

export async function convertHeicToJpegBase64(
  imageBase64: string,
  temporaryPublicId: string,
  dependencies: ConvertHeicDependencies,
): Promise<{ imageBase64: string; contentType: 'image/jpeg' }> {
  try {
    const uploaded = await dependencies.upload(`data:image/heic;base64,${imageBase64}`, temporaryPublicId);
    if (uploaded.public_id && uploaded.public_id !== temporaryPublicId) {
      throw new Error('Cloudinary temporary object id mismatch');
    }
    if (!uploaded.secure_url) {
      throw new Error('Cloudinary conversion URL is missing');
    }

    const jpeg = await dependencies.download(uploaded.secure_url, CONVERTED_JPEG_MAX_BYTES);
    if (jpeg.length === 0 || jpeg.length > CONVERTED_JPEG_MAX_BYTES) {
      throw new Error('Converted JPEG exceeds the response size limit');
    }

    return { imageBase64: jpeg.toString('base64'), contentType: 'image/jpeg' };
  } finally {
    await destroyTemporaryObject(temporaryPublicId, dependencies.destroy);
  }
}
