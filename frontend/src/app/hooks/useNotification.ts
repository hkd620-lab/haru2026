import { useEffect, useState } from 'react';

export function useNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  // 브라우저 지원 확인
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // 알림 권한 요청
  const requestPermission = async () => {
    if (!isSupported) {
      console.warn('이 브라우저는 알림을 지원하지 않습니다');
      return false;
    }

    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        return result === 'granted';
      } catch (error) {
        console.error('알림 권한 요청 실패:', error);
        return false;
      }
    }

    return false;
  };

  // 알림 전송
  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.warn('알림을 보낼 수 없습니다. 권한을 확인하세요.');
      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            ...options,
          });
        });
      } else {
        new Notification(title, {
          icon: '/icons/icon-192.png',
          ...options,
        });
      }
    } catch (error) {
      console.error('알림 전송 실패:', error);
    }
  };

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
  };
}
