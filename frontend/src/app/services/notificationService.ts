import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, updateDoc, getDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';

// Firestore에 저장된 fcmTokens 배열의 중복을 제거하고 저장
export async function cleanupDuplicateTokens(userId: string): Promise<void> {
  try {
    const settingsRef = doc(db, `users/${userId}/settings/settings`);
    const settingsDoc = await getDoc(settingsRef);
    if (!settingsDoc.exists()) return;

    const existingTokens: string[] = settingsDoc.data().fcmTokens || [];
    const uniqueTokens = Array.from(new Set(existingTokens));

    if (uniqueTokens.length === existingTokens.length) return; // 중복 없으면 저장 생략

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
  // 기존 중복 토큰 즉시 정리
  await cleanupDuplicateTokens(userId);

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

      // 2. 이미 등록된 토큰이면 저장 생략 (중복 방지)
      if (existingTokens.includes(token)) {
        console.log('토큰 이미 등록됨, 저장 생략');
        return true;
      }

      // 3. 최대 4개 유지 (오래된 것부터 삭제)
      const newTokens = [...existingTokens, token].slice(-4);

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

// 알림 끔 시 현재 기기 토큰을 fcmTokens 배열에서 제거
export async function removeCurrentToken(userId: string): Promise<void> {
  try {
    const messaging = getMessaging();
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;

    const token = await getToken(messaging, { vapidKey }).catch(() => null);
    if (!token) return;

    const settingsRef = doc(db, `users/${userId}/settings/settings`);
    await updateDoc(settingsRef, {
      fcmTokens: arrayRemove(token),
      updatedAt: new Date().toISOString(),
    });

    console.log('🗑️ 현재 기기 토큰 제거 완료');
  } catch (error) {
    console.error('토큰 제거 실패:', error);
  }
}
