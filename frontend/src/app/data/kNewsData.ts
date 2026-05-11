import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export type KNewsCategory = 'K-컬처' | 'K-푸드' | 'K-기술' | 'K-스포츠' | '글로벌 위상' | '한국의 가치';

export interface KNews {
  id: string;
  title: string;
  subtitle: string;
  category: KNewsCategory;
  tags: string[];
  curator: string;
  createdAt?: Timestamp | { seconds: number };
  imageUrl: string;
  sources: string[];
  balanceNote?: string;
}

export const fetchKNews = async (): Promise<KNews[]> => {
  const q = query(collection(db, 'k_news'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as KNews[];
};

export const CATEGORY_COLORS: Record<KNewsCategory, string> = {
  'K-컬처': 'bg-red-100 text-red-700 border-red-200',
  'K-푸드': 'bg-amber-100 text-amber-700 border-amber-200',
  'K-기술': 'bg-blue-100 text-blue-700 border-blue-200',
  'K-스포츠': 'bg-green-100 text-green-700 border-green-200',
  '글로벌 위상': 'bg-pink-100 text-pink-700 border-pink-200',
  '한국의 가치': 'bg-teal-100 text-teal-700 border-teal-200',
};

export const CATEGORY_LIST: KNewsCategory[] = [
  'K-컬처',
  'K-푸드',
  'K-기술',
  'K-스포츠',
  '글로벌 위상',
  '한국의 가치',
];

export const formatKNewsDate = (createdAt: KNews['createdAt']): string => {
  if (!createdAt) return '';
  const seconds = 'seconds' in createdAt ? createdAt.seconds : (createdAt as Timestamp).seconds;
  if (!seconds) return '';
  const date = new Date(seconds * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
