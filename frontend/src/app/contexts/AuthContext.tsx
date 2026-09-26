import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  GoogleAuthProvider,
  sendEmailVerification,
  reload,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '../config/firebase';
import { cleanupDuplicateTokens } from '../services/notificationService';
import {
  LoginProvider,
  mergeProviderIds,
  normalizeLoginProvider,
  readRememberedLoginProvider,
  rememberLoginProviderLocally,
} from '../utils/loginProvider';
import {
  bindLoginTraceToAccount,
  blockLoginTrace,
  endLoginTraceForAuthChange,
  markLoginAccessReady,
  markLoginTrace,
  resumeLoginTrace,
} from '../utils/loginPerformance';
import {
  invalidateSnsThumbnailAuthSession,
  setSnsThumbnailAuthUser,
} from '../utils/snsPrivateThumbnailState';

// LoginPage.tsx의 회원가입 동의와 동일한 버전 문자열 — 약관 개정 시 재동의 대상을 가려낼 때 사용
const TERMS_VERSION = '2026-08-20';
const PRIVACY_VERSION = '2026-08-20';

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId?: string;
  providerIds?: string[];
  emailVerified: boolean;
}

interface AuthContextType {
  user: LocalUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ user: LocalUser | null }>;
  resetPassword: (email: string) => Promise<void>;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  googleSignIn: () => Promise<void>;
  kakaoSignIn: () => Promise<void>;
  naverSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const KAKAO_USER_KEY = 'haru_kakao_user';
const NAVER_USER_KEY = 'haru_naver_user';

function clearLegacySocialUserCache() {
  localStorage.removeItem(KAKAO_USER_KEY);
  localStorage.removeItem(NAVER_USER_KEY);
}

function rememberLoginProvider(uid: string, provider: LoginProvider) {
  rememberLoginProviderLocally(uid, provider);
}

const mapUser = (user: FirebaseUser): LocalUser => {
  const rememberedProvider = readRememberedLoginProvider(user.uid);
  const providerIds = user.providerData.map((provider) => (
    normalizeLoginProvider(provider.providerId) ?? provider.providerId
  ));
  const normalizedPrimaryProvider = normalizeLoginProvider(user.providerData[0]?.providerId);

  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
    photoURL: user.photoURL ?? null,
    providerId: normalizedPrimaryProvider ?? rememberedProvider ?? user.providerData[0]?.providerId ?? 'custom',
    providerIds: rememberedProvider ? mergeProviderIds(providerIds, rememberedProvider) : providerIds,
    emailVerified: user.emailVerified,
  };
};

function getAuthErrorMessage(error: any): string {
  const code = error?.code || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다. 기존 로그인으로 접속한 뒤 설정에서 이메일 로그인을 추가해 주세요.';
    case 'auth/invalid-email':
      return '이메일 주소를 다시 확인해 주세요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상으로 입력해 주세요.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.';
    case 'auth/account-exists-with-different-credential':
      return '이미 다른 로그인 방식으로 사용 중인 이메일입니다. 기존 로그인으로 접속한 뒤 이메일 로그인을 추가해 주세요.';
    case 'auth/provider-already-linked':
      return '이미 이메일 로그인이 연결된 계정입니다.';
    case 'auth/credential-already-in-use':
      return '이 이메일 로그인은 다른 계정에 이미 연결되어 있습니다.';
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인한 뒤 시도해 주세요.';
    case 'auth/missing-password':
      return '비밀번호를 입력해 주세요.';
    default:
      return '인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

// 회원탈퇴 유예기간(pending_deletion) 중 표시하는 복구 안내 화면.
// AuthProvider가 앱 최상위를 감싸므로, 여기서 children을 대체하면
// 라우터(App.tsx)를 건드리지 않고도 서비스 전체 진입을 막을 수 있다.
function AccountPendingDeletionScreen({
  scheduledAt,
  isRecovering,
  onRecover,
  onLogout,
}: {
  scheduledAt: Date | null;
  isRecovering: boolean;
  onRecover: () => void;
  onLogout: () => void;
}) {
  const daysLeft = scheduledAt
    ? Math.max(0, Math.ceil((scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EDE9F5',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '32px 24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A3C6E', marginBottom: 12 }}>
          회원탈퇴가 신청되어 있습니다
        </h1>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
          {daysLeft !== null
            ? `앞으로 ${daysLeft}일 후 계정과 모든 기록이 완전히 삭제됩니다.`
            : '유예기간이 지나면 계정과 모든 기록이 완전히 삭제됩니다.'}
        </p>
        <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 28 }}>
          계속 이용하시려면 아래 [계정 복구하기]를 눌러주세요.
        </p>

        <button
          type="button"
          onClick={onRecover}
          disabled={isRecovering}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: isRecovering ? '#93c5fd' : '#1A3C6E',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: isRecovering ? 'not-allowed' : 'pointer',
            marginBottom: 10,
          }}
        >
          {isRecovering ? '복구 처리 중...' : '계정 복구하기'}
        </button>

        <button
          type="button"
          onClick={onLogout}
          disabled={isRecovering}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            backgroundColor: '#fff',
            color: '#4B5563',
            fontSize: 14,
            fontWeight: 600,
            cursor: isRecovering ? 'not-allowed' : 'pointer',
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

// 회원가입 시 필수 동의(consents 필드)를 아직 받지 않은 사용자에게 표시하는 게이트 화면.
// 이메일 신규가입은 LoginPage에서 사전 동의를 받아 consents가 즉시 채워지므로 이 화면을 보지 않는다.
// 소셜 로그인(구글/카카오/네이버) 신규가입자와, 개정 전 가입한 기존 회원은 로그인 직후
// consents가 없다는 사실이 감지되어 이 화면으로 자동 유도된다.
function ConsentGateScreen({
  isSaving,
  onSave,
  onLogout,
}: {
  isSaving: boolean;
  onSave: (marketing: boolean) => void;
  onLogout: () => void;
}) {
  const [agreeAge14, setAgreeAge14] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeOverseas, setAgreeOverseas] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  const requiredChecked = agreeAge14 && agreeTerms && agreePrivacy && agreeOverseas;
  const allChecked = requiredChecked && agreeMarketing;

  const toggleAll = (checked: boolean) => {
    setAgreeAge14(checked);
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeOverseas(checked);
    setAgreeMarketing(checked);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EDE9F5',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '32px 24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A3C6E', marginBottom: 8, textAlign: 'center' }}>
          약관 동의가 필요합니다
        </h1>
        <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
          개인정보 처리에 관한 안내가 개정되어 다시 동의를 받고 있습니다.
        </p>

        <div
          style={{
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            padding: 12,
            backgroundColor: '#F9FAFB',
            marginBottom: 20,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingBottom: 10,
              marginBottom: 8,
              borderBottom: '1px solid #E5E7EB',
            }}
          >
            <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} disabled={isSaving} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E' }}>전체 동의</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={agreeAge14} onChange={(e) => setAgreeAge14(e.target.checked)} disabled={isSaving} />
              <span style={{ fontSize: 13, color: '#374151' }}>
                만 19세 이상입니다 <span style={{ color: '#dc2626' }}>(필수)</span>
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} disabled={isSaving} />
              <span style={{ fontSize: 13, color: '#374151' }}>
                이용약관에 동의합니다 <span style={{ color: '#dc2626' }}>(필수)</span>
              </span>
            </label>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1A3C6E', textDecoration: 'underline' }}>
              보기
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} disabled={isSaving} />
              <span style={{ fontSize: 13, color: '#374151' }}>
                개인정보 수집·이용에 동의합니다 <span style={{ color: '#dc2626' }}>(필수)</span>
              </span>
            </label>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1A3C6E', textDecoration: 'underline' }}>
              보기
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={agreeOverseas} onChange={(e) => setAgreeOverseas(e.target.checked)} disabled={isSaving} />
              <span style={{ fontSize: 13, color: '#374151' }}>
                개인정보 국외 이전에 동의합니다 <span style={{ color: '#dc2626' }}>(필수)</span>
              </span>
            </label>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1A3C6E', textDecoration: 'underline' }}>
              보기
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)} disabled={isSaving} />
              <span style={{ fontSize: 13, color: '#374151' }}>
                마케팅 정보 수신에 동의합니다 <span style={{ color: '#9CA3AF' }}>(선택)</span>
              </span>
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSave(agreeMarketing)}
          disabled={isSaving || !requiredChecked}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: isSaving || !requiredChecked ? '#93c5fd' : '#1A3C6E',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: isSaving || !requiredChecked ? 'not-allowed' : 'pointer',
            marginBottom: 10,
          }}
        >
          {isSaving ? '처리 중...' : '동의하고 계속하기'}
        </button>

        <button
          type="button"
          onClick={onLogout}
          disabled={isSaving}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            backgroundColor: '#fff',
            color: '#4B5563',
            fontSize: 14,
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

type UserDocumentState = {
  uid: string;
  generation: number;
} & (
  | { status: 'error' }
  | { status: 'ready'; pendingDeletion: { scheduledAt: Date | null } | null; needsConsent: boolean }
);

function AccountVerificationScreen({ failed, canLogout, onRetry, onLogout }: {
  failed: boolean;
  canLogout: boolean;
  onRetry: () => void;
  onLogout: () => void;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDE9F5', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A3C6E' }}>
          {failed ? '계정 상태를 확인하지 못했습니다' : '계정 상태를 확인하고 있습니다'}
        </h1>
        <p role={failed ? 'alert' : 'status'} style={{ fontSize: 14, lineHeight: 1.7, margin: '16px 0' }}>
          {failed
            ? '동의 및 탈퇴 신청 상태를 확인할 수 없어 화면을 열지 않았습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
            : '동의 및 탈퇴 신청 상태를 확인할 때까지 잠시 기다려 주세요.'}
        </p>
        {failed && <button type="button" onClick={onRetry} style={{ padding: '12px 16px', marginRight: 8 }}>다시 시도</button>}
        {canLogout && <button type="button" onClick={onLogout} style={{ padding: '12px 16px' }}>로그아웃</button>}
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDocument, setUserDocument] = useState<UserDocumentState | null>(null);
  const generationRef = useRef(0);
  const hadAuthenticatedUserRef = useRef(false);
  const [generation, setGeneration] = useState(0);
  const [isRecoveringAccount, setIsRecoveringAccount] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);

  useEffect(() => {
    let active = true;
    const initAuth = async () => {
      try {
        // 1. Redirect 로그인 체크 (Google 등)
        const result = await getRedirectResult(auth);
        if (active && result?.user && auth.currentUser?.uid === result.user.uid) {
          markLoginTrace('T3_firebase_sign_in_complete');
          rememberLoginProvider(result.user.uid, 'google');
          return;
        }

        // Older builds stored Kakao/Naver users in localStorage without a
        // Firebase Auth session. That makes Firestore requests fail rules.
        clearLegacySocialUserCache();

        // 2. Firebase 유저는 onAuthStateChanged가 loading=false 담당
        //    (이 시점에 setLoading(false)를 호출하면 onAuthStateChanged보다
        //     먼저 실행돼 user=null로 로그아웃된 것처럼 보이는 타이밍 버그 발생)
      } catch (error) {
        console.error('Auth init error:', error);
        // 인증 판정은 onAuthStateChanged만 갱신한다. 늦은 redirect 결과로 되돌리지 않는다.
      }
    };

    initAuth();

    // 5. Firebase 상태 변화 감지
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!active) return;
      const hadAuthenticatedUser = hadAuthenticatedUserRef.current;
      // 같은 UID로 재로그인하더라도 이전 세션의 판정을 재사용하지 않는다.
      setGeneration(++generationRef.current);
      setUserDocument(null);
      setIsSavingConsent(false);
      setIsRecoveringAccount(false);
      setSnsThumbnailAuthUser(firebaseUser?.uid || null);
      if (firebaseUser) {
        const accountBindingResult = bindLoginTraceToAccount(firebaseUser.uid);
        hadAuthenticatedUserRef.current = true;
        if (accountBindingResult !== 'account_changed') {
          markLoginTrace('T4_auth_state_settled');
        }
        setUser(mapUser(firebaseUser));
        clearLegacySocialUserCache();
      } else {
        if (hadAuthenticatedUser) endLoginTraceForAuthChange();
        hadAuthenticatedUserRef.current = false;
        clearLegacySocialUserCache();
        setUser(null);
      }
      setLoading(false);
    });

    return () => { active = false; unsubscribe(); };
  }, []);

  // 로그인 시 FCM 토큰 중복 정리
  useEffect(() => {
    if (user?.uid) {
      cleanupDuplicateTokens(user.uid);
    }
  }, [user?.uid]);

  // 서버가 확인한 현재 세션의 사용자 문서만 진입 판정에 사용한다.
  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;
    let active = true;
    const isCurrent = () => active && generationRef.current === generation && auth.currentUser?.uid === uid;
    const fail = () => {
      if (isCurrent()) {
        setUserDocument({ uid, generation, status: 'error' });
        blockLoginTrace('user_doc_error');
      }
    };
    // 캐시만 반환되거나 오프라인인 경우에도 재시도/로그아웃 경로를 제공한다.
    const timeout = window.setTimeout(fail, 15000);
    const userRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(
      userRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (!isCurrent() || snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;
        window.clearTimeout(timeout);
        const data = snap.data();
        const loginProvider = readRememberedLoginProvider(uid) ?? normalizeLoginProvider(data?.loginProvider);
        if (loginProvider) {
          setUser((currentUser) => currentUser?.uid === uid
            ? {
              ...currentUser,
              providerId: loginProvider,
              providerIds: mergeProviderIds(currentUser.providerIds, loginProvider),
            }
            : currentUser);
        }
        const scheduledAtValue = data?.deletionScheduledAt;
        const pendingDeletion = data?.accountStatus === 'pending_deletion'
          ? { scheduledAt: scheduledAtValue instanceof Timestamp ? scheduledAtValue.toDate() : null }
          : null;
        const needsConsent = !data?.consents;
        setUserDocument({
          uid,
          generation,
          status: 'ready',
          pendingDeletion,
          // 기존 사용자 호환: 필수 항목/버전의 새 요건은 별도 정책 결정 후 적용한다.
          needsConsent,
        });
        markLoginTrace('T5_user_doc_ready');
        if (pendingDeletion) {
          blockLoginTrace('pending_deletion');
        } else if (needsConsent) {
          blockLoginTrace('required_consent_missing');
        } else {
          markLoginAccessReady();
        }
      },
      () => {
        window.clearTimeout(timeout);
        fail();
      },
    );

    return () => {
      active = false;
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, [user?.uid, generation]);

  const retryUserDocument = () => {
    setIsSavingConsent(false);
    setIsRecoveringAccount(false);
    setUserDocument(null);
    resumeLoginTrace('user_doc_retry');
    setGeneration(++generationRef.current);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      rememberLoginProvider(userCredential.user.uid, 'password');
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signUp = async (email: string, password: string) => {
    if (auth.currentUser) {
      throw new Error('이미 로그인되어 있습니다. 기존 계정에는 설정에서 이메일 로그인을 추가해 주세요.');
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      try {
        await sendEmailVerification(userCredential.user);
      } catch (verificationError) {
        console.error('Verification email send error:', verificationError);
      }
      rememberLoginProvider(userCredential.user.uid, 'password');
      return { user: mapUser(userCredential.user) };
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const linkEmailPassword = async (email: string, password: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('로그인이 필요합니다.');

    const normalizedEmail = email.trim().toLowerCase();
    const currentEmail = currentUser.email?.trim().toLowerCase();
    if (!currentEmail) {
      throw new Error('현재 계정에 이메일 정보가 없어 연결할 수 없습니다.');
    }
    if (currentEmail.endsWith('@placeholder.local')) {
      throw new Error('현재 소셜 계정의 이메일 정보가 없어 이메일 로그인을 추가할 수 없습니다.');
    }
    if (normalizedEmail !== currentEmail) {
      throw new Error('현재 로그인한 계정의 이메일과 같은 주소만 연결할 수 있습니다.');
    }

    try {
      const credential = EmailAuthProvider.credential(normalizedEmail, password);
      const userCredential = await linkWithCredential(currentUser, credential);
      setUser((currentUser) => {
        const mappedUser = mapUser(userCredential.user);
        const currentProvider = normalizeLoginProvider(currentUser?.providerId);
        if (currentProvider && currentProvider !== 'password') {
          return {
            ...mappedUser,
            providerId: currentProvider,
            providerIds: mergeProviderIds(mappedUser.providerIds, currentProvider),
          };
        }
        return mappedUser;
      });
    } catch (error: any) {
      console.error('Link email/password error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const googleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      if (import.meta.env.DEV) {
        const userCredential = await signInWithPopup(auth, provider);
        rememberLoginProvider(userCredential.user.uid, 'google');
      } else {
        await signInWithRedirect(auth, provider);
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      throw new Error(error.message || 'Google 로그인 실패');
    }
  };

  const kakaoSignIn = async () => {
    try {
      const { loginWithKakao } = await import('../../firebase');
      const kakaoUser = await loginWithKakao();

      if (!kakaoUser || !kakaoUser.uid || !kakaoUser.email) {
        throw new Error('카카오 로그인 정보가 올바르지 않습니다');
      }

      const localUser: LocalUser = {
        uid: kakaoUser.uid,
        email: kakaoUser.email,
        displayName:
          kakaoUser.displayName ||
          kakaoUser.email?.split('@')[0] ||
          'User',
        photoURL: kakaoUser.photoURL || null,
        providerId: 'kakao',
        providerIds: ['kakao'],
        emailVerified: true,
      };

      rememberLoginProvider(kakaoUser.uid, 'kakao');
      if (auth.currentUser?.uid === localUser.uid) setUser(localUser);
    } catch (error: any) {
      console.error('Kakao sign in error:', error);
      throw new Error(error.message || '카카오 로그인 실패');
    }
  };

  const naverSignIn = async () => {
    try {
      const { loginWithNaver } = await import('../../firebase');
      const naverUser = await loginWithNaver();

      if (!naverUser || !naverUser.uid || !naverUser.email) {
        throw new Error('네이버 로그인 정보가 올바르지 않습니다');
      }

      const localUser: LocalUser = {
        uid: naverUser.uid,
        email: naverUser.email,
        displayName:
          naverUser.displayName ||
          naverUser.email?.split('@')[0] ||
          'User',
        photoURL: naverUser.photoURL || null,
        providerId: 'naver',
        providerIds: ['naver'],
        emailVerified: true,
      };

      rememberLoginProvider(naverUser.uid, 'naver');
      if (auth.currentUser?.uid === localUser.uid) setUser(localUser);
    } catch (error: any) {
      console.error('Naver sign in error:', error);
      throw new Error(error.message || '네이버 로그인 실패');
    }
  };

  const signOut = async () => {
    try {
      invalidateSnsThumbnailAuthSession();
      clearLegacySocialUserCache();
      await firebaseSignOut(auth);
      endLoginTraceForAuthChange();
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message || '로그아웃 실패');
    }
  };

  const updateUserProfile = async (updates: { displayName?: string; photoURL?: string }) => {
    if (!auth.currentUser) throw new Error('로그인이 필요합니다.');
    await firebaseUpdateProfile(auth.currentUser, updates);
    setUser(mapUser(auth.currentUser));
  };

  const handleSaveConsents = async (marketing: boolean) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setUser(null);
      return;
    }

    if (currentUser.uid !== user?.uid || generationRef.current !== generation) return;
    const operationGeneration = generationRef.current;
    setIsSavingConsent(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(
        userRef,
        {
          consents: {
            age14: true,
            age19: true,
            terms: true,
            privacy: true,
            overseasTransfer: true,
            marketing,
            agreedAt: serverTimestamp(),
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
          },
        },
        { merge: true },
      );
      // needsConsent 상태는 위 onSnapshot 리스너가 자동으로 갱신한다.
    } catch (error: any) {
      if (generationRef.current !== operationGeneration) return;
      console.error('동의 저장 실패:', error);
      alert(
        error?.code === 'permission-denied'
          ? '로그인 상태 확인이 필요합니다. 로그아웃 후 다시 로그인해 주세요.'
          : '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      if (generationRef.current === operationGeneration) setIsSavingConsent(false);
    }
  };

  const handleRecoverAccount = async () => {
    if (!user || auth.currentUser?.uid !== user.uid || generationRef.current !== generation) return;
    const operationGeneration = generationRef.current;
    setIsRecoveringAccount(true);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const cancelDeletion = httpsCallable(functions, 'cancelAccountDeletion');
      await cancelDeletion({});
      // pendingDeletion 상태는 위 onSnapshot 리스너가 자동으로 갱신한다.
    } catch (error: any) {
      if (generationRef.current !== operationGeneration) return;
      console.error('계정 복구 실패:', error);
      alert('계정 복구에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      if (generationRef.current === operationGeneration) setIsRecoveringAccount(false);
    }
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (error: any) {
      console.error('Send verification email error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const refreshCurrentUser = async () => {
    if (!auth.currentUser) return;
    try {
      await reload(auth.currentUser);
      setUser(mapUser(auth.currentUser));
    } catch (error: any) {
      console.error('Refresh current user error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const handleGateLogout = async () => {
    try {
      await signOut();
    } catch {
      alert('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const currentDocument = user && auth.currentUser?.uid === user.uid
    && userDocument?.uid === user.uid && userDocument.generation === generation
    ? userDocument : null;
  const verifying = loading || Boolean(user && currentDocument?.status !== 'ready');
  const pendingDeletion = currentDocument?.status === 'ready' ? currentDocument.pendingDeletion : null;
  const needsConsent = currentDocument?.status === 'ready' && currentDocument.needsConsent;

  const value = {
    user,
    loading: verifying,
    signIn,
    signUp,
    resetPassword,
    linkEmailPassword,
    googleSignIn,
    kakaoSignIn,
    naverSignIn,
    signOut,
    updateUserProfile,
    sendVerificationEmail,
    refreshCurrentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {verifying ? (
        <AccountVerificationScreen
          failed={currentDocument?.status === 'error'}
          canLogout={Boolean(user)}
          onRetry={retryUserDocument}
          onLogout={handleGateLogout}
        />
      ) : pendingDeletion ? (
        <AccountPendingDeletionScreen
          key={`${user?.uid}:${generation}`}
          scheduledAt={pendingDeletion.scheduledAt}
          isRecovering={isRecoveringAccount}
          onRecover={handleRecoverAccount}
          onLogout={handleGateLogout}
        />
      ) : needsConsent ? (
        <ConsentGateScreen key={`${user?.uid}:${generation}`} isSaving={isSavingConsent} onSave={handleSaveConsents} onLogout={handleGateLogout} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
