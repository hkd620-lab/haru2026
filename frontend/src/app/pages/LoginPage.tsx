import { useState } from 'react';
import { useNavigate } from 'react-router';
import { loginWithGoogle } from '../../firebase';
import { Mail, Lock, Loader2 } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  // 이메일 로그인 버튼 클릭 시 작동 (임시)
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    alert("현재 이메일 로그인은 준비 중입니다. 아래의 'Google 계정으로 계속하기'를 클릭해 주세요!");
  };

  const handleResendEmail = async () => {
    alert("준비 중인 기능입니다.");
  };

  // 팩트: 구글 로그인 버튼 클릭 시 파이어베이스 통신 시작
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      if (user) {
        // 로그인 성공 시 메인 화면('/')으로 이동
        navigate('/', { replace: true });
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError('구글 로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError('');
    setSuccessMessage('');
    setNeedsVerification(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#FAF9F6' }}
    >
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <h1
            className="text-5xl mb-3 tracking-[0.3em] font-light"
            style={{ color: '#1A3C6E' }}
          >
            HARU
          </h1>
          <p className="text-sm tracking-widest uppercase" style={{ color: '#999' }}>
            Write your day, find your meaning
          </p>
        </div>

        {/* Login/Signup Form */}
        <div 
          className="bg-white rounded-2xl p-8 shadow-sm border"
          style={{ borderColor: '#e5e5e5' }}
        >
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-medium" style={{ color: '#333' }}>
                {isLoginMode ? '로그인' : '회원가입'}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#666' }}>
                {isLoginMode ? '하루의 기록을 시작해보세요' : '새로운 계정을 생성합니다'}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex flex-col items-center justify-center text-center gap-2">
                <span>{error}</span>
                {needsVerification && (
                  <button 
                    onClick={handleResendEmail}
                    className="text-xs underline font-medium hover:text-red-800"
                  >
                    인증 이메일 다시 보내기
                  </button>
                )}
              </div>
            )}

            {successMessage && (
              <div className="bg-blue-50 text-blue-600 text-sm p-3 rounded-lg flex items-center justify-center text-center">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold ml-1" style={{ color: '#666' }}>
                  이메일
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100"
                    style={{ 
                      backgroundColor: '#F9FAFB', 
                      border: '1px solid #E5E7EB',
                      color: '#333'
                    }}
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold ml-1" style={{ color: '#666' }}>
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100"
                    style={{ 
                      backgroundColor: '#F9FAFB', 
                      border: '1px solid #E5E7EB',
                      color: '#333'
                    }}
                    placeholder="••••••••"
                  />
                </div>
                {!isLoginMode && (
                  <p className="text-xs text-gray-400 ml-1">
                    6자 이상 입력해주세요
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90 disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#1A3C6E' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLoginMode ? '로그인' : '가입하기')}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 rounded-xl border font-medium text-sm transition-all hover:bg-gray-50 flex items-center justify-center gap-2"
              style={{ 
                borderColor: '#E5E7EB',
                color: '#333',
                backgroundColor: '#fff' 
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google 계정으로 계속하기
            </button>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            {isLoginMode ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
            <button 
              onClick={toggleMode}
              className="text-blue-600 hover:underline font-medium"
            >
              {isLoginMode ? '회원가입' : '로그인'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
