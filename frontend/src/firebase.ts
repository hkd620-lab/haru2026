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

// 🔔 Firebase Messaging 인스턴스 (SW 등록은 notificationService에서 명시적으로 처리)
export const messaging = getMessaging(app);

const aiLibraryConfig = {
  apiKey: "AIzaSyBzd4_gQi3fOsEAFTWEa1hAoAEhW7yCn7A",
  authDomain: "my-ai-library-74805.firebaseapp.com",
  projectId: "my-ai-library-74805",
  storageBucket: "my-ai-library-74805.firebasestorage.app",
  messagingSenderId: "1037388320702",
  appId: "1:1037388320702:web:40a0c903b8f1eb2e1273ef",
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