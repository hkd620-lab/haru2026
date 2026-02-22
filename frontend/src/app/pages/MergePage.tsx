import { useState } from 'react';
import { Layers, Info } from 'lucide-react';
import { MergeTitleAnimation } from '../components/MergeTitleAnimation';

type StarThreshold = 1 | 2 | 3 | 4 | 5;
type MergePeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface PeriodOption {
  id: MergePeriod;
  title: string;
  description: string;
  bgColor: string;
  selectedBgColor: string;
  borderColor: string;
}

export function MergePage() {
  const [starThreshold, setStarThreshold] = useState<StarThreshold>(3);
  const [selectedPeriod, setSelectedPeriod] = useState<MergePeriod | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showMergeGuide, setShowMergeGuide] = useState(false);

  const periodOptions: PeriodOption[] = [
    {
      id: 'weekly',
      title: '주간',
      description: '최근 7일 기준',
      bgColor: '#FAF9F6',
      selectedBgColor: '#F5F1E8',
      borderColor: '#E8E3D8',
    },
    {
      id: 'monthly',
      title: '월간',
      description: '주간 합치기 기반',
      bgColor: '#F0F4F8',
      selectedBgColor: '#E3EAF2',
      borderColor: '#D6E0EC',
    },
    {
      id: 'quarterly',
      title: '분기',
      description: '3개월 기준',
      bgColor: '#F0F5F1',
      selectedBgColor: '#E3EDE5',
      borderColor: '#D6E5D9',
    },
    {
      id: 'yearly',
      title: '연간',
      description: '12개월 기준',
      bgColor: '#F8F6F1',
      selectedBgColor: '#EDE8DC',
      borderColor: '#E3DCCF',
    },
  ];

  const periodLabels: Record<MergePeriod, string> = {
    weekly: '주간',
    monthly: '월간',
    quarterly: '분기',
    yearly: '연간',
  };

  const handleRunMerge = async () => {
    if (!selectedPeriod) {
      alert('병합 기간을 선택해주세요');
      return;
    }

    setIsRunning(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      alert(`✅ 합치기 완료!\n기준 별점: ${starThreshold}점 이상\n기간: ${periodLabels[selectedPeriod]}`);
    } catch (error) {
      console.error('Merge failed:', error);
      alert('❌ 합치기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsRunning(false);
    }
  };

  const toggleMergeGuide = () => {
    const newValue = !showMergeGuide;
    setShowMergeGuide(newValue);
    try {
      localStorage.setItem('haru_merge_guide_visible', String(newValue));
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <MergeTitleAnimation />
        {/* 사용 안내 토글 */}
        <button
          onClick={toggleMergeGuide}
          className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
          style={{
            backgroundColor: showMergeGuide ? 'rgba(26,60,110,0.08)' : 'transparent',
            color: '#1A3C6E',
            border: '1px solid rgba(26,60,110,0.2)',
            fontSize: '11px',
          }}
        >
          <Info className="w-3 h-3" />
          안내
        </button>
      </div>

      {/* 사용 안내 (접이식) */}
      {showMergeGuide && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ backgroundColor: '#F0F7FF', border: '1px solid rgba(26,60,110,0.15)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: '#1A3C6E', margin: 0 }}>
            💡 <strong>작동 방식:</strong> SAYU에서 부여한 별점 기준으로 기록을 하나로 통합합니다.
            높은 별점의 기록이 우선 반영됩니다.
          </p>
        </div>
      )}

      {/* Step 1: 병합 기준 별점 선택 */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <span style={{ fontSize: '13px', color: '#1A3C6E', fontWeight: 600 }}>
            ⭐ 병합 기준 별점 선택
          </span>
          <span className="text-xs" style={{ color: '#999' }}>
            — 최소 별점을 선택하세요
          </span>
        </div>

        <div className="grid grid-cols-5 gap-0 px-3 pb-3">
          {[1, 2, 3, 4, 5].map((stars, index) => {
            const isSelected = starThreshold === stars;
            return (
              <button
                key={stars}
                onClick={() => setStarThreshold(stars as StarThreshold)}
                className="py-2 transition-all text-center"
                style={{
                  backgroundColor: isSelected ? '#1A3C6E' : '#FAF9F6',
                  color: isSelected ? '#FAF9F6' : '#333',
                  borderTop: `1px solid ${isSelected ? '#1A3C6E' : '#e5e5e5'}`,
                  borderBottom: `1px solid ${isSelected ? '#1A3C6E' : '#e5e5e5'}`,
                  borderLeft: index === 0
                    ? `1px solid ${isSelected ? '#1A3C6E' : '#e5e5e5'}`
                    : 'none',
                  borderRight: `1px solid ${isSelected ? '#1A3C6E' : '#e5e5e5'}`,
                  borderRadius:
                    index === 0
                      ? '6px 0 0 6px'
                      : index === 4
                      ? '0 6px 6px 0'
                      : '0',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <div style={{ fontSize: '10px', lineHeight: 1.3 }}>
                  {'⭐'.repeat(stars)}
                </div>
                <div style={{ fontSize: '10px', marginTop: '2px' }}>
                  {stars === 5 ? '5점만' : `${stars}점↑`}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: 병합 기간 선택 */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <span style={{ fontSize: '13px', color: '#1A3C6E', fontWeight: 600 }}>
            📅 병합 기간 선택
          </span>
          <span className="text-xs" style={{ color: '#999' }}>
            — 합칠 기간을 선택하세요
          </span>
        </div>

        <div className="grid grid-cols-4 gap-0 px-3 pb-3">
          {periodOptions.map((option, index) => {
            const isSelected = selectedPeriod === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setSelectedPeriod(option.id)}
                className="py-3 transition-all text-center"
                style={{
                  backgroundColor: isSelected ? option.selectedBgColor : option.bgColor,
                  borderTop: `1px solid ${option.borderColor}`,
                  borderBottom: isSelected ? `3px solid #1A3C6E` : `1px solid ${option.borderColor}`,
                  borderLeft: index === 0 ? `1px solid ${option.borderColor}` : 'none',
                  borderRight: `1px solid ${option.borderColor}`,
                  borderRadius:
                    index === 0
                      ? '6px 0 0 6px'
                      : index === 3
                      ? '0 6px 6px 0'
                      : '0',
                  fontWeight: isSelected ? 600 : 400,
                  boxShadow: isSelected ? '0 2px 8px rgba(26,60,110,0.12)' : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    color: isSelected ? '#1A3C6E' : '#333',
                    marginBottom: '3px',
                  }}
                >
                  {option.title}
                </div>
                <div style={{ fontSize: '10px', color: isSelected ? '#555' : '#999' }}>
                  {option.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 3: 합치기 실행 버튼 */}
      <button
        onClick={handleRunMerge}
        disabled={isRunning || !selectedPeriod}
        className="w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 shadow-md"
        style={{
          backgroundColor: '#1A3C6E',
          color: '#FAF9F6',
          fontWeight: 600,
          fontSize: '15px',
          letterSpacing: '0.04em',
        }}
      >
        <Layers className="w-4 h-4" />
        <span>{isRunning ? '합치는 중...' : '합치기 실행'}</span>
      </button>
    </div>
  );
}