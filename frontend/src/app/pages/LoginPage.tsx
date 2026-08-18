import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GrapeAnimation } from '../components/GrapeAnimation';
import { useAuth } from '../contexts/AuthContext';
import HaruNewsPreview from '../components/HaruNewsPreview';
import { InAppBrowserLoginGuide } from '../components/InAppBrowserLoginGuide';
import { getInAppBrowserInfo, type InAppBrowserInfo } from '../utils/inAppBrowser';
import { db } from '../config/firebase';

// 회원가입 동의 시점에 기록해두는 약관/방침 버전 — 추후 개정 시 재동의 대상을 가려낼 때 사용
const TERMS_VERSION = '2026-08-20';
const PRIVACY_VERSION = '2026-08-20';

export function LoginPage() {
  const navigate = useNavigate();
  const { googleSignIn, signIn, signUp, resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [inAppBrowserGuide, setInAppBrowserGuide] = useState<InAppBrowserInfo | null>(null);
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // 회원가입 동의 항목
  const [agreeAge14, setAgreeAge14] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeOverseas, setAgreeOverseas] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  const requiredAgreementsChecked = agreeAge14 && agreeTerms && agreePrivacy && agreeOverseas;
  const allAgreementsChecked = requiredAgreementsChecked && agreeMarketing;

  const handleToggleAgreeAll = (checked: boolean) => {
    setAgreeAge14(checked);
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeOverseas(checked);
    setAgreeMarketing(checked);
  };

  const saveSignupConsents = async (uid: string) => {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        consents: {
          age14: true,
          terms: true,
          privacy: true,
          overseasTransfer: true,
          marketing: agreeMarketing,
          agreedAt: serverTimestamp(),
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        },
      },
      { merge: true },
    );
  };

  const guardInAppBrowserLogin = () => {
    const info = getInAppBrowserInfo();
    if (info.isInAppBrowser) {
      setIsLoading(false);
      setInAppBrowserGuide(info);
      return true;
    }
    return false;
  };

  // Google 로그인 - dev: Firebase SDK popup / prod: Cloud Functions 흐름
  const handleGoogleLogin = async () => {
    if (guardInAppBrowserLogin()) return;
    setIsLoading(true);
    if (import.meta.env.DEV) {
      try {
        await googleSignIn();
        navigate('/');
      } catch (e: any) {
        console.error('[dev] Google login failed:', e);
        toast.error('Google 로그인 실패');
        setIsLoading(false);
      }
      return;
    }
    setTimeout(() => {
      window.location.href = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleLoginStart';
    }, 1500);
  };

  // 카카오 로그인
  const handleKakaoLogin = () => {
    if (guardInAppBrowserLogin()) return;
    setIsLoading(true);
    setTimeout(() => {
      window.location.href = 'https://kakaologinstart-6ieesxet3q-du.a.run.app';
    }, 1500);
  };

  // 네이버 로그인
  const handleNaverLogin = () => {
    if (guardInAppBrowserLogin()) return;
    setIsLoading(true);
    setTimeout(() => {
      window.location.href = 'https://naverloginstart-6ieesxet3q-du.a.run.app';
    }, 1500);
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      toast.error('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    if (emailMode === 'signup' && password !== passwordConfirm) {
      toast.error('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (emailMode === 'signup' && !requiredAgreementsChecked) {
      toast.error('필수 동의 항목을 모두 체크해 주세요.');
      return;
    }

    setIsLoading(true);
    try {
      if (emailMode === 'login') {
        await signIn(normalizedEmail, password);
        toast.success('로그인되었습니다.');
      } else {
        const { user: newUser } = await signUp(normalizedEmail, password);
        if (newUser?.uid) {
          await saveSignupConsents(newUser.uid);
        }
        toast.success('회원가입이 완료되었습니다.');
      }
      navigate('/');
    } catch (error: any) {
      toast.error(error?.message || '이메일 인증에 실패했습니다.');
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error('비밀번호를 재설정할 이메일을 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(normalizedEmail);
      toast.success('비밀번호 재설정 메일을 보냈습니다.');
    } catch (error: any) {
      toast.error(error?.message || '비밀번호 재설정 메일 발송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EDE9F5', overflowY: 'auto' }}>
      <InAppBrowserLoginGuide
        open={Boolean(inAppBrowserGuide)}
        browserInfo={inAppBrowserGuide}
        onClose={() => setInAppBrowserGuide(null)}
      />
      {isLoading && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ backgroundColor: 'rgba(237, 233, 245, 0.95)' }}
        >
          <div style={{ width: 300, height: 400 }}>
            <GrapeAnimation />
          </div>
          <p className="mt-4 text-sm font-medium" style={{ color: '#1A3C6E' }}>
            로그인 중...
          </p>
        </div>
      )}

      {/* 데스크톱: 최대 1140px, 2열(소개 + 로그인) / 모바일: 1열 */}
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '32px 20px 48px' }}>
        <div className="flex flex-col lg:flex-row lg:items-start gap-8">

          {/* 왼쪽: 신문기사형 서비스 소개 */}
          <div className="w-full lg:flex-1 min-w-0">
            <HaruNewsPreview />
          </div>

          {/* 오른쪽: 로그인 카드 */}
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="text-center mb-8">
              <BookOpen className="w-16 h-16 mx-auto mb-4" style={{ color: '#1A3C6E' }} />
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#1A3C6E' }}>
                HARU2026
              </h1>
              <p className="text-sm" style={{ color: '#666' }}>
                간편하게 입력하고, 쓸모있게 남깁니다
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-xl font-semibold mb-6 text-center" style={{ color: '#333' }}>
                로그인
              </h2>
              <p className="mb-5 rounded-lg px-4 py-3 text-center text-sm leading-6" style={{ backgroundColor: '#F7F4EC', color: '#1A3C6E' }}>
                HARU2026은 회원제 서비스입니다.<br />
                결제 및 구독 신청은 로그인 후 이용할 수 있습니다.
              </p>

              <div className="space-y-3">
                {/* Google 로그인 */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e5e5',
                    color: '#333',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="font-medium">Google로 계속하기</span>
                </button>

                {/* 카카오 로그인 */}
                <button
                  onClick={handleKakaoLogin}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-90"
                  style={{
                    backgroundColor: '#FEE500',
                    color: '#000000',
                    border: 'none',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#000000" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
                  </svg>
                  <span className="font-medium">카카오로 계속하기</span>
                </button>

                {/* 네이버 로그인 */}
                <button
                  onClick={handleNaverLogin}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-90"
                  style={{
                    backgroundColor: '#03C75A',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#ffffff" d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/>
                  </svg>
                  <span className="font-medium">네이버로 계속하기</span>
                </button>
              </div>

              <p className="mt-2 text-center text-xs" style={{ color: '#9CA3AF' }}>
                로그인 후 이용약관 및 개인정보 처리 동의 절차가 진행됩니다.
              </p>

              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1" style={{ backgroundColor: '#E5E7EB' }} />
                <span className="text-xs" style={{ color: '#999' }}>또는</span>
                <div className="h-px flex-1" style={{ backgroundColor: '#E5E7EB' }} />
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="flex rounded-lg p-1" style={{ backgroundColor: '#F3F4F6' }}>
                  <button
                    type="button"
                    onClick={() => setEmailMode('login')}
                    className="flex-1 rounded-md px-3 py-2 text-sm transition-all"
                    style={{
                      backgroundColor: emailMode === 'login' ? '#fff' : 'transparent',
                      color: emailMode === 'login' ? '#1A3C6E' : '#6B7280',
                      fontWeight: emailMode === 'login' ? 700 : 500,
                    }}
                  >
                    로그인
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMode('signup')}
                    className="flex-1 rounded-md px-3 py-2 text-sm transition-all"
                    style={{
                      backgroundColor: emailMode === 'signup' ? '#fff' : 'transparent',
                      color: emailMode === 'signup' ? '#1A3C6E' : '#6B7280',
                      fontWeight: emailMode === 'signup' ? 700 : 500,
                    }}
                  >
                    회원가입
                  </button>
                </div>

                <label className="block">
                  <span className="block text-xs mb-1" style={{ color: '#666', fontWeight: 700 }}>이메일</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@example.com"
                    className="w-full rounded-lg px-3 py-3 text-sm outline-none"
                    style={{ border: '1px solid #E5E7EB', color: '#333' }}
                    disabled={isLoading}
                  />
                </label>

                <label className="block">
                  <span className="block text-xs mb-1" style={{ color: '#666', fontWeight: 700 }}>비밀번호</span>
                  <input
                    type="password"
                    autoComplete={emailMode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="6자 이상"
                    className="w-full rounded-lg px-3 py-3 text-sm outline-none"
                    style={{ border: '1px solid #E5E7EB', color: '#333' }}
                    disabled={isLoading}
                  />
                </label>

                {emailMode === 'signup' && (
                  <label className="block">
                    <span className="block text-xs mb-1" style={{ color: '#666', fontWeight: 700 }}>비밀번호 확인</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordConfirm}
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      placeholder="비밀번호 다시 입력"
                      className="w-full rounded-lg px-3 py-3 text-sm outline-none"
                      style={{ border: '1px solid #E5E7EB', color: '#333' }}
                      disabled={isLoading}
                    />
                  </label>
                )}

                {emailMode === 'signup' && (
                  <div
                    className="rounded-lg p-3 space-y-2"
                    style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}
                  >
                    <label className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <input
                        type="checkbox"
                        checked={allAgreementsChecked}
                        onChange={(event) => handleToggleAgreeAll(event.target.checked)}
                        disabled={isLoading}
                      />
                      <span className="text-sm" style={{ color: '#1A3C6E', fontWeight: 700 }}>전체 동의</span>
                    </label>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={agreeAge14}
                          onChange={(event) => setAgreeAge14(event.target.checked)}
                          disabled={isLoading}
                        />
                        <span className="text-xs" style={{ color: '#374151' }}>만 14세 이상입니다 <span style={{ color: '#dc2626' }}>(필수)</span></span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={agreeTerms}
                          onChange={(event) => setAgreeTerms(event.target.checked)}
                          disabled={isLoading}
                        />
                        <span className="text-xs" style={{ color: '#374151' }}>이용약관에 동의합니다 <span style={{ color: '#dc2626' }}>(필수)</span></span>
                      </label>
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: '#1A3C6E', textDecoration: 'underline' }}>보기</a>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={agreePrivacy}
                          onChange={(event) => setAgreePrivacy(event.target.checked)}
                          disabled={isLoading}
                        />
                        <span className="text-xs" style={{ color: '#374151' }}>개인정보 수집·이용에 동의합니다 <span style={{ color: '#dc2626' }}>(필수)</span></span>
                      </label>
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: '#1A3C6E', textDecoration: 'underline' }}>보기</a>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={agreeOverseas}
                          onChange={(event) => setAgreeOverseas(event.target.checked)}
                          disabled={isLoading}
                        />
                        <span className="text-xs" style={{ color: '#374151' }}>개인정보 국외 이전에 동의합니다 <span style={{ color: '#dc2626' }}>(필수)</span></span>
                      </label>
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: '#1A3C6E', textDecoration: 'underline' }}>보기</a>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={agreeMarketing}
                          onChange={(event) => setAgreeMarketing(event.target.checked)}
                          disabled={isLoading}
                        />
                        <span className="text-xs" style={{ color: '#374151' }}>마케팅 정보 수신에 동의합니다 <span style={{ color: '#9CA3AF' }}>(선택)</span></span>
                      </label>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || (emailMode === 'signup' && !requiredAgreementsChecked)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#1A3C6E', color: '#fff', fontWeight: 700 }}
                >
                  <Mail className="w-4 h-4" />
                  {emailMode === 'login' ? '이메일로 로그인' : '이메일로 회원가입'}
                </button>

                <div className="flex items-center justify-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setEmailMode(emailMode === 'login' ? 'signup' : 'login')}
                    style={{ color: '#1A3C6E', fontWeight: 700 }}
                    disabled={isLoading}
                  >
                    {emailMode === 'login' ? '회원가입' : '로그인으로 돌아가기'}
                  </button>
                  <span style={{ color: '#D1D5DB' }}>|</span>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    style={{ color: '#1A3C6E', fontWeight: 700 }}
                    disabled={isLoading}
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-xs" style={{ color: '#999' }}>
                  로그인하면 서비스 이용약관에 동의하게 됩니다
                </p>
              </div>
            </div>
          </div>{/* /로그인 카드 */}

        </div>{/* /flex row */}
      </div>{/* /container */}
    </div>
  );
}
