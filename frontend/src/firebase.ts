import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { initializeFirestore, memoryLocalCache, getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

// 🔹 Firebase 설정
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 🔹 Firebase 초기화
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});
export const functions = getFunctions(app, 'asia-northeast3');
export const storage = getStorage(app);

// 🔔 Firebase Messaging 인스턴스 — WKWebView 등 미지원 환경에서 getMessaging()이 예외를 던지는 것을 방지
// isSupported() 확인 후에만 초기화하고, 그 전까지는 null 유지
export let messaging: ReturnType<typeof getMessaging> | null = null;
isSupported().then((supported) => {
  if (supported) messaging = getMessaging(app);
}).catch(() => {
  // 지원하지 않는 환경(iOS WKWebView 등)에서는 null 그대로 유지
});

const aiLibraryConfig = {
  apiKey: import.meta.env.VITE_AI_LIBRARY_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_AI_LIBRARY_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_AI_LIBRARY_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_AI_LIBRARY_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_AI_LIBRARY_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_AI_LIBRARY_FIREBASE_APP_ID,
};
const aiLibraryApp = getApps().find(a => a.name === 'aiLibrary')
  || initializeApp(aiLibraryConfig, 'aiLibrary');
export const aiLibraryDb = getFirestore(aiLibraryApp);

const provider = new GoogleAuthProvider();

// 🔹 Google 로그인 함수
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}
