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

    // 📊 압축 전 크기 출력
    const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.log('🖼️ [이미지 압축 시작]');
    console.log(`📥 원본 크기: ${originalSizeMB}MB`);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      console.log(`📐 원본 해상도: ${img.width}x${img.height}`);

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      console.log(`📐 압축 후 해상도: ${width}x${height}`);

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
          if (blob) {
            // 📊 압축 후 크기 출력
            const compressedSizeMB = (blob.size / 1024 / 1024).toFixed(2);
            const compressionRate = ((1 - blob.size / file.size) * 100).toFixed(1);
            console.log(`📤 압축 후 크기: ${compressedSizeMB}MB`);
            console.log(`✅ 압축률: ${compressionRate}%`);
            console.log('🎉 [이미지 압축 완료]\n');
            resolve(blob);
          } else {
            reject(new Error('이미지 압축에 실패했습니다.'));
          }
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
  console.log('🚀 [프로필 이미지 업로드 시작]');
  const compressed = await compressImage(file, 400, 0.85);
  console.log('☁️  Firebase Storage에 업로드 중...');
  const storageRef = ref(storage, `profile_images/${uid}/avatar.jpg`);
  await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
  const downloadUrl = await getDownloadURL(storageRef);
  console.log('✅ 업로드 완료!');
  console.log(`🔗 URL: ${downloadUrl}\n`);
  return downloadUrl;
}
