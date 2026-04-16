import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

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

  const isDeveloper = user?.uid === DEVELOPER_UID;

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
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#1A3C6E' }}
              onClick={() => alert('새 책 만들기 — 준비 중')}
            >
              + 새 책 만들기
            </button>
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
                  <h2
                    className="text-base font-semibold leading-snug"
                    style={{ color: '#1A3C6E' }}
                  >
                    {book.title || '(제목 없음)'}
                  </h2>
                  <span
                    className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        STATUS_COLOR[book.status] + '22',
                      color: STATUS_COLOR[book.status],
                    }}
                  >
                    {STATUS_LABEL[book.status] ?? book.status}
                  </span>
                </div>
                <p className="mt-2 text-sm" style={{ color: '#6b7280' }}>
                  챕터 {book.chapterCount ?? 0}개
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
