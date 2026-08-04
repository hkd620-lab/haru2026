import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, UserRound } from 'lucide-react';
import { EcourtPracticeShell } from '../components/ecourt-practice/EcourtPracticeShell';

type LoginTab = 'certificate' | 'password';

export function EcourtPracticeLoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LoginTab>('certificate');
  const [practiceId, setPracticeId] = useState('');
  const [practicePassword, setPracticePassword] = useState('');
  const [savePracticeId, setSavePracticeId] = useState(false);
  const [notice, setNotice] = useState('');

  const handleCertificatePractice = () => {
    setNotice('연습용 인증서 확인을 완료했습니다.\n실제 전자소송에서는 등록된 인증서가 필요합니다.');
  };

  const handlePasswordLogin = () => {
    if (!practiceId.trim() || !practicePassword.trim()) {
      setNotice('연습용 아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    setNotice('연습 로그인이 완료되었습니다.\n실제 로그인이나 본인인증은 수행되지 않았습니다.');
  };

  const loginCompleted = notice.startsWith('연습 로그인') || notice.startsWith('연습용 인증서 확인');

  return (
    <EcourtPracticeShell>
      <div className="mx-auto max-w-[900px]">
        <div className="mb-8 text-center">
          <p className="text-sm font-extrabold text-[#58708f]">실제 인증 없는 화면 연습</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#162f55] sm:text-4xl">통합로그인 연습</h1>
        </div>

        <div className="border border-[#d7dde5]">
          <div className="grid grid-cols-2">
            {[
              ['certificate', '인증서', KeyRound],
              ['password', '아이디/비밀번호', UserRound],
            ].map(([tab, label, Icon]) => {
              const active = activeTab === tab;
              const TabIcon = Icon as typeof KeyRound;
              return (
                <button
                  key={tab as string}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab as LoginTab);
                    setNotice('');
                  }}
                  className={`inline-flex min-h-14 items-center justify-center gap-2 border-b text-sm font-extrabold ${
                    active
                      ? 'border-[#183c73] bg-[#183c73] text-white'
                      : 'border-[#d7dde5] bg-[#f7f9fc] text-[#183c73]'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="p-5 sm:p-7">
            {activeTab === 'certificate' ? (
              <div className="rounded border border-[#d7dde5] bg-white p-5">
                <h2 className="text-xl font-extrabold text-[#162f55]">인증서 로그인 연습</h2>
                <p className="mt-3 text-sm font-bold leading-6 text-[#64748b]">
                  실제 인증서를 불러오거나 확인하지 않습니다.
                </p>
                <button
                  type="button"
                  onClick={handleCertificatePractice}
                  className="mt-6 min-h-12 w-full rounded bg-[#183c73] px-5 text-sm font-extrabold text-white sm:w-auto"
                >
                  인증서 로그인 과정 연습
                </button>
              </div>
            ) : (
              <div className="rounded border border-[#d7dde5] bg-white p-5">
                <h2 className="text-xl font-extrabold text-[#162f55]">아이디/비밀번호 로그인 연습</h2>
                <p className="mt-4 rounded border border-[#f5b5b5] bg-[#fff6f6] px-4 py-3 text-sm font-extrabold leading-6 text-[#9f1f1f]">
                  실제 전자소송포털 아이디와 비밀번호를 입력하지 마세요.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-extrabold text-[#334155]">연습용 아이디</span>
                    <input
                      value={practiceId}
                      onChange={(event) => setPracticeId(event.target.value)}
                      className="mt-2 min-h-12 w-full rounded border border-[#cbd5e1] px-3 outline-none focus:border-[#183c73]"
                      autoComplete="off"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-extrabold text-[#334155]">연습용 비밀번호</span>
                    <input
                      value={practicePassword}
                      onChange={(event) => setPracticePassword(event.target.value)}
                      className="mt-2 min-h-12 w-full rounded border border-[#cbd5e1] px-3 outline-none focus:border-[#183c73]"
                      type="password"
                      autoComplete="off"
                    />
                  </label>
                </div>
                <label className="mt-5 flex items-center gap-3 text-sm font-bold text-[#475569]">
                  <input
                    type="checkbox"
                    checked={savePracticeId}
                    onChange={(event) => setSavePracticeId(event.target.checked)}
                    className="h-5 w-5 accent-[#183c73]"
                  />
                  연습용 아이디 저장
                </label>
                <p className="mt-2 text-xs leading-5 text-[#64748b]">
                  체크 상태만 화면 안에서 유지하며 실제 저장하지 않습니다.
                </p>
                <button
                  type="button"
                  onClick={handlePasswordLogin}
                  className="mt-6 min-h-12 w-full rounded bg-[#183c73] px-5 text-sm font-extrabold text-white sm:w-auto"
                >
                  연습 로그인
                </button>
              </div>
            )}

            {notice && (
              <div className="mt-5 rounded border border-[#bfd1e8] bg-[#f5f9ff] px-4 py-4 text-sm font-bold leading-7 text-[#183c73]">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="whitespace-pre-line">{notice}</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => navigate('/lawsuit-practice/portal/register')}
                className="min-h-11 rounded border border-[#183c73] bg-white px-5 text-sm font-extrabold text-[#183c73]"
              >
                사용자등록 연습
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate('/lawsuit-practice/practice', {
                    state: { practicePortalLoginCompleted: true },
                  })
                }
                disabled={!loginCompleted}
                className="min-h-11 rounded bg-[#183c73] px-5 text-sm font-extrabold text-white disabled:bg-[#94a3b8]"
              >
                전자소송 작성 연습 계속하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </EcourtPracticeShell>
  );
}
