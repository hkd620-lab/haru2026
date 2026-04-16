import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
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

const NOTEBOOK_PROMPT = `아래 구조로 [인물 이름]을 분석해줘.
소스에 있는 내용만 사용하고
없는 내용은 "소스 없음"으로 표시해줘.

■ 한 줄 요약
이 사람을 한 문장으로 표현하면?

1. 출발 (배경)
   태어난 환경, 가족, 가난/부, 초기 상황
   (3~5문장)

2. SWOT 분석
   - 강점: 이 사람만의 특별한 능력이나 성격
   - 약점: 가장 큰 한계나 단점
   - 위기: 가장 힘들었던 외부 상황
   - 기회: 삶을 바꾼 결정적 기회

3. 결혼과 부부관계
   - 배우자는 어떤 사람?
   - 부부관계가 성공에 어떤 영향을 줬나?
   - 가정생활은 어땠나?

4. 결과
   말년 포함 최종 결과, 사회적 평가
   (3~5문장)

5. 출처
   위 내용의 근거 소스 제목들`;

export function BookStudio() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [humanResearchOpen, setHumanResearchOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(NOTEBOOK_PROMPT).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  const navigate = useNavigate();
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
              onClick={() => navigate('/book-create')}
            >
              + 새 책 만들기
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* 노트북LM 질문 모음 */}
        <div className="mb-6">
          {/* 섹션 헤더 */}
          <button
            onClick={() => setNotebookOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-xl border p-5 transition-shadow hover:shadow-md"
            style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5', color: '#1A3C6E' }}
          >
            <span className="text-base font-semibold">🗂 노트북LM 질문 모음</span>
            <span style={{ fontSize: '11px' }}>{notebookOpen ? '▼' : '▶'}</span>
          </button>

          {notebookOpen && (
            <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: '#e5e5e5', backgroundColor: '#ffffff' }}>
              {/* 인간 연구 항목 */}
              <button
                onClick={() => setHumanResearchOpen((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                style={{ color: '#1A3C6E' }}
              >
                <span className="text-sm font-semibold">인간 연구</span>
                <span style={{ fontSize: '11px', color: '#999' }}>{humanResearchOpen ? '▼' : '▶'}</span>
              </button>

              {humanResearchOpen && (
                <div className="border-t px-5 pb-4 pt-3" style={{ borderColor: '#f0f0f0' }}>
                  <pre
                    className="text-xs leading-relaxed whitespace-pre-wrap rounded-lg p-3 overflow-y-auto"
                    style={{
                      backgroundColor: '#f3f4f6',
                      fontFamily: 'monospace',
                      color: '#374151',
                      maxHeight: '200px',
                    }}
                  >
                    {NOTEBOOK_PROMPT}
                  </pre>
                  <button
                    onClick={handleCopy}
                    className="mt-3 w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: copied ? '#10b981' : '#1A3C6E' }}
                  >
                    {copied ? '복사 완료!' : '복사하기'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
