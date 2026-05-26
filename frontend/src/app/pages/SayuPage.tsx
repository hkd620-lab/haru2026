import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Info, Leaf, Briefcase, BookOpen, Scale, Cpu, Volume2, Pause } from 'lucide-react';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { useAuth } from '../contexts/AuthContext';
import { SayuTitleAnimation } from '../components/SayuTitleAnimation';
import { toast } from 'sonner';
import { SayuModal } from '../components/SayuModal';
import { CATEGORY_FORMATS, FORMAT_PREFIX, FORMAT_EMOJI, READING_ENTRY_TYPES, READING_STATUS } from '../types/haruTypes';
import type { RecordFormat } from '../types/haruTypes';
import { collection, getDocs, getDoc, orderBy, query, deleteDoc, doc, writeBatch, updateDoc, limit, setDoc, serverTimestamp, arrayUnion, increment } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db } from '../../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSubscription } from '../hooks/useSubscription';
import { compressImage } from '../services/imageService';

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
  reading: 'reading_book_title',
  stock: 'stock_name',
};

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const PAGE_SIZE = 10;

interface AiLog { id: string; title?: string; source?: string; createdAt?: string; [key: string]: any; }
interface Chapter { id: string; bookId: string; title: string; sourceTitle: string; content: string; order: number; }
interface Book { id: string; title: string; totalChapters: number; order?: number; chapters: Chapter[]; }
interface SayuPlantLibraryItem {
  id: string;
  displayName?: string;
  userConfirmedName?: string;
  finalGuess?: string;
  englishName?: string;
  scientificName?: string;
  finalLatinName?: string;
  imageUrl?: string;
  photos?: string[];
  updatedAt?: any;
  createdAt?: any;
  observationCount?: number;
  watermarkText?: string;
}
interface SayuPlantDiaryEditKey {
  recordId: string;
  idx: number;
}
type SayuPlantDiaryInputMode = 'edit' | 'append';

const emptyPlantDiaryDraft = {
  observation: '',
  aiDifference: '',
  memo: '',
};

// SAYU 리스트 키워드 미리보기용 fallback 추출기
// 저장 구조는 건드리지 않고 화면 표시 fallback으로만 사용
const KW_STOP = new Set<string>([
  '이','가','을','를','은','는','의','에','와','과','도','로','으로','에서','에게','한테','까지','부터','보다','처럼','같이','마다','조차','마저','이나','나','이라','라고','이라고','이며','면서','이지만','지만','이든','든',
  '그리고','그러나','하지만','또는','또한','즉','따라서','그래서','그러면','그런데','그래도','그러므로','그렇지만','다만','다시','정말','매우','너무','조금','거의','아주','이미','잘','꼭','참','뭐','왜','어떻게','어떤','이런','그런','저런','어느','이번','지난','요즘','오늘','내일','어제','계속','다른','모든','어떻','이렇','그렇','저렇','있다','없다','한다','하다','되다','이다','였다','했다','였습니다','입니다','합니다','됩니다',
  // 일반 추상명사 (Functions KW_STRICT_STOP과 동기화)
  'AI','ai','기록','실제','현재','구조','가능성','수준','부분','내용','생각','사람','경우','방법','방향','과정','결과','효과','의미','가치','활용','적용','관련','다양','진행','중심','기준','정도','시간','시점','필요','중요','주요','확인','사용','제공','문제','상황','상태','느낌','측면','단계','기반','계열','메모리',
  // 사용자 호칭 / 인사
  '허대표','허대표님','대표님','교장님','박사님','시박사','선생님','본인',
  // 종결 표현
  '있습니다','이건','저건','그건','여기','저기','거기',
  // 형용사/동사 어간
  '단순','단순한','중요한','필요한','간단한','복잡한','새로운','좋은','만든','만들기','만들','진행중','완료','시작','취업','신청',
  // 영어 stop
  'the','and','but','or','for','to','of','in','on','at','an','is','are','was','were','be','been','being','this','that','these','those','it','its','as','by','with','from','about','into','than','then','so','if','when','where','what','who','how','have','has','had','do','does','did','will','would','can','could','should','may','might','i','you','he','she','they','we','my','your','his','her','their','our',
]);
// 숫자+단위 패턴 (Functions와 동일)
const KW_NUMUNIT_RE = /^\d+\s*(개|가지|명|번|회|차|단계|시간|초|분|일|월|년|건|개월|주|살|세|점|위|등|차례|장|편)$/;
const KW_TAIL = ['입니다','였습니다','합니다','됩니다','이었다','였다','했다','이라고','이라며','이라는','이라서','이라도','이라면','이지만','으로서','으로써','으로부터','으로는','으로도','이면서','으면서','이면','으면','이라','이며','이고','이지','이거','이었','일까','한테','에게','에서','부터','까지','보다','마다','조차','마저','이나','이든','든지','라도','라고','라며','라는','으로','에는','에도','에서','은','는','이','가','을','를','의','과','와','도','로','만','요','죠'];

function stripKwTail(token: string): string {
  for (const t of KW_TAIL) {
    if (token.length > t.length + 1 && token.endsWith(t)) {
      const stripped = token.slice(0, -t.length);
      const lastChar = stripped.charCodeAt(stripped.length - 1);
      if (lastChar >= 0xAC00 && lastChar <= 0xD7AF) return stripped;
    }
  }
  return token;
}

function extractPreviewKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const cleaned = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  const tokens = cleaned.split(' ')
    .map(stripKwTail)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !KW_STOP.has(t) && !KW_STOP.has(t.toLowerCase()) && !/^\d+$/.test(t) && !KW_NUMUNIT_RE.test(t));
  const freq = new Map<string, { count: number; order: number }>();
  tokens.forEach((tok, i) => {
    const e = freq.get(tok);
    if (e) e.count += 1;
    else freq.set(tok, { count: 1, order: i });
  });
  return [...freq.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].order - b[1].order)
    .slice(0, 6)
    .map(([k]) => (k.length > 14 ? k.slice(0, 13) + '…' : k));
}

// 레코드 본문 필드를 하나의 문자열로 합치는 헬퍼 (AI 추출과 fallback 양쪽에서 재사용)
function getRecordSourceText(r: any, prefix: string): string {
  if (!r) return '';
  const parts: string[] = [];
  const sayu = r[`${prefix}_sayu`];
  if (typeof sayu === 'string') parts.push(sayu);
  Object.keys(r).forEach((k) => {
    if (!k.startsWith(`${prefix}_`)) return;
    if (k.endsWith('_sayu') || k.endsWith('_keywords') || k.endsWith('_ai_title') || k.endsWith('_title') || k.endsWith('_polished') || k.endsWith('_polishedAt') || k.endsWith('_mode') || k.endsWith('_stats') || k.endsWith('_images') || k.endsWith('_rating') || k.endsWith('_tags') || k.endsWith('_space') || k.endsWith('_style')) return;
    const v = r[k];
    if (typeof v === 'string' && v.trim()) parts.push(v);
  });
  return parts.join(' ');
}

// AI로그(하루AI지식창고)의 본문 추출
function getAiLogSourceText(log: any): string {
  const c = log?.content;
  if (typeof c === 'string' && c.trim()) return c;
  return (log?.ai_title as string) || (log?.title as string) || '';
}

// 레코드에서 미리보기 키워드를 가져오는 헬퍼: 저장된 _keywords 우선, 없으면 fallback 추출
function getRecordPreviewKeywords(r: any, prefix: string): string[] {
  const stored = r?.[`${prefix}_keywords`];
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 6);
  }
  return extractPreviewKeywords(getRecordSourceText(r, prefix));
}

// IntersectionObserver 백필 메타
type KwMeta =
  | { kind: 'record'; id: string; prefix: string; text: string }
  | { kind: 'ailog'; id: string; text: string };

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
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDateFormats, setSelectedDateFormats] = useState<{ key: string; label: string; recordId?: string }[]>([]);
  const [selectedAssistantDate, setSelectedAssistantDate] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [sayuTab, setSayuTab] = useState<'records' | 'assistants'>('records');
  const [expandedSayuGroups, setExpandedSayuGroups] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set(['생활', '업무', '하루충전소', '하루LAW', '하루AI지식창고', 'SNS검색기록', '내가 읽은 책', 'HARU주식관리']));
  const [expandedFormats, setExpandedFormats] = useState<Set<string>>(new Set());
  // 📊 통계/합치기 모달
  const [formatStatModal, setFormatStatModal] = useState<{
    isOpen: boolean;
    format: string;
    prefix: string;
    entries: any[];
    tab: 'stat' | 'merge';
  }>({ isOpen: false, format: '', prefix: '', entries: [], tab: 'stat' });
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

  // 📚 내가 읽은 책 — final_reflection 카드 펼침 상태
  const [expandedFinalReadingIds, setExpandedFinalReadingIds] = useState<Set<string>>(new Set());

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
  const [selectedAiLog, setSelectedAiLog] = useState<AiLog | null>(null);
  const [aiSearch, setAiSearch] = useState('');
  const [aiPage, setAiPage] = useState(1);
  const [aiSearchMode, setAiSearchMode] = useState<'title' | 'content'>('title');
  const [bookMaterialBusy, setBookMaterialBusy] = useState<Set<string>>(new Set());

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

  // 🔍 SNS검색기록
  type SnsSearchRecord = {
    id: string;
    date: string;
    keyword: string;
    source: 'all' | 'facebook' | 'instagram';
    type: 'all' | 'text' | 'photo' | 'video';
    results: { id: string; source: 'facebook' | 'instagram'; timestamp: number; text: string; thumbnails?: string[] }[];
    savedAtMs: number;
  };
  const [snsSearchRecords, setSnsSearchRecords] = useState<SnsSearchRecord[]>([]);
  const [snsSearchLoaded, setSnsSearchLoaded] = useState(false);
  const [snsSearchLoading, setSnsSearchLoading] = useState(false);
  const [expandedSearchIds, setExpandedSearchIds] = useState<Set<string>>(new Set());
  const [expandedPlantIds, setExpandedPlantIds] = useState<Set<string>>(new Set());
  const [selectedPlantEntryIds, setSelectedPlantEntryIds] = useState<Set<string>>(new Set());
  const [plantDeleteBusy, setPlantDeleteBusy] = useState(false);
  const [plantLibraryItems, setPlantLibraryItems] = useState<SayuPlantLibraryItem[]>([]);
  const [plantCatalogItems, setPlantCatalogItems] = useState<SayuPlantLibraryItem[]>([]);
  const [plantLibraryLoaded, setPlantLibraryLoaded] = useState(false);
  const [plantCatalogLoaded, setPlantCatalogLoaded] = useState(false);
  const [plantPopupType, setPlantPopupType] = useState<null | 'assistant' | 'diary' | 'library' | 'catalog'>(null);
  const [selectedPlantDiaryItem, setSelectedPlantDiaryItem] = useState<SayuPlantLibraryItem | null>(null);
  const [editingPlantDiaryKey, setEditingPlantDiaryKey] = useState<SayuPlantDiaryEditKey | null>(null);
  const [plantDiaryInputMode, setPlantDiaryInputMode] = useState<SayuPlantDiaryInputMode>('append');
  const [plantDiaryDraft, setPlantDiaryDraft] = useState(emptyPlantDiaryDraft);
  const [plantDiarySaving, setPlantDiarySaving] = useState(false);

  // === SAYU 키워드 미리보기 백필 (IntersectionObserver) ===
  const kwInflightRef = useRef<Set<string>>(new Set());
  const kwIORef = useRef<IntersectionObserver | null>(null);
  const kwMetaRef = useRef<WeakMap<Element, KwMeta>>(new WeakMap());

  const runKwExtract = async (meta: KwMeta) => {
    const key = meta.kind === 'record' ? `r_${meta.id}_${meta.prefix}` : `a_${meta.id}`;
    if (kwInflightRef.current.has(key)) return;
    if (!user) return;
    if (!meta.text || meta.text.trim().length < 5) return;
    kwInflightRef.current.add(key);
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'extractKeywords');
      const result: any = await fn({ text: meta.text, max: 6 });
      const keywords: string[] = Array.isArray(result?.data?.keywords) ? result.data.keywords : [];
      if (keywords.length === 0) return;
      if (meta.kind === 'record') {
        const field = `${meta.prefix}_keywords`;
        await updateDoc(doc(db, `users/${user.uid}/records`, meta.id), { [field]: keywords });
        setRecords((prev) => prev.map((r) => (r.id === meta.id ? ({ ...r, [field]: keywords } as any) : r)));
      } else {
        await updateDoc(doc(db, `users/${user.uid}/records`, meta.id), { keywords });
        setAiLogs((prev) => prev.map((l) => (l.id === meta.id ? ({ ...l, keywords } as any) : l)));
      }
    } catch (err) {
      console.warn('extractKeywords 호출 실패:', err);
    } finally {
      kwInflightRef.current.delete(key);
    }
  };

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const meta = kwMetaRef.current.get(e.target);
        if (!meta) return;
        io.unobserve(e.target);
        kwMetaRef.current.delete(e.target);
        runKwExtract(meta);
      });
    }, { rootMargin: '40px' });
    kwIORef.current = io;
    return () => {
      io.disconnect();
      kwIORef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const observeKwTarget = (el: HTMLElement | null, meta: KwMeta | null) => {
    const io = kwIORef.current;
    if (!el || !meta || !io) return;
    kwMetaRef.current.set(el, meta);
    io.observe(el);
  };

  const getLocalDateKey = (value: Date | number | string = new Date()) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return getLocalDateKey(new Date());
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseDateKeyTime = (dateKey: string) => {
    const [yyyy, mm, dd] = String(dateKey || '').slice(0, 10).split('-').map((v) => Number(v));
    if (!yyyy || !mm || !dd) return null;
    return new Date(yyyy, mm - 1, dd).getTime();
  };

  const normalizeDiaryDateKey = (value: any, fallback?: string) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    if (value?.toDate && typeof value.toDate === 'function') return getLocalDateKey(value.toDate());
    if (value) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return getLocalDateKey(parsed);
    }
    return fallback || getLocalDateKey();
  };

  const formatKoreanDate = (dateKey: string) => {
    const [yyyy, mm, dd] = String(dateKey || '').slice(0, 10).split('-');
    if (!yyyy || !mm || !dd) return String(dateKey || '');
    return `${yyyy}년 ${Number(mm)}월 ${Number(dd)}일`;
  };

  const summarizeTraceText = (value: any) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > 70 ? `${text.slice(0, 70)}...` : text;
  };

  const getDaysBetweenDateKeys = (fromDateKey: string, toDateKey: string) => {
    const fromTime = parseDateKeyTime(fromDateKey);
    const toTime = parseDateKeyTime(toDateKey);
    if (fromTime === null || toTime === null) return 0;
    return Math.max(0, Math.round((toTime - fromTime) / 86400000));
  };

  const formatDaysAfterRecord = (days: number) => (days > 0 ? `${days}일 지나서 기록` : '기록 당일');

  const getDiarySortTime = (value: any) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (value?.toDate && typeof value.toDate === 'function') {
      const parsed = value.toDate().getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const getPlantDiaryTrace = (entry: any, fallbackDate: string) => {
    const recordDate = normalizeDiaryDateKey(entry?.recordDate || entry?.firstRecordDate || entry?.originalRecordDate || fallbackDate, fallbackDate);
    const updatedDate = entry?.updatedDate || (entry?.updatedAt ? normalizeDiaryDateKey(entry.updatedAt, '') : '');
    const daysAfterRecord = typeof entry?.daysAfterRecord === 'number'
      ? entry.daysAfterRecord
      : updatedDate
        ? getDaysBetweenDateKeys(recordDate, updatedDate)
        : 0;
    const editHistory = Array.isArray(entry?.editHistory) ? entry.editHistory : [];
    return {
      recordDate,
      recordLabel: `${formatKoreanDate(recordDate)} 기록`,
      updatedDate,
      editedLabel: updatedDate ? `${formatKoreanDate(updatedDate)} 수정 · ${formatDaysAfterRecord(daysAfterRecord)}` : '',
      editHistory,
      editCount: typeof entry?.editCount === 'number' ? entry.editCount : editHistory.length,
    };
  };

  const getSayuPlantName = (plant: SayuPlantLibraryItem | null) =>
    plant?.displayName || plant?.userConfirmedName || plant?.finalGuess || '식물 이름 불확실';

  const normalizePlantName = (value: any) => String(value || '').trim().toLowerCase();

  const isPlantDiaryForItem = (entry: any, plant: SayuPlantLibraryItem | null) => {
    if (!entry || !plant) return false;
    if (entry.plantId && entry.plantId === plant.id) return true;
    const plantNames = [
      plant.displayName,
      plant.userConfirmedName,
      plant.finalGuess,
      plant.englishName,
      plant.scientificName,
      plant.finalLatinName,
    ].map(normalizePlantName).filter(Boolean);
    const entryNames = [
      entry.plantName,
      entry.title,
      entry.userConfirmedName,
      entry.humanReportedName,
      entry.aiKoName,
      entry.aiPrediction,
      entry.scientificName,
      entry.latinName,
    ].map(normalizePlantName).filter(Boolean);
    return entryNames.some((name) => plantNames.includes(name));
  };

  const uploadSayuPlantDiaryPhoto = async (plantId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('사진 파일만 추가할 수 있어요.');
    }
    const compressed = await compressImage(file, 1024, 0.82);
    const storage = getStorage();
    const ts = Date.now();
    const storageRef = ref(storage, `users/${user!.uid}/format_photos/${plantId}_sayu_diary_${ts}.jpg`);
    await uploadBytes(storageRef, compressed, { contentType: compressed.type || file.type || 'image/jpeg' });
    return getDownloadURL(storageRef);
  };

  const collectPlantDiaryImageUrls = (entry: any) => {
    const urls = new Set<string>();
    const addUrl = (value: any) => {
      const url = typeof value === 'string' ? value.trim() : '';
      if (url && url.startsWith('http')) urls.add(url);
    };
    addUrl(entry?.imageUrl);
    if (Array.isArray(entry?.imageUrls)) entry.imageUrls.forEach(addUrl);
    if (Array.isArray(entry?.editHistory)) {
      entry.editHistory.forEach((history: any) => {
        addUrl(history?.previousImageUrl);
        addUrl(history?.addedPhotoUrl);
        if (Array.isArray(history?.previousImageUrls)) history.previousImageUrls.forEach(addUrl);
      });
    }
    return Array.from(urls);
  };

  const deleteSayuPlantDiaryStoredPhoto = async (imageUrl: string) => {
    if (!user?.uid) return;
    const url = imageUrl.trim();
    if (!url) return;
    if (url.includes('cloudinary.com')) {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const deleteRecordImage = httpsCallable(fns, 'deleteRecordImage');
      await deleteRecordImage({ imageUrl: url });
      return;
    }
    const decodedUrl = decodeURIComponent(url);
    const userPathMarker = `/users/${user.uid}/format_photos/`;
    const fileName = decodedUrl.includes(userPathMarker)
      ? decodedUrl.split(userPathMarker)[1]?.split('?')[0]
      : decodedUrl.split('/format_photos/')[1]?.split('?')[0];
    if (!fileName) {
      throw new Error('사진 저장 경로를 확인할 수 없어 원본 삭제를 중단했습니다.');
    }
    const storage = getStorage();
    await deleteObject(ref(storage, `users/${user.uid}/format_photos/${fileName}`));
  };

  const removePlantDiaryPhotoRefs = async (plantId: string, imageUrls: string[]) => {
    if (!user?.uid || !plantId || imageUrls.length === 0) return;
    const urlSet = new Set(imageUrls);
    const plantRef = doc(db, 'users', user.uid, 'plants', plantId);
    const plantSnap = await getDoc(plantRef);
    if (!plantSnap.exists()) return;
    const data = plantSnap.data() as any;
    const nextPhotos = Array.isArray(data.photos)
      ? data.photos.filter((url: any) => !urlSet.has(String(url)))
      : [];
    const nextGrowthPhotos = Array.isArray(data.growthPhotos)
      ? data.growthPhotos.filter((item: any) => !urlSet.has(typeof item === 'string' ? item : String(item?.url || '')))
      : [];
    const currentImageUrl = String(data.imageUrl || '');
    const currentLatestPhotoUrl = String(data.latestPhotoUrl || '');
    const nextImageUrl = urlSet.has(currentImageUrl) ? (nextPhotos[0] || '') : currentImageUrl;
    const nextLatestPhotoUrl = urlSet.has(currentLatestPhotoUrl)
      ? (nextPhotos[nextPhotos.length - 1] || nextImageUrl || '')
      : currentLatestPhotoUrl;
    await setDoc(
      plantRef,
      {
        photos: nextPhotos,
        growthPhotos: nextGrowthPhotos,
        imageUrl: nextImageUrl,
        latestPhotoUrl: nextLatestPhotoUrl,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setPlantLibraryItems((prev) => prev.map((item) => (
      item.id === plantId
        ? { ...item, photos: nextPhotos, imageUrl: nextImageUrl || undefined }
        : item
    )));
    setSelectedPlantDiaryItem((prev) => (
      prev?.id === plantId ? { ...prev, photos: nextPhotos, imageUrl: nextImageUrl || undefined } : prev
    ));
  };

  const handleDeletePlantDiaryEntry = async (recordId: string, idx: number, entry: any) => {
    if (!user?.uid) return;
    const imageUrls = collectPlantDiaryImageUrls(entry);
    const confirmText = imageUrls.length > 0
      ? '이 성장일기를 삭제할까요? 연결된 사진 원본도 Firebase Storage에서 함께 삭제됩니다.'
      : '이 성장일기를 삭제할까요?';
    if (!window.confirm(confirmText)) return;
    setPlantDiarySaving(true);
    try {
      const deleteResults = await Promise.allSettled(imageUrls.map((url) => deleteSayuPlantDiaryStoredPhoto(url)));
      const failedDelete = deleteResults.find((result) => {
        const error = result.status === 'rejected' ? (result.reason as any) : null;
        return error && error.code !== 'storage/object-not-found';
      });
      if (failedDelete) {
        throw new Error('사진 원본 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }

      const record = records.find((r) => r.id === recordId) as any;
      const current = Array.isArray(record?.plantObservation) ? [...record.plantObservation] : [];
      const next = current.filter((_, entryIdx) => entryIdx !== idx);
      await updateDoc(doc(db, 'users', user.uid, 'records', recordId), {
        plantObservation: next,
        updatedAt: serverTimestamp(),
      });
      await removePlantDiaryPhotoRefs(String(entry?.plantId || selectedPlantDiaryItem?.id || ''), imageUrls);
      setRecords((prevRecords) => prevRecords.map((r) => (
        r.id === recordId ? ({ ...(r as any), plantObservation: next } as HaruRecord) : r
      )));
      if (editingPlantDiaryKey?.recordId === recordId && editingPlantDiaryKey.idx === idx) {
        setEditingPlantDiaryKey(null);
        setPlantDiaryInputMode('append');
        setPlantDiaryDraft(emptyPlantDiaryDraft);
      }
      toast.success(imageUrls.length > 0 ? '성장일기와 사진 원본을 삭제했습니다.' : '성장일기를 삭제했습니다.');
    } catch (e: any) {
      console.error('성장일기 삭제 실패:', e);
      toast.error(e?.message || '성장일기 삭제에 실패했습니다.');
    } finally {
      setPlantDiarySaving(false);
    }
  };

  const openPublicPlantCatalog = () => {
    if (!isPremium && !isDeveloper) {
      toast.error('공개도감은 구독자 전용입니다.');
      return;
    }
    setPlantPopupType('catalog');
  };

  const openPlantDiaryDetail = (plant: SayuPlantLibraryItem) => {
    setSelectedPlantDiaryItem(plant);
    setEditingPlantDiaryKey(null);
    setPlantDiaryInputMode('append');
    setPlantDiaryDraft(emptyPlantDiaryDraft);
  };

  const closePlantDiaryDetail = () => {
    setSelectedPlantDiaryItem(null);
    setEditingPlantDiaryKey(null);
    setPlantDiaryInputMode('append');
    setPlantDiaryDraft(emptyPlantDiaryDraft);
  };

  const handleEditPlantDiary = (recordId: string, idx: number, entry: any) => {
    setEditingPlantDiaryKey({ recordId, idx });
    setPlantDiaryInputMode('edit');
    setPlantDiaryDraft({
      observation: String(entry?.observation || ''),
      aiDifference: String(entry?.aiDifference || ''),
      memo: String(entry?.memo || ''),
    });
  };

  const handleSavePlantDiary = async (plant: SayuPlantLibraryItem, file?: File | null) => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    const observation = plantDiaryDraft.observation.trim();
    const aiDifference = plantDiaryDraft.aiDifference.trim();
    const memo = plantDiaryDraft.memo.trim();
    if (!observation && !aiDifference && !memo && !file) {
      toast.error('성장일기 내용이나 사진을 추가해 주세요.');
      return;
    }
    setPlantDiarySaving(true);
    try {
      const photoUrl = file ? await uploadSayuPlantDiaryPhoto(plant.id, file) : '';
      const plantName = getSayuPlantName(plant);
      const today = getLocalDateKey();
      const targetRecord = editingPlantDiaryKey?.recordId
        ? records.find((r) => r.id === editingPlantDiaryKey.recordId) as any
        : null;
      const current = editingPlantDiaryKey && targetRecord
        ? (Array.isArray(targetRecord?.plantObservation) ? [...targetRecord.plantObservation] : [])
        : [];
      const prev = editingPlantDiaryKey ? (current[editingPlantDiaryKey.idx] || {}) : {};
      const targetRecordDate = editingPlantDiaryKey
        ? normalizeDiaryDateKey(prev.recordDate || prev.firstRecordDate || prev.originalRecordDate || editingPlantDiaryKey.recordId, editingPlantDiaryKey.recordId)
        : today;
      const recordId = editingPlantDiaryKey ? editingPlantDiaryKey.recordId : today;
      const recordRef = doc(db, 'users', user.uid, 'records', recordId);
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const shouldEditExisting = !!editingPlantDiaryKey && plantDiaryInputMode === 'edit';
      if (shouldEditExisting && editingPlantDiaryKey) {
        const recordDate = targetRecordDate;
        const updatedDate = getLocalDateKey(now);
        const daysAfterRecord = getDaysBetweenDateKeys(recordDate, updatedDate);
        const editHistory = Array.isArray(prev.editHistory) ? prev.editHistory : [];
        const editCount = editHistory.length + 1;
        current[editingPlantDiaryKey.idx] = {
          ...prev,
          plantId: prev.plantId || plant.id,
          plantName: prev.plantName || plantName,
          title: prev.title || plantName,
          recordDate,
          firstRecordDate: prev.firstRecordDate || recordDate,
          observation,
          aiDifference,
          memo,
          imageUrl: prev.imageUrl || photoUrl || '',
          imageUrls: photoUrl ? [...(Array.isArray(prev.imageUrls) ? prev.imageUrls : []), photoUrl] : (Array.isArray(prev.imageUrls) ? prev.imageUrls : []),
          updatedAt: nowIso,
          updatedDate,
          daysAfterRecord,
          editCount,
          editHistory: [
            ...editHistory,
            {
              editedAt: nowIso,
              editedDate: updatedDate,
              daysAfterRecord,
              previousObservation: String(prev.observation || ''),
              previousAiDifference: String(prev.aiDifference || ''),
              previousMemo: String(prev.memo || ''),
              previousImageUrl: prev.imageUrl || '',
              previousImageUrls: Array.isArray(prev.imageUrls) ? prev.imageUrls : [],
              newObservation: observation,
              newAiDifference: aiDifference,
              newMemo: memo,
              addedPhotoUrl: photoUrl || '',
            },
          ],
        };
        await updateDoc(recordRef, { plantObservation: current });
        setRecords((prevRecords) => prevRecords.map((r) => (
          r.id === editingPlantDiaryKey.recordId ? ({ ...(r as any), plantObservation: current } as HaruRecord) : r
        )));
        toast.success('성장일기를 수정했습니다.');
      } else {
        const parentDiaryId = prev?.id || (editingPlantDiaryKey ? `${editingPlantDiaryKey.recordId}_${editingPlantDiaryKey.idx}` : '');
        const entry = {
          id: `sayu_${plant.id}_${recordId}_${now}`,
          plantId: plant.id,
          plantName,
          title: plantName,
          recordDate: targetRecordDate,
          firstRecordDate: prev.firstRecordDate || targetRecordDate,
          parentDiaryId,
          addedToRecordId: editingPlantDiaryKey?.recordId || '',
          addedFromDiaryIndex: editingPlantDiaryKey?.idx ?? null,
          observation,
          aiDifference,
          memo,
          imageUrl: photoUrl,
          imageUrls: photoUrl ? [photoUrl] : [],
          createdAt: nowIso,
          createdDate: today,
          editCount: 0,
          editHistory: [],
          source: 'sayu_plant_diary',
        };
        await setDoc(
          recordRef,
          {
            date: targetRecordDate,
            plantObservation: arrayUnion(entry),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setRecords((prevRecords) => {
          const existing = prevRecords.find((r) => r.id === recordId) as any;
          if (existing) {
            return prevRecords.map((r) => (
              r.id === recordId
                ? ({ ...(r as any), plantObservation: [...(Array.isArray((r as any).plantObservation) ? (r as any).plantObservation : []), entry] } as HaruRecord)
                : r
            ));
          }
          return [{ id: recordId, date: targetRecordDate, plantObservation: [entry] } as any, ...prevRecords];
        });
        await setDoc(
          doc(db, 'users', user.uid, 'plants', plant.id),
          {
            observationCount: increment(1),
            updatedAt: serverTimestamp(),
            ...(photoUrl ? {
              photos: arrayUnion(photoUrl),
              imageUrl: plant.imageUrl || photoUrl,
              growthPhotos: arrayUnion({ url: photoUrl, addedAt: now, type: 'growth_diary' }),
              latestPhotoUrl: photoUrl,
            } : {}),
          },
          { merge: true },
        );
        setPlantLibraryItems((prev) => prev.map((item) => (
          item.id === plant.id
            ? {
                ...item,
                observationCount: typeof item.observationCount === 'number' ? item.observationCount + 1 : 1,
                photos: photoUrl ? [...(Array.isArray(item.photos) ? item.photos : []), photoUrl] : item.photos,
                imageUrl: item.imageUrl || photoUrl,
              }
            : item
        )));
        toast.success(editingPlantDiaryKey ? '같은 날짜에 성장일기를 추가했습니다.' : '성장일기를 추가했습니다.');
      }
      setEditingPlantDiaryKey(null);
      setPlantDiaryInputMode('append');
      setPlantDiaryDraft(emptyPlantDiaryDraft);
    } catch (e: any) {
      toast.error(e?.message || '성장일기 저장에 실패했습니다.');
    } finally {
      setPlantDiarySaving(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [user?.uid, currentMonth]);

  useEffect(() => {
    setCollapsedCategories(new Set(['생활', '업무', '하루충전소', '하루LAW', '하루AI지식창고', 'SNS검색기록', '내가 읽은 책', 'HARU주식관리']));
    setExpandedFormats(new Set());
  }, [location.pathname]);

  useEffect(() => {
    setPlantLibraryLoaded(false);
    setPlantCatalogLoaded(false);
    setPlantLibraryItems([]);
    setPlantCatalogItems([]);
  }, [user?.uid]);

  useEffect(() => {
    if (collapsedCategories.has('하루식물탐정')) return;
    if (!user?.uid || plantLibraryLoaded) return;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'users', user.uid, 'plants'),
          orderBy('updatedAt', 'desc'),
          limit(20),
        ));
        setPlantLibraryItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } catch (e) {
        console.warn('SAYU 개인 식물도감 조회 실패:', e);
      } finally {
        setPlantLibraryLoaded(true);
      }
    })();
  }, [collapsedCategories, plantLibraryLoaded, user?.uid]);

  useEffect(() => {
    if (collapsedCategories.has('하루식물탐정')) return;
    if (!isPremium && !isDeveloper) return;
    if (plantCatalogLoaded) return;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'plant_catalog'),
          orderBy('updatedAt', 'desc'),
          limit(30),
        ));
        setPlantCatalogItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } catch (e) {
        console.warn('SAYU 공개 식물도감 조회 실패:', e);
      } finally {
        setPlantCatalogLoaded(true);
      }
    })();
  }, [collapsedCategories, isDeveloper, isPremium, plantCatalogLoaded]);

  // Fetch AI logs only for the legacy developer-only knowledge warehouse panel.
  useEffect(() => {
    if (false && sayuTab === 'assistants' && !aiLogsLoaded && user?.email) {
      setAiLogsLoading(true);
      firestoreService.getAiLogs(user.email).then(async (data: any[]) => {
        setAiLogs(data);
        setAiLogsLoaded(true);
        setAiLogsLoading(false);

        // ai_title 없는 항목 일괄 추출 (백그라운드)
        const needsTitle = data.filter(l => !l.ai_title && l.content && (l.content as string).trim().length > 5);
        if (needsTitle.length === 0) return;

        try {
          const fns = getFunctions(undefined, 'asia-northeast3');
          const extractTitleFn = httpsCallable(fns, 'extractTitle');

          for (const log of needsTitle) {
            try {
              const result = await extractTitleFn({
                text: (log.content as string).slice(0, 500),
                format: 'ai_log',
              });
              const aiTitle = (result.data as any)?.title;
              if (aiTitle) {
                await updateDoc(doc(db, `users/${user!.uid}/records`, log.id), { ai_title: aiTitle });
                setAiLogs(prev => prev.map(l => l.id === log.id ? { ...l, ai_title: aiTitle } : l));
              }
            } catch (e) {
              console.warn('제목 추출 실패 (개별):', log.id, e);
            }
          }
        } catch (e) {
          console.warn('일괄 제목 추출 실패:', e);
        }
      }).catch(() => setAiLogsLoading(false));
    }
  }, [sayuTab, aiLogsLoaded, user?.email]);

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

  // Fetch SNS 검색기록 when SNS검색기록 is expanded
  useEffect(() => {
    if (!collapsedCategories.has('SNS검색기록') && !snsSearchLoaded && user?.uid) {
      setSnsSearchLoading(true);
      (async () => {
        try {
          const colRef = collection(db, 'users', user.uid, 'snsSearchHistory');
          const snap = await getDocs(query(colRef, orderBy('savedAt', 'desc')));
          const list: SnsSearchRecord[] = [];
          snap.docs.slice(0, 50).forEach((d) => {
            const data = d.data() as any;
            const savedAtMs = data?.savedAt?.toMillis ? data.savedAt.toMillis() : 0;
            list.push({
              id: d.id,
              date: typeof data.date === 'string' ? data.date : '',
              keyword: typeof data.keyword === 'string' ? data.keyword : '',
              source: (data.source as any) || 'all',
              type: (data.type as any) || 'all',
              results: Array.isArray(data.results) ? data.results : [],
              savedAtMs,
            });
          });
          setSnsSearchRecords(list);
          setSnsSearchLoaded(true);
        } catch (e) {
          console.error('SNS 검색기록 조회 실패:', e);
        } finally {
          setSnsSearchLoading(false);
        }
      })();
    }
  }, [collapsedCategories, snsSearchLoaded, user?.uid]);

  const toggleSearchExpand = (id: string) => {
    setExpandedSearchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSnsSearch = async (id: string) => {
    if (!user?.uid) return;
    if (!window.confirm('이 검색기록을 삭제할까요?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'snsSearchHistory', id));
      setSnsSearchRecords((prev) => prev.filter((r) => r.id !== id));
      setExpandedSearchIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('검색기록을 삭제했습니다.');
    } catch (e) {
      console.error('SNS 검색기록 삭제 실패:', e);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleDeleteSelectedPlantEntries = async () => {
    if (!user?.uid || selectedPlantEntryIds.size === 0) return;
    if (!window.confirm(`선택한 식물 판독 기록 ${selectedPlantEntryIds.size}개를 삭제할까요?`)) return;
    setPlantDeleteBusy(true);
    try {
      const grouped = new Map<string, Set<number>>();
      selectedPlantEntryIds.forEach((id) => {
        const splitAt = id.lastIndexOf('_');
        if (splitAt <= 0) return;
        const recordId = id.slice(0, splitAt);
        const idx = Number(id.slice(splitAt + 1));
        if (!Number.isInteger(idx)) return;
        const set = grouped.get(recordId) || new Set<number>();
        set.add(idx);
        grouped.set(recordId, set);
      });

      for (const [recordId, indexes] of grouped.entries()) {
        const record = records.find((r) => r.id === recordId);
        const current = Array.isArray((record as any)?.plantDetective)
          ? ((record as any).plantDetective as any[])
          : [];
        const next = current.filter((_, idx) => !indexes.has(idx));
        await updateDoc(doc(db, 'users', user.uid, 'records', recordId), {
          plantDetective: next,
        });
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId ? ({ ...r, plantDetective: next } as HaruRecord) : r,
          ),
        );
      }

      setExpandedPlantIds((prev) => {
        const next = new Set(prev);
        selectedPlantEntryIds.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedPlantEntryIds(new Set());
      toast.success('선택한 식물 판독 기록을 삭제했습니다.');
    } catch (e) {
      console.error('식물 판독 기록 삭제 실패:', e);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setPlantDeleteBusy(false);
    }
  };

  const handleDeleteSinglePlantEntry = async (recordId: string, idx: number) => {
    if (!user?.uid) return;
    if (!window.confirm('이 식물 판독 기록을 삭제할까요?')) return;
    try {
      const record = records.find((r) => r.id === recordId);
      const current = Array.isArray((record as any)?.plantDetective)
        ? ((record as any).plantDetective as any[])
        : [];
      const next = current.filter((_, currentIdx) => currentIdx !== idx);
      await updateDoc(doc(db, 'users', user.uid, 'records', recordId), {
        plantDetective: next,
      });
      setRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? ({ ...r, plantDetective: next } as HaruRecord) : r,
        ),
      );
      toast.success('식물 판독 기록을 삭제했습니다.');
    } catch (e) {
      console.error('식물 판독 기록 삭제 실패:', e);
      toast.error('삭제에 실패했습니다.');
    }
  };

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

  const handleViewModeChange = (mode: 'list' | 'calendar') => {
    setViewMode(mode);
  };

  // 모든 형식 prefix 매핑
  const ALL_FORMAT_PREFIXES: Record<string, string> = {
    '일기': 'diary', '에세이': 'essay', '선교보고': 'mission',
    '일반보고': 'report', '업무일지': 'work', '여행기록': 'travel',
    '독서사유': 'reading',
    '텃밭일지': 'garden', '애완동물관찰일지': 'pet', '육아일기': 'child',
    '메모': 'memo',
    'HARU주식관리': 'stock',
    '주식거래일지': 'stock',
  };

  const META_SUFFIXES = ['_sayu', '_final_sayu', '_polished', '_polishedAt', '_mode', '_stats', '_images', '_rating', '_status', '_completedAt', '_reflection_questions', '_reflection_answers', '_entries_snapshot'];

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

  const FORMAT_COLORS: Record<string, string> = {
    diary:   '#1A3C6E',
    essay:   '#7C3AED',
    travel:  '#0EA5E9',
    reading: '#92400E',
    garden:  '#16A34A',
    pet:     '#F59E0B',
    child:   '#EC4899',
    mission: '#DC2626',
    report:  '#6B7280',
    work:    '#0D9488',
    memo:    '#D97706',
    haruraw: '#10b981',
    stock:   '#F59E0B',
  };

  const getFormatDotsForDay = (date: Date | null): { prefix: string; color: string }[] => {
    if (!date) return [];
    const dateStr = formatDateString(date);
    const dayRecords = records.filter((r) => r.date === dateStr);
    const seen = new Set<string>();
    const dots: { prefix: string; color: string }[] = [];
    dayRecords.forEach((record) => {
      if (record.formats?.includes('HARUraw' as any) && !seen.has('haruraw')) {
        seen.add('haruraw');
        dots.push({ prefix: 'haruraw', color: FORMAT_COLORS['haruraw'] });
      }
      record.formats?.forEach((format) => {
        const prefix = ALL_FORMAT_PREFIXES[format as string];
        if (!prefix || seen.has(prefix)) return;
        const hasContent = Object.keys(record).some(k =>
          k.startsWith(`${prefix}_`) &&
          !META_SUFFIXES.some(s => k.endsWith(s)) &&
          typeof record[k] === 'string' && (record[k] as string).trim().length > 0
        );
        if (hasContent) {
          seen.add(prefix);
          dots.push({ prefix, color: FORMAT_COLORS[prefix] ?? '#10b981' });
        }
      });
    });
    return dots;
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
      const formatsForRecord =
        Array.isArray(record.formats) && record.formats.length > 0
          ? record.formats
              .map((format) => ({ label: String(format), prefix: ALL_FORMAT_PREFIXES[String(format)] }))
              .filter((item) => item.prefix)
          : Object.entries(ALL_FORMAT_PREFIXES)
              .map(([label, prefix]) => ({ label, prefix }))
              .filter(({ prefix }) =>
                Object.keys(record).some((key) =>
                  key.startsWith(`${prefix}_`) &&
                  !META_SUFFIXES.some((suffix) => key.endsWith(suffix)) &&
                  typeof record[key] === 'string' &&
                  (record[key] as string).trim().length > 0,
                ),
              );

      formatsForRecord.forEach(({ label, prefix }) => {
        if (!prefix) return;
        const entryKey = `${prefix}_${record.id}`;
        if (!seenFormatKeys.has(entryKey)) {
          seenFormatKeys.add(entryKey);
          availableFormats.push({ key: prefix, label, recordId: record.id });
        }
      });
    });

    setSelectedDateFormats(availableFormats);
    if (availableFormats.length === 0) {
      toast.info('선택할 수 있는 형식 결과가 없습니다.');
    }
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

    let sayuContent = record[sayuKey] || record[`${formatKey}_final_sayu`] || '';
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

  const handleCopyRecord = async (recordId: string, formatKey: string) => {
    try {
      const record = records.find(r => r.id === recordId);
      if (!record) return;

      const textParts = Object.keys(record)
        .filter(k =>
          k.startsWith(`${formatKey}_`) &&
          typeof (record as any)[k] === 'string' &&
          ((record as any)[k] as string).trim() &&
          !k.endsWith('_sayu') &&
          !k.endsWith('_ai_title') &&
          !k.endsWith('_style') &&
          !k.endsWith('_images') &&
          !k.endsWith('_title')
        )
        .map(k => (record as any)[k] as string);

      const fullText = textParts.join('\n\n');
      if (!fullText.trim()) {
        toast.error('복사할 내용이 없습니다.');
        return;
      }

      await navigator.clipboard.writeText(fullText);
      toast.success('📋 클립보드에 복사되었습니다!');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  // Delete an AI log
  const handleDeleteAiLog = async (id: string) => {
    try {
      await firestoreService.deleteAiLogs(new Set([id]));
      setAiLogs(prev => prev.filter(l => l.id !== id));
      toast.success('삭제되었습니다');
    } catch { toast.error('삭제 실패'); }
  };

  const handleStarRating = async (logId: string, star: number) => {
    try {
      const newRating = aiLogs.find(l => l.id === logId)?.star_rating === star ? 0 : star;
      await updateDoc(doc(db, `users/${user!.uid}/records`, logId), {
        star_rating: newRating
      });
      setAiLogs(prev => prev.map(l =>
        l.id === logId ? { ...l, star_rating: newRating } : l
      ));
    } catch (e) {
      console.warn('별점 저장 실패:', e);
    }
  };

  const handleCopyAiLog = async (id: string) => {
    try {
      const log = aiLogs.find(l => l.id === id);
      if (!log) return;
      const content = (log as any).content as string | undefined;
      if (!content || !content.trim()) {
        toast.error('복사할 내용이 없습니다.');
        return;
      }
      await navigator.clipboard.writeText(content);
      toast.success('📋 클립보드에 복사되었습니다!');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  // 📚 책소재로 변환 — 선택한 AI 대화 1건을 책 재료 카드로 구조화
  // 보안: callable 은 logId / force 만 받음. 원본 content/title 은 서버가 Firestore 에서 다시 읽음.
  const handleConvertToBookMaterial = async (log: AiLog) => {
    const content = (log as any).content as string | undefined;
    if (!content || content.trim().length < 10) {
      toast.error('변환할 대화 내용이 너무 짧습니다.');
      return;
    }
    const already = !!(log as any).bookMaterial?.enabled;
    if (already && !window.confirm('이미 책소재로 변환된 항목입니다. 다시 변환하시겠습니까?')) {
      return;
    }
    try {
      setBookMaterialBusy(prev => { const n = new Set(prev); n.add(log.id); return n; });
      toast.info('📚 책소재로 변환 중...');
      const fns = getFunctions(undefined, 'asia-northeast3');
      const convertFn = httpsCallable(fns, 'convertToBookMaterial');
      const result = await convertFn({
        logId: log.id,
        force: already,
      });
      const data = (result.data || {}) as any;
      if (!data?.ok) throw new Error('AI 응답 형식 오류');
      setAiLogs(prev => prev.map(l => l.id === log.id ? ({ ...l, bookMaterial: data.bookMaterial } as any) : l));
      toast.success('✅ 책소재 변환 완료!');
    } catch (e: any) {
      console.error('책소재 변환 실패:', e);
      const code = e?.code || '';
      const msg = e?.message || '알 수 없는 오류';
      if (code === 'functions/permission-denied') toast.error('권한이 없습니다 (개발자 전용 기능)');
      else if (code === 'functions/not-found') toast.error('원본 기록을 찾을 수 없습니다.');
      else if (code === 'functions/failed-precondition') toast.error(msg);
      else toast.error(`변환 실패: ${msg}`);
    } finally {
      setBookMaterialBusy(prev => { const n = new Set(prev); n.delete(log.id); return n; });
    }
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
        entries: { date: string; title: string; aiTitle?: string; hasSayu: boolean; formatKey: string; recordId: string; keywords?: string[] }[];
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
        keywords: getRecordPreviewKeywords(r, 'haruraw'),
      }));
    if (harurawEntries.length > 0) {
      result.push({ category: '하루LAW', formats: [{ format: 'HARUraw' as any, entries: harurawEntries }] });
    }

    // 📈 HARU주식관리 — 전체 기간 기준 (월 필터 미적용)
    const stockEntries = records
      .filter((r: any) =>
        (r.formats && (r.formats.includes('HARU주식관리') || r.formats.includes('주식거래일지'))) || !!r.stock_name,
      )
      .map((r: any) => ({
        date: r.date,
        title: `${r.stock_name || ''} ${r.stock_type || ''} ${r.stock_quantity || ''}`.trim() || '(종목 없음)',
        hasSayu: Boolean(r.stock_sayu),
        formatKey: 'stock',
        recordId: r.id,
        keywords: getRecordPreviewKeywords(r, 'stock'),
      }));
    if (stockEntries.length > 0) {
      result.push({
        category: 'HARU주식관리',
        formats: [{ format: '주식거래일지' as RecordFormat, entries: stockEntries }],
      });
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
              keywords: getRecordPreviewKeywords(r, prefix),
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

  const handleListFormatHeaderClick = (
    formatKey: string,
    entries: { date: string; formatKey: string; recordId: string }[],
    formatLabel: string,
  ) => {
    if (entries.length === 1) {
      const entry = entries[0];
      openFormatSayu(entry.date, entry.formatKey, formatLabel, entry.recordId);
      return;
    }
    toggleFormat(formatKey);
  };

  type FlatSayuEntry = {
    id: string;
    date: string;
    label: string;
    title: string;
    subtitle?: string;
    color: string;
    keywords?: string[];
    onOpen: () => void;
    extra?: ReactNode;
  };

  const getSayuGroupKey = (tab: 'records' | 'assistants', label: string) => `${tab}_${label}`;

  const toggleSayuGroup = (groupKey: string) => {
    setExpandedSayuGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const getRecordFormatsForList = (record: HaruRecord) => {
    const formatsFromRecord = Array.isArray(record.formats)
      ? record.formats
          .map((format) => ({
            label: String(format),
            prefix: ALL_FORMAT_PREFIXES[String(format)],
          }))
          .filter((item) => item.prefix && item.prefix !== 'haruraw')
      : [];

    const formatsFromFields = Object.entries(ALL_FORMAT_PREFIXES)
      .filter(([, prefix]) => prefix !== 'haruraw')
      .map(([label, prefix]) => ({ label, prefix }))
      .filter(({ prefix }) => getRecordSourceText(record, prefix).trim().length > 0);

    const seen = new Set<string>();
    return [...formatsFromRecord, ...formatsFromFields].filter((item) => {
      if (seen.has(item.prefix)) return false;
      seen.add(item.prefix);
      return true;
    });
  };

  const isKnowledgeWarehouseRecord = (record: HaruRecord) => {
    const formats = Array.isArray(record.formats) ? record.formats.map(String) : [];
    const sourceText = [
      record.type,
      record.format,
      record.source,
      record.sourceType,
      record.provider,
      record.model,
    ].filter(Boolean).join(' ').toLowerCase();
    return (
      formats.some((format) => ['AI대화', 'ChatGPT', 'Claude', 'Gemini'].includes(format)) ||
      sourceText.includes('ai_log') ||
      sourceText.includes('claude') ||
      sourceText.includes('chatgpt') ||
      sourceText.includes('gemini') ||
      sourceText.includes('haru_ai') ||
      sourceText.includes('지식창고')
    );
  };

  const hasCompletedFormatForRecord = (record: HaruRecord, prefix: string) => {
    if (isKnowledgeWarehouseRecord(record)) return false;
    const sayu = record[`${prefix}_sayu`];
    const finalSayu = record[`${prefix}_final_sayu`];
    const status = record[`${prefix}_status`];
    return (
      (typeof sayu === 'string' && sayu.trim().length > 0) ||
      (typeof finalSayu === 'string' && finalSayu.trim().length > 0) ||
      record[`${prefix}_polished`] === true ||
      status === 'completed'
    );
  };

  const getRecordDisplayTitle = (record: HaruRecord, prefix: string, label: string) => {
    const title =
      String(record[`${prefix}_ai_title`] || '').trim() ||
      String(record[`${prefix}_title`] || '').trim() ||
      (prefix === 'reading'
        ? String(record.reading_book_title || record.reading_title || '').trim()
        : '') ||
      (prefix === 'stock'
        ? [record.stock_name, record.stock_type, record.stock_quantity].filter(Boolean).join(' ').trim()
        : '') ||
      String(record[FORMAT_FIRST_FIELD[prefix]] || '').trim();

    if (title) return title.slice(0, 48);
    const fallback = Object.keys(record).find((key) =>
      key.startsWith(`${prefix}_`) &&
      !META_SUFFIXES.some((suffix) => key.endsWith(suffix)) &&
      typeof record[key] === 'string' &&
      String(record[key]).trim().length > 0,
    );
    return fallback ? String(record[fallback]).trim().slice(0, 48) : label;
  };

  const isCurrentMonthDate = (dateStr: string) => {
    const [year, month] = String(dateStr || '').slice(0, 10).split('-').map(Number);
    return year === currentMonth.getFullYear() && month === currentMonth.getMonth() + 1;
  };

  const recordEntries: FlatSayuEntry[] = records
    .filter((record) => isCurrentMonthDate(record.date))
    .flatMap((record) =>
      getRecordFormatsForList(record)
        .filter(({ prefix }) => hasCompletedFormatForRecord(record, prefix))
        .map(({ label, prefix }) => ({
          id: `${record.id}_${prefix}`,
          date: record.date,
          label,
          title: getRecordDisplayTitle(record, prefix, label),
          subtitle: getRecordPreviewKeywords(record, prefix).slice(0, 4).join(' · '),
          color: FORMAT_COLORS[prefix] ?? '#1A3C6E',
          keywords: getRecordPreviewKeywords(record, prefix),
          onOpen: () => openFormatSayu(record.date, prefix, label, record.id),
        })),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));

  const assistantEntries: FlatSayuEntry[] = [
    ...records
      .filter((record) => (
        isCurrentMonthDate(record.date) &&
        !isKnowledgeWarehouseRecord(record) &&
        Array.isArray(record.formats) &&
        record.formats.includes('HARUraw' as any) &&
        getRecordSourceText(record, 'haruraw').trim().length > 0
      ))
      .map((record) => ({
        id: `${record.id}_haruraw`,
        date: record.date,
        label: '하루LAW',
        title: String((record as any).haruraw_query || '(질문 없음)').slice(0, 48),
        subtitle: getRecordPreviewKeywords(record, 'haruraw').slice(0, 4).join(' · '),
        color: FORMAT_COLORS.haruraw,
        keywords: getRecordPreviewKeywords(record, 'haruraw'),
        onOpen: () => openFormatSayu(record.date, 'haruraw', 'HARUraw', record.id),
      })),
    ...records
      .filter((record) => isCurrentMonthDate(record.date) && !isKnowledgeWarehouseRecord(record))
      .flatMap((record: any) =>
        (Array.isArray(record.plantDetective) ? record.plantDetective : []).map((entry: any, idx: number) => ({
          id: `${record.id}_plant_${idx}`,
          date: record.date,
          label: '하루식물탐정',
          title: String(entry?.title || entry?.userConfirmedName || entry?.humanReportedName || entry?.aiKoName || entry?.aiPrediction || '식물 판독 결과').slice(0, 48),
          subtitle: [entry?.englishName, entry?.scientificName || entry?.latinName].filter(Boolean).join(' / '),
          color: '#10b981',
          onOpen: () => setPlantPopupType('assistant'),
        })),
      ),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));

  const activeEntries = sayuTab === 'records' ? recordEntries : assistantEntries;
  const activeSelectedDate = sayuTab === 'records' ? selectedDate : selectedAssistantDate;
  const setActiveSelectedDate = sayuTab === 'records' ? setSelectedDate : setSelectedAssistantDate;
  const activeSelectedEntries = activeSelectedDate
    ? activeEntries.filter((entry) => entry.date === activeSelectedDate)
    : [];

  const getDotsForEntriesDay = (date: Date | null, entries: FlatSayuEntry[]) => {
    if (!date) return [];
    const dateStr = formatDateString(date);
    const seen = new Set<string>();
    return entries
      .filter((entry) => entry.date === dateStr)
      .filter((entry) => {
        const key = `${entry.label}_${entry.color}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  };

  const renderViewModeTabs = () => (
    <div
      role="tablist"
      style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 12,
        backgroundColor: '#F1EADB', marginBottom: 16,
        position: 'relative', zIndex: 2,
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'list'}
        onClick={() => handleViewModeChange('list')}
        style={{
          flex: 1, minHeight: 36, padding: '6px 0', borderRadius: 8,
          border: 'none', cursor: 'pointer', pointerEvents: 'auto',
          backgroundColor: viewMode === 'list' ? '#FFFFFF' : 'transparent',
          color: viewMode === 'list' ? '#1A3C6E' : '#7A6A4F',
          fontSize: 13, fontWeight: viewMode === 'list' ? 700 : 500,
          boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          transition: 'background-color 0.15s, color 0.15s',
        }}
      >
        목록
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'calendar'}
        onClick={() => handleViewModeChange('calendar')}
        style={{
          flex: 1, minHeight: 36, padding: '6px 0', borderRadius: 8,
          border: 'none', cursor: 'pointer', pointerEvents: 'auto',
          backgroundColor: viewMode === 'calendar' ? '#FFFFFF' : 'transparent',
          color: viewMode === 'calendar' ? '#1A3C6E' : '#7A6A4F',
          fontSize: 13, fontWeight: viewMode === 'calendar' ? 700 : 500,
          boxShadow: viewMode === 'calendar' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          transition: 'background-color 0.15s, color 0.15s',
        }}
      >
        달력
      </button>
    </div>
  );

  const renderGroupedEntryList = (entries: FlatSayuEntry[]) => {
    if (loading && sayuTab === 'records') {
      return <p className="text-center py-8 text-sm" style={{ color: '#999' }}>불러오는 중...</p>;
    }
    if (entries.length === 0) {
      return (
        <div className="bg-white rounded-lg p-8 shadow-sm text-center">
          <p className="text-sm" style={{ color: '#999' }}>
            {sayuTab === 'records' ? '이 달의 사유 기록이 없습니다' : '이 달의 사유비서 결과가 없습니다'}
          </p>
        </div>
      );
    }
    const groups = Array.from(entries.reduce((map, entry) => {
      const group = map.get(entry.label) || {
        label: entry.label,
        color: entry.color,
        latestDate: entry.date,
        entries: [] as FlatSayuEntry[],
      };
      group.entries.push(entry);
      if (entry.date > group.latestDate) group.latestDate = entry.date;
      if (!group.color) group.color = entry.color;
      map.set(entry.label, group);
      return map;
    }, new Map<string, { label: string; color: string; latestDate: string; entries: FlatSayuEntry[] }>()).values())
      .map((group) => ({
        ...group,
        entries: group.entries.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate) || a.label.localeCompare(b.label));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map((group) => {
          const groupKey = getSayuGroupKey(sayuTab, group.label);
          const isExpanded = expandedSayuGroups.has(groupKey);
          return (
            <section key={groupKey} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSayuGroup(groupKey)}
                className="w-full flex items-center gap-3 px-4 text-left hover:bg-yellow-50 transition-colors"
                aria-expanded={isExpanded}
                style={{ minHeight: 62 }}
              >
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: group.color, flexShrink: 0 }} />
                <span className="flex-1" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                    <span className="text-base font-semibold truncate" style={{ color: '#1A3C6E', minWidth: 0 }}>
                      {group.label}
                    </span>
                    <span style={{ color: '#6B7280', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {group.entries.length}개
                    </span>
                  </span>
                  <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>
                    최근 기록 {formatListDate(group.latestDate)}
                  </span>
                </span>
                <ChevronRight
                  className="w-4 h-4"
                  aria-hidden="true"
                  style={{
                    color: '#9CA3AF',
                    flexShrink: 0,
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                />
              </button>

              {isExpanded && (
                <div style={{ borderTop: '1px solid #f0f0f0' }}>
                  {group.entries.map((entry, idx) => (
                    <div key={entry.id} className={idx > 0 ? 'border-t' : ''} style={{ borderColor: '#f0f0f0' }}>
                      <button
                        type="button"
                        onClick={entry.onOpen}
                        className="w-full flex items-center gap-3 px-4 text-left hover:bg-yellow-50 transition-colors"
                        style={{ minHeight: 56, paddingLeft: 18 }}
                      >
                        <span className="text-xs font-medium flex-shrink-0" style={{ color: '#1A3C6E', minWidth: 36 }}>
                          {formatListDate(entry.date)}
                        </span>
                        <span className="flex-1" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                          <span className="text-sm truncate" style={{ color: '#333' }}>{entry.title}</span>
                          {entry.subtitle && (
                            <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4, overflowWrap: 'anywhere', wordBreak: 'keep-all', display: 'block' }}>
                              {entry.subtitle}
                            </span>
                          )}
                        </span>
                      </button>
                      {entry.extra}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  const renderFlatEntryList = (entries: FlatSayuEntry[]) => {
    if (loading && sayuTab === 'records') {
      return <p className="text-center py-8 text-sm" style={{ color: '#999' }}>불러오는 중...</p>;
    }
    if (entries.length === 0) {
      return (
        <div className="bg-white rounded-lg p-8 shadow-sm text-center">
          <p className="text-sm" style={{ color: '#999' }}>
            {sayuTab === 'records' ? '이 달의 사유 기록이 없습니다' : '이 달의 사유비서 결과가 없습니다'}
          </p>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {entries.map((entry, idx) => (
          <div key={entry.id} className={idx > 0 ? 'border-t' : ''} style={{ borderColor: '#f0f0f0' }}>
            <button
              type="button"
              onClick={entry.onOpen}
              className="w-full flex items-center gap-3 px-4 text-left hover:bg-yellow-50 transition-colors"
              style={{ minHeight: 56 }}
            >
              <span className="text-xs font-medium flex-shrink-0" style={{ color: '#1A3C6E', minWidth: 36 }}>
                {formatListDate(entry.date)}
              </span>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }} />
              <span className="flex-1" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                  <span className="text-sm truncate" style={{ color: '#333', flex: '1 1 auto', minWidth: 0 }}>{entry.title}</span>
                  <span style={{ color: '#999', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.label}</span>
                </span>
                {entry.subtitle && (
                  <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4, overflowWrap: 'anywhere', wordBreak: 'keep-all', display: 'block' }}>
                    {entry.subtitle}
                  </span>
                )}
              </span>
            </button>
            {entry.extra}
          </div>
        ))}
      </div>
    );
  };

  const renderEntryCalendar = (entries: FlatSayuEntry[]) => (
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
            const dateStr = day ? formatDateString(day) : '';
            const isToday = day && dateStr === formatDateString(new Date());
            const isSelected = day && activeSelectedDate === dateStr;
            const dots = getDotsForEntriesDay(day, entries);

            return (
              <button
                type="button"
                key={idx}
                onClick={() => {
                  if (!day) return;
                  if (dots.length === 0) {
                    toast.info('해당 날짜에 기록이 없습니다.');
                    return;
                  }
                  setActiveSelectedDate(dateStr);
                }}
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
                {dots.length > 0 && (
                  <div
                    className="absolute flex gap-0.5 justify-center flex-wrap"
                    style={{ bottom: '2px', left: 0, right: 0, maxWidth: '100%', padding: '0 2px' }}
                  >
                    {dots.map((dot) => (
                      <span
                        key={dot.id}
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: isSelected ? '#FEFBE8' : dot.color,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {activeSelectedDate && activeSelectedEntries.length > 0 && (
        <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
          <p className="text-xs font-semibold mb-2" style={{ color: '#1A3C6E' }}>
            {new Date(activeSelectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
              month: 'long',
              day: 'numeric',
            })}의 {sayuTab === 'records' ? '사유 기록' : '사유비서 결과'}
          </p>
          <div className="flex flex-wrap gap-2">
            {activeSelectedEntries.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={entry.onOpen}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80 hover:shadow-md cursor-pointer"
                style={{
                  backgroundColor: '#FDF6C3',
                  color: '#1A3C6E',
                  border: `1px solid ${entry.color}`,
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

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

    <div className="sayu-page-container no-print max-w-4xl mx-auto" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)', padding: 20 }}>
      <PageHeaderActions />
      {/* 타이틀 + 가이드 */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <SayuTitleAnimation />
        </div>
        <p className="text-xs" style={{ color: '#666666', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
          <Info className="w-3.5 h-3.5" style={{ color: '#1A3C6E', flexShrink: 0 }} />
          원문 감정 그대로, 문장만 자연스럽게 다듬습니다
        </p>
        {isDeveloper && (
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('내 기록의 keywords 캐시를 모두 삭제하고 새로 추출합니다. 진행할까요?')) return;
                try {
                  toast.info('키워드 캐시 청소 중...');
                  const fns = getFunctions(undefined, 'asia-northeast3');
                  const fn = httpsCallable(fns, 'clearKeywordsCache');
                  const r: any = await fn();
                  const d = r?.data || {};
                  toast.success(`청소 완료: 문서 ${d.docsUpdated || 0}개에서 필드 ${d.fieldsCleared || 0}개 삭제`);
                  // 로컬 state에서도 keywords 필드 제거 → 다음 IntersectionObserver 트리거 시 재추출
                  setRecords((prev) => prev.map((rec) => {
                    const next: any = { ...rec };
                    Object.keys(next).forEach((k) => { if (k === 'keywords' || k.endsWith('_keywords')) delete next[k]; });
                    return next;
                  }));
                  setAiLogs((prev) => prev.map((log) => {
                    const next: any = { ...log };
                    delete next.keywords;
                    return next;
                  }));
                } catch (err: any) {
                  console.error(err);
                  toast.error('청소 실패: ' + (err?.message || '알 수 없는 오류'));
                }
              }}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 8,
                border: '1px solid #D9D2EC', backgroundColor: '#fff',
                color: '#1A3C6E', cursor: 'pointer',
              }}
              title="개발자 전용 — 모든 record의 keywords 필드 삭제 후 새 프롬프트로 재추출"
            >🧹 키워드 캐시 청소</button>
          </div>
        )}
      </div>

      <div
        role="tablist"
        aria-label="SAYU 보기 선택"
        style={{
          display: 'flex',
          gap: 6,
          padding: 4,
          borderRadius: 12,
          backgroundColor: '#E5E7EB',
          marginBottom: 14,
        }}
      >
        {([
          { key: 'records', label: '사유기록' },
          { key: 'assistants', label: '사유비서' },
        ] as const).map((tab) => {
          const active = sayuTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSayuTab(tab.key);
              }}
              style={{
                flex: 1,
                minHeight: 44,
                padding: '9px 12px',
                borderRadius: 9,
                border: 'none',
                backgroundColor: active ? '#1A3C6E' : '#F3F4F6',
                color: active ? '#FFFFFF' : '#6B7280',
                fontSize: 14,
                fontWeight: active ? 800 : 700,
                cursor: 'pointer',
                boxShadow: active ? '0 1px 3px rgba(26,60,110,0.22)' : 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 월 선택 — 헤딩 + 변경 칩 (카드 제거) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C6E', margin: 0, letterSpacing: '-0.01em' }}>
          {monthName}
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="이전 달"
            style={{
              width: 32, height: 32, borderRadius: 999,
              border: '1px solid rgba(26,60,110,0.18)', background: '#fff',
              color: '#1A3C6E', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isNextMonthDisabled}
            aria-label="다음 달"
            style={{
              width: 32, height: 32, borderRadius: 999,
              border: '1px solid rgba(26,60,110,0.18)', background: '#fff',
              color: '#1A3C6E', cursor: isNextMonthDisabled ? 'not-allowed' : 'pointer',
              opacity: isNextMonthDisabled ? 0.3 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 목록 / 달력 segmented 탭 */}
      {renderViewModeTabs()}

      {viewMode === 'list' && renderGroupedEntryList(activeEntries)}
      {viewMode === 'calendar' && renderEntryCalendar(activeEntries)}

      {/* ─── 목록 뷰 ─── */}
      {false && viewMode === 'list' && (
        <div>
          {sayuTab === 'records' && (loading ? (
            <p className="text-center py-8 text-sm" style={{ color: '#999' }}>불러오는 중...</p>
          ) : !hasMonthRecords ? (
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <p className="text-sm" style={{ color: '#999' }}>이 달의 기록이 없습니다</p>
            </div>
          ) : (
            listData.map(({ category, formats }) => {
              if (category === '하루LAW') return null;
              if (category === 'HARU주식관리') return null;
              return (
              <div key={category} className="mb-4">
                {/* 카테고리 헤더 */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: '#FFFFFF', color: '#1A3C6E', padding: '0 16px', minHeight: 52, border: '1px solid #ECE6F5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: category === '생활' ? '#10b981' : category === '업무' ? '#1A3C6E' : '#9CA3AF', flexShrink: 0 }} />
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
                          {/* 형식 헤더 — 아이콘/형식명 + 통계/기록합치기 + 화살표 */}
                          <div className="flex items-center px-3 py-2" style={{ backgroundColor: '#f9fafb' }}>
                            {/* 아이콘 + 형식명 — 클릭 시 펼침/접힘 */}
                            <button
                              type="button"
                              onClick={() => handleListFormatHeaderClick(prefix, entries, String(format))}
                              className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
                              aria-label={`${String(format)} 결과 ${entries.length}개 ${entries.length === 1 ? '열기' : '펼치기'}`}
                            >
                              <span className="text-sm">{category === '하루LAW' ? '⚖️' : FORMAT_EMOJI[format as RecordFormat]}</span>
                              <span className="text-xs font-semibold" style={{ color: '#333' }}>{String(format)}</span>
                              <span className="text-xs" style={{ color: '#999' }}>({entries.length})</span>
                            </button>

                            {/* 통계 / 기록합치기 — 하루LAW·HARU주식관리 제외 */}
                            {category !== '하루LAW' && category !== 'HARU주식관리' && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/stats/${String(format)}`);
                                  }}
                                  style={{
                                    padding: '4px 10px', borderRadius: 20, border: '1px solid #1A3C6E',
                                    backgroundColor: 'transparent', color: '#1A3C6E',
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer', marginRight: 6, flexShrink: 0,
                                  }}
                                >통계</button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/merge');
                                  }}
                                  style={{
                                    padding: '4px 10px', borderRadius: 20, border: 'none',
                                    backgroundColor: '#1A3C6E', color: '#fff',
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer', marginRight: 8, flexShrink: 0,
                                  }}
                                >기록합치기</button>
                              </>
                            )}

                            {/* 펼침 화살표 */}
                            <button
                              type="button"
                              onClick={() => toggleFormat(prefix)}
                              aria-label={`${String(format)} 결과 ${isFormatExpanded ? '접기' : '펼치기'}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', flexShrink: 0 }}
                            >
                              <span style={{ fontSize: '10px', color: '#1A3C6E' }}>{isFormatExpanded ? '▼' : '▶'}</span>
                            </button>
                          </div>

                          {/* 📈 HARU주식관리 대시보드 — 주식만 전용 화면 */}
                          {isFormatExpanded && format === 'HARU주식관리' && (
                            <StockDashboard
                              records={entries
                                .map((e) => records.find((r) => r.id === e.recordId))
                                .filter(Boolean) as any[]}
                              onOpenRecord={(record) => openFormatSayu(record.date || String(record.stock_date || '').slice(0, 10), 'stock', '주식거래일지', record.recordId)}
                            />
                          )}
                          {/* 기록 목록 — 형식 펼쳤을 때만 표시 */}
                          {isFormatExpanded && format !== 'HARU주식관리' && (
                            <>
                              {pagedEntries.map((entry) => (
                                <div
                                  key={`${entry.date}-${entry.formatKey}-${entry.recordId}`}
                                  className="w-full flex items-center gap-1 border-t"
                                  style={{ borderColor: '#f5f5f5' }}
                                  ref={(el) => {
                                    if (!el) return;
                                    if (entry.keywords && entry.keywords.length > 0) return;
                                    const rec = records.find((r) => r.id === entry.recordId);
                                    if (!rec) return;
                                    observeKwTarget(el, { kind: 'record', id: entry.recordId, prefix: entry.formatKey, text: getRecordSourceText(rec, entry.formatKey) });
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="flex items-center gap-3 flex-1 px-4 text-left hover:bg-yellow-50 transition-colors"
                                    style={{ minHeight: 48 }}
                                    onClick={async () => {
                                      openFormatSayu(entry.date, entry.formatKey, format as any, entry.recordId);
                                      // ai_title 없으면 백그라운드 추출
                                      if (!entry.aiTitle) {
                                        try {
                                          const record = records.find(r => r.id === entry.recordId);
                                          if (record) {
                                            const prefix = entry.formatKey;
                                            const textForTitle = Object.keys(record)
                                              .filter(k => k.startsWith(`${prefix}_`) && typeof record[k] === 'string' && (record[k] as string).trim() && !k.endsWith('_sayu') && !k.endsWith('_title') && !k.endsWith('_style') && !k.endsWith('_images'))
                                              .map(k => record[k] as string)
                                              .join(' ');
                                            if (textForTitle.trim().length > 5) {
                                              const functions = getFunctions(undefined, 'asia-northeast3');
                                              const extractTitleFn = httpsCallable(functions, 'extractTitle');
                                              const result = await extractTitleFn({ text: textForTitle, format: entry.formatKey });
                                              const aiTitle = (result.data as any)?.title;
                                              if (aiTitle) {
                                                await updateDoc(doc(db, `users/${user!.uid}/records`, entry.recordId), {
                                                  [`${entry.formatKey}_ai_title`]: aiTitle
                                                });
                                                setRecords(prev => prev.map(r =>
                                                  r.id === entry.recordId ? { ...r, [`${entry.formatKey}_ai_title`]: aiTitle } : r
                                                ));
                                              }
                                            }
                                          }
                                        } catch (e) {
                                          console.warn('AI 제목 자동 추출 실패:', e);
                                        }
                                      }
                                    }}
                                  >
                                    <span className="text-xs font-medium flex-shrink-0" style={{ color: '#1A3C6E', minWidth: '32px' }}>{formatListDate(entry.date)}</span>
                                    <span className="flex-1" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                                        <span className="text-sm truncate" style={{ color: '#333', flex: '1 1 auto', minWidth: 0 }}>{entry.title}</span>
                                        {entry.aiTitle && entry.aiTitle !== entry.title && (
                                          <span style={{ color: '#999', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>({entry.aiTitle})</span>
                                        )}
                                      </span>
                                      {entry.keywords && entry.keywords.length > 0 && (
                                        <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4, overflowWrap: 'anywhere', wordBreak: 'keep-all', display: 'block' }}>
                                          {entry.keywords.slice(0, 6).join(' · ')}
                                        </span>
                                      )}
                                    </span>
                                    {entry.hasSayu && (
                                      <span className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', backgroundColor: '#10b981', display: 'inline-block' }} />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleCopyRecord(entry.recordId, entry.formatKey);
                                    }}
                                    className="px-3 py-2.5 text-xs flex-shrink-0 hover:text-blue-500 transition-colors"
                                    style={{ color: '#ccc' }}
                                    title="복사"
                                  >📋</button>
                                  <button
                                    type="button"
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
                                      type="button"
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
          ))}

          {/* 구분선 */}
          {sayuTab === 'records' && <hr className="my-4" style={{ borderColor: '#d1d5db' }} />}

          {/* 📚 내가 읽은 책 — 독서사유 final_reflection 만 최신순 리스트 */}
          {sayuTab === 'records' && (
          <div className="mb-4">
            <button
              onClick={() => toggleCategory('내가 읽은 책')}
              className="w-full flex items-center justify-between rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
              style={{ backgroundColor: '#FFFFFF', color: '#1A3C6E', padding: '0 16px', minHeight: 52, border: '1px solid #ECE6F5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }} />
                <BookOpen className="w-4 h-4" /> 내가 읽은 책
              </span>
              <span style={{ fontSize: '10px' }}>{collapsedCategories.has('내가 읽은 책') ? '▶' : '▼'}</span>
            </button>
            {!collapsedCategories.has('내가 읽은 책') && (() => {
              const finals = (records as any[])
                .filter((r) =>
                  r &&
                  Array.isArray(r.formats) &&
                  r.formats.includes('독서사유') &&
                  (
                    // canonical(v2) 필드 — 신규 저장 기준
                    r.entryType === READING_ENTRY_TYPES.FINAL ||
                    r.readingStatus === READING_STATUS.COMPLETED ||
                    // TODO(HARU-v3): legacy compatibility 제거 예정.
                    // 신규 구조(entryType/readingStatus/readingId) 기준으로 migration 계획.
                    r.readingEntryType === READING_ENTRY_TYPES.LEGACY_FINAL ||
                    r.reading_status === 'completed'
                  ),
                )
                .sort((a, b) => {
                  // 완독일 = reading_completedAt 우선, 없으면 date
                  const aKey = String(a.reading_completedAt || a.date || '');
                  const bKey = String(b.reading_completedAt || b.date || '');
                  return bKey.localeCompare(aKey);
                });
              if (finals.length === 0) {
                return (
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <p className="text-center py-4 text-xs" style={{ color: '#999' }}>
                      아직 마무리한 책이 없습니다. 기록 → 독서사유 → "독서마무리하기"로 첫 책을 마무리해 보세요.
                    </p>
                  </div>
                );
              }
              return (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  {finals.map((rec: any, idx: number) => {
                    const recId = String(rec.id || `idx_${idx}`);
                    const isOpen = expandedFinalReadingIds.has(recId);
                    const bodyText = String(
                      rec.reading_final_sayu || rec.reading_sayu || '',
                    ).trim();
                    return (
                      <div key={recId} className={idx > 0 ? 'border-t' : ''} style={{ borderColor: '#f0f0f0' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedFinalReadingIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(recId)) next.delete(recId); else next.add(recId);
                            return next;
                          })}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50"
                          style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#1A3C6E', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>📖</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {rec.reading_book_title || rec.reading_title || '(제목 없음)'}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                              {rec.reading_author ? `${rec.reading_author} · ` : ''}
                              {formatListDate(String(rec.reading_completedAt || rec.date || '').slice(0, 10))}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{isOpen ? '▼' : '▶'}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0 16px 14px 16px' }}>
                            <pre style={{
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
                              fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0,
                              padding: '12px 14px',
                              backgroundColor: '#F9FAFB', borderRadius: 8, border: '1px solid #f0f0f0',
                            }}>
                              {bodyText || '(내용이 비어 있습니다)'}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          )}

          {/* 하루충전소 */}
          {sayuTab === 'records' && (
          <div className="mb-4">
            <button
              onClick={() => toggleCategory('하루충전소')}
              className="w-full flex items-center justify-between rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
              style={{ backgroundColor: '#FFFFFF', color: '#1A3C6E', padding: '0 16px', minHeight: 52, border: '1px solid #ECE6F5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EAB308', flexShrink: 0 }} />
                <BookOpen className="w-4 h-4" /> 원기충전소
              </span>
              <span style={{ fontSize: '10px' }}>{collapsedCategories.has('하루충전소') ? '▶' : '▼'}</span>
            </button>
            {!collapsedCategories.has('하루충전소') && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* 개발자 전용: 사람속으로 / 나도작가 버튼 */}
                {isDeveloper && (
                  <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <button
                      onClick={() => navigate('/recovery')}
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
                      onClick={() => navigate('/prophecy-hub')}
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
          )}

          {/* snsHARU 진입 카드 — 원기충전소 다음 위치 */}
          {sayuTab === 'records' && (
          <button
            type="button"
            onClick={() => navigate('/sns-records')}
            style={{
              width: '100%',
              padding: '12px 14px',
              marginBottom: 16,
              borderRadius: 10,
              border: '1px solid #BBDDF5',
              backgroundColor: '#E8F4FD',
              color: '#1A3C6E',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>📱 snsHARU</span>
            <span style={{ fontSize: 14, color: '#1A3C6E' }}>›</span>
          </button>
          )}

          {/* 📈 HARU주식관리 — snsHARU 직후 위치 */}
          {sayuTab === 'records' && (() => {
            const stockCat = listData.find(c => c.category === 'HARU주식관리');
            const category = stockCat?.category || 'HARU주식관리';
            const formats = stockCat?.formats || [];
            return (
              <>
                {stockCat && (
                  <div key={category} className="mb-4">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
                      style={{ backgroundColor: '#FFFFFF', color: '#1A3C6E', padding: '0 16px', minHeight: 52, border: '1px solid #ECE6F5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B', flexShrink: 0 }} />
                        {category}
                      </span>
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
                      const prefix = FORMAT_PREFIX[format as RecordFormat];
                      const isFormatExpanded = expandedFormats.has(prefix);
                      const searchTerm = (categorySearch[category] || '').toLowerCase();
                      const filteredEntries = searchTerm
                        ? entries.filter(e => e.title.toLowerCase().includes(searchTerm))
                        : entries;
                      const pageKey = `${prefix}_${category}`;
                      const page = formatPages[pageKey] || 1;
                      const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);

                      return (
                        <div
                          key={String(format)}
                          className={fIdx > 0 ? 'border-t' : ''}
                          style={{ borderColor: '#f0f0f0' }}
                        >
                          <div className="flex items-center px-3 py-2" style={{ backgroundColor: '#f9fafb' }}>
                            <button
                              type="button"
                              onClick={() => handleListFormatHeaderClick(prefix, entries, String(format))}
                              className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
                              aria-label={`${String(format)} 결과 ${entries.length}개 ${entries.length === 1 ? '열기' : '펼치기'}`}
                            >
                              <span className="text-sm">{FORMAT_EMOJI[format as RecordFormat]}</span>
                              <span className="text-xs font-semibold" style={{ color: '#333' }}>{String(format)}</span>
                              <span className="text-xs" style={{ color: '#999' }}>({entries.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/stats/${String(format)}`);
                              }}
                              style={{
                                padding: '4px 10px', borderRadius: 20, border: '1px solid #1A3C6E',
                                backgroundColor: 'transparent', color: '#1A3C6E',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer', marginRight: 6, flexShrink: 0,
                              }}
                            >통계</button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/merge');
                              }}
                              style={{
                                padding: '4px 10px', borderRadius: 20, border: 'none',
                                backgroundColor: '#1A3C6E', color: '#fff',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer', marginRight: 8, flexShrink: 0,
                              }}
                            >기록합치기</button>
                            <button
                              type="button"
                              onClick={() => toggleFormat(prefix)}
                              aria-label={`${String(format)} 결과 ${isFormatExpanded ? '접기' : '펼치기'}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', flexShrink: 0 }}
                            >
                              <span style={{ fontSize: '10px', color: '#1A3C6E' }}>{isFormatExpanded ? '▼' : '▶'}</span>
                            </button>
                          </div>

                          {/* 📈 HARU주식관리 대시보드 — 주식 전용 */}
                          {isFormatExpanded && (
                            <StockDashboard
                              records={entries
                                .map((e) => records.find((r) => r.id === e.recordId))
                                .filter(Boolean) as any[]}
                              onOpenRecord={(record) => openFormatSayu(record.date || String(record.stock_date || '').slice(0, 10), 'stock', '주식거래일지', record.recordId)}
                            />
                          )}

                          {totalPages > 1 && (
                            <div className="flex justify-center gap-1 py-2 px-3 border-t" style={{ borderColor: '#f0f0f0' }}>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                  type="button"
                                  key={p}
                                  onClick={() => setFormatPages(prev => ({ ...prev, [pageKey]: p }))}
                                  className="w-7 h-7 rounded text-xs font-medium transition-all"
                                  style={{ backgroundColor: page === p ? '#1A3C6E' : '#f3f4f6', color: page === p ? '#fff' : '#333' }}
                                >{p}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                  </div>
                )}
                {false && plantPopupType && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="하루식물탐정 팝업"
                    onClick={() => setPlantPopupType(null)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 1000,
                      background: 'rgba(17, 24, 39, 0.42)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 16,
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 'min(560px, 100%)',
                        maxHeight: '78vh',
                        overflow: 'hidden',
                        borderRadius: 12,
                        background: plantPopupType === 'catalog' ? '#ECFDF5' : '#fffdf4',
                        border: plantPopupType === 'catalog' ? '1px solid #b8dfd5' : '1px solid #e8dfba',
                        boxShadow: '0 18px 45px rgba(0,0,0,0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '14px 16px',
                          borderBottom: '1px solid rgba(0,0,0,0.08)',
                          background: '#fff',
                        }}
                      >
                        <div style={{ fontSize: 16, fontWeight: 950, color: plantPopupType === 'catalog' ? '#0F766E' : '#4A5A2C' }}>
                          {plantPopupType === 'assistant' && '식물탐정비서'}
                          {plantPopupType === 'diary' && '성장일기'}
                          {plantPopupType === 'library' && '개인도감'}
                          {plantPopupType === 'catalog' && '공개도감'}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPlantPopupType(null)}
                          aria-label="팝업 닫기"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            color: '#1A3C6E',
                            fontSize: 18,
                            cursor: 'pointer',
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <div style={{ padding: 14, overflowY: 'auto' }}>
                        {plantPopupType === 'assistant' && (
                          <div style={{ display: 'grid', gap: 10 }}>
                            <button
                              type="button"
                              onClick={() => navigate('/plant-detective')}
                              style={{
                                minHeight: 46,
                                borderRadius: 8,
                                border: '1px solid #4A5A2C',
                                background: '#4A5A2C',
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 900,
                                cursor: 'pointer',
                              }}
                            >
                              식물탐정비서로 이동
                            </button>
                            {plantEntries.length > 0 ? (
                              <div style={{ display: 'grid', gap: 8 }}>
                                {plantEntries.slice(0, 5).map(({ date, recordId, entry, idx }) => (
                                  <div key={`assistant_recent_${recordId}_${idx}`} style={{ border: '1px solid #f0ead1', borderRadius: 8, background: '#fff', padding: 10 }}>
                                    <button
                                      type="button"
                                      onClick={() => navigate('/plant-detective')}
                                      style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                    >
                                      <div style={{ fontSize: 11, color: '#92996f', fontWeight: 800 }}>{date}</div>
                                      <div style={{ fontSize: 14, color: '#24301f', fontWeight: 900, marginTop: 2 }}>
                                        {getPlantTitle(entry)}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#6b7654', marginTop: 4 }}>
                                        클릭하여 식물탐정 상세 화면으로 이동
                                      </div>
                                    </button>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSinglePlantEntry(recordId, idx)}
                                        style={{
                                          minHeight: 28,
                                          padding: '0 10px',
                                          borderRadius: 7,
                                          border: '1px solid #fecaca',
                                          background: '#fff',
                                          color: '#dc2626',
                                          fontSize: 12,
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: '#6b7654', lineHeight: 1.6 }}>
                                아직 식물탐정 판독 기록이 없습니다.
                              </div>
                            )}
                          </div>
                        )}

                        {plantPopupType === 'diary' && (
                          plantObservationEntries.length > 0 ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {plantObservationEntries.slice(0, 30).map(({ date, recordId, entry, idx }) => {
                                const title = entry?.plantName || entry?.title || '식물 관찰';
                                const photo = entry?.imageUrl || (Array.isArray(entry?.imageUrls) ? entry.imageUrls[0] : '');
                                const linkedPlant = plantLibraryItems.find((plant) => isPlantDiaryForItem(entry, plant));
                                const DiaryTag = linkedPlant ? 'button' : 'div';
                                return (
                                  <DiaryTag
                                    key={`${recordId}_popup_obs_${idx}`}
                                    type={linkedPlant ? 'button' : undefined}
                                    onClick={linkedPlant ? () => openPlantDiaryDetail(linkedPlant) : undefined}
                                    style={{
                                      display: 'flex',
                                      width: '100%',
                                      gap: 10,
                                      border: '1px solid #f0ead1',
                                      borderRadius: 8,
                                      background: '#fff',
                                      padding: 10,
                                      textAlign: 'left',
                                      cursor: linkedPlant ? 'pointer' : 'default',
                                    }}
                                  >
                                    {photo ? (
                                      <img src={photo} alt={title} style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                                    ) : (
                                      <div style={{ width: 54, height: 54, borderRadius: 6, background: '#eef0d8', display: 'grid', placeItems: 'center', color: '#4A5A2C', flexShrink: 0 }}>
                                        <Leaf size={20} />
                                      </div>
                                    )}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: 11, color: '#92996f', fontWeight: 800 }}>{date}</div>
                                      <div className="truncate" style={{ fontSize: 14, color: '#24301f', fontWeight: 900 }}>{title}</div>
                                      {entry?.observation && (
                                        <div style={{ marginTop: 4, fontSize: 12, color: '#3d4734', lineHeight: 1.45 }}>
                                          {String(entry.observation)}
                                        </div>
                                      )}
                                    </div>
                                  </DiaryTag>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: '#6b7654', lineHeight: 1.6 }}>
                              아직 저장된 성장일기가 없습니다.
                            </div>
                          )
                        )}

                        {plantPopupType === 'library' && (
                          plantLibraryItems.length > 0 ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {plantLibraryItems.slice(0, 30).map((item) => renderMiniPlantCard(item, false, () => openPlantDiaryDetail(item)))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: '#6b7654', lineHeight: 1.6 }}>
                              아직 내 식물도감에 저장된 식물이 없습니다.
                            </div>
                          )
                        )}

                        {plantPopupType === 'catalog' && (
                          plantCatalogItems.length > 0 ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {plantCatalogItems.slice(0, 30).map((item) => renderMiniPlantCard(item, true))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: '#37675f', lineHeight: 1.6 }}>
                              아직 공개 식물도감에 표시할 식물이 없습니다.
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* 하루LAW */}
          {sayuTab === 'assistants' && (() => {
            const haruLawCategory = listData.find(d => d.category === '하루LAW');
            if (!haruLawCategory) return null;
            const { category, formats } = haruLawCategory;
            return (
              <div key={category} className="mb-4">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: '#FFFFFF', color: '#1A3C6E', padding: '0 16px', minHeight: 52, border: '1px solid #ECE6F5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#8B4789', flexShrink: 0 }} />
                    <Scale className="w-4 h-4" /> 하루LAW
                  </span>
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
                                <div
                                  key={`${entry.date}-${entry.formatKey}-${entry.recordId}`}
                                  className="w-full flex items-center gap-1 border-t"
                                  style={{ borderColor: '#f5f5f5' }}
                                  ref={(el) => {
                                    if (!el) return;
                                    if (entry.keywords && entry.keywords.length > 0) return;
                                    const rec = records.find((r) => r.id === entry.recordId);
                                    if (!rec) return;
                                    observeKwTarget(el, { kind: 'record', id: entry.recordId, prefix: entry.formatKey, text: getRecordSourceText(rec, entry.formatKey) });
                                  }}
                                >
                                  <button
                                    className="flex items-center gap-3 flex-1 px-4 text-left hover:bg-yellow-50 transition-colors"
                                    style={{ minHeight: 48 }}
                                    onClick={async () => {
                                      openFormatSayu(entry.date, entry.formatKey, format as any, entry.recordId);
                                      // ai_title 없으면 백그라운드 추출
                                      if (!entry.aiTitle) {
                                        try {
                                          const record = records.find(r => r.id === entry.recordId);
                                          if (record) {
                                            const prefix = entry.formatKey;
                                            const textForTitle = Object.keys(record)
                                              .filter(k => k.startsWith(`${prefix}_`) && typeof record[k] === 'string' && (record[k] as string).trim() && !k.endsWith('_sayu') && !k.endsWith('_title') && !k.endsWith('_style') && !k.endsWith('_images'))
                                              .map(k => record[k] as string)
                                              .join(' ');
                                            if (textForTitle.trim().length > 5) {
                                              const functions = getFunctions(undefined, 'asia-northeast3');
                                              const extractTitleFn = httpsCallable(functions, 'extractTitle');
                                              const result = await extractTitleFn({ text: textForTitle, format: entry.formatKey });
                                              const aiTitle = (result.data as any)?.title;
                                              if (aiTitle) {
                                                await updateDoc(doc(db, `users/${user!.uid}/records`, entry.recordId), {
                                                  [`${entry.formatKey}_ai_title`]: aiTitle
                                                });
                                                setRecords(prev => prev.map(r =>
                                                  r.id === entry.recordId ? { ...r, [`${entry.formatKey}_ai_title`]: aiTitle } : r
                                                ));
                                              }
                                            }
                                          }
                                        } catch (e) {
                                          console.warn('AI 제목 자동 추출 실패:', e);
                                        }
                                      }
                                    }}
                                  >
                                    <span className="text-xs font-medium flex-shrink-0" style={{ color: '#1A3C6E', minWidth: '32px' }}>{formatListDate(entry.date)}</span>
                                    <span className="flex-1" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                                        <span className="text-sm truncate" style={{ color: '#333', flex: '1 1 auto', minWidth: 0 }}>{entry.title}</span>
                                        {entry.aiTitle && entry.aiTitle !== entry.title && (
                                          <span style={{ color: '#999', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>({entry.aiTitle})</span>
                                        )}
                                      </span>
                                      {entry.keywords && entry.keywords.length > 0 && (
                                        <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4, overflowWrap: 'anywhere', wordBreak: 'keep-all', display: 'block' }}>
                                          {entry.keywords.slice(0, 6).join(' · ')}
                                        </span>
                                      )}
                                    </span>
                                  </button>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleCopyRecord(entry.recordId, entry.formatKey);
                                    }}
                                    className="px-3 py-2.5 text-xs flex-shrink-0 hover:text-blue-500 transition-colors"
                                    style={{ color: '#ccc' }}
                                    title="복사"
                                  >📋</button>
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

          {/* 🌱 하루식물탐정 — 시간 누적 식별 기록 (records[].plantDetective 배열에서 추출) */}
          {sayuTab === 'assistants' && (() => {
            const plantEntries: { date: string; recordId: string; entry: any; idx: number }[] = [];
            const plantObservationEntries: { date: string; recordId: string; entry: any; idx: number }[] = [];
            records.forEach((r: any) => {
              const arr = Array.isArray(r?.plantDetective) ? r.plantDetective : [];
              arr.forEach((e: any, i: number) => {
                if (e && typeof e === 'object') {
                  plantEntries.push({ date: r.date || r.id, recordId: r.id, entry: e, idx: i });
                }
              });
              const obsArr = Array.isArray(r?.plantObservation) ? r.plantObservation : [];
              obsArr.forEach((e: any, i: number) => {
                if (e && typeof e === 'object') {
                  plantObservationEntries.push({ date: r.date || r.id, recordId: r.id, entry: e, idx: i });
                }
              });
            });
            plantEntries.sort((a, b) => {
              const ta = getDiarySortTime(a.entry?.createdAt || a.entry?.createdDate || a.date);
              const tb = getDiarySortTime(b.entry?.createdAt || b.entry?.createdDate || b.date);
              if (tb !== ta) return tb - ta;
              return (b.date || '').localeCompare(a.date || '');
            });
            plantObservationEntries.sort((a, b) => {
              const ta = getDiarySortTime(a.entry?.createdAt || a.entry?.createdDate || a.date);
              const tb = getDiarySortTime(b.entry?.createdAt || b.entry?.createdDate || b.date);
              if (tb !== ta) return tb - ta;
              return (b.date || '').localeCompare(a.date || '');
            });
            const expanded = !collapsedCategories.has('하루식물탐정');
            const renderList = (title: string, items: any) => {
              if (!Array.isArray(items) || items.length === 0) return null;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#555', marginBottom: 4 }}>{title}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#3d4734', fontSize: 12, lineHeight: 1.55 }}>
                    {items.slice(0, 5).map((it: any, i: number) => (
                      <li key={i}>{String(it)}</li>
                    ))}
                  </ul>
                </div>
              );
            };
            const getPlantTitle = (entry: any) => {
              const aiName = entry?.aiKoName || entry?.aiPrediction || '';
              const userName = entry?.userConfirmedName || entry?.humanReportedName || '';
              if (aiName && userName && aiName !== userName) {
                return `AI 판독: ${aiName} / 사용자 보고: ${userName}`;
              }
              return entry?.title || userName || aiName || entry?.plantName || '식물 이름 불확실';
            };
            const getPlantSubTitle = (entry: any) =>
              [entry?.englishName, entry?.scientificName || entry?.latinName].filter(Boolean).join(' / ');
            const getLibraryName = (item: SayuPlantLibraryItem) =>
              item.displayName || item.userConfirmedName || item.finalGuess || '식물 이름 불확실';
            const getLibrarySub = (item: SayuPlantLibraryItem) =>
              [item.englishName, item.scientificName || item.finalLatinName].filter(Boolean).join(' / ');
            const getLibraryDate = (item: SayuPlantLibraryItem) => {
              const raw = item.updatedAt || item.createdAt;
              const date =
                typeof raw?.toDate === 'function'
                  ? raw.toDate()
                  : raw
                    ? new Date(raw)
                    : null;
              return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '';
            };
            const renderMiniPlantCard = (item: SayuPlantLibraryItem, watermark = false, onOpen?: () => void) => {
              const photo = item.imageUrl || item.photos?.[0] || '';
              const name = getLibraryName(item);
              const sub = getLibrarySub(item);
              const CardTag = onOpen ? 'button' : 'div';
              return (
                <CardTag
                  key={item.id}
                  type={onOpen ? 'button' : undefined}
                  onClick={onOpen}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    width: '100%',
                    gap: 10,
                    alignItems: 'center',
                    border: '1px solid #f0ead1',
                    borderRadius: 8,
                    background: '#fff',
                    padding: 10,
                    overflow: 'hidden',
                    textAlign: 'left',
                    cursor: onOpen ? 'pointer' : 'default',
                  }}
                >
                  {watermark && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 6,
                        color: 'rgba(15, 118, 110, 0.15)',
                        fontSize: 15,
                        fontWeight: 950,
                        pointerEvents: 'none',
                      }}
                    >
                      {item.watermarkText || 'HARU2026 식물탐정'}
                    </div>
                  )}
                  {photo ? (
                    <img src={photo} alt={name} style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 54, height: 54, borderRadius: 6, background: '#eef0d8', display: 'grid', placeItems: 'center', color: '#4A5A2C', flexShrink: 0 }}>
                      <Leaf size={20} />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1, position: 'relative' }}>
                    <div className="truncate" style={{ fontSize: 14, fontWeight: 900, color: '#24301f' }}>{name}</div>
                    {sub && (
                      <div className="truncate" style={{ fontSize: 11, color: '#6b7654', fontStyle: 'italic', marginTop: 2 }}>{sub}</div>
                    )}
                    <div style={{ fontSize: 10, color: '#92996f', marginTop: 4 }}>
                      {getLibraryDate(item) || '도감'}
                      {typeof item.observationCount === 'number' ? ` · ${item.observationCount}회` : ''}
                      {Array.isArray(item.photos) ? ` · 사진 ${item.photos.length}장` : ''}
                    </div>
                  </div>
                </CardTag>
              );
            };
            const totalPlantCount = plantEntries.length;
            const selectedPlantDiaryEntries = selectedPlantDiaryItem
              ? plantObservationEntries.filter(({ entry }) => isPlantDiaryForItem(entry, selectedPlantDiaryItem))
              : [];
            const editingPlantDiaryEntry = editingPlantDiaryKey
              ? plantObservationEntries.find(({ recordId, idx }) => recordId === editingPlantDiaryKey.recordId && idx === editingPlantDiaryKey.idx)
              : null;
            return (
              <div className="mb-4">
                <button
                  onClick={() => toggleCategory('하루식물탐정')}
                  className="w-full flex items-center justify-between rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: '#FFFFFF', color: '#1A3C6E', padding: '0 16px', minHeight: 52, border: '1px solid #ECE6F5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }} />
                    🌱 하루식물탐정
                    <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>({totalPlantCount})</span>
                  </span>
                  <span style={{ fontSize: '10px' }}>{expanded ? '▼' : '▶'}</span>
                </button>
                {expanded && (
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="px-4 py-3" style={{ borderTop: '1px solid #f5f5f5', background: '#fffdf4' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setPlantPopupType('assistant')}
                          style={{
                            minHeight: 42,
                            border: '1px solid #d8c98a',
                            borderRadius: 8,
                            background: '#fff',
                            color: '#4A5A2C',
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          식물탐정비서 열기
                        </button>
                      </div>
                    </div>

                  </div>
                )}
                {plantPopupType && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="하루식물탐정 팝업"
                    onClick={() => setPlantPopupType(null)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 1000,
                      background: 'rgba(17, 24, 39, 0.42)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 16,
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 'min(560px, 100%)',
                        maxHeight: '78vh',
                        overflow: 'hidden',
                        borderRadius: 12,
                        background: plantPopupType === 'catalog' ? '#ECFDF5' : '#fffdf4',
                        border: plantPopupType === 'catalog' ? '1px solid #b8dfd5' : '1px solid #e8dfba',
                        boxShadow: '0 18px 45px rgba(0,0,0,0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '14px 16px',
                          borderBottom: '1px solid rgba(0,0,0,0.08)',
                          background: '#fff',
                        }}
                      >
                        <div style={{ fontSize: 16, fontWeight: 950, color: plantPopupType === 'catalog' ? '#0F766E' : '#4A5A2C' }}>
                          {plantPopupType === 'assistant' && '식물탐정비서'}
                          {plantPopupType === 'diary' && '성장일기'}
                          {plantPopupType === 'library' && '개인도감'}
                          {plantPopupType === 'catalog' && '공개도감'}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPlantPopupType(null)}
                          aria-label="팝업 닫기"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            color: '#1A3C6E',
                            fontSize: 18,
                            cursor: 'pointer',
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <div style={{ padding: 14, overflowY: 'auto' }}>
                        {plantPopupType === 'assistant' && (
                          <div style={{ display: 'grid', gap: 10 }}>
                            <button
                              type="button"
                              onClick={() => navigate('/plant-detective')}
                              style={{
                                minHeight: 46,
                                borderRadius: 8,
                                border: '1px solid #4A5A2C',
                                background: '#4A5A2C',
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 900,
                                cursor: 'pointer',
                              }}
                            >
                              식물탐정비서로 이동
                            </button>
                            {plantEntries.length > 0 ? (
                              <div style={{ display: 'grid', gap: 8 }}>
                                {plantEntries.slice(0, 5).map(({ date, recordId, entry, idx }) => (
                                  <div key={`assistant_recent_${recordId}_${idx}`} style={{ border: '1px solid #f0ead1', borderRadius: 8, background: '#fff', padding: 10 }}>
                                    <button
                                      type="button"
                                      onClick={() => navigate('/plant-detective')}
                                      style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                    >
                                      <div style={{ fontSize: 11, color: '#92996f', fontWeight: 800 }}>{date}</div>
                                      <div style={{ fontSize: 14, color: '#24301f', fontWeight: 900, marginTop: 2 }}>
                                        {getPlantTitle(entry)}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#6b7654', marginTop: 4 }}>
                                        클릭하여 식물탐정 상세 화면으로 이동
                                      </div>
                                    </button>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSinglePlantEntry(recordId, idx)}
                                        style={{
                                          minHeight: 28,
                                          padding: '0 10px',
                                          borderRadius: 7,
                                          border: '1px solid #fecaca',
                                          background: '#fff',
                                          color: '#dc2626',
                                          fontSize: 12,
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: '#6b7654', lineHeight: 1.6 }}>
                                아직 식물탐정 판독 기록이 없습니다.
                              </div>
                            )}
                          </div>
                        )}

                        {plantPopupType === 'diary' && (
                          plantObservationEntries.length > 0 ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {plantObservationEntries.slice(0, 30).map(({ date, recordId, entry, idx }) => {
                                const title = entry?.plantName || entry?.title || '식물 관찰';
                                const photo = entry?.imageUrl || (Array.isArray(entry?.imageUrls) ? entry.imageUrls[0] : '');
                                const trace = getPlantDiaryTrace(entry, date);
                                const linkedPlant = plantLibraryItems.find((plant) => isPlantDiaryForItem(entry, plant));
                                const diaryPlant = linkedPlant || {
                                  id: String(entry?.plantId || `diary_${recordId}_${idx}`),
                                  displayName: title,
                                  userConfirmedName: entry?.userConfirmedName || entry?.humanReportedName || entry?.plantName || title,
                                  finalGuess: entry?.aiKoName || entry?.aiPrediction || title,
                                  englishName: entry?.englishName,
                                  scientificName: entry?.scientificName || entry?.latinName,
                                  imageUrl: photo,
                                  photos: Array.isArray(entry?.imageUrls) ? entry.imageUrls : photo ? [photo] : [],
                                } as SayuPlantLibraryItem;
                                return (
                                  <button
                                    key={`${recordId}_popup_obs_${idx}`}
                                    type="button"
                                    onClick={() => {
                                      setSelectedPlantDiaryItem(diaryPlant);
                                      handleEditPlantDiary(recordId, idx, entry);
                                    }}
                                    style={{
                                      display: 'flex',
                                      width: '100%',
                                      gap: 10,
                                      border: '1px solid #f0ead1',
                                      borderRadius: 8,
                                      background: '#fff',
                                      padding: 10,
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {photo ? (
                                      <img src={photo} alt={title} style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                                    ) : (
                                      <div style={{ width: 54, height: 54, borderRadius: 6, background: '#eef0d8', display: 'grid', placeItems: 'center', color: '#4A5A2C', flexShrink: 0 }}>
                                        <Leaf size={20} />
                                      </div>
                                    )}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: 11, color: '#92996f', fontWeight: 800 }}>{trace.recordLabel}</div>
                                      {trace.editedLabel && (
                                        <div style={{ marginTop: 2, fontSize: 11, color: '#7a6a2c', fontWeight: 800 }}>
                                          {trace.editedLabel}
                                        </div>
                                      )}
                                      <div className="truncate" style={{ fontSize: 14, color: '#24301f', fontWeight: 900 }}>{title}</div>
                                      {entry?.observation && (
                                        <div style={{ marginTop: 4, fontSize: 12, color: '#3d4734', lineHeight: 1.45 }}>
                                          {String(entry.observation)}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: '#6b7654', lineHeight: 1.6 }}>
                              아직 저장된 성장일기가 없습니다.
                            </div>
                          )
                        )}

                        {plantPopupType === 'library' && (
                          plantLibraryItems.length > 0 ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {plantLibraryItems.slice(0, 30).map((item) => renderMiniPlantCard(item, false, () => openPlantDiaryDetail(item)))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: '#6b7654', lineHeight: 1.6 }}>
                              아직 내 식물도감에 저장된 식물이 없습니다.
                            </div>
                          )
                        )}

                        {plantPopupType === 'catalog' && (
                          plantCatalogItems.length > 0 ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {plantCatalogItems.slice(0, 30).map((item) => renderMiniPlantCard(item, true))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: '#37675f', lineHeight: 1.6 }}>
                              아직 공개 식물도감에 표시할 식물이 없습니다.
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {selectedPlantDiaryItem && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="식물 성장일기 편집"
                    onClick={closePlantDiaryDetail}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 1010,
                      background: 'rgba(17, 24, 39, 0.48)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 16,
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 'min(620px, 100%)',
                        maxHeight: '82vh',
                        overflow: 'hidden',
                        borderRadius: 12,
                        background: '#fffdf4',
                        border: '1px solid #e8dfba',
                        boxShadow: '0 18px 45px rgba(0,0,0,0.28)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#fff' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="truncate" style={{ fontSize: 16, color: '#4A5A2C', fontWeight: 950 }}>
                            {getSayuPlantName(selectedPlantDiaryItem)} 성장일기
                          </div>
                          <div style={{ fontSize: 11, color: '#92996f', marginTop: 3 }}>
                            개인도감 식물별로 계속 추가·수정할 수 있습니다.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={closePlantDiaryDetail}
                          aria-label="성장일기 편집 닫기"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            color: '#1A3C6E',
                            fontSize: 18,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>

                      <div style={{ padding: 14, overflowY: 'auto', display: 'grid', gap: 12 }}>
                        <div style={{ border: '1px solid #f0ead1', borderRadius: 8, background: '#fff', padding: 12, display: 'grid', gap: 8 }}>
                          <div style={{ fontSize: 13, color: '#24301f', fontWeight: 900 }}>
                            {editingPlantDiaryKey ? '성장일기 추가 및 수정' : '성장일기 추가'}
                          </div>
                          {editingPlantDiaryEntry && (() => {
                            const trace = getPlantDiaryTrace(editingPlantDiaryEntry.entry, editingPlantDiaryEntry.date);
                            return (
                              <div style={{ border: '1px solid #efe7c9', borderRadius: 8, background: '#fffdf4', padding: 8, fontSize: 11, color: '#6b7654', lineHeight: 1.55 }}>
                                <div>{trace.recordLabel}</div>
                                {trace.editedLabel && <div>{trace.editedLabel}</div>}
                                {trace.editCount > 0 && <div>수정 흔적 {trace.editCount}회 보존 중</div>}
                                {plantDiaryInputMode === 'append' && (
                                  <div style={{ color: '#4A5A2C', fontWeight: 900 }}>
                                    같은 날짜에 새 성장 기록으로 추가됩니다.
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <textarea
                            value={plantDiaryDraft.observation}
                            onChange={(e) => setPlantDiaryDraft((prev) => ({ ...prev, observation: e.target.value }))}
                            placeholder="오늘의 성장 상태, 잎·줄기·흙·꽃 변화"
                            rows={3}
                            style={{ width: '100%', resize: 'vertical', border: '1px solid #e5ddbf', borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.5 }}
                          />
                          <textarea
                            value={plantDiaryDraft.aiDifference}
                            onChange={(e) => setPlantDiaryDraft((prev) => ({ ...prev, aiDifference: e.target.value }))}
                            placeholder="AI 판독과 다르게 보인 점"
                            rows={2}
                            style={{ width: '100%', resize: 'vertical', border: '1px solid #e5ddbf', borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.5 }}
                          />
                          <textarea
                            value={plantDiaryDraft.memo}
                            onChange={(e) => setPlantDiaryDraft((prev) => ({ ...prev, memo: e.target.value }))}
                            placeholder="물주기, 햇빛, 비료, 다음 관리 메모"
                            rows={2}
                            style={{ width: '100%', resize: 'vertical', border: '1px solid #e5ddbf', borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.5 }}
                          />
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <label
                              style={{
                                minHeight: 36,
                                padding: '0 12px',
                                borderRadius: 8,
                                border: '1px solid #b8c28c',
                                color: '#4A5A2C',
                                background: '#fff',
                                fontSize: 12,
                                fontWeight: 900,
                                display: 'inline-flex',
                                alignItems: 'center',
                                cursor: plantDiarySaving ? 'wait' : 'pointer',
                              }}
                            >
                              {editingPlantDiaryKey && plantDiaryInputMode === 'append' ? '사진 추가하고 기록 추가' : '사진 추가하고 저장'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={plantDiarySaving}
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  e.target.value = '';
                                  if (file) handleSavePlantDiary(selectedPlantDiaryItem, file);
                                }}
                                style={{ display: 'none' }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleSavePlantDiary(selectedPlantDiaryItem)}
                              disabled={plantDiarySaving}
                              style={{
                                minHeight: 36,
                                padding: '0 12px',
                                borderRadius: 8,
                                border: '1px solid #4A5A2C',
                                background: plantDiarySaving ? '#eef0d8' : '#4A5A2C',
                                color: plantDiarySaving ? '#7b8b4b' : '#fff',
                                fontSize: 12,
                                fontWeight: 900,
                                cursor: plantDiarySaving ? 'wait' : 'pointer',
                              }}
                            >
                              {plantDiarySaving
                                ? '저장 중...'
                                : editingPlantDiaryKey
                                  ? plantDiaryInputMode === 'edit' ? '수정 저장' : '추가 저장'
                                  : '글만 저장'}
                            </button>
                            {editingPlantDiaryKey && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (plantDiaryInputMode === 'edit') {
                                    setPlantDiaryInputMode('append');
                                    setPlantDiaryDraft(emptyPlantDiaryDraft);
                                  } else if (editingPlantDiaryEntry) {
                                    handleEditPlantDiary(editingPlantDiaryEntry.recordId, editingPlantDiaryEntry.idx, editingPlantDiaryEntry.entry);
                                  }
                                }}
                                disabled={plantDiarySaving}
                                style={{
                                  minHeight: 36,
                                  padding: '0 12px',
                                  borderRadius: 8,
                                  border: '1px solid #e5ddbf',
                                  background: '#fff',
                                  color: '#6b7654',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: plantDiarySaving ? 'wait' : 'pointer',
                                }}
                              >
                                {plantDiaryInputMode === 'edit' ? '이 날짜에 새 기록 추가' : '수정 입력으로 돌아가기'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                          {selectedPlantDiaryEntries.length > 0 ? (
                            selectedPlantDiaryEntries.map(({ date, recordId, entry, idx }) => {
                              const photo = entry?.imageUrl || (Array.isArray(entry?.imageUrls) ? entry.imageUrls[0] : '');
                              const images = Array.isArray(entry?.imageUrls) ? entry.imageUrls.filter(Boolean) : photo ? [photo] : [];
                              const trace = getPlantDiaryTrace(entry, date);
                              return (
                                <div
                                  key={`${recordId}_plant_detail_${idx}`}
                                  style={{
                                    width: '100%',
                                    border: '1px solid #f0ead1',
                                    borderRadius: 8,
                                    background: '#fff',
                                    padding: 10,
                                    textAlign: 'left',
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleEditPlantDiary(recordId, idx, entry)}
                                    style={{
                                      width: '100%',
                                      border: 'none',
                                      background: 'transparent',
                                      padding: 0,
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    {photo ? (
                                      <img src={photo} alt={getSayuPlantName(selectedPlantDiaryItem)} style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                                    ) : (
                                      <div style={{ width: 58, height: 58, borderRadius: 6, background: '#eef0d8', display: 'grid', placeItems: 'center', color: '#4A5A2C', flexShrink: 0 }}>
                                        <Leaf size={20} />
                                      </div>
                                    )}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: 11, color: '#92996f', fontWeight: 800 }}>{trace.recordLabel}</div>
                                      {trace.editedLabel && (
                                        <div style={{ marginTop: 2, fontSize: 11, color: '#7a6a2c', fontWeight: 800 }}>
                                          {trace.editedLabel}
                                        </div>
                                      )}
                                      {entry?.observation && <p style={{ margin: '4px 0 0', color: '#24301f', fontSize: 13, lineHeight: 1.5 }}>{String(entry.observation)}</p>}
                                      {entry?.aiDifference && <p style={{ margin: '4px 0 0', color: '#7a6a2c', fontSize: 12, lineHeight: 1.45 }}>AI와 다른 점: {String(entry.aiDifference)}</p>}
                                      {entry?.memo && <p style={{ margin: '4px 0 0', color: '#6b7654', fontSize: 12, lineHeight: 1.45 }}>메모: {String(entry.memo)}</p>}
                                      {images.length > 1 && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
                                          {images.slice(0, 6).map((url: string, imageIdx: number) => (
                                            <img key={`${recordId}_${idx}_detail_photo_${imageIdx}`} src={url} alt={`성장사진 ${imageIdx + 1}`} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5ddbf', flexShrink: 0 }} />
                                          ))}
                                        </div>
                                      )}
                                      {trace.editHistory.length > 0 && (
                                        <div style={{ marginTop: 8, borderTop: '1px dashed #e5ddbf', paddingTop: 6, display: 'grid', gap: 3, fontSize: 11, color: '#7a6a2c', lineHeight: 1.45 }}>
                                          <div style={{ fontWeight: 900 }}>수정 흔적 {trace.editHistory.length}회</div>
                                          {trace.editHistory.map((history: any, historyIdx: number) => {
                                            const editedDate = normalizeDiaryDateKey(history?.editedDate || history?.editedAt, trace.updatedDate || trace.recordDate);
                                            const daysAfterRecord = typeof history?.daysAfterRecord === 'number'
                                              ? history.daysAfterRecord
                                              : getDaysBetweenDateKeys(trace.recordDate, editedDate);
                                            const previousText = summarizeTraceText(history?.previousObservation || history?.previousMemo || history?.previousAiDifference);
                                            return (
                                              <div key={`${recordId}_${idx}_history_${historyIdx}`}>
                                                {historyIdx + 1}. {formatKoreanDate(editedDate)} 수정 · {formatDaysAfterRecord(daysAfterRecord)}
                                                {previousText ? ` · 이전: ${previousText}` : ''}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  </button>
                                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleEditPlantDiary(recordId, idx, entry)}
                                      style={{
                                        minHeight: 30,
                                        padding: '0 10px',
                                        borderRadius: 7,
                                        border: '1px solid #e5ddbf',
                                        background: '#fffdf4',
                                        color: '#4A5A2C',
                                        fontSize: 12,
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      수정하기
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePlantDiaryEntry(recordId, idx, entry)}
                                      disabled={plantDiarySaving}
                                      style={{
                                        minHeight: 30,
                                        padding: '0 10px',
                                        borderRadius: 7,
                                        border: '1px solid #fecaca',
                                        background: plantDiarySaving ? '#f3f4f6' : '#fff',
                                        color: plantDiarySaving ? '#9ca3af' : '#dc2626',
                                        fontSize: 12,
                                        fontWeight: 800,
                                        cursor: plantDiarySaving ? 'wait' : 'pointer',
                                      }}
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ border: '1px solid #f0ead1', borderRadius: 8, background: '#fff', padding: 12, fontSize: 13, color: '#6b7654', lineHeight: 1.6 }}>
                              이 식물의 성장일기가 아직 없습니다. 위 입력란에서 첫 성장일기를 추가해 주세요.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 하루AI지식창고 (개발자 전용) */}
          {sayuTab === 'assistants' && isDeveloper && (
          <div className="mb-4">
            <button
              onClick={() => toggleCategory('하루AI지식창고')}
              className="w-full flex items-center justify-between rounded-lg mb-1 text-sm font-semibold transition-colors hover:opacity-80"
              style={{ backgroundColor: '#FFFFFF', color: '#1A3C6E', padding: '0 16px', minHeight: 52, border: '1px solid #ECE6F5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6366F1', flexShrink: 0 }} />
                <Cpu className="w-4 h-4" /> 하루AI지식창고
              </span>
              <span style={{ fontSize: '10px' }}>{collapsedCategories.has('하루AI지식창고') ? '▶' : '▼'}</span>
            </button>
            {!collapsedCategories.has('하루AI지식창고') && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* search */}
                <div className="px-3 py-2" style={{ backgroundColor: '#f9fafb' }}>
                  <input
                    type="text"
                    value={aiSearch}
                    onChange={e => { setAiSearch(e.target.value); setAiPage(1); }}
                    placeholder={aiSearchMode === 'title' ? '제목으로 검색...' : '본문 키워드로 검색...'}
                    className="w-full px-3 py-1.5 text-xs rounded border outline-none"
                    style={{ borderColor: '#d1d5db', backgroundColor: '#fff', fontSize: 14 }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={() => { setAiSearchMode('title'); setAiSearch(''); setAiPage(1); }}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        backgroundColor: aiSearchMode === 'title' ? '#1A3C6E' : '#e5e7eb',
                        color: aiSearchMode === 'title' ? '#fff' : '#6B7280',
                      }}
                    >📌 제목 검색</button>
                    <button
                      onClick={() => { setAiSearchMode('content'); setAiSearch(''); setAiPage(1); }}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        backgroundColor: aiSearchMode === 'content' ? '#1A3C6E' : '#e5e7eb',
                        color: aiSearchMode === 'content' ? '#fff' : '#6B7280',
                      }}
                    >🔍 본문 검색</button>
                  </div>
                </div>
                {aiLogsLoading ? (
                  <p className="text-center py-4 text-xs" style={{ color: '#999' }}>불러오는 중...</p>
                ) : (() => {
                  const filtered = aiSearch
                    ? aiLogs.filter(l => {
                        const term = aiSearch.toLowerCase();
                        if (aiSearchMode === 'content') {
                          return (l.content || '').toLowerCase().includes(term);
                        }
                        return (l.ai_title || l.title || '').toLowerCase().includes(term);
                      })
                    : aiLogs;
                  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                  const paged = filtered.slice((aiPage - 1) * PAGE_SIZE, aiPage * PAGE_SIZE);
                  if (filtered.length === 0) return <p className="text-center py-4 text-xs" style={{ color: '#999' }}>기록이 없습니다</p>;
                  return (
                    <>
                      {paged.map((log) => (
                        <div
                          key={log.id}
                          className="border-t"
                          style={{ borderColor: '#f5f5f5' }}
                          ref={(el) => {
                            if (!el) return;
                            const stored = (log as any).keywords;
                            if (Array.isArray(stored) && stored.length > 0) return;
                            observeKwTarget(el, { kind: 'ailog', id: log.id, text: getAiLogSourceText(log) });
                          }}
                        >
                          <div
                            className="flex items-center cursor-pointer"
                            style={{ backgroundColor: selectedAiLog?.id === log.id ? '#f0f4ff' : 'transparent' }}
                            onClick={async () => {
                              setSelectedAiLog(selectedAiLog?.id === log.id ? null : log);
                              // ai_title 없으면 백그라운드 자동 추출
                              if (!log.ai_title && log.content && (log.content as string).trim().length > 5) {
                                try {
                                  const fns = getFunctions(undefined, 'asia-northeast3');
                                  const extractTitleFn = httpsCallable(fns, 'extractTitle');
                                  const result = await extractTitleFn({ text: (log.content as string).slice(0, 500), format: 'ai_log' });
                                  const aiTitle = (result.data as any)?.title;
                                  if (aiTitle) {
                                    await updateDoc(doc(db, `users/${user!.uid}/records`, log.id), { ai_title: aiTitle });
                                    setAiLogs(prev => prev.map(l => l.id === log.id ? { ...l, ai_title: aiTitle } : l));
                                  }
                                } catch (e) {
                                  console.warn('AI지식창고 제목 추출 실패:', e);
                                }
                              }
                            }}
                          >
                            <div className="flex-1 px-4 py-2.5" style={{ minWidth: 0 }}>
                              <p className="text-sm truncate" style={{ color: '#333' }}>
                                {log.ai_title || log.title || '(제목 없음)'}
                              </p>
                              {(() => {
                                const stored = (log as any).keywords;
                                const kws = Array.isArray(stored) && stored.length > 0
                                  ? stored.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 6)
                                  : extractPreviewKeywords(((log as any).content as string) || log.ai_title || log.title || '');
                                if (kws.length === 0) return null;
                                return (
                                  <p style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4, marginTop: 2, overflowWrap: 'anywhere', wordBreak: 'keep-all' }}>
                                    {kws.join(' · ')}
                                  </p>
                                );
                              })()}
                              {log.source && <p className="text-xs mt-0.5" style={{ color: '#999' }}>{log.source}</p>}
                              {(log as any).bookMaterial?.enabled && (
                                <p className="text-xs mt-0.5" style={{ color: '#1A3C6E', fontWeight: 600 }}>
                                  📚 책소재 완료
                                  {(log as any).bookMaterial?.materialGrade && (
                                    <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 99, backgroundColor: '#EEF2FF', color: '#4338CA' }}>
                                      {(log as any).bookMaterial.materialGrade}급
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            <span className="px-2 text-xs" style={{ color: '#aaa' }}>
                              {selectedAiLog?.id === log.id ? '▲' : '▼'}
                            </span>
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', paddingRight: 4 }}
                            >
                              {[1, 2, 3].map(star => (
                                <button
                                  key={star}
                                  onClick={e => { e.stopPropagation(); handleStarRating(log.id, star); }}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 14, padding: '0 1px', lineHeight: 1,
                                    color: (log.star_rating || 0) >= star ? '#F59E0B' : '#e5e7eb',
                                  }}
                                  title={`별 ${star}개`}
                                >★</button>
                              ))}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyAiLog(log.id); }}
                              className="px-3 py-2.5 text-xs flex-shrink-0 hover:text-blue-500 transition-colors"
                              style={{ color: '#ccc' }} title="복사"
                            >📋</button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleConvertToBookMaterial(log); }}
                              disabled={bookMaterialBusy.has(log.id)}
                              className="px-3 py-2.5 text-xs flex-shrink-0 transition-colors"
                              style={{
                                color: (log as any).bookMaterial?.enabled ? '#1A3C6E' : '#ccc',
                                cursor: bookMaterialBusy.has(log.id) ? 'wait' : 'pointer',
                                opacity: bookMaterialBusy.has(log.id) ? 0.5 : 1,
                              }}
                              title={
                                bookMaterialBusy.has(log.id)
                                  ? '변환 중...'
                                  : (log as any).bookMaterial?.enabled
                                    ? '다시 책소재로 변환'
                                    : '책소재로 변환'
                              }
                            >
                              {bookMaterialBusy.has(log.id) ? '⏳' : (log as any).bookMaterial?.enabled ? '🔄' : '📚'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteAiLog(log.id); }}
                              className="px-3 py-2.5 text-xs flex-shrink-0 hover:text-red-600 transition-colors"
                              style={{ color: '#ccc' }} title="삭제"
                            >✕</button>
                          </div>
                          {selectedAiLog?.id === log.id && (
                            <>
                              {(() => {
                                const bm = (log as any).bookMaterial;
                                if (!bm?.enabled) return null;
                                // 신규 v3-passage 필드 (없으면 v2/v1 폴백)
                                const bookSummary: string = bm.bookSummary || bm.summary3 || '';
                                const passages: string[] = Array.isArray(bm.bookPassages) ? bm.bookPassages.filter((s: any) => typeof s === 'string' && s.trim()) : [];
                                // v2 데이터에서 재변환 전인 경우만 사용 (legacy fallback)
                                const v2QuoteLines: string[] = Array.isArray(bm.bookQuoteLines) ? bm.bookQuoteLines : [];
                                const v2Insight: string[] = Array.isArray(bm.bookInsightLines) ? bm.bookInsightLines : [];
                                const v2Scene: string[] = Array.isArray(bm.bookSceneLines) ? bm.bookSceneLines : [];
                                const v2Emotion: string[] = Array.isArray(bm.bookEmotionLines) ? bm.bookEmotionLines : [];
                                const v1Core: string[] = Array.isArray(bm.coreSentences) ? bm.coreSentences : [];
                                const isLegacyOnly = passages.length === 0 && (
                                  v2QuoteLines.length > 0 || v2Insight.length > 0 || v2Scene.length > 0 || v2Emotion.length > 0 || v1Core.length > 0
                                );
                                const chapters: string[] = Array.isArray(bm.chapterCandidates) ? bm.chapterCandidates : [];
                                const tags: string[] = Array.isArray(bm.topicTags) ? bm.topicTags : [];
                                return (
                                  <div className="px-4 py-3 text-xs leading-relaxed"
                                    style={{ backgroundColor: '#FEF6E0', color: '#1A3C6E', borderTop: '1px solid #FCE5A1' }}>
                                    {/* 1) 책소재 제목 */}
                                    <p style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>
                                      📚 책소재 — {bm.bookMaterialTitle || '(제목 없음)'}
                                      <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 99, backgroundColor: '#EEF2FF', color: '#4338CA' }}>
                                        {bm.materialGrade}급
                                      </span>
                                      {bm.promptVersion && (
                                        <span style={{ marginLeft: 6, fontSize: 9, color: '#9CA3AF' }}>
                                          {bm.promptVersion}
                                        </span>
                                      )}
                                    </p>

                                    {/* 2) 책소재 요약 */}
                                    {bookSummary && (
                                      <div style={{ marginBottom: 10 }}>
                                        <p style={{ fontWeight: 700, color: '#1A3C6E', margin: 0 }}>책소재 요약</p>
                                        <p style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{bookSummary}</p>
                                      </div>
                                    )}

                                    {/* v5-vibeflow — 인간+AI 사고 흐름 5종 (원문 보존 기반) */}
                                    {(() => {
                                      const humanQ: string = bm.humanQuestionCore || '';
                                      const aiR: string = bm.aiResponseCore || '';
                                      const shift: string = bm.thinkingShift || '';
                                      const collab: string = bm.collaborationMoment || '';
                                      const vibe: string = bm.vibeFlow || '';
                                      const vibeScore: number | undefined = typeof bm.vibeVerbatimScore === 'number' ? bm.vibeVerbatimScore : undefined;
                                      if (!humanQ && !aiR && !shift && !collab && !vibe) return null;
                                      const Block = ({ icon, label, text }: { icon: string; label: string; text: string }) => (
                                        text ? (
                                          <div style={{
                                            marginBottom: 8, padding: '8px 10px',
                                            background: '#FFFFFF', border: '1px solid #F0E4C2', borderRadius: 6,
                                          }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: 11, color: '#1A3C6E' }}>
                                              {icon} {label}
                                            </p>
                                            <p style={{ margin: '3px 0 0', whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, color: '#1F2937' }}>
                                              {text}
                                            </p>
                                          </div>
                                        ) : null
                                      );
                                      const scoreColor = (s: number) =>
                                        s >= 0.7 ? { bg: '#DCFCE7', fg: '#166534', label: '원문 그대로' }
                                        : s >= 0.4 ? { bg: '#FEF3C7', fg: '#92400E', label: '부분 인용' }
                                        : { bg: '#FEE2E2', fg: '#991B1B', label: 'AI 재창작 의심' };
                                      return (
                                        <div style={{ marginBottom: 10 }}>
                                          <p style={{ fontWeight: 700, color: '#1A3C6E', margin: '0 0 6px' }}>
                                            인간 + AI 사고 흐름
                                          </p>
                                          {/* 1) 인간 질문 핵심 */}
                                          <Block icon="🧑" label="인간 질문 핵심" text={humanQ} />
                                          {/* 2) AI 응답 핵심 */}
                                          <Block icon="🤖" label="AI 응답 핵심" text={aiR} />
                                          {/* 3) 사고 변화 */}
                                          <Block icon="💡" label="사고 변화" text={shift} />
                                          {/* 4) AI 협업 장면 */}
                                          <Block icon="🤝" label="AI 협업 장면" text={collab} />
                                          {/* 5) 바이브 흐름 */}
                                          {vibe && (
                                            <div style={{
                                              marginBottom: 8, padding: '10px 12px',
                                              background: '#F0EDF8', border: '1px solid #D9D2EC', borderRadius: 6,
                                            }}>
                                              <p style={{ margin: 0, fontWeight: 700, fontSize: 11, color: '#1A3C6E' }}>
                                                🌊 바이브 흐름 (질문 → 응답 → 깨달음)
                                                {typeof vibeScore === 'number' && (
                                                  <span style={{
                                                    marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 99,
                                                    background: scoreColor(vibeScore).bg, color: scoreColor(vibeScore).fg, fontWeight: 600,
                                                  }}>
                                                    원문보존 {Math.round(vibeScore * 100)}% · {scoreColor(vibeScore).label}
                                                  </span>
                                                )}
                                              </p>
                                              <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.7, color: '#1F2937' }}>
                                                {vibe}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* 6) 책 인용문단 — v4-verbatim: 원문 보존 중심 */}
                                    {passages.length > 0 && (() => {
                                      const scores: number[] = Array.isArray(bm.passageVerbatimScores) ? bm.passageVerbatimScores : [];
                                      const avg: number | undefined = typeof bm.verbatimAverage === 'number' ? bm.verbatimAverage : undefined;
                                      const scoreColor = (s: number) =>
                                        s >= 0.7 ? { bg: '#DCFCE7', fg: '#166534', label: '원문 그대로' }
                                        : s >= 0.4 ? { bg: '#FEF3C7', fg: '#92400E', label: '부분 인용' }
                                        : { bg: '#FEE2E2', fg: '#991B1B', label: 'AI 재창작 의심' };
                                      return (
                                        <div style={{ marginBottom: 10 }}>
                                          <p style={{ fontWeight: 700, color: '#1A3C6E', margin: '0 0 4px' }}>
                                            책 인용문단 ({passages.length}개) — 원문 그대로 중심
                                            {typeof avg === 'number' && (
                                              <span style={{
                                                marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 99,
                                                background: scoreColor(avg).bg, color: scoreColor(avg).fg, fontWeight: 600,
                                              }}>
                                                원문보존 평균 {Math.round(avg * 100)}%
                                              </span>
                                            )}
                                          </p>
                                          {passages.map((p, i) => {
                                            const s = scores[i];
                                            const c = typeof s === 'number' ? scoreColor(s) : null;
                                            return (
                                              <div key={i} style={{ marginBottom: 10 }}>
                                                <blockquote
                                                  style={{
                                                    margin: 0,
                                                    padding: '8px 10px',
                                                    borderLeft: '3px solid #C9A75A',
                                                    background: '#FFFBEC',
                                                    whiteSpace: 'pre-wrap',
                                                    fontSize: 12,
                                                    lineHeight: 1.7,
                                                    color: '#1F2937',
                                                  }}
                                                >
                                                  {p}
                                                </blockquote>
                                                {c && (
                                                  <p style={{
                                                    margin: '2px 0 0', fontSize: 9, color: c.fg, textAlign: 'right',
                                                  }}>
                                                    원문보존 {Math.round(s * 100)}% · {c.label}
                                                  </p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}

                                    {/* 레거시 fallback — 재변환 전 옛 데이터일 때만 표시 */}
                                    {isLegacyOnly && (
                                      <div style={{
                                        marginBottom: 10, padding: '8px 10px',
                                        background: '#FFFFFF', border: '1px dashed #FCE5A1',
                                        borderRadius: 6,
                                      }}>
                                        <p style={{ fontSize: 10, color: '#92400E', margin: '0 0 4px' }}>
                                          ⚠️ 옛 버전(한 줄 명언) 책소재입니다. 🔄 재변환을 누르면 책 인용문단으로 다시 만들어집니다.
                                        </p>
                                        {[
                                          { label: '책 인용문장', items: v2QuoteLines },
                                          { label: '깨달음 문장', items: v2Insight },
                                          { label: '장면 문장', items: v2Scene },
                                          { label: '감정·철학 문장', items: v2Emotion },
                                          { label: '핵심문장 (v1)', items: v1Core },
                                        ].filter(x => x.items.length > 0).map(({ label, items }) => (
                                          <div key={label} style={{ marginTop: 6 }}>
                                            <p style={{ fontWeight: 600, color: '#1A3C6E', margin: 0, fontSize: 11 }}>{label}</p>
                                            <ul style={{ marginLeft: 14, marginTop: 2, listStyleType: 'disc', fontSize: 11 }}>
                                              {items.map((s, i) => <li key={i} style={{ marginBottom: 2 }}>{s}</li>)}
                                            </ul>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* 4) 챕터 후보 */}
                                    {chapters.length > 0 && (
                                      <p style={{ marginBottom: 4 }}>
                                        <strong>예상 챕터:</strong> {chapters.join(' · ')}
                                      </p>
                                    )}

                                    {/* 5) 태그 */}
                                    {tags.length > 0 && (
                                      <p style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>
                                        #{tags.join(' #')}
                                      </p>
                                    )}

                                    {/* 재변환 안내 */}
                                    <p style={{ fontSize: 10, color: '#92400E', marginTop: 8, paddingTop: 6, borderTop: '1px dashed #FCE5A1' }}>
                                      💡 v4 부터 AI는 작가가 아니라 큐레이터입니다. 원문에서 강한 부분을 그대로 살립니다. 카드 상단 🔄 버튼으로 재변환하면 책 사용 흔적은 보존됩니다.
                                    </p>
                                  </div>
                                );
                              })()}
                              <div className="px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap"
                                style={{ backgroundColor: '#f8faff', color: '#333', borderTop: '1px solid #eef2ff' }}>
                                {(log as any).content || '내용 없음'}
                              </div>
                            </>
                          )}
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
          )}

          {/* 나의 작품 진입 카드 — PDF 생성 결과물 통합 라이브러리 (원기충전소로 진입) */}
          {sayuTab === 'records' && (
          <button
            type="button"
            onClick={() => navigate('/recovery')}
            style={{
              width: '100%',
              padding: '12px 14px',
              marginBottom: 16,
              borderRadius: 10,
              border: '1px solid #D9D2EC',
              backgroundColor: '#F0EDF8',
              color: '#1A3C6E',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>📖 나의 작품</span>
            <span style={{ fontSize: 14, color: '#1A3C6E' }}>›</span>
          </button>
          )}
        </div>
      )}

      {/* ─── 달력 뷰 ─── */}
      {false && sayuTab === 'records' && viewMode === 'calendar' && (
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
                const formatDots = getFormatDotsForDay(day);

                return (
                  <button
                    type="button"
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
                    {formatDots.length > 0 && (
                      <div
                        className="absolute flex gap-0.5 justify-center flex-wrap"
                        style={{ bottom: '2px', left: 0, right: 0, maxWidth: '100%', padding: '0 2px' }}
                      >
                        {formatDots.slice(0, 5).map((dot, i) => (
                          <span
                            key={i}
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              backgroundColor: isSelected ? '#FEFBE8' : dot.color,
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                        ))}
                      </div>
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
                    type="button"
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


      {/* 📊 통계/합치기 모달 */}
      {formatStatModal.isOpen && (
        <div
          onClick={() => setFormatStatModal(prev => ({ ...prev, isOpen: false }))}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxHeight: '80vh', backgroundColor: '#fff', borderRadius: '16px 16px 0 0', padding: 20, overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E' }}>
                📋 {formatStatModal.format} 기록 관리
              </p>
              <button
                onClick={() => setFormatStatModal(prev => ({ ...prev, isOpen: false }))}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}
              >✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['stat', 'merge'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFormatStatModal(prev => ({ ...prev, tab }))}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    backgroundColor: formatStatModal.tab === tab ? '#1A3C6E' : '#f3f4f6',
                    color: formatStatModal.tab === tab ? '#fff' : '#6B7280',
                  }}
                >
                  {tab === 'stat' ? '📊 통계' : '📎 합치기'}
                </button>
              ))}
            </div>

            {formatStatModal.tab === 'stat' && (() => {
              const entries = formatStatModal.entries;
              const total = entries.length;
              const withSayu = entries.filter(e => {
                const r = records.find(r => r.id === e.recordId);
                return r && (r as any)[`${formatStatModal.prefix}_sayu`];
              }).length;
              const months: Record<string, number> = {};
              entries.forEach(e => {
                const m = (e.date || '').slice(0, 7);
                if (m) months[m] = (months[m] || 0) + 1;
              });
              const sortedMonths = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
              const maxCount = Math.max(...sortedMonths.map(([, c]) => c), 1);

              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    {[
                      { label: '전체 기록', value: `${total}건`, color: '#1A3C6E' },
                      { label: 'SAYU 완료', value: `${withSayu}건`, color: '#10b981' },
                      { label: 'SAYU 비율', value: total > 0 ? `${Math.round(withSayu / total * 100)}%` : '0%', color: '#7C3AED' },
                      { label: '기록 월수', value: `${Object.keys(months).length}개월`, color: '#F59E0B' },
                    ].map(card => (
                      <div key={card.label} style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: '12px 14px', border: '1px solid #f0f0f0' }}>
                        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{card.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
                      </div>
                    ))}
                  </div>

                  {sortedMonths.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 10 }}>📅 월별 기록 수</p>
                      {sortedMonths.map(([month, count]) => (
                        <div key={month} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: '#666', width: 52, flexShrink: 0 }}>{month.slice(5)}월</span>
                          <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                            <div style={{
                              width: `${(count / maxCount) * 100}%`,
                              backgroundColor: '#1A3C6E', height: '100%', borderRadius: 4,
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#1A3C6E', fontWeight: 600, width: 24, textAlign: 'right' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {formatStatModal.tab === 'merge' && (() => {
              const entries = formatStatModal.entries;
              const sorted = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

              const handleMerge = async () => {
                const parts: string[] = [];
                sorted.forEach(e => {
                  const r = records.find(r => r.id === e.recordId);
                  if (!r) return;
                  const dateStr = new Date(e.date + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
                  const title = e.aiTitle || e.title || '';
                  parts.push(`[ ${dateStr}${title ? ' — ' + title : ''} ]`);
                  const content = Object.keys(r)
                    .filter(k => k.startsWith(`${formatStatModal.prefix}_`) && typeof (r as any)[k] === 'string' && ((r as any)[k] as string).trim()
                      && !k.endsWith('_sayu') && !k.endsWith('_ai_title') && !k.endsWith('_images') && !k.endsWith('_title'))
                    .map(k => (r as any)[k] as string)
                    .join('\n');
                  parts.push(content);
                  parts.push('');
                });
                const fullText = parts.join('\n');
                try {
                  await navigator.clipboard.writeText(fullText);
                  toast.success(`📎 ${sorted.length}개 기록이 클립보드에 합쳐졌습니다!`);
                } catch {
                  toast.error('복사에 실패했습니다.');
                }
              };

              return (
                <div>
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
                    <strong style={{ color: '#1A3C6E' }}>{formatStatModal.format}</strong> 기록 {sorted.length}개를 날짜순으로 합쳐서 클립보드에 복사합니다.
                  </p>
                  <div style={{ backgroundColor: '#f0f4ff', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: '#4B5563', lineHeight: 1.7 }}>
                    📌 합치기 형식 예시:<br />
                    <span style={{ color: '#1A3C6E', fontWeight: 600 }}>[ 2026년 1월 1일 — AI제목 ]</span><br />
                    본문 내용...<br /><br />
                    <span style={{ color: '#1A3C6E', fontWeight: 600 }}>[ 2026년 1월 2일 ]</span><br />
                    본문 내용...
                  </div>
                  <button
                    onClick={handleMerge}
                    style={{
                      width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                      backgroundColor: '#1A3C6E', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    📎 {sorted.length}개 기록 합쳐서 복사하기
                  </button>
                </div>
              );
            })()}
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
          {(sayuModalState.title || sayuModalState.aiTitle) && (
            <div style={{ marginTop: '6px', fontSize: '13pt', fontWeight: 600, color: '#1A3C6E' }}>
              {sayuModalState.title || sayuModalState.aiTitle}
              {sayuModalState.aiTitle && sayuModalState.title && sayuModalState.aiTitle !== sayuModalState.title && (
                <span style={{ fontSize: '10pt', color: '#999', fontWeight: 400, marginLeft: '6px' }}>
                  ({sayuModalState.aiTitle})
                </span>
              )}
            </div>
          )}
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

// ===== 📈 HARU주식관리 대시보드 =====
function StockDashboard({
  records,
  onOpenRecord,
}: {
  records: any[];
  onOpenRecord?: (record: any) => void;
}) {
  const [filter, setFilter] = useState<'전체' | '매수' | '매도' | '실현이익' | '실현손실'>('전체');
  const [sort, setSort] = useState<'최신순' | '오래된순' | '금액높은순' | '금액낮은순'>('최신순');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameFilter, setNameFilter] = useState('전체');

  // 레코드 → 거래 객체 (각 레코드가 1건의 거래를 보유)
  const allTrades: any[] = records
    .map((r) => ({
      recordId: r?.id || '',
      date: r?.date || '',
      stock_type: r?.stock_type || '',
      stock_name: r?.stock_name || '',
      stock_price: r?.stock_price || '',
      stock_quantity: r?.stock_quantity || '',
      stock_total: r?.stock_total || '',
      stock_date: r?.stock_date || r?.date || '',
      stock_reflection: r?.stock_reflection || '',
      stock_sayu: r?.stock_sayu || '',
    }))
    .filter((t) => t.stock_name);

  const stockNames = ['전체', ...Array.from(new Set(allTrades.map((t: any) => t.stock_name).filter(Boolean)))];

  let filtered = allTrades.filter((t: any) => {
    if (nameFilter !== '전체' && t.stock_name !== nameFilter) return false;
    if (filter === '매수' && t.stock_type !== '매수') return false;
    if (filter === '매도' && t.stock_type !== '매도') return false;
    if (dateFrom && t.stock_date.slice(0, 10) < dateFrom) return false;
    if (dateTo && t.stock_date.slice(0, 10) > dateTo) return false;
    return true;
  });

  filtered = [...filtered].sort((a: any, b: any) => {
    const aAmt = parseInt((a.stock_total || '0').replace(/[^0-9]/g, '')) || 0;
    const bAmt = parseInt((b.stock_total || '0').replace(/[^0-9]/g, '')) || 0;
    if (sort === '최신순') return (b.stock_date || '').slice(0, 16).localeCompare((a.stock_date || '').slice(0, 16));
    if (sort === '오래된순') return (a.stock_date || '').slice(0, 16).localeCompare((b.stock_date || '').slice(0, 16));
    if (sort === '금액높은순') return bAmt - aAmt;
    if (sort === '금액낮은순') return aAmt - bAmt;
    return 0;
  });

  const buyCount = allTrades.filter((t: any) => t.stock_type === '매수').length;
  const sellCount = allTrades.filter((t: any) => t.stock_type === '매도').length;
  const totalAmt = allTrades.reduce(
    (sum: number, t: any) => sum + (parseInt((t.stock_total || '0').replace(/[^0-9]/g, '')) || 0),
    0,
  );
  const reflectionCount = allTrades.filter((t: any) => String(t.stock_reflection || t.stock_sayu || '').trim()).length;

  const chip = (label: string, active: boolean, onClick: () => void, color?: string) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', fontSize: 11,
        padding: '5px 10px', borderRadius: 20, margin: 3, cursor: 'pointer',
        border: `0.5px solid ${active ? '#1A3C6E' : '#e5e7eb'}`,
        background: active ? '#1A3C6E' : '#fff',
        color: active ? '#fff' : color || '#6B7280',
      }}
    >{label}</button>
  );

  const donutTotal = buyCount + sellCount || 1;

  return (
    <div style={{ padding: '12px', background: '#f9fafb' }}>
      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
        {[
          { label: '산 거래', term: '매수', val: `${buyCount}건`, color: '#27500A' },
          { label: '판 거래', term: '매도', val: `${sellCount}건`, color: '#A32D2D' },
          { label: '거래 종목', term: '', val: `${stockNames.length - 1}개`, color: '#1A3C6E' },
          { label: '총 거래금액', term: '', val: `${Math.round(totalAmt / 10000).toLocaleString()}만원`, color: '#1A3C6E' },
          { label: '거래소감', term: '', val: `${reflectionCount}건`, color: '#10B981' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              {s.label} {s.term && <span style={{ fontSize: 10, opacity: 0.6 }}>{s.term}</span>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: s.color, marginTop: 2 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* 도넛차트 */}
      <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="30" fill="none" stroke="#27500A" strokeWidth="18"
            strokeDasharray={`${(buyCount / donutTotal) * 188.4} 188.4`}
            strokeDashoffset="47.1" />
          <circle cx="40" cy="40" r="30" fill="none" stroke="#A32D2D" strokeWidth="18"
            strokeDasharray={`${(sellCount / donutTotal) * 188.4} 188.4`}
            strokeDashoffset={`${-((buyCount / donutTotal) * 188.4) + 47.1}`} />
          <circle cx="40" cy="40" r="21" fill="#f9fafb" />
          <text x="40" y="37" textAnchor="middle" fontSize="11" fontWeight="500" fill="#1A3C6E">
            {buyCount + sellCount}건
          </text>
          <text x="40" y="50" textAnchor="middle" fontSize="9" fill="#6B7280">전체</text>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27500A', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, color: '#374151' }}>산 거래 <span style={{ fontSize: 10, color: '#9CA3AF' }}>매수</span></div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#27500A' }}>
                {buyCount}건 · {buyCount + sellCount > 0 ? Math.round((buyCount / (buyCount + sellCount)) * 100) : 0}%
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#A32D2D', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, color: '#374151' }}>판 거래 <span style={{ fontSize: 10, color: '#9CA3AF' }}>매도</span></div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#A32D2D' }}>
                {sellCount}건 · {buyCount + sellCount > 0 ? Math.round((sellCount / (buyCount + sellCount)) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 날짜 검색 */}
      <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', margin: '12px 0 6px' }}>날짜·기간으로 찾기</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6, marginBottom: 8 }}>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          style={{ fontSize: 12, padding: '7px 10px', borderRadius: 8, border: '0.5px solid #d1d5db', width: '100%', boxSizing: 'border-box' }} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          style={{ fontSize: 12, padding: '7px 10px', borderRadius: 8, border: '0.5px solid #d1d5db', width: '100%', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        {['전체기간', '오늘', '이번 주', '이번 달', '3개월'].map((p) => {
          const applyRange = () => {
            const now = new Date();
            const fmt = (d: Date) => d.toISOString().slice(0, 10);
            if (p === '오늘') { setDateFrom(fmt(now)); setDateTo(fmt(now)); }
            else if (p === '이번 주') { const d = new Date(now); d.setDate(d.getDate() - 7); setDateFrom(fmt(d)); setDateTo(fmt(now)); }
            else if (p === '이번 달') { const d = new Date(now.getFullYear(), now.getMonth(), 1); setDateFrom(fmt(d)); setDateTo(fmt(now)); }
            else if (p === '3개월') { const d = new Date(now); d.setMonth(d.getMonth() - 3); setDateFrom(fmt(d)); setDateTo(fmt(now)); }
            else { setDateFrom(''); setDateTo(''); }
          };
          return (
            <button
              type="button"
              key={p}
              onClick={applyRange}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, margin: 3, cursor: 'pointer', border: '0.5px solid #e5e7eb', background: '#fff', color: '#6B7280' }}
            >{p}</button>
          );
        })}
      </div>

      {/* 거래종류 필터 */}
      <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', margin: '12px 0 6px' }}>거래 종류로 찾기</div>
      <div style={{ marginBottom: 8 }}>
        {chip('전체', filter === '전체', () => setFilter('전체'))}
        {chip('산 것만 매수', filter === '매수', () => setFilter('매수'))}
        {chip('판 것만 매도', filter === '매도', () => setFilter('매도'))}
      </div>

      {/* 종목 필터 */}
      <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', margin: '12px 0 6px' }}>종목으로 찾기</div>
      <div style={{ marginBottom: 8 }}>
        {stockNames.map((n) => chip(n, nameFilter === n, () => setNameFilter(n)))}
      </div>

      {/* 정렬 */}
      <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', margin: '12px 0 6px' }}>순서 정렬</div>
      <div style={{ marginBottom: 12 }}>
        {(['최신순', '오래된순', '금액높은순', '금액낮은순'] as const).map((s) =>
          chip(s, sort === s, () => setSort(s)),
        )}
      </div>

      {/* 거래 목록 */}
      <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', margin: '12px 0 6px' }}>
        거래 내역 ({filtered.length}건)
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, fontSize: 13, color: '#9CA3AF' }}>거래 내역이 없습니다</div>
      )}
      {filtered.map((t: any, i: number) => (
        <button
          type="button"
          key={`${t.recordId || t.stock_date}-${i}`}
          onClick={() => onOpenRecord?.(t)}
          style={{
            width: '100%',
            textAlign: 'left',
            background: '#fff',
            border: '0.5px solid #e5e7eb',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 8,
            cursor: onOpenRecord ? 'pointer' : 'default',
          }}
          aria-label={`${t.stock_name} 거래 결과 열기`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{t.stock_name}</span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
              background: t.stock_type === '매수' ? '#EAF3DE' : '#FCEBEB',
              color: t.stock_type === '매수' ? '#27500A' : '#A32D2D',
            }}>
              {t.stock_type === '매수' ? '산 것 · 매수' : '판 것 · 매도'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
            {t.stock_quantity} · {t.stock_price} · 총 {t.stock_total}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{t.stock_date}</div>
          {String(t.stock_reflection || t.stock_sayu || '').trim() && (
            <div style={{ fontSize: 12, color: '#374151', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {String(t.stock_reflection || t.stock_sayu).trim()}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
