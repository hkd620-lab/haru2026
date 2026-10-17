import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { compressImage } from './imageService';
import { compressRecordPhoto } from './recordPhotoCompression';
import { decodeConvertedJpeg } from './recordPhotoUploadCore';

// Callers must first snapshot picker Files during the selection event.
export async function compressUploadPhoto(file: File, maxWidth = 800, quality = 0.85): Promise<Blob> {
  const isHeic = /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  return compressRecordPhoto(file, {
    isHeic,
    compress: image => compressImage(image, maxWidth, quality),
    convertHeic: async original => {
      const bytes = new Uint8Array(await original.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      }
      const result = await httpsCallable(functions, 'convertHeic')({ imageBase64: btoa(binary) });
      const jpeg = await decodeConvertedJpeg(result.data);
      return new File([jpeg], original.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    },
  });
}
