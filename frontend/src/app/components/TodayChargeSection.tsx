import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';

interface TodayChargeItem {
  id: string;
  imageUrl: string;
  title: string;
  caption?: string;
  status: 'published';
  createdAt?: Timestamp | { seconds: number };
  curator?: string;
}

const formatTodayChargeDate = (createdAt: TodayChargeItem['createdAt']): string => {
  if (!createdAt) return '';
  const seconds = 'seconds' in createdAt ? createdAt.seconds : (createdAt as Timestamp).seconds;
  if (!seconds) return '';
  const date = new Date(seconds * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const fetchTodayCharge = async (): Promise<TodayChargeItem[]> => {
  const q = query(
    collection(db, 'today_charge'),
    where('status', '==', 'published'),
    orderBy('createdAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TodayChargeItem[];
};

const TodayChargeCard: React.FC<{ item: TodayChargeItem }> = ({ item }) => (
  <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
    <div className="bg-gray-50">
      <img
        src={item.imageUrl}
        alt={item.title}
        className="w-full h-auto"
        loading="lazy"
      />
    </div>
    <div className="p-4">
      <h3 className="font-bold text-base mb-1" style={{ color: '#1A3C6E' }}>
        {item.title}
      </h3>
      {item.caption && (
        <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">
          {item.caption}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-2">
        <span>{formatTodayChargeDate(item.createdAt)}</span>
        <span>· {item.curator || 'HARU2026'}</span>
      </div>
    </div>
  </article>
);

export const TodayChargeSection: React.FC = () => {
  const [items, setItems] = useState<TodayChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayCharge()
      .then(setItems)
      .catch((e) => {
        console.error('오늘충전 로딩 실패', e);
        setError(e?.message || '불러오기에 실패했습니다.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        오늘 마음을 다시 채우는 HARU의 짧은 충전 카드입니다.
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <div
            className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: '#1A3C6E', borderTopColor: 'transparent' }}
          />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-sm text-red-700">
          {error}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto items-start">
          {items.map((item) => (
            <TodayChargeCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
          <h3 className="font-bold text-base mb-1" style={{ color: '#1A3C6E' }}>
            오늘충전 준비 중
          </h3>
          <p className="text-sm text-gray-600">
            곧 새로운 충전 카드를 만나보세요
          </p>
        </div>
      )}
    </div>
  );
};
