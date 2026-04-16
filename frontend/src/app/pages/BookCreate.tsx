import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';

export function BookCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!title.trim() || !sourceText.trim()) {
      setError('제목과 소스 자료를 모두 입력해주세요.');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      // 책 기본 정보 먼저 저장
      const bookRef = await addDoc(collection(db, 'books'), {
        title: title.trim(),
        authorUid: user?.uid ?? '',
        status: 'draft',
        coverColor: '#1A3C6E',
        totalChapters: 0,
        totalReaders: 0,
        promptVersion: 'v1.0',
        createdAt: serverTimestamp(),
      });

      // bookId 업데이트 (Firestore에는 별도 필드로 저장)
      setBookId(bookRef.id);

      // AI 챕터 생성
      const generateBook = httpsCallable(functions, 'generateBook');
      const response = await generateBook({
        bookId: bookRef.id,
        title: title.trim(),
        sourceText: sourceText.trim(),
      });

      const data = response.data as { success: boolean; content: string };
      if (data.success) {
        setResult(data.content);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!bookId) return;
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const generateBook = httpsCallable(functions, 'generateBook');
      const response = await generateBook({
        bookId,
        title: title.trim(),
        sourceText: sourceText.trim(),
      });
      const data = response.data as { success: boolean; content: string };
      if (data.success) setResult(data.content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    navigate('/book-studio');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}>
      {/* 헤더 */}
      <div
        className="sticky top-0 z-10 px-4 py-4 border-b"
        style={{ backgroundColor: '#FAF9F6', borderColor: '#e5e5e5' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/book-studio')}
            className="text-sm font-medium"
            style={{ color: '#1A3C6E' }}
          >
            ← 뒤로
          </button>
          <h1 className="text-xl font-bold" style={{ color: '#1A3C6E' }}>
            새 책 만들기
          </h1>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* 제목 입력 */}
        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: '#1A3C6E' }}>
            책 제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 세종대왕의 한글 창제"
            className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2"
            style={{
              borderColor: '#d1d5db',
              backgroundColor: '#ffffff',
              color: '#1A3C6E',
              fontSize: 16,
            }}
          />
        </div>

        {/* 소스 입력 */}
        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: '#1A3C6E' }}>
            소스 자료 <span className="font-normal text-gray-400">(노트북LM 결과 붙여넣기)</span>
          </label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="노트북LM 분석 결과를 여기에 붙여넣으세요."
            rows={10}
            className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2 resize-none"
            style={{
              borderColor: '#d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: 16,
            }}
          />
        </div>

        {/* 오류 메시지 */}
        {error && (
          <p className="text-sm rounded-lg px-4 py-3" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
            {error}
          </p>
        )}

        {/* 생성 버튼 */}
        {!result && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold text-base transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#1A3C6E' }}
          >
            {loading ? 'AI가 챕터를 작성하고 있어요...' : 'AI로 챕터 생성'}
          </button>
        )}

        {/* 로딩 인디케이터 */}
        {loading && (
          <div className="flex justify-center py-4">
            <div
              className="w-8 h-8 border-4 rounded-full animate-spin"
              style={{ borderColor: '#1A3C6E', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {/* 결과 미리보기 */}
        {result && (
          <div>
            <h2 className="text-sm font-semibold mb-2" style={{ color: '#1A3C6E' }}>
              생성된 챕터 미리보기
            </h2>
            <div
              className="rounded-xl border p-5 text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                backgroundColor: '#ffffff',
                borderColor: '#e5e5e5',
                color: '#374151',
              }}
            >
              {result}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-lg text-white font-semibold text-base transition-opacity"
                style={{ backgroundColor: '#10b981' }}
              >
                저장
              </button>
              <button
                onClick={handleRegenerate}
                disabled={loading}
                className="flex-1 py-3 rounded-lg font-semibold text-base border transition-opacity disabled:opacity-50"
                style={{ borderColor: '#1A3C6E', color: '#1A3C6E', backgroundColor: '#ffffff' }}
              >
                {loading ? '생성 중...' : '다시 생성'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
