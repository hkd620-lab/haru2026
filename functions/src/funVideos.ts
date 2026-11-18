import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

export const getFunVideos = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (!getApps().length) initializeApp();
  const db = getFirestore();

  // 2026-11-18 허대표님 결정: 재미 영상은 로그인한 모든 회원(무료 포함)이 볼 수 있다. 로그인 확인만 한다.
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
