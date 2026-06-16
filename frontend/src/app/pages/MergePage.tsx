import { useState, useEffect } from 'react';
import { Layers, X, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router';
import { MergeTitleAnimation } from '../components/MergeTitleAnimation';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService, type LibraryEntry } from '../services/firestoreService';
import { toast } from 'sonner';
import { RecordFormat, Category, CATEGORY_FORMATS, FORMAT_PREFIX } from '../types/haruTypes';
import { useSubscription } from '../hooks/useSubscription';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { exportLedgerToXlsx, type LedgerPeriod } from '../services/ledgerExportService';

type MergeFilter = 'special' | 'all';
type MergePeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

interface PeriodOption {
  id: MergePeriod;
  title: string;
  description: string;
}

export function MergePage() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<RecordFormat | null>(null);
  const [mergeFilter, setMergeFilter] = useState<MergeFilter>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<MergePeriod | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showNotice, setShowNotice] = useState(true);
  // 📒 HARU보조장부 엑셀 저장 전용 상태
  const [ledgerPeriod, setLedgerPeriod] = useState<LedgerPeriod>('thisMonth');
  const [isExportingLedger, setIsExportingLedger] = useState(false);
  const [assistantLibrary, setAssistantLibrary] = useState<LibraryEntry[]>([]);
  const [assistantLibraryLoading, setAssistantLibraryLoading] = useState(false);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());

  const periodOptions: PeriodOption[] = [
    { id: 'weekly', title: '주간', description: '최근 7일 기준' },
    { id: 'monthly', title: '월간', description: '최근 30일 기준' },
    { id: 'quarterly', title: '분기', description: '3개월 기준' },
    { id: 'yearly', title: '연간', description: '12개월 기준' },
    { id: 'custom', title: '직접선택', description: '기간 직접 입력' },
  ];

  const getLocalDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    const today = getLocalDateString(new Date());
    setEndDate(today);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setStartDate(getLocalDateString(thirtyDaysAgo));
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setAssistantLibrary([]);
      setSelectedLibraryIds(new Set());
      return;
    }

    setAssistantLibraryLoading(true);
    firestoreService.getLibraryByCategory(user.uid, '비서')
      .then((entries) => {
        setAssistantLibrary(entries.filter((entry) => entry.type !== 'book'));
        setSelectedLibraryIds(new Set());
      })
      .catch((error) => {
        console.warn('비서 library 합본 목록 로딩 실패:', error);
        setAssistantLibrary([]);
        setSelectedLibraryIds(new Set());
      })
      .finally(() => setAssistantLibraryLoading(false));
  }, [user?.uid]);

  const handlePeriodSelect = (period: MergePeriod) => {
    setSelectedPeriod(period);
    
    // custom이 아닌 경우에만 날짜 자동 설정
    if (period !== 'custom') {
      const end = getLocalDateString(new Date());
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
      setStartDate(getLocalDateString(start));
    }
  };

  const handleCustomDateChange = () => {
    setSelectedPeriod('custom');
  };

  const handleExportLedger = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    setIsExportingLedger(true);
    try {
      const records = await firestoreService.getRecords(user.uid);
      const result = exportLedgerToXlsx(records, ledgerPeriod);
      if (result.count === 0) {
        toast.warning('해당 기간의 보조장부 기록이 없습니다.');
      } else {
        toast.success(`📒 ${result.count}건이 ${result.fileName} 파일로 저장되었습니다.`);
      }
    } catch (e) {
      console.error('보조장부 엑셀 저장 실패:', e);
      toast.error('엑셀 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsExportingLedger(false);
    }
  };

  const toggleLibrarySelection = (entryId: string) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const selectedLibraryEntries = assistantLibrary
    .filter((entry) => selectedLibraryIds.has(entry.id))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const libraryTypeLabel: Record<string, string> = {
    timeline: '타임라인',
    plant: '식물탐정',
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
      
      console.log('=== 병합 디버깅 ===');
      console.log('1. 전체 기록 수:', records.length, '개');
      
      const dateFiltered = records.filter(record => {
        return record.date >= startDate && record.date <= endDate;
      });
      
      console.log('2. 날짜 필터링 후:', dateFiltered.length, '개');
      console.log('   날짜 범위:', startDate, '~', endDate);

      const formatPrefix = FORMAT_PREFIX[selectedFormat];
      
      // ✅ 수정: formats 배열 대신 실제 SAYU 존재 여부로 필터링
      const formatFiltered = dateFiltered.filter(record => {
        const sayuKey = `${formatPrefix}_sayu`;
        return record[sayuKey] && record[sayuKey].trim().length > 0;
      });
      
      console.log('3. 형식 필터링 후 (SAYU 존재):', formatFiltered.length, '개');
      console.log('   선택 형식:', selectedFormat);

      const ratingKey = `${formatPrefix}_rating`;
      const starFiltered = formatFiltered.filter(record => {
        if (mergeFilter === 'all') return true;
        // 'special': rating > 0 인 기록만 (특별한 날 체크된 것)
        const rating = record[ratingKey];
        return rating !== undefined && rating !== null && rating > 0;
      });
      
      console.log('4. 최종 병합 대상:', starFiltered.length, '개');
      console.log('================');

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
          filter: mergeFilter,
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-3" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      <style>{`
        .library-print-area { display: none; }
        @media print {
          .merge-screen-area { display: none !important; }
          .library-print-area {
            display: block !important;
            background: #fff !important;
            color: #111827 !important;
            padding: 24px !important;
          }
          .library-print-card {
            break-inside: avoid;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
          }
        }
      `}</style>
      <div className="library-print-area">
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>비서 합본</h1>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>
          비서 library 인덱스 기준
        </p>
        {selectedLibraryEntries.map((entry) => (
          <article key={entry.id} className="library-print-card">
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
              {entry.date} · {libraryTypeLabel[entry.type] || entry.type}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
              {entry.title}
            </h2>
            {entry.summary && (
              <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                {entry.summary}
              </p>
            )}
          </article>
        ))}
      </div>
      <div className="merge-screen-area">
      <PageHeaderActions onClose={() => navigate(getOrigin() || '/sayu')} />
      <div className="flex items-center">
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
        <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
          <div>
            <span style={{ fontSize: '13px', color: '#1A3C6E', fontWeight: 600 }}>
              🗂 비서 합본
            </span>
            <p className="text-xs mt-1" style={{ color: '#999' }}>
              타임라인·식물탐정을 선택해 날짜순 카드로 출력합니다
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}>
            파일럿
          </span>
        </div>

        <div className="px-3 pb-3">
          {assistantLibraryLoading ? (
            <p className="text-sm py-3" style={{ color: '#999' }}>비서 합본 목록을 불러오는 중...</p>
          ) : assistantLibrary.length === 0 ? (
            <p className="text-sm py-3" style={{ color: '#999' }}>아직 인덱싱된 비서 기록이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {assistantLibrary.map((entry) => {
                const isSelected = selectedLibraryIds.has(entry.id);
                return (
                  <label
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg p-3 cursor-pointer"
                    style={{
                      border: `1px solid ${isSelected ? '#1A3C6E' : '#e5e5e5'}`,
                      backgroundColor: isSelected ? '#FDF6C3' : '#FEFBE8',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleLibrarySelection(entry.id)}
                      style={{ marginTop: 3 }}
                    />
                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E' }}>
                          {entry.title}
                        </span>
                        <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>
                          {entry.date}
                        </span>
                      </span>
                      <span style={{ display: 'block', fontSize: 11, color: '#666', marginTop: 4 }}>
                        {libraryTypeLabel[entry.type] || entry.type} · {entry.summary || '요약 없음'}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            disabled={selectedLibraryEntries.length === 0}
            className="w-full mt-3 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#1A3C6E',
              color: '#FAF9F6',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            선택한 비서 합본 인쇄
          </button>
        </div>
      </section>

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
                  backgroundColor: selectedCategory === category ? '#1A3C6E' : '#FEFBE8',
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
              {CATEGORY_FORMATS[selectedCategory].map((format) => {
                const isSelected = selectedFormat === format;
                return (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className="py-2 px-3 rounded-lg text-sm transition-all"
                    style={{
                      backgroundColor: isSelected ? '#1A3C6E' : '#FEFBE8',
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
            ✨ 병합 기준 선택
          </span>
          <span className="text-xs" style={{ color: '#999' }}>
            — 포함할 기록을 선택하세요
          </span>
        </div>
        <div className="grid grid-cols-2 gap-0 px-3 pb-3">
          {([
            { id: 'all', label: '📄 전체 기록', desc: '모든 기록 포함' },
            { id: 'special', label: '✨ 특별한 날만', desc: '특별한 날 체크된 기록만' },
          ] as { id: MergeFilter; label: string; desc: string }[]).map((opt, index) => {
            const isSelected = mergeFilter === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setMergeFilter(opt.id)}
                className="py-3 transition-all text-center"
                style={{
                  backgroundColor: isSelected ? '#1A3C6E' : '#FEFBE8',
                  color: isSelected ? '#FAF9F6' : '#333',
                  border: `1px solid ${isSelected ? '#1A3C6E' : '#e5e5e5'}`,
                  borderRadius: index === 0 ? '6px 0 0 6px' : '0 6px 6px 0',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <div style={{ fontSize: '13px' }}>{opt.label}</div>
                <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.8 }}>{opt.desc}</div>
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
            const isPremiumRequired = ['monthly', 'quarterly', 'yearly', 'custom'].includes(option.id);
            const isLocked = isPremiumRequired && !isPremium;
            return (
              <button
                key={option.id}
                onClick={() => {
                  if (isLocked) {
                    alert('PREMIUM 구독 후 이용 가능한 기능입니다.\n월 5,000원으로 시작해 보세요!');
                    window.location.href = '/subscription';
                    return;
                  }
                  handlePeriodSelect(option.id);
                }}
                className="py-3 transition-all text-center"
                style={{
                  backgroundColor: isSelected ? '#FDF6C3' : '#FEFBE8',
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
                  opacity: isLocked ? 0.7 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    color: isSelected ? '#1A3C6E' : '#333',
                    marginBottom: '3px',
                  }}
                >
                  {option.title}{isLocked && ' 🔒'}
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

      {/* 📒 HARU보조장부 전용 — 엑셀 저장 (보조장부 선택 시에만 노출) */}
      {selectedFormat === 'HARU보조장부' && (
        <section
          className="bg-white rounded-lg shadow-sm overflow-hidden"
          style={{ border: '1px solid #e5e5e5' }}
        >
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            <span style={{ fontSize: '13px', color: '#1A3C6E', fontWeight: 600 }}>
              🧾 보조장부 엑셀 저장
            </span>
            <span className="text-xs" style={{ color: '#999' }}>
              — 기간을 선택해 .xlsx 파일로 내려받기
            </span>
          </div>

          <div className="grid grid-cols-4 gap-0 px-3">
            {([
              { id: 'today',     label: '오늘' },
              { id: 'thisWeek',  label: '이번주' },
              { id: 'thisMonth', label: '이번달' },
              { id: 'all',       label: '전체' },
            ] as { id: LedgerPeriod; label: string }[]).map((opt, index, arr) => {
              const isSelected = ledgerPeriod === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setLedgerPeriod(opt.id)}
                  className="py-2 text-center transition-all"
                  style={{
                    backgroundColor: isSelected ? '#1A3C6E' : '#FEFBE8',
                    color: isSelected ? '#FAF9F6' : '#333',
                    border: `1px solid ${isSelected ? '#1A3C6E' : '#e5e5e5'}`,
                    borderRadius:
                      index === 0
                        ? '6px 0 0 6px'
                        : index === arr.length - 1
                        ? '0 6px 6px 0'
                        : '0',
                    fontSize: '13px',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="px-3 pt-3 pb-2">
            <button
              onClick={handleExportLedger}
              disabled={isExportingLedger}
              className="w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 shadow-sm"
              style={{
                backgroundColor: '#10b981',
                color: '#FAF9F6',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExportingLedger ? '저장 중...' : '보조장부 엑셀 저장'}</span>
            </button>
          </div>

          <p
            className="px-4 pb-3"
            style={{ fontSize: '11px', color: '#6B7280', lineHeight: 1.6 }}
          >
            HARU보조장부는 기록 보조 기능입니다.<br />
            최종 장부 및 세무 신고는 사용자 또는 세무 전문가의 확인이 필요합니다.
          </p>
        </section>
      )}
      </div>
    </div>
  );
}
