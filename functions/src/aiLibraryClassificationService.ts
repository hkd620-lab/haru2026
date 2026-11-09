import type { Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { ClassificationRunner, ClassificationProvider, ClassificationManifest, ClassificationRecord,
  CLASSIFICATION_MIN_RESERVATION_MICROUSD, classificationManifestHash, contentHash, planClassification,
  prepareClassificationPayload } from './aiLibraryClassification';
import { classificationPaths, createClassificationStore } from './aiLibraryClassificationStore';

export const CLASSIFICATION_CONSENT_VERSION = 'typesafe-reviewed-retention-v1';
export const CLASSIFICATION_DESTINATION = 'TypeSafe AI / https://api.typesafe.ai/v1/systemone';
export const CLASSIFICATION_RETENTION_NOTICE = 'TypeSafe AI states data is not used for training. Zero data retention is not confirmed for standard accounts; enterprise terms may differ.';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && Buffer.byteLength(id) <= 1500 && !id.includes('/') && id !== '.' && id !== '..' && !/^__.*__$/.test(id);
export interface ClassificationContext { uid?: string; email?: unknown; emailVerified?: unknown; origin?: string }
export interface ClassificationServiceOptions {
  db: () => Firestore;
  /** Explicit injected provider only; production constructs its owner-bound transport lazily. */
  provider?: ClassificationProvider;
  providerForOwner?: (owner: string) => ClassificationProvider;
  now?: () => number;
  /** Tests may opt into ONLY a demo project and loopback emulator. Never request data. */
  emulator?: { projectId: string; host: string };
}
export function assertClassificationContext(context: ClassificationContext, emulator?: ClassificationServiceOptions['emulator']): string {
  if (!context.uid || !validId(context.uid) || typeof context.email !== 'string' || context.email.trim().toLowerCase() !== 'hkd620@gmail.com' || context.emailVerified !== true) throw new Error('permission_denied');
  if (emulator) {
    if (process.env.FIRESTORE_EMULATOR_HOST !== emulator.host || !/^demo-[a-z0-9-]+$/.test(emulator.projectId) || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(emulator.host)) throw new Error('unsafe_emulator');
  } else if (context.origin !== 'https://haru2026.com') throw new Error('origin_denied');
  return context.uid;
}
export function createClassificationService(options: ClassificationServiceOptions) {
  const now = options.now ?? Date.now;
  return async (context: ClassificationContext, input: Record<string, unknown>) => {
    const owner = assertClassificationContext(context, options.emulator);
    const action = input?.action;
    const configured = !!(options.provider || options.providerForOwner);
    if (!['capability', 'prepare', 'review', 'approve', 'step', 'cancel', 'recover', 'status'].includes(String(action))) throw new Error('invalid_action');
    // Refuse record and credential access before constructing a database when unconfigured.
    if (action === 'capability' && !configured) return { enabled: false, reason: 'server_unconfigured' };
    if (!configured && !['cancel', 'recover', 'status'].includes(String(action))) throw new Error('server_unconfigured');
    const db = options.db();
    const p = classificationPaths(db, owner);
    const requireRuntime = async (tx: FirebaseFirestore.Transaction) => {
      const runtime = (await tx.get(p.runtime)).data();
      if (runtime?.enabled !== true || runtime?.credentialsReady !== true) throw new Error('runtime_disabled');
    };
    if (action === 'capability') return db.runTransaction(async tx => { const runtime = (await tx.get(p.runtime)).data(); return { enabled: runtime?.enabled === true && runtime?.credentialsReady === true }; });
    if (action === 'prepare') {
      const ids = input.recordIds;
      const all = input.scope === 'all';
      if ((!all && (!Array.isArray(ids) || ids.length < 1 || ids.length > 1000 || !ids.every(validId) || new Set(ids).size !== ids.length)) ||
        !Number.isSafeInteger(input.budgetMicrousd) || (input.budgetMicrousd as number) < CLASSIFICATION_MIN_RESERVATION_MICROUSD || (input.budgetMicrousd as number) > 10000000 ||
        !Number.isSafeInteger(input.expiresAt) || (input.expiresAt as number) <= now() || (input.expiresAt as number) > now() + 86400000) throw new Error('invalid_plan');
      return db.runTransaction(async tx => {
        await requireRuntime(tx);
        const scan = all ? await tx.get(db.collection('users').doc(owner).collection('records').where('type', '==', 'ai_log').select('type').limit(1001)) : undefined;
        if (scan && scan.size > 1000) throw new Error('scope_too_large');
        const selected = scan ? scan.docs.map(d => d.id) : ids as string[];
        if (!selected.length) throw new Error('empty_scope');
        const manifest = planClassification(owner, [], input.expiresAt as number, input.budgetMicrousd as number);
        // Bound live raw-body memory. Persist only hashes; discard each batch before the next.
        for (let start = 0; start < selected.length; start += 10) {
          const batchIds = selected.slice(start, start + 10);
          const records = await tx.getAll(...batchIds.map(id => p.record(id)), { fieldMask: ['type', 'content', 'aiCategorySource'] });
          const batchPlan = planClassification(owner, records.map((r, i) => ({ id: batchIds[i], record: (r.data() ?? {}) as ClassificationRecord })), manifest.expiresAt, manifest.budgetMicrousd);
          manifest.records.push(...batchPlan.records);
        }
        manifest.records.sort((a, b) => a.id.localeCompare(b.id));
        const manifestHash = classificationManifestHash(manifest);
        const existing = await tx.get(p.plan(manifestHash));
        if (!existing.exists) tx.create(p.plan(manifestHash), { manifest });
        return { manifestHash, manifest, consentVersion: CLASSIFICATION_CONSENT_VERSION, destination: CLASSIFICATION_DESTINATION,
          retentionNotice: CLASSIFICATION_RETENTION_NOTICE, reservationMicrousd: CLASSIFICATION_MIN_RESERVATION_MICROUSD };
      });
    }
    if (typeof input.manifestHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.manifestHash)) throw new Error('invalid_manifest');
    const key = input.manifestHash;
    const manifest = await db.runTransaction(async tx => {
      if (!['cancel', 'recover', 'status'].includes(String(action))) await requireRuntime(tx);
      const plan = (await tx.get(p.plan(key))).data()?.manifest as ClassificationManifest | undefined;
      if (!plan || plan.owner !== owner || classificationManifestHash(plan) !== key) throw new Error('plan_not_found');
      return plan;
    });
    if (action === 'review') {
      const offset = input.offset ?? 0;
      if (!Number.isInteger(offset) || (offset as number) < 0 || (offset as number) >= manifest.records.length) throw new Error('invalid_offset');
      return db.runTransaction(async tx => {
        await requireRuntime(tx);
        if (manifest.expiresAt <= now()) throw new Error('expired');
        const rows = manifest.records.slice(offset as number, (offset as number) + 20);
        const docs = await tx.getAll(...rows.map(r => p.record(r.id)));
        const receipt = await tx.get(p.review(key));
        const reviewed = new Set<string>(receipt.data()?.hashes ?? []);
        const items = rows.map((row, i) => {
          const record = docs[i].data() as ClassificationRecord | undefined;
          const payload = record ? prepareClassificationPayload(record) : { text: '', reason: 'deleted' };
          const unchanged = !!record && contentHash(record) === row.contentHash && digest(payload.text) === row.payloadHash && payload.reason === row.reason;
          if (unchanged && !row.reason) reviewed.add(row.payloadHash);
          return { id: row.id, payloadHash: row.payloadHash, text: unchanged && !row.reason ? payload.text : '', reason: unchanged ? row.reason : 'record_changed' };
        });
        tx.set(p.review(key), { hashes: [...reviewed] });
        return { items, nextOffset: (offset as number) + rows.length < manifest.records.length ? (offset as number) + rows.length : null };
      });
    }
    if (action === 'approve') return db.runTransaction(async tx => {
      await requireRuntime(tx);
      if (manifest.expiresAt <= now() || input.consentVersion !== CLASSIFICATION_CONSENT_VERSION) throw new Error('consent_required');
      const expected = [...new Set(manifest.records.filter(r => !r.reason).map(r => r.payloadHash))].sort();
      const provided = input.reviewedPayloadHashes;
      const receipt = (await tx.get(p.review(key))).data();
      if ((await tx.get(p.job(key))).data()?.cancelled === true) throw new Error('cancelled');
      if (!Array.isArray(provided) || provided.some(h => typeof h !== 'string') || JSON.stringify([...provided].sort()) !== JSON.stringify(expected) || expected.some(h => !receipt?.hashes?.includes(h))) throw new Error('review_required');
      tx.set(p.approval(key), { owner, manifestHash: key, expiresAt: manifest.expiresAt, reviewedPayloadHashes: expected, consentVersion: CLASSIFICATION_CONSENT_VERSION, approvedAt: now() });
      return { approved: true, manifestHash: key };
    });
    const store = createClassificationStore(db, owner);
    // Cleanup never calls this placeholder and remains available after runtime disable/revocation.
    const provider: ClassificationProvider = options.provider ?? options.providerForOwner?.(owner) ?? { model: 'jev-1.14.0', maxRequestCostMicrousd: 2753, classify: async () => { throw new Error('server_unconfigured'); } };
    const runner = new ClassificationRunner(store, { owner: async () => owner }, provider, now);
    if (action === 'step') { const limit = input.limit ?? 1; if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 5) throw new Error('invalid_step_limit'); return runner.step(manifest, limit as number); }
    if (action === 'cancel') { await runner.cancel(manifest); await p.approval(key).delete(); return { cancelled: true }; }
    if (action === 'recover') { await runner.recover(manifest); return { recovered: true }; }
    return { manifestHash: key, job: (await p.job(key).get()).data() ?? null };
  };
}
