import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../firebase';

export type TodayChargeContentType = 'charge' | 'ramen';

export interface PublishTodayChargeInput {
  imageFile: File;
  title: string;
  caption: string;
  type: TodayChargeContentType;
  publishDate: string;
}

export const getTodayDateKey = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const publishTodayChargeContent = async ({
  imageFile,
  title,
  caption,
  type,
  publishDate,
}: PublishTodayChargeInput) => {
  const ext = imageFile.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, `today-charge/${fileName}`);
  await uploadBytes(storageRef, imageFile);
  const imageUrl = await getDownloadURL(storageRef);

  return addDoc(collection(db, 'today_charge'), {
    imageUrl,
    title: title.trim(),
    caption: caption.trim(),
    type,
    publishDate,
    status: 'published',
    createdAt: serverTimestamp(),
    curator: 'haru2026',
  });
};
