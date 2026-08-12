import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const PAGE_SIZE = 10;

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

const TodayChargeThumbnail: React.FC<{
  item: TodayChargeItem;
  onSelect: (item: TodayChargeItem) => void;
}> = ({ item, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(item)}
    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A3C6E]"
  >
    <div className="aspect-[4/5] bg-gray-50 flex items-center justify-center overflow-hidden">
      <img
        src={item.imageUrl}
        alt={item.title}
        className="w-full h-full object-contain"
        loading="lazy"
      />
    </div>
    <div className="p-3">
      <h3 className="font-bold text-sm line-clamp-2 min-h-[2.5rem]" style={{ color: '#1A3C6E' }}>
        {item.title}
      </h3>
      <p className="text-xs text-gray-500 mt-2">
        {formatTodayChargeDate(item.createdAt)}
      </p>
    </div>
  </button>
);

const TodayChargeModal: React.FC<{
  item: TodayChargeItem;
  onClose: () => void;
}> = ({ item, onClose }) => (
  <div
    className="fixed inset-0 z-[9999] bg-black/80 flex flex-col px-4 py-5 sm:px-6"
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <button
      type="button"
      onClick={onClose}
      className="absolute right-3 top-3 min-w-[44px] min-h-[44px] rounded-full bg-white/95 text-gray-900 text-2xl leading-none flex items-center justify-center shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
      aria-label="닫기"
    >
      ×
    </button>
    <div
      className="w-full h-full max-w-6xl mx-auto flex flex-col items-center justify-center gap-3 pt-12"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full flex-1 min-h-0 overflow-auto flex items-center justify-center">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      <div className="w-full max-w-3xl shrink-0 rounded-2xl bg-white/95 p-4 text-left shadow-lg">
        <h3 className="font-bold text-base mb-2" style={{ color: '#1A3C6E' }}>
          {item.title}
        </h3>
        {item.caption && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
            {item.caption}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>{formatTodayChargeDate(item.createdAt)}</span>
          <span>· {item.curator || 'haru2026'}</span>
        </div>
      </div>
    </div>
  </div>
);

export const TodayChargeSection: React.FC = () => {
  const [items, setItems] = useState<TodayChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<TodayChargeItem | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, currentPage]);

  useEffect(() => {
    fetchTodayCharge()
      .then(setItems)
      .catch((e) => {
        console.error('오늘충전 로딩 실패', e);
        setError(e?.message || '불러오기에 실패했습니다.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  useEffect(() => {
    if (!selectedItem) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedItem(null);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItem]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        오늘 마음을 다시 채우는 haru2026의 짧은 충전 카드입니다.
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
        <div ref={galleryRef}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {pageItems.map((item) => (
              <TodayChargeThumbnail
                key={item.id}
                item={item}
                onSelect={setSelectedItem}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-5">
              {Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1;
                const isActive = page === currentPage;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => handlePageChange(page)}
                    className={`min-w-[44px] min-h-[44px] rounded-full text-sm font-bold transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    style={isActive ? { backgroundColor: '#1A3C6E' } : undefined}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
          )}
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

      {selectedItem && (
        <TodayChargeModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};
