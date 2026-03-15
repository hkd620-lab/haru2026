import { useState, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { MergeTitleAnimation } from '../components/MergeTitleAnimation';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, RecordFormat } from '../services/firestoreService';
import { toast } from 'sonner';

type StarThreshold = 1 | 2 | 3 | 4 | 5;
type MergePeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
type Category = '생활' | '업무';

interface PeriodOption {
  id: MergePeriod;
  title: string;
  description: string;
}

// 카테고리별 형식 분류
const categoryFormats: Record<Category, RecordFormat[]> = {
  '생활': ['일기', '에세이', '여행기록', '텃밭일지', '애완동물관찰일지', '육아일기'],
  '업무': ['선교보고', '일반보고', '업무일지']
};

export function MergePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<RecordFormat | null>(null);
  const [starThreshold, setStarThreshold] = useState<StarThreshold>(3);
  const [selectedPeriod, setSelectedPeriod] = useState<MergePeriod | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showNotice, setShowNotice] = useState(true);

  const periodOptions: PeriodOption[] = [
    { id: 'weekly', title: '주간', description: '최근 7일 기준' },
    { id: 'monthly', title: '월간', description: '최근 30일 기준' },
    { id: 'quarterly', title: '분기', description: '3개월 기준' },
    { id: 'yearly', title: '연간', description: '12개월 기준' },
    { id: 'custom', title: '직접선택', description: '기간 직접 입력' },
  ];

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setEndDate(today);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const handlePeriodSelect = (period: MergePeriod) => {
    setSelectedPeriod(period);
    
    // custom이 아닌 경우에만 날짜 자동 설정
    if (period !== 'custom') {
      const today = new Date();
      const end = today.toISOString().split('T')[0];
      setEndDate(end);
      
      let start = new Date();
      switch (period) {
        case 'weekly':
          start.setDate(start.getDate() - 7);
          break;
        case 'monthly':
          start.setDate(start.getDate() - 30);
          break;
        case 'quarterly':
          start.setMonth(start.getMonth() - 3);
          break;
        case 'yearly':
          start.setFullYear(start.getFullYear() - 1);
          break;
      }
      setStartDate(start.toISOString().split('T')[0]);
    }
  };

  const handleCustomDateChange = () => {
    setSelectedPeriod('custom');
  };

  const getFormatPrefix = (format: RecordFormat): string => {
    const prefixMap: Record<RecordFormat, string> = {
      '일기': 'diary',
      '에세이': 'essay',
      '선교보고': 'mission',
      '일반보고': 'report',
      '업무일지': 'work',
      '여행기록': 'travel',
      '텃밭일지': 'garden',
      '애완동물관찰일지': 'pet',
      '육아일기': 'child',
    };
    return prefixMap[format] || 'diary';
  };

  const handleRunMerge = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (!selectedFormat) {
      toast.warning('형식을 선택해주세요.');
      return;
    }

    if (!startDate || !endDate) {
      toast.warning('시작일과 종료일을 선택해주세요.');
      return;
    }

    if (startDate > endDate) {
      toast.warning('시작일은 종료일보다 이전이어야 합니다.');
      return;
    }

    setIsRunning(true);

    try {
      const records = await firestoreService.getRecords(user.uid);
      
      const dateFiltered = records.filter(record => {
        return record.date >= startDate && record.date <= endDate;
      });

      const formatFiltered = dateFiltered.filter(record => {
        return record.formats && record.formats.includes(selectedFormat);
      });

      const formatPrefix = getFormatPrefix(selectedFormat);
      const starFiltered = formatFiltered.filter(record => {
        const sayuKey = `${formatPrefix}_sayu`;
        const hasSayu = record[sayuKey] && record[sayuKey].trim().length > 0;
        
        if (!hasSayu) return false;
        
        const rating = record.mergeRating || 0;
        return rating >= starThreshold;
      });

      if (starFiltered.length === 0) {
        toast.warning(`조건에 맞는 ${selectedFormat} 기록이 없습니다.`);
        setIsRunning(false);
        return;
      }

      // 뷰어 페이지로 이동
      navigate('/merge-viewer', {
        state: {
          records: starFiltered,
          format: selectedFormat,
          startDate,
          endDate,
          threshold: starThreshold,
        },
      });
    } catch (error) {
      console.error('병합 실패:', error);
      toast.error('합치기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <MergeTitleAnimation />
      </div>

      {showNotice && (
        <div
          className="rounded-lg p-4 shadow-sm"
          style={{ backgroundColor: '#FFF8F0', border: '2px solid #F59E0B' }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#B8860B', margin: 0 }}>
                중요 안내
              </h3>
            </div>
            <button
              onClick={() => setShowNotice(false)}
              className="p-1 rounded transition-colors hover:bg-black/5"
            >
              <X style={{ width: 16, height: 16, color: '#B8860B' }} />
            </button>
          </div>
          
          <ul className="space-y-1 pl-4" style={{ color: '#92400E', fontSize: '12px' }}>
            <li>• 합본 결과는 서버에 저장되지 않습니다</li>
            <li>• 앱 내부 뷰어에서 바로 확인하세요</li>
            <li>• PDF로 저장하려면 뷰어에서 저장 버튼을 누르세요</li>
          </ul>
        </div>
      )}

      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <span style={{ fontSize: '13px', color: '#1A3C6E', fontWeight: 600 }}>
            📝 형식 선택
          </span>
          <span className="text-xs" style={{ color: '#999' }}>
            — 카테고리를 선택한 후 형식을 선택하세요
          </span>
        </div>

        {/* 카테고리 선택 */}
        <div className="px-3 pb-2">
          <div className="flex gap-2">
            {(['생활', '업무'] as Category[]).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="flex-1 p-3 rounded-lg text-center transition-all text-sm font-medium"
                style={{
                  backgroundColor: selectedCategory === category ? '#1A3C6E' : '#FAF9F6',
                  border: selectedCategory === category ? 'none' : '1px solid #e5e5e5',
                  color: selectedCategory === category ? '#FAF9F6' : '#333',
                }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* 형식 선택 - 카테고리 선택 후 표시 */}
        {selectedCategory && (
          <div className="px-3 pb-3">
            <div className="grid grid-cols-3 gap-2">
              {categoryFormats[selectedCategory].map((format) => {
                const isSelected = selectedFormat === format;
                return (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className="py-2 px-3 rounded-lg text-sm transition-all"
                    style={{
                      backgroundColor: isSelected ? '#1A3C6E' : '#FAF9F6',
                      color: isSelected ? '#FAF9F6' : '#333',
                      border: isSelected ? 'none' : '1px solid #e5e5e5',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {format}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

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

      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <span style={{ fontSize: '13px', color: '#1A3C6E', fontWeight: 600 }}>
            📅 병합 기간 선택
          </span>
          <span className="text-xs" style={{ color: '#999' }}>
            — 합칠 기간을 선택하세요
          </span>
        </div>

        {/* 5개 버튼: 주간, 월간, 분기, 연간, 직접선택 */}
        <div className="grid grid-cols-5 gap-0 px-3">
          {periodOptions.map((option, index) => {
            const isSelected = selectedPeriod === option.id;
            return (
              <button
                key={option.id}
                onClick={() => handlePeriodSelect(option.id)}
                className="py-3 transition-all text-center"
                style={{
                  backgroundColor: isSelected ? '#F0F7FF' : '#FAF9F6',
                  borderTop: `1px solid #e5e5e5`,
                  borderBottom: isSelected ? `3px solid #1A3C6E` : `1px solid #e5e5e5`,
                  borderLeft: index === 0 ? `1px solid #e5e5e5` : 'none',
                  borderRight: `1px solid #e5e5e5`,
                  borderRadius:
                    index === 0
                      ? '6px 0 0 6px'
                      : index === 4
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

        {/* "직접선택" 선택 시 시작일/종료일 표시 */}
        {selectedPeriod === 'custom' && (
          <div className="px-3 py-3 border-t" style={{ borderColor: '#e5e5e5' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: '#999' }}>
                  시작일
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    handleCustomDateChange();
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{
                    borderColor: '#e5e5e5',
                    backgroundColor: '#fff',
                    color: '#333',
                  }}
                />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: '#999' }}>
                  종료일
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    handleCustomDateChange();
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{
                    borderColor: '#e5e5e5',
                    backgroundColor: '#fff',
                    color: '#333',
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <button
        onClick={handleRunMerge}
        disabled={isRunning || !selectedFormat || !startDate || !endDate}
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
        <span>{isRunning ? '합치는 중...' : '📥 합치기 실행'}</span>
      </button>
    </div>
  );
}
