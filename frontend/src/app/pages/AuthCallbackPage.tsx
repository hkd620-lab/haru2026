import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../config/firebase';
import { toast } from 'sonner';
import { normalizeLoginProvider, rememberLoginProviderLocally } from '../utils/loginProvider';
import { failLoginTrace, markLoginTrace } from '../utils/loginPerformance';

const callbackInProgressKeys = new Set<string>();
const callbackCompletedKeys = new Set<string>();
const SESSION_COMPLETED_CALLBACKS_KEY = 'haru.authCallback.completedKeys.v1';

function readCallbackParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  return {
    customToken: searchParams.get('customToken') || hashParams.get('customToken'),
    provider: normalizeLoginProvider(searchParams.get('provider') || hashParams.get('provider')),
    error: searchParams.get('error') || hashParams.get('error'),
  };
}

function hashTokenForKey(token: string) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${token.length}:${(hash >>> 0).toString(36)}`;
}

function getCallbackKey(customToken: string, provider: string | null | undefined) {
  return `${provider || 'unknown'}:${hashTokenForKey(customToken)}`;
}

function readCompletedCallbackKeys() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_COMPLETED_CALLBACKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function isCallbackCompleted(key: string) {
  return callbackCompletedKeys.has(key) || readCompletedCallbackKeys().includes(key);
}

function rememberCompletedCallback(key: string) {
  callbackCompletedKeys.add(key);
  try {
    const keys = [...new Set([...readCompletedCallbackKeys(), key])].slice(-10);
    window.sessionStorage.setItem(SESSION_COMPLETED_CALLBACKS_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

function clearSensitiveCallbackUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

function classifyCallbackError(error: unknown) {
  const code = typeof (error as { code?: unknown })?.code === 'string'
    ? (error as { code: string }).code
    : '';
  if (/^auth\/[a-z0-9-]+$/.test(code)) return 'firebase_auth_error' as const;
  return 'callback_unexpected_error' as const;
}

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      markLoginTrace('T2_callback_arrived');
      let callbackProvider: ReturnType<typeof normalizeLoginProvider> = null;
      try {
        const { customToken, provider, error } = readCallbackParams();
        callbackProvider = provider;

        if (error) {
          clearSensitiveCallbackUrl();
          failLoginTrace('provider_error_param', 'provider_redirect_error', provider);
          console.error('로그인 오류:', { provider, errorType: 'provider_redirect_error' });
          toast.error('로그인에 실패했습니다.');
          navigate('/login', { replace: true });
          return;
        }

        if (!customToken) {
          if (callbackInProgressKeys.size > 0) return;
          failLoginTrace('missing_custom_token', 'missing_custom_token', provider);
          console.error('customToken이 없습니다', { provider, errorType: 'missing_custom_token' });
          toast.error('인증 정보가 없습니다.');
          navigate('/login', { replace: true });
          return;
        }

        const callbackKey = getCallbackKey(customToken, provider);
        clearSensitiveCallbackUrl();
        if (callbackInProgressKeys.has(callbackKey) || isCallbackCompleted(callbackKey)) {
          return;
        }

        callbackInProgressKeys.add(callbackKey);

        try {
          // Firebase 커스텀 토큰으로 로그인
          const userCredential = await signInWithCustomToken(auth, customToken);
          markLoginTrace('T3_firebase_sign_in_complete');
          rememberCompletedCallback(callbackKey);
          if (provider) {
            rememberLoginProviderLocally(userCredential.user.uid, provider);
          }

          toast.success('로그인 성공!');
          navigate('/', { replace: true });
        } finally {
          callbackInProgressKeys.delete(callbackKey);
        }
      } catch (error) {
        const errorType = classifyCallbackError(error);
        failLoginTrace(
          errorType === 'firebase_auth_error' ? 'firebase_custom_token_sign_in' : 'callback_processing',
          errorType,
          callbackProvider,
        );
        console.error('Firebase 로그인 실패:', { provider: callbackProvider, errorType });
        toast.error('로그인 처리 중 오류가 발생했습니다.');
        navigate('/login', { replace: true });
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE9F5' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#1A3C6E' }}></div>
        <p className="text-lg" style={{ color: '#1A3C6E' }}>로그인 중...</p>
      </div>
    </div>
  );
}
