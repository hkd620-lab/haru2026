export type AuthCallbackFailureCategory = 'firebase_auth_error' | 'callback_unexpected_error';

export type AuthCallbackFailureDiagnostics = {
  category: AuthCallbackFailureCategory;
  phase: 'sign_in_with_custom_token';
  errorCode: string;
  online: boolean;
};

type FailureLogger = (message: string, diagnostics: AuthCallbackFailureDiagnostics) => void;

const MAX_ERROR_CODE_LENGTH = 80;
const SAFE_FIREBASE_AUTH_CODE = /^auth\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getSafeFirebaseAuthErrorCode(error: unknown) {
  try {
    if (!error || typeof error !== 'object') return 'unknown';

    const code = (error as { code?: unknown }).code;
    if (typeof code !== 'string') return 'unknown';

    const trimmedCode = code.trim();
    if (
      trimmedCode.length === 0
      || trimmedCode.length > MAX_ERROR_CODE_LENGTH
      || !SAFE_FIREBASE_AUTH_CODE.test(trimmedCode)
    ) {
      return 'unknown';
    }

    return trimmedCode;
  } catch {
    return 'unknown';
  }
}

export function buildAuthCallbackFailureDiagnostics(
  error: unknown,
  online: boolean,
): AuthCallbackFailureDiagnostics {
  const errorCode = getSafeFirebaseAuthErrorCode(error);

  return {
    category: errorCode === 'unknown' ? 'callback_unexpected_error' : 'firebase_auth_error',
    phase: 'sign_in_with_custom_token',
    errorCode,
    online,
  };
}

export function logAuthCallbackFailure(
  diagnostics: AuthCallbackFailureDiagnostics,
  logger: FailureLogger = console.error,
) {
  logger('Firebase 로그인 실패:', diagnostics);
}
