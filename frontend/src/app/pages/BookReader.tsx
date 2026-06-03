import { useState, useEffect, useRef } from 'react';
import { collection, doc, getDoc, query, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
  sourceTitle?: string;
}

export function BookReader() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const requestedBookTitle = searchParams.get('bookTitle') ?? '책 읽기';
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [bookTitle, setBookTitle] = useState(requestedBookTitle);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [canRead, setCanRead] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [titleSavingId, setTitleSavingId] = useState<string | null>(null);
  const [titleSuggestingId, setTitleSuggestingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fns = getFunctions(undefined, 'asia-northeast3');
  const isDeveloper = user?.uid === DEVELOPER_UID;

  useEffect(() => {
    if (authLoading) return;
    if (!bookId || !user?.uid) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;
    const checkBookAccess = async () => {
      setLoading(true);
      setCanRead(false);
      setChapters([]);
      try {
        const bookSnap = await getDoc(doc(db, 'books', bookId));
        const data = bookSnap.data() as { status?: string; title?: string } | undefined;
        const isDeveloper = user.uid === DEVELOPER_UID;
        const allowed = bookSnap.exists() && (data?.status === 'serializing' || isDeveloper);

        if (!allowed) {
          navigate('/', { replace: true });
          return;
        }

        if (cancelled) return;
        setBookTitle(data?.title || requestedBookTitle);
        setCanRead(true);
      } catch (error) {
        console.error('책 접근 확인 실패:', error);
        navigate('/', { replace: true });
      }
    };

    checkBookAccess();
    return () => {
      cancelled = true;
    };
  }, [authLoading, bookId, navigate, requestedBookTitle, user?.uid]);

  useEffect(() => {
    if (!bookId || !canRead) return;
    const q = query(
      collection(db, 'books', bookId, 'chapters'),
      orderBy('order')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Chapter, 'id'>),
        }));
        setChapters(list);
        setLoading(false);
      },
      (error) => {
        console.error('챕터 로드 실패:', error);
        navigate('/', { replace: true });
      },
    );
    return () => unsub();
  }, [bookId, canRead, navigate]);

  const handleTTS = async (text: string, key: string) => {
    if (ttsPlaying === key) {
      audioRef.current?.pause();
      setTtsPlaying(null);
      return;
    }
    try {
      setTtsLoading(key);
      const silentAudio = new Audio(
        'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA'
      );
      await silentAudio.play().catch(() => {});
      const fn = httpsCallable(fns, 'generateTTS');
      const res: any = await fn({ text, cacheKey: key });
      if (audioRef.current) audioRef.current.pause();
      let audioSrc = '';
      if (res.data.audioUrl) {
        audioSrc = res.data.audioUrl;
      } else if (res.data.audioBase64) {
        const binary = atob(res.data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        audioSrc = URL.createObjectURL(blob);
      }
      if (audioSrc) {
        setTtsLoading(null);
        setTtsPlaying(key);
        audioRef.current = new Audio(audioSrc);
        audioRef.current.onended = () => setTtsPlaying(null);
        try {
          await audioRef.current.play();
        } catch {
          setTimeout(async () => {
            try { await audioRef.current?.play(); } catch {}
          }, 300);
        }
      }
    } catch {
      setTtsLoading(null);
      setTtsPlaying(null);
    }
  };

  const startTitleEdit = (chapter: Chapter) => {
    if (!isDeveloper) return;
    setEditingChapterId(chapter.id);
    setEditingTitle(chapter.title || '');
  };

  const cancelTitleEdit = () => {
    setEditingChapterId(null);
    setEditingTitle('');
  };

  const saveChapterTitle = async (chapter: Chapter) => {
    if (!bookId || !isDeveloper) return;
    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;

    setTitleSavingId(chapter.id);
    try {
      await updateDoc(doc(db, 'books', bookId, 'chapters', chapter.id), {
        title: nextTitle,
      });
      cancelTitleEdit();
    } catch (error) {
      console.error('챕터 제목 저장 실패:', error);
      window.alert('챕터 제목 저장에 실패했습니다.');
    } finally {
      setTitleSavingId(null);
    }
  };

  const suggestTitle = async (chapter: Chapter, fallbackOrder: number) => {
    if (!isDeveloper) return;

    setTitleSuggestingId(chapter.id);
    try {
      const fn = httpsCallable(fns, 'suggestChapterTitle');
      const res: any = await fn({
        content: chapter.content || '',
        sourceTitle: chapter.sourceTitle || '',
        order: chapter.order || fallbackOrder,
      });
      const nextTitle = String(res.data?.title || '').trim();
      if (nextTitle) {
        setEditingChapterId(chapter.id);
        setEditingTitle(nextTitle);
      }
    } catch (error) {
      console.error('AI 챕터 제목 제안 실패:', error);
      window.alert('AI 제목 제안에 실패했습니다.');
    } finally {
      setTitleSuggestingId(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F6' }}>
      {/* 헤더 */}
      <div
        className="sticky top-0 z-10 px-4 py-4 border-b"
        style={{ backgroundColor: '#1A3C6E', borderColor: '#e5e5e5' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-white text-xl font-bold"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-white flex-1 truncate">
            {bookTitle}
          </h1>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 border-4 rounded-full animate-spin"
              style={{ borderColor: '#1A3C6E', borderTopColor: 'transparent' }}
            />
          </div>
        ) : chapters.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <span className="text-4xl block mb-3">📖</span>
            <p>아직 챕터가 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chapters.map((chapter, index) => {
              const isOpen = openIndex === index;
              const isEditingTitle = editingChapterId === chapter.id;
              const isSavingTitle = titleSavingId === chapter.id;
              const isSuggestingTitle = titleSuggestingId === chapter.id;
              return (
                <div
                  key={chapter.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: isOpen ? '#1A3C6E' : '#e5e5e5',
                    borderWidth: isOpen ? 2 : 1,
                  }}
                >
                  {/* 챕터 헤더 */}
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => setOpenIndex(isOpen ? null : index)}
                      >
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{
                            backgroundColor: isOpen ? '#1A3C6E' : '#e8edf5',
                            color: isOpen ? '#ffffff' : '#1A3C6E',
                          }}
                        >
                          {index + 1}
                        </span>
                        <span
                          className="min-w-0 text-base font-semibold leading-snug"
                          style={{ color: '#1A3C6E' }}
                        >
                          {chapter.title}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {isDeveloper && !isEditingTitle && (
                          <>
                            <button
                              type="button"
                              className="px-2 py-1 rounded-md text-sm font-medium"
                              style={{ color: '#1A3C6E', backgroundColor: '#e8edf5' }}
                              onClick={() => startTitleEdit(chapter)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1 rounded-md text-xs font-semibold disabled:opacity-60"
                              style={{ color: '#ffffff', backgroundColor: '#8B4789' }}
                              disabled={isSuggestingTitle}
                              onClick={() => suggestTitle(chapter, index + 1)}
                            >
                              {isSuggestingTitle ? '제안 중...' : 'AI 제목 제안'}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="px-1"
                          style={{ color: '#1A3C6E', fontSize: 20 }}
                          onClick={() => setOpenIndex(isOpen ? null : index)}
                        >
                          {isOpen ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    {isDeveloper && isEditingTitle && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                          style={{ borderColor: '#cfd8e6', color: '#1A3C6E' }}
                          placeholder="예: 1장 김주하 — 흔들림 속에서도 품격을 지킨 사람"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: '#8B4789' }}
                            disabled={isSuggestingTitle}
                            onClick={() => suggestTitle(chapter, index + 1)}
                          >
                            {isSuggestingTitle ? '제안 중...' : 'AI 제목 제안'}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: '#1A3C6E' }}
                            disabled={isSavingTitle || !editingTitle.trim()}
                            onClick={() => saveChapterTitle(chapter)}
                          >
                            {isSavingTitle ? '저장 중...' : '저장'}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-60"
                            style={{ borderColor: '#d1d5db', color: '#4b5563' }}
                            disabled={isSavingTitle}
                            onClick={cancelTitleEdit}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 챕터 내용 */}
                  {isOpen && (
                    <div
                      className="px-5 pb-6"
                      style={{ borderTop: '1px solid #e5e5e5' }}
                    >
                      <button
                        className="mt-4 mb-3 px-4 py-2 rounded-lg text-sm font-medium text-white"
                        style={{
                          backgroundColor:
                            ttsPlaying === `chapter_${chapter.id}`
                              ? '#8B4789'
                              : '#1A3C6E',
                        }}
                        onClick={() => handleTTS(chapter.content, `chapter_${chapter.id}`)}
                      >
                        {ttsLoading === `chapter_${chapter.id}`
                          ? '⏳ 로딩 중...'
                          : ttsPlaying === `chapter_${chapter.id}`
                          ? '⏸ 정지'
                          : '🔊 듣기'}
                      </button>
                      <p
                        className="leading-8 whitespace-pre-wrap"
                        style={{ color: '#333333', fontSize: 15 }}
                      >
                        {chapter.content || '내용이 없습니다.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
