import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, updateDoc, getDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  createForegroundListenerInstaller,
  registerDeviceForPush,
  showForegroundNotification,
  type DevicePermission,
  type DevicePushEnvironment,
  type PushRegistrationResult,
} from './pushDevice';
import { getTokenWithMatchingSubscription, isValidVapidPublicKey } from './pushSubscriptionKey';
import { updateFcmRegistrationAndWaitActive } from './fcmRegistrationUpdate';

const FCM_TOKEN_KEY = 'haru_fcm_token';
const FCM_SW_URL = '/firebase-messaging-sw.js';

// firebase-messaging-sw.js registration을 가져오거나 새로 등록
// getRegistration(url)은 해당 URL을 제어하는 SW(= workbox SW)를 반환하므로
// 반드시 scriptURL로 직접 찾아야 함
async function getFcmSwRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    // 등록된 모든 SW 중 firebase-messaging-sw.js 를 scriptURL로 찾기
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existing = registrations.find(r =>
      (r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? '')
        .includes('firebase-messaging-sw.js')
    );
    if (existing) return existing;
    // 없으면 Firebase 표준 scope로 등록 (workbox SW scope '/'와 충돌 방지)
    return await navigator.serviceWorker.register(FCM_SW_URL, { scope: '/firebase-cloud-messaging-push-scope' });
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

// 이 기기의 알림 권한 상태. Notification API가 없으면(아이폰 Safari 탭 등) 'unsupported'.
function getDevicePermission(): DevicePermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function requestDevicePermission(): Promise<DevicePermission> {
  return new Promise((resolve, reject) => {
    try {
      // 구형 Safari는 콜백 방식만 지원한다.
      const result = Notification.requestPermission((permission) => resolve(permission));
      if (result && typeof result.then === 'function') result.then(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

function isIOSDevice(): boolean {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneDisplay(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

// 설정 화면 표시용: 이 기기의 지원·권한·설치 상태(Firestore를 읽지 않는다).
export async function getThisDevicePushEnvironment(): Promise<DevicePushEnvironment> {
  let supported = false;
  try {
    supported = await isSupported();
  } catch {
    supported = false;
  }
  return {
    supported,
    permission: getDevicePermission(),
    isIOS: isIOSDevice(),
    standalone: isStandaloneDisplay(),
  };
}

// 이 기기를 계정의 알림 기기로 등록한다. 권한·토큰 발급·저장이 모두 끝나야 ok: true.
// 버튼 클릭 핸들러에서 곧바로 호출해야 iOS 권한 창이 뜬다.
export function registerThisDevice(userId: string): Promise<PushRegistrationResult> {
  return registerDeviceForPush<ServiceWorkerRegistration>({
    getPermission: getDevicePermission,
    requestPermission: requestDevicePermission,
    isSupported,
    // 65바이트 공개키가 아니면 SW 등록·구독 변경 전에 설정 오류로 멈춘다.
    getVapidKey: () => {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      return isValidVapidPublicKey(vapidKey) ? vapidKey : undefined;
    },
    // firebase-messaging-sw.js에 명시적으로 바인딩하여 토큰 생성
    // 등록 경로에서만 FCM SW를 update()하고 activated까지(제한시간) 기다린다. 실패하면 token 실패로 멈춘다.
    getSwRegistration: async () => updateFcmRegistrationAndWaitActive(await getFcmSwRegistration()),
    // 구독 공개키를 설정된 VAPID 키와 맞춘 뒤에만 토큰을 받는다(registration 없으면 SDK 기본 SW로 넘기지 않음).
    getToken: (vapidKey, serviceWorkerRegistration) => getTokenWithMatchingSubscription(
      vapidKey,
      serviceWorkerRegistration,
      (key, registration) => getToken(getMessaging(), { vapidKey: key, serviceWorkerRegistration: registration }),
    ),
    saveToken: (token) => saveDeviceToken(userId, token),
    cacheToken: (token) => localStorage.setItem(FCM_TOKEN_KEY, token),
    onRegistered: () => { void installForegroundListener(); },
  });
}

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  const result = await registerThisDevice(userId);
  if (!result.ok) console.log(`알림 기기 등록 실패: ${result.reason}`);
  return result.ok;
}

// 토큰을 계정 settings의 fcmTokens에 저장한다(기존 저장 경로·최대 5개 규칙 유지). 실패하면 예외를 던진다.
async function saveDeviceToken(userId: string, token: string): Promise<void> {
  const settingsRef = doc(db, `users/${userId}/settings/settings`);
  const settingsDoc = await getDoc(settingsRef);
  const existingTokens: string[] = settingsDoc.exists()
    ? (settingsDoc.data().fcmTokens || [])
    : [];

  // 중복 완전 제거
  const uniqueTokens = Array.from(new Set([...existingTokens, token]));

  // 최대 5개 유지
  const finalTokens = uniqueTokens.slice(-5);

  // 시간대가 아직 없는 사용자(이 기능 전 가입)는 토큰 등록 때 기기 시간대를 채운다. 이미 있으면 덮어쓰지 않는다.
  const deviceTimeZone = getDeviceTimeZone();
  const hasTimeZone = settingsDoc.exists() && typeof settingsDoc.data().notificationTimeZone === 'string';
  await setDoc(settingsRef, {
    fcmTokens: finalTokens,
    ...(deviceTimeZone && !hasTimeZone ? { notificationTimeZone: deviceTimeZone } : {}),
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  console.log(`✅ 토큰 저장 완료! 총 ${finalTokens.length}개 기기`);
}

// 기기 시간대(IANA, 예: 'Asia/Seoul'). 기록 알림이 이 시간대의 시각·날짜로 판정된다(Functions scheduledNotificationCore).
export function getDeviceTimeZone(): string | undefined {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === 'string' && timeZone ? timeZone : undefined;
  } catch {
    return undefined;
  }
}

// 알림을 켜 둔 기존 사용자에게 시간대가 없으면 기기 시간대로 한 번 채운다(설정 화면을 열 때). 이미 있으면 바꾸지 않는다.
export async function backfillNotificationTimeZone(userId: string, settings: Record<string, unknown>): Promise<void> {
  if (settings.notificationEnabled === false || typeof settings.notificationTimeZone === 'string') return;
  const notificationTimeZone = getDeviceTimeZone();
  if (!notificationTimeZone) return;
  try {
    await updateDoc(doc(db, `users/${userId}/settings/settings`), { notificationTimeZone });
  } catch (error) {
    console.error('알림 시간대 보완 실패:', error);
  }
}

export async function updateNotificationSettings(
  userId: string,
  settings: {
    notificationEnabled?: boolean;
    notificationTime?: string;
    notificationTimeZone?: string;
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

// 포그라운드 메시지 수신 리스너 (앱이 켜져 있을 때). onMessage는 한 번만 등록한다.
// iOS 설치 PWA는 new Notification을 지원하지 않아 서비스워커 showNotification으로 표시한다.
const installForegroundListener = createForegroundListenerInstaller({
  isSupported,
  subscribe: (handler) => { onMessage(getMessaging(), handler); },
  show: (payload) => showForegroundNotification(payload, {
    getPermission: getDevicePermission,
    getRegistration: getFcmSwRegistration,
    createWindowNotification: (title, options) => { new Notification(title, options); },
  }),
});

export function setupForegroundMessageListener(): void {
  void installForegroundListener();
}

