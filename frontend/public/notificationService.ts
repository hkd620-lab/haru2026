import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  try {
    // 알림 권한 요청
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('알림 권한이 거부되었습니다.');
      return false;
    }

    // FCM 토큰 생성
    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (!token) {
      console.error('FCM 토큰 생성 실패');
      return false;
    }

    console.log('FCM 토큰:', token);

    // Firestore에 토큰 저장
    const settingsRef = doc(db, `users/${userId}/settings`);
    await setDoc(settingsRef, {
      fcmToken: token,
      notificationEnabled: true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('알림 권한 요청 실패:', error);
    return false;
  }
}

export function setupForegroundNotifications() {
  try {
    const messaging = getMessaging();
    
    onMessage(messaging, (payload) => {
      console.log('포그라운드 메시지 수신:', payload);
      
      const notificationTitle = payload.notification?.title || 'HARU2026';
      const notificationOptions = {
        body: payload.notification?.body || '오늘의 이야기를 남겨주세요 📖',
        icon: '/icon-192.png',
      };

      if (Notification.permission === 'granted') {
        new Notification(notificationTitle, notificationOptions);
      }
    });
  } catch (error) {
    console.error('포그라운드 알림 설정 실패:', error);
  }
}

export async function updateNotificationSettings(
  userId: string,
  settings: {
    notificationEnabled?: boolean;
    notificationTime?: string;
  }
): Promise<void> {
  try {
    const settingsRef = doc(db, `users/${userId}/settings`);
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error('알림 설정 업데이트 실패:', error);
    throw error;
  }
}
