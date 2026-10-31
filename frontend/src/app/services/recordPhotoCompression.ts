type RecordPhotoCompressionDependencies = {
  isHeic: boolean;
  compress: (file: File) => Promise<Blob>;
  convertHeic: (file: File) => Promise<File>;
};

// The caller supplies the memory File captured during the input change event.
// Prefer the existing browser HEIC decoder so only the small JPEG is uploaded.
export async function compressRecordPhoto(
  file: File,
  dependencies: RecordPhotoCompressionDependencies,
): Promise<Blob> {
  try {
    return await dependencies.compress(file);
  } catch (error) {
    if (!dependencies.isHeic) throw error;
  }
  const converted = await dependencies.convertHeic(file);
  return dependencies.compress(converted);
}
