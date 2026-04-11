import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const db = admin.firestore();

export const sendBroadcastNotification = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
      // 관리자 확인 (허 교장님 UID만 허용)
      const adminUid = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8'; // 나중에 실제 UID로 교체
      
      if (!request.auth || request.auth.uid !== adminUid) {
        throw new HttpsError('permission-denied', '관리자만 사용할 수 있습니다.');
      }

      const { message } = request.data;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new HttpsError('invalid-argument', '메시지를 입력해주세요.');
      }

      console.log(`📢 전체 알림 발송 시작: "${message}"`);

      // 모든 사용자의 FCM 토큰 가져오기
      const settingsSnapshot = await db.collectionGroup('settings').get();

      const tokens: string[] = [];
      let userCount = 0;

      for (const doc of settingsSnapshot.docs) {
        const data = doc.data();
        if (data.fcmTokens && data.fcmTokens.length > 0 && data.notificationEnabled) {
          tokens.push(...data.fcmTokens);
          userCount++;
        }
      }

      if (tokens.length === 0) {
        console.log('알림을 받을 사용자가 없습니다.');
        return { success: true, sentCount: 0, message: '알림을 받을 사용자가 없습니다.' };
      }

      // 배치로 알림 발송 (최대 500개씩)
      let sentCount = 0;
      const batchSize = 500;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);

        const response = await admin.messaging().sendEachForMulticast({
          tokens: batch,
          notification: {
            title: 'HARU 공지 📢',
            body: message,
          },
          webpush: {
            fcmOptions: {
              link: 'https://haru2026-8abb8.web.app',
            },
          },
        });

        sentCount += response.successCount;

        // 실패한 토큰 정리
        if (response.failureCount > 0) {
          console.log(`실패한 토큰 ${response.failureCount}개 발견`);
        }
      }

      console.log(`✅ 전체 알림 발송 완료: ${sentCount}/${userCount}명`);

      return {
        success: true,
        sentCount,
        totalUsers: userCount,
        message: `${sentCount}명에게 알림을 보냈습니다!`,
      };

    } catch (error: any) {
      console.error('전체 알림 발송 실패:', error);
      throw new HttpsError('internal', '알림 발송에 실패했습니다.');
    }
  }
);
