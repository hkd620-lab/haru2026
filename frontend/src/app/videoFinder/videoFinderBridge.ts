// youtube.haru2026.com(독립 주소)이 haru2026.com 계정으로 '내 영상 찾기'만 이용하게 하는 연결 규칙.
// Firebase 로그인 토큰(HARU 기록·결제 등 앱 전체 자격 증명)은 독립 주소로 옮기지 않는다.
//
// 흐름
// 1) 독립 주소에서 'HARU 계정으로 계속하기'를 누르면 haru2026.com/video-finder/connect를 팝업으로 연다.
//    주소 조각(#)에는 이번 요청 번호(nonce)와 돌아갈 출처만 들어간다. 세션은 주소에 넣지 않는다.
// 2) 팝업(haru2026.com)은 같은 출처의 기존 HARU 로그인으로 계정을 보여주고, 사용자가 누르면 서버가 확인한 uid로
//    '내 영상 찾기' 전용 세션(8시간, 서버에는 해시만 저장)을 받아 허용된 독립 주소 출처에만 postMessage로 넘긴다.
// 3) 독립 주소는 보낸 출처·팝업 창·요청 번호가 모두 맞을 때만 세션을 받아, 이 기능 전용 호출에만 실어 보낸다.

export const HARU_PRIMARY_ORIGIN = 'https://haru2026.com';
export const VIDEO_FINDER_STANDALONE_ORIGIN = 'https://youtube.haru2026.com';
export const VIDEO_FINDER_CONNECT_PATH = '/video-finder/connect';
export const VIDEO_FINDER_SESSION_MESSAGE = 'haru-video-finder-session';
export const VIDEO_FINDER_CONNECT_STORAGE_KEY = 'haru.videoFinderConnect.v1';

const NONCE_RE = /^[a-f0-9]{32}$/;
// 서버 videoFinderCore.ts의 세션 형식(32바이트 base64url)과 같다. 점이 없어 Firebase 토큰(JWT)과 섞이지 않는다.
const SESSION_RE = /^[A-Za-z0-9_-]{43}$/;
const ACCOUNT_KEY_RE = /^[a-f0-9]{24}$/;

export function isHttpsOrigin(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password;
  } catch {
    return false;
  }
}

// 운영 주소 외 추가 출처는 빌드 환경값(미리보기 시험용)으로만 받는다. 주소창 입력으로는 늘어나지 않는다.
export function resolveAllowedStandaloneOrigins(extraOrigin?: unknown): string[] {
  const origins = [VIDEO_FINDER_STANDALONE_ORIGIN];
  if (isHttpsOrigin(extraOrigin) && !origins.includes(extraOrigin)) origins.push(extraOrigin);
  return origins;
}

export function resolveHaruOrigin(override?: unknown): string {
  return isHttpsOrigin(override) ? override : HARU_PRIMARY_ORIGIN;
}

export function isValidNonce(value: unknown): value is string {
  return typeof value === 'string' && NONCE_RE.test(value);
}

export function createNonce(cryptoLike: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): string {
  const bytes = cryptoLike.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildConnectUrl(haruOrigin: string, nonce: string, standaloneOrigin: string): string {
  const hash = new URLSearchParams({ nonce, origin: standaloneOrigin });
  return `${haruOrigin}${VIDEO_FINDER_CONNECT_PATH}#${hash.toString()}`;
}

export type ConnectRequest = { nonce: string; origin: string };

export function parseConnectRequest(hash: string, allowedOrigins: string[]): ConnectRequest | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const nonce = params.get('nonce');
  const origin = params.get('origin');
  if (!isValidNonce(nonce) || !origin || !allowedOrigins.includes(origin)) return null;
  return { nonce, origin };
}

export type StandaloneSession = { session: string; expiresAt: number; accountKey: string };

export type SessionMessage = {
  type: typeof VIDEO_FINDER_SESSION_MESSAGE;
  version: 2;
  nonce: string;
} & StandaloneSession;

export function isStandaloneSession(value: unknown, nowMs = Date.now()): value is StandaloneSession {
  const v = value as Partial<StandaloneSession> | null;
  return !!v && typeof v === 'object'
    && typeof v.session === 'string' && SESSION_RE.test(v.session)
    && typeof v.accountKey === 'string' && ACCOUNT_KEY_RE.test(v.accountKey)
    && typeof v.expiresAt === 'number' && Number.isFinite(v.expiresAt) && v.expiresAt > nowMs;
}

export function buildSessionMessage(nonce: string, issued: StandaloneSession): SessionMessage {
  return { type: VIDEO_FINDER_SESSION_MESSAGE, version: 2, nonce, session: issued.session, expiresAt: issued.expiresAt, accountKey: issued.accountKey };
}

// 독립 주소 쪽 수신 검사. 보낸 출처·내가 연 팝업 창·이번 요청 번호가 모두 맞을 때만 세션을, 아니면 null을 돌려준다.
export function acceptSessionMessage(
  event: { origin: string; source: unknown; data: unknown },
  expected: { haruOrigin: string; popup: unknown; nonce: string | null },
  nowMs = Date.now(),
): StandaloneSession | null {
  if (!expected.nonce || !expected.popup) return null;
  if (event.origin !== expected.haruOrigin || event.source !== expected.popup) return null;
  const data = event.data as Partial<SessionMessage> | null;
  if (!data || typeof data !== 'object') return null;
  if (data.type !== VIDEO_FINDER_SESSION_MESSAGE || data.version !== 2 || data.nonce !== expected.nonce) return null;
  const issued = { session: data.session, expiresAt: data.expiresAt, accountKey: data.accountKey };
  return isStandaloneSession(issued, nowMs) ? issued : null;
}
