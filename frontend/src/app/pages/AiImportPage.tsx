import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  AI_IMPORT_PAYLOAD_EVENT,
  AI_IMPORT_REQUEST_EVENT,
  AI_IMPORT_RESULT_EVENT,
  parseAiImportPayload,
  saveAiImportForUser,
} from '../services/aiImportService';
import { hasAiLibraryAccess } from '../utils/aiLibraryAccess';
import { rememberPostLoginReturnPath } from '../utils/postLoginReturn';

type ImportState = 'waiting' | 'saving' | 'success' | 'duplicate' | 'error' | 'login';

export function AiImportPage() {
  const { user, loading } = useAuth();
  const importId = useMemo(() => window.location.hash.slice(1), []);
  const [state, setState] = useState<ImportState>('waiting');
  const [message, setMessage] = useState('확장 프로그램의 기록을 확인하고 있습니다.');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setState('login');
      setMessage('HARU에 로그인하면 이 가져오기 작업으로 돌아와 저장을 계속합니다.');
      return;
    }
    if (!hasAiLibraryAccess(user.email, user.emailVerified)) {
      setState('error');
      setMessage('이 기능은 허용된 개발자 계정에서만 사용할 수 있습니다.');
      return;
    }

    let handled = false;
    const handlePayload = async (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== AI_IMPORT_PAYLOAD_EVENT) return;
      if (handled) return;
      handled = true;
      try {
        setState('saving');
        setMessage('로그인한 HARU 계정에 저장하고 있습니다.');
        const payload = parseAiImportPayload(event.data.payload, importId);
        const result = await saveAiImportForUser(payload);
        setState(result.duplicate ? 'duplicate' : 'success');
        setMessage(result.duplicate
          ? '이미 같은 기록이 HARU AI 학습함에 저장되어 있습니다.'
          : 'HARU AI 학습함 저장과 기록 생성을 확인했습니다.');
        window.postMessage({ type: AI_IMPORT_RESULT_EVENT, result: {
          importId, ok: true, duplicate: result.duplicate, recordId: result.recordId,
        } }, window.location.origin);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'HARU 저장에 실패했습니다.';
        setState('error');
        setMessage(reason);
        window.postMessage({ type: AI_IMPORT_RESULT_EVENT, result: {
          importId, ok: false, error: reason,
        } }, window.location.origin);
      }
    };

    window.addEventListener('message', handlePayload);
    window.postMessage({ type: AI_IMPORT_REQUEST_EVENT, importId }, window.location.origin);
    const timeout = window.setTimeout(() => {
      if (!handled) {
        setState('error');
        setMessage('확장 프로그램에서 저장할 기록을 받지 못했습니다. 확장을 다시 로드한 뒤 재시도해 주세요.');
      }
    }, 10_000);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', handlePayload);
    };
  }, [importId, loading, user]);

  const completed = state === 'success' || state === 'duplicate';
  const failed = state === 'error';
  const color = completed ? '#166534' : failed ? '#B91C1C' : '#1A3C6E';
  const icon = completed ? '✓' : failed ? '!' : state === 'login' ? '→' : '…';
  return (
    <main style={{
      minHeight: '100dvh',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 18px',
      background: 'linear-gradient(180deg, #F4F1FF 0%, #FFFBE8 100%)',
    }}>
      <section style={{
        width: '100%',
        maxWidth: 460,
        padding: '38px 28px 32px',
        textAlign: 'center',
        background: '#FFFFFF',
        border: '1px solid #E7E2F2',
        borderRadius: 24,
        boxShadow: '0 18px 48px rgba(26, 60, 110, 0.12)',
      }}>
        <div style={{
          width: 58,
          height: 58,
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: completed ? '#DCFCE7' : failed ? '#FEE2E2' : '#E8EEF9',
          color,
          fontSize: 28,
          fontWeight: 900,
        }} aria-hidden="true">
          {icon}
        </div>
        <p style={{ margin: '0 0 8px', color: '#7C6A9A', fontSize: 13, fontWeight: 700 }}>HARU2026</p>
        <h1 style={{ margin: 0, color: '#1A3C6E', fontSize: 25, fontWeight: 800 }}>AI 학습함 가져오기</h1>
        <p
          role={failed ? 'alert' : 'status'}
          style={{ margin: '14px 0 26px', color, fontSize: 15, lineHeight: 1.7, wordBreak: 'keep-all' }}
        >
          {message}
        </p>
        {state === 'login' && (
          <Link
            to="/login"
            onClick={() => rememberPostLoginReturnPath(`/ai-import#${importId}`)}
            style={primaryLinkStyle}
          >
            HARU 로그인 후 계속
          </Link>
        )}
        {completed && (
          <Link to="/ai-library" style={primaryLinkStyle}>AI 학습함 열기</Link>
        )}
        {(state === 'waiting' || state === 'saving') && (
          <p style={{ margin: 0, color: '#8A94A6', fontSize: 13 }}>이 창을 닫지 말고 잠시 기다려 주세요.</p>
        )}
      </section>
    </main>
  );
}

const primaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 180,
  minHeight: 46,
  padding: '0 22px',
  borderRadius: 999,
  background: '#1A3C6E',
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: 800,
  textDecoration: 'none',
} as const;
