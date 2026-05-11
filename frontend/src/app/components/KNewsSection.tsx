import React from 'react';
import { K_NEWS_DATA, CATEGORY_COLORS } from '../data/kNewsData';

export const KNewsSection: React.FC = () => {
  const hasNews = K_NEWS_DATA.length > 0;

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">
        매일 새로워지는 우리나라 자긍심
      </p>

      {hasNews ? (
        <div className="grid grid-cols-1 gap-4">
          {K_NEWS_DATA.map((news) => (
            <div
              key={news.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
                <img
                  src={news.imageUrl}
                  alt={news.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-4">
                <div className="flex gap-2 mb-2 flex-wrap">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${CATEGORY_COLORS[news.category]}`}>
                    {news.category}
                  </span>
                </div>
                <h3 className="font-bold text-base mb-1" style={{ color: '#1A3C6E' }}>
                  {news.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {news.subtitle}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-2">
                  <span>{news.createdAt}</span>
                  <span>· {news.curator}</span>
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
