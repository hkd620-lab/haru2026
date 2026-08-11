import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { cleanupDuplicateTokens } from '../services/notificationService';

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId?: string;
  providerIds?: string[];
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const KAKAO_USER_KEY = 'haru_kakao_user';
const NAVER_USER_KEY = 'haru_naver_user';

function clearLegacySocialUserCache() {
  localStorage.removeItem(KAKAO_USER_KEY);
  localStorage.removeItem(NAVER_USER_KEY);
}

const mapUser = (user: FirebaseUser): LocalUser => ({
  uid: user.uid,
  email: user.email ?? null,
  displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
  photoURL: user.photoURL ?? null,
  providerId: user.providerData[0]?.providerId ?? 'custom',
  providerIds: user.providerData.map((provider) => provider.providerId),
});

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Redirect 로그인 체크 (Google 등)
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setUser(mapUser(result.user));
          setLoading(false);
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
        setLoading(false);
      }
    };

    initAuth();

    // 5. Firebase 상태 변화 감지
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(mapUser(firebaseUser));
        clearLegacySocialUserCache();
      } else {
        clearLegacySocialUserCache();
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 로그인 시 FCM 토큰 중복 정리
  useEffect(() => {
    if (user?.uid) {
      cleanupDuplicateTokens(user.uid);
    }
  }, [user?.uid]);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
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
      setUser(mapUser(userCredential.user));
    } catch (error: any) {
      console.error('Link email/password error:', error);
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const googleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      if (import.meta.env.DEV) {
        await signInWithPopup(auth, provider);
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
      };

      setUser(localUser);
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
      };

      setUser(localUser);
    } catch (error: any) {
      console.error('Naver sign in error:', error);
      throw new Error(error.message || '네이버 로그인 실패');
    }
  };

  const signOut = async () => {
    try {
      clearLegacySocialUserCache();
      await firebaseSignOut(auth);
      setUser(null);
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

  const value = {
    user,
    loading,
    signIn,
    signUp,
    resetPassword,
    linkEmailPassword,
    googleSignIn,
    kakaoSignIn,
    naverSignIn,
    signOut,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
