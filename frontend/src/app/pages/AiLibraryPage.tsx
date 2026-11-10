import { AI_LIBRARY_BUCKETS, applyAiLibraryMoves, normalizeAiLibraryCategory, type AiLibraryFolder, type AiLibraryBucket } from '../utils/aiLibraryCategory';
import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { getAiLibrarySource } from '../utils/aiLibrarySource';
import { hasAiLibraryAccess } from '../utils/aiLibraryAccess';
import { addAiLibrarySelection, AI_LIBRARY_DELETE_LIMIT } from '../utils/aiLibraryDeletion';
import {
  AiLibraryPageRequestGuard,
  hasAiLibraryNextPage,
  mergeAiLibraryLogs,
} from '../utils/aiLibraryPagination';

type SourceFilter = string;

type BookMaterial = {
  enabled?: boolean;
  materialGrade?: string;
  promptVersion?: string;
  bookMaterialTitle?: string;
  bookSummary?: string;
  summary3?: string;
  humanQuestionCore?: string;
  aiResponseCore?: string;
  thinkingShift?: string;
  collaborationMoment?: string;
  vibeFlow?: string;
  bookPassages?: unknown[];
  chapterCandidates?: unknown[];
  topicTags?: unknown[];
  bookQuoteLines?: unknown[];
  bookInsightLines?: unknown[];
  bookSceneLines?: unknown[];
  bookEmotionLines?: unknown[];
  coreSentences?: unknown[];
};

const SOURCE_LABELS: Record<string, string> = {
  'claude.ai': 'Claude',
  'gemini.google.com': 'Gemini',
  'chatgpt.com': 'ChatGPT',
  'chatgpt.com/dots': '김비서',
  'slack': 'Slack',
};

const PRIMARY_SOURCES = ['chatgpt.com', 'chatgpt.com/dots', 'claude.ai', 'gemini.google.com', 'slack'] as const;

const MATERIAL_KEYS: (keyof BookMaterial)[] = [
  'bookMaterialTitle',
  'bookSummary',
  'summary3',
  'humanQuestionCore',
  'aiResponseCore',
  'thinkingShift',
  'collaborationMoment',
  'vibeFlow',
  'bookPassages',
  'chapterCandidates',
  'topicTags',
  'bookQuoteLines',
  'bookInsightLines',
  'bookSceneLines',
  'bookEmotionLines',
  'coreSentences',
];

const cleanText = (value?: string) => (value || '').trim();

const trimTitle = (value: string, limit = 54) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightKeyword = (text: string, kw: string): ReactNode => {
  if (!kw) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(kw)})`, 'gi'));
  if (parts.length <= 1) return text;
  return parts.map((part, i) => (
    i % 2 === 1
      ? <span key={i} style={{ color: '#DC2626', fontWeight: 800 }}>{part}</span>
      : part
  ));
};

const buildPreviewSnippet = (text: string, kw: string, radius = 60) => {
  if (!kw) return text.slice(0, 100) + (text.length > 100 ? '...' : '');
  const idx = text.toLowerCase().indexOf(kw.toLowerCase());
  if (idx === -1 || idx < 100) {
    return text.slice(0, 100) + (text.length > 100 ? '...' : '');
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + kw.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
};

const isGenericStoredTitle = (record: HaruRecord, title?: string) => {
  const text = cleanText(title);
  if (!text) return true;
  const source = record.source || '';
  const sourceLabel = SOURCE_LABELS[source] || source;
  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedLabel = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    /^\[[^\]]+\]\s*\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?$/u,
    /^\[[^\]]+\]\s*\d{4}-\d{2}-\d{2}$/u,
    new RegExp(`^\\[${escapedSource}\\]`, 'u'),
    new RegExp(`^\\[${escapedLabel}\\]`, 'u'),
    /^[\d.\-\s년월일]+$/u,
    /^제목 없음$/u,
  ].some((pattern) => pattern.test(text));
};

const extractContentHeadline = (content?: string) => {
  const text = cleanText(content);
  if (!text) return '';

  const questionMatch = text.match(/(?:👤\s*)?질문\s*\n+([\s\S]*?)(?:\n\s*\n|(?:🤖\s*)?답변\s*\n|$)/u);
  if (questionMatch?.[1]) {
    const questionLine = questionMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 3);
    if (questionLine) return trimTitle(questionLine);
  }

  const firstMeaningfulLine = text
    .split('\n')
    .map((line) => line
      .replace(/^[👤🤖📚💬✅⚠️\s-]+/u, '')
      .replace(/^(질문|답변|요약|원문 대화)\s*[:：-]?\s*/u, '')
      .trim())
    .find((line) => (
      line.length > 4
      && !/^\[[^\]]+\]\s*\d{4}/u.test(line)
      && !/^[\d.\-\s년월일]+$/u.test(line)
    ));

  return firstMeaningfulLine ? trimTitle(firstMeaningfulLine) : '';
};

const toTextArray = (value: unknown, limit = 8) => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, limit)
    : []
);

const getBookMaterial = (record: HaruRecord): BookMaterial | null => {
  const material = record.bookMaterial as BookMaterial | undefined;
  if (!material) return null;
  const hasMaterialData = !!material.enabled || MATERIAL_KEYS.some((key) => {
    const value = material[key];
    if (Array.isArray(value)) return value.some((item) => typeof item === 'string' && item.trim());
    return typeof value === 'string' && value.trim().length > 0;
  });
  return hasMaterialData ? material : null;
};

const getMaterialTitle = (record: HaruRecord, material: BookMaterial) => (
  cleanText(material.bookMaterialTitle)
    || cleanText(record.ai_title)
    || (!isGenericStoredTitle(record, record.title) ? cleanText(record.title) : '')
    || extractContentHeadline(record.content)
    || '제목 없는 책소재'
);

const getDisplayTitle = (record: HaruRecord, material?: BookMaterial | null) => (
  cleanText(material?.bookMaterialTitle)
    || (!isGenericStoredTitle(record, record.ai_title) ? cleanText(record.ai_title) : '')
    || (!isGenericStoredTitle(record, record.title) ? cleanText(record.title) : '')
    || extractContentHeadline(record.content)
    || '제목 없는 대화'
);

const buildMaterialCopyText = (record: HaruRecord, material: BookMaterial) => {
  const summary = cleanText(material.bookSummary || material.summary3);
  const question = cleanText(material.humanQuestionCore);
  const answer = cleanText(material.aiResponseCore);
  const shift = cleanText(material.thinkingShift);
  const collaboration = cleanText(material.collaborationMoment);
  const vibe = cleanText(material.vibeFlow);
  const passages = toTextArray(material.bookPassages);
  const legacyPassages = [
    ...toTextArray(material.bookQuoteLines),
    ...toTextArray(material.bookInsightLines),
    ...toTextArray(material.bookSceneLines),
    ...toTextArray(material.bookEmotionLines),
    ...toTextArray(material.coreSentences),
  ];
  const chapters = toTextArray(material.chapterCandidates, 5);
  const tags = toTextArray(material.topicTags, 8);

  return [
    `책소재: ${getMaterialTitle(record, material)}`,
    '',
    summary && `요약\n${summary}`,
    question && `질문 핵심\n${question}`,
    answer && `답변 핵심\n${answer}`,
    shift && `사고 변화\n${shift}`,
    collaboration && `AI 협업 장면\n${collaboration}`,
    vibe && `바이브 흐름\n${vibe}`,
    passages.length > 0 && `인용문단\n${passages.map((item, index) => `${index + 1}. ${item}`).join('\n\n')}`,
    passages.length === 0 && legacyPassages.length > 0 && `레거시 인용문단\n${legacyPassages.map((item, index) => `${index + 1}. ${item}`).join('\n\n')}`,
    chapters.length > 0 && `예상 챕터\n${chapters.join(' / ')}`,
    tags.length > 0 && `주제 태그\n${tags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}`,
  ].filter(Boolean).join('\n\n');
};

const getMaterialPreviewText = (record: HaruRecord, material: BookMaterial) => {
  const summary = cleanText(material.bookSummary || material.summary3);
  const question = cleanText(material.humanQuestionCore);
  const answer = cleanText(material.aiResponseCore);
  const vibe = cleanText(material.vibeFlow);
  const firstPassage = toTextArray(material.bookPassages, 1)[0] || '';

  return [
    summary,
    question && `질문 핵심\n${question}`,
    answer && `답변 핵심\n${answer}`,
    vibe && `흐름\n${vibe}`,
    !summary && !question && !answer && firstPassage,
    !summary && !question && !answer && !firstPassage && getMaterialTitle(record, material),
  ].filter(Boolean).join('\n\n');
};

function MaterialBlock({ label, children, tint = '#FFFFFF' }: { label: string; children: ReactNode; tint?: string }) {
  if (!children) return null;
  return (
    <div style={{ padding: '8px 10px', background: tint, border: '1px solid #F0E4C2', borderRadius: 6 }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#1A3C6E' }}>{label}</p>
      <div style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: '#1F2937', whiteSpace: 'pre-wrap' }}>
        {children}
      </div>
    </div>
  );
}

function BookMaterialPanel({ log }: { log: HaruRecord }) {
  const material = getBookMaterial(log);
  if (!material) return null;

  const summary = cleanText(material.bookSummary || material.summary3);
  const question = cleanText(material.humanQuestionCore);
  const answer = cleanText(material.aiResponseCore);
  const shift = cleanText(material.thinkingShift);
  const collaboration = cleanText(material.collaborationMoment);
  const vibe = cleanText(material.vibeFlow);
  const passages = toTextArray(material.bookPassages);
  const legacyPassages = [
    ...toTextArray(material.bookQuoteLines),
    ...toTextArray(material.bookInsightLines),
    ...toTextArray(material.bookSceneLines),
    ...toTextArray(material.bookEmotionLines),
    ...toTextArray(material.coreSentences),
  ];
  const chapters = toTextArray(material.chapterCandidates, 5);
  const tags = toTextArray(material.topicTags, 8);

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0E4C2' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#1A3C6E' }}>
            📚 책 원고 소재 — {getMaterialTitle(log, material)}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#6B7280' }}>
            {material.materialGrade ? `${material.materialGrade}급` : '소재화 완료'}
            {material.promptVersion ? ` · ${material.promptVersion}` : ''}
          </p>
        </div>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await navigator.clipboard.writeText(buildMaterialCopyText(log, material));
              alert('책소재가 복사되었습니다!');
            } catch {
              alert('책소재 복사에 실패했습니다.');
            }
          }}
          style={{
            flexShrink: 0,
            background: '#1A3C6E',
            border: 'none',
            borderRadius: 6,
            padding: '5px 9px',
            fontSize: 11,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          소재 복사
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MaterialBlock label="책소재 요약" tint="#FFFBEC">{summary}</MaterialBlock>
        <MaterialBlock label="질문 핵심">{question}</MaterialBlock>
        <MaterialBlock label="답변 핵심">{answer}</MaterialBlock>
        <MaterialBlock label="사고 변화">{shift}</MaterialBlock>
        <MaterialBlock label="AI 협업 장면">{collaboration}</MaterialBlock>
        <MaterialBlock label="바이브 흐름" tint="#F0EDF8">{vibe}</MaterialBlock>
        {passages.length > 0 && (
          <MaterialBlock label={`인용문단 (${passages.length}개)`} tint="#FFFBEC">
            {passages.map((passage, index) => (
              <blockquote
                key={index}
                style={{
                  margin: index === 0 ? 0 : '8px 0 0',
                  paddingLeft: 10,
                  borderLeft: '3px solid #C9A75A',
                }}
              >
                {passage}
              </blockquote>
            ))}
          </MaterialBlock>
        )}
        {passages.length === 0 && legacyPassages.length > 0 && (
          <MaterialBlock label="레거시 인용문단" tint="#FFFBEC">
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {legacyPassages.map((passage, index) => <li key={index}>{passage}</li>)}
            </ul>
          </MaterialBlock>
        )}
        {chapters.length > 0 && (
          <MaterialBlock label="예상 챕터">
            {chapters.join(' · ')}
          </MaterialBlock>
        )}
        {tags.length > 0 && (
          <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>
            {tags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}
          </p>
        )}
      </div>
    </div>
  );
}

export function AiLibraryPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<HaruRecord[]>([]);
  const [folder, setFolder] = useState<AiLibraryFolder>('all');
  const [moveBusy, setMoveBusy] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState(false);
  const movesRef = useRef(new Map<string, AiLibraryBucket>());
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bookMaterialBusy, setBookMaterialBusy] = useState<Set<string>>(new Set());
  const requestGuardRef = useRef(new AiLibraryPageRequestGuard());
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    const requestGuard = requestGuardRef.current;
    const generation = requestGuard.startSession();
    requestGenerationRef.current = generation;
    setLogs([]);
    movesRef.current.clear();
    setMoveBusy(new Set());
    setLoadError(false);
    setNextCursor(undefined);
    setSelectedIds(new Set());
    setExpandedId(null);
    setDeleteMode(false);
    setBookMaterialBusy(new Set());
    setLoading(true);
    setLoadingMore(false);

    if (!user || !hasAiLibraryAccess(user.email, user.emailVerified)) {
      setLoading(false);
      return () => requestGuard.endSession(generation);
    }
    const ticket = requestGuard.startRequest(generation, 'first-page');
    if (!ticket) {
      setLoading(false);
      return () => requestGuard.endSession(generation);
    }
    firestoreService.getAiLogPage(undefined, folder).then((page) => {
      if (!requestGuard.isCurrent(generation)) return;
      setLogs(page.logs);
      setNextCursor(page.nextCursor);
    }).catch((error) => {
      if (requestGuard.isCurrent(generation)) {
        setLoadError(true);
        console.error('[AiLibraryPage] 조회 실패:', error);
      }
    }).finally(() => {
      if (requestGuard.finishRequest(ticket)) setLoading(false);
    });
    return () => requestGuard.endSession(generation);
  }, [user?.uid, user?.email, user?.emailVerified, folder]);

  const getSource = getAiLibrarySource;

  // 주요 수집 출처는 기록 유무와 관계없이 항상 노출하고, 그 외 출처만 동적으로 추가한다.
  const filterButtons = useMemo(() => {
    const sources = new Set<string>();
    logs.forEach(log => {
      const source = getSource(log);
      if (source) sources.add(source);
    });

    const buttons = [
      { value: 'all', label: '전체' },
      ...PRIMARY_SOURCES.map(source => ({ value: source, label: SOURCE_LABELS[source] })),
    ];

    Array.from(sources).sort().forEach(source => {
      if (PRIMARY_SOURCES.includes(source as typeof PRIMARY_SOURCES[number])) return;
      const label = SOURCE_LABELS[source] || source;
      buttons.push({ value: source, label });
    });

    return buttons;
  }, [logs]);

  const filtered = logs.filter((r) => {
    const matchTab = filter === 'all' || getSource(r) === filter;
    const kw = keyword.trim().toLowerCase();
    const displayTitle = getDisplayTitle(r, getBookMaterial(r)).toLowerCase();
    const matchKeyword = !kw
      || r.content?.toLowerCase().includes(kw)
      || r.title?.toLowerCase().includes(kw)
      || displayTitle.includes(kw);
    return matchTab && matchKeyword;
  });

  const handleLoadMore = async () => {
    if (!hasAiLibraryNextPage(nextCursor)) return;
    const requestGuard = requestGuardRef.current;
    const generation = requestGenerationRef.current;
    const cursor = nextCursor;
    const ticket = requestGuard.startRequest(generation, `next:${cursor}`);
    if (!ticket) return;

    setLoadingMore(true);
    try {
      const page = await firestoreService.getAiLogPage(cursor, folder);
      if (!requestGuard.isCurrent(generation)) return;
      setLogs(current => applyAiLibraryMoves(mergeAiLibraryLogs(current, page.logs), folder, movesRef.current));
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (requestGuard.isCurrent(generation)) {
        console.error('[AiLibraryPage] 다음 페이지 조회 실패:', error);
      }
    } finally {
      if (requestGuard.finishRequest(ticket)) setLoadingMore(false);
    }
  };

  const handleMove = async (log: HaruRecord, category: AiLibraryBucket) => {
    if (category === normalizeAiLibraryCategory(log.aiCategory)) return;
    const guard = requestGuardRef.current;
    const generation = requestGenerationRef.current;
    const ticket = guard.startRequest(generation, `move:${log.id}`);
    if (!ticket) return;
    setMoveBusy(current => new Set(current).add(log.id));
    try {
      const result = await firestoreService.moveAiLibraryLog(log.id, category, normalizeAiLibraryCategory(log.aiCategory));
      if (!guard.isCurrent(generation)) return;
      movesRef.current.set(log.id, result.category);
      setLogs(current => applyAiLibraryMoves(current, folder, movesRef.current));
      setSelectedIds(current => { const next = new Set(current); next.delete(log.id); return next; });
      if (folder !== 'all') setExpandedId(current => current === log.id ? null : current);
    } catch (error) {
      if (!guard.isCurrent(generation)) return;
      console.error('[AiLibraryPage] 폴더 이동 실패:', error);
      alert('폴더 이동 결과를 확인하지 못했습니다. 새로고침으로 현재 폴더를 확인한 뒤 다시 시도해주세요.');
    } finally {
      if (guard.finishRequest(ticket)) {
        setMoveBusy(current => { const next = new Set(current); next.delete(log.id); return next; });
      }
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  };

  const handleToggleDeleteMode = () => {
    if (deleteMode) {
      setSelectedIds(new Set());
    }
    setDeleteMode(!deleteMode);
  };

  const handleSelectCard = (id: string, e: React.MouseEvent) => {
    if (!deleteMode) return;
    e.stopPropagation();

    setSelectedIds((current) => {
      const result = addAiLibrarySelection(current, id);
      if (result.limitReached) {
        alert(`한 번에 최대 ${AI_LIBRARY_DELETE_LIMIT}개까지 선택할 수 있습니다.`);
      }
      return result.selectedIds;
    });
  };

  const handleCardClick = (id: string) => {
    if (deleteMode) return;
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedIds.size}개를 삭제하시겠습니까?`)) {
      return;
    }

    const generation = requestGenerationRef.current;
    try {
      const confirmedIds = await firestoreService.deleteAiLogs(new Set(selectedIds));
      if (!requestGuardRef.current.isCurrent(generation)) return;

      // 서버가 요청 개수 전체를 확인한 경우에만 삭제된 항목을 화면에서 제거한다.
      setLogs(prevLogs => prevLogs.filter(log => !confirmedIds.has(log.id)));

      // 삭제 모드 종료 및 선택 초기화
      setDeleteMode(false);
      setSelectedIds(new Set());

      alert('삭제되었습니다.');
    } catch (error) {
      if (!requestGuardRef.current.isCurrent(generation)) return;
      console.error('[handleDeleteSelected] 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteOne = async (log: HaruRecord) => {
    const title = log.title || '이 대화';
    if (!confirm(`'${title}' 기록을 삭제하시겠습니까?`)) return;

    const generation = requestGenerationRef.current;
    try {
      const confirmedIds = await firestoreService.deleteAiLogs(new Set([log.id]));
      if (!requestGuardRef.current.isCurrent(generation)) return;
      setLogs(prevLogs => prevLogs.filter(item => !confirmedIds.has(item.id)));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(log.id);
        return next;
      });
      if (expandedId === log.id) setExpandedId(null);
      alert('삭제되었습니다.');
    } catch (error) {
      if (!requestGuardRef.current.isCurrent(generation)) return;
      console.error('[handleDeleteOne] 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleConvertToBookMaterial = async (log: HaruRecord) => {
    const content = (log.content || '').trim();
    if (content.length < 10) {
      alert('변환할 대화 내용이 너무 짧습니다.');
      return;
    }

    const already = !!log.bookMaterial?.enabled;
    if (already && !confirm('이미 책소재로 변환된 항목입니다. 다시 변환하시겠습니까?')) {
      return;
    }

    const generation = requestGenerationRef.current;
    setBookMaterialBusy(prev => {
      const next = new Set(prev);
      next.add(log.id);
      return next;
    });

    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const convertFn = httpsCallable(fns, 'convertToBookMaterial');
      const result = await convertFn({
        logId: log.id,
        force: already,
      });
      const data = (result.data || {}) as any;
      if (!data?.ok) throw new Error('AI 응답 형식 오류');
      if (!requestGuardRef.current.isCurrent(generation)) return;

      setLogs(prevLogs => prevLogs.map(item =>
        item.id === log.id ? { ...item, bookMaterial: data.bookMaterial } : item
      ));
      if (!data.bookMaterial) {
        alert('변환은 완료됐지만 화면 갱신값을 바로 읽지 못했습니다. 새로고침하면 반영됩니다.');
      }
      setExpandedId(log.id);
      alert('책소재 변환이 완료되었습니다.');
    } catch (error: any) {
      if (!requestGuardRef.current.isCurrent(generation)) return;
      console.error('[handleConvertToBookMaterial] 변환 실패:', error);
      const code = error?.code || '';
      const message = error?.message || '알 수 없는 오류';
      if (code === 'functions/permission-denied') alert('권한이 없습니다. 개발자 전용 기능입니다.');
      else if (code === 'functions/not-found') alert('원본 기록을 찾을 수 없습니다.');
      else alert(`변환 실패: ${message}`);
    } finally {
      if (!requestGuardRef.current.isCurrent(generation)) return;
      setBookMaterialBusy(prev => {
        const next = new Set(prev);
        next.delete(log.id);
        return next;
      });
    }
  };

  return (
    <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', paddingBottom: '100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1A3C6E', margin: 0 }}>
          AI 학습함
        </h2>
        <button
          onClick={handleToggleDeleteMode}
          style={{
            padding: '6px 12px',
            borderRadius: '16px',
            border: deleteMode ? '1px solid #e24b4a' : '1px solid #1A3C6E',
            background: deleteMode ? '#e24b4a' : '#1A3C6E',
            color: '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {deleteMode ? '취소' : '선택 삭제'}
        </button>
      </div>



      {/* 선택 삭제 모드일 때 선택 바 */}
      {deleteMode && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          marginBottom: '16px',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef',
        }}>
          <span style={{ fontSize: '14px', color: '#555' }}>
            {selectedIds.size}개 선택됨
          </span>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: selectedIds.size > 0 ? '#e24b4a' : '#ccc',
              color: '#fff',
              fontSize: '12px',
              cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 500,
            }}
          >
            삭제
          </button>
        </div>
      )}

      <nav aria-label="목적 폴더" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {[{ value: 'all', label: '전체' }, ...AI_LIBRARY_BUCKETS, { value: 'review', label: '보류' }].map(item => (
          <button key={item.value} aria-pressed={folder === item.value}
            onClick={() => {
              if (folder === item.value) return;
              // Invalidate immediately, before the next effect can start a new folder session.
              requestGuardRef.current.endSession(requestGenerationRef.current);
              setFolder(item.value as AiLibraryFolder);
            }}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #B8C7DC',
              background: folder === item.value ? '#1A3C6E' : '#fff', color: folder === item.value ? '#fff' : '#1A3C6E', cursor: 'pointer' }}>
            {item.label}
          </button>
        ))}
      </nav>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px' }}>
        분류된 자료는 목적 폴더에서, 검토가 필요한 자료는 보류에서 확인하세요. 직접 옮긴 분류는 보호됩니다.
      </p>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 8px' }}>수집 출처 (불러온 기록 기준)</p>
      {/* 필터 버튼 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setFilter(btn.value)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: filter === btn.value ? '#1A3C6E' : '#ddd',
              background: filter === btn.value ? '#1A3C6E' : '#fff',
              color: filter === btn.value ? '#fff' : '#555',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 검색창 */}
      <input
        type="text"
        placeholder="키워드 검색 (제목, 내용)"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '8px 12px', marginBottom: '16px',
          border: '1px solid #ddd', borderRadius: '20px',
          fontSize: '13px', outline: 'none',
        }}
      />
      <p style={{ margin: '-8px 4px 14px', fontSize: 11, color: '#6B7280' }}>
        검색과 출처 필터는 현재 폴더에서 불러온 기록에 적용됩니다. 불러온 기록 {logs.length}개
      </p>

      {/* 목록 */}
      {loading ? (
        <p style={{ color: '#999', fontSize: '14px' }}>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#999', fontSize: '14px' }}>
          {loadError ? '목록을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.'
            : logs.length === 0
            ? hasAiLibraryNextPage(nextCursor) ? '아직 이 폴더의 기록을 찾지 못했습니다. 더 불러오기를 눌러 계속 확인하세요.' : '이 폴더에 기록이 없습니다.'
            : '현재 불러온 기록 중 검색·필터 조건에 맞는 기록이 없습니다.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((log) => {
            const material = getBookMaterial(log);
            const isExpanded = expandedId === log.id;
            const isConverting = bookMaterialBusy.has(log.id);
            const displayTitle = getDisplayTitle(log, material);
            const materialPreview = material ? getMaterialPreviewText(log, material) : '';
            const trimmedKeyword = keyword.trim();
            const displayText = material
              ? materialPreview
              : log.content
                ? isExpanded
                  ? log.content
                  : buildPreviewSnippet(log.content, trimmedKeyword)
                : '';
            return (
            <div
              key={log.id}
              onClick={() => handleCardClick(log.id)}
              style={{
                border: `1px solid ${deleteMode && selectedIds.has(log.id) ? '#1A3C6E' : '#e5e5e5'}`,
                borderRadius: '10px',
                padding: '14px',
                background: deleteMode && selectedIds.has(log.id) ? '#f8f9ff' : material ? '#FFFCF2' : '#fff',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* 삭제 모드일 때 체크박스 */}
              {deleteMode && (
                <div
                  onClick={(e) => handleSelectCard(log.id, e)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    border: `2px solid ${selectedIds.has(log.id) ? '#1A3C6E' : '#ddd'}`,
                    background: selectedIds.has(log.id) ? '#1A3C6E' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {selectedIds.has(log.id) && (
                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingRight: deleteMode ? '30px' : '0' }}>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#EEF3FB',
                    color: '#1A3C6E',
                    fontWeight: 600,
                  }}
                >
                  {SOURCE_LABELS[getSource(log)] ?? getSource(log)}
                </span>
                <span style={{ fontSize: '11px', color: '#aaa' }}>
                  {formatDate(log.createdAt)}
                </span>
              </div>
              <label onClick={e => e.stopPropagation()} style={{ display: 'block', fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                폴더 이동{' '}
                <select aria-label={`${displayTitle} 폴더 이동`} value={normalizeAiLibraryCategory(log.aiCategory)}
                  disabled={moveBusy.has(log.id) || deleteMode || isConverting}
                  onChange={e => { void handleMove(log, e.target.value as AiLibraryBucket); }}
                  style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid #D7DEE8', background: '#fff' }}>
                  {AI_LIBRARY_BUCKETS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {moveBusy.has(log.id) && ' 이동 중...'}
              </label>
              {log.aiReview && <div aria-label="보류 분류 안내" onClick={event => event.stopPropagation()}
                style={{ background: '#FFF8E6', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 13 }}>
                <strong>보류 · 추천: {AI_LIBRARY_BUCKETS.find(item => item.value === log.aiReview?.recommendation)?.label || '추천 없음'}</strong>
                <p style={{ margin: '4px 0' }}>{({ low_confidence: '자동으로 확정하기에는 확신이 부족합니다.', ambiguous: '여러 분류에 걸쳐 있어 직접 선택이 필요합니다.', out_of_scope: '다섯 분류의 범위 밖으로 판단했습니다. 추천은 참고 후보입니다.', sensitive_review: '전송 전 표현 검사로 보류했습니다. AI 추천 없이 직접 폴더를 골라주세요.', classification_review: '자동 확정 기준을 충족하지 못했습니다.' } as Record<string, string>)[log.aiReview.reason] || '내용을 확인하고 폴더를 직접 선택해 주세요.'}</p>
                {log.aiReview.recommendation && <button disabled={moveBusy.has(log.id)}
                  onClick={() => void handleMove(log, log.aiReview!.recommendation!)}
                  style={{ border: '1px solid #C7A955', borderRadius: 6, padding: '6px 10px', background: '#fff', cursor: 'pointer' }}>
                  추천 폴더로 이동
                </button>}
              </div>}
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#222', margin: '0 0 4px', lineHeight: 1.35 }}>
                {highlightKeyword(displayTitle, trimmedKeyword)}
              </p>
              {!isGenericStoredTitle(log, log.title) && log.title && log.title !== displayTitle && (
                <p style={{ fontSize: 11, color: '#8A94A6', margin: '0 0 6px' }}>
                  원제목: {highlightKeyword(log.title, trimmedKeyword)}
                </p>
              )}
              {material && (
                <p style={{ fontSize: '11px', color: '#1A3C6E', fontWeight: 700, margin: '0 0 6px' }}>
                  📚 책 원고 소재
                  {material.materialGrade && (
                    <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 99, background: '#EEF2FF', color: '#4338CA' }}>
                      {material.materialGrade}급
                    </span>
                  )}
                </p>
              )}
              <p
                style={{
                  fontSize: '13px',
                  color: material ? '#1F2937' : '#555',
                  lineHeight: '1.55',
                  whiteSpace: 'pre-wrap',
                  margin: material ? '8px 0 4px' : undefined,
                  padding: material ? '10px' : undefined,
                  borderRadius: material ? 8 : undefined,
                  background: material ? '#FFFFFF' : undefined,
                  border: material ? '1px solid #F0E4C2' : undefined,
                }}
              >
                {highlightKeyword(displayText, trimmedKeyword)}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(log.id);
                  }}
                  style={{
                    background: '#fff', border: '1px solid #D7DEE8',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 12, color: '#1A3C6E',
                    cursor: 'pointer',
                  }}
                >
                  {isExpanded ? '▲ 접기' : '▼ 펼치기'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConvertToBookMaterial(log);
                  }}
                  disabled={isConverting || moveBusy.has(log.id)}
                  style={{
                    background: material ? '#EEF3FB' : '#1A3C6E',
                    border: material ? '1px solid #B8C7DC' : '1px solid #1A3C6E',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 12, color: material ? '#1A3C6E' : '#fff',
                    cursor: isConverting ? 'wait' : 'pointer',
                    opacity: isConverting ? 0.6 : 1,
                  }}
                >
                  {isConverting ? '변환 중...' : material ? '📚 재변환' : '📚 책소재 변환'}
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await navigator.clipboard.writeText(log.content || '');
                      alert('복사되었습니다!');
                    } catch {
                      alert('복사에 실패했습니다.');
                    }
                  }}
                  style={{
                    background: 'none', border: '1px solid #ddd',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 12, color: '#666',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  📋 복사
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteOne(log);
                  }}
                  disabled={moveBusy.has(log.id)}
                  style={{
                    background: 'none', border: '1px solid #F1C4C4',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 12, color: '#B91C1C',
                    cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              </div>
              {isExpanded && (
                <>
                  <BookMaterialPanel log={log} />
                  {material && log.content && (
                    <div style={{ marginTop: 10 }}>
                      <MaterialBlock label="원문 대화" tint="#FFFFFF">
                        {highlightKeyword(log.content, trimmedKeyword)}
                      </MaterialBlock>
                    </div>
                  )}
                </>
              )}
            </div>
            );
          })}
        </div>
      )}
      {!loading && hasAiLibraryNextPage(nextCursor) && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 16,
            padding: '10px 14px',
            border: '1px solid #B8C7DC',
            borderRadius: 8,
            background: '#fff',
            color: '#1A3C6E',
            fontSize: 13,
            fontWeight: 700,
            cursor: loadingMore ? 'wait' : 'pointer',
            opacity: loadingMore ? 0.6 : 1,
          }}
        >
          {loadingMore ? '불러오는 중...' : '더 불러오기'}
        </button>
      )}
    </div>
  );
}
