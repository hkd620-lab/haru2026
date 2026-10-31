// index.ts 와 분리된 기능 모듈(하루LAW 등)이 index.ts 와 함께 쓰는 공용 값·함수.
// index.ts 에 있던 정의를 그대로 옮겼다(동작 같음).
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import * as crypto from 'crypto';
import { resolveInternalPlan } from './internalEntitlements';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

export const AI_USAGE_PLAN = 'beta';

export type UserPlan = 'free' | 'basic' | 'premium' | 'developer';

export function coerceUserPlan(value: unknown): UserPlan {
  const plan = String(value || '').toLowerCase();
  if (plan === 'developer' || plan === 'premium' || plan === 'basic') return plan;
  return 'free';
}

export function getAiUsageErrorCode(error: any): string {
  if (typeof error?.code === 'string' && error.code.trim()) return error.code.slice(0, 120);
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.slice(0, 120);
  return 'unknown';
}

export function createAiUsageRequestId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

export function clampResultChatText(value: unknown, max = 8000): string {
  return String(value || '').trim().slice(0, max);
}

// 요금제 조회 — subscription/info.plan (free/basic/premium). 개발자 UID는 developer로 계측하고 premium 한도를 적용.
export async function getUserPlan(uid: string): Promise<UserPlan> {
  const internalPlan = resolveInternalPlan(uid);
  if (internalPlan) return internalPlan;
  try {
    const snap = await db.doc(`users/${uid}/subscription/info`).get();
    const data = snap.data() || {};
    const plan = String(data.plan || '').toLowerCase();
    const status = String(data.status || '').toLowerCase();
    const endDate = data.endDate;
    const expiresAt = data.expiresAt;
    const endTime = typeof endDate === 'string'
      ? Date.parse(endDate)
      : typeof expiresAt?.toMillis === 'function'
        ? expiresAt.toMillis()
        : Number.NaN;
    if (Number.isFinite(endTime) && endTime < Date.now()) return 'free';
    if (status !== 'active' && status !== 'cancelled') return 'free';
    if (plan === 'premium') return 'premium';
    if (plan === 'basic') return 'basic';
  } catch (error) {
    logger.warn('getUserPlan 조회 실패:', { uid, message: (error as any)?.message });
  }
  return 'free';
}
