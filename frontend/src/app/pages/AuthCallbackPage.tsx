import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { toast } from 'sonner';
import { normalizeLoginProvider } from '../utils/loginProvider';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // URL에서 customToken 파라미터 가져오기
        const params = new URLSearchParams(window.location.search);
        const customToken = params.get('customToken');
        const provider = normalizeLoginProvider(params.get('provider'));
        const error = params.get('error');

        if (error) {
          console.error('로그인 오류:', error);
          toast.error('로그인에 실패했습니다.');
          navigate('/login');
          return;
        }

        if (!customToken) {
          console.error('customToken이 없습니다');
          toast.error('인증 정보가 없습니다.');
          navigate('/login');
          return;
        }

        // Firebase 커스텀 토큰으로 로그인
        const userCredential = await signInWithCustomToken(auth, customToken);
        if (provider) {
          try {
            await setDoc(
              doc(db, 'users', userCredential.user.uid),
              {
                loginProvider: provider,
                loginProviderUpdatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          } catch (providerSaveError) {
            console.error('로그인 제공자 저장 실패:', providerSaveError);
          }
        }
        
        toast.success('로그인 성공!');
        navigate('/');
      } catch (error) {
        console.error('Firebase 로그인 실패:', error);
        toast.error('로그인 처리 중 오류가 발생했습니다.');
        navigate('/login');
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE9F5' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#1A3C6E' }}></div>
        <p className="text-lg" style={{ color: '#1A3C6E' }}>로그인 중...</p>
      </div>
    </div>
  );
}
