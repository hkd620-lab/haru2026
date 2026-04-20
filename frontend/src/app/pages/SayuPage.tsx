import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Info, Leaf, Briefcase, BookOpen, Scale, Cpu, Volume2, Pause } from 'lucide-react';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { SayuTitleAnimation } from '../components/SayuTitleAnimation';
import { toast } from 'sonner';
import { SayuModal } from '../components/SayuModal';
import { CATEGORY_FORMATS, FORMAT_PREFIX, FORMAT_EMOJI } from '../types/haruTypes';
import type { RecordFormat } from '../types/haruTypes';
import { collection, getDocs, orderBy, query, deleteDoc, doc, writeBatch } from 'firebase/firestore';
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

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const PAGE_SIZE = 10;

interface AiLog { id: string; title?: string; source?: string; createdAt?: string; [key: string]: any; }
interface Chapter { id: string; bookId: string; title: string; sourceTitle: string; content: string; order: number; }
interface Book { id: string; title: string; totalChapters: number; order?: number; chapters: Chapter[]; }

export function SayuPage() {
  const handleTTS = async (text: string, key: string) => {
    // 재생 중이면 정지
    if (ttsPlaying === key) {
      audioRef.current?.pause();
      setTtsPlaying(null);
      return;
    }

    setTtsLoading(key);
    try {
      // 마크다운 제거한 순수 텍스트
      const cleanText = text
        .replace(/#{1,3}\s*/g, '')
        .replace(/\*\*/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .slice(0, 3000); // 최대 3000자

      const cacheKey = key.replace(/[^a-zA-Z0-9가-힣]/g, '_').slice(0, 80);

      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'generateTTS');
      const res: any = await fn({ text: cleanText, cacheKey });

      if (res.data.audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        try {
          await new Promise<void>((resolve, reject) => {
            const audio = new Audio(res.data.audioUrl);
            audio.onloadeddata = () => {
              audio.play().then(resolve).catch(reject);
            };
            audio.onerror = () => reject(new Error('오디오 로드 실패'));
            audio.onended = () => setTtsPlaying(null);
            audioRef.current = audio;
            audio.load();
          });
          setTtsPlaying(key);
        } catch (err) {
          console.error('TTS 재생 오류:', err);
          toast.error('음성 재생에 실패했습니다.');
          setTtsPlaying(null);
        }
      } else {
        console.error('TTS 응답에 audioUrl 없음:', res.data);
        toast.error('음성 데이터를 받지 못했습니다.');
      }
    } catch (err) {
      toast.error('음성 생성에 실패했습니다.');
    } finally {
      setTtsLoading(null);
    }
  };

  const renderStyledContent = (text: string) => {
  // AI 불필요한 서두 제거 (물론이죠, 안녕하세요 등)
  const skipPrefixes = ['물론이죠', '안녕하세요', '네,', '네.', '알겠습니다', '주어진 자료'];
  const lines = text.split('\n');
  const firstMeaningfulIdx = lines.findIndex(line => {
    const t = line.trim();
    if (!t) return false;
    return !skipPrefixes.some(prefix => t.startsWith(prefix));
  });
  const cleanedLines = firstMeaningfulIdx >= 0 ? lines.slice(firstMeaningfulIdx) : lines;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fdf6ff 0%, #f0f7ff 50%, #f6fff0 100%)',
      padding: '24px 24px 28px 24px',
      borderRadius: 8,
    }}>
      {/* 상단 장식 라인 */}
      <div style={{
        width: 40, height: 3,
        background: 'linear-gradient(90deg, #8B4789, #4a90d9)',
        borderRadius: 2, marginBottom: 20,
      }} />

      {cleanedLines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // 빈 줄
        if (!trimmed) return <div key={lineIdx} style={{ height: 10 }} />;

        // ### 소제목 (### 으로 시작)
        if (trimmed.startsWith('### ')) {
          const clean = trimmed.replace(/^###\s*/, '').replace(/\*\*/g, '');
          return (
            <p key={lineIdx} style={{
              fontSize: 13, fontWeight: 700, color: '#4a2d7a',
              marginBottom: 6, marginTop: lineIdx > 0 ? 16 : 0,
              lineHeight: 1.6,
            }}>{clean}</p>
          );
        }

        // ## 중제목
        if (trimmed.startsWith('## ')) {
          const clean = trimmed.replace(/^##\s*/, '').replace(/\*\*/g, '');
          return (
            <p key={lineIdx} style={{
              fontSize: 14, fontWeight: 800, color: '#2d1b4e',
              marginBottom: 8, marginTop: lineIdx > 0 ? 20 : 0,
              paddingLeft: 10, borderLeft: '3px solid #4a90d9',
              lineHeight: 1.5,
            }}>{clean}</p>
          );
        }

        // # 대제목
        if (trimmed.startsWith('# ')) {
          const clean = trimmed.replace(/^#\s*/, '').replace(/\*\*/g, '');
          return (
            <p key={lineIdx} style={{
              fontSize: 16, fontWeight: 900, color: '#1a0a2e',
              marginBottom: 10, marginTop: lineIdx > 0 ? 22 : 0,
              paddingLeft: 12, borderLeft: '4px solid #8B4789',
              lineHeight: 1.5,
            }}>{clean}</p>
          );
        }

        // **굵은 제목** (** 로 감싸인 줄 전체)
        if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
          const clean = trimmed.replace(/\*\*/g, '');
          return (
            <p key={lineIdx} style={{
              fontSize: 15, fontWeight: 800, color: '#2d1b4e',
              marginBottom: 10, marginTop: lineIdx > 0 ? 18 : 0,
              paddingLeft: 10, borderLeft: '3px solid #8B4789',
              lineHeight: 1.5,
            }}>{clean}</p>
          );
        }

        // 숫자 목록 (1. 2. 3.)
        if (/^\d+\./.test(trimmed)) {
          const clean = trimmed.replace(/\*\*/g, '');
          return (
            <p key={lineIdx} style={{
              fontSize: 13, fontWeight: 700, color: '#4a2d7a',
              marginBottom: 6, marginTop: 14, lineHeight: 1.6,
            }}>{clean}</p>
          );
        }

        // 이모지로 시작하는 줄 (⚖️ 📌 💡 ✅ ⚠️ 등) — 강조 처리
        if (/^[⚖️📌💡✅⚠️🔍📋]/.test(trimmed)) {
          const clean = trimmed.replace(/\*\*/g, '');
          return (
            <p key={lineIdx} style={{
              fontSize: 13, fontWeight: 600, color: '#2d1b4e',
              marginBottom: 8, marginTop: lineIdx > 0 ? 14 : 0,
              lineHeight: 1.7,
            }}>{clean}</p>
          );
        }

        // 일반 본문 (**인라인 볼드** 처리 포함)
        const clean = trimmed.replace(/\*\*/g, '');
        return (
          <p key={lineIdx} style={{
            fontSize: 13, color: '#3a3a4a',
            lineHeight: 1.9, marginBottom: 4,
            letterSpacing: '0.01em',
          }}>{clean}</p>
        );
      })}

      {/* 하단 장식 */}
      <div style={{
        marginTop: 24, textAlign: 'center' as const,
        fontSize: 16, color: '#c9b8e0', letterSpacing: 8,
      }}>✦ ✦ ✦</div>
    </div>
  );
};

  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDateFormats, setSelectedDateFormats] = useState<{ key: string; label: string; recordId?: string }[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set(['생활', '업무', '하루충전소', '하루LAW', '하루AI지식창고']));
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
    title?: string;
    aiTitle?: string;
  }>({
    isOpen: false,
    content: '',
    dateLabel: '',
    title: '',
    aiTitle: '',
  });

  const [showSayuGuide, setShowSayuGuide] = useState(() => {
    try {
      const saved = localStorage.getItem('haru_sayu_guide_visible');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const isDeveloper = user?.uid === DEVELOPER_UID;

  // HARUraw modal
  const [harurawModal, setHarurawModal] = useState<{ isOpen: boolean; query: string; summary: string; articles: string; }>({
    isOpen: false, query: '', summary: '', articles: '',
  });

  // 생활/업무 per-format pagination: maps "formatKey_categoryKey" -> page number
  const [formatPages, setFormatPages] = useState<Record<string, number>>({});
  // per-category search
  const [categorySearch, setCategorySearch] = useState<Record<string, string>>({});

  // AI지식모음
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const [aiLogsLoaded, setAiLogsLoaded] = useState(false);
  const [aiLogsLoading, setAiLogsLoading] = useState(false);
  const [aiSearch, setAiSearch] = useState('');
  const [aiPage, setAiPage] = useState(1);

  // 읽을거리
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [booksLoading, setBooksLoading] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [bookPage, setBookPage] = useState(1);
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(new Set());
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [draggingBookIdx, setDraggingBookIdx] = useState<number | null>(null);
  const [draggingChapterInfo, setDraggingChapterInfo] = useState<{ bookId: string; idx: number } | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [user?.uid, currentMonth]);

  useEffect(() => {
    setCollapsedCategories(new Set(['생활', '업무', '하루충전소', '하루LAW', '하루AI지식창고']));
    setExpandedFormats(new Set());
  }, [location.pathname]);

  // Fetch AI logs when AI지식모음 is expanded
  useEffect(() => {
    if (!collapsedCategories.has('하루AI지식창고') && !aiLogsLoaded && user?.email) {
      setAiLogsLoading(true);
      firestoreService.getAiLogs(user.email).then((data: any[]) => {
        setAiLogs(data);
        setAiLogsLoaded(true);
        setAiLogsLoading(false);
      }).catch(() => setAiLogsLoading(false));
    }
  }, [collapsedCategories, aiLogsLoaded, user?.email]);

  // Fetch books when 읽을거리 is expanded
  useEffect(() => {
    if (!collapsedCategories.has('하루충전소') && !booksLoaded) {
      setBooksLoading(true);
      (async () => {
        try {
          const booksSnap = await getDocs(query(collection(db, 'books'), orderBy('createdAt', 'desc')));
          const booksData: Book[] = [];
          for (const bookDoc of booksSnap.docs) {
            const bd = bookDoc.data();
            const chapSnap = await getDocs(query(collection(db, 'books', bookDoc.id, 'chapters'), orderBy('order')));
            const chapters: Chapter[] = chapSnap.docs.map(cd => ({
              id: cd.id, bookId: bookDoc.id,
              title: cd.data().title || '', sourceTitle: cd.data().sourceTitle || '',
              content: cd.data().content || '', order: cd.data().order ?? 0,
            }));
            booksData.push({
              id: bookDoc.id, title: bd.title || '(제목 없음)',
              totalChapters: bd.totalChapters ?? chapters.length,
              order: bd.order, chapters,
            });
          }
          setBooks(booksData);
          setBooksLoaded(true);
        } catch (e) { console.error('books fetch error:', e); }
        finally { setBooksLoading(false); }
      })();
    }
  }, [collapsedCategories, booksLoaded]);

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

  // 모든 형식 prefix 매핑
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
    const dayRecords = records.filter((r) => r.date === dateStr);

    if (dayRecords.length === 0) {
      toast.info('해당 날짜에 기록이 없습니다.');
      return;
    }

    setSelectedDate(dateStr);

    const seenFormatKeys = new Set<string>();
    const availableFormats: { key: string; label: string; recordId: string }[] = [];
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

    setSelectedDateFormats(availableFormats);
  };

  const openFormatSayu = (dateStr: string, formatKey: string, formatLabel: string, recordId?: string) => {
    const record = recordId
      ? records.find((r) => r.id === recordId)
      : records.find((r) => r.date === dateStr);
    if (!record) return;

    // HARUraw handling
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
      title: (record[`${formatKey}_title`] as string) || '',
      aiTitle: (record[`${formatKey}_ai_title`] as string) || '',
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

  // Delete a record from 생활/업무/HARUraw list
  const handleDeleteRecord = async (recordId: string) => {
    if (!user?.uid) return;
    try {
      await firestoreService.deleteRecord(user.uid, recordId);
      setRecords(prev => prev.filter(r => r.id !== recordId));
      toast.success('삭제되었습니다');
    } catch { toast.error('삭제 실패'); }
  };

  // Delete an AI log
  const handleDeleteAiLog = async (id: string) => {
    try {
      await firestoreService.deleteAiLogs(new Set([id]));
      setAiLogs(prev => prev.filter(l => l.id !== id));
      toast.success('삭제되었습니다');
    } catch { toast.error('삭제 실패'); }
  };

  // Delete a chapter (developer only)
  const handleDeleteChapter = async (bookId: string, chapterId: string) => {
    if (!isDeveloper) return;
    try {
      await deleteDoc(doc(db, 'books', bookId, 'chapters', chapterId));
      setBooks(prev => prev.map(b =>
        b.id === bookId ? { ...b, chapters: b.chapters.filter(c => c.id !== chapterId), totalChapters: b.chapters.length - 1 } : b
      ));
      toast.success('삭제되었습니다');
    } catch { toast.error('삭제 실패'); }
  };

  // Delete a book and all its chapters (developer only)
  const handleDeleteBook = async (bookId: string) => {
    if (!isDeveloper) return;
    try {
      const chapSnap = await getDocs(collection(db, 'books', bookId, 'chapters'));
      const batch = writeBatch(db);
      chapSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'books', bookId));
      await batch.commit();
      setBooks(prev => prev.filter(b => b.id !== bookId));
      toast.success('책이 삭제되었습니다');
    } catch { toast.error('삭제 실패'); }
  };

  // Update book order in Firestore
  const updateBookOrderInFirestore = async (newBooks: Book[]) => {
    const batch = writeBatch(db);
    newBooks.forEach((b, idx) => {
      batch.update(doc(db, 'books', b.id), { order: idx });
    });
    await batch.commit();
  };

  // Update chapter order in Firestore
  const updateChapterOrderInFirestore = async (bookId: string, chapters: Chapter[]) => {
    const batch = writeBatch(db);
    chapters.forEach((c, idx) => {
      batch.update(doc(db, 'books', bookId, 'chapters', c.id), { order: idx });
    });
    await batch.commit();
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
        format: RecordFormat | any;
        entries: { date: string; title: string; aiTitle?: string; hasSayu: boolean; formatKey: string; recordId: string }[];
      }[];
    };

    const result: ListCategory[] = [];

    // HARUraw
    const harurawEntries = monthRecords
      .filter(r => r.formats && r.formats.includes('HARUraw' as any))
      .map(r => ({
        date: r.date,
        title: ((r as any).haruraw_query || '').slice(0, 20) || '(질문 없음)',
        hasSayu: false,
        formatKey: 'haruraw',
        recordId: r.id,
      }));
    if (harurawEntries.length > 0) {
      result.push({ category: '하루LAW', formats: [{ format: 'HARUraw' as any, entries: harurawEntries }] });
    }

    for (const category of ['생활', '업무'] as const) {
      const formatsWithEntries: ListCategory['formats'] = [];

      for (const format of CATEGORY_FORMATS[category]) {
        const prefix = FORMAT_PREFIX[format];
        const entries = monthRecords
          .filter((r) => {
            if (r.formats && r.formats.includes(format)) return true;
            return Object.keys(r).some((k) => k.startsWith(`${prefix}_`) && !k.endsWith('_sayu') && !k.endsWith('_rating') && !k.endsWith('_polished') && !k.endsWith('_images') && !k.endsWith('_stats'));
          })
          .map((r) => {
            const firstFieldKey = FORMAT_FIRST_FIELD[prefix];
            const aiTitle = r[`${prefix}_ai_title`] as string | undefined;
            const validAiTitle = aiTitle && !/^[\d\s:.,\-\/]+$/.test(aiTitle.trim()) && aiTitle.trim().length >= 2 ? aiTitle : '';
            let rawTitle = (r[`${prefix}_title`] as string || '') || validAiTitle || (firstFieldKey ? (r[firstFieldKey] || '') : '');
            if (!rawTitle) {
              const fallbackKey = Object.keys(r).find(
                (k) => k.startsWith(`${prefix}_`) && !k.endsWith('_sayu') && !k.endsWith('_rating') && !k.endsWith('_polished') && !k.endsWith('_images') && !k.endsWith('_stats') && !k.endsWith('_tags') && !k.endsWith('_space') && !k.endsWith('_title') && typeof r[k] === 'string' && r[k].trim()
              );
              rawTitle = fallbackKey ? r[fallbackKey] : '';
            }
            const userTitle = (r[`${prefix}_title`] as string || '').slice(0, 20);
            const displayAiTitle = validAiTitle ? validAiTitle.slice(0, 20) : '';
            const title = userTitle || rawTitle.slice(0, 20) || '(내용 없음)';
            return {
              date: r.date,
              title,
              aiTitle: (displayAiTitle && displayAiTitle !== title) ? displayAiTitle : '',
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

      {/* 공통 월 네비게이션 + 뷰 전환 */}
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
            listData.map(({ category, formats }) => {
              if (category === '하루LAW') return null;
              return (
              <div key={category} className="mb-4">
                {/* 카테고리 헤더 */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {category === '생활' ? <><Leaf className="w-4 h-4" /> 생활</> : category === '업무' ? <><Briefcase className="w-4 h-4" /> 업무</> : category}
                  </span>
                  <span style={{ fontSize: '10px' }}>
                    {collapsedCategories.has(category) ? '▶' : '▼'}
                  </span>
                </button>

                {!collapsedCategories.has(category) && (
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {/* search */}
                    <div className="px-3 py-2" style={{ backgroundColor: '#f9fafb' }}>
                      <input
                        type="text"
                        value={categorySearch[category] || ''}
                        onChange={e => setCategorySearch(prev => ({ ...prev, [category]: e.target.value }))}
                        placeholder="제목으로 검색..."
                        className="w-full px-3 py-1.5 text-xs rounded border outline-none"
                        style={{ borderColor: '#d1d5db', backgroundColor: '#fff', fontSize: 14 }}
                      />
                    </div>
                    {formats.map(({ format, entries }, fIdx) => {
                      const prefix = category === '하루LAW' ? 'haruraw' : FORMAT_PREFIX[format as RecordFormat];
                      const isFormatExpanded = expandedFormats.has(prefix);

                      const searchTerm = (categorySearch[category] || '').toLowerCase();
                      const filteredEntries = searchTerm
                        ? entries.filter(e => e.title.toLowerCase().includes(searchTerm))
                        : entries;
                      const pageKey = `${prefix}_${category}`;
                      const page = formatPages[pageKey] || 1;
                      const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
                      const pagedEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

                      return (
                        <div
                          key={String(format)}
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
                              <span className="text-sm">{category === '하루LAW' ? '⚖️' : FORMAT_EMOJI[format as RecordFormat]}</span>
                              <span className="text-xs font-semibold" style={{ color: '#333' }}>{String(format)}</span>
                              <span className="text-xs" style={{ color: '#999' }}>({entries.length})</span>
                            </div>
                            <span style={{ fontSize: '10px', color: '#1A3C6E' }}>
                              {isFormatExpanded ? '▼' : '▶'}
                            </span>
                          </button>

                          {/* 기록 목록 — 형식 펼쳤을 때만 표시 */}
                          {isFormatExpanded && (
                            <>
                              {pagedEntries.map((entry) => (
                                <div key={`${entry.date}-${entry.formatKey}-${entry.recordId}`} className="w-full flex items-center gap-1 border-t" style={{ borderColor: '#f5f5f5' }}>
                                  <button
                                    className="flex items-center gap-3 flex-1 px-4 py-2.5 text-left hover:bg-yellow-50 transition-colors"
                                    onClick={() => openFormatSayu(entry.date, entry.formatKey, format as any, entry.recordId)}
                                  >
                                    <span className="text-xs font-medium flex-shrink-0" style={{ color: '#1A3C6E', minWidth: '32px' }}>{formatListDate(entry.date)}</span>
                                    <span className="text-sm flex-1" style={{ color: '#333', overflow: 'hidden' }}>
                                      <span className="truncate" style={{ display: 'inline' }}>{entry.title}</span>
                                      {entry.aiTitle && entry.aiTitle !== entry.title && (
                                        <span style={{ color: '#999', fontSize: 11, marginLeft: 4, whiteSpace: 'nowrap' }}>({entry.aiTitle})</span>
                                      )}
                                    </span>
                                    {entry.hasSayu && (
                                      <span className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', backgroundColor: '#10b981', display: 'inline-block' }} />
                                    )}
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteRecord(entry.recordId); }}
                                    className="px-3 py-2.5 text-xs flex-shrink-0 hover:text-red-600 transition-colors"
                                    style={{ color: '#ccc' }}
                                    title="삭제"
                                  >✕</button>
                                </div>
                              ))}
                              {totalPages > 1 && (
                                <div className="flex justify-center gap-1 py-2 px-3 border-t" style={{ borderColor: '#f0f0f0' }}>
                                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <button
                                      key={p}
                                      onClick={() => setFormatPages(prev => ({ ...prev, [pageKey]: p }))}
                                      className="w-7 h-7 rounded text-xs font-medium transition-all"
                                      style={{ backgroundColor: page === p ? '#1A3C6E' : '#f3f4f6', color: page === p ? '#fff' : '#333' }}
                                    >{p}</button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              );
            })
          )}

          {/* 구분선 */}
          <hr className="my-4" style={{ borderColor: '#d1d5db' }} />

          {/* 하루충전소 */}
          <div className="mb-4">
            <button
              onClick={() => toggleCategory('하루충전소')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
              style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen className="w-4 h-4" /> 하루충전소</span>
              <span style={{ fontSize: '10px' }}>{collapsedCategories.has('하루충전소') ? '▶' : '▼'}</span>
            </button>
            {!collapsedCategories.has('하루충전소') && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* 개발자 전용: 사람속으로 / 나도작가 버튼 */}
                {isDeveloper && (
                  <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <button
                      onClick={() => navigate('/book-studio')}
                      style={{
                        flex: 1, padding: '10px',
                        borderRadius: 10, border: 'none',
                        backgroundColor: '#1A3C6E', color: '#fff',
                        fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      📖 사람속으로
                    </button>
                    <button
                      onClick={() => navigate('/novel-studio')}
                      style={{
                        flex: 1, padding: '10px',
                        borderRadius: 10,
                        border: '1.5px solid #10b981',
                        backgroundColor: 'transparent', color: '#10b981',
                        fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      ✍️ 나도작가
                    </button>
                  </div>
                )}
                {/* search */}
                <div className="px-3 py-2" style={{ backgroundColor: '#f9fafb' }}>
                  <input type="text" value={bookSearch} onChange={e => { setBookSearch(e.target.value); setBookPage(1); }}
                    placeholder="책 제목으로 검색..." className="w-full px-3 py-1.5 text-xs rounded border outline-none"
                    style={{ borderColor: '#d1d5db', backgroundColor: '#fff', fontSize: 14 }} />
                </div>
                {booksLoading ? (
                  <p className="text-center py-4 text-xs" style={{ color: '#999' }}>불러오는 중...</p>
                ) : (() => {
                  const filtered = bookSearch ? books.filter(b => b.title.toLowerCase().includes(bookSearch.toLowerCase())) : books;
                  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                  const paged = filtered.slice((bookPage - 1) * PAGE_SIZE, bookPage * PAGE_SIZE);
                  if (filtered.length === 0) return <p className="text-center py-4 text-xs" style={{ color: '#999' }}>책이 없습니다</p>;
                  return (
                    <>
                      {paged.map((book, bookDisplayIdx) => {
                        const actualIdx = books.findIndex(b => b.id === book.id);
                        const isExpanded = expandedBookIds.has(book.id);
                        return (
                          <div key={book.id}
                            className={bookDisplayIdx > 0 ? 'border-t' : ''}
                            style={{ borderColor: '#f0f0f0' }}
                            draggable={isDeveloper}
                            onDragStart={isDeveloper ? () => setDraggingBookIdx(actualIdx) : undefined}
                            onDragOver={isDeveloper ? (e) => e.preventDefault() : undefined}
                            onDrop={isDeveloper ? () => {
                              if (draggingBookIdx === null || draggingBookIdx === actualIdx) return;
                              const newBooks = [...books];
                              const [moved] = newBooks.splice(draggingBookIdx, 1);
                              newBooks.splice(actualIdx, 0, moved);
                              setBooks(newBooks);
                              setDraggingBookIdx(null);
                              updateBookOrderInFirestore(newBooks).catch(console.error);
                            } : undefined}
                          >
                            <div className="flex items-center px-3 py-2.5">
                              {isDeveloper && <span className="text-gray-300 mr-2 cursor-grab select-none text-sm">☰</span>}
                              <button
                                className="flex-1 flex items-center justify-between text-left"
                                onClick={() => setExpandedBookIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(book.id)) next.delete(book.id); else next.add(book.id);
                                  return next;
                                })}
                              >
                                <div>
                                  <p className="text-xs font-semibold" style={{ color: '#333' }}>{book.title}</p>
                                  <p className="text-xs mt-0.5" style={{ color: '#999' }}>챕터 {book.totalChapters}개</p>
                                </div>
                                <span style={{ fontSize: '10px', color: '#1A3C6E' }}>{isExpanded ? '▼' : '▶'}</span>
                              </button>
                              {isDeveloper && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteBook(book.id); }}
                                  className="ml-2 text-xs flex-shrink-0 hover:text-red-600 transition-colors"
                                  style={{ color: '#ccc' }}
                                  title="책 삭제"
                                >✕</button>
                              )}
                            </div>
                            {isExpanded && (
                              <div className="border-t" style={{ borderColor: '#f0f0f0' }}>
                                {book.chapters.length === 0 ? (
                                  <p className="px-4 py-2 text-xs" style={{ color: '#999' }}>챕터가 없습니다</p>
                                ) : book.chapters.map((ch, chIdx) => (
                                  <div key={ch.id}
                                    style={{ borderColor: '#f5f5f5' }}
                                    draggable={isDeveloper}
                                    onDragStart={isDeveloper ? () => setDraggingChapterInfo({ bookId: book.id, idx: chIdx }) : undefined}
                                    onDragOver={isDeveloper ? (e) => e.preventDefault() : undefined}
                                    onDrop={isDeveloper ? () => {
                                      if (!draggingChapterInfo || draggingChapterInfo.bookId !== book.id || draggingChapterInfo.idx === chIdx) return;
                                      const newChapters = [...book.chapters];
                                      const [moved] = newChapters.splice(draggingChapterInfo.idx, 1);
                                      newChapters.splice(chIdx, 0, moved);
                                      setBooks(prev => prev.map(b => b.id === book.id ? { ...b, chapters: newChapters } : b));
                                      setDraggingChapterInfo(null);
                                      updateChapterOrderInFirestore(book.id, newChapters).catch(console.error);
                                    } : undefined}
                                  >
                                    <div
                                      className="flex items-center border-t px-4 py-2 cursor-pointer hover:bg-yellow-50"
                                      style={{ borderColor: '#f5f5f5', backgroundColor: '#fafafa' }}
                                      onClick={() => setExpandedChapterIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                                        return next;
                                      })}
                                    >
                                      {isDeveloper && <span className="text-gray-300 mr-2 cursor-grab select-none text-xs">☰</span>}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate" style={{ color: '#333' }}>{ch.title}</p>
                                        {ch.sourceTitle && <p className="text-xs" style={{ color: '#999' }}>{ch.sourceTitle}</p>}
                                      </div>
                                      <span style={{ fontSize: '10px', color: '#1A3C6E' }}>
                                        {expandedChapterIds.has(ch.id) ? '▼' : '▶'}
                                      </span>
                                      {isDeveloper && (
                                        <button
                                          onClick={e => { e.stopPropagation(); handleDeleteChapter(book.id, ch.id); }}
                                          className="ml-2 text-xs flex-shrink-0 hover:text-red-600 transition-colors"
                                          style={{ color: '#ccc' }} title="챕터 삭제"
                                        >✕</button>
                                      )}
                                    </div>
                                    {expandedChapterIds.has(ch.id) && ch.content && (
                                      <div style={{ borderTop: '1px solid #e8e0f0' }}>
                                        {/* 🔊 TTS 버튼 */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px 0 16px' }}>
                                          <button
                                            onClick={e => { e.stopPropagation(); handleTTS(ch.content, `chapter_${ch.id}`); }}
                                            style={{
                                              display: 'flex', alignItems: 'center', gap: 4,
                                              padding: '4px 12px', borderRadius: 20, border: 'none',
                                              backgroundColor: ttsPlaying === `chapter_${ch.id}` ? '#8B4789' : '#e8e0f0',
                                              color: ttsPlaying === `chapter_${ch.id}` ? '#fff' : '#8B4789',
                                              fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                            }}
                                          >
                                            {ttsLoading === `chapter_${ch.id}` ? '로딩 중...' : ttsPlaying === `chapter_${ch.id}` ? <><Pause className="w-3 h-3" /> 정지</> : <><Volume2 className="w-3 h-3" /> 듣기</>}
                                          </button>
                                        </div>
                                        {renderStyledContent(ch.content)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {totalPages > 1 && (
                        <div className="flex justify-center gap-1 py-2 px-3 border-t" style={{ borderColor: '#f0f0f0' }}>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setBookPage(p)}
                              className="w-7 h-7 rounded text-xs font-medium transition-all"
                              style={{ backgroundColor: bookPage === p ? '#1A3C6E' : '#f3f4f6', color: bookPage === p ? '#fff' : '#333' }}
                            >{p}</button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* 하루LAW */}
          {(() => {
            const haruLawCategory = listData.find(d => d.category === '하루LAW');
            if (!haruLawCategory) return null;
            const { category, formats } = haruLawCategory;
            return (
              <div key={category} className="mb-4">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Scale className="w-4 h-4" /> 하루LAW</span>
                  <span style={{ fontSize: '10px' }}>
                    {collapsedCategories.has(category) ? '▶' : '▼'}
                  </span>
                </button>
                {!collapsedCategories.has(category) && (
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="px-3 py-2" style={{ backgroundColor: '#f9fafb' }}>
                      <input
                        type="text"
                        value={categorySearch[category] || ''}
                        onChange={e => setCategorySearch(prev => ({ ...prev, [category]: e.target.value }))}
                        placeholder="제목으로 검색..."
                        className="w-full px-3 py-1.5 text-xs rounded border outline-none"
                        style={{ borderColor: '#d1d5db', backgroundColor: '#fff', fontSize: 14 }}
                      />
                    </div>
                    {formats.map(({ format, entries }, fIdx) => {
                      const prefix = 'haruraw';
                      const isFormatExpanded = expandedFormats.has(prefix);
                      const searchTerm = (categorySearch[category] || '').toLowerCase();
                      const filteredEntries = searchTerm ? entries.filter(e => e.title.toLowerCase().includes(searchTerm)) : entries;
                      const pageKey = `${prefix}_${category}`;
                      const page = formatPages[pageKey] || 1;
                      const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
                      const pagedEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
                      return (
                        <div key={String(format)} className={fIdx > 0 ? 'border-t' : ''} style={{ borderColor: '#f0f0f0' }}>
                          <button
                            onClick={() => toggleFormat(prefix)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: '#FEFBE8' }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">⚖️</span>
                              <span className="text-xs font-semibold" style={{ color: '#333' }}>{String(format)}</span>
                              <span className="text-xs" style={{ color: '#999' }}>({entries.length})</span>
                            </div>
                            <span style={{ fontSize: '10px', color: '#1A3C6E' }}>{isFormatExpanded ? '▼' : '▶'}</span>
                          </button>
                          {isFormatExpanded && (
                            <>
                              {pagedEntries.map((entry) => (
                                <div key={`${entry.date}-${entry.formatKey}-${entry.recordId}`} className="w-full flex items-center gap-1 border-t" style={{ borderColor: '#f5f5f5' }}>
                                  <button
                                    className="flex items-center gap-3 flex-1 px-4 py-2.5 text-left hover:bg-yellow-50 transition-colors"
                                    onClick={() => openFormatSayu(entry.date, entry.formatKey, format as any, entry.recordId)}
                                  >
                                    <span className="text-xs font-medium flex-shrink-0" style={{ color: '#1A3C6E', minWidth: '32px' }}>{formatListDate(entry.date)}</span>
                                    <span className="text-sm flex-1" style={{ color: '#333', overflow: 'hidden' }}>
                                      <span className="truncate" style={{ display: 'inline' }}>{entry.title}</span>
                                      {entry.aiTitle && entry.aiTitle !== entry.title && (
                                        <span style={{ color: '#999', fontSize: 11, marginLeft: 4, whiteSpace: 'nowrap' }}>({entry.aiTitle})</span>
                                      )}
                                    </span>
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteRecord(entry.recordId); }}
                                    className="px-3 py-2.5 text-xs flex-shrink-0 hover:text-red-600 transition-colors"
                                    style={{ color: '#ccc' }}
                                    title="삭제"
                                  >✕</button>
                                </div>
                              ))}
                              {totalPages > 1 && (
                                <div className="flex justify-center gap-1 py-2 px-3 border-t" style={{ borderColor: '#f0f0f0' }}>
                                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <button
                                      key={p}
                                      onClick={() => setFormatPages(prev => ({ ...prev, [pageKey]: p }))}
                                      className="w-7 h-7 rounded text-xs font-medium transition-all"
                                      style={{ backgroundColor: page === p ? '#1A3C6E' : '#f3f4f6', color: page === p ? '#fff' : '#333' }}
                                    >{p}</button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 하루AI지식창고 */}
          <div className="mb-4">
            <button
              onClick={() => toggleCategory('하루AI지식창고')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
              style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Cpu className="w-4 h-4" /> 하루AI지식창고</span>
              <span style={{ fontSize: '10px' }}>{collapsedCategories.has('하루AI지식창고') ? '▶' : '▼'}</span>
            </button>
            {!collapsedCategories.has('하루AI지식창고') && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* search */}
                <div className="px-3 py-2" style={{ backgroundColor: '#f9fafb' }}>
                  <input type="text" value={aiSearch} onChange={e => { setAiSearch(e.target.value); setAiPage(1); }}
                    placeholder="제목으로 검색..." className="w-full px-3 py-1.5 text-xs rounded border outline-none"
                    style={{ borderColor: '#d1d5db', backgroundColor: '#fff', fontSize: 14 }} />
                </div>
                {aiLogsLoading ? (
                  <p className="text-center py-4 text-xs" style={{ color: '#999' }}>불러오는 중...</p>
                ) : (() => {
                  const filtered = aiSearch ? aiLogs.filter(l => (l.title || '').toLowerCase().includes(aiSearch.toLowerCase())) : aiLogs;
                  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                  const paged = filtered.slice((aiPage - 1) * PAGE_SIZE, aiPage * PAGE_SIZE);
                  if (filtered.length === 0) return <p className="text-center py-4 text-xs" style={{ color: '#999' }}>기록이 없습니다</p>;
                  return (
                    <>
                      {paged.map((log) => (
                        <div key={log.id} className="flex items-center border-t" style={{ borderColor: '#f5f5f5' }}>
                          <div className="flex-1 px-4 py-2.5">
                            <p className="text-sm truncate" style={{ color: '#333' }}>{log.title || '(제목 없음)'}</p>
                            {log.source && <p className="text-xs mt-0.5" style={{ color: '#999' }}>{log.source}</p>}
                          </div>
                          <button
                            onClick={() => handleDeleteAiLog(log.id)}
                            className="px-3 py-2.5 text-xs flex-shrink-0 hover:text-red-600 transition-colors"
                            style={{ color: '#ccc' }} title="삭제"
                          >✕</button>
                        </div>
                      ))}
                      {totalPages > 1 && (
                        <div className="flex justify-center gap-1 py-2 px-3 border-t" style={{ borderColor: '#f0f0f0' }}>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setAiPage(p)}
                              className="w-7 h-7 rounded text-xs font-medium transition-all"
                              style={{ backgroundColor: aiPage === p ? '#1A3C6E' : '#f3f4f6', color: aiPage === p ? '#fff' : '#333' }}
                            >{p}</button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
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
        title={sayuModalState.title}
        onRefresh={undefined}
      />

      {/* HARUraw 모달 */}
      {harurawModal.isOpen && (
        <div
          onClick={() => setHarurawModal({ isOpen: false, query: '', summary: '', articles: '' })}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxHeight: '80vh', backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 20, overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', display: 'flex', alignItems: 'center', gap: 6 }}><Scale className="w-4 h-4" /> 하루LAW 검색 기록</p>
              <button onClick={() => setHarurawModal({ isOpen: false, query: '', summary: '', articles: '' })}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}>✕</button>
            </div>
            <div style={{ padding: 12, backgroundColor: '#f0f4ff', borderRadius: 8, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>검색 질문</p>
              <p style={{ fontSize: 14, color: '#1A3C6E', fontWeight: 600 }}>{harurawModal.query}</p>
            </div>
            {harurawModal.summary && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: 11, color: '#888' }}>💡 AI 분석</p>
                </div>
                {renderStyledContent(harurawModal.summary)}
              </div>
            )}
            {harurawModal.articles && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>📋 관련 법조문</p>
                {renderStyledContent(harurawModal.articles)}
              </div>
            )}
            <p style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 8 }}>
              본 내용은 법령 정보 제공 목적이며, 전문적인 법률 자문을 대체할 수 없습니다.
            </p>
          </div>
        </div>
      )}
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
    </>
  );
}
