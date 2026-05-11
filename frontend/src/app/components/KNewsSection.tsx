import React, { useEffect, useState } from 'react';
import { KNews, fetchKNews, CATEGORY_COLORS, formatKNewsDate } from '../data/kNewsData';

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
        매일 새로워지는 우리나라 자긍심
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {news.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="bg-gray-50 overflow-hidden flex items-center justify-center" style={{ maxHeight: 420 }}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: 420 }}
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <div className="flex gap-2 mb-2 flex-wrap">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${CATEGORY_COLORS[item.category]}`}>
                    {item.category}
                  </span>
                  {item.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                      #{tag}
                    </span>
                  ))}
                </div>
                <h3 className="font-bold text-base mb-1" style={{ color: '#1A3C6E' }}>
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {item.subtitle}
                </p>
                {item.sources && item.sources.length > 0 && (
                  <p className="text-[11px] text-gray-500 mb-2">
                    출처: {item.sources.join(', ')}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-2">
                  <span>{formatKNewsDate(item.createdAt)}</span>
                  <span>· {item.curator}</span>
                </div>
              </div>
            </div>
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
