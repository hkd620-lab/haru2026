// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Firebase 설정은 메인 앱에서 postMessage로 전달받거나,
// 서비스 워커 등록 시 쿼리 파라미터로 전달받습니다.
// 여기서는 self.__WB_DISABLE_DEV_LOGS 패턴을 사용합니다.

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const firebaseConfig = event.data.config;
    initFirebase(firebaseConfig);
  }
});

function initFirebase(firebaseConfig) {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  // 백그라운드 메시지 처리
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);

    const notificationTitle = payload.notification?.title || '하루 📖';
    const notificationOptions = {
      body: payload.notification?.body || '오늘의 이야기를 남겨주세요 📖',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'haru-notification',
      renotify: true,
      data: {
        url: payload.data?.url || '/',
      },
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// 알림 클릭 시 앱으로 포커스 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열려 있는 탭이 있으면 포커스
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // 없으면 새 탭 열기
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
