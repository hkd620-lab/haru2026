import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
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

    const token = await getToken(messaging, {
      vapidKey: vapidKey
    });

    if (token) {
      console.log('FCM 토큰 생성 성공:', token.substring(0, 20) + '...');

      const settingsRef = doc(db, `users/${userId}/settings/settings`);

      // 1. 기존 토큰 배열 가져오기
      const settingsDoc = await getDoc(settingsRef);
      const existingTokens: string[] = settingsDoc.exists()
        ? (settingsDoc.data().fcmTokens || [])
        : [];

      // 2. 중복 토큰이면 그냥 종료
      if (existingTokens.includes(token)) {
        console.log('FCM 토큰 이미 존재 — 저장 생략');
        return true;
      }

      // 3. 맨 앞에 새 토큰 추가
      const newTokens = [token, ...existingTokens];

      // 4. 5개 이상이면 가장 오래된(마지막) 토큰 제거 → 최대 4개 유지
      if (newTokens.length >= 5) {
        newTokens.pop();
      }

      await setDoc(settingsRef, {
        fcmTokens: newTokens,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log(`✅ 토큰 저장 완료! 총 ${newTokens.length}개 기기`);
      
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
