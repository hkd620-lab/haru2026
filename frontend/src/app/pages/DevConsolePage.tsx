import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { AiLibraryPage } from './AiLibraryPage';
import {
  firestoreService,
  type LibraryBackfillPreview,
  type LibraryBackfillRunResult,
} from '../services/firestoreService';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface DevTool {
  sectionLabel?: string;
  icon: string;
  label: string;
  description: string;
  path: string;
  color: string;
  state?: { format?: string; category?: string };
}

const DEV_TOOLS: DevTool[] = [
  {
    icon: '🤖',
    label: '하루AI지식창고',
    description: 'AI 대화 저장·검색',
    path: 'ai-library',
    color: '#6366F1',
  },
  {
    sectionLabel: '책 만들기 관리',
    icon: '📝',
    label: '기록에서 책 만들기',
    description: 'bookMaterial 소재 → books 초안 생성',
    path: '/admin/record-book',
    color: '#1A3C6E',
  },
  {
    icon: '👴',
    label: '65노인 책 편집·출간',
    description: 'books/book_haru2026_ai_platform 편집·출간 관리',
    path: '/admin/elder-book',
    color: '#1A3C6E',
  },
  {
    icon: '📖',
    label: '새 책 만들기',
    description: '소스 텍스트 직접 입력 → AI 책 초안 생성 (기록 흐름과 별도)',
    path: '/book-create',
    color: '#1A3C6E',
  },
  {
    icon: '📰',
    label: 'K뉴스 발행',
    description: 'AI 자동 분석 카드뉴스 발행',
    path: '/admin/k-news-publisher',
    color: '#B85C2E',
  },
  {
    icon: '🗂️',
    label: '관리자 체크리스트',
    description: '운영 체크리스트',
    path: '/admin/checklist',
    color: '#10b981',
  },
  {
    icon: '🔎',
    label: '명작탐정비서 임시 화면',
    description: '잊힌 책·채널·영상·음악 탐정 (개발자 검토용 껍데기)',
    path: '/dev/masterpiece-detective',
    color: '#B85C2E',
  },
  {
    icon: '📄',
    label: '한글워드',
    description: 'HWP/HWPX 문서 한컴독스 이동 도구',
    path: '/dev/hangul-word',
    color: '#1A3C6E',
  },
  {
    sectionLabel: '홈에서 숨긴 기록·비서 (개발자 전용)',
    icon: '⛪',
    label: '선교보고',
    description: '길 위의 소식 — 홈 비노출, 여기서만 작성',
    path: '/record',
    state: { format: '선교보고' },
    color: '#5A4E7A',
  },
  {
    icon: '📋',
    label: '일반보고',
    description: '사실 정리 — 홈 비노출, 여기서만 작성',
    path: '/record',
    state: { format: '일반보고' },
    color: '#7A6F5A',
  },
  {
    icon: '📈',
    label: '주식거래일지 (HARU주식)',
    description: '거래와 복기 — 홈 비노출, 여기서만 작성',
    path: '/record',
    state: { format: '주식거래일지' },
    color: '#4A5A2C',
  },
  {
    icon: '📦',
    label: 'HARU 기록탐정',
    description: 'Drive 문서·이미지·PDF 정리 — 홈 비노출',
    path: '/asset-explorer',
    color: '#5A4E7A',
  },
  {
    icon: '✍️',
    label: '나도작가',
    description: 'AI 글쓰기·단편소설 — 홈 비노출',
    path: '/novel-studio',
    color: '#B85C2E',
  },
  {
    icon: '📖',
    label: '영어성경',
    description: '듣기·말하기·해석·단어·문법 — 홈 비노출',
    path: '/bible',
    color: '#B85C2E',
  },
];

export function DevConsolePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState<'tools' | 'ai-library'>('tools');
  const [backfillPreview, setBackfillPreview] = useState<LibraryBackfillPreview | null>(null);
  const [backfillResult, setBackfillResult] = useState<LibraryBackfillRunResult | null>(null);
  const [backfillLoading, setBackfillLoading] = useState<'preview' | 'run' | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const isDeveloper = user?.uid === DEVELOPER_UID;

  useEffect(() => {
    if (!user) return;
    if (!isDeveloper) navigate('/');
  }, [user, isDeveloper, navigate]);

  const handlePreviewBackfill = async () => {
    if (!user?.uid) return;

    setBackfillLoading('preview');
    setBackfillError(null);
    setBackfillResult(null);
    try {
      const preview = await firestoreService.previewLibraryBackfill(user.uid);
      setBackfillPreview(preview);
    } catch (error) {
      console.error('library 백필 미리보기 실패:', error);
      setBackfillError('미리보기에 실패했습니다. 콘솔 로그를 확인하세요.');
    } finally {
      setBackfillLoading(null);
    }
  };

  const handleRunBackfill = async () => {
    if (!user?.uid) return;
    const ok = window.confirm('과거 타임라인·식물탐정을 라이브러리에 인덱싱합니다. 실행할까요?');
    if (!ok) return;

    setBackfillLoading('run');
    setBackfillError(null);
    try {
      const result = await firestoreService.runLibraryBackfill(user.uid);
      setBackfillResult(result);
    } catch (error) {
      console.error('library 백필 실행 실패:', error);
      setBackfillError('백필 실행에 실패했습니다. 콘솔 로그를 확인하세요.');
    } finally {
      setBackfillLoading(null);
    }
  };

  if (!user || !isDeveloper) return null;

  if (activePanel === 'ai-library') {
    return (
      <div className="min-h-screen pb-20" style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}>
        <PageHeaderActions onClose={() => setActivePanel('tools')} />
        <AiLibraryPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}>
      <PageHeaderActions onClose={() => navigate('/v2')} />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <h1 className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
          🛠 개발자 콘솔
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          관리자 전용 도구 모음
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <section className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="font-bold text-lg" style={{ color: '#1A3C6E' }}>
                라이브러리 백필
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                과거 타임라인·식물탐정을 비서 통계·합본용 library 인덱스로 연결
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreviewBackfill}
                disabled={backfillLoading !== null}
                className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold disabled:opacity-50"
              >
                {backfillLoading === 'preview' ? '확인 중' : '미리보기'}
              </button>
              <button
                type="button"
                onClick={handleRunBackfill}
                disabled={backfillLoading !== null}
                className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#1A3C6E' }}
              >
                {backfillLoading === 'run' ? '실행 중' : '실행'}
              </button>
            </div>
          </div>

          {backfillError && (
            <p className="mt-4 text-sm font-medium text-red-600">
              {backfillError}
            </p>
          )}

          {backfillPreview && (
            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-700">
              <p className="font-semibold" style={{ color: '#1A3C6E' }}>
                미리보기 결과
              </p>
              <p className="mt-1">
                타임라인 {backfillPreview.timelines.length}개 / 식물탐정 {backfillPreview.plants.length}개 / 합계 {backfillPreview.total}건
              </p>
            </div>
          )}

          {backfillResult && (
            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-700">
              <p className="font-semibold" style={{ color: '#1A3C6E' }}>
                실행 결과
              </p>
              <p className="mt-1">
                타임라인 {backfillResult.timelinesWritten}건 / 식물탐정 {backfillResult.plantsWritten}건 / 실패 {backfillResult.failed.length}건
              </p>
              {backfillResult.failed.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-red-600">
                  {backfillResult.failed.slice(0, 5).map((refPath) => (
                    <li key={refPath}>{refPath}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h2 className="font-bold text-lg mb-3" style={{ color: '#1A3C6E' }}>
            📒 HARU보조장부 (사업자 전용)
          </h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/record', { state: { format: 'HARU보조장부' } })}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: '#1A3C6E' }}
            >
              보조장부 작성
            </button>
            <button
              type="button"
              onClick={() => navigate('/sayu', { state: { filterFormat: 'HARU보조장부' } })}
              className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold"
            >
              보조장부 목록
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEV_TOOLS.map((tool) => (
            <Fragment key={tool.path}>
              {tool.sectionLabel && (
                <div className="sm:col-span-2 pt-2">
                  <h2 className="font-bold text-lg" style={{ color: '#1A3C6E' }}>
                    {tool.sectionLabel}
                  </h2>
                </div>
              )}
              <button
                onClick={() => {
                  if (tool.path === 'ai-library') {
                    setActivePanel('ai-library');
                    return;
                  }
                  navigate(tool.path, tool.state ? { state: tool.state } : undefined);
                }}
                className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-3">{tool.icon}</div>
                <h3 className="font-bold text-base mb-1" style={{ color: tool.color }}>
                  {tool.label}
                </h3>
                <p className="text-sm text-gray-600">
                  {tool.description}
                </p>
              </button>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
