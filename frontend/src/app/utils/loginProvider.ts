export type LoginProvider = 'naver' | 'google' | 'kakao' | 'password';

const LOGIN_PROVIDER_STORAGE_PREFIX = 'haru.loginProvider.v1:';

const LOGIN_PROVIDER_ALIASES: Record<string, LoginProvider> = {
  naver: 'naver',
  google: 'google',
  'google.com': 'google',
  kakao: 'kakao',
  password: 'password',
};

const LOGIN_PROVIDER_LABELS: Record<LoginProvider, string> = {
  naver: '네이버 로그인',
  google: 'Google 로그인',
  kakao: '카카오 로그인',
  password: '이메일 로그인',
};

export function normalizeLoginProvider(value: unknown): LoginProvider | null {
  if (typeof value !== 'string') return null;
  return LOGIN_PROVIDER_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function getLoginProviderLabel(value: unknown): string {
  const provider = normalizeLoginProvider(value);
  return provider ? LOGIN_PROVIDER_LABELS[provider] : '로그인 계정';
}

export function mergeProviderIds(providerIds: string[] | undefined, provider: LoginProvider): string[] {
  return Array.from(new Set([...(providerIds ?? []), provider]));
}

function getLoginProviderStorageKey(uid: string): string {
  return `${LOGIN_PROVIDER_STORAGE_PREFIX}${uid}`;
}

export function rememberLoginProviderLocally(uid: string, provider: LoginProvider) {
  try {
    window.localStorage.setItem(getLoginProviderStorageKey(uid), provider);
  } catch (error) {
    console.warn('Login provider local save error:', error);
  }
}

export function readRememberedLoginProvider(uid: string): LoginProvider | null {
  try {
    return normalizeLoginProvider(window.localStorage.getItem(getLoginProviderStorageKey(uid)));
  } catch (error) {
    console.warn('Login provider local read error:', error);
    return null;
  }
}
