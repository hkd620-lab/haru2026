import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

type RateLimitState = {
  minuteWindow?: number;
  minuteCount?: number;
  hourWindow?: number;
  hourCount?: number;
};

export async function enforceRateLimit(
  uid: string,
  featureKey: string,
  minuteLimit: number,
  hourlyLimit: number,
): Promise<void> {
  const safeFeatureKey = featureKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const ref = admin.firestore().doc(`users/${uid}/rateLimits/${safeFeatureKey}`);

  await admin.firestore().runTransaction(async (tx) => {
    const now = Date.now();
    const minuteWindow = Math.floor(now / 60000);
    const hourWindow = Math.floor(now / 3600000);
    const snap = await tx.get(ref);
    const data = (snap.data() || {}) as RateLimitState;

    const minuteCount = data.minuteWindow === minuteWindow
      ? Number(data.minuteCount || 0) + 1
      : 1;
    const hourCount = data.hourWindow === hourWindow
      ? Number(data.hourCount || 0) + 1
      : 1;

    if (minuteCount > minuteLimit) {
      throw new HttpsError('resource-exhausted', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (hourCount > hourlyLimit) {
      throw new HttpsError('resource-exhausted', '요청이 많아 잠시 쉬어가야 합니다. 조금 뒤 다시 시도해 주세요.');
    }

    tx.set(ref, {
      minuteWindow,
      minuteCount,
      hourWindow,
      hourCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}
