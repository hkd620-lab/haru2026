import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { SayuTitleAnimation } from '../components/SayuTitleAnimation';
import { toast } from 'sonner';
import { SayuModal } from '../components/SayuModal';
import { CATEGORY_FORMATS, FORMAT_PREFIX, FORMAT_EMOJI } from '../types/haruTypes';
import type { RecordFormat } from '../types/haruTypes';
import { AiLibraryPage } from './AiLibraryPage';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';

// 목록 뷰에서 제목으로 쓸 첫 번째 필드 키
const FORMAT_FIRST_FIELD: Record<string, string> = {
  diary: 'diary_action',
  essay: 'essay_observation',
  mission: 'mission_place',
  report: 'report_activity',
  work: 'work_schedule',
  travel: 'travel_journey',
  garden: 'garden_crop',
  pet: 'pet_name',
  child: 'child_name',
  memo: 'memo_title',
};

export function SayuPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDateFormats, setSelectedDateFormats] = useState<{ key: string; label: string; recordId?: string }[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set(['생활', '업무', 'HARUraw']));
  const [expandedFormats, setExpandedFormats] = useState<Set<string>>(new Set());
  const [sayuModalState, setSayuModalState] = useState<{
    isOpen: boolean;
    content: string;
    originalData?: Record<string, string>;
    format?: string;
    formatKey?: string;
    firestoreId?: string;
    dateLabel: string;
    currentRating?: number;
    recordDate?: string;
    weather?: string;
    temperature?: string;
    mood?: string;
    images?: string[];
  }>({
    isOpen: false,
    content: '',
    dateLabel: '',
  });

  const [harurawModal, setHarurawModal] = useState<{
    isOpen: boolean;
    query: string;
    summary: string;
    articles: string;
  }>({ isOpen: false, query: '', summary: '', articles: '' });

  const [showSayuGuide, setShowSayuGuide] = useState(() => {
    try {
      const saved = localStorage.getItem('haru_sayu_guide_visible');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  type SayuTab = '기록' | 'AI대화' | '읽을거리';
  const [activeTab, setActiveTab] = useState<SayuTab>('기록');

  interface BookChapter {
    bookId: string;
    bookTitle: string;
    chapterId: string;
    chapterTitle: string;
    sourceTitle: string;
    content: string;
    order: number;
  }
  const [bookChapters, setBookChapters] = useState<BookChapter[]>([]);
  const [bookChaptersLoading, setBookChaptersLoading] = useState(false);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [user?.uid, currentMonth]);

  useEffect(() => {
    if (activeTab !== '읽을거리') return;
    setBookChaptersLoading(true);
    (async () => {
      try {
        const booksSnap = await getDocs(collection(db, 'books'));
        const chapters: BookChapter[] = [];
        for (const bookDoc of booksSnap.docs) {
          const bookData = bookDoc.data();
          const chaptersSnap = await getDocs(
            query(collection(db, 'books', bookDoc.id, 'chapters'), orderBy('order'))
          );
          chaptersSnap.docs.forEach((chDoc) => {
            const ch = chDoc.data();
            chapters.push({
              bookId: bookDoc.id,
              bookTitle: bookData.title || '제목 없음',
              chapterId: chDoc.id,
              chapterTitle: ch.title || '',
              sourceTitle: ch.sourceTitle || '',
              content: ch.content || '',
              order: ch.order ?? 0,
            });
          });
        }
        setBookChapters(chapters);
      } catch (e) {
        console.error('읽을거리 불러오기 실패:', e);
      } finally {
        setBookChaptersLoading(false);
      }
    })();
  }, [activeTab]);

  useEffect(() => {
    setCollapsedCategories(new Set(['생활', '업무', 'HARUraw']));
    setExpandedFormats(new Set());
  }, [location.pathname]);

  const toggleSayuGuide = () => {
    const newValue = !showSayuGuide;
    setShowSayuGuide(newValue);
    try {
      localStorage.setItem('haru_sayu_guide_visible', String(newValue));
    } catch { /* ignore */ }
  };

  const fetchRecords = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await firestoreService.getRecords(user.uid);
      setRecords(data);
    } catch (error) {
      console.error('기록 불러오기 실패:', error);
      toast.error('기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const monthName = currentMonth.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  });

  const today = new Date();
  const isNextMonthDisabled =
    currentMonth.getFullYear() > today.getFullYear() ||
    (currentMonth.getFullYear() === today.getFullYear() &&
      currentMonth.getMonth() >= today.getMonth());

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate('');
    setSelectedDateFormats([]);
  };

  const handleNextMonth = () => {
    if (isNextMonthDisabled) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate('');
    setSelectedDateFormats([]);
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth();

  // 모든 형식 prefix 매핑 (수정 4: 메모 추가)
  const ALL_FORMAT_PREFIXES: Record<string, string> = {
    '일기': 'diary', '에세이': 'essay', '선교보고': 'mission',
    '일반보고': 'report', '업무일지': 'work', '여행기록': 'travel',
    '텃밭일지': 'garden', '애완동물관찰일지': 'pet', '육아일기': 'child',
    '메모': 'memo',
  };

  const META_SUFFIXES = ['_sayu', '_polished', '_polishedAt', '_mode', '_stats', '_images', '_rating'];

  const hasSayu = (date: Date | null): 'none' | 'saved' | 'polished' | 'written' => {
    if (!date) return 'none';
    const dateStr = formatDateString(date);
    // 수정 7: 같은 날 여러 기록 지원 — filter로 모두 확인
    const dayRecords = records.filter((r) => r.date === dateStr);
    if (dayRecords.length === 0) return 'none';

    let hasAnyPolished = false;
    let hasAnySaved = false;
    let hasAnyWritten = false;

    dayRecords.forEach((record) => {
      if (!record.formats || record.formats.length === 0) return;
      record.formats.forEach((format) => {
        const prefix = ALL_FORMAT_PREFIXES[format];
        if (!prefix) return;
        const sayuKey = `${prefix}_sayu`;
        const polishedKey = `${prefix}_polished`;
        if (record[polishedKey] === true) hasAnyPolished = true;
        if (record[sayuKey]) hasAnySaved = true;
        // 수정 3: 원본 저장도 점 표시
        if (!hasAnyWritten) {
          hasAnyWritten = Object.keys(record).some(k =>
            k.startsWith(`${prefix}_`) &&
            !META_SUFFIXES.some(s => k.endsWith(s)) &&
            typeof record[k] === 'string' && (record[k] as string).trim().length > 0
          );
        }
      });
    });

    if (hasAnyPolished) return 'polished';
    if (hasAnySaved) return 'saved';
    if (hasAnyWritten) return 'written';
    return 'none';
  };

  const handleDateClick = (date: Date | null) => {
    if (!date) return;
    const dateStr = formatDateString(date);
    // 수정 7: 같은 날 여러 기록 지원
    const dayRecords = records.filter((r) => r.date === dateStr);

    if (dayRecords.length === 0) {
      toast.info('해당 날짜에 기록이 없습니다.');
      return;
    }

    setSelectedDate(dateStr);

    // 수정 3,4: 모든 형식 표시 (SAYU 없는 원본 포함, 메모 포함)
    const seenFormatKeys = new Set<string>();
    const availableFormats: { key: string; label: string; recordId: string }[] = [];
    dayRecords.forEach((record) => {
      if (!record.formats) return;
      record.formats.forEach((format) => {
        const prefix = ALL_FORMAT_PREFIXES[format];
        if (!prefix) return;
        // 같은 날 같은 형식 여러 개: recordId로 구분
        const entryKey = `${prefix}_${record.id}`;
        if (!seenFormatKeys.has(entryKey)) {
          seenFormatKeys.add(entryKey);
          availableFormats.push({ key: prefix, label: format, recordId: record.id });
        }
      });
    });

    setSelectedDateFormats(availableFormats);
  };

  const openFormatSayu = (dateStr: string, formatKey: string, formatLabel: string, recordId?: string) => {
    // 수정 7: recordId로 특정 기록 찾기, 없으면 날짜로 첫 번째 찾기
    const record = recordId
      ? records.find((r) => r.id === recordId)
      : records.find((r) => r.date === dateStr);
    if (!record) return;

    // HARUraw 처리
    if (formatKey === 'haruraw') {
      setHarurawModal({
        isOpen: true,
        query: (record as any).haruraw_query || '',
        summary: (record as any).haruraw_summary || '',
        articles: (record as any).haruraw_articles || '',
      });
      return;
    }

    setSelectedDate(dateStr);
    setSelectedDateFormats([{ key: formatKey, label: formatLabel, recordId: record.id }]);

    const sayuKey = `${formatKey}_sayu`;
    const ratingKey = `${formatKey}_rating`;
    const imagesKey = `${formatKey}_images`;

    const sayuRating = record[ratingKey] || 0;

    const originalData: Record<string, string> = {};
    Object.keys(record).forEach((key) => {
      if (
        key.startsWith(`${formatKey}_`) &&
        !key.includes('sayu') &&
        !key.includes('rating') &&
        !key.includes('polished') &&
        !key.includes('images')
      ) {
        originalData[key] = record[key];
      }
    });

    // 수정 3: SAYU 없으면 원본 필드를 이어붙여 표시
    let sayuContent = record[sayuKey] || '';
    if (!sayuContent) {
      const originalFields = Object.keys(record)
        .filter(k =>
          k.startsWith(`${formatKey}_`) &&
          !META_SUFFIXES.some(s => k.endsWith(s)) &&
          typeof record[k] === 'string' && (record[k] as string).trim()
        )
        .map(k => record[k] as string);
      sayuContent = originalFields.length > 0 ? originalFields.join('\n\n') : '내용 없음';
    }

    let images: string[] = [];
    const imagesData = record[imagesKey];
    if (imagesData) {
      try {
        const parsed = JSON.parse(imagesData);
        if (Array.isArray(parsed)) {
          images = parsed.filter(
            (url: any) =>
              typeof url === 'string' &&
              url.trim().length > 0 &&
              url.startsWith('http')
          );
        }
      } catch {
        images = [];
      }
    }

    setSayuModalState({
      isOpen: true,
      content: sayuContent,
      originalData,
      format: formatLabel,
      formatKey,
      firestoreId: record.id,
      dateLabel: new Date(dateStr + 'T00:00:00').toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
      }),
      currentRating: sayuRating,
      recordDate: dateStr,
      weather: record.weather,
      temperature: record.temperature,
      mood: record.mood,
      images,
    });
  };

  const handleFormatClick = (formatKey: string, formatLabel: string, recordId?: string) => {
    if (!selectedDate) return;
    openFormatSayu(selectedDate, formatKey, formatLabel, recordId);
  };

  const handleModalClose = async (deleted?: boolean) => {
    setSayuModalState({
      isOpen: false,
      content: '',
      dateLabel: '',
    });

    // 항상 records 새로고침 (사진 추가/삭제/환경변경 반영)
    const currentDate = selectedDate;
    setLoading(true);
    try {
      const data = await firestoreService.getRecords(user!.uid);
      setRecords(data);

      if (deleted) {
        const dayRecords = data.filter((r) => r.date === currentDate);
        if (dayRecords.length === 0) {
          setSelectedDate('');
          setSelectedDateFormats([]);
        } else {
          const seenFormatKeys = new Set<string>();
          const availableFormats: { key: string; label: string; recordId?: string }[] = [];
          dayRecords.forEach((record) => {
            if (!record.formats) return;
            record.formats.forEach((format) => {
              const prefix = ALL_FORMAT_PREFIXES[format];
              if (!prefix) return;
              const entryKey = `${prefix}_${record.id}`;
              if (!seenFormatKeys.has(entryKey)) {
                seenFormatKeys.add(entryKey);
                availableFormats.push({ key: prefix, label: format, recordId: record.id });
              }
            });
          });
          setSelectedDate(currentDate);
          setSelectedDateFormats(availableFormats);
        }
      }
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSayu = async (editedContent: string, rating: number) => {
    if (!selectedDate) return;
    // 수정 7: recordId로 특정 기록 찾기
    const currentFormatInfo = selectedDateFormats[0];
    const record = currentFormatInfo?.recordId
      ? records.find((r) => r.id === currentFormatInfo.recordId)
      : records.find((r) => r.date === selectedDate);
    if (!record) return;

    const formatKey = currentFormatInfo?.key || selectedDateFormats.find((f) => record[`${f.key}_sayu`])?.key;
    if (!formatKey) return;

    const sayuKey = `${formatKey}_sayu`;
    const ratingKey = `${formatKey}_rating`;

    try {
      // 수정 7: record.id로 업데이트 (날짜 기반이 아닌 실제 문서 ID)
      await firestoreService.updateRecord(user!.uid, record.id, {
        [sayuKey]: editedContent,
        [ratingKey]: rating,
      });

      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? { ...r, [sayuKey]: editedContent, [ratingKey]: rating }
            : r
        )
      );

      toast.success('SAYU가 저장되었습니다!');
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('저장에 실패했습니다.');
    }
  };

  // ─── 목록 뷰 데이터 생성 ───
  const getMonthListData = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;

    const monthRecords = records.filter((r) => {
      const [y, m] = r.date.split('-').map(Number);
      return y === year && m === month;
    });

    type ListCategory = {
      category: string;
      formats: {
        format: RecordFormat;
        entries: { date: string; title: string; hasSayu: boolean; formatKey: string; recordId: string }[];
      }[];
    };

    const result: ListCategory[] = [];

    // HARUraw 카테고리 별도 처리
    const harurawEntries = monthRecords
      .filter((r) => r.formats && r.formats.includes('HARUraw' as any))
      .map((r) => ({
        date: r.date,
        title: ((r as any).haruraw_query || '').slice(0, 20) || '(질문 없음)',
        hasSayu: false,
        formatKey: 'haruraw',
        recordId: r.id,
      }));

    if (harurawEntries.length > 0) {
      result.push({
        category: 'HARUraw',
        formats: [{
          format: 'HARUraw' as any,
          entries: harurawEntries,
        }],
      });
    }

    for (const category of ['생활', '업무'] as const) {
      const formatsWithEntries: ListCategory['formats'] = [];

      for (const format of CATEGORY_FORMATS[category]) {
        const prefix = FORMAT_PREFIX[format];
        const entries = monthRecords
          .filter((r) => {
            if (r.formats && r.formats.includes(format)) return true;
            // formats 배열이 없거나 누락된 경우 field prefix로 폴백
            return Object.keys(r).some((k) => k.startsWith(`${prefix}_`) && !k.endsWith('_sayu') && !k.endsWith('_rating') && !k.endsWith('_polished') && !k.endsWith('_images') && !k.endsWith('_stats'));
          })
          .map((r) => {
            const firstFieldKey = FORMAT_FIRST_FIELD[prefix];
            // AI 추출 제목 우선 (숫자·기호만인 잘못된 제목은 무시), 없으면 첫 번째 필드 내용 사용
            const aiTitle = r[`${prefix}_title`] as string | undefined;
            const validAiTitle = aiTitle && !/^[\d\s:.,\-\/]+$/.test(aiTitle.trim()) && aiTitle.trim().length >= 2 ? aiTitle : '';
            let rawTitle = validAiTitle || (firstFieldKey ? (r[firstFieldKey] || '') : '');
            // 첫 번째 필드도 비어있으면 같은 prefix의 다른 필드에서 폴백 (태그/여백 제외)
            if (!rawTitle) {
              const fallbackKey = Object.keys(r).find(
                (k) => k.startsWith(`${prefix}_`) && !k.endsWith('_sayu') && !k.endsWith('_rating') && !k.endsWith('_polished') && !k.endsWith('_images') && !k.endsWith('_stats') && !k.endsWith('_tags') && !k.endsWith('_space') && !k.endsWith('_title') && typeof r[k] === 'string' && r[k].trim()
              );
              rawTitle = fallbackKey ? r[fallbackKey] : '';
            }
            const title = rawTitle.slice(0, 20) || '(내용 없음)';
            return {
              date: r.date,
              title,
              hasSayu: !!r[`${prefix}_sayu`],
              formatKey: prefix,
              recordId: r.id,
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date));

        if (entries.length > 0) {
          formatsWithEntries.push({ format, entries });
        }
      }

      if (formatsWithEntries.length > 0) {
        result.push({ category, formats: formatsWithEntries });
      }
    }

    return result;
  };

  const formatListDate = (dateStr: string): string => {
    const [, month, day] = dateStr.split('-').map(Number);
    return `${month}/${day}`;
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleFormat = (formatKey: string) => {
    setExpandedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(formatKey)) {
        next.delete(formatKey);
      } else {
        next.add(formatKey);
      }
      return next;
    });
  };

  const listData = getMonthListData();
  const hasMonthRecords = listData.length > 0;

  const printStyle = `
    @media print {
      * {
        background: transparent !important;
        background-color: transparent !important;
      }
      html, body, #root {
        background: white !important;
        background-color: white !important;
      }
      .sayu-print-page,
      .sayu-print-header,
      .sayu-print-content {
        background: white !important;
        background-color: white !important;
      }
    }
  `;

  return (
    <>
    <style>{printStyle}</style>
    <div className="sayu-page-container no-print max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      {/* 타이틀 + 가이드 */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <SayuTitleAnimation />
        </div>
        <p className="text-sm mb-2" style={{ color: '#666666' }}>
          작성한 기록을 AI가 다듬은 결과를 확인하세요
        </p>

        {/* 탭 */}
        <div className="flex gap-2 mb-3">
          {(['기록', 'AI대화', '읽을거리'] as SayuTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor: activeTab === tab ? '#1A3C6E' : '#FDF6C3',
                color: activeTab === tab ? '#FAF9F6' : '#1A3C6E',
                border: activeTab === tab ? 'none' : '1px solid #d0dff0',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div
          className="border-l-4 rounded transition-all"
          style={{
            backgroundColor: '#FDF6C3',
            borderColor: '#1A3C6E',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex items-center justify-between p-3 cursor-pointer transition-colors"
            onClick={toggleSayuGuide}
            style={{ backgroundColor: showSayuGuide ? 'transparent' : 'rgba(26, 60, 110, 0.05)' }}
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" style={{ color: '#1A3C6E' }} />
              <p className="text-xs font-semibold" style={{ color: '#1A3C6E', margin: 0 }}>
                사용 안내
              </p>
            </div>
            <div
              className="text-xs transition-transform"
              style={{
                color: '#1A3C6E',
                transform: showSayuGuide ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▼
            </div>
          </div>
          {showSayuGuide && (
            <div className="px-3 pb-3">
              <p className="text-xs leading-relaxed" style={{ color: '#1A3C6E' }}>
                💡 목록에서 기록을 클릭하거나, 달력에서 날짜를 선택해 SAYU를 확인하세요.
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#666' }}>
                초록 점: 원본 저장 / 파란 점: SAYU 저장 / 주황 점: 다듬기 완료
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── AI대화 탭 ─── */}
      {activeTab === 'AI대화' && (
        <div className="mt-2">
          <AiLibraryPage />
        </div>
      )}

      {/* ─── 읽을거리 탭 ─── */}
      {activeTab === '읽을거리' && (
        <div className="mt-2">
          {bookChaptersLoading ? (
            <p className="text-center py-8 text-sm" style={{ color: '#999' }}>불러오는 중...</p>
          ) : bookChapters.length === 0 ? (
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <p className="text-sm" style={{ color: '#999' }}>생성된 챕터가 없습니다</p>
            </div>
          ) : (
            (() => {
              const byBook: Record<string, { title: string; chapters: BookChapter[] }> = {};
              bookChapters.forEach((ch) => {
                if (!byBook[ch.bookId]) byBook[ch.bookId] = { title: ch.bookTitle, chapters: [] };
                byBook[ch.bookId].chapters.push(ch);
              });
              return Object.entries(byBook).map(([bookId, book]) => (
                <div key={bookId} className="mb-4">
                  <div
                    className="px-3 py-2 rounded-lg mb-1 text-sm font-semibold"
                    style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
                  >
                    📖 {book.title}
                  </div>
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {book.chapters.map((ch, idx) => (
                      <div
                        key={ch.chapterId}
                        className={idx > 0 ? 'border-t' : ''}
                        style={{ borderColor: '#f0f0f0' }}
                      >
                        <button
                          onClick={() => setExpandedChapterId(expandedChapterId === ch.chapterId ? null : ch.chapterId)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-yellow-50 transition-colors"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold" style={{ color: '#333' }}>
                              {ch.chapterTitle}
                            </span>
                            {ch.sourceTitle && (
                              <span className="text-xs" style={{ color: '#999' }}>{ch.sourceTitle}</span>
                            )}
                          </div>
                          <span style={{ fontSize: '10px', color: '#1A3C6E', flexShrink: 0 }}>
                            {expandedChapterId === ch.chapterId ? '▼' : '▶'}
                          </span>
                        </button>
                        {expandedChapterId === ch.chapterId && (
                          <div
                            className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border-t"
                            style={{ color: '#374151', borderColor: '#f0f0f0', backgroundColor: '#fafafa' }}
                          >
                            {ch.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      )}

      {/* ─── 기록 탭 ─── */}
      {activeTab === '기록' && <>{/* 공통 월 네비게이션 + 뷰 전환 */}
      <div className="bg-white rounded-lg p-3 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            style={{ color: '#1A3C6E' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold" style={{ color: '#1A3C6E' }}>
            {monthName}
          </h2>
          <button
            onClick={handleNextMonth}
            disabled={isNextMonthDisabled}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: '#1A3C6E' }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 뷰 전환 버튼 */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#1A3C6E' }}>
          <button
            onClick={() => setViewMode('list')}
            className="flex-1 py-1.5 text-sm font-medium transition-all"
            style={{
              backgroundColor: viewMode === 'list' ? '#1A3C6E' : 'transparent',
              color: viewMode === 'list' ? '#FAF9F6' : '#1A3C6E',
            }}
          >
            목록
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className="flex-1 py-1.5 text-sm font-medium transition-all"
            style={{
              backgroundColor: viewMode === 'calendar' ? '#1A3C6E' : 'transparent',
              color: viewMode === 'calendar' ? '#FAF9F6' : '#1A3C6E',
            }}
          >
            달력
          </button>
        </div>
      </div>

      {/* ─── 목록 뷰 ─── */}
      {viewMode === 'list' && (
        <div>
          {loading ? (
            <p className="text-center py-8 text-sm" style={{ color: '#999' }}>불러오는 중...</p>
          ) : !hasMonthRecords ? (
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <p className="text-sm" style={{ color: '#999' }}>이 달의 기록이 없습니다</p>
            </div>
          ) : (
            listData.map(({ category, formats }) => (
              <div key={category} className="mb-4">
                {/* 카테고리 헤더 */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
                >
                  <span>{category}</span>
                  <span style={{ fontSize: '10px' }}>
                    {collapsedCategories.has(category) ? '▶' : '▼'}
                  </span>
                </button>

                {!collapsedCategories.has(category) && (
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {formats.map(({ format, entries }, fIdx) => {
                      const prefix = FORMAT_PREFIX[format];
                      const isFormatExpanded = expandedFormats.has(prefix);
                      return (
                      <div
                        key={format}
                        className={fIdx > 0 ? 'border-t' : ''}
                        style={{ borderColor: '#f0f0f0' }}
                      >
                        {/* 형식 헤더 — 클릭 시 기록 목록 펼침/닫힘 */}
                        <button
                          onClick={() => toggleFormat(prefix)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: '#FEFBE8' }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{FORMAT_EMOJI[format]}</span>
                            <span className="text-xs font-semibold" style={{ color: '#333' }}>{format}</span>
                            <span className="text-xs" style={{ color: '#999' }}>({entries.length})</span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#1A3C6E' }}>
                            {isFormatExpanded ? '▼' : '▶'}
                          </span>
                        </button>

                        {/* 기록 목록 — 형식 펼쳤을 때만 표시 */}
                        {isFormatExpanded && entries.map((entry) => (
                          <button
                            key={`${entry.date}-${entry.formatKey}-${entry.recordId}`}
                            onClick={() => openFormatSayu(entry.date, entry.formatKey, format, entry.recordId)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-yellow-50 transition-colors border-t"
                            style={{ borderColor: '#f5f5f5' }}
                          >
                            <span
                              className="text-xs font-medium flex-shrink-0"
                              style={{ color: '#1A3C6E', minWidth: '32px' }}
                            >
                              {formatListDate(entry.date)}
                            </span>
                            <span
                              className="text-sm flex-1 truncate"
                              style={{ color: '#333' }}
                            >
                              {entry.title}
                            </span>
                            {entry.hasSayu && (
                              <span
                                className="rounded-full flex-shrink-0"
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  backgroundColor: '#10b981',
                                  display: 'inline-block',
                                }}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── 달력 뷰 ─── */}
      {viewMode === 'calendar' && (
        <div>
          <section className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                <div
                  key={idx}
                  className="text-center text-xs font-semibold py-2"
                  style={{ color: idx === 0 ? '#ef4444' : idx === 6 ? '#3b82f6' : '#666' }}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const isToday = day && formatDateString(day) === formatDateString(new Date());
                const isSelected = day && selectedDate === formatDateString(day);
                const sayuStatus = hasSayu(day);

                return (
                  <button
                    key={idx}
                    onClick={() => handleDateClick(day)}
                    disabled={!day}
                    className="relative aspect-square flex items-center justify-center rounded-lg transition-all disabled:cursor-default"
                    style={{
                      backgroundColor: isSelected
                        ? '#1A3C6E'
                        : isToday
                        ? '#FDF6C3'
                        : 'transparent',
                      color: isSelected
                        ? '#FEFBE8'
                        : isToday
                        ? '#1A3C6E'
                        : day
                        ? '#333'
                        : 'transparent',
                      fontSize: '13px',
                      fontWeight: isToday || isSelected ? 600 : 400,
                      cursor: day ? 'pointer' : 'default',
                      border: isToday && !isSelected ? '1.5px solid #1A3C6E' : 'none',
                    }}
                  >
                    {day && day.getDate()}
                    {sayuStatus === 'saved' && (
                      <div
                        className="absolute rounded-full"
                        style={{
                          bottom: '-2px',
                          left: '50%',
                          transform: 'translateX(calc(-50% + 2px))',
                          width: '8px',
                          height: '8px',
                          backgroundColor: isSelected ? '#FEFBE8' : '#1A3C6E',
                          boxShadow: isSelected ? 'none' : '0 0 0 1.5px rgba(26,60,110,0.25)',
                        }}
                      />
                    )}
                    {sayuStatus === 'polished' && (
                      <div
                        className="absolute rounded-full"
                        style={{
                          bottom: '-2px',
                          left: '50%',
                          transform: 'translateX(calc(-50% + 2px))',
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#F59E0B',
                          boxShadow: '0 0 0 1.5px rgba(245,158,11,0.3)',
                        }}
                      />
                    )}
                    {sayuStatus === 'written' && (
                      <div
                        className="absolute rounded-full"
                        style={{
                          bottom: '-2px',
                          left: '50%',
                          transform: 'translateX(calc(-50% + 2px))',
                          width: '8px',
                          height: '8px',
                          backgroundColor: isSelected ? '#FEFBE8' : '#10b981',
                          boxShadow: isSelected ? 'none' : '0 0 0 1.5px rgba(16,185,129,0.3)',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {selectedDate && selectedDateFormats.length > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs font-semibold mb-2" style={{ color: '#1A3C6E' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                })}의 기록
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedDateFormats.map((formatInfo, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleFormatClick(formatInfo.key, formatInfo.label, formatInfo.recordId)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80 hover:shadow-md cursor-pointer"
                    style={{
                      backgroundColor: '#FDF6C3',
                      color: '#1A3C6E',
                      border: '1px solid #1A3C6E',
                    }}
                  >
                    {formatInfo.label}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: '#999' }}>
                💡 형식을 클릭하면 해당 SAYU를 볼 수 있습니다
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 text-sm" style={{ color: '#999' }}>
            <div className="flex items-center gap-2">
              <div className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', backgroundColor: '#10b981', boxShadow: '0 0 0 1.5px rgba(16,185,129,0.3)' }} />
              <span>원본 저장</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', backgroundColor: '#1A3C6E', boxShadow: '0 0 0 1.5px rgba(26,60,110,0.25)' }} />
              <span>SAYU 저장</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', backgroundColor: '#F59E0B', boxShadow: '0 0 0 1.5px rgba(245,158,11,0.3)' }} />
              <span>다듬기 완료</span>
            </div>
          </div>
        </div>
      )}


      </>}

      <SayuModal
        isOpen={sayuModalState.isOpen}
        onClose={(deleted?: boolean) => handleModalClose(deleted)}
        content={sayuModalState.content}
        originalData={sayuModalState.originalData}
        format={sayuModalState.format}
        dateLabel={sayuModalState.dateLabel}
        currentRating={sayuModalState.currentRating}
        onSave={handleSaveSayu}
        recordDate={sayuModalState.recordDate}
        weather={sayuModalState.weather}
        temperature={sayuModalState.temperature}
        mood={sayuModalState.mood}
        images={sayuModalState.images}
        formatKey={sayuModalState.formatKey}
        firestoreId={sayuModalState.firestoreId}
        onRefresh={undefined}
      />
    </div>

    {/* 인쇄 전용 레이아웃 */}
    <div className="print-show sayu-print-page" style={{ backgroundColor: 'white' }}>
        <div className="sayu-print-header" style={{ backgroundColor: 'white' }}>
          <h2>
            {sayuModalState.recordDate && new Date(sayuModalState.recordDate + 'T00:00:00').toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {sayuModalState.currentRating && sayuModalState.currentRating > 0 && (
              <span style={{ fontSize: '10pt', padding: '4px 12px',
                borderRadius: '12px', backgroundColor: '#FFF8F0', color: '#F59E0B' }}>
                ✨ 특별한 날
              </span>
            )}
            {sayuModalState.weather && (
              <span style={{ fontSize: '9pt', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#FDF6C3', color: '#1A3C6E' }}>
                {sayuModalState.weather}
              </span>
            )}
            {sayuModalState.temperature && (
              <span style={{ fontSize: '9pt', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#FDF6C3', color: '#1A3C6E' }}>
                {sayuModalState.temperature}
              </span>
            )}
            {sayuModalState.mood && (
              <span style={{ fontSize: '9pt', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#FDF6C3', color: '#1A3C6E' }}>
                {sayuModalState.mood}
              </span>
            )}
          </div>
        </div>

        {(() => {
          const validImages = (sayuModalState.images || []).filter((img: string) => img && img !== '');
          if (validImages.length === 0) return null;
          return (
            <div className="print-photos" style={{ marginBottom: '15px', backgroundColor: 'white' }}>
              {validImages.length === 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: 'white' }}>
                  <img src={validImages[0]} alt="사진" style={{ width: 'auto', maxWidth: '63mm', maxHeight: '80mm', objectFit: 'contain', height: 'auto', borderRadius: '8px', backgroundColor: 'white' }} />
                </div>
              )}
              {validImages.length === 2 && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', backgroundColor: 'white' }}>
                  {validImages.map((img: string, idx: number) => (
                    <img key={idx} src={img} alt={`사진 ${idx + 1}`} style={{ width: 'auto', maxWidth: '60mm', maxHeight: '75mm', objectFit: 'contain', height: 'auto', borderRadius: '8px', backgroundColor: 'white' }} />
                  ))}
                </div>
              )}
              {validImages.length >= 3 && (
                <div style={{ backgroundColor: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', backgroundColor: 'white' }}>
                    <img src={validImages[0]} alt="사진 1" style={{ width: 'auto', maxWidth: '84mm', maxHeight: '65mm', objectFit: 'contain', height: 'auto', borderRadius: '8px', backgroundColor: 'white' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', backgroundColor: 'white' }}>
                    <img src={validImages[1]} alt="사진 2" style={{ width: 'auto', maxWidth: '38mm', maxHeight: '38mm', objectFit: 'contain', height: 'auto', borderRadius: '8px', backgroundColor: 'white' }} />
                    <img src={validImages[2]} alt="사진 3" style={{ width: 'auto', maxWidth: '38mm', maxHeight: '38mm', objectFit: 'contain', height: 'auto', borderRadius: '8px', backgroundColor: 'white' }} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <div className="sayu-print-content" style={{ backgroundColor: 'white' }}>
          <p>{sayuModalState.content}</p>
        </div>
      </div>

      {harurawModal.isOpen && (
        <div
          onClick={() => setHarurawModal({ isOpen: false, query: '', summary: '', articles: '' })}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000, display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxHeight: '80vh',
              backgroundColor: '#fff',
              borderRadius: '16px 16px 0 0',
              padding: 20, overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E' }}>⚖️ HARUraw 검색 기록</p>
              <button
                onClick={() => setHarurawModal({ isOpen: false, query: '', summary: '', articles: '' })}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}
              >✕</button>
            </div>

            <div style={{ padding: 12, backgroundColor: '#f0f4ff', borderRadius: 8, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>검색 질문</p>
              <p style={{ fontSize: 14, color: '#1A3C6E', fontWeight: 600 }}>{harurawModal.query}</p>
            </div>

            {harurawModal.summary && (
              <div style={{ padding: 12, backgroundColor: '#EEF4FF', border: '1px solid #c7d9f8', borderRadius: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>💡 AI 분석</p>
                <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>{harurawModal.summary}</p>
              </div>
            )}

            {harurawModal.articles && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>📋 관련 법조문</p>
                {harurawModal.articles.split('\n\n').map((article, i) => (
                  <div key={i} style={{ padding: 12, backgroundColor: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 8, marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{article}</p>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 8 }}>
              본 내용은 법령 정보 제공 목적이며, 전문적인 법률 자문을 대체할 수 없습니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
