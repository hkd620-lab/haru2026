const POST_LOGIN_RETURN_KEY = 'haru.postLoginReturnPath.v1';
const AI_IMPORT_RETURN_PATTERN = /^\/ai-import#[a-f0-9]{64}$/;

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getSessionStorage(): SessionStorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function isAllowedPostLoginReturnPath(path: unknown): path is string {
  return typeof path === 'string' && AI_IMPORT_RETURN_PATTERN.test(path);
}

export function rememberPostLoginReturnPath(
  path: string,
  storage: SessionStorageLike | null = getSessionStorage(),
): boolean {
  if (!storage || !isAllowedPostLoginReturnPath(path)) return false;
  try {
    storage.setItem(POST_LOGIN_RETURN_KEY, path);
    return true;
  } catch {
    return false;
  }
}

export function consumePostLoginReturnPath(
  fallback = '/',
  storage: SessionStorageLike | null = getSessionStorage(),
): string {
  if (!storage) return fallback;
  try {
    const path = storage.getItem(POST_LOGIN_RETURN_KEY);
    storage.removeItem(POST_LOGIN_RETURN_KEY);
    return isAllowedPostLoginReturnPath(path) ? path : fallback;
  } catch {
    return fallback;
  }
}
