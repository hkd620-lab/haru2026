import React, { useEffect, useState } from 'react';
import { KNews, fetchKNews, CATEGORY_COLORS, formatKNewsDate } from '../data/kNewsData';

const BASE_MAX_HEIGHT = 420;
const ZOOM_STEP = 1.5;
const MAX_ZOOM = 5;

const KNewsCard: React.FC<{ news: KNews }> = ({ news }) => {
  const [zoom, setZoom] = useState(1);

  const handleImageClick = () => {
    setZoom((prev) => (prev >= MAX_ZOOM ? 1 : Number((prev * ZOOM_STEP).toFixed(2))));
  };

  const maxH = BASE_MAX_HEIGHT * zoom;
  const isMaxed = zoom >= MAX_ZOOM;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div
        className="bg-gray-50 overflow-auto flex items-start justify-start"
        style={{ maxHeight: maxH, transition: 'max-height 240ms ease-out' }}
      >
        <img
          src={news.imageUrl}
          alt={news.title}
          onClick={handleImageClick}
          className="select-none"
          style={{
            width: `${100 * zoom}%`,
            maxWidth: 'none',
            height: 'auto',
            cursor: isMaxed ? 'zoom-out' : 'zoom-in',
            transition: 'width 240ms ease-out',
          }}
          loading="lazy"
          title={isMaxed ? '클릭하면 원래 크기로 돌아갑니다' : '클릭하면 50% 확대됩니다'}
        />
      </div>
      <div className="p-4">
        <div className="flex gap-2 mb-2 flex-wrap items-center">
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${CATEGORY_COLORS[news.category]}`}>
            {news.category}
          </span>
          {news.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-600 border border-gray-200">
              #{tag}
            </span>
          ))}
          {zoom > 1 && (
            <span className="ml-auto inline-block px-2 py-1 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              🔍 ×{zoom.toFixed(2)}
            </span>
          )}
        </div>
        <h3 className="font-bold text-base mb-1" style={{ color: '#1A3C6E' }}>
          {news.title}
        </h3>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {news.subtitle}
        </p>
        {news.sources && news.sources.length > 0 && (
          <p className="text-[11px] text-gray-500 mb-2">
            출처: {news.sources.join(', ')}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-2">
          <span>{formatKNewsDate(news.createdAt)}</span>
          <span>· {news.curator === '허 교장님' || !news.curator ? 'HARU2026' : news.curator}</span>
        </div>
      </div>
    </div>
  );
};

export const KNewsSection: React.FC = () => {
  const [news, setNews] = useState<KNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKNews()
      .then(setNews)
      .catch((e) => {
        console.error('K뉴스 로딩 실패', e);
        setError(e?.message || '불러오기에 실패했습니다.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        매일 새로워지는 우리나라 자긍심 <span className="text-gray-400">· 이미지 클릭으로 +50% 확대</span>
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
      ) : news.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto items-start">
          {news.map((item) => (
            <KNewsCard key={item.id} news={item} />
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">🚧</div>
          <h3 className="font-bold text-base mb-1" style={{ color: '#1A3C6E' }}>
            첫 카드뉴스 준비 중
          </h3>
          <p className="text-sm text-gray-600">
            곧 새로운 K-뉴스를 만나보세요
          </p>
        </div>
      )}
    </div>
  );
};
