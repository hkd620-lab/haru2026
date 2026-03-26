import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Brain, Sparkles, Activity, Calendar, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, RecordFormat } from '../services/firestoreService';
import {
  statScoreToText,
  statScoreToColor,
  StatScore,
  FORMAT_PREFIX,
} from '../types/haruTypes';
import { useSubscription } from '../hooks/useSubscription';

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
  const { isPremium } = useSubscription();

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

  // 전체 기록 (그래프용)
  const [allFormatRecords, setAllFormatRecords] = useState<any[]>([]);

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

  // 전체 기록 로드 (그래프용)
  useEffect(() => {
    if (!user?.uid) return;
    firestoreService.getRecords(user.uid).then((records) => {
      setAllFormatRecords(records.filter((r) => r.formats && r.formats.includes(formatType)));
    }).catch(() => setAllFormatRecords([]));
  }, [user?.uid, formatType]);

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
              backgroundColor: periodMode === 'week' ? '#1A3C6E' : '#FEFBE8',
              color: periodMode === 'week' ? '#FAF9F6' : '#333',
              border: periodMode === 'week' ? 'none' : '1px solid #e5e5e5',
            }}
          >
            주간
          </button>
          <button
            onClick={() => {
              if (!isPremium) {
                alert('PREMIUM 구독 후 이용 가능한 기능입니다.\n월 3,000원으로 시작해 보세요!');
                window.location.href = '/subscription';
                return;
              }
              setPeriodMode('month');
            }}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={{
              backgroundColor: periodMode === 'month' ? '#1A3C6E' : '#FEFBE8',
              color: periodMode === 'month' ? '#FAF9F6' : '#333',
              border: periodMode === 'month' ? 'none' : '1px solid #e5e5e5',
              opacity: isPremium ? 1 : 0.7,
            }}
          >
            월간{!isPremium && ' 🔒'}
          </button>
          <button
            onClick={() => {
              if (!isPremium) {
                alert('PREMIUM 구독 후 이용 가능한 기능입니다.\n월 3,000원으로 시작해 보세요!');
                window.location.href = '/subscription';
                return;
              }
              setPeriodMode('custom');
            }}
            className="px-4 py-2 rounded-lg text-sm transition-all"
            style={{
              backgroundColor: periodMode === 'custom' ? '#1A3C6E' : '#FEFBE8',
              color: periodMode === 'custom' ? '#FAF9F6' : '#333',
              border: periodMode === 'custom' ? 'none' : '1px solid #e5e5e5',
              opacity: isPremium ? 1 : 0.7,
            }}
          >
            사용자 정의{!isPremium && ' 🔒'}
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
      {!loading && data && (() => {
        const prefix = FORMAT_PREFIX[formatType] || '';
        const totalCount = allFormatRecords.length;
        const sayuCount = allFormatRecords.filter((r) => r[`${prefix}_sayu`]).length;
        const completionRate = totalCount > 0 ? Math.round((sayuCount / totalCount) * 100) : 0;

        // 최근 5개월 월별 기록 수
        const now = new Date();
        const last5Months = Array.from({ length: 5 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const count = allFormatRecords.filter((r) => {
            const [ry, rm] = r.date.split('-').map(Number);
            return ry === y && rm === m;
          }).length;
          const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;
          return { label: `${m}월`, count, isCurrentMonth };
        });
        const maxMonthCount = Math.max(...last5Months.map((m) => m.count), 1);

        // 기분 분포
        const moodColors: Record<string, string> = {
          '기쁨': '#FAC775', '평온': '#85B7EB', '울적': '#AFA9EC',
        };
        const moodCounts: Record<string, number> = {};
        allFormatRecords.forEach((r) => { if (r.mood) moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1; });
        const moodEntries = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
        const maxMood = Math.max(...moodEntries.map((e) => e[1]), 1);

        // 날씨 분포
        const weatherEmoji: Record<string, string> = { '쾌청': '☀️', '흐림': '☁️', '비': '🌧️', '눈': '❄️' };
        const weatherCounts: Record<string, number> = {};
        allFormatRecords.forEach((r) => { if (r.weather) weatherCounts[r.weather] = (weatherCounts[r.weather] || 0) + 1; });
        const weatherEntries = Object.entries(weatherCounts).sort((a, b) => b[1] - a[1]);

        const cardStyle: React.CSSProperties = {
          background: 'var(--color-background-primary, #FAF9F6)',
          border: '0.5px solid var(--color-border-tertiary, #e5e5e5)',
          borderRadius: 'var(--border-radius-lg, 12px)',
          padding: 14,
          marginBottom: 12,
        };

        return (
          <>
            {/* ── 1. 요약 카드 3개 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { label: '총 기록', value: `${totalCount}건`, color: '#1A3C6E' },
                { label: 'SAYU 완료', value: `${sayuCount}건`, color: '#1A3C6E' },
                { label: '완료율', value: `${completionRate}%`, color: '#10b981' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--color-background-secondary, #f5f5f5)',
                    borderRadius: 'var(--border-radius-md, 8px)',
                    padding: 12,
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary, #999)', marginBottom: 6 }}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 500, color, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── 2. SAYU 완료율 진행 바 ── */}
            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 10 }}>SAYU 완료율</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 10, background: 'var(--color-background-secondary, #f0f0f0)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${completionRate}%`, height: '100%', background: '#1A3C6E', borderRadius: 10, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', minWidth: 36, textAlign: 'right' }}>{completionRate}%</span>
              </div>
            </div>

            {/* ── 3. 월별 기록 횟수 막대 그래프 ── */}
            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 12 }}>월별 기록 횟수</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
                {last5Months.map(({ label, count, isCurrentMonth }) => (
                  <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#999' }}>{count > 0 ? count : ''}</span>
                    <div
                      style={{
                        width: '100%',
                        height: count > 0 ? Math.max(Math.round((count / maxMonthCount) * 64), 4) : 4,
                        background: isCurrentMonth ? '#10b981' : '#1A3C6E',
                        borderRadius: '4px 4px 0 0',
                        opacity: count === 0 ? 0.2 : 1,
                        transition: 'height 0.4s ease',
                      }}
                    />
                    <span style={{ fontSize: 10, color: '#666' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 4. 기분 분포 + 날씨 분포 ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {/* 기분 분포 */}
              <div style={cardStyle}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 10 }}>기분 분포</p>
                {moodEntries.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#bbb' }}>데이터 없음</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {moodEntries.map(([mood, count]) => (
                      <div key={mood}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: '#555' }}>{mood}</span>
                          <span style={{ fontSize: 11, color: '#999' }}>{count}</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--color-background-secondary, #f0f0f0)', borderRadius: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round((count / maxMood) * 100)}%`, height: '100%', background: moodColors[mood] || 'var(--color-border-tertiary, #ccc)', borderRadius: 8 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 날씨 분포 */}
              <div style={cardStyle}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 10 }}>날씨 분포</p>
                {weatherEntries.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#bbb' }}>데이터 없음</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {weatherEntries.map(([weather, count]) => (
                      <div key={weather} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 16 }}>{weatherEmoji[weather] || '🌤️'}</span>
                        <div>
                          <p style={{ fontSize: 10, color: '#666', margin: 0 }}>{weather}</p>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#1A3C6E', margin: 0 }}>{count}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
        );
      })()}
    </div>
  );
}
