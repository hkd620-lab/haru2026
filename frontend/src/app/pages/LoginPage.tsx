import { useState } from 'react';
import { useNavigate } from 'react-router';
import { loginWithGoogle } from '../../firebase';

export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      if (user) navigate('/', { replace: true });
    } catch (err) {
      alert('구글 로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = () => {
    alert("카카오 로그인 기능을 시스템에 연결 중입니다. 당분간 Google 계정을 이용해 주세요!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAF9F6' }}>
      <div className="w-full max-w-md text-center">
        <h1 className="text-5xl mb-10 tracking-[0.3em] font-light" style={{ color: '#1A3C6E' }}>HARU</h1>
        
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 space-y-4">
          <h2 className="text-xl font-medium mb-6" style={{ color: '#333' }}>로그인</h2>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
            style={{ borderColor: '#E5E7EB', color: '#333', backgroundColor: '#fff' }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="google" />
            Google 계정으로 계속하기
          </button>

          <button
            onClick={handleKakaoLogin}
            className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all"
            style={{ backgroundColor: '#FEE500', color: '#3C1E1E' }}
          >
            <span className="text-lg">💬</span>
            카카오 계정으로 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
