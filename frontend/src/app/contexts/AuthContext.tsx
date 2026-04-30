import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
}

interface AuthContextType {
  user: LocalUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ user: LocalUser | null }>;
  googleSignIn: () => Promise<void>;
  kakaoSignIn: () => Promise<void>;
  naverSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const KAKAO_USER_KEY = 'haru_kakao_user';
const NAVER_USER_KEY = 'haru_naver_user';

const mapUser = (user: FirebaseUser): LocalUser => ({
  uid: user.uid,
  email: user.email ?? null,
  displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
  photoURL: user.photoURL ?? null,
  providerId: user.providerData[0]?.providerId ?? 'password',
});

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

        // 2. Kakao 체크
        const savedKakao = localStorage.getItem(KAKAO_USER_KEY);
        if (savedKakao) {
          try {
            setUser(JSON.parse(savedKakao));
            setLoading(false);
            return;
          } catch {
            localStorage.removeItem(KAKAO_USER_KEY);
          }
        }

        // 3. Naver 체크
        const savedNaver = localStorage.getItem(NAVER_USER_KEY);
        if (savedNaver) {
          try {
            setUser(JSON.parse(savedNaver));
            setLoading(false);
            return;
          } catch {
            localStorage.removeItem(NAVER_USER_KEY);
          }
        }

        // 4. Firebase 유저는 onAuthStateChanged가 loading=false 담당
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
        localStorage.removeItem(KAKAO_USER_KEY);
        localStorage.removeItem(NAVER_USER_KEY);
      } else {
        const savedKakao = localStorage.getItem(KAKAO_USER_KEY);
        const savedNaver = localStorage.getItem(NAVER_USER_KEY);
        if (!savedKakao && !savedNaver) {
          setUser(null);
        }
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
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || '로그인 실패');
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { user: mapUser(userCredential.user) };
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || '회원가입 실패');
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

      localStorage.setItem(KAKAO_USER_KEY, JSON.stringify(localUser));
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

      localStorage.setItem(NAVER_USER_KEY, JSON.stringify(localUser));
      setUser(localUser);
    } catch (error: any) {
      console.error('Naver sign in error:', error);
      throw new Error(error.message || '네이버 로그인 실패');
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem(KAKAO_USER_KEY);
      localStorage.removeItem(NAVER_USER_KEY);
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