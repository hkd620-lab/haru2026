import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export interface NotificationSettings {
  notificationEnabled: boolean;
  notificationTime: string; // HH:mm 형식, 예: "21:00"
  fcmToken?: string;
}

/**
 * FCM 토큰을 생성하고 Firestore에 저장합니다.
 */
async function getFCMToken(): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('이 브라우저는 FCM을 지원하지 않습니다.');
      return null;
    }

    if (!VAPID_KEY) {
      console.error('VITE_FIREBASE_VAPID_KEY 환경변수가 설정되지 않았습니다.');
      return null;
    }

    // 서비스 워커 등록
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Firebase 설정을 서비스 워커로 전달
    const { getApp } = await import('firebase/app');
    const app = getApp();
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    if (registration.active) {
      registration.active.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (error) {
    console.error('FCM 토큰 생성 실패:', error);
    return null;
  }
}

/**
 * 브라우저 알림 권한을 요청합니다.
 * @returns 'granted' | 'denied' | 'default'
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('이 브라우저는 알림을 지원하지 않습니다.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('알림 권한 요청 실패:', error);
    return 'denied';
  }
}

/**
 * 알림 설정을 Firestore에 저장하고 FCM 토큰을 등록합니다.
 */
export async function saveNotificationSettings(
  uid: string,
  settings: NotificationSettings
): Promise<void> {
  try {
    let fcmToken = settings.fcmToken;

    if (settings.notificationEnabled) {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        throw new Error('알림 권한이 거부되었습니다.');
      }

      const token = await getFCMToken();
      if (token) {
        fcmToken = token;
      }
    }

    const settingsRef = doc(db, 'users', uid, 'settings', 'notification');
    await setDoc(
      settingsRef,
      {
        notificationEnabled: settings.notificationEnabled,
        notificationTime: settings.notificationTime,
        ...(fcmToken ? { fcmToken } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('알림 설정 저장 실패:', error);
    throw error;
  }
}

/**
 * Firestore에서 알림 설정을 불러옵니다.
 */
export async function loadNotificationSettings(uid: string): Promise<NotificationSettings> {
  try {
    const settingsRef = doc(db, 'users', uid, 'settings', 'notification');
    const snap = await getDoc(settingsRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        notificationEnabled: data.notificationEnabled ?? false,
        notificationTime: data.notificationTime ?? '21:00',
        fcmToken: data.fcmToken,
      };
    }

    return { notificationEnabled: false, notificationTime: '21:00' };
  } catch (error) {
    console.error('알림 설정 불러오기 실패:', error);
    return { notificationEnabled: false, notificationTime: '21:00' };
  }
}
