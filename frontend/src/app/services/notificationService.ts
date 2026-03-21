import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('알림 권한이 거부되었습니다.');
      return false;
    }

    const messaging = getMessaging();
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      console.error('VAPID 키가 설정되지 않았습니다.');
      return false;
    }

    console.log('FCM 토큰 생성 시작...');

    // 최신 Firebase SDK - 문자열 직접 전달
    const token = await getToken(messaging, {
      vapidKey: vapidKey
    });

    if (token) {
      console.log('FCM 토큰 생성 성공:', token.substring(0, 20) + '...');
      
      const settingsRef = doc(db, `users/${userId}/settings/settings`);
      await setDoc(settingsRef, {
        fcmToken: token,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      return true;
    } else {
      console.log('FCM 토큰 생성 실패');
      return false;
    }
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
