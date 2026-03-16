import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Brain, Sparkles, Activity, Calendar, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, RecordFormat } from '../services/firestoreService';
import { 
  statScoreToText, 
  statScoreToColor,
  StatScore 
} from '../types/haruTypes';

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

// StatScore를 별점으로 변환
function StatScoreStars({ score }: { score: StatScore }) {
  const color = statScoreToColor(score);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="w-4 h-4"
          style={{
            fill: i <= score ? color : 'transparent',
            stroke: i <= score ? color : '#d1d5db',
          }}
        />
      ))}
    </div>
  );
}

// 형식별 고유 지표 정의
interface FormatMetric {
  key: string;
  label: string;
  icon: string;
  description: string;
}

const FORMAT_METRICS: Record<RecordFormat, FormatMetric[]> = {
  '일기': [
    { key: 'emotional_flow', label: '감정 흐름', icon: '💫', description: '좋았던 일 → 갈등 → 배움의 연결성' },
    { key: 'self_awareness', label: '자기인식', icon: '🧠', description: '배움 필드의 깊이와 성찰력' },
    { key: 'daily_stability', label: '일상 안정성', icon: '🏠', description: '여백/내일 계획의 규칙성' },
  ],
  '에세이': [
    { key: 'theme_frequency', label: '주제 다양성', icon: '🎨', description: '다양한 필드 작성 여부' },
    { key: 'emotional_depth', label: '감정 깊이', icon: '❤️', description: '첫인상 필드의 표현력' },
    { key: 'reflection_depth', label: '성찰 깊이', icon: '🤔', description: '핵심 필드의 통찰력' },
  ],
  '선교보고': [
    { key: 'grace_awareness', label: '은혜 인식', icon: '✨', description: 'Grace 필드 작성 빈도' },
    { key: 'spiritual_growth', label: '영적 성장', icon: '🙏', description: 'Heart 필드의 깊이' },
    { key: 'service_impact', label: '섬김 영향력', icon: '🤝', description: 'Action 필드의 구체성' },
  ],
  '일반보고': [
    { key: 'completion_rate', label: '완성도', icon: '✅', description: '모든 필드 작성 비율' },
    { key: 'issue_awareness', label: '문제 인식', icon: '🔍', description: '특이사항 기록률' },
    { key: 'planning_quality', label: '계획 품질', icon: '📋', description: '향후 계획 구체성' },
  ],
  '업무일지': [
    { key: 'task_completion', label: '업무 완성도', icon: '✅', description: 'Result 작성률' },
    { key: 'productivity_score', label: '생산성', icon: '📊', description: 'Rating 평균 기반' },
    { key: 'self_evaluation', label: '자기 평가', icon: '📝', description: 'Rating 작성 일관성' },
  ],
  '여행기록': [
    { key: 'experience_richness', label: '경험 풍부함', icon: '🌍', description: '모든 필드 작성률' },
    { key: 'gratitude_level', label: '감사 수준', icon: '🙏', description: '감사 표현 빈도' },
    { key: 'reflection_depth', label: '성찰 깊이', icon: '💭', description: '단상의 질' },
  ],
  '텃밭일지': [
    { key: 'crop_diversity', label: '작물 다양성', icon: '🌱', description: '작물 필드 작성' },
    { key: 'observation_detail', label: '관찰 세밀도', icon: '🔬', description: '관찰 필드 상세도' },
    { key: 'issue_management', label: '문제 대응력', icon: '🛠️', description: '문제-계획 연결성' },
  ],
  '애완동물관찰일지': [
    { key: 'care_attention', label: '돌봄 관심도', icon: '💊', description: '건강 필드 작성' },
    { key: 'emotional_bond', label: '정서적 유대', icon: '❤️', description: '감정 필드 작성' },
    { key: 'health_awareness', label: '건강 인식', icon: '🏥', description: '행동-건강 연결' },
  ],
  '육아일기': [
    { key: 'growth_observation', label: '성장 관찰력', icon: '📏', description: '성장 필드 작성' },
    { key: 'emotional_understanding', label: '감정 이해도', icon: '💝', description: '감정 필드 작성' },
    { key: 'learning_support', label: '학습 지원도', icon: '📚', description: '학습 필드 작성' },
  ],
};

export function FormatStatisticsPage() {
  const { format } = useParams<{ format: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // 기간 선택 상태
  const [periodMode, setPeriodMode] = useState<'week' | 'month' | 'custom'>('month');
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  
  const [customStartDate, setCustomStartDate] = useState(formatDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [customEndDate, setCustomEndDate] = useState(formatDate(today));

  // 데이터 로드 상태
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const formatType = format as RecordFormat;
  const metrics = FORMAT_METRICS[formatType] || [];

  // 선택된 기간 정보 계산
  const periodInfo = 
    periodMode === 'week' ? getWeekRange(selectedYear, selectedMonth, selectedWeek) :
    periodMode === 'month' ? getMonthRange(selectedYear, selectedMonth) :
    getCustomRange(customStartDate, customEndDate);

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      console.log('\n\n🌟 ===== FormatStatisticsPage 데이터 로드 시작 =====');
      console.log('🎯 형식:', formatType);
      console.log('📅 선택된 기간 모드:', periodMode);
      console.log('📅 계산된 기간:', periodInfo);
      console.log('  시작일:', periodInfo.start);
      console.log('  종료일:', periodInfo.end);
      console.log('  라벨:', periodInfo.label);
      console.log('======================================\n');

      setLoading(true);
      try {
        const result = await firestoreService.calculateFormatStatistics(
          user.uid,
          formatType,
          periodInfo.start,
          periodInfo.end
        );
        setData(result);
        
        console.log('\n✅ 데이터 로드 완료');
        console.log('결과:', result);
        console.log('======================================\n\n');
      } catch (error) {
        console.error('❌ 통계 로드 실패:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.uid, formatType, periodInfo.start, periodInfo.end]);

  const weeksInMonth = getWeeksInMonth(selectedYear, selectedMonth);

  if (!format) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/stats')}
          className="flex items-center gap-2 mb-4 text-sm transition-opacity hover:opacity-70"
          style={{ color: '#1A3C6E' }}
        >
          <ArrowLeft className="w-4 h-4" />
          통계 홈으로
        </button>

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
            {formatType} 상세 통계
          </h1>
        </div>

        <p className="text-sm" style={{ color: '#666' }}>
          {periodInfo.label} 기간의 기록 분석
        </p>
      </div>

      {/* 기간 선택 */}
      <div className="bg-white rounded-lg p-5 shadow-sm mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#333' }}>
          📅 분석 기간 설정
        </h3>

        {/* 기간 모드 선택 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setPeriodMode('week')}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={{
              backgroundColor: periodMode === 'week' ? '#1A3C6E' : '#FAF9F6',
              color: periodMode === 'week' ? '#FAF9F6' : '#333',
              border: periodMode === 'week' ? 'none' : '1px solid #e5e5e5',
            }}
          >
            주간
          </button>
          <button
            onClick={() => setPeriodMode('month')}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={{
              backgroundColor: periodMode === 'month' ? '#1A3C6E' : '#FAF9F6',
              color: periodMode === 'month' ? '#FAF9F6' : '#333',
              border: periodMode === 'month' ? 'none' : '1px solid #e5e5e5',
            }}
          >
            월간
          </button>
          <button
            onClick={() => setPeriodMode('custom')}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={{
              backgroundColor: periodMode === 'custom' ? '#1A3C6E' : '#FAF9F6',
              color: periodMode === 'custom' ? '#FAF9F6' : '#333',
              border: periodMode === 'custom' ? 'none' : '1px solid #e5e5e5',
            }}
          >
            사용자 정의
          </button>
        </div>

        {/* 주간 선택 */}
        {periodMode === 'week' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#666' }}>연도</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              >
                {[2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#666' }}>월</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ color: '#666' }}>주차</label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              >
                {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map((week) => (
                  <option key={week} value={week}>{week}주차</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 월간 선택 */}
        {periodMode === 'month' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#666' }}>연도</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              >
                {[2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#666' }}>월</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 사용자 정의 기간 */}
        {periodMode === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#666' }}>시작일</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: '#666' }}>종료일</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="bg-white rounded-lg p-8 shadow-sm text-center">
          <p style={{ color: '#999' }}>통계를 분석하는 중...</p>
        </div>
      )}

      {/* 데이터 없음 */}
      {!loading && !data && (
        <div className="bg-white rounded-lg p-8 shadow-sm text-center">
          <p className="text-base mb-2" style={{ color: '#333' }}>
            선택한 기간에 {formatType} 기록이 없습니다
          </p>
          <p className="text-sm" style={{ color: '#999' }}>
            다른 기간을 선택해보세요
          </p>
        </div>
      )}

      {/* 통계 표시 */}
      {!loading && data && (
        <>
          {/* 기본 정보 */}
          <div className="bg-white rounded-lg p-5 shadow-sm mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: '#999' }}>총 기록 일수</p>
                <p className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
                  {data.total_days}일
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: '#999' }}>평균 에너지</p>
                <p className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
                  {data.energy_average.toFixed(1)} / 5.0
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs mb-2" style={{ color: '#999' }}>성격 유형</p>
              <p className="text-base font-semibold" style={{ color: '#1A3C6E' }}>
                🎯 {data.personality_type}
              </p>
            </div>
          </div>

          {/* 공통 지표: 긍정성 */}
          <div className="bg-white rounded-lg p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#333' }}>
                😊 긍정성 지수 (공통)
              </h3>
              <StatScoreStars score={data.positivity_ratio} />
            </div>
            <p className="text-xs" style={{ color: '#666' }}>
              {statScoreToText(data.positivity_ratio)}
            </p>
          </div>

          {/* 형식별 고유 지표 */}
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-bold" style={{ color: '#1A3C6E' }}>
              ✨ {formatType} 고유 지표
            </h2>
            
            {metrics.map((metric) => {
              const score = data[metric.key] as StatScore;
              if (!score) return null;

              return (
                <div key={metric.key} className="bg-white rounded-lg p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold" style={{ color: '#333' }}>
                      {metric.icon} {metric.label}
                    </h3>
                    <StatScoreStars score={score} />
                  </div>
                  <p className="text-xs mb-2" style={{ color: '#666' }}>
                    {metric.description}
                  </p>
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium" style={{ color: statScoreToColor(score) }}>
                      {statScoreToText(score)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 강점 */}
          {data.strengths && data.strengths.length > 0 && (
            <div className="bg-white rounded-lg p-5 shadow-sm mb-6">
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#333' }}>
                💪 발견된 강점
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
        </>
      )}
    </div>
  );
}
