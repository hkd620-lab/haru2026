import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { prepareClassificationPayload, contentHash, CLASSIFICATION_POLICY } from './aiLibraryClassification';
import { captureCategoryState } from './aiLibraryClassificationRestore';
import type { JevClassificationResult } from './aiLibraryJevChoice';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const AUTO_RESERVATION_MICROUSD = 2753;
export const AUTO_DAILY_MAX_MICROUSD = 1_000_000;
export type AutoAnswer = JevClassificationResult & { recommendation: string | null };
export interface NewAiLog { uid: string; id: string; identity: string; createdAtMs: number; record: Record<string, unknown> }
const identity = (s: FirebaseFirestore.DocumentSnapshot) => s.createTime ? `${s.createTime.seconds}:${s.createTime.nanoseconds}` : '';
const active = (s: FirebaseFirestore.DocumentSnapshot) => s.exists && s.get('accountStatus') !== 'pending_deletion' && s.get('deletionStartedAt') === undefined;
const enabled = (c: FirebaseFirestore.DocumentData | undefined, e: NewAiLog) => c?.enabled === true && c?.credentialsReady === true
  && c.model === 'jev-1.14.0' && Number.isSafeInteger(c.enabledAtMs) && e.createdAtMs >= c.enabledAtMs;

/** At-least-once events, but at most one paid attempt. Raw text never enters private history. */
export function createNewAiLogClassifier(db: Firestore, classify: (text: string) => Promise<AutoAnswer>, now = Date.now) {
  return async (event: NewAiLog): Promise<string> => {
    if (event.record.type !== 'ai_log' || event.record.aiCategorySource === 'manual') return 'ignored';
    const prepared = prepareClassificationPayload(event.record);
    const expectedHash = contentHash(event.record), payloadHash = hash(prepared.text);
    const key = hash(JSON.stringify([event.uid, event.id, expectedHash, payloadHash, 'jev-1.14.0', CLASSIFICATION_POLICY]));
    const root = `aiLibraryClassificationPrivate/${event.uid}`;
    const user = db.doc(`users/${event.uid}`), record = db.doc(`users/${event.uid}/records/${event.id}`);
    const config = db.doc(`${root}/control/autoNew`), job = db.doc(`${root}/autoJobs/${key}`);
    const attempt = db.doc(`${root}/attempts/${key}`), review = db.doc(`${root}/reviewItems/${event.id}`);
    const day = new Date(now() + 9 * 3600000).toISOString().slice(0, 10);
    const budget = db.doc(`${root}/autoBudgets/${day}`), receipt = job.collection('restorations').doc(event.id);
    const same = (s: FirebaseFirestore.DocumentSnapshot) => s.exists && identity(s) === event.identity
      && s.get('aiCategorySource') !== 'manual' && contentHash(s.data()!) === expectedHash;
    const claim = await db.runTransaction(async tx => {
      const [u, c, r, j, a, b] = await tx.getAll(user, config, record, job, attempt, budget);
      if (!active(u) || !enabled(c.data(), event)) return 'disabled';
      if (!same(r)) return 'changed';
      if (j.exists || a.exists) return 'duplicate';
      const limit = c.get('dailyBudgetMicrousd');
      const used = b.get('reservedMicrousd') ?? 0;
      if (!Number.isSafeInteger(limit) || limit < AUTO_RESERVATION_MICROUSD || limit > AUTO_DAILY_MAX_MICROUSD
        || !Number.isSafeInteger(used) || used < 0) return 'disabled';
      const reason = prepared.reason || (used + AUTO_RESERVATION_MICROUSD > limit ? 'daily_budget' : null);
      const base = { owner: event.uid, id: event.id, model: 'jev-1.14.0', policy: CLASSIFICATION_POLICY,
        contentHash: expectedHash, payloadHash, recordIdentity: event.identity, createdAt: FieldValue.serverTimestamp() };
      if (reason) {
        tx.create(job, { ...base, status: 'review', reason, reservationMicrousd: 0 });
        tx.set(review, { status: 'pending', contentHash: expectedHash, recommendation: null, reason, manifestHash: key });
        return 'review';
      }
      tx.create(attempt, { manifestHash: key });
      tx.create(job, { ...base, status: 'reserved', reservationMicrousd: AUTO_RESERVATION_MICROUSD, day });
      tx.set(review, { status: 'pending', contentHash: expectedHash, recommendation: null, reason: 'auto_processing', manifestHash: key });
      tx.set(budget, { reservedMicrousd: used + AUTO_RESERVATION_MICROUSD, updatedAt: FieldValue.serverTimestamp() });
      return 'reserved';
    });
    if (claim !== 'reserved') return claim;
    // A later manual move/edit/config pause conflicts with this final dispatch fence.
    const permit = await db.runTransaction(async tx => {
      const [u, c, r, j] = await tx.getAll(user, config, record, job);
      if (!active(u) || !j.exists || j.get('status') !== 'reserved') return false;
      if (!enabled(c.data(), event) || !same(r)) { tx.update(job, { status: 'skipped', reason: 'changed_before_send' }); return false; }
      tx.update(job, { status: 'permitted', permittedAt: FieldValue.serverTimestamp() }); return true;
    });
    if (!permit) return 'changed';
    let answer: AutoAnswer;
    try { answer = await classify(prepared.text); }
    catch { answer = { decision: { status: 'review', reason: 'transport_error' }, usage: null, recommendation: null }; }
    return db.runTransaction(async tx => {
      const [u, c, r, j, saved] = await tx.getAll(user, config, record, job, receipt);
      if (!active(u) || !j.exists || j.get('status') !== 'permitted') return 'ignored';
      if (!same(r)) { tx.update(job, { status: 'skipped', reason: 'changed_after_send' }); return 'changed'; }
      const current = r.data()!;
      const before = captureCategoryState(current);
      const apply = enabled(c.data(), event) && answer.decision.status === 'classified'
        && answer.decision.confidence >= 0.85 && before !== null && !saved.exists;
      if (apply && answer.decision.status === 'classified') {
        const at = FieldValue.serverTimestamp();
        const patch = { aiCategory: answer.decision.category, aiCategorySource: 'auto', aiCategoryAuto: {
          model: 'jev-1.14.0', policy: CLASSIFICATION_POLICY, confidence: answer.decision.confidence,
          contentHash: expectedHash, manifestHash: key, appliedAt: at } };
        tx.create(receipt, { version: 1, owner: event.uid, id: event.id, manifestHash: key,
          recordIdentity: event.identity, contentHash: expectedHash, before, applied: patch, appliedAt: at });
        tx.update(record, patch); tx.delete(review);
      } else {
        tx.set(review, { status: 'pending', contentHash: expectedHash, recommendation: answer.recommendation,
          reason: answer.decision.status === 'review' ? answer.decision.reason : 'classification_review', manifestHash: key });
      }
      const uncertain = answer.decision.status === 'review' && ['transport_error', 'invalid_response'].includes(answer.decision.reason);
      tx.update(job, { status: apply ? 'applied' : uncertain ? 'unknown' : 'review', decision: answer.decision,
        recommendation: answer.recommendation, usage: answer.usage, completedAt: FieldValue.serverTimestamp() });
      return apply ? 'applied' : 'review';
    });
  };
}
