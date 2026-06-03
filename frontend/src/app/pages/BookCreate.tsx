import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc } from 'firebase/firestore';
import { functions } from '../../firebase';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router';

const FINAL_CHECKLIST = [
  '제목 명확',
  '핵심 메시지 분명',
  '목차 흐름 자연',
  '분량·깊이 충분',
  '중복 없음',
  '읽을 가치',
  '민감·부적절 없음',
  '발행 가능',
];

interface Source {
  sourceTitle: string;
  sourceText: string;
}

interface GenerateResult {
  success: boolean;
  bookId: string;
  chapters: Array<{ chapterId: string; content: string; sourceTitle: string }>;
  totalChapters: number;
}

export function BookCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const existingBookId = searchParams.get('bookId');
  const existingBookTitle = searchParams.get('bookTitle') || '';

  useEffect(() => {
    if (user?.email !== 'hkd620@gmail.com') {
      navigate('/');
      return;
    }
  }, [user?.email]);

  const [title, setTitle] = useState(existingBookTitle);
  const [sourceType, setSourceType] = useState<'nonfiction' | 'fiction' | 'mixed'>('nonfiction');
  const [sources, setSources] = useState<Source[]>([
    { sourceTitle: '', sourceText: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [results, setResults] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

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
    setCheckedItems([]);
    setProgressMsg('');

    try {
      // 진행 상태 메시지 시뮬레이션
      setProgressMsg('AI가 챕터를 작성하는 중...');
      const total = validSources.length;
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

      // 책 문서 생성 + 챕터 생성을 Function에서 일괄 처리 (Admin SDK 사용)
      const generateBook = httpsCallable(functions, 'generateBook');
      const response = await generateBook({
        title: title.trim(),
        sources: validSources,
        authorUid: user?.uid ?? '',
        existingBookId: existingBookId || undefined,
        sourceType,
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

  const allChecklistPassed = FINAL_CHECKLIST.every((item) => checkedItems.includes(item));

  const toggleChecklistItem = (item: string) => {
    setCheckedItems((prev) =>
      prev.includes(item) ? prev.filter((next) => next !== item) : [...prev, item],
    );
  };

  const handleFinalizeBook = async () => {
    if (!results?.bookId || !allChecklistPassed) return;

    setPublishing(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'books', results.bookId), {
        status: 'serializing',
        checklistPassed: true,
      });
      setProgressMsg('최종 생성 완료! 발행중으로 전환되었습니다.');
      navigate('/book-studio');
    } catch (err: unknown) {
      console.error('책 최종 생성 실패:', err);
      setError('최종 생성에 실패했습니다. 권한과 네트워크 상태를 확인해주세요.');
    } finally {
      setPublishing(false);
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
            {existingBookId ? '챕터 추가' : '새 책 만들기'}
          </h1>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* 소재 유형 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2" style={{ color: '#1A3C6E' }}>
            소재 유형
          </label>
          <div className="flex gap-2">
            {([
              { key: 'nonfiction', label: '논픽션' },
              { key: 'fiction', label: '허구 창작' },
              { key: 'mixed', label: '혼합' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSourceType(key)}
                className="px-4 py-2 rounded-full text-sm font-medium border transition-all"
                style={{
                  backgroundColor: sourceType === key ? '#1A3C6E' : 'transparent',
                  color: sourceType === key ? '#ffffff' : '#1A3C6E',
                  borderColor: '#1A3C6E',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

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
          <div className="flex flex-col gap-3 py-4">
            {[
              '소스 분석 중',
              '데이터 구조화',
              '인물 추출',
              '이야기 생성',
              '심리 해석',
              '최종 정리',
            ].map((stepLabel, i) => {
              const stepNum = i + 1;
              const currentStepNum = sources.filter(s => s.sourceText.trim()).length > 0
                ? Math.min(
                    Math.floor((Date.now() % 50000) / 8000) + 1,
                    6
                  )
                : 1;
              const isDone = stepNum < currentStepNum;
              const isCurrent = stepNum === currentStepNum;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: isDone ? '#10b981' : isCurrent ? '#1A3C6E' : '#e5e7eb',
                      color: isDone || isCurrent ? '#ffffff' : '#9ca3af',
                    }}
                  >
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: isCurrent ? '#1A3C6E' : isDone ? '#10b981' : '#9ca3af' }}
                  >
                    {stepLabel}
                  </span>
                  {isCurrent && (
                    <div
                      className="w-4 h-4 border-2 rounded-full animate-spin ml-auto"
                      style={{ borderColor: '#1A3C6E', borderTopColor: 'transparent' }}
                    />
                  )}
                </div>
              );
            })}
            {progressMsg && (
              <p className="text-xs text-center mt-2" style={{ color: '#6b7280' }}>
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

            <div className="rounded-xl border p-4" style={{ backgroundColor: '#ffffff', borderColor: '#c7d6ea' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#1A3C6E' }}>
                최종 생성 전 확인
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FINAL_CHECKLIST.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: checkedItems.includes(item) ? '#10b981' : '#e5e7eb',
                      backgroundColor: checkedItems.includes(item) ? '#ECFDF5' : '#ffffff',
                      color: '#1A3C6E',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checkedItems.includes(item)}
                      onChange={() => toggleChecklistItem(item)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs mt-3" style={{ color: '#6b7280' }}>
                8개 항목을 모두 확인해야 최종 생성할 수 있습니다.
              </p>
            </div>

            <button
              onClick={handleFinalizeBook}
              disabled={!allChecklistPassed || publishing}
              className="w-full py-3 rounded-lg text-white font-semibold text-base"
              style={{
                backgroundColor: allChecklistPassed && !publishing ? '#10b981' : '#9ca3af',
                cursor: allChecklistPassed && !publishing ? 'pointer' : 'not-allowed',
              }}
            >
              {publishing ? '최종 생성 중...' : '최종 생성'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
