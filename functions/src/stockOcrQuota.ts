import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  buildMonthlyOcrQuotaStatus,
  getKstMonthKey,
  resolveMonthlyAiPlan,
  type MonthlyAiPlan,
  type MonthlyOcrQuotaReservation,
} from './utils/monthlyAiQuota';

// 독서 OCR과 같은 요금제별 한도, 독립 카운터. 일반 AI usedCount도 차감하지 않는다.
export const STOCK_OCR_FEATURE_KEY = 'stock_ocr';

export function previewStockOcrQuota(
  data: { byFeature?: Record<string, unknown> } | undefined,
  plan: MonthlyAiPlan,
  period = getKstMonthKey(),
) {
  const status = buildMonthlyOcrQuotaStatus(plan, Number(data?.byFeature?.[STOCK_OCR_FEATURE_KEY] || 0), period);
  const allowed = status.used < status.limit;
  return { allowed, status, nextStatus: buildMonthlyOcrQuotaStatus(plan, status.used + (allowed ? 1 : 0), period) };
}

export async function reserveStockOcrQuota(uid: string): Promise<MonthlyOcrQuotaReservation> {
  const plan = await resolveMonthlyAiPlan(uid);
  const period = getKstMonthKey();
  const ref = admin.firestore().doc(`users/${uid}/monthlyAiUsage/${period}`);
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const preview = previewStockOcrQuota(snap.data(), plan, period);
    if (!preview.allowed) {
      throw new HttpsError('resource-exhausted',
        `이번 달 주식 사진 글자 추출 한도(${preview.status.limit}장)를 모두 사용했습니다. 직접 입력해 저장하거나 다음 달에 다시 이용해 주세요.`,
        { reason: 'MONTHLY_STOCK_OCR_QUOTA_EXCEEDED', ...preview.status });
    }
    tx.set(ref, {
      period,
      planAtLastUse: plan,
      byFeature: { [STOCK_OCR_FEATURE_KEY]: admin.firestore.FieldValue.increment(1) },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(!snap.exists ? { createdAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    }, { merge: true });
    return { ...preview.nextStatus, uid };
  });
}

export async function rollbackStockOcrQuota(reservation: MonthlyOcrQuotaReservation | null): Promise<void> {
  if (!reservation) return;
  try {
    // 실패한 요청이 예약했던 월을 복원한다. 월이 바뀌어도 새달 카운터에 쓰지 않는다.
    await admin.firestore().doc(`users/${reservation.uid}/monthlyAiUsage/${reservation.period}`).set({
      byFeature: { [STOCK_OCR_FEATURE_KEY]: admin.firestore.FieldValue.increment(-1) },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch {
    console.warn('주식 OCR 월간 예약 복원 실패');
  }
}
