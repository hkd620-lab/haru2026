import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../config/firebase';

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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const KAKAO_USER_KEY = 'haru_kakao_user';

const mapUser = (user: FirebaseUser): LocalUser => ({
  uid: user.uid,
  email: user.email ?? null,
  displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
  photoURL: user.photoURL ?? null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setUser(mapUser(result.user));
        }
      } catch (error) {
        console.error('Redirect error:', error);
      }
    };
    
    checkRedirect();

    // 카카오 사용자 체크
    const checkKakaoUser = () => {
      const savedUser = localStorage.getItem(KAKAO_USER_KEY);
      if (savedUser) {
        try {
          const kakaoUser = JSON.parse(savedUser);
          setUser(kakaoUser);
          console.log('✅ 저장된 카카오 사용자 복원:', kakaoUser);
        } catch (e) {
          console.error('카카오 사용자 복원 실패:', e);
          localStorage.removeItem(KAKAO_USER_KEY);
        }
      }
    };

    checkKakaoUser();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(mapUser(firebaseUser));
        localStorage.removeItem(KAKAO_USER_KEY);
      } else {
        const savedKakaoUser = localStorage.getItem(KAKAO_USER_KEY);
        if (!savedKakaoUser) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      const localUser = mapUser(userCredential.user);
      return { user: localUser };
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || '회원가입 실패');
    }
  };

  const googleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error('Google sign in error:', error);
      throw new Error(error.message || 'Google 로그인 실패');
    }
  };

  const kakaoSignIn = async () => {
    try {
      const { loginWithKakao } = await import('../../firebase');
      const kakaoUser = await loginWithKakao();
      
      localStorage.setItem(KAKAO_USER_KEY, JSON.stringify(kakaoUser));
      setUser(kakaoUser as LocalUser);
      
      console.log('✅ 카카오 로그인 완료, 사용자 저장:', kakaoUser);
    } catch (error: any) {
      console.error('Kakao sign in error:', error);
      throw new Error(error.message || '카카오 로그인 실패');
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem(KAKAO_USER_KEY);
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message || '로그아웃 실패');
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    googleSignIn,
    kakaoSignIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
