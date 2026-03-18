import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

/**
 * Canvas API를 이용해 이미지를 압축합니다.
 * @param file 원본 이미지 파일
 * @param maxWidth 최대 너비 (px), 기본값 800
 * @param quality JPEG 품질 (0~1), 기본값 0.85
 */
export async function compressImage(
  file: File,
  maxWidth = 800,
  quality = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context를 가져올 수 없습니다.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('이미지 압축에 실패했습니다.'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 불러올 수 없습니다.'));
    };

    img.src = objectUrl;
  });
}

/**
 * 프로필 이미지를 압축 후 Firebase Storage에 업로드합니다.
 * @param uid 사용자 UID
 * @param file 업로드할 이미지 파일
 * @returns 업로드된 이미지의 다운로드 URL
 */
export async function uploadProfileImage(uid: string, file: File): Promise<string> {
  const compressed = await compressImage(file, 400, 0.85);
  const storageRef = ref(storage, `profile_images/${uid}/avatar.jpg`);
  await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
