import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Expand, FileWarning, Search, ShieldAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';

export const E_LITIGATION_BEGINNER_GUIDE_STORAGE_KEY =
  'haru_e_litigation_beginner_guide_completed';

export function getELitigationBeginnerGuideStorageKey(uid: string) {
  return `${E_LITIGATION_BEGINNER_GUIDE_STORAGE_KEY}:${uid}`;
}

type GuideTableRow = {
  label: string;
  description: string;
};

type GuideStep = {
  id: string;
  title: string;
  description: string;
  caution?: string;
  table?: GuideTableRow[];
  highlight?: {
    label: string;
    left: string;
    top: string;
    width: string;
    height: string;
  };
};

type BeginnerTerm = {
  label: string;
  description: string;
};

const BEGINNER_TERMS: BeginnerTerm[] = [
  {
    label: '답변서',
    description:
      '답변서는 상대방의 청구에 대해 인정하는지, 다투는지, 그 이유가 무엇인지 적어 법원에 제출하는 서류입니다. 제출 여부와 기한은 받은 법원 문서를 확인하세요.',
  },
  {
    label: '준비서면',
    description: '준비서면은 재판 전에 자신의 주장과 사실관계, 증거 내용을 정리해 법원에 제출하는 서류입니다.',
  },
  {
    label: '보정명령',
    description:
      '보정명령은 법원이 서류나 절차에서 부족한 부분을 보완하라고 알려주는 문서입니다. 무엇을 언제까지 보정해야 하는지 문서 내용을 확인하세요.',
  },
  {
    label: '송달문서',
    description:
      '송달문서는 법원이 사건 진행, 명령, 기일 등을 공식적으로 알려주는 문서입니다. 받은 문서에 대응이 필요한지 반드시 확인하세요.',
  },
];

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'search',
    title: '① 필요한 메뉴나 서류를 검색하는 곳입니다',
    description:
      '법을 잘 몰라도 괜찮습니다.\n통합검색은 필요한 메뉴나 서류를 검색하는 곳입니다.\n아래 예시를 눌러 각 서류가 무엇인지 먼저 확인해 보세요.',
    caution:
      '통합검색은 홈페이지의 메뉴와 안내자료를 찾는 기능입니다. 내 사건 진행 상황이나 받은 문서를 확인하는 곳은 아닙니다.',
    highlight: {
      label: '통합검색 제목 · 검색창 · 검색 버튼',
      left: '38%',
      top: '21%',
      width: '24%',
      height: '10%',
    },
  },
  {
    id: 'categories',
    title: '② 검색결과를 종류별로 나누어 볼 수 있습니다',
    description: '검색결과는 필요한 정보의 종류에 따라 나누어 확인할 수 있습니다.',
    table: [
      { label: '전체', description: '모든 검색결과를 함께 봅니다.' },
      { label: '서류명', description: '제출할 서류 이름을 찾습니다.' },
      { label: '카테고리', description: '관련 업무가 어느 메뉴에 있는지 확인합니다.' },
      { label: '양식', description: '작성할 서식이나 양식을 찾습니다.' },
      { label: '절차안내', description: '사건이 어떤 순서로 진행되는지 알아봅니다.' },
      {
        label: '기타',
        description: '공지사항, 상담사례, 자주 묻는 질문, 사용자매뉴얼 등을 봅니다.',
      },
    ],
    highlight: {
      label: '검색결과 분류 탭',
      left: '25.5%',
      top: '33%',
      width: '48.5%',
      height: '4.8%',
    },
  },
  {
    id: 'main-menu',
    title: '③ 실제 업무는 위쪽 주요 메뉴에서 시작합니다',
    description: '검색으로 위치를 찾은 뒤, 실제 업무는 상단 주요 메뉴에서 시작하는 경우가 많습니다.',
    table: [
      { label: '나의전자소송', description: '내 사건, 받은 문서, 제출 내역을 확인하는 곳' },
      { label: '서류제출', description: '소장, 답변서, 준비서면 등을 제출하는 곳' },
      { label: '각종신청', description: '사건 진행에 필요한 신청을 하는 곳' },
      { label: '사건유형별 절차안내', description: '사건 종류별 진행 순서를 알아보는 곳' },
      { label: '고객센터', description: '이용방법, 오류 해결, 사용자매뉴얼 등을 확인하는 곳' },
    ],
    highlight: {
      label: '상단 주요 메뉴',
      left: '38%',
      top: '9%',
      width: '28%',
      height: '4.8%',
    },
  },
  {
    id: 'login-menu',
    title: '④ 내 사건을 확인하려면 로그인이 필요합니다',
    description:
      '내가 진행 중인 사건, 법원에서 받은 문서와 제출 내역을 확인하려면 전자소송포털에 로그인해야 합니다.\n\n오른쪽 돋보기는 통합검색이며, 세 줄 모양 버튼은 전체 메뉴를 여는 버튼입니다.',
    caution:
      'HARU 안내 화면에서는 실제 로그인, 인증서 확인, 전자소송포털 접속을 수행하지 않습니다.',
    highlight: {
      label: '사용자등록 · 로그인 · 돋보기 · 전체 메뉴',
      left: '55%',
      top: '6%',
      width: '19%',
      height: '8%',
    },
  },
  {
    id: 'start',
    title: '이제 필요한 연습을 시작해 보겠습니다',
    description: '지금 어떤 일을 하려고 하시나요?',
  },
];

const START_OPTIONS = [
  '법원에서 문서를 받았어요',
  '새로운 소송을 시작하려고 해요',
  '답변서나 준비서면을 제출하려고 해요',
  '내 사건 진행 상황을 확인하고 싶어요',
  '아직 무엇을 해야 할지 모르겠어요',
];

const GUIDE_IMAGE_SRC = '/legal-assistant/e-litigation-integrated-search.png';

export default function ELitigationBeginnerGuidePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [hasStarted, setHasStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [pendingOption, setPendingOption] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [activeTerm, setActiveTerm] = useState<BeginnerTerm | null>(null);

  const currentStep = GUIDE_STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === GUIDE_STEPS.length - 1;

  const stepProgress = useMemo(() => `${stepIndex + 1} / ${GUIDE_STEPS.length}`, [stepIndex]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (hasStarted) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [hasStarted, stepIndex]);

  useEffect(() => {
    if (!isImageModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImageModalOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isImageModalOpen]);

  useEffect(() => {
    if (!activeTerm) return;
    const timer = window.setTimeout(() => setActiveTerm(null), 7000);
    return () => window.clearTimeout(timer);
  }, [activeTerm]);

  const markBeginnerGuideCompleted = () => {
    if (!user?.uid) return;
    localStorage.setItem(getELitigationBeginnerGuideStorageKey(user.uid), 'true');
  };

  const goHomeAfterCompletion = () => {
    markBeginnerGuideCompleted();
    navigate('/legal-assistant', { replace: true });
  };

  const goDocumentHelper = () => {
    markBeginnerGuideCompleted();
    navigate('/legal-assistant/document-helper');
  };

  const moveNext = () => {
    if (isLastStep) return;
    setStepIndex((prev) => prev + 1);
    setPendingOption(null);
    setActiveTerm(null);
  };

  const movePrevious = () => {
    if (isFirstStep) {
      setHasStarted(false);
      setPendingOption(null);
      setActiveTerm(null);
      return;
    }
    setStepIndex((prev) => prev - 1);
    setPendingOption(null);
    setActiveTerm(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FEFBE8] px-4 py-5 text-gray-900">
        <div className="mx-auto flex max-w-3xl items-center justify-center py-20 text-sm text-gray-500">
          전자소송포털 처음 안내를 준비하는 중입니다.
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#FEFBE8] px-4 py-5 text-gray-900">
      <div className="mx-auto w-full max-w-7xl space-y-4 pb-28">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/legal-assistant')} className="px-2">
            <ArrowLeft className="size-4" />
            비서 홈
          </Button>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-lg font-semibold">전자소송포털 처음 안내</h1>
            <p className="truncate text-xs text-gray-500">화면 구조 · 메뉴 이해 · 연습 연결</p>
          </div>
          <span />
        </header>

        {!hasStarted ? (
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <Search className="size-6" />
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
                전자소송포털 화면부터 천천히 알아보겠습니다
              </h2>
              <p className="mt-4 whitespace-pre-line text-base leading-7 text-gray-700">
                전자소송포털에는 여러 메뉴와 서류가 있어 처음 이용하면
                {'\n'}어디서 시작해야 할지 어려울 수 있습니다.
                {'\n\n'}먼저 실제 전자소송포털 화면에서 검색창과 주요 메뉴의 역할을
                {'\n'}알아본 뒤 필요한 연습을 시작하겠습니다.
              </p>
              <p className="mt-5 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                이 안내는 실제 전자소송포털의 이용 구조를 쉽게 설명하기 위한 연습용 안내입니다.
                전자소송포털의 화면과 메뉴는 변경될 수 있습니다.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button className="min-h-12 bg-blue-700 text-white hover:bg-blue-800" onClick={() => setHasStarted(true)}>
                  화면 설명 시작하기
                  <ChevronRight className="size-4" />
                </Button>
                <Button variant="outline" className="min-h-12" onClick={goHomeAfterCompletion}>
                  설명을 건너뛰고 연습 시작하기
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                {stepProgress}
              </span>
              <span className="text-xs leading-5 text-gray-500">
                실제 대한민국 법원 전자소송포털 화면 예시
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
              <div>
                <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {!imageLoadFailed ? (
                    <img
                      src={GUIDE_IMAGE_SRC}
                      alt="대한민국 법원 전자소송포털 통합검색 화면 예시"
                      className="w-full"
                      onError={() => setImageLoadFailed(true)}
                    />
                  ) : (
                    <div className="flex min-h-[280px] flex-col items-center justify-center px-5 py-10 text-center sm:min-h-[380px]">
                      <FileWarning className="mb-3 size-10 text-gray-400" />
                      <p className="text-base font-semibold text-gray-800">통합검색 화면 이미지를 불러오지 못했습니다.</p>
                      <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
                        이미지 파일이 지정 위치에 있는지 확인해 주세요.
                        <br />
                        {GUIDE_IMAGE_SRC}
                      </p>
                    </div>
                  )}
                  {!imageLoadFailed && currentStep.highlight && (
                    <div
                      aria-label="강조 영역"
                      className="absolute rounded-md border-2 border-blue-600 bg-blue-500/15 shadow-[0_0_0_999px_rgba(15,23,42,0.18)]"
                      style={{
                        left: currentStep.highlight.left,
                        top: currentStep.highlight.top,
                        width: currentStep.highlight.width,
                        height: currentStep.highlight.height,
                      }}
                    >
                      <span className="absolute -top-8 left-0 hidden rounded bg-blue-700 px-2 py-1 text-xs font-semibold text-white sm:block">
                        {currentStep.highlight.label}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-gray-500">
                    전자소송포털 개편에 따라 실제 화면과 메뉴 위치는 달라질 수 있습니다.
                  </p>
                  {!imageLoadFailed && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10"
                      onClick={() => setIsImageModalOpen(true)}
                    >
                      <Expand className="size-4" />
                      화면 크게 보기
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <h2 className="text-xl font-bold leading-8 text-gray-950">{currentStep.title}</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-700">
                  {currentStep.description}
                </p>
                {currentStep.id === 'search' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {BEGINNER_TERMS.map((term) => (
                      <button
                        key={term.label}
                        type="button"
                        onClick={() => setActiveTerm(term)}
                        className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 transition hover:border-blue-400 hover:bg-blue-50"
                      >
                        {term.label}
                      </button>
                    ))}
                  </div>
                )}
                {currentStep.highlight && imageLoadFailed && (
                  <p className="mt-3 rounded-md border border-blue-100 bg-white px-3 py-2 text-xs font-semibold leading-5 text-blue-800">
                    이미지가 로딩되면 강조 영역: {currentStep.highlight.label}
                  </p>
                )}
                {currentStep.caution && (
                  <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-3 py-3 text-xs font-semibold leading-5 text-red-900">
                    {currentStep.caution}
                  </p>
                )}
                {currentStep.table && (
                  <div className="mt-4 space-y-2">
                    {currentStep.table.map((row) => (
                      <div key={row.label} className="rounded-md border border-gray-200 bg-white p-3 sm:grid sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
                        <p className="text-sm font-bold text-blue-800">{row.label}</p>
                        <p className="mt-1 text-sm leading-6 text-gray-700 sm:mt-0">{row.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {isLastStep && (
                  <div className="mt-5 space-y-2">
                    {START_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          if (option === '법원에서 문서를 받았어요') {
                            goDocumentHelper();
                            return;
                          }
                          setPendingOption(option);
                        }}
                        className="flex min-h-12 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm font-semibold text-gray-900"
                      >
                        {option}
                        <ChevronRight className="size-4 text-gray-400" />
                      </button>
                    ))}

                    {pendingOption && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-bold text-amber-950">이 연습 기능은 현재 준비 중입니다.</p>
                        <p className="mt-2 text-sm leading-6 text-amber-900">
                          먼저 전자소송포털의 절차안내를 확인하거나, 현재 제공되는 ‘법원에서 문서를 받았어요’
                          연습을 이용할 수 있습니다.
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <Button type="button" onClick={goDocumentHelper}>
                            법원 문서 확인 연습하기
                          </Button>
                          <Button type="button" variant="outline" onClick={goHomeAfterCompletion}>
                            전자소송연습비서 홈으로
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" className="min-h-11" onClick={movePrevious}>
                <ChevronLeft className="size-4" />
                이전
              </Button>
              {isLastStep ? (
                <Button type="button" variant="outline" className="min-h-11" onClick={goHomeAfterCompletion}>
                  전자소송연습비서 홈으로
                </Button>
              ) : (
                <Button type="button" className="min-h-11 bg-blue-700 text-white hover:bg-blue-800" onClick={moveNext}>
                  다음
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </section>
        )}

        {isImageModalOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/72 px-4 py-5"
            role="dialog"
            aria-modal="true"
            aria-label="전자소송포털 화면 크게 보기"
            onClick={() => setIsImageModalOpen(false)}
          >
            <div
              className="mx-auto max-w-6xl rounded-lg bg-white p-3 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    실제 대한민국 법원 전자소송포털 화면 예시
                  </p>
                  <p className="text-xs leading-5 text-gray-500">
                    전자소송포털 개편에 따라 실제 화면과 메뉴 위치는 달라질 수 있습니다.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setIsImageModalOpen(false)}
                >
                  <X className="size-4" />
                  닫기
                </Button>
              </div>
              <div className="max-h-[78vh] overflow-auto rounded-md border border-gray-200 bg-gray-50">
                <img
                  src={GUIDE_IMAGE_SRC}
                  alt="대한민국 법원 전자소송포털 통합검색 화면 예시 크게 보기"
                  className="min-w-[760px] max-w-none"
                />
              </div>
            </div>
          </div>
        )}

        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">
                전자소송연습비서는 전자소송 이용 과정을 익히기 위한 연습용 서비스입니다.
              </p>
              <p className="mt-2">
                여기에서 작성한 내용은 법원에 실제로 제출되지 않습니다. 실제 제출 여부, 제출기한과
                사건 진행 상황은 법원에서 받은 문서와 대한민국 법원 전자소송포털에서 직접 확인해야 합니다.
              </p>
            </div>
          </div>
        </section>
      </div>
      {activeTerm && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-[96px] z-40 mx-auto max-w-[560px] rounded-lg border border-blue-200 bg-white p-4 text-sm leading-6 text-gray-800 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-blue-900">{activeTerm.label}</p>
              <p className="mt-1">{activeTerm.description}</p>
              <p className="mt-3 font-semibold text-red-900">
                정확한 제출 여부와 기한은 실제 법원 문서를 기준으로 확인하세요.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2"
              onClick={() => setActiveTerm(null)}
            >
              <X className="size-4" />
              <span className="sr-only">도움말 닫기</span>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
