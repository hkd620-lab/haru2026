import type { ReactNode } from 'react';
import { user } from './fixture';

// src/app/contexts/AuthContext 대체 — 로그인된 가상사용자를 그대로 돌려준다.
// (소셜 로그인 화면·토큰 교환은 이 하네스의 검증 범위가 아니다.)
const noop = async () => {};

const value = {
  user,
  loading: false,
  signIn: noop,
  signUp: async () => ({ user }),
  resetPassword: noop,
  linkEmailPassword: noop,
  googleSignIn: noop,
  kakaoSignIn: noop,
  naverSignIn: noop,
  signOut: noop,
  updateUserProfile: noop,
  sendVerificationEmail: noop,
  refreshCurrentUser: noop,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return value;
}
