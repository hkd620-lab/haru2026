export interface KNews {
  id: string;
  title: string;
  subtitle: string;
  category: 'K-컬처' | 'K-푸드' | 'K-기술' | 'K-스포츠' | '글로벌 위상' | '한국의 가치';
  categoryColor: 'red' | 'blue' | 'green' | 'amber' | 'pink' | 'teal';
  tags: string[];
  createdAt: string;
  curator: string;
  imageUrl: string;
  sources: string[];
  balanceNote?: string;
}

export const K_NEWS_DATA: KNews[] = [];

export const CATEGORY_COLORS: Record<KNews['category'], string> = {
  'K-컬처': 'bg-red-100 text-red-700 border-red-200',
  'K-푸드': 'bg-amber-100 text-amber-700 border-amber-200',
  'K-기술': 'bg-blue-100 text-blue-700 border-blue-200',
  'K-스포츠': 'bg-green-100 text-green-700 border-green-200',
  '글로벌 위상': 'bg-pink-100 text-pink-700 border-pink-200',
  '한국의 가치': 'bg-teal-100 text-teal-700 border-teal-200',
};
