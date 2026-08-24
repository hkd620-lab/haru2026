import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const { user, sendVerificationEmail, refreshCurrentUser, signOut } = useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notYetVerified, setNotYetVerified] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await sendVerificationEmail();
      toast.success('인증메일을 다시 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.');
    } catch (error: any) {
      toast.error(error?.message || '인증메일 재발송에 실패했습니다.');
    } finally {
      setResending(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    setNotYetVerified(false);
    try {
      await refreshCurrentUser();
      setNotYetVerified(true);
    } catch (error: any) {
      toast.error(error?.message || '인증 상태 확인에 실패했습니다.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error: any) {
      toast.error(error?.message || '로그아웃에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#EDE9F5' }}>
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
        <MailCheck className="w-12 h-12 mx-auto mb-4" style={{ color: '#1A3C6E' }} />
        <h1 className="text-xl font-bold mb-2" style={{ color: '#1A3C6E' }}>
          이메일 인증이 필요합니다
        </h1>
        <p className="text-sm mb-1" style={{ color: '#666' }}>
          아래 이메일로 인증메일을 보냈습니다.
        </p>
        <p className="text-sm font-bold mb-6" style={{ color: '#333' }}>
          {user?.email || '가입한 이메일'}
        </p>
        <p className="text-xs mb-6 leading-5" style={{ color: '#999' }}>
          메일함(스팸함 포함)에서 인증 링크를 클릭한 뒤, 아래 "인증 완료 확인" 버튼을 눌러주세요.
        </p>

        {notYetVerified && (
          <p className="mb-4 text-xs font-bold" style={{ color: '#DC2626' }}>
            아직 이메일 인증이 확인되지 않았습니다.
          </p>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="w-full px-4 py-3 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#1A3C6E', color: '#fff', fontWeight: 700 }}
          >
            {checking ? '확인 중...' : '인증 완료 확인'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full px-4 py-3 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#F3F4F6', color: '#1A3C6E', fontWeight: 700 }}
          >
            {resending ? '발송 중...' : '인증메일 재발송'}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-4 py-2 text-sm"
            style={{ color: '#999' }}
          >
            로그아웃 · 다른 계정으로 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
