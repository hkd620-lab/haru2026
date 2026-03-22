import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const scheduledPushNotification = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
  },
  async (event) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    console.log(`알림 스케줄러 실행: ${currentHour}:${currentMinute}`);

    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();

    let sentCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      const settingsDoc = await db
        .collection('users')
        .doc(userId)
        .collection('settings')
        .doc('settings')
        .get();

      if (!settingsDoc.exists) {
        skippedCount++;
        continue;
      }

      const settings = settingsDoc.data();

      if (!settings || !settings.notificationEnabled) {
        skippedCount++;
        continue;
      }

      const notificationTime = settings.notificationTime || '21:00';
      const [targetHour, targetMinute] = notificationTime.split(':').map(Number);

      if (currentHour !== targetHour || currentMinute !== 0) {
        skippedCount++;
        continue;
      }

      const today = now.toISOString().split('T')[0];

      const recordDoc = await db
        .collection('users')
        .doc(userId)
        .collection('records')
        .doc(today)
        .get();

      if (recordDoc.exists) {
        skippedCount++;
        continue;
      }

      const fcmTokens = settings.fcmTokens || [];

      if (fcmTokens.length > 0) {
        for (const token of fcmTokens) {
          try {
            await admin.messaging().send({
              token: token,
              notification: {
                title: '📝 HARU 기록 알림',
                body: '오늘의 하루를 기록해보세요!',
              },
            });
            sentCount++;
          } catch (error) {
            console.error(`토큰 전송 실패 (${token.substring(0, 20)}...):`, error);
          }
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`알림 발송 완료 - 발송: ${sentCount}건, 생략: ${skippedCount}건`);
  }
);
