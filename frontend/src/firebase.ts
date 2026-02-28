import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

declare global {
  interface Window {
    Kakao: any;
  }
}

let kakaoInitialized = false;

export function initKakao() {
  if (kakaoInitialized) return;
  if (window.Kakao && !window.Kakao.isInitialized()) {
    const kakaoKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;
    window.Kakao.init(kakaoKey);
    kakaoInitialized = true;
    console.log('✅ 카카오 SDK 초기화 완료');
  }
}

export async function loginWithKakao() {
  return new Promise((resolve, reject) => {
    initKakao();
    
    window.Kakao.Auth.login({
      success: function(authObj: any) {
        console.log('✅ 카카오 로그인 성공:', authObj);
        
        window.Kakao.API.request({
          url: '/v2/user/me',
          success: function(response: any) {
            console.log('✅ 카카오 사용자 정보:', response);
            
            const user = {
              uid: `kakao_${response.id}`,
              email: response.kakao_account?.email || '',
              displayName: response.kakao_account?.profile?.nickname || '카카오 사용자',
              photoURL: response.kakao_account?.profile?.profile_image_url || null,
              providerId: 'kakao',
            };
            
            resolve(user);
          },
          fail: function(error: any) {
            console.error('❌ 사용자 정보 가져오기 실패:', error);
            reject(error);
          }
        });
      },
      fail: function(error: any) {
        console.error('❌ 카카오 로그인 실패:', error);
        reject(error);
      }
    });
  });
}

export async function logoutKakao() {
  if (window.Kakao?.Auth?.getAccessToken) {
    const token = window.Kakao.Auth.getAccessToken();
    if (token) {
      window.Kakao.Auth.setAccessToken(null);
      console.log('✅ 카카오 로그아웃 완료');
    }
  }
}

export async function logout() {
  await logoutKakao();
  await signOut(auth);
}
