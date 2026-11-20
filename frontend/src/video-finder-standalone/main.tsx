// videos.haru2026.com 전용 진입점. HARU 앱의 다른 화면·HARU AuthProvider·Firebase SDK는 이 묶음에 넣지 않는다.
// 로그인은 haru2026.com 확인 창에서 '내 영상 찾기' 전용 세션으로만 이어받는다(Firebase 토큰을 옮기지 않음, 주소로 넘기지 않음).
// 세션은 이 탭의 sessionStorage에만 두어 새로고침·하위 화면(/saved, /history)에서 함께 쓰고, 로그아웃·만료 때 지운다.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { VideoFinderScreen } from '../app/videoFinder/VideoFinderScreen';
import { VideoFinderPolicyLinks, YouTubeAttribution } from '../app/videoFinder/VideoFinderPolicies';
import {
  acceptSessionMessage,
  buildConnectUrl,
  createNonce,
  isStandaloneSession,
  resolveHaruOrigin,
  type StandaloneSession,
} from '../app/videoFinder/videoFinderBridge';
import { createStandaloneCaller, createStandaloneClient, isUnauthenticated, standaloneEndpoint } from './standaloneClient';
import '../styles/index.css';

const HARU_ORIGIN = resolveHaruOrigin(import.meta.env.VITE_VIDEO_FINDER_HARU_ORIGIN);
const ENDPOINT = standaloneEndpoint(String(import.meta.env.VITE_FIREBASE_PROJECT_ID || ''));
const SESSION_STORAGE_KEY = 'haru.videoFinderStandaloneSession.v1';

// 약관·개인정보 등 공개 안내는 HARU 본 주소에서 연다. 그 밖의 HARU 화면(결제·설정·기록 등)은 이 주소에 없다.
const HARU_PUBLIC_PATHS = ['/terms', '/privacy', '/refund', '/business-info'];

// 저장소를 못 쓰는 브라우저에서도 하위 화면 이동 때 세션을 잃지 않도록 메모리에도 둔다.
let memorySession: StandaloneSession | null = null;

function readStoredSession(): StandaloneSession | null {
  if (isStandaloneSession(memorySession)) return memorySession;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    if (isStandaloneSession(parsed)) return (memorySession = parsed);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰면 이 화면이 열려 있는 동안만 기억한다.
  }
  return null;
}

function storeSession(value: StandaloneSession | null) {
  memorySession = value;
  try {
    if (value) window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // 저장 불가 — 메모리 상태만 쓴다.
  }
}

function StandaloneSignIn({ onSession, notice }: { onSession: (s: StandaloneSession) => void; notice: string }) {
  const popupRef = useRef<Window | null>(null);
  const nonceRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const issued = acceptSessionMessage(event, { haruOrigin: HARU_ORIGIN, popup: popupRef.current, nonce: nonceRef.current });
      if (!issued) return;
      nonceRef.current = null;
      popupRef.current = null;
      // 확인 창에서 누르면 바로 들어간다(이 화면에서 다시 누를 필요 없음).
      onSession(issued);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSession]);

  const start = () => {
    const nonce = createNonce();
    const popup = window.open(buildConnectUrl(HARU_ORIGIN, nonce, window.location.origin), 'haruVideoFinderConnect', 'popup,width=480,height=720');
    if (!popup) {
      setStatus('error');
      setMessage('새 창이 막혔어요. 브라우저에서 이 주소의 팝업을 허용한 뒤 다시 눌러 주세요.');
      return;
    }
    nonceRef.current = nonce;
    popupRef.current = popup;
    setStatus('waiting');
    setMessage('');
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#FEFBE8] px-4 py-10 text-[#27332e]">
      <section className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-sm">
        <p className="text-base font-bold text-[#285843]">haru2026 하루2026</p>
        <h1 className="mt-2 text-3xl font-extrabold">내 영상 찾기</h1>
        <p className="mt-3 text-lg leading-8">원하는 영상을 찾아 내 보관함에 모아요. haru2026 계정으로 들어가면 haru2026 안에서 보던 보관함과 메모를 그대로 볼 수 있어요.</p>
        <p className="mt-2 text-base leading-7 text-[#46524a]">영상 정보 출처: YouTube</p>
        <div className="mt-3"><YouTubeAttribution /></div>
        {notice && <p role="status" className="mt-4 rounded-xl bg-[#fff9e6] p-3 text-base leading-7">{notice}</p>}
        <button
          type="button"
          onClick={start}
          className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#285843] px-4 py-3 text-lg font-bold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#e8ae45] disabled:opacity-60"
        >
          HARU 계정으로 계속하기
        </button>
        {status === 'waiting' && <p role="status" className="mt-4 text-base leading-7">작은 창에서 ‘이 계정으로 계속하기’를 눌러 주세요. 창이 보이지 않으면 버튼을 다시 눌러 주세요.</p>}
        {status === 'error' && <p role="alert" className="mt-4 text-base leading-7 text-[#8a2f22]">{message}</p>}
        <p className="mt-6 text-base leading-7 text-[#46524a]">
          아직 haru2026 계정이 없나요? <a className="font-bold underline" href={`${HARU_ORIGIN}/login`}>haru2026에서 가입·로그인</a>한 뒤 다시 오세요.
          haru2026 안에서는 비서실 ‘전체 보기’의 ‘내 영상 찾기’로 바로 들어갈 수 있어요.
        </p>
        <p className="mt-3 text-base leading-7 text-[#46524a]">이 주소에서는 내 영상 찾기만 이용할 수 있어요. 로그인 연결은 8시간 뒤 끝나요.</p>
        <div className="mt-4"><VideoFinderPolicyLinks haruOrigin={HARU_ORIGIN} /></div>
      </section>
    </div>
  );
}

function StandaloneShell() {
  const [session, setSession] = useState<StandaloneSession | null>(() => readStoredSession());
  const [notice, setNotice] = useState('');
  const sessionRef = useRef<string | null>(session?.session ?? null);
  sessionRef.current = session?.session ?? null;

  const end = useCallback((text: string) => {
    storeSession(null);
    setSession(null);
    setNotice(text);
  }, []);

  const onSession = useCallback((issued: StandaloneSession) => {
    storeSession(issued);
    setNotice('');
    setSession(issued);
  }, []);

  const client = useMemo(() => {
    const raw = createStandaloneCaller(ENDPOINT, () => sessionRef.current);
    // 서버가 세션 끝남을 알리면(만료·탈퇴·다른 곳 로그아웃 등) 바로 처음 화면으로 돌아간다.
    async function guarded<T>(op: Parameters<typeof raw>[0], payload?: unknown): Promise<T> {
      try {
        return await raw<T>(op, payload);
      } catch (error) {
        if (isUnauthenticated(error)) end('로그인 연결이 끝났어요. ‘HARU 계정으로 계속하기’를 눌러 다시 들어와 주세요.');
        throw error;
      }
    }
    return createStandaloneClient(guarded);
  }, [end]);

  // 만료 시각이 지나면 서버 응답을 기다리지 않고 끝낸다.
  useEffect(() => {
    if (!session) return;
    const wait = session.expiresAt - Date.now();
    const timer = window.setTimeout(() => end('로그인 연결 시간(8시간)이 끝났어요. 다시 들어와 주세요.'), Math.max(0, Math.min(wait, 2 ** 31 - 1)));
    return () => window.clearTimeout(timer);
  }, [session, end]);

  const signOut = useCallback(() => {
    const current = sessionRef.current;
    end('로그아웃했어요.');
    // 서버의 세션 문서도 지운다. 실패해도 이 탭에서는 이미 지웠다.
    if (current) void createStandaloneCaller(ENDPOINT, () => current)('signOut').catch(() => undefined);
  }, [end]);

  if (!session) return <StandaloneSignIn onSession={onSession} notice={notice} />;
  return <VideoFinderScreen key={session.accountKey} basePath="" variant="standalone" client={client} accountKey={session.accountKey} haruOrigin={HARU_ORIGIN} onSignOut={signOut} />;
}

function RedirectToHaru({ path }: { path: string }) {
  useEffect(() => {
    window.location.replace(`${HARU_ORIGIN}${path}`);
  }, [path]);
  return <p className="p-6 text-lg">haru2026으로 이동하는 중이에요…</p>;
}

function StandaloneApp() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (HARU_PUBLIC_PATHS.includes(path)) return <RedirectToHaru path={path} />;
  return (
    <BrowserRouter>
      <Routes>
        {/* 세 화면이 같은 세션을 쓰도록 하나의 셸이 모든 하위 경로를 맡는다. */}
        <Route path="/" element={<StandaloneShell />} />
        <Route path="/saved" element={<StandaloneShell />} />
        <Route path="/history" element={<StandaloneShell />} />
        {/* HARU의 다른 경로(설정·결제·기록 등)는 이 주소에서 열지 않는다. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StandaloneApp />
  </React.StrictMode>,
);
