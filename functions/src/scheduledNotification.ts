import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { getNotificationClocks, isNotificationDue, resolveNotificationTimeZone } from './scheduledNotificationCore';

export const scheduledPushNotification = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
    memory: '512MiB',
  },
  async (event) => {
    // 알림 시각·'오늘'은 사용자 시간대 기준(실행 환경 기본 시간대는 UTC). 사용자마다 아래에서 계산한다.
    const now = new Date();

    console.log(`알림 스케줄러 실행: ${now.toISOString()}`);

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

      const { clock, hourBefore } = getNotificationClocks(now, resolveNotificationTimeZone(settings.notificationTimeZone));
      if (!isNotificationDue(settings.notificationTime, clock, hourBefore)) {
        skippedCount++;
        continue;
      }

      // 기록 문서 ID는 {date}_{timestamp} 형식도 있으므로 ID가 아니라 date 필드로 오늘 기록을 찾는다.
      const todayRecords = await db
        .collection('users')
        .doc(userId)
        .collection('records')
        .where('date', '==', clock.dateKey)
        .limit(1)
        .get();

      if (!todayRecords.empty) {
        skippedCount++;
        continue;
      }

      const fcmTokens = settings.fcmTokens || [];

      if (fcmTokens.length > 0) {
        const expiredTokens: string[] = [];
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
          } catch (error: any) {
            const reason = String(error);
            console.error(`토큰 전송 실패 (${token.substring(0, 20)}...):`, error);
            if (reason.includes('NotRegistered') || reason.includes('registration-token-not-registered')) {
              expiredTokens.push(token);
            }
          }
        }
        if (expiredTokens.length > 0) {
          const { FieldValue } = await import('firebase-admin/firestore');
          const settingsRef = db.collection('users').doc(userId).collection('settings').doc('settings');
          await settingsRef.update({
            fcmTokens: FieldValue.arrayRemove(...expiredTokens),
          });
          console.log(`🧹 [${userId}] 만료 토큰 자동 삭제: ${expiredTokens.length}개`);
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`알림 발송 완료 - 발송: ${sentCount}건, 생략: ${skippedCount}건`);
  }
);
