import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

export type MonthlyAiPlan = 'free' | 'basic' | 'premium';

export const MONTHLY_AI_QUOTA_LIMITS: Record<MonthlyAiPlan, number> = {
  free: 10,
  basic: 100,
  premium: 300,
};

export type MonthlyAiQuotaStatus = {
  plan: MonthlyAiPlan;
  used: number;
  limit: number;
  remaining: number;
  period: string;
  freeLimit: number;
  basicLimit: number;
  premiumLimit: number;
};

export type MonthlyAiQuotaReservation = MonthlyAiQuotaStatus & {
  uid: string;
  featureKey: string;
};

type MonthlyAiUsageData = {
  usedCount?: unknown;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstMonthKey(nowMs = Date.now()): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 7);
}

export function normalizeMonthlyAiPlan(value: unknown): MonthlyAiPlan {
  const plan = String(value || '').toLowerCase();
  if (plan === 'premium') return 'premium';
  if (plan === 'basic') return 'basic';
  return 'free';
}

export function getMonthlyAiQuotaLimit(plan: MonthlyAiPlan): number {
  return MONTHLY_AI_QUOTA_LIMITS[plan];
}

export function sanitizeMonthlyAiFeatureKey(featureKey: string): string {
  return featureKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'general';
}

export function buildMonthlyAiQuotaStatus(
  plan: MonthlyAiPlan,
  used: number,
  period = getKstMonthKey(),
): MonthlyAiQuotaStatus {
  const safeUsed = Math.max(0, Math.floor(Number.isFinite(used) ? used : 0));
  const limit = getMonthlyAiQuotaLimit(plan);
  return {
    plan,
    used: safeUsed,
    limit,
    remaining: Math.max(0, limit - safeUsed),
    period,
    freeLimit: MONTHLY_AI_QUOTA_LIMITS.free,
    basicLimit: MONTHLY_AI_QUOTA_LIMITS.basic,
    premiumLimit: MONTHLY_AI_QUOTA_LIMITS.premium,
  };
}

export function previewMonthlyAiQuotaReservation(
  data: MonthlyAiUsageData | null | undefined,
  plan: MonthlyAiPlan,
  period = getKstMonthKey(),
): { allowed: boolean; status: MonthlyAiQuotaStatus; nextStatus: MonthlyAiQuotaStatus } {
  const used = Math.max(0, Math.floor(Number(data?.usedCount || 0)));
  const status = buildMonthlyAiQuotaStatus(plan, used, period);
  const allowed = used < status.limit;
  return {
    allowed,
    status,
    nextStatus: buildMonthlyAiQuotaStatus(plan, allowed ? used + 1 : used, period),
  };
}

export async function resolveMonthlyAiPlan(uid: string): Promise<MonthlyAiPlan> {
  try {
    const snap = await admin.firestore().doc(`users/${uid}/subscription/info`).get();
    const data = snap.data() || {};
    const endDate = data.endDate;
    const expiresAt = data.expiresAt;
    const endTime = typeof endDate === 'string'
      ? Date.parse(endDate)
      : typeof expiresAt?.toMillis === 'function'
        ? expiresAt.toMillis()
        : Number.NaN;
    if (Number.isFinite(endTime) && endTime < Date.now()) return 'free';
    return normalizeMonthlyAiPlan(data.plan);
  } catch {
    return 'free';
  }
}

export async function getMonthlyAiQuotaStatus(uid: string): Promise<MonthlyAiQuotaStatus> {
  const plan = await resolveMonthlyAiPlan(uid);
  const period = getKstMonthKey();
  const snap = await admin.firestore().doc(`users/${uid}/monthlyAiUsage/${period}`).get();
  return buildMonthlyAiQuotaStatus(plan, Number(snap.data()?.usedCount || 0), period);
}

export async function reserveMonthlyAiQuota(
  uid: string,
  featureKey: string,
): Promise<MonthlyAiQuotaReservation> {
  const plan = await resolveMonthlyAiPlan(uid);
  const period = getKstMonthKey();
  const safeFeatureKey = sanitizeMonthlyAiFeatureKey(featureKey);
  const ref = admin.firestore().doc(`users/${uid}/monthlyAiUsage/${period}`);

  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const preview = previewMonthlyAiQuotaReservation(snap.data(), plan, period);

    if (!preview.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        '이번 달 AI 도움을 모두 사용했습니다. 요금제를 확인해 주세요.',
        {
          reason: 'MONTHLY_AI_QUOTA_EXCEEDED',
          plan: preview.status.plan,
          used: preview.status.used,
          limit: preview.status.limit,
          remaining: preview.status.remaining,
          period: preview.status.period,
        },
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const update: Record<string, unknown> = {
      period,
      planAtLastUse: plan,
      usedCount: admin.firestore.FieldValue.increment(1),
      byFeature: {
        [safeFeatureKey]: admin.firestore.FieldValue.increment(1),
      },
      updatedAt: now,
    };
    if (!snap.exists) update.createdAt = now;
    tx.set(ref, update, { merge: true });

    return {
      ...preview.nextStatus,
      uid,
      featureKey: safeFeatureKey,
    };
  });
}

export async function rollbackMonthlyAiQuotaReservation(
  reservation: MonthlyAiQuotaReservation | null | undefined,
): Promise<void> {
  if (!reservation) return;
  try {
    const ref = admin.firestore().doc(`users/${reservation.uid}/monthlyAiUsage/${reservation.period}`);
    await ref.set({
      usedCount: admin.firestore.FieldValue.increment(-1),
      byFeature: {
        [reservation.featureKey]: admin.firestore.FieldValue.increment(-1),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn('monthly AI quota rollback failed:', (error as any)?.message || error);
  }
}
