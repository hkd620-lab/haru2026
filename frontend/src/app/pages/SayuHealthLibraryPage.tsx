import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import {
  INFOGRAPHICS,
  CATEGORY_COLOR_CLASSES,
  type Infographic,
} from '../data/infographicsData';

const ALL_CATEGORY = '전체';

export function SayuHealthLibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY);
  const [selectedInfographic, setSelectedInfographic] = useState<Infographic | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    INFOGRAPHICS.forEach((i) => set.add(i.category));
    return [ALL_CATEGORY, ...Array.from(set)];
  }, []);

  const filtered = useMemo(() => {
    if (selectedCategory === ALL_CATEGORY) return INFOGRAPHICS;
    return INFOGRAPHICS.filter((i) => i.category === selectedCategory);
  }, [selectedCategory]);

  const closeToOrigin = () => {
    if (fromPath) {
      navigate(fromPath);
      return;
    }
    const origin = getOrigin();
    if (origin) {
      navigate(origin);
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate('/sayu-health');
  };

  const formatDate = (iso: string) => iso.replace(/-/g, '.');

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-2 flex items-center gap-2">
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: '#1A3C6E',
            color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          BETA
        </span>
        <span style={{ fontSize: 11, color: '#888780', letterSpacing: '0.04em' }}>
          SAYU · CARE · LIBRARY
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          📚 건강 정보 라이브러리
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          HARU2026이 매일 큐레이션하는 시니어 친화 건강 인포그래픽입니다.
          진료를 대체하지 않으며, 최종 판단은 의료진과 상의하세요.
        </p>
        <div className="text-xs mt-2" style={{ color: '#4A5A2C' }}>
          📊 총 {INFOGRAPHICS.length}개 콘텐츠 · 매일 추가 예정
        </div>
      </div>

      {categories.length > 2 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat) => {
            const active = cat === selectedCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: active ? '#1A3C6E' : '#fff',
                  color: active ? '#fff' : '#4A5A2C',
                  border: active ? '1px solid #1A3C6E' : '1px solid #D4DEA0',
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((info) => {
          const colorClass =
            CATEGORY_COLOR_CLASSES[info.categoryColor] ||
            'bg-gray-50 text-gray-800 border-gray-200';
          return (
            <button
              key={info.id}
              type="button"
              onClick={() => setSelectedInfographic(info)}
              className="block w-full text-left rounded-2xl p-4 md:p-5 transition-all hover:shadow-md active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, #E0E8B8 0%, #ffffff 70%)',
                border: '1px solid #D4DEA0',
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}
                >
                  {info.category}
                </span>
                {info.emergencyFlag && (
                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                    ⚠️ 응급 주의
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#2C2C2A',
                  letterSpacing: '-0.01em',
                  marginBottom: 4,
                }}
              >
                {info.title}
              </div>
              <div style={{ fontSize: 13, color: '#4A5A2C', marginBottom: 10 }}>
                {info.subtitle}
              </div>

              <div className="flex items-center justify-between">
                <div style={{ fontSize: 11, color: '#888780' }}>
                  {formatDate(info.createdAt)} · {info.curator} 큐레이션
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: '#1A3C6E',
                    fontWeight: 600,
                  }}
                >
                  자세히 보기 →
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="mt-8 rounded-xl p-4"
        style={{
          backgroundColor: '#F5F0E8',
          border: '1px solid #E5DFD0',
          fontSize: 11,
          color: '#7A6F5A',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#4A5A2C' }}>
          ℹ️ 안내
        </div>
        매일 2개씩 새 인포그래픽이 추가됩니다.
        본 정보는 일반적인 건강 정보이며 진료를 대체할 수 없습니다.
        증상이 있으시면 반드시 의료진과 상의하세요.
      </div>

      {selectedInfographic && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
          onClick={() => setSelectedInfographic(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full my-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center rounded-t-lg z-10">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium border ${
                      CATEGORY_COLOR_CLASSES[selectedInfographic.categoryColor] ||
                      'bg-gray-50 text-gray-800 border-gray-200'
                    }`}
                  >
                    {selectedInfographic.category}
                  </span>
                  {selectedInfographic.emergencyFlag && (
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                      ⚠️ 응급 주의
                    </span>
                  )}
                </div>
                <h3
                  className="font-bold truncate"
                  style={{ color: '#1A3C6E', fontSize: 16 }}
                >
                  {selectedInfographic.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInfographic(null)}
                aria-label="닫기"
                className="text-2xl leading-none w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 flex-shrink-0"
                style={{ color: '#666' }}
              >
                ×
              </button>
            </div>

            <img
              src={selectedInfographic.imageUrl}
              alt={selectedInfographic.title}
              className="w-full h-auto block"
            />

            {selectedInfographic.warnings && selectedInfographic.warnings.length > 0 && (
              <div className="p-4 border-t bg-red-50">
                <div className="font-semibold text-sm text-red-800 mb-2">
                  ⚠️ 꼭 알아두세요
                </div>
                <ul className="space-y-1">
                  {selectedInfographic.warnings.map((w, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-red-900"
                      style={{ lineHeight: 1.6 }}
                    >
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-4 border-t" style={{ fontSize: 11, color: '#7A6F5A' }}>
              <div className="mb-2">
                <span style={{ fontWeight: 600, color: '#4A5A2C' }}>출처:</span>{' '}
                {selectedInfographic.sources.join(' · ')}
              </div>
              <div style={{ color: '#888780' }}>
                {formatDate(selectedInfographic.createdAt)} ·{' '}
                {selectedInfographic.curator} 큐레이션
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SayuHealthLibraryPage;
