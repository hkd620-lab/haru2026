import { HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import axios from 'axios';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const PORTONE_API_SECRET = defineSecret('PORTONE_API_SECRET');

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

    const endDate = typeof subData.endDate === 'string'
      ? subData.endDate
      : typeof billingData.endDate === 'string'
        ? billingData.endDate
        : nowIso;
    const cancelledAt = typeof subData.cancelledAt === 'string'
      ? subData.cancelledAt
      : typeof billingData.cancelledAt === 'string'
        ? billingData.cancelledAt
        : nowIso;

    if (subData.status === 'cancelled' || billingData.status === 'cancelled') {
      tx.set(subRef, {
        plan,
        status: 'cancelled',
        autoRenew: false,
        cancelAtPeriodEnd: true,
        cancelledAt,
        endDate,
        nextBillingDate: null,
        billingKey: admin.firestore.FieldValue.delete(),
        updatedAt: nowIso,
      }, { merge: true });

      return {
        alreadyCancelled: true,
        endDate,
      };
    }

    tx.set(subRef, {
      plan,
      status: 'cancelled',
      autoRenew: false,
      cancelAtPeriodEnd: true,
      cancelledAt,
      endDate,
      nextBillingDate: null,
      billingKey: admin.firestore.FieldValue.delete(),
      updatedAt: nowIso,
    }, { merge: true });

    tx.set(billingRef, {
      uid,
      plan,
      status: 'cancelled',
      billingKey: admin.firestore.FieldValue.delete(),
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

// 포트원(PortOne)에 등록된 빌링키를 삭제한다. 문서: DELETE /billing-keys/{billingKey}
// (https://developers.portone.io/api/rest-v2/payment.billingKey)
// 이미 삭제된 빌링키를 다시 삭제 시도해도(재시도 상황) 404는 정상 케이스로 간주한다.
async function revokePortOneBillingKey(billingKey: string, apiSecret: string): Promise<void> {
  try {
    await axios.delete(`https://api.portone.io/billing-keys/${encodeURIComponent(billingKey)}`, {
      headers: { Authorization: `PortOne ${apiSecret.trim()}` },
    });
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return;
    }
    throw error;
  }
}

type BillingKeyRevocationReason = 'subscription_cancelled' | 'account_withdrawal';

// billingSubscriptions/{uid}에서 카드 인증정보(billingKey)만 제거하고,
// 결제일시·금액·상품명·주문번호 등 거래 기록은 그대로 보존한다(전자상거래법 보존 대상).
// 포트원 쪽 빌링키도 함께 삭제해, 해지/탈퇴 후 카드사 재청구 경로를 없앤다.
// 재시도 안전을 위해 멱등적으로 동작한다(billingKey가 이미 없으면 기록 필드만 보강).
export async function revokeBillingKeyForUid(
  uid: string,
  portOneApiSecret: string,
  reason: BillingKeyRevocationReason,
): Promise<void> {
  const billingRef = db.doc(`billingSubscriptions/${uid}`);
  const snap = await billingRef.get();
  if (!snap.exists) return;

  const billingKey = snap.data()?.billingKey;
  const nowIso = new Date().toISOString();

  if (typeof billingKey === 'string' && billingKey) {
    try {
      await revokePortOneBillingKey(billingKey, portOneApiSecret);
      logger.info('✅ 포트원 빌링키 삭제 완료 — uid: %s', uid);
    } catch (error: any) {
      // 포트원 삭제가 실패해도 탈퇴 처리 자체를 막지 않는다. 다만 잔존 위험이 있으므로
      // 반드시 로그로 남겨 별도 확인이 가능하도록 한다.
      logger.error('⚠️ 포트원 빌링키 삭제 실패 — uid: %s, message: %s', uid, error?.message);
    }
  }

  await billingRef.set(
    {
      billingKey: admin.firestore.FieldValue.delete(),
      billingKeyRevokedAt: nowIso,
      billingKeyRevocationReason: reason,
      ...(reason === 'account_withdrawal' ? { withdrawnAt: nowIso } : {}),
    },
    { merge: true },
  );
}

export async function revokeBillingKeyForWithdrawal(
  uid: string,
  portOneApiSecret: string,
): Promise<void> {
  await revokeBillingKeyForUid(uid, portOneApiSecret, 'account_withdrawal');
}
