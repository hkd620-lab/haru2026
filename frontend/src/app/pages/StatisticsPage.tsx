import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '텃밭일지' | '애완동물관찰일지' | '육아일기' | '메모';

interface FormatCategory {
  title: string;
  formats: RecordFormat[];
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const categories: FormatCategory[] = [
  {
    title: '생활',
    formats: ['일기', '에세이', '여행기록', '애완동물관찰일지', '육아일기', '텃밭일지'],
    icon: '🏡',
    color: '#1A3C6E',
    bgColor: '#FDF6C3',
    borderColor: '#d0dff0',
  },
  {
    title: '업무',
    formats: ['일반보고', '업무일지', '선교보고', '메모'],
    icon: '💼',
    color: '#2A5C3E',
    bgColor: '#F0FFF4',
    borderColor: '#d0ffe0',
  },
];

export function StatisticsPage() {
  const navigate = useNavigate();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleCategory = (title: string) => {
    setExpandedCategory(expandedCategory === title ? null : title);
  };

  const handleFormatClick = (format: RecordFormat) => {
  navigate(`/stats/${format}`);  // statistics → stats로 변경
};

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8" style={{ color: '#1A3C6E' }} />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1A3C6E' }}>
            통계
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#666666' }}>
          형식별 기록을 분석하고 나의 성향을 확인하세요
        </p>
      </div>

      {/* Info Box */}
      <div
        className="mb-6 p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: '#FFF8F0',
          borderColor: '#DAA520',
        }}
      >
        <p className="text-xs" style={{ color: '#B8860B' }}>
          💡 각 형식을 클릭하면 상세 통계를 확인할 수 있습니다
        </p>
        <p className="text-xs mt-1" style={{ color: '#999' }}>
          (현재는 개발자용 시뮬레이션 화면입니다)
        </p>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((category) => {
          const isExpanded = expandedCategory === category.title;

          return (
            <div
              key={category.title}
              className="bg-white rounded-lg shadow-sm overflow-hidden transition-all"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.title)}
                className="w-full p-4 flex items-center justify-between hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: category.bgColor,
                  borderBottom: isExpanded ? `1px solid ${category.borderColor}` : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 24 }}>{category.icon}</span>
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: category.color }}
                  >
                    {category.title}
                  </h2>
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: '#fff',
                      color: category.color,
                      border: `1px solid ${category.borderColor}`,
                    }}
                  >
                    {category.formats.length}개
                  </span>
                </div>
                <div
                  className="transition-transform"
                  style={{
                    color: category.color,
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>

              {/* Format List */}
              {isExpanded && (
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {category.formats.map((format) => (
                      <button
                        key={format}
                        onClick={() => handleFormatClick(format)}
                        className="p-3 rounded-lg text-left transition-all hover:shadow-md"
                        style={{
                          backgroundColor: '#FEFBE8',
                          border: `1px solid ${category.borderColor}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="text-sm font-medium"
                            style={{ color: category.color }}
                          >
                            📊 {format}
                          </span>
                          <ChevronRight
                            className="w-4 h-4"
                            style={{ color: '#999' }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Developer Note */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">
          🔧 <strong>개발자 노트:</strong>
        </p>
        <ul className="text-xs text-gray-500 mt-2 space-y-1 ml-4">
          <li>• 각 형식을 클릭하면 형식별 통계 페이지로 이동합니다</li>
          <li>• 통계는 SAYU 생성 시 자동으로 수집됩니다</li>
          <li>• 현재는 시뮬레이션 데이터를 표시합니다</li>
        </ul>
      </div>
    </div>
  );
}
