import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Calendar, ChevronRight } from 'lucide-react';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, type AssistantPeriodStats } from '../services/firestoreService';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '텃밭일지' | '애완동물관찰일지' | '육아일기' | '메모' | 'HARU보조장부';

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
    formats: ['일반보고', '업무일지', '선교보고', '메모', 'HARU보조장부'],
    icon: '💼',
    color: '#2A5C3E',
    bgColor: '#F0FFF4',
    borderColor: '#d0ffe0',
  },
];

type StatsPeriodMode = 'recentYear' | 'thisYear' | 'custom';

interface StatsSummary {
  totalRecords: number;
  polishedCount: number;
  sayuCount: number;
  formatCounts: Record<string, number>;
  formatSayuCounts: Record<string, number>;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStatsPeriodRange(mode: StatsPeriodMode, customStartDate: string, customEndDate: string) {
  const today = new Date();
  const end = formatDate(today);

  if (mode === 'recentYear') {
    const start = new Date(today);
    start.setFullYear(start.getFullYear() - 1);
    return {
      start: formatDate(start),
      end,
      label: '최근 1년',
    };
  }

  if (mode === 'thisYear') {
    return {
      start: `${today.getFullYear()}-01-01`,
      end,
      label: '올해',
    };
  }

  return {
    start: customStartDate,
    end: customEndDate,
    label: '직접 선택',
  };
}

export function StatisticsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [assistantStats, setAssistantStats] = useState<AssistantPeriodStats | null>(null);
  const [assistantStatsLoading, setAssistantStatsLoading] = useState(false);
  const today = new Date();
  const [periodMode, setPeriodMode] = useState<StatsPeriodMode>('recentYear');
  const [customStartDate, setCustomStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [customEndDate, setCustomEndDate] = useState(formatDate(today));
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const periodRange = getStatsPeriodRange(periodMode, customStartDate, customEndDate);

  const toggleCategory = (title: string) => {
    setExpandedCategory(expandedCategory === title ? null : title);
  };

  const handleFormatClick = (format: RecordFormat) => {
    const params = new URLSearchParams({
      start: periodRange.start,
      end: periodRange.end,
    });
    navigate(`/stats/${format}?${params.toString()}`);  // statistics → stats로 변경
  };

  const handleAssistantClick = (assistantType: 'plant' | 'timeline') => {
    const params = new URLSearchParams({
      start: periodRange.start,
      end: periodRange.end,
    });
    navigate(`/stats/assistant/${assistantType}?${params.toString()}`);
  };

  useEffect(() => {
    if (!user?.uid) {
      setStats(null);
      return;
    }

    setStatsLoading(true);
    firestoreService.getStats(user.uid, periodRange.start, periodRange.end)
      .then((data) => setStats(data))
      .catch((error) => {
        console.warn('기록 통계 로딩 실패:', error);
        setStats(null);
      })
      .finally(() => setStatsLoading(false));
  }, [user?.uid, periodRange.start, periodRange.end]);

  useEffect(() => {
    if (!user?.uid) {
      setAssistantStats(null);
      return;
    }

    setAssistantStatsLoading(true);
    firestoreService.getAssistantPeriodStats(user.uid, periodRange.start, periodRange.end)
      .then((data) => setAssistantStats(data))
      .catch((error) => {
        console.warn('비서 원본 기록 통계 로딩 실패:', error);
        setAssistantStats(null);
      })
      .finally(() => setAssistantStatsLoading(false));
  }, [user?.uid, periodRange.start, periodRange.end]);

  const assistantTypeCounts = assistantStats?.typeCounts || {};
  const assistantMonthCounts = assistantStats?.monthCounts || {};
  const assistantMonths = Object.entries(assistantMonthCounts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);
  const maxAssistantMonthCount = Math.max(...assistantMonths.map(([, count]) => count), 1);
  const typeLabel: Record<string, string> = {
    timeline: '타임라인',
    plant: '식물탐정',
  };
  const assistantTotalCount = Object.values(assistantTypeCounts).reduce((sum, count) => sum + count, 0);
  const plantStats = assistantStats?.plant;
  const timelineStats = assistantStats?.timeline;

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

      {/* Period Filter */}
      <section className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5" style={{ color: '#1A3C6E' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#333' }}>
            기간 선택
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { mode: 'recentYear' as const, label: '최근 1년' },
            { mode: 'thisYear' as const, label: '올해' },
            { mode: 'custom' as const, label: '직접 선택' },
          ].map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setPeriodMode(mode)}
              className="px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: periodMode === mode ? '#1A3C6E' : '#FEFBE8',
                color: periodMode === mode ? '#FAF9F6' : '#333',
                border: periodMode === mode ? '1px solid #1A3C6E' : '1px solid #e5e5e5',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {periodMode === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label htmlFor="stats-custom-start-date" className="text-xs mb-1 block" style={{ color: '#666' }}>시작일</label>
              <input
                id="stats-custom-start-date"
                type="date"
                value={customStartDate}
                max={customEndDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              />
            </div>
            <div>
              <label htmlFor="stats-custom-end-date" className="text-xs mb-1 block" style={{ color: '#666' }}>종료일</label>
              <input
                id="stats-custom-end-date"
                type="date"
                value={customEndDate}
                min={customStartDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              />
            </div>
          </div>
        )}

        <p className="text-xs" style={{ color: '#666' }}>
          {periodRange.label}: {periodRange.start} ~ {periodRange.end}
        </p>
      </section>

      {/* Record Summary */}
      <section className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: '#e5e5e5' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#1A3C6E' }}>
            기록 통계
          </h2>
          <p className="text-xs mt-1" style={{ color: '#999' }}>
            users/{'{uid}'}/records/{'{date}'} 기준
          </p>
        </div>
        <div className="p-4">
          {statsLoading ? (
            <p className="text-sm" style={{ color: '#999' }}>기록 통계를 불러오는 중...</p>
          ) : !stats ? (
            <p className="text-sm" style={{ color: '#999' }}>기록 통계를 불러오지 못했습니다.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '총 기록', value: `${stats.totalRecords}개` },
                { label: '다듬기 완료', value: `${stats.polishedCount}개` },
                { label: 'SAYU 완료', value: `${stats.sayuCount}개` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg p-3 text-center" style={{ backgroundColor: '#FEFBE8', border: '1px solid #e5e5e5' }}>
                  <p className="text-xs" style={{ color: '#999' }}>{label}</p>
                  <p className="text-xl font-bold mt-1" style={{ color: '#1A3C6E' }}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Assistant Library Pilot Stats */}
      <section className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: '#e5e5e5' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#1A3C6E' }}>
                비서 통계
              </h2>
              <p className="text-xs mt-1" style={{ color: '#999' }}>
                원본 기록 날짜 기준
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
          ) : assistantTotalCount === 0 ? (
            <p className="text-sm" style={{ color: '#999' }}>
              선택한 기간에 타임라인 또는 식물탐정 기록이 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(assistantTypeCounts).filter(([, count]) => count > 0).map(([type, count]) => (
                  <div key={type} className="rounded-lg p-3" style={{ backgroundColor: '#FEFBE8', border: '1px solid #e5e5e5' }}>
                    <p className="text-xs" style={{ color: '#999' }}>{typeLabel[type] || type}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#1A3C6E' }}>{count}개</p>
                  </div>
                ))}
              </div>

              {plantStats && plantStats.totalCount > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => handleAssistantClick('plant')}
                    className="flex items-center gap-1 mb-2"
                  >
                    <span className="text-xs font-semibold" style={{ color: '#333' }}>🌿 식물탐정 상세</span>
                    <span className="text-xs" style={{ color: '#2A5C3E' }}>상세 보기</span>
                    <ChevronRight className="w-4 h-4" style={{ color: '#2A5C3E' }} />
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#F0FFF4', border: '1px solid #d0ffe0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>판독 식물</p>
                      <p className="text-xl font-bold mt-1" style={{ color: '#2A5C3E' }}>{plantStats.detectiveCount}개</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#F0FFF4', border: '1px solid #d0ffe0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>식물 종류</p>
                      <p className="text-xl font-bold mt-1" style={{ color: '#2A5C3E' }}>{plantStats.speciesCount}종</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#F0FFF4', border: '1px solid #d0ffe0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>관찰 기록</p>
                      <p className="text-xl font-bold mt-1" style={{ color: '#2A5C3E' }}>{plantStats.observationCount}개</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#F0FFF4', border: '1px solid #d0ffe0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>가장 많이 본 식물</p>
                      <p className="text-sm font-bold mt-1 truncate" style={{ color: '#2A5C3E' }}>
                        {plantStats.topPlant ? `${plantStats.topPlant.name} (${plantStats.topPlant.count})` : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {timelineStats && timelineStats.timelineCount > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => handleAssistantClick('timeline')}
                    className="flex items-center gap-1 mb-2"
                  >
                    <span className="text-xs font-semibold" style={{ color: '#333' }}>📌 성장타임라인 상세</span>
                    <span className="text-xs" style={{ color: '#1A3C6E' }}>상세 보기</span>
                    <ChevronRight className="w-4 h-4" style={{ color: '#1A3C6E' }} />
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#EEF6FF', border: '1px solid #d0dff0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>타임라인 수</p>
                      <p className="text-xl font-bold mt-1" style={{ color: '#1A3C6E' }}>{timelineStats.timelineCount}개</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#EEF6FF', border: '1px solid #d0dff0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>총 연결 기록</p>
                      <p className="text-xl font-bold mt-1" style={{ color: '#1A3C6E' }}>{timelineStats.linkedRecordCount}개</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#EEF6FF', border: '1px solid #d0dff0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>평균 기록 수</p>
                      <p className="text-xl font-bold mt-1" style={{ color: '#1A3C6E' }}>{timelineStats.avgRecords}개</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#EEF6FF', border: '1px solid #d0dff0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>가장 오래 기록</p>
                      <p className="text-sm font-bold mt-1 truncate" style={{ color: '#1A3C6E' }}>
                        {timelineStats.longestTimeline ? `${timelineStats.longestTimeline.title} (${timelineStats.longestTimeline.durationDays}일)` : '-'}
                      </p>
                    </div>
                  </div>
                  {timelineStats.subjectText && (
                    <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: '#EEF6FF', border: '1px solid #d0dff0' }}>
                      <p className="text-xs" style={{ color: '#999' }}>주제별 타임라인</p>
                      <p className="text-sm font-bold mt-1" style={{ color: '#1A3C6E' }}>{timelineStats.subjectText}</p>
                    </div>
                  )}
                </div>
              )}

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
