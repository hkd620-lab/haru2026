import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// cancelSubscription(index.ts)과 requestAccountDeletion(accountDeletion.ts) 양쪽에서
// 공유하는 정기구독 해지 로직. index.ts와 accountDeletion.ts 사이의 순환 참조를 피하기 위해
// 별도 파일로 둔다.
export async function cancelSubscriptionForUid(
  uid: string,
): Promise<{ alreadyCancelled: boolean; endDate: string | null }> {
  const nowIso = new Date().toISOString();
  const subRef = db.doc(`users/${uid}/subscription/info`);
  const billingRef = db.doc(`billingSubscriptions/${uid}`);

  const result = await db.runTransaction(async (tx) => {
    const [subSnap, billingSnap] = await Promise.all([
      tx.get(subRef),
      tx.get(billingRef),
    ]);
    const subData = subSnap.data() || {};
    const billingData = billingSnap.data() || {};
    const plan = subData.plan === 'basic' || subData.plan === 'premium'
      ? subData.plan
      : billingData.plan === 'basic' || billingData.plan === 'premium'
        ? billingData.plan
        : '';

    if (!plan) {
      throw new HttpsError('failed-precondition', '해지할 구독이 없습니다.');
    }

    if (subData.status === 'cancelled' || billingData.status === 'cancelled') {
      return {
        alreadyCancelled: true,
        endDate: typeof subData.endDate === 'string' ? subData.endDate : null,
      };
    }

    const endDate = typeof subData.endDate === 'string'
      ? subData.endDate
      : typeof billingData.endDate === 'string'
        ? billingData.endDate
        : nowIso;

    tx.set(subRef, {
      plan,
      status: 'cancelled',
      cancelAtPeriodEnd: true,
      cancelledAt: nowIso,
      endDate,
      nextBillingDate: null,
      updatedAt: nowIso,
    }, { merge: true });

    tx.set(billingRef, {
      uid,
      plan,
      status: 'cancelled',
      billingKey: null,
      cancelAtPeriodEnd: true,
      cancelledAt: nowIso,
      endDate,
      nextBillingDate: null,
      billingLockUntil: null,
      updatedAt: nowIso,
    }, { merge: true });

    return { alreadyCancelled: false, endDate };
  });

  logger.info('✅ 정기구독 해지 예약 — uid: %s, endDate: %s', uid, result.endDate);
  return result;
}
