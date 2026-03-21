// Firebase Cloud Messaging 서비스 워커
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase 설정 (firebase.ts와 동일하게)
const firebaseConfig = {
  apiKey: "AIzaSyDYlku7iBNAWTKqOyV2S1xUSlYK_jRo2Q8",
  authDomain: "haru2026-8abb8.firebaseapp.com",
  projectId: "haru2026-8abb8",
  storageBucket: "haru2026-8abb8.firebasestorage.app",
  messagingSenderId: "398138267500",
  appId: "1:398138267500:web:24f2f7c5d04b4e62dd9652",
  measurementId: "G-MHDVJ2RJM6"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// 백그라운드 메시지 처리
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload);

  const notificationTitle = payload.notification?.title || 'HARU2026';
  const notificationOptions = {
    body: payload.notification?.body || '오늘의 이야기를 남겨주세요 📖',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'haru-notification',
    requireInteraction: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] 알림 클릭:', event);
  event.notification.close();

  event.waitUntil(
    clients.openWindow('https://haru2026-8abb8.web.app/record')
  );
});
