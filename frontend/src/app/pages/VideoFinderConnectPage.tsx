// haru2026.com/video-finder/connect — 독립 주소(youtube.haru2026.com)가 연 작은 창.
// 같은 출처의 기존 HARU 로그인으로 계정을 확인하고, 사용자가 누를 때만 서버가 확인한 uid로
// '내 영상 찾기' 전용 세션을 받아 허용된 출처의 원래 창으로 넘긴다. Firebase 로그인 토큰은 넘기지 않는다.
// 세션은 주소에 넣지 않고 postMessage(targetOrigin 고정)로만 전달한다.
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { createStandaloneSession } from '../videoFinder/videoFinderApi';
import {
  VIDEO_FINDER_CONNECT_STORAGE_KEY,
  buildSessionMessage,
  parseConnectRequest,
  resolveAllowedStandaloneOrigins,
  type ConnectRequest,
} from '../videoFinder/videoFinderBridge';
import { friendlyErrorMessage } from '../videoFinder/videoFinderModel';
import { rememberPostLoginReturnPath } from '../utils/postLoginReturn';

const allowedOrigins = resolveAllowedStandaloneOrigins(import.meta.env.VITE_VIDEO_FINDER_STANDALONE_ORIGIN);

function readRequest(): ConnectRequest | null {
  const fromHash = parseConnectRequest(window.location.hash, allowedOrigins);
  if (fromHash) {
    try { window.sessionStorage.setItem(VIDEO_FINDER_CONNECT_STORAGE_KEY, JSON.stringify(fromHash)); } catch { /* 저장 불가 */ }
    window.history.replaceState(window.history.state, document.title, window.location.pathname);
    return fromHash;
  }
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(VIDEO_FINDER_CONNECT_STORAGE_KEY) || 'null');
    if (stored && typeof stored === 'object') {
      const params = new URLSearchParams({ nonce: String(stored.nonce || ''), origin: String(stored.origin || '') });
      return parseConnectRequest(params.toString(), allowedOrigins);
    }
  } catch {
    // 저장된 요청이 없거나 손상됐으면 처음부터 다시 연다.
  }
  return null;
}

function clearRequest() {
  try { window.sessionStorage.removeItem(VIDEO_FINDER_CONNECT_STORAGE_KEY); } catch { /* 무시 */ }
}

const btn = 'inline-flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 py-3 text-lg font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#e8ae45] disabled:opacity-60';

export function VideoFinderConnectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request] = useState<ConnectRequest | null>(() => readRequest());
  const [state, setState] = useState<'ready' | 'sending' | 'sent' | 'noOpener' | 'error'>('ready');
  const [error, setError] = useState('');

  useEffect(() => {
    if (state !== 'sent') return;
    const timer = window.setTimeout(() => window.close(), 800);
    return () => window.clearTimeout(timer);
  }, [state]);

  const send = async () => {
    if (!request) return;
    const opener = window.opener as Window | null;
    if (!opener || opener.closed) {
      setState('noOpener');
      return;
    }
    setState('sending');
    setError('');
    try {
      const issued = await createStandaloneSession(request.origin);
      // targetOrigin을 허용 목록의 출처로 고정한다. 다른 사이트가 이 창을 열었다면 브라우저가 전달하지 않는다.
      opener.postMessage(buildSessionMessage(request.nonce, issued), request.origin);
      clearRequest();
      setState('sent');
    } catch (e) {
      setError(friendlyErrorMessage(e));
      setState('error');
    }
  };

  const shell = (children: ReactNode) => (
    <div className="flex min-h-screen items-start justify-center bg-[#FEFBE8] px-4 py-10 text-[#27332e]">
      <section className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-sm">
        <p className="text-base font-bold text-[#285843]">haru2026 하루2026</p>
        <h1 className="mt-2 text-2xl font-extrabold">내 영상 찾기 로그인 연결</h1>
        {children}
      </section>
    </div>
  );

  if (!request) {
    return shell(
      <>
        <p role="alert" className="mt-4 text-lg leading-8">연결 요청을 확인하지 못했어요. 이 창을 닫고 내 영상 찾기 화면에서 ‘HARU 계정으로 계속하기’를 다시 눌러 주세요.</p>
        <button type="button" className={`${btn} mt-5 border border-[#9fb39a] bg-white`} onClick={() => navigate('/video-finder')}>haru2026에서 내 영상 찾기 열기</button>
      </>,
    );
  }

  if (!user) {
    return shell(
      <>
        <p className="mt-4 text-lg leading-8">먼저 haru2026에 로그인해 주세요. 로그인한 뒤 이 창을 닫고, 내 영상 찾기 화면에서 ‘HARU 계정으로 계속하기’를 다시 누르면 돼요.</p>
        <button type="button" className={`${btn} mt-5 bg-[#285843] text-white`} onClick={() => { rememberPostLoginReturnPath('/video-finder/connect'); navigate('/login', { state: { fromProtectedRoute: true } }); }}>haru2026 로그인</button>
      </>,
    );
  }

  const accountLabel = user.displayName || user.email || '현재 계정';

  return shell(
    <>
      <p className="mt-4 text-lg leading-8">
        <strong>{accountLabel}</strong> 계정으로 <strong>{new URL(request.origin).host}</strong>의 내 영상 찾기에 들어갑니다. 같은 보관함과 메모를 보게 돼요.
      </p>
      <p className="mt-2 text-base leading-7 text-[#46524a]">내가 연 창이 아니라면 ‘취소’를 눌러 주세요.</p>
      {state === 'sent' && <p role="status" className="mt-4 text-lg font-semibold text-[#285843]">연결했어요. 이 창은 곧 닫혀요.</p>}
      {state === 'noOpener' && (
        <p role="alert" className="mt-4 text-lg leading-8">원래 화면과 연결이 끊어졌어요. 이 창을 닫고 내 영상 찾기 화면에서 ‘HARU 계정으로 계속하기’를 다시 눌러 주세요.</p>
      )}
      {state === 'error' && <p role="alert" className="mt-4 text-lg leading-8 text-[#8a2f22]">{error}</p>}
      <div className="mt-5 grid gap-3">
        <button type="button" className={`${btn} bg-[#285843] text-white`} disabled={state === 'sending' || state === 'sent'} onClick={() => void send()}>
          {state === 'sending' ? '연결하는 중…' : state === 'error' ? '다시 시도' : '이 계정으로 계속하기'}
        </button>
        <button type="button" className={`${btn} border border-[#9fb39a] bg-white`} onClick={() => { clearRequest(); window.close(); }}>취소</button>
      </div>
    </>,
  );
}
