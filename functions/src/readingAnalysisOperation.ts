import { createHash, randomUUID } from 'node:crypto';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  getKstMonthKey,
  monthlyAiQuotaRefundFields,
  reserveMonthlyAiQuotaInTransaction,
  resolveMonthlyAiPlan,
} from './utils/monthlyAiQuota';

export const READING_ANALYSIS_COLLECTION = 'readingAnalysisRequests';
// Leave time for the 60-second callable to settle before taking over a terminated attempt.
const LEASE_MS = 2 * 60_000;
const RESULT_LIFETIME_MS = 24 * 60 * 60_000;
const FEATURE = 'polishContent';

type AnalysisResult = { text: string; stats: unknown; aiComment: string; originalPreserved?: boolean };
type ExistingOperation = {
  digest: string;
  state: 'pending' | 'completed' | 'expired';
  owner?: string;
  leaseUntil?: number;
  period: string;
  result?: AnalysisResult;
  resultExpiresAt?: number;
};

export type ReadingAnalysisLease = {
  db: Firestore;
  ref: DocumentReference;
  uid: string;
  period: string;
  owner: string;
};

type Claim =
  | { status: 'completed'; result: AnalysisResult }
  | { status: 'processing' }
  | { status: 'claimed'; lease: ReadingAnalysisLease };

export async function beginReadingAnalysis(
  db: Firestore, uid: string, id: unknown, text: string, now = Date.now(),
): Promise<Claim> {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    throw new HttpsError('invalid-argument', '독서장 분석 요청 번호를 확인해 주세요.');
  }

  // The ID belongs to this authenticated user and this exact input. The prompt itself is never stored.
  const userRef = db.doc(`users/${uid}`);
  const ref = userRef.collection(READING_ANALYSIS_COLLECTION).doc(id);
  const digest = createHash('sha256').update(text).digest('hex');
  const owner = randomUUID();
  const plan = await resolveMonthlyAiPlan(uid);
  const currentPeriod = getKstMonthKey(now);

  const claim = await db.runTransaction<Claim>(async tx => {
    const [user, operation] = await tx.getAll(userRef, ref);
    if (!user.exists || user.get('accountStatus') === 'pending_deletion' || user.get('deletionStartedAt') != null) {
      throw new HttpsError('failed-precondition', '계정 상태를 확인해 주세요.');
    }
    const existing = operation.data() as ExistingOperation | undefined;
    if (existing && existing.digest !== digest) {
      throw new HttpsError('invalid-argument', '같은 분석 요청으로 다른 내용을 보낼 수 없습니다.');
    }
    if (existing?.state === 'expired' || (existing?.state === 'completed' && (!existing.result || (existing.resultExpiresAt ?? 0) <= now))) {
      throw new HttpsError('failed-precondition', '이전 분석 결과의 보관 시간이 지났습니다.', {
        reason: 'READING_ANALYSIS_EXPIRED',
      });
    }
    if (existing?.state === 'completed' && existing.result) return { status: 'completed', result: existing.result };
    if (existing?.state === 'pending' && (existing.leaseUntil ?? 0) > now) return { status: 'processing' };

    // A terminated worker leaves its original reservation. Taking over that work must not reserve another use.
    const period = existing?.period ?? currentPeriod;
    if (!existing) await reserveMonthlyAiQuotaInTransaction(db, tx, uid, FEATURE, plan, period);
    tx.set(ref, { digest, state: 'pending', owner, period, leaseUntil: now + LEASE_MS });
    return { status: 'claimed', lease: { db, ref, uid, period, owner } };
  });

  if (claim.status === 'claimed') {
    await expireReadingAnalysisResults(userRef, now).catch(() => console.warn('reading analysis cache cleanup failed'));
  }
  return claim;
}

async function expireReadingAnalysisResults(userRef: DocumentReference, now: number): Promise<void> {
  const expired = await userRef.collection(READING_ANALYSIS_COLLECTION)
    .where('resultExpiresAt', '<=', now).limit(25).get();
  if (expired.empty) return;

  // Retain the request marker so a delayed retry cannot reserve a second use after its result is removed.
  const batch = userRef.firestore.batch();
  for (const doc of expired.docs) {
    batch.update(doc.ref, {
      state: 'expired',
      result: null,
      resultExpiresAt: null,
    }, { lastUpdateTime: doc.updateTime });
  }
  await batch.commit();
}

export async function completeReadingAnalysis(lease: ReadingAnalysisLease, result: AnalysisResult): Promise<void> {
  await lease.db.runTransaction(async tx => {
    const current = await tx.get(lease.ref);
    if (current.get('state') !== 'pending' || current.get('owner') !== lease.owner) {
      throw new HttpsError('aborted', '다른 요청에서 이 분석을 처리하고 있습니다.');
    }
    tx.update(lease.ref, { state: 'completed', result, resultExpiresAt: Date.now() + RESULT_LIFETIME_MS });
  });
}

export async function refundReadingAnalysis(lease: ReadingAnalysisLease): Promise<void> {
  await lease.db.runTransaction(async tx => {
    const current = await tx.get(lease.ref);
    if (current.get('state') !== 'pending' || current.get('owner') !== lease.owner) return;

    const quotaRef = lease.db.doc(`users/${lease.uid}/monthlyAiUsage/${lease.period}`);
    tx.set(quotaRef, monthlyAiQuotaRefundFields(FEATURE), { merge: true });
    tx.delete(lease.ref);
  });
}
