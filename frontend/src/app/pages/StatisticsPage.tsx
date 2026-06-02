import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, type LibraryEntry } from '../services/firestoreService';

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
  const { user } = useAuth();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [assistantLibrary, setAssistantLibrary] = useState<LibraryEntry[]>([]);
  const [assistantStatsLoading, setAssistantStatsLoading] = useState(false);

  const toggleCategory = (title: string) => {
    setExpandedCategory(expandedCategory === title ? null : title);
  };

  const handleFormatClick = (format: RecordFormat) => {
  navigate(`/stats/${format}`);  // statistics → stats로 변경
};

  useEffect(() => {
    if (!user?.uid) {
      setAssistantLibrary([]);
      return;
    }

    setAssistantStatsLoading(true);
    firestoreService.getLibraryByCategory(user.uid, '비서')
      .then(setAssistantLibrary)
      .catch((error) => {
        console.warn('비서 library 통계 로딩 실패:', error);
        setAssistantLibrary([]);
      })
      .finally(() => setAssistantStatsLoading(false));
  }, [user?.uid]);

  const assistantTypeCounts = assistantLibrary.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {});
  const assistantMonthCounts = assistantLibrary.reduce<Record<string, number>>((acc, entry) => {
    const month = (entry.date || '').slice(0, 7);
    if (month) acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  const assistantMonths = Object.entries(assistantMonthCounts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);
  const maxAssistantMonthCount = Math.max(...assistantMonths.map(([, count]) => count), 1);
  const typeLabel: Record<string, string> = {
    book: '책',
    timeline: '타임라인',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      <PageHeaderActions />
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

      {/* Assistant Library Pilot Stats */}
      <section className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: '#e5e5e5' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#1A3C6E' }}>
                비서 통계
              </h2>
              <p className="text-xs mt-1" style={{ color: '#999' }}>
                책과 타임라인 library 인덱스 기준
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}>
              파일럿
            </span>
          </div>
        </div>

        <div className="p-4">
          {assistantStatsLoading ? (
            <p className="text-sm" style={{ color: '#999' }}>비서 통계를 불러오는 중...</p>
          ) : assistantLibrary.length === 0 ? (
            <p className="text-sm" style={{ color: '#999' }}>
              아직 인덱싱된 비서 기록이 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(assistantTypeCounts).map(([type, count]) => (
                  <div key={type} className="rounded-lg p-3" style={{ backgroundColor: '#FEFBE8', border: '1px solid #e5e5e5' }}>
                    <p className="text-xs" style={{ color: '#999' }}>{typeLabel[type] || type}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#1A3C6E' }}>{count}개</p>
                  </div>
                ))}
              </div>

              {assistantMonths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#333' }}>월별 추이</p>
                  <div className="flex flex-col gap-2">
                    {assistantMonths.map(([month, count]) => (
                      <div key={month} className="flex items-center gap-2">
                        <span className="text-xs w-14" style={{ color: '#666' }}>{month}</span>
                        <div className="flex-1 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f4f6', height: 10 }}>
                          <div
                            style={{
                              width: `${(count / maxAssistantMonthCount) * 100}%`,
                              height: '100%',
                              backgroundColor: '#1A3C6E',
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right" style={{ color: '#1A3C6E' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

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
