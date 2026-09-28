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
      setMessage('HARU에 로그인한 뒤 Slack에서 저장을 다시 눌러 주세요.');
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
        const result = await saveAiImportForUser(user.uid, payload);
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

  const color = state === 'success' || state === 'duplicate' ? '#166534' : state === 'error' ? '#B91C1C' : '#1A3C6E';
  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: 24, textAlign: 'center' }}>
      <h1 style={{ color: '#1A3C6E', fontSize: 24, fontWeight: 800 }}>AI 학습함 가져오기</h1>
      <p role={state === 'error' ? 'alert' : 'status'} style={{ color, lineHeight: 1.7 }}>{message}</p>
      {state === 'login' && <Link to="/login">HARU 로그인</Link>}
      {(state === 'success' || state === 'duplicate') && <Link to="/ai-library">AI 학습함 열기</Link>}
    </main>
  );
}
