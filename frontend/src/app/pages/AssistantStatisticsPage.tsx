import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, type AssistantPeriodStats } from '../services/firestoreService';

type StatsPeriodMode = 'recentYear' | 'thisYear' | 'custom';

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
    return { start: formatDate(start), end, label: '최근 1년' };
  }
  if (mode === 'thisYear') {
    return { start: `${today.getFullYear()}-01-01`, end, label: '올해' };
  }
  return { start: customStartDate, end: customEndDate, label: '직접 선택' };
}

const TYPE_META: Record<'plant' | 'timeline', {
  label: string; emoji: string; color: string; bg: string; border: string;
}> = {
  plant: { label: '식물탐정', emoji: '🌿', color: '#2A5C3E', bg: '#F0FFF4', border: '#d0ffe0' },
  timeline: { label: '성장타임라인', emoji: '📌', color: '#1A3C6E', bg: '#EEF6FF', border: '#d0dff0' },
};

export function AssistantStatisticsPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const assistantType: 'plant' | 'timeline' = type === 'timeline' ? 'timeline' : 'plant';
  const meta = TYPE_META[assistantType];

  const today = new Date();
  const queryStart = searchParams.get('start');
  const queryEnd = searchParams.get('end');
  const hasQueryRange = Boolean(queryStart && queryEnd);
  const [periodMode, setPeriodMode] = useState<StatsPeriodMode>(hasQueryRange ? 'custom' : 'recentYear');
  const [customStartDate, setCustomStartDate] = useState(queryStart || `${today.getFullYear()}-01-01`);
  const [customEndDate, setCustomEndDate] = useState(queryEnd || formatDate(today));
  const [stats, setStats] = useState<AssistantPeriodStats | null>(null);
  const [loading, setLoading] = useState(false);

  const periodRange = getStatsPeriodRange(periodMode, customStartDate, customEndDate);

  useEffect(() => {
    if (!user?.uid) {
      setStats(null);
      return;
    }
    setLoading(true);
    firestoreService.getAssistantPeriodStats(user.uid, periodRange.start, periodRange.end)
      .then((data) => setStats(data))
      .catch((error) => {
        console.warn('비서 상세 통계 로딩 실패:', error);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [user?.uid, periodRange.start, periodRange.end]);

  const plant = stats?.plant;
  const timeline = stats?.timeline;
  const typeMonthCounts = assistantType === 'plant' ? (plant?.monthCounts || {}) : (timeline?.monthCounts || {});
  const months = Object.entries(typeMonthCounts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12);
  const maxMonth = Math.max(...months.map(([, c]) => c), 1);

  const hasData = assistantType === 'plant'
    ? Boolean(plant && plant.totalCount > 0)
    : Boolean(timeline && timeline.timelineCount > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      <PageHeaderActions />

      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/stats')}
          className="flex items-center gap-1 text-sm mb-3"
          style={{ color: '#666' }}
        >
          <ArrowLeft className="w-4 h-4" /> 통계로 돌아가기
        </button>
        <div className="flex items-center gap-3 mb-2">
          <span style={{ fontSize: 28 }}>{meta.emoji}</span>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: meta.color }}>
            {meta.label} 통계
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#666666' }}>
          선택한 기간의 {meta.label} 기록을 분석합니다
        </p>
      </div>

      {/* Period Filter */}
      <section className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5" style={{ color: meta.color }} />
          <h2 className="text-sm font-semibold" style={{ color: '#333' }}>기간 선택</h2>
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
                backgroundColor: periodMode === mode ? meta.color : '#FEFBE8',
                color: periodMode === mode ? '#FAF9F6' : '#333',
                border: periodMode === mode ? `1px solid ${meta.color}` : '1px solid #e5e5e5',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {periodMode === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label htmlFor="assistant-start-date" className="text-xs mb-1 block" style={{ color: '#666' }}>시작일</label>
              <input
                id="assistant-start-date"
                type="date"
                value={customStartDate}
                max={customEndDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              />
            </div>
            <div>
              <label htmlFor="assistant-end-date" className="text-xs mb-1 block" style={{ color: '#666' }}>종료일</label>
              <input
                id="assistant-end-date"
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

      {/* Detail */}
      <section className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4">
          {loading ? (
            <p className="text-sm" style={{ color: '#999' }}>통계를 불러오는 중...</p>
          ) : !hasData ? (
            <p className="text-sm" style={{ color: '#999' }}>선택한 기간에 {meta.label} 기록이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {/* 상세 카드 */}
              {assistantType === 'plant' && plant && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                    <p className="text-xs" style={{ color: '#999' }}>판독 식물</p>
                    <p className="text-xl font-bold mt-1" style={{ color: meta.color }}>{plant.detectiveCount}개</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                    <p className="text-xs" style={{ color: '#999' }}>식물 종류</p>
                    <p className="text-xl font-bold mt-1" style={{ color: meta.color }}>{plant.speciesCount}종</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                    <p className="text-xs" style={{ color: '#999' }}>관찰 기록</p>
                    <p className="text-xl font-bold mt-1" style={{ color: meta.color }}>{plant.observationCount}개</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                    <p className="text-xs" style={{ color: '#999' }}>가장 많이 본 식물</p>
                    <p className="text-sm font-bold mt-1 truncate" style={{ color: meta.color }}>
                      {plant.topPlant ? `${plant.topPlant.name} (${plant.topPlant.count})` : '-'}
                    </p>
                  </div>
                </div>
              )}

              {assistantType === 'timeline' && timeline && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                      <p className="text-xs" style={{ color: '#999' }}>타임라인 수</p>
                      <p className="text-xl font-bold mt-1" style={{ color: meta.color }}>{timeline.timelineCount}개</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                      <p className="text-xs" style={{ color: '#999' }}>총 연결 기록</p>
                      <p className="text-xl font-bold mt-1" style={{ color: meta.color }}>{timeline.linkedRecordCount}개</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                      <p className="text-xs" style={{ color: '#999' }}>평균 기록 수</p>
                      <p className="text-xl font-bold mt-1" style={{ color: meta.color }}>{timeline.avgRecords}개</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                      <p className="text-xs" style={{ color: '#999' }}>가장 오래 기록</p>
                      <p className="text-sm font-bold mt-1 truncate" style={{ color: meta.color }}>
                        {timeline.longestTimeline ? `${timeline.longestTimeline.title} (${timeline.longestTimeline.durationDays}일)` : '-'}
                      </p>
                    </div>
                  </div>
                  {timeline.subjectText && (
                    <div className="rounded-lg p-3" style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}>
                      <p className="text-xs" style={{ color: '#999' }}>주제별 타임라인</p>
                      <p className="text-sm font-bold mt-1" style={{ color: meta.color }}>{timeline.subjectText}</p>
                    </div>
                  )}
                </>
              )}

              {/* 월별 추이 (해당 비서만) */}
              {months.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#333' }}>월별 추이 (최근 12개월)</p>
                  <div className="flex flex-col gap-2">
                    {months.map(([month, count]) => (
                      <div key={month} className="flex items-center gap-2">
                        <span className="text-xs w-14" style={{ color: '#666' }}>{month}</span>
                        <div className="flex-1 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f4f6', height: 10 }}>
                          <div style={{ width: `${(count / maxMonth) * 100}%`, height: '100%', backgroundColor: meta.color }} />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right" style={{ color: meta.color }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
