import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, updateDoc, getDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';

const FCM_TOKEN_KEY = 'haru_fcm_token';
const FCM_SW_URL = '/firebase-messaging-sw.js';

// firebase-messaging-sw.js registration을 가져오거나 새로 등록
async function getFcmSwRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    const existing = await navigator.serviceWorker.getRegistration(FCM_SW_URL);
    if (existing) return existing;
    return await navigator.serviceWorker.register(FCM_SW_URL);
  } catch (error) {
    console.error('FCM SW 등록 실패:', error);
    return undefined;
  }
}

// Firestore에 저장된 fcmTokens 배열의 중복을 제거하고 저장
export async function cleanupDuplicateTokens(userId: string): Promise<void> {
  try {
    const settingsRef = doc(db, `users/${userId}/settings/settings`);
    const settingsDoc = await getDoc(settingsRef);
    if (!settingsDoc.exists()) return;

    const existingTokens: string[] = settingsDoc.data().fcmTokens || [];
    const uniqueTokens = Array.from(new Set(existingTokens));

    if (uniqueTokens.length === existingTokens.length) return;

    await setDoc(settingsRef, {
      fcmTokens: uniqueTokens.slice(-4),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`🧹 중복 토큰 정리 완료: ${existingTokens.length}개 → ${uniqueTokens.length}개`);
  } catch (error) {
    console.error('토큰 중복 정리 실패:', error);
  }
}

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('알림 권한이 거부되었습니다.');
      return false;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error('VAPID 키가 설정되지 않았습니다.');
      return false;
    }

    // firebase-messaging-sw.js에 명시적으로 바인딩하여 토큰 생성
    const swRegistration = await getFcmSwRegistration();
    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.log('FCM 토큰 생성 실패');
      return false;
    }

    console.log('FCM 토큰 생성 성공:', token.substring(0, 20) + '...');

    const cachedToken = localStorage.getItem(FCM_TOKEN_KEY);

    const settingsRef = doc(db, `users/${userId}/settings/settings`);
    const settingsDoc = await getDoc(settingsRef);
    const existingTokens: string[] = settingsDoc.exists()
      ? (settingsDoc.data().fcmTokens || [])
      : [];

    if (existingTokens.includes(token)) {
      console.log('토큰 이미 등록됨, 저장 생략');
      localStorage.setItem(FCM_TOKEN_KEY, token);
      return true;
    }

    // 이전 캐시 토큰이 있으면 배열에서 먼저 제거 (기기 토큰 교체 처리)
    let baseTokens = existingTokens;
    if (cachedToken && cachedToken !== token && existingTokens.includes(cachedToken)) {
      baseTokens = existingTokens.filter(t => t !== cachedToken);
      console.log('🔄 기기 이전 토큰 교체:', cachedToken.substring(0, 20) + '...');
    }

    const newTokens = [...baseTokens, token].slice(-4);

    await setDoc(settingsRef, {
      fcmTokens: newTokens,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    localStorage.setItem(FCM_TOKEN_KEY, token);

    console.log(`✅ 토큰 저장 완료! 총 ${newTokens.length}개 기기`);
    return true;
  } catch (error) {
    console.error('알림 권한 요청 실패:', error);
    return false;
  }
}

export async function updateNotificationSettings(
  userId: string,
  settings: {
    notificationEnabled?: boolean;
    notificationTime?: string;
  }
): Promise<void> {
  const settingsRef = doc(db, `users/${userId}/settings/settings`);
  await updateDoc(settingsRef, {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}

// 알림 끔 시 현재 기기 토큰을 fcmTokens 배열에서 제거
export async function removeCurrentToken(userId: string): Promise<void> {
  try {
    const cachedToken = localStorage.getItem(FCM_TOKEN_KEY);
    if (!cachedToken) {
      console.log('캐시된 토큰 없음, 제거 생략');
      return;
    }

    const settingsRef = doc(db, `users/${userId}/settings/settings`);
    await updateDoc(settingsRef, {
      fcmTokens: arrayRemove(cachedToken),
      updatedAt: new Date().toISOString(),
    });

    localStorage.removeItem(FCM_TOKEN_KEY);
    console.log('🗑️ 현재 기기 토큰 제거 완료');
  } catch (error) {
    console.error('토큰 제거 실패:', error);
  }
}
