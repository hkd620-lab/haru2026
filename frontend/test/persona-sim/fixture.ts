// 하네스 공용 상태 — 운영 Firebase 대신 브라우저 메모리(+localStorage)에만 둔다.
// Playwright 러너는 window.__qa 로 호출·저장 내역을 읽어 간다.

export interface PersonaIdentity {
  uid: string;
  displayName: string;
  email: string;
  plan?: 'free' | 'basic' | 'premium';
}

const injected = (window as any).__QA_PERSONA__ as PersonaIdentity | undefined;

export const persona: PersonaIdentity = injected ?? {
  uid: 'qa-persona-default',
  displayName: '가상 사용자',
  email: 'persona@example.invalid',
  plan: 'free',
};

// AuthContext(LocalUser) 모양
export const user = {
  uid: persona.uid,
  email: persona.email,
  displayName: persona.displayName,
  photoURL: null as string | null,
  providerId: 'google.com',
  providerIds: ['google.com'],
  emailVerified: true,
};

export interface CallLog { name: string; at: number; input: unknown; ok?: boolean; error?: string }
export interface WriteLog { op: string; path: string; merge?: boolean; keys: string[]; data?: unknown }
export interface UploadLog { path: string; size: number; contentType?: string }

export const qa = {
  persona,
  calls: [] as CallLog[],
  writes: [] as WriteLog[],
  uploads: [] as UploadLog[],
  deletedObjects: [] as string[],
  unknownCallables: [] as string[],
};

(window as any).__qa = qa;

// 월 AI 한도 사용량은 새로고침해도 유지한다(운영과 같은 달 단위 카운터를 흉내).
const QUOTA_KEY = `persona-sim-quota:${persona.uid}`;
export function getQuotaUsed(): number {
  try { return Number(localStorage.getItem(QUOTA_KEY) || '0') || 0; } catch { return 0; }
}
export function addQuotaUsed(n = 1): number {
  const next = getQuotaUsed() + n;
  try { localStorage.setItem(QUOTA_KEY, String(next)); } catch { /* 무시 */ }
  return next;
}
