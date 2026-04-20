import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface Book {
  id: string;
  title: string;
  status: 'serializing' | 'draft' | 'private';
  chapterCount?: number;
  createdAt?: { seconds: number };
}

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

  const navigate = useNavigate();
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
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Book, 'id'>),
        }));
        setBooks(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}
    >
      {/* 헤더 */}
      <div
        className="sticky top-0 z-10 px-4 py-4 border-b"
        style={{ backgroundColor: '#FAF9F6', borderColor: '#e5e5e5' }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h1 className="text-xl font-bold" style={{ color: '#1A3C6E' }}>
              책 스튜디오
            </h1>
          </div>
          {isDeveloper && (
            <div className="flex items-center gap-2">
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#1A3C6E' }}
                onClick={() => navigate('/book-create')}
              >
                + 새 책 만들기
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-90"
                style={{ borderColor: '#10b981', color: '#10b981', backgroundColor: 'transparent' }}
                onClick={() => navigate('/novel-studio')}
              >
                ✍️ 창작소설
              </button>
            </div>
          )}
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
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e5e5e5',
                }}
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
                        onClick={() => handleTitleSave(book.id)}
                        className="text-xs font-semibold px-2 py-1 rounded text-white"
                        style={{ backgroundColor: '#10b981' }}
                      >저장</button>
                      <button
                        onClick={() => setEditingBookId(null)}
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
                        <button onClick={() => handleTitleEdit(book)} style={{ fontSize: 14, color: '#999' }}>✏️</button>
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
                      onClick={() => navigate(`/book-create?bookId=${book.id}&bookTitle=${encodeURIComponent(book.title)}`)}
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
    </div>
  );
}
