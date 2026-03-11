import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Brain, Sparkles, Activity, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '텃밭일지' | '애완동물관찰일지' | '육아일기';

// 형식별 시뮬레이션 데이터
const SIMULATION_DATA: Record<RecordFormat, any> = {
  '일기': {
    total_days: 300,
    positivity_ratio: 0.64,
    learning_ratio: 0.82,
    space_ratio: 0.70,
    conflict_with_learning_ratio: 0.83,
    energy_average: 3.3,
    action_distribution: {
      health: 0.26,
      work: 0.35,
      social: 0.16,
      rest: 0.14,
      learning: 0.08,
    },
    personality_type: '성장형 균형주의자',
    strengths: [
      '경험에서 배움을 찾는 능력이 뛰어남',
      '미래를 계획하는 성향',
      '갈등을 성장 기회로 전환하는 회복탄력성',
    ],
    monthly_trend: [59, 56, 59, 70, 73, 74, 55, 51, 55, 69, 70, 75],
  },
  '에세이': {
    total_days: 180,
    positivity_ratio: 0.78,
    learning_ratio: 0.90,
    space_ratio: 0.85,
    energy_average: 3.8,
    personality_type: '관찰형 사색가',
    strengths: [
      '사물을 깊이 관찰하는 능력',
      '비유적 사고력이 뛰어남',
      '철학적 통찰력',
    ],
    monthly_trend: [75, 72, 78, 80, 82, 81, 76, 73, 77, 79, 80, 83],
  },
  '여행기록': {
    total_days: 120,
    positivity_ratio: 0.88,
    learning_ratio: 0.75,
    space_ratio: 0.92,
    energy_average: 4.2,
    personality_type: '경험 수집가',
    strengths: [
      '새로운 경험에 대한 개방성',
      '감사하는 마음',
      '풍경과 음식에 대한 감수성',
    ],
    monthly_trend: [85, 86, 88, 90, 89, 87, 86, 85, 88, 89, 90, 92],
  },
  '업무일지': {
    total_days: 250,
    positivity_ratio: 0.62,
    learning_ratio: 0.55,
    space_ratio: 0.48,
    energy_average: 3.1,
    personality_type: '실무형 실행가',
    strengths: [
      '일정 관리 능력',
      '성과 측정 습관',
      '꾸준한 기록',
    ],
    monthly_trend: [60, 58, 62, 65, 68, 66, 55, 52, 58, 64, 65, 67],
  },
  '일반보고': {
    total_days: 200,
    positivity_ratio: 0.70,
    learning_ratio: 0.65,
    space_ratio: 0.60,
    energy_average: 3.4,
    personality_type: '체계적 보고자',
    strengths: [
      '진행 상황 추적 능력',
      '문제 인식 및 해결 제안',
      '미래 계획 수립',
    ],
    monthly_trend: [68, 67, 70, 72, 73, 71, 65, 63, 68, 71, 72, 74],
  },
  '선교보고': {
    total_days: 150,
    positivity_ratio: 0.82,
    learning_ratio: 0.88,
    space_ratio: 0.85,
    energy_average: 4.0,
    personality_type: '감사형 헌신자',
    strengths: [
      '은혜를 발견하는 능력',
      '기도 습관',
      '타인에 대한 배려',
    ],
    monthly_trend: [80, 79, 82, 84, 85, 83, 78, 76, 80, 83, 84, 86],
  },
  '텃밭일지': {
    total_days: 100,
    positivity_ratio: 0.75,
    learning_ratio: 0.70,
    space_ratio: 0.68,
    energy_average: 3.6,
    personality_type: '관찰형 재배자',
    strengths: [
      '자연 관찰 능력',
      '인내심',
      '성장 과정 기록',
    ],
    monthly_trend: [70, 72, 75, 78, 80, 79, 73, 71, 74, 76, 77, 78],
  },
  '애완동물관찰일지': {
    total_days: 90,
    positivity_ratio: 0.92,
    learning_ratio: 0.65,
    space_ratio: 0.58,
    energy_average: 4.5,
    personality_type: '따뜻한 관찰자',
    strengths: [
      '공감 능력',
      '세밀한 관찰력',
      '애정 표현',
    ],
    monthly_trend: [90, 91, 92, 93, 92, 91, 90, 89, 91, 92, 93, 94],
  },
  '육아일기': {
    total_days: 280,
    positivity_ratio: 0.68,
    learning_ratio: 0.85,
    space_ratio: 0.72,
    energy_average: 2.8,
    personality_type: '성장하는 부모',
    strengths: [
      '아이의 변화를 세밀히 관찰',
      '부모로서 배움을 찾는 능력',
      '미래를 계획하는 성향',
    ],
    monthly_trend: [65, 64, 68, 70, 72, 71, 63, 60, 66, 69, 70, 72],
  },
};

const ACTION_LABELS: Record<string, string> = {
  health: '🏃 운동/건강',
  work: '💼 업무',
  social: '👥 사교',
  rest: '🧘 휴식',
  learning: '📚 학습',
};

// 날짜 계산 함수들
function getWeekRange(year: number, month: number, week: number) {
  const startDay = (week - 1) * 7 + 1;
  const endDay = Math.min(week * 7, new Date(year, month, 0).getDate());
  
  const start = new Date(year, month - 1, startDay);
  const end = new Date(year, month - 1, endDay);
  
  return {
    start: formatDate(start),
    end: formatDate(end),
    label: `${year}.${String(month).padStart(2, '0')}.${String(startDay).padStart(2, '0')} - ${String(endDay).padStart(2, '0')}`
  };
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  
  return {
    start: formatDate(start),
    end: formatDate(end),
    label: `${year}.${String(month).padStart(2, '0')}.01 - ${String(end.getDate()).padStart(2, '0')}`
  };
}

function getCustomRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  return {
    start: startDate,
    end: endDate,
    label: `${startDate.replace(/-/g, '.')} - ${endDate.split('-').slice(1).join('.')} (${daysDiff}일)`
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeeksInMonth(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate();
  return Math.ceil(lastDay / 7);
}

export function FormatStatisticsPage() {
  const { format } = useParams<{ format: string }>();
  const navigate = useNavigate();
  const [selectedGraphMonth, setSelectedGraphMonth] = useState<number | null>(null);

  // 기간 선택 상태
  const [periodMode, setPeriodMode] = useState<'week' | 'month' | 'custom'>('month');
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  
  // 기간 설정 모드
  const [customStartDate, setCustomStartDate] = useState(formatDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [customEndDate, setCustomEndDate] = useState(formatDate(today));

  const formatType = format as RecordFormat;
  const data = SIMULATION_DATA[formatType];

  // 선택된 기간 정보 계산
  const periodInfo = 
    periodMode === 'week' ? getWeekRange(selectedYear, selectedMonth, selectedWeek) :
    periodMode === 'month' ? getMonthRange(selectedYear, selectedMonth) :
    getCustomRange(customStartDate, customEndDate);

  const weeksInMonth = getWeeksInMonth(selectedYear, selectedMonth);

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-center text-gray-500">통계 데이터가 없습니다.</p>
      </div>
    );
  }

  const getProgressBarColor = (ratio: number) => {
    if (ratio >= 0.7) return '#10b981';
    if (ratio >= 0.5) return '#f59e0b';
    return '#ef4444';
  };

  const getProgressBarWidth = (ratio: number) => {
    return `${Math.round(ratio * 100)}%`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/stats')}
          className="flex items-center gap-2 mb-4 text-sm hover:opacity-70 transition-opacity"
          style={{ color: '#1A3C6E' }}
        >
          <ArrowLeft className="w-4 h-4" />
          통계 홈으로
        </button>

        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1A3C6E' }}>
            📊 {format} 통계
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#666666' }}>
          선택한 기간의 기록을 분석합니다
        </p>
      </div>

      {/* 기간 선택 UI */}
      <div className="mb-6 bg-white rounded-lg p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5" style={{ color: '#1A3C6E' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#1A3C6E' }}>
            조회 기간
          </h3>
        </div>

        {/* 주간/월간/기간설정 탭 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => setPeriodMode('week')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: periodMode === 'week' ? '#1A3C6E' : '#F0F7FF',
              color: periodMode === 'week' ? '#FAF9F6' : '#1A3C6E',
              border: periodMode === 'week' ? 'none' : '1px solid #d0dff0'
            }}
          >
            📅 주간
          </button>
          <button
            onClick={() => setPeriodMode('month')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: periodMode === 'month' ? '#1A3C6E' : '#F0F7FF',
              color: periodMode === 'month' ? '#FAF9F6' : '#1A3C6E',
              border: periodMode === 'month' ? 'none' : '1px solid #d0dff0'
            }}
          >
            📆 월간
          </button>
          <button
            onClick={() => setPeriodMode('custom')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: periodMode === 'custom' ? '#1A3C6E' : '#F0F7FF',
              color: periodMode === 'custom' ? '#FAF9F6' : '#1A3C6E',
              border: periodMode === 'custom' ? 'none' : '1px solid #d0dff0'
            }}
          >
            📋 기간 설정
          </button>
        </div>

        {/* 주간 선택 */}
        {periodMode === 'week' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#e5e5e5', color: '#333' }}
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(Number(e.target.value));
                  setSelectedWeek(1);
                }}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#e5e5e5', color: '#333' }}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#e5e5e5', color: '#333' }}
              >
                {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>{w}주</option>
                ))}
              </select>
            </div>
            
            <div 
              className="text-xs text-center py-2 rounded-lg"
              style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E' }}
            >
              📅 {periodInfo.label}
            </div>
          </div>
        )}

        {/* 월간 선택 */}
        {periodMode === 'month' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#e5e5e5', color: '#333' }}
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#e5e5e5', color: '#333' }}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
            
            <div 
              className="text-xs text-center py-2 rounded-lg"
              style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E' }}
            >
              📆 {periodInfo.label}
            </div>
          </div>
        )}

        {/* 기간 설정 */}
        {periodMode === 'custom' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#666' }}>
                  시작일
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: '#e5e5e5', color: '#333' }}
                />
              </div>
              
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#666' }}>
                  종료일
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: '#e5e5e5', color: '#333' }}
                />
              </div>
            </div>
            
            <div 
              className="text-xs text-center py-2 rounded-lg"
              style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E' }}
            >
              📋 {periodInfo.label}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: '#999' }}>총 기록일</p>
            <Activity className="w-4 h-4" style={{ color: '#1A3C6E' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
            {data.total_days}일
          </p>
          <p className="text-xs mt-1" style={{ color: '#999' }}>
            (시뮬레이션)
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: '#999' }}>평균 에너지</p>
            <Sparkles className="w-4 h-4" style={{ color: '#f59e0b' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
            {data.energy_average}/5
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: '#999' }}>성향 유형</p>
            <Brain className="w-4 h-4" style={{ color: '#10b981' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#10b981' }}>
            {data.personality_type}
          </p>
        </div>
      </div>

      {/* Main Statistics */}
      <div className="space-y-4 mb-6">
        {/* 긍정성 지수 */}
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: '#333' }}>
              😊 긍정성 지수
            </h3>
            <span className="text-lg font-bold" style={{ color: getProgressBarColor(data.positivity_ratio) }}>
              {Math.round(data.positivity_ratio * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                backgroundColor: getProgressBarColor(data.positivity_ratio),
                width: getProgressBarWidth(data.positivity_ratio),
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: '#666' }}>
            {data.positivity_ratio >= 0.7 ? '매우 긍정적입니다! 🎉' :
             data.positivity_ratio >= 0.5 ? '보통 수준입니다' :
             '스트레스 관리가 필요해요 ⚠️'}
          </p>
        </div>

        {/* 배움 작성률 */}
        {data.learning_ratio !== undefined && (
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#333' }}>
                🌱 배움 작성률
              </h3>
              <span className="text-lg font-bold" style={{ color: getProgressBarColor(data.learning_ratio) }}>
                {Math.round(data.learning_ratio * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  backgroundColor: getProgressBarColor(data.learning_ratio),
                  width: getProgressBarWidth(data.learning_ratio),
                }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: '#666' }}>
              {data.learning_ratio >= 0.8 ? '자기성찰형! 경험에서 의미를 찾습니다' :
               data.learning_ratio >= 0.6 ? '성장 마인드셋을 가지고 있어요' :
               '배움을 더 기록해보세요'}
            </p>
          </div>
        )}

        {/* 여백 작성률 */}
        {data.space_ratio !== undefined && (
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#333' }}>
                🚀 미래 지향성
              </h3>
              <span className="text-lg font-bold" style={{ color: getProgressBarColor(data.space_ratio) }}>
                {Math.round(data.space_ratio * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  backgroundColor: getProgressBarColor(data.space_ratio),
                  width: getProgressBarWidth(data.space_ratio),
                }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: '#666' }}>
              여백 필드 작성률입니다. 높을수록 계획적이에요!
            </p>
          </div>
        )}

        {/* 갈등→배움 전환율 (일기만) */}
        {data.conflict_with_learning_ratio !== undefined && (
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#333' }}>
                💪 회복탄력성
              </h3>
              <span className="text-lg font-bold" style={{ color: getProgressBarColor(data.conflict_with_learning_ratio) }}>
                {Math.round(data.conflict_with_learning_ratio * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  backgroundColor: getProgressBarColor(data.conflict_with_learning_ratio),
                  width: getProgressBarWidth(data.conflict_with_learning_ratio),
                }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: '#666' }}>
              갈등을 배움으로 승화시킨 비율입니다. 매우 높아요! 🌟
            </p>
          </div>
        )}
      </div>

      {/* 활동 분포 (일기만) */}
      {data.action_distribution && (
        <div className="bg-white rounded-lg p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#333' }}>
            🎨 주요 활동 분포
          </h3>
          <div className="space-y-3">
            {Object.entries(data.action_distribution)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: '#666' }}>
                      {ACTION_LABELS[key] || key}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: '#1A3C6E' }}>
                      {Math.round((value as number) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: '#1A3C6E',
                        width: `${Math.round((value as number) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 월별 추이 */}
      {data.monthly_trend && (
        <div className="bg-white rounded-lg p-5 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#333' }}>
              월별 긍정성 추이
            </h3>
          </div>
          <div className="flex items-end justify-between h-40 gap-1">
            {data.monthly_trend.map((value: number, index: number) => {
              const month = index + 1;
              const isSelected = selectedGraphMonth === month;
              const barColor = value >= 70 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
              
              return (
                <button
                  key={month}
                  onClick={() => setSelectedGraphMonth(isSelected ? null : month)}
                  className="flex-1 flex flex-col items-center gap-1 transition-opacity hover:opacity-70"
                  style={{ opacity: isSelected ? 1 : 0.8 }}
                >
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      backgroundColor: isSelected ? '#1A3C6E' : barColor,
                      height: `${value}%`,
                      minHeight: 8,
                    }}
                  />
                  <span className="text-xs" style={{ color: '#999' }}>
                    {month}월
                  </span>
                  {isSelected && (
                    <span className="text-xs font-semibold" style={{ color: barColor }}>
                      {value}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 강점 */}
      {data.strengths && (
        <div className="bg-white rounded-lg p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#333' }}>
            ✨ 발견된 강점
          </h3>
          <ul className="space-y-2">
            {data.strengths.map((strength: string, index: number) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm"
                style={{ color: '#666' }}
              >
                <span style={{ color: '#10b981' }}>✓</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Developer Note */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">
          🔧 <strong>개발자 노트:</strong> 이 통계는 시뮬레이션 데이터입니다
        </p>
        <p className="text-xs text-gray-500 mt-1">
          실제 서비스에서는 선택한 기간({periodInfo.label})의 SAYU 분석 데이터를 기반으로 표시됩니다
        </p>
      </div>
    </div>
  );
}
