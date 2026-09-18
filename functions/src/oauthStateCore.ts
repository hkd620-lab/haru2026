export type LoginOAuthProvider = 'kakao' | 'naver' | 'google';

export const DEFAULT_LOGIN_FRONTEND_ORIGIN = 'https://haru2026.com';
const FIREBASE_PREVIEW_HOST_PATTERN = /^haru2026-8abb8--[a-z0-9-]+\.web\.app$/;

type OAuthStateDoc = {
  exists: boolean;
  data(): Record<string, any> | undefined;
};

type OAuthStateTransaction = {
  get(ref: unknown): Promise<OAuthStateDoc>;
  delete(ref: unknown): void;
};

type OAuthStateDb = {
  collection(name: string): {
    doc(id: string): unknown;
  };
  runTransaction<T>(task: (tx: OAuthStateTransaction) => Promise<T>): Promise<T>;
};

type NowProvider = () => number;

function getOAuthStateExpiryMs(data: Record<string, any> | undefined): number {
  const expiresAt = data?.expiresAt;
  return typeof expiresAt?.toMillis === 'function' ? expiresAt.toMillis() : 0;
}

export function resolveLoginFrontendOrigin(
  returnOrigin: unknown,
  fallbackOrigin = DEFAULT_LOGIN_FRONTEND_ORIGIN,
): string {
  if (typeof returnOrigin !== 'string') return fallbackOrigin;

  const candidate = returnOrigin.trim();
  if (!candidate) return fallbackOrigin;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return fallbackOrigin;
    if (url.username || url.password || url.port) return fallbackOrigin;
    if (url.pathname !== '/' || url.search || url.hash) return fallbackOrigin;
    if (candidate !== url.origin) return fallbackOrigin;

    if (url.hostname === 'haru2026.com') return url.origin;
    if (FIREBASE_PREVIEW_HOST_PATTERN.test(url.hostname)) return url.origin;
  } catch {
    return fallbackOrigin;
  }

  return fallbackOrigin;
}

export function getLoginOAuthCallbackCode(code: unknown, providerError: unknown): string {
  if (hasLoginOAuthProviderError(providerError)) throw new Error('Provider returned OAuth error');
  if (!code || typeof code !== 'string') throw new Error('Invalid code');
  return code;
}

function hasLoginOAuthProviderError(providerError: unknown): boolean {
  if (typeof providerError === 'string') return providerError.trim().length > 0;
  if (Array.isArray(providerError)) {
    return providerError.some((value) => typeof value === 'string' && value.trim().length > 0);
  }
  return false;
}

export async function consumeLoginOAuthStateWithDb(
  db: OAuthStateDb,
  state: string,
  provider: LoginOAuthProvider,
  nowProvider: NowProvider = Date.now,
) {
  const stateRef = db.collection('oauth_states').doc(state);
  return db.runTransaction(async (tx) => {
    const stateDoc = await tx.get(stateRef);
    if (!stateDoc.exists) throw new Error('State not found');

    const stateData = stateDoc.data();
    if (stateData?.provider !== provider) throw new Error('State provider mismatch');
    if (getOAuthStateExpiryMs(stateData) < nowProvider()) throw new Error('State expired');

    tx.delete(stateRef);
    return stateData;
  });
}
