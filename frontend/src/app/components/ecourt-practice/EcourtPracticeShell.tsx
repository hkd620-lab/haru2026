import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

type EcourtPracticeShellProps = {
  children: ReactNode;
};

const PORTAL_NAV_ITEMS = ['나의전자소송', '서류제출', '각종신청', '사건유형별 절차안내', '고객센터'];

export function EcourtPracticeShell({ children }: EcourtPracticeShellProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-white px-4 py-4 text-[#1f2937] sm:px-6">
      <div className="mx-auto max-w-[1160px] pb-32">
        <div className="mb-4 rounded-lg border border-[#f5b5b5] bg-[#fff6f6] px-4 py-3 text-[#9f1f1f]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold">HARU 전자소송 연습모드</p>
                <p className="mt-1 text-sm font-bold">실제 전자소송포털이 아닙니다.</p>
                <p className="mt-2 text-xs leading-5">
                  실제 아이디, 비밀번호, 인증서 정보를 입력하지 마세요.
                  <br />
                  이 화면은 전자소송 절차를 익히기 위한 연습 화면입니다.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/lawsuit-practice')}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded border border-[#e5b1b1] bg-white px-3 text-xs font-extrabold text-[#9f1f1f] sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              연습포털 홈
            </button>
          </div>
        </div>

        <header className="border border-[#d7dde5] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#d7dde5] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <Link
              to="/lawsuit-practice"
              className="text-xl font-extrabold text-[#123a6b] sm:text-2xl"
            >
              전자소송 연습포털
            </Link>
            <div className="flex flex-wrap gap-2">
              {PORTAL_NAV_ITEMS.map((item) => (
                <span
                  key={item}
                  className="rounded border border-[#d7dde5] px-3 py-2 text-xs font-bold text-[#475569]"
                >
                  {item}
                </span>
              ))}
              <button
                type="button"
                onClick={() => navigate('/lawsuit-practice/portal/login')}
                className="rounded bg-[#183c73] px-4 py-2 text-xs font-extrabold text-white"
              >
                로그인
              </button>
            </div>
          </div>
          <nav className="flex flex-wrap gap-0 border-b border-[#d7dde5] bg-[#f7f9fc]">
            {[
              ['/lawsuit-practice/portal/search', '통합검색'],
              ['/lawsuit-practice/portal/login', '통합로그인'],
              ['/lawsuit-practice/portal/register', '사용자등록'],
            ].map(([path, label]) => {
              const active = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`border-r border-[#d7dde5] px-4 py-3 text-sm font-extrabold ${
                    active ? 'bg-[#183c73] text-white' : 'text-[#183c73]'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <section className="border-x border-b border-[#d7dde5] bg-white px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </section>
      </div>
    </main>
  );
}
