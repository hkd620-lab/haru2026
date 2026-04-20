import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
}

export function BookReader() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const bookTitle = searchParams.get('bookTitle') ?? '책 읽기';
  const navigate = useNavigate();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fns = getFunctions(undefined, 'asia-northeast3');

  useEffect(() => {
    if (!bookId) return;
    const q = query(
      collection(db, 'books', bookId, 'chapters'),
      orderBy('order')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Chapter, 'id'>),
      }));
      setChapters(list);
      setLoading(false);
    });
    return () => unsub();
  }, [bookId]);

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
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <div className="flex items-center gap-3">
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
                        className="text-base font-semibold"
                        style={{ color: '#1A3C6E' }}
                      >
                        {chapter.title}
                      </span>
                    </div>
                    <span style={{ color: '#1A3C6E', fontSize: 20 }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

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
