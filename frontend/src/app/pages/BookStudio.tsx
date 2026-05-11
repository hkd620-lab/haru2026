import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { TodayQuote } from '../components/TodayQuote';
import { KNewsSection } from '../components/KNewsSection';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface Book {
  id: string;
  title: string;
  status: 'serializing' | 'draft' | 'private';
  chapterCount?: number;
  createdAt?: { seconds: number };
}

type TabType = 'knews' | 'people' | 'quote' | 'bible';

const STATUS_LABEL: Record<Book['status'], string> = {
  serializing: '연재중',
  draft: '초안',
  private: '비공개',
};

const STATUS_COLOR: Record<Book['status'], string> = {
  serializing: '#10b981',
  draft: '#f59e0b',
  private: '#9ca3af',
};

export function BookStudio() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('knews');

  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;
  const closeToOrigin = () => {
    if (fromPath) {
      navigate(fromPath);
      return;
    }
    const origin = getOrigin();
    if (origin) {
      navigate(origin);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };
  const isDeveloper = user?.uid === DEVELOPER_UID;
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleTitleEdit = (book: Book) => {
    setEditingBookId(book.id);
    setEditingTitle(book.title);
  };

  const handleTitleSave = async (bookId: string) => {
    if (!editingTitle.trim()) return;
    await updateDoc(doc(db, 'books', bookId), { title: editingTitle.trim() });
    setEditingBookId(null);
  };

  useEffect(() => {
    const q = query(collection(db, 'books'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list = await Promise.all(
          snapshot.docs.map(async (d) => {
            const data = d.data() as Omit<Book, 'id'>;
            const chapSnap = await getDocs(
              collection(db, 'books', d.id, 'chapters')
            );
            return {
              id: d.id,
              ...data,
              chapterCount: chapSnap.size,
            };
          })
        );
        setBooks(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const tabButtonClass = (isActive: boolean) =>
    `flex-1 py-2.5 px-2 text-sm rounded-lg ${
      isActive
        ? 'bg-blue-100 text-blue-700 border-2 border-blue-700 font-medium'
        : 'bg-white text-gray-600 border border-gray-200'
    }`;

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}>
      <PageHeaderActions onClose={closeToOrigin} />

      {/* 헤더 */}
      <div className="bg-white px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
          ⚡ 원기충전소
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          매일 한 잔, 마음과 자긍심을 채우세요
        </p>
      </div>

      {/* 🌍 세상 이야기 그룹 */}
      <div className="bg-white px-4 pt-3">
        <div className="text-xs text-gray-500 font-medium mb-2">
          🌍 세상 이야기
        </div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveTab('knews')}
            className={`${tabButtonClass(activeTab === 'knews')} flex items-center justify-center gap-1`}
          >
            <span>🇰🇷</span>
            <span>원기왕성 K뉴스</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-700 text-white">NEW</span>
          </button>
          <button
            onClick={() => setActiveTab('people')}
            className={tabButtonClass(activeTab === 'people')}
          >
            📖 사람속으로
          </button>
        </div>
      </div>

      {/* 💎 내면 이야기 그룹 */}
      <div className="bg-white px-4 pb-4">
        <div className="text-xs text-gray-500 font-medium mb-2">
          💎 내면 이야기
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('quote')}
            className={tabButtonClass(activeTab === 'quote')}
          >
            💬 명언
          </button>
          <button
            onClick={() => setActiveTab('bible')}
            className={tabButtonClass(activeTab === 'bible')}
          >
            ✝️ 성경말씀
          </button>
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-2 bg-gray-100"></div>

      {/* 선택된 탭 콘텐츠 */}
      <div className="p-4">
        {/* K뉴스 탭 */}
        {activeTab === 'knews' && <KNewsSection />}

        {/* 사람속으로 탭 — 기존 책 목록 */}
        {activeTab === 'people' && (
          <div className="max-w-2xl mx-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <div
                  className="w-8 h-8 border-4 rounded-full animate-spin"
                  style={{ borderColor: '#1A3C6E', borderTopColor: 'transparent' }}
                />
              </div>
            ) : books.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <span className="text-4xl block mb-3">📖</span>
                <p>등록된 책이 없습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="rounded-xl border p-5 cursor-pointer transition-shadow hover:shadow-md"
                    style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5' }}
                    onClick={() => navigate(`/book-reader/${book.id}?bookTitle=${encodeURIComponent(book.title)}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {editingBookId === book.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            className="flex-1 border rounded px-2 py-1 text-sm outline-none"
                            style={{ borderColor: '#1A3C6E', fontSize: 16 }}
                            autoFocus
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTitleSave(book.id); }}
                            className="text-xs font-semibold px-2 py-1 rounded text-white"
                            style={{ backgroundColor: '#10b981' }}
                          >저장</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingBookId(null); }}
                            className="text-xs font-semibold px-2 py-1 rounded"
                            style={{ backgroundColor: '#f3f4f6', color: '#666' }}
                          >취소</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <h2 className="text-base font-semibold leading-snug" style={{ color: '#1A3C6E' }}>
                            {book.title || '(제목 없음)'}
                          </h2>
                          {isDeveloper && (
                            <button onClick={(e) => { e.stopPropagation(); handleTitleEdit(book); }} style={{ fontSize: 14, color: '#999' }}>✏️</button>
                          )}
                        </div>
                      )}
                      <span
                        className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: STATUS_COLOR[book.status] + '22',
                          color: STATUS_COLOR[book.status],
                        }}
                      >
                        {STATUS_LABEL[book.status] ?? book.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm" style={{ color: '#6b7280' }}>
                        챕터 {book.chapterCount ?? 0}개
                      </p>
                      {isDeveloper && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/book-create?bookId=${book.id}&bookTitle=${encodeURIComponent(book.title)}`); }}
                          className="text-xs font-semibold px-3 py-1 rounded-lg text-white"
                          style={{ backgroundColor: '#1A3C6E' }}
                        >+ 챕터 추가</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 명언 탭 — 동서양 명언만 표시 (외부 탭으로 제어) */}
        {activeTab === 'quote' && (
          <TodayQuote defaultTab="classic" hideTabSwitcher />
        )}

        {/* 성경말씀 탭 — 성경 말씀만 표시 (외부 탭으로 제어) */}
        {activeTab === 'bible' && (
          <TodayQuote defaultTab="bible" hideTabSwitcher />
        )}
      </div>
    </div>
  );
}
