import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

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
};

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
    || cleanText(record.title)
    || '제목 없는 책소재'
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
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log('[AiLibraryPage] user 상태:', user);
    if (!user || !user.email) {
      console.warn('[AiLibraryPage] user 또는 email 없음 — 로그인 필요');
      setLoading(false);
      return;
    }
    console.log('[AiLibraryPage] getAiLogs 호출, email:', user.email);
    firestoreService.getAiLogs(user.email).then((data) => {
      console.log('[AiLibraryPage] 받은 데이터:', data);
      setLogs(data);
      setLoading(false);
    });
  }, [user]);

  const getSource = (r: HaruRecord): string => {
    if (r.source) return r.source;
    const match = r.title?.match(/^\[([^\]]+)\]/);
    return match ? match[1] : '';
  };

  // 동적 필터 버튼 생성
  const filterButtons = useMemo(() => {
    const sources = new Set<string>();
    logs.forEach(log => {
      const source = getSource(log);
      if (source) sources.add(source);
    });

    const buttons = [{ value: 'all', label: '전체' }];

    Array.from(sources).sort().forEach(source => {
      const label = SOURCE_LABELS[source] || source;
      buttons.push({ value: source, label });
    });

    return buttons;
  }, [logs]);

  const filtered = logs.filter((r) => {
    const matchTab = filter === 'all' || getSource(r) === filter;
    const kw = keyword.trim().toLowerCase();
    const matchKeyword = !kw
      || r.content?.toLowerCase().includes(kw)
      || r.title?.toLowerCase().includes(kw);
    return matchTab && matchKeyword;
  });

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

    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
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

    try {
      await firestoreService.deleteAiLogs(selectedIds);

      // logs 상태에서 삭제된 항목들 제거
      setLogs(prevLogs => prevLogs.filter(log => !selectedIds.has(log.id)));

      // 삭제 모드 종료 및 선택 초기화
      setDeleteMode(false);
      setSelectedIds(new Set());

      alert('삭제되었습니다.');
    } catch (error) {
      console.error('[handleDeleteSelected] 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
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

      {/* 목록 */}
      {loading ? (
        <p style={{ color: '#999', fontSize: '14px' }}>불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#999', fontSize: '14px' }}>저장된 AI 학습 기록이 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((log) => {
            const material = getBookMaterial(log);
            return (
            <div
              key={log.id}
              onClick={() => handleCardClick(log.id)}
              style={{
                border: `1px solid ${deleteMode && selectedIds.has(log.id) ? '#1A3C6E' : '#e5e5e5'}`,
                borderRadius: '10px',
                padding: '14px',
                background: deleteMode && selectedIds.has(log.id) ? '#f8f9ff' : '#fff',
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
                  {SOURCE_LABELS[log.source] ?? getSource(log)}
                </span>
                <span style={{ fontSize: '11px', color: '#aaa' }}>
                  {formatDate(log.createdAt)}
                </span>
              </div>
              {log.title && (
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#222', marginBottom: '4px' }}>
                  {log.title}
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
              <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {expandedId === log.id
                  ? log.content
                  : log.content
                    ? log.content.slice(0, 100) + (log.content.length > 100 ? '...' : '')
                    : ''}
              </p>
              {log.content && log.content.length > 100 && (
                <p style={{ fontSize: '11px', color: '#1A3C6E', marginTop: '6px', textAlign: 'right' }}>
                  {expandedId === log.id ? '▲ 접기' : '▼ 전체보기'}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
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
              </div>
              {expandedId === log.id && (
                <BookMaterialPanel log={log} />
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
