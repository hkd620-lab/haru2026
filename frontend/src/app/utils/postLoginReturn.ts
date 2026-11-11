const POST_LOGIN_RETURN_KEY = 'haru.postLoginReturnPath.v1';
const AI_IMPORT_RETURN_PATTERN = /^\/ai-import#[a-f0-9]{64}$/;
const SIGNED_IN_RETURN_PATHS = new Set(['/settings', '/sayu']);

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getSessionStorage(): SessionStorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeProtectedReturnPath(path: string): string {
  const route = /^\/(settings|sayu)\/?$/i.exec(path)?.[1];
  return route ? `/${route.toLowerCase()}` : path;
}

export function isAllowedPostLoginReturnPath(path: unknown): path is string {
  return typeof path === 'string' && (AI_IMPORT_RETURN_PATTERN.test(path) || SIGNED_IN_RETURN_PATHS.has(path));
}

export function requiresAiImportReload(path: string): boolean {
  return AI_IMPORT_RETURN_PATTERN.test(path);
}

export function rememberPostLoginReturnPath(
  path: string,
  storage: SessionStorageLike | null = getSessionStorage(),
): boolean {
  const normalizedPath = normalizeProtectedReturnPath(path);
  if (!storage || !isAllowedPostLoginReturnPath(normalizedPath)) return false;
  try {
    storage.setItem(POST_LOGIN_RETURN_KEY, normalizedPath);
    return true;
  } catch {
    return false;
  }
}

export function clearProtectedPostLoginReturnPath(
  storage: SessionStorageLike | null = getSessionStorage(),
): void {
  if (!storage) return;
  try {
    if (SIGNED_IN_RETURN_PATHS.has(storage.getItem(POST_LOGIN_RETURN_KEY) ?? '')) {
      storage.removeItem(POST_LOGIN_RETURN_KEY);
    }
  } catch {
    // Storage can be unavailable in restricted browsers.
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
