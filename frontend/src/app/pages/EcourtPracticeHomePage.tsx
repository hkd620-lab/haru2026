import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardCheck,
  CreditCard,
  FileSearch,
  FileText,
  HelpCircle,
  LogIn,
  RefreshCcw,
  Search,
  Send,
} from 'lucide-react';
import { LegalTermHelp } from '../components/LegalTermHelp';

const PORTAL_MENU_ITEMS = [
  {
    title: '로그인',
    description: '공동인증서 또는 간편인증으로 들어가는 흐름을 연습합니다.',
    icon: LogIn,
    actionLabel: '로그인 연습',
    path: '/lawsuit-practice/portal/login',
    primary: true,
  },
  {
    title: '서류제출',
    description: '소장 등 제출 서류를 선택하고 작성 단계로 들어가는 메뉴입니다.',
    icon: Send,
    actionLabel: '서류제출 연습',
    path: '/lawsuit-practice/practice',
    state: { practicePortalLoginCompleted: true },
  },
  {
    title: '나의 사건',
    description: '진행 중인 사건, 제출내역, 사건번호를 확인하는 곳입니다.',
    icon: ClipboardCheck,
    actionLabel: '구조 보기',
    path: '/legal-cases',
  },
  {
    title: '송달문서 확인',
    description: '전자송달 문서와 보정 요청을 확인하는 습관을 연습합니다.',
    icon: FileSearch,
    actionLabel: '체크리스트 보기',
    path: '/legal-cases',
  },
  {
    title: '사건검색 또는 통합검색',
    description: '서류명, 양식, 절차안내를 찾아보는 화면 구조를 익힙니다.',
    icon: Search,
    actionLabel: '검색 연습',
    path: '/lawsuit-practice/portal/search',
  },
  {
    title: '납부·환급',
    description: '인지대, 송달료 납부 상태를 확인하는 메뉴 위치를 익힙니다.',
    icon: CreditCard,
    actionLabel: '납부 위치 확인',
    path: '/lawsuit-practice/portal/search',
  },
  {
    title: '처음 이용하는 분',
    description: '전자소송포털을 처음 볼 때 메뉴와 검색창부터 차근차근 확인합니다.',
    icon: HelpCircle,
    actionLabel: '처음 안내',
    path: '/legal-assistant/beginner-guide',
  },
  {
    title: '나홀로 금전청구 연습 시작',
    description: '로그인 연습을 마친 것으로 보고 기존 11단계 작성 연습으로 이동합니다.',
    icon: FileText,
    actionLabel: '11단계 시작',
    path: '/lawsuit-practice/practice',
    state: { practicePortalLoginCompleted: true },
    highlight: true,
  },
] as const;

export function EcourtPracticeHomePage() {
  const navigate = useNavigate();

  const resetPortalPractice = () => {
    navigate('/lawsuit-practice', { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#eef2f7] px-4 py-4 text-[#1f2937] sm:px-6">
      <div className="mx-auto max-w-[1160px] pb-36">
        <div className="sticky top-0 z-20 -mx-4 mb-4 bg-[#9f1f1f] px-4 py-2 text-center text-xs font-extrabold text-white shadow-sm sm:-mx-6">
          연습용 모의 화면입니다. 실제 법원에 제출되지 않습니다.
        </div>

        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate('/v2')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[#cbd5e1] bg-white px-4 text-sm font-extrabold text-[#183c73]"
          >
            <ArrowLeft className="h-4 w-4" />
            HARU 홈으로 이동
          </button>
          <button
            type="button"
            onClick={resetPortalPractice}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[#cbd5e1] bg-white px-4 text-sm font-extrabold text-[#475569]"
          >
            <RefreshCcw className="h-4 w-4" />
            초기화
          </button>
        </header>

        <section className="border border-[#cbd5e1] bg-white">
          <div className="border-b border-[#cbd5e1] bg-[#183c73] px-5 py-5 text-white sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-extrabold tracking-[0.16em] text-[#bfd7ef]">
                  HARU PRACTICE PORTAL
                </p>
                <h1 className="mt-2 text-2xl font-extrabold sm:text-4xl">전자소송포털 연습화면</h1>
                <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-[#e8f2fb]">
                  실제 전자소송포털로 오인하지 않도록 만든 모의 화면입니다. 메뉴 위치와 이용
                  순서를 익히고, 단순{' '}
                  <LegalTermHelp
                    term="금전청구"
                    className="inline align-baseline font-semibold text-white underline decoration-dotted underline-offset-4"
                  />{' '}
                  연습으로 이어집니다.
                </p>
              </div>
              <div className="rounded border border-white/30 bg-white/12 px-4 py-3 text-sm font-extrabold">
                연습용 모의 화면입니다. 실제 법원에 제출되지 않습니다.
              </div>
            </div>
          </div>

          <nav className="grid border-b border-[#cbd5e1] bg-[#f7f9fc] text-sm font-extrabold text-[#183c73] sm:grid-cols-3 lg:grid-cols-6">
            {['로그인', '서류제출', '나의 사건', '송달문서 확인', '통합검색', '납부·환급'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  const target = PORTAL_MENU_ITEMS.find((menu) => menu.title === item || menu.title.includes(item));
                  if (target) navigate(target.path, target.state ? { state: target.state } : undefined);
                }}
                className="min-h-12 border-b border-r border-[#d7dde5] px-3 py-3 text-left last:border-r-0 sm:text-center"
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-5 sm:p-7">
              <section className="mb-5 border border-[#bfd1e8] bg-[#f5f9ff] px-4 py-4">
                <p className="text-sm font-extrabold text-[#183c73]">상단 연습용 안내 띠</p>
                <p className="mt-2 text-sm font-bold leading-6 text-[#475569]">
                  이 포털은 절차 확인, 서류 누락 방지, 송달 확인, 보정 대응, 기한 확인을
                  연습하는 화면입니다. 법률 판단이나 승소 가능성 판단은 제공하지 않습니다.
                </p>
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                {PORTAL_MENU_ITEMS.map(({ title, description, icon: Icon, actionLabel, path, state, primary, highlight }) => (
                  <article
                    key={title}
                    className={`min-h-[178px] border p-4 ${
                      highlight
                        ? 'border-[#183c73] bg-[#f5f9ff]'
                        : primary
                          ? 'border-[#bfd1e8] bg-white'
                          : 'border-[#d7dde5] bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded ${
                          highlight ? 'bg-[#183c73] text-white' : 'bg-[#eef4fb] text-[#183c73]'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-extrabold text-[#162f55]">{title}</h2>
                        <p className="mt-2 text-sm font-bold leading-6 text-[#64748b]">{description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(path, state ? { state } : undefined)}
                      className={`mt-4 min-h-11 w-full rounded px-4 text-sm font-extrabold ${
                        highlight || primary
                          ? 'bg-[#183c73] text-white'
                          : 'border border-[#183c73] bg-white text-[#183c73]'
                      }`}
                    >
                      {actionLabel}
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <aside className="border-t border-[#cbd5e1] bg-[#f8fafc] p-5 lg:border-l lg:border-t-0">
              <h2 className="text-base font-extrabold text-[#162f55]">권장 연습 흐름</h2>
              <ol className="mt-4 space-y-3">
                {[
                  '로그인',
                  '공동인증서 또는 간편인증 연습',
                  '서류제출',
                  '나홀로 금전청구 연습',
                  '기존 11단계 진행',
                ].map((item, index) => (
                  <li key={item} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 text-sm font-bold leading-6 text-[#475569]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#183c73] text-xs text-white">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 rounded border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-xs font-bold leading-5 text-[#9a3412]">
                법률용어에 점선 밑줄이 보이면 눌러서 쉬운 설명을 확인할 수 있습니다.
                예:{' '}
                <LegalTermHelp
                  term="전자송달"
                  className="inline align-baseline font-extrabold text-[#9a3412] underline decoration-dotted underline-offset-4"
                />
                ,{' '}
                <LegalTermHelp
                  term="보정"
                  className="inline align-baseline font-extrabold text-[#9a3412] underline decoration-dotted underline-offset-4"
                />
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

export default EcourtPracticeHomePage;
