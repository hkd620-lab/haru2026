import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const db = admin.firestore();

export const scheduledPushNotification = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
  },
  async (event) => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      console.log(`알림 스케줄러 실행: ${currentHour}:${currentMinute}`);

      const settingsSnapshot = await db.collectionGroup('settings').get();

      let sentCount = 0;
      let skipCount = 0;

      for (const settingsDoc of settingsSnapshot.docs) {
        const data = settingsDoc.data();
        const userId = settingsDoc.ref.parent.parent?.id;

        if (!userId) continue;

        const notificationEnabled = data.notificationEnabled || false;
        const notificationTime = data.notificationTime || '21:00';
        const fcmToken = data.fcmToken;

        if (!notificationEnabled || !fcmToken) {
          skipCount++;
          continue;
        }

        const [targetHour, targetMinute] = notificationTime.split(':').map(Number);

        if (currentHour !== targetHour || currentMinute !== 0) {
          skipCount++;
          continue;
        }

        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const recordDoc = await db.collection(`users/${userId}/records`).doc(dateStr).get();

        if (recordDoc.exists) {
          skipCount++;
          continue;
        }

        try {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: 'HARU 📖',
              body: '오늘의 이야기를 남겨주세요',
            },
            webpush: {
              fcmOptions: {
                link: 'https://haru2026-8abb8.web.app/record',
              },
            },
          });

          sentCount++;
          console.log(`사용자 ${userId}: 알림 발송 성공`);
        } catch (error: any) {
          console.error(`사용자 ${userId}: 알림 발송 실패`, error);

          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            await settingsDoc.ref.update({
              fcmToken: admin.firestore.FieldValue.delete(),
            });
            console.log(`사용자 ${userId}: 만료된 토큰 삭제됨`);
          }
        }
      }

      console.log(`알림 발송 완료 - 발송: ${sentCount}건, 생략: ${skipCount}건`);
    } catch (error) {
      console.error('알림 스케줄러 오류:', error);
    }
  }
);
