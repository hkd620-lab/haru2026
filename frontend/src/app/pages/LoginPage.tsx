import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Google 로그인 - Cloud Functions 사용
  const handleGoogleLogin = () => {
    window.location.href = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleLoginStart';
  };

  // 카카오 로그인
  const handleKakaoLogin = () => {
    window.location.href = 'https://kakaologinstart-6ieesxet3q-du.a.run.app';
  };

  // 네이버 로그인
  const handleNaverLogin = () => {
    window.location.href = 'https://naverloginstart-6ieesxet3q-du.a.run.app';
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF9F6' }}>
      <div className="max-w-md w-full px-6">
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

          <div className="mt-6 text-center">
            <p className="text-xs" style={{ color: '#999' }}>
              로그인하면 서비스 이용약관에 동의하게 됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
