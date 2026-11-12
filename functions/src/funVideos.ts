import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

function hasCurrentSubscription(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data || !['basic', 'premium'].includes(data.plan) || !['active', 'cancelled'].includes(data.status)) return false;
  const endTime = typeof data.endDate === 'string'
    ? Date.parse(data.endDate)
    : typeof data.expiresAt?.toMillis === 'function'
      ? data.expiresAt.toMillis()
      : Number.NaN;
  return Number.isFinite(endTime) && endTime > Date.now();
}

export const getFunVideos = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (!getApps().length) initializeApp();
  const db = getFirestore();

  if (uid !== ADMIN_UID) {
    const subscription = await db.doc(`users/${uid}/subscription/info`).get();
    if (!hasCurrentSubscription(subscription.data())) {
      throw new HttpsError('permission-denied', '현재 구독 중인 회원만 볼 수 있습니다.');
    }
  }

  const snapshot = await db.collection('funVideos').orderBy('createdAt', 'desc').limit(100).get();
  return { videos: snapshot.docs.flatMap((item) => {
    const data = item.data();
    if (typeof data.title !== 'string' || typeof data.videoId !== 'string') return [];
    return [{
      id: item.id,
      title: data.title,
      videoId: data.videoId,
      url: `https://www.youtube.com/watch?v=${data.videoId}`,
      createdAt: { seconds: data.createdAt?.seconds || 0 },
    }];
  }) };
});
