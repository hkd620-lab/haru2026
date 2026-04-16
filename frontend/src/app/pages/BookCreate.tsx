import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';

interface Source {
  sourceTitle: string;
  sourceText: string;
}

interface GenerateResult {
  success: boolean;
  chapters: Array<{ chapterId: string; content: string; sourceTitle: string }>;
  totalChapters: number;
}

export function BookCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [sources, setSources] = useState<Source[]>([
    { sourceTitle: '', sourceText: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 소스 추가
  const addSource = () => {
    setSources((prev) => [...prev, { sourceTitle: '', sourceText: '' }]);
  };

  // 소스 삭제
  const removeSource = (idx: number) => {
    setSources((prev) => prev.filter((_, i) => i !== idx));
  };

  // 소스 필드 변경
  const updateSource = (idx: number, field: keyof Source, value: string) => {
    setSources((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      setError('책 주제를 입력해주세요.');
      return;
    }
    const validSources = sources.filter((s) => s.sourceText.trim());
    if (validSources.length === 0) {
      setError('소스 내용을 하나 이상 입력해주세요.');
      return;
    }

    setError(null);
    setLoading(true);
    setResults(null);
    setProgressMsg('');

    try {
      // 책 기본 정보 먼저 저장
      setProgressMsg('책 정보를 저장하는 중...');
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

      // 진행 상태 메시지를 UI에 표시하면서 Function 호출
      const total = validSources.length;
      // 프로그레스 메시지 시뮬레이션 (실제 처리는 서버에서 순차 진행)
      let tick = 0;
      const progressInterval = setInterval(() => {
        if (tick < total) {
          const label = validSources[tick].sourceTitle.trim() || `소스 ${tick + 1}`;
          setProgressMsg(`소스 ${tick + 1}/${total} 처리 중... (${label})`);
          tick++;
        } else {
          setProgressMsg('심리 레이어 챕터 생성 중...');
        }
      }, 8000);

      const generateBook = httpsCallable(functions, 'generateBook');
      const response = await generateBook({
        bookId: bookRef.id,
        title: title.trim(),
        sources: validSources,
      });

      clearInterval(progressInterval);

      const data = response.data as GenerateResult;
      if (data.success) {
        setProgressMsg(`완료! 챕터 ${data.totalChapters}개가 생성되었습니다.`);
        setResults(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setError(msg);
      setProgressMsg('');
    } finally {
      setLoading(false);
    }
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

        {/* 책 주제 입력 */}
        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: '#1A3C6E' }}>
            책 주제
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 못생기고 가난했지만 영광을 누린 사람들"
            className="w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2"
            style={{
              borderColor: '#d1d5db',
              backgroundColor: '#ffffff',
              color: '#1A3C6E',
              fontSize: 16,
            }}
          />
        </div>

        {/* 소스 목록 */}
        <div className="flex flex-col gap-4">
          {sources.map((source, idx) => (
            <div
              key={idx}
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                border: '1.5px solid #c7d6ea',
                backgroundColor: '#f4f8fc',
              }}
            >
              {/* 소스 헤더 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: '#1A3C6E' }}>
                  소스 {idx + 1}
                </span>
                {sources.length >= 2 && (
                  <button
                    onClick={() => removeSource(idx)}
                    className="text-xs font-medium"
                    style={{ color: '#dc2626' }}
                  >
                    이 소스 삭제
                  </button>
                )}
              </div>

              {/* 소스 제목 */}
              <input
                type="text"
                value={source.sourceTitle}
                onChange={(e) => updateSource(idx, 'sourceTitle', e.target.value)}
                placeholder="소스 제목 (예: 링컨 관련 자료)"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: '#d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#1A3C6E',
                  fontSize: 16,
                }}
              />

              {/* 소스 내용 */}
              <textarea
                value={source.sourceText}
                onChange={(e) => updateSource(idx, 'sourceText', e.target.value)}
                placeholder="노트북LM 분석 결과를 여기에 붙여넣으세요."
                rows={8}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
                style={{
                  borderColor: '#d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: 16,
                }}
              />
            </div>
          ))}
        </div>

        {/* 소스 추가 버튼 */}
        {!results && (
          <button
            onClick={addSource}
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold border transition-opacity disabled:opacity-40"
            style={{ borderColor: '#1A3C6E', color: '#1A3C6E', backgroundColor: 'transparent' }}
          >
            + 소스 추가
          </button>
        )}

        {/* 오류 메시지 */}
        {error && (
          <p className="text-sm rounded-lg px-4 py-3" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
            {error}
          </p>
        )}

        {/* 생성 버튼 */}
        {!results && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-lg text-white font-semibold text-base transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#1A3C6E' }}
          >
            AI로 챕터 생성
          </button>
        )}

        {/* 진행 상태 */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div
              className="w-8 h-8 border-4 rounded-full animate-spin"
              style={{ borderColor: '#1A3C6E', borderTopColor: 'transparent' }}
            />
            {progressMsg && (
              <p className="text-sm font-medium text-center" style={{ color: '#1A3C6E' }}>
                {progressMsg}
              </p>
            )}
          </div>
        )}

        {/* 완료 메시지 */}
        {!loading && progressMsg && results && (
          <p className="text-sm font-semibold text-center py-2" style={{ color: '#10b981' }}>
            {progressMsg}
          </p>
        )}

        {/* 결과 미리보기 */}
        {results && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold" style={{ color: '#1A3C6E' }}>
              생성된 챕터 미리보기
            </h2>
            {results.chapters.map((ch, idx) => (
              <div key={ch.chapterId} className="flex flex-col gap-2">
                <p className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                  {idx + 1 === results.totalChapters ? '심리 레이어 챕터' : `챕터 ${idx + 1} — ${ch.sourceTitle || `소스 ${idx + 1}`}`}
                </p>
                <div
                  className="rounded-xl border p-4 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5', color: '#374151' }}
                >
                  {ch.content}
                </div>
              </div>
            ))}

            <button
              onClick={() => navigate('/book-studio')}
              className="w-full py-3 rounded-lg text-white font-semibold text-base"
              style={{ backgroundColor: '#10b981' }}
            >
              저장 완료 — 책 스튜디오로 이동
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
