import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../../firebase';
import {
  getTodayDateKey,
  publishTodayChargeContent,
  type TodayChargeContentType,
} from '../services/todayChargePublishService';

interface TodayChargeItem {
  id: string;
  imageUrl: string;
  title: string;
  caption?: string;
  status: 'published';
  type?: TodayChargeContentType;
  publishDate?: string;
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

const getDisplayDate = (item: TodayChargeItem): string => (
  item.publishDate || formatTodayChargeDate(item.createdAt)
);

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
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
    <div className="p-3">
      <h3 className="font-bold text-sm line-clamp-2 min-h-[2.5rem]" style={{ color: '#1A3C6E' }}>
        {item.title}
      </h3>
      <p className="text-xs text-gray-500 mt-2">
        {getDisplayDate(item)}
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
          <span>{getDisplayDate(item)}</span>
          <span>· {item.curator || 'haru2026'}</span>
        </div>
      </div>
    </div>
  </div>
);

const SectionHeader: React.FC<{
  title: string;
  description: string;
  isDeveloper?: boolean;
  onAdd: () => void;
}> = ({ title, description, isDeveloper, onAdd }) => (
  <div className="mb-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-bold" style={{ color: '#1A3C6E' }}>
        {title}
      </h2>
      {isDeveloper && (
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          + 새 이미지 추가
        </button>
      )}
    </div>
    <p className="text-sm text-gray-600 mt-1">
      {description}
    </p>
  </div>
);

const QuickImageAddModal: React.FC<{
  contentType: TodayChargeContentType;
  titleLabel: string;
  onClose: () => void;
  onPublished: () => Promise<void>;
}> = ({ contentType, titleLabel, onClose, onPublished }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [publishDate, setPublishDate] = useState(getTodayDateKey());
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview, onClose]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handlePublish = async () => {
    if (!imageFile) {
      toast.error('이미지를 먼저 선택해주세요.');
      return;
    }
    if (!title.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }
    if (!publishDate) {
      toast.error('게시 날짜를 선택해주세요.');
      return;
    }

    setPublishing(true);
    try {
      await publishTodayChargeContent({
        imageFile,
        title: title.trim(),
        caption: caption.trim(),
        type: contentType,
        publishDate,
      });
      await onPublished();
      toast.success(`${titleLabel} 등록 완료`);
      onClose();
    } catch (error: any) {
      console.error(`${titleLabel} 등록 실패`, error);
      toast.error(`등록 실패: ${error?.message || '알 수 없는 오류'}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 px-4 py-5 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-base" style={{ color: '#1A3C6E' }}>
            {titleLabel} 새 이미지 추가
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-full text-2xl leading-none text-gray-700 hover:bg-gray-50"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">이미지 선택</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              disabled={publishing}
              className="block w-full text-sm text-gray-600
                file:mr-3 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            {imagePreview && (
              <div className="mt-3 aspect-[4/5] rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img src={imagePreview} alt="미리보기" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">보조 문구</label>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">게시 날짜</label>
            <input
              type="date"
              value={publishDate}
              onChange={(event) => setPublishDate(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              style={{ fontSize: 16 }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || !imageFile || !title.trim()}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#1A3C6E' }}
            >
              {publishing ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TodayChargeSection: React.FC<{ isDeveloper?: boolean }> = ({ isDeveloper }) => {
  const [items, setItems] = useState<TodayChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<TodayChargeItem | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  const chargeItems = useMemo(
    () => items.filter((item) => item.type !== 'ramen'),
    [items],
  );

  const totalPages = Math.ceil(chargeItems.length / PAGE_SIZE);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return chargeItems.slice(start, start + PAGE_SIZE);
  }, [chargeItems, currentPage]);

  const loadItems = async () => {
    setError(null);
    const nextItems = await fetchTodayCharge();
    setItems(nextItems);
  };

  useEffect(() => {
    loadItems()
      .catch((e) => {
        console.error('오늘충전 로딩 실패', e);
        setError(e?.message || '불러오기에 실패했습니다.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [chargeItems.length]);

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
      <SectionHeader
        title="오늘의 충전"
        description="오늘 마음을 다시 채우는 haru2026의 짧은 충전 카드입니다."
        isDeveloper={isDeveloper}
        onAdd={() => setQuickAddOpen(true)}
      />

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
      ) : chargeItems.length > 0 ? (
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
            오늘의 충전 준비 중
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

      {quickAddOpen && (
        <QuickImageAddModal
          contentType="charge"
          titleLabel="오늘의 충전"
          onClose={() => setQuickAddOpen(false)}
          onPublished={loadItems}
        />
      )}
    </div>
  );
};

export const HaruRamenSection: React.FC<{ isDeveloper?: boolean }> = ({ isDeveloper }) => {
  const [items, setItems] = useState<TodayChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<TodayChargeItem | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const ramenItems = useMemo(
    () => items.filter((item) => item.type === 'ramen'),
    [items],
  );

  const loadItems = async () => {
    setError(null);
    const nextItems = await fetchTodayCharge();
    setItems(nextItems);
  };

  useEffect(() => {
    loadItems()
      .catch((e) => {
        console.error('하루라면 로딩 실패', e);
        setError(e?.message || '불러오기에 실패했습니다.');
      })
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div>
      <SectionHeader
        title="🍜 하루라면"
        description="오늘 한 끼, 조금 더 맛있게"
        isDeveloper={isDeveloper}
        onAdd={() => setQuickAddOpen(true)}
      />

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
      ) : ramenItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {ramenItems.map((item) => (
            <TodayChargeThumbnail
              key={item.id}
              item={item}
              onSelect={setSelectedItem}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
          <h3 className="font-bold text-base mb-1" style={{ color: '#1A3C6E' }}>
            하루라면 준비 중
          </h3>
          <p className="text-sm text-gray-600">
            곧 새로운 라면 카드를 만나보세요
          </p>
        </div>
      )}

      {selectedItem && (
        <TodayChargeModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {quickAddOpen && (
        <QuickImageAddModal
          contentType="ramen"
          titleLabel="하루라면"
          onClose={() => setQuickAddOpen(false)}
          onPublished={loadItems}
        />
      )}
    </div>
  );
};
