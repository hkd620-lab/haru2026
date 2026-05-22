import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PageHeaderActions } from '../components/PageHeaderActions';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const NAVY = '#1A3C6E';
const OFFWHITE = '#FAF9F6';

interface BookMaterial {
  enabled?: boolean;
  materialGrade?: string;
  bookMaterialTitle?: string;
  bookSummary?: string;
  humanQuestionCore?: string;
  aiResponseCore?: string;
  thinkingShift?: string;
  collaborationMoment?: string;
  vibeFlow?: string;
  bookPassages?: string[];
  chapterCandidates?: string[];
  topicTags?: string[];
  originalTitle?: string;
}

interface MaterialRecord {
  id: string;
  title: string;
  source?: string;
  createdAt?: any;
  bookMaterial: BookMaterial;
}

interface RecordBook {
  id: string;
  title?: string;
  sourceRecordIds?: string[];
  materialCount?: number;
  updatedAt?: any;
}

interface EditableChapter {
  id: string;
  title?: string;
  body?: string;
  order?: number;
  sourceRecordIds?: string[];
}

const BOILERPLATE_PATTERNS = [
  /v4\s*부터\s*AI는\s*작가가\s*아니라\s*큐레이터입니다/i,
  /카드\s*상단\s*.*재변환하면\s*책\s*사용\s*흔적은\s*보존됩니다/i,
  /원문에서\s*강한\s*부분을\s*그대로\s*살립니다/i,
];

function sanitizeText(value?: string) {
  if (!value) return '';
  return value
    .split(/\r?\n/)
    .filter((line) => !BOILERPLATE_PATTERNS.some((pattern) => pattern.test(line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(value: any) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getMaterialTitle(record: MaterialRecord) {
  return sanitizeText(record.bookMaterial.bookMaterialTitle)
    || sanitizeText(record.bookMaterial.originalTitle)
    || record.title
    || '제목 없는 책소재';
}

function getCoreTopic(material: BookMaterial) {
  const tags = (material.topicTags || []).filter(Boolean).slice(0, 4);
  if (tags.length) return tags.join(' · ');
  const chapters = (material.chapterCandidates || []).filter(Boolean).slice(0, 2);
  if (chapters.length) return chapters.join(' · ');
  return sanitizeText(material.bookSummary).slice(0, 48) || '핵심주제 미정';
}

function buildPreface(title: string, materials: MaterialRecord[]) {
  const topics = materials
    .map((m) => getCoreTopic(m.bookMaterial))
    .filter(Boolean)
    .slice(0, 10);

  return [
    `${title} 가편`,
    '',
    '이 기록물은 지식창고에서 책소재로 변환된 대화만 모아 만든 초안입니다.',
    '원본 대화 전체가 아니라, 책소재 요약·사고 흐름·인용문단·예상 챕터만 사용했습니다.',
    '',
    '핵심 주제',
    ...topics.map((topic, index) => `${index + 1}. ${topic}`),
    '',
    '편집 메모',
    '차례, 장 제목, 본문은 모두 이 화면에서 수정할 수 있습니다.',
  ].join('\n');
}

function buildChapterBody(record: MaterialRecord) {
  const m = record.bookMaterial;
  const passages = (m.bookPassages || []).map(sanitizeText).filter(Boolean);
  const candidates = (m.chapterCandidates || []).map(sanitizeText).filter(Boolean);
  const tags = (m.topicTags || []).filter(Boolean);

  const lines = [
    '책소재 요약',
    sanitizeText(m.bookSummary),
    '',
    '인간 질문 핵심',
    sanitizeText(m.humanQuestionCore),
    '',
    'AI 응답 핵심',
    sanitizeText(m.aiResponseCore),
    '',
    '사고 변화',
    sanitizeText(m.thinkingShift),
    '',
    'AI 협업 장면',
    sanitizeText(m.collaborationMoment),
    '',
    '바이브 흐름',
    sanitizeText(m.vibeFlow),
  ];

  if (passages.length) {
    lines.push('', '책 인용문단', ...passages.map((p, index) => `${index + 1}. ${p}`));
  }
  if (candidates.length) {
    lines.push('', '예상 챕터', candidates.join(' / '));
  }
  if (tags.length) {
    lines.push('', '주제 태그', tags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' '));
  }

  return sanitizeText(lines.filter((line) => line !== undefined).join('\n'));
}

export function RecordBookPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDeveloper = user?.uid === DEVELOPER_UID;

  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recordTitle, setRecordTitle] = useState('나의 기록물 가편');
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState<RecordBook[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<EditableChapter[]>([]);
  const [editingTitle, setEditingTitle] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!isDeveloper) navigate('/');
  }, [user, isDeveloper, navigate]);

  const loadMaterials = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'records'));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((item) => item?.bookMaterial?.enabled)
        .map((item) => ({
          id: item.id,
          title: item.ai_title || item.title || item.bookMaterial?.originalTitle || '제목 없음',
          source: item.source,
          createdAt: item.createdAt || item.timestamp,
          bookMaterial: item.bookMaterial as BookMaterial,
        }))
        .sort((a, b) => {
          const ad = a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime();
          const bd = b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime();
          return bd - ad;
        });
      setMaterials(list);
    } catch (e: any) {
      console.error('책소재 로드 실패:', e);
      toast.error(e?.message || '책소재를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const loadBooks = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'books')));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as RecordBook)
        .filter((b: any) => b.kind === 'recordBook')
        .sort((a, b) => {
          const ad = a.updatedAt?.toMillis?.() || 0;
          const bd = b.updatedAt?.toMillis?.() || 0;
          return bd - ad;
        });
      setBooks(list);
    } catch (e) {
      console.error('기록물 목록 로드 실패:', e);
    }
  }, []);

  const loadChapters = useCallback(async (bookId: string) => {
    const snap = await getDocs(collection(db, 'books', bookId, 'chapters'));
    const list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }) as EditableChapter)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setChapters(list);
    const book = books.find((b) => b.id === bookId);
    setEditingTitle(book?.title || '');
  }, [books]);

  useEffect(() => {
    if (isDeveloper) {
      loadMaterials();
      loadBooks();
    }
  }, [isDeveloper, loadMaterials, loadBooks]);

  const selectedMaterials = useMemo(
    () => materials.filter((m) => selectedIds.has(m.id)),
    [materials, selectedIds],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createDraft = async () => {
    const title = recordTitle.trim();
    if (!title) {
      toast.error('기록물 이름을 입력해 주세요.');
      return;
    }
    if (!selectedMaterials.length) {
      toast.error('책소재를 하나 이상 선택해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const bookRef = doc(collection(db, 'books'));
      const batch = writeBatch(db);
      const now = serverTimestamp();
      const sourceRecordIds = selectedMaterials.map((m) => m.id);
      batch.set(bookRef, {
        kind: 'recordBook',
        bookId: bookRef.id,
        title,
        stage: 'draft',
        source: 'knowledgeWarehouseBookMaterials',
        sourceRecordIds,
        materialCount: selectedMaterials.length,
        createdAt: now,
        updatedAt: now,
      });

      const prefaceRef = doc(collection(db, 'books', bookRef.id, 'chapters'));
      batch.set(prefaceRef, {
        chapterId: prefaceRef.id,
        bookId: bookRef.id,
        title: '머리말과 차례 초안',
        body: buildPreface(title, selectedMaterials),
        order: 0,
        sourceRecordIds,
        editable: true,
        createdAt: now,
        updatedAt: now,
      });

      selectedMaterials.forEach((material, index) => {
        const chapterRef = doc(collection(db, 'books', bookRef.id, 'chapters'));
        batch.set(chapterRef, {
          chapterId: chapterRef.id,
          bookId: bookRef.id,
          title: getMaterialTitle(material),
          body: buildChapterBody(material),
          order: index + 1,
          sourceRecordIds: [material.id],
          materialTitle: getMaterialTitle(material),
          coreTopic: getCoreTopic(material.bookMaterial),
          editable: true,
          createdAt: now,
          updatedAt: now,
        });
      });

      await batch.commit();
      toast.success('기록물 가편을 만들었습니다.');
      setActiveBookId(bookRef.id);
      setEditingTitle(title);
      await loadBooks();
      const chapSnap = await getDocs(collection(db, 'books', bookRef.id, 'chapters'));
      setChapters(chapSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }) as EditableChapter)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch (e: any) {
      console.error('기록물 생성 실패:', e);
      toast.error(e?.message || '기록물 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const selectBook = async (book: RecordBook) => {
    setActiveBookId(book.id);
    setEditingTitle(book.title || '');
    await loadChapters(book.id);
  };

  const saveBookTitle = async () => {
    if (!activeBookId || !editingTitle.trim()) return;
    await updateDoc(doc(db, 'books', activeBookId), {
      title: editingTitle.trim(),
      updatedAt: serverTimestamp(),
    });
    await loadBooks();
    toast.success('기록물 이름을 저장했습니다.');
  };

  const updateChapterLocal = (id: string, patch: Partial<EditableChapter>) => {
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const saveChapter = async (chapter: EditableChapter) => {
    if (!activeBookId) return;
    setSavingId(chapter.id);
    try {
      await updateDoc(doc(db, 'books', activeBookId, 'chapters', chapter.id), {
        title: (chapter.title || '').trim() || '제목 없음',
        body: chapter.body || '',
        updatedAt: serverTimestamp(),
      });
      toast.success('장을 저장했습니다.');
    } catch (e: any) {
      toast.error(e?.message || '장 저장 실패');
    } finally {
      setSavingId(null);
    }
  };

  const addChapter = async () => {
    if (!activeBookId) return;
    const ref = doc(collection(db, 'books', activeBookId, 'chapters'));
    const order = chapters.reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1;
    const chapter = {
      chapterId: ref.id,
      bookId: activeBookId,
      title: '새 장',
      body: '',
      order,
      editable: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(ref, chapter);
    batch.update(doc(db, 'books', activeBookId), { updatedAt: serverTimestamp() });
    await batch.commit();
    await loadChapters(activeBookId);
    toast.success('새 장을 추가했습니다.');
  };

  const deleteChapter = async (chapter: EditableChapter) => {
    if (!activeBookId) return;
    if (!window.confirm(`'${chapter.title || '제목 없음'}' 장을 삭제할까요?`)) return;
    await deleteDoc(doc(db, 'books', activeBookId, 'chapters', chapter.id));
    await loadChapters(activeBookId);
    toast.success('삭제했습니다.');
  };

  const moveChapter = async (index: number, direction: -1 | 1) => {
    if (!activeBookId) return;
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[target]] = [next[target], next[index]];
    const batch = writeBatch(db);
    next.forEach((chapter, order) => {
      batch.update(doc(db, 'books', activeBookId, 'chapters', chapter.id), {
        order,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    setChapters(next.map((chapter, order) => ({ ...chapter, order })));
  };

  if (!user || !isDeveloper) return null;

  return (
    <div style={{ minHeight: '100vh', background: OFFWHITE, color: NAVY, paddingBottom: 90 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: OFFWHITE, borderBottom: '1px solid #E5E7EB', padding: '14px 16px' }}>
        <PageHeaderActions onClose={() => navigate('/admin/console')} />
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '8px 0 2px' }}>📝 기록물생성</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
          지식창고의 책소재만 골라 기록물 가편을 만들고 직접 편집합니다.
        </p>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px' }}>기록물 이름</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={recordTitle}
              onChange={(e) => setRecordTitle(e.target.value)}
              placeholder="예: HARU2026 플랫폼 전략 기록"
              style={{ flex: '1 1 260px', border: '1px solid #D1D5DB', borderRadius: 8, padding: '11px 12px', fontSize: 14 }}
            />
            <button
              onClick={createDraft}
              disabled={loading || !selectedMaterials.length}
              style={{ border: 0, borderRadius: 8, padding: '0 16px', background: selectedMaterials.length ? NAVY : '#CBD5E1', color: '#fff', fontWeight: 800 }}
            >
              가편 생성
            </button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6B7280' }}>
            선택한 책소재 {selectedMaterials.length}개. 원본 대화와 도움말 문구는 가져오지 않습니다.
          </p>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>지식창고 책소재 선택</h2>
            <button
              onClick={loadMaterials}
              style={{ border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', padding: '7px 10px', fontSize: 12, fontWeight: 700, color: NAVY }}
            >
              새로고침
            </button>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {materials.length === 0 && (
              <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>
                아직 책소재로 변환된 대화가 없습니다. SAYU 지식창고에서 📚 책소재 변환을 먼저 해주세요.
              </p>
            )}
            {materials.map((material) => {
              const checked = selectedIds.has(material.id);
              return (
                <label
                  key={material.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr',
                    gap: 10,
                    border: `1px solid ${checked ? NAVY : '#E5E7EB'}`,
                    borderRadius: 10,
                    padding: 12,
                    background: checked ? '#F0F7FF' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(material.id)}
                    style={{ marginTop: 4 }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>
                      {getMaterialTitle(material)}
                    </div>
                    <div style={{ fontSize: 12, color: '#2563EB', marginTop: 3 }}>
                      핵심주제: {getCoreTopic(material.bookMaterial)}
                    </div>
                    <p style={{ fontSize: 13, color: '#4B5563', margin: '7px 0 0', lineHeight: 1.55 }}>
                      {sanitizeText(material.bookMaterial.bookSummary).slice(0, 160) || '책소재 요약 없음'}
                    </p>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                      {material.bookMaterial.materialGrade || '등급 없음'} · {formatDate(material.createdAt)}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {books.length > 0 && (
          <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px' }}>기존 기록물 가편</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {books.map((book) => (
                <button
                  key={book.id}
                  onClick={() => selectBook(book)}
                  style={{
                    border: `1px solid ${activeBookId === book.id ? NAVY : '#E5E7EB'}`,
                    borderRadius: 8,
                    background: activeBookId === book.id ? '#F0F7FF' : '#fff',
                    color: NAVY,
                    padding: 11,
                    textAlign: 'left',
                  }}
                >
                  <b>{book.title || '제목 없는 기록물'}</b>
                  <span style={{ color: '#6B7280', fontSize: 12 }}> · 책소재 {book.materialCount || book.sourceRecordIds?.length || 0}개</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {activeBookId && (
          <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px' }}>가편 편집</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="기록물 제목"
                style={{ flex: '1 1 260px', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}
              />
              <button
                onClick={saveBookTitle}
                style={{ border: 0, borderRadius: 8, padding: '0 14px', background: NAVY, color: '#fff', fontWeight: 800 }}
              >
                제목 저장
              </button>
              <button
                onClick={addChapter}
                style={{ border: '1px solid #D1D5DB', borderRadius: 8, padding: '0 14px', background: '#fff', color: NAVY, fontWeight: 800 }}
              >
                장 추가
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chapters.map((chapter, index) => (
                <article key={chapter.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, background: '#FCFCFD' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#6B7280', width: 28 }}>{index + 1}</span>
                    <input
                      value={chapter.title || ''}
                      onChange={(e) => updateChapterLocal(chapter.id, { title: e.target.value })}
                      style={{ flex: 1, border: '1px solid #D1D5DB', borderRadius: 8, padding: '9px 10px', fontWeight: 800, color: NAVY }}
                    />
                  </div>
                  <textarea
                    value={chapter.body || ''}
                    onChange={(e) => updateChapterLocal(chapter.id, { body: e.target.value })}
                    rows={12}
                    style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.65, resize: 'vertical', color: '#111827' }}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <button
                      onClick={() => saveChapter(chapter)}
                      disabled={savingId === chapter.id}
                      style={{ border: 0, borderRadius: 8, padding: '8px 12px', background: NAVY, color: '#fff', fontWeight: 800 }}
                    >
                      {savingId === chapter.id ? '저장 중' : '장 저장'}
                    </button>
                    <button onClick={() => moveChapter(index, -1)} style={smallButtonStyle}>위로</button>
                    <button onClick={() => moveChapter(index, 1)} style={smallButtonStyle}>아래로</button>
                    <button onClick={() => deleteChapter(chapter)} style={{ ...smallButtonStyle, color: '#B91C1C' }}>삭제</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const smallButtonStyle = {
  border: '1px solid #D1D5DB',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#fff',
  color: NAVY,
  fontWeight: 800,
} as const;
