import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { captureCategoryState, CATEGORY_FIELDS, matchesAppliedCategory, validCategorySnapshot } from './aiLibraryClassificationRestore';
import { contentHash, ClassificationStore, ClassificationJob, ClassificationRecord, TrustedClassificationApproval } from './aiLibraryClassification';

/** No matching allow rule exists for this top-level server-only collection. */
export const CLASSIFICATION_PRIVATE_ROOT = 'aiLibraryClassificationPrivate';
export function classificationPaths(db: Firestore, owner: string) {
  const root = db.collection(CLASSIFICATION_PRIVATE_ROOT).doc(owner);
  return { runtime: root.collection('control').doc('runtime'),
    plan: (key: string) => root.collection('plans').doc(key),
    approval: (key: string) => root.collection('approvals').doc(key),
    review: (key: string) => root.collection('reviews').doc(key),
    job: (key: string) => root.collection('jobs').doc(key),
    restoration: (key: string, id: string) => root.collection('jobs').doc(key).collection('restorations').doc(id),
    attempt: (key: string) => root.collection('attempts').doc(key),
    record: (id: string) => db.collection('users').doc(owner).collection('records').doc(id) };
}
/** All writes deferred until callback finishes, preserving Firestore's reads-before-writes rule. */
export function createClassificationStore(db: Firestore, owner: string): ClassificationStore {
  const p = classificationPaths(db, owner);
  return { transaction: work => db.runTransaction(async tx => {
    const writes: Array<() => void> = [];
    const result = await work({
      getAuthorization: async key => {
        const runtime = await tx.get(p.runtime); const approval = await tx.get(p.approval(key));
        return { enabled: runtime.data()?.enabled === true && runtime.data()?.credentialsReady === true,
          approval: approval.exists ? approval.data() as unknown as TrustedClassificationApproval : null };
      },
      getAttempt: async key => (await tx.get(p.attempt(key))).data() as {manifestHash: string} | undefined,
      putAttempt: (key, value) => { writes.push(() => { tx.create(p.attempt(key), value); }); },
      getJob: async key => (await tx.get(p.job(key))).data() as ClassificationJob | undefined,
      putJob: (key, value) => { writes.push(() => { tx.set(p.job(key), value); }); },
      getRecord: async (uid, id) => {
        if (uid !== owner) throw new Error('owner_mismatch');
        return (await tx.get(p.record(id))).data() as ClassificationRecord | undefined;
      },
      getRecordIdentity: async (uid, id) => {
        if (uid !== owner) throw new Error('owner_mismatch');
        const record = await tx.get(p.record(id));
        return record.createTime ? `${record.createTime.seconds}:${record.createTime.nanoseconds}` : undefined;
      },
      applyRecord: async (uid, id, key, patch) => {
        if (uid !== owner) throw new Error('owner_mismatch');
        const current = await tx.get(p.record(id));
        const existing = await tx.get(p.restoration(key, id));
        const record = current.data();
        const before = record && captureCategoryState(record);
        // Never classify without a bounded, lossless snapshot. Never replace an earlier receipt.
        if (!record || !current.createTime || !before || existing.exists) return false;
        const appliedAt = FieldValue.serverTimestamp();
        const applied = { ...patch, aiCategoryAuto: { ...(patch.aiCategoryAuto as object), appliedAt } };
        writes.push(() => {
          tx.create(p.restoration(key, id), { version: 1, owner, id, manifestHash: key,
            recordIdentity: `${current.createTime!.seconds}:${current.createTime!.nanoseconds}`,
            contentHash: contentHash(record), before, applied, appliedAt });
          tx.update(p.record(id), applied);
        });
        return true;
      },
      restoreRecord: async (uid, id, key, expectedContentHash) => {
        if (uid !== owner) throw new Error('owner_mismatch');
        const receipt = await tx.get(p.restoration(key, id));
        const saved = receipt.data();
        if (!validCategorySnapshot(saved) || !receipt.createTime || !receipt.updateTime?.isEqual(receipt.createTime) || saved.owner !== owner || saved.id !== id || saved.manifestHash !== key || saved.contentHash !== expectedContentHash) {
          return { status: 'unavailable', reason: 'snapshot_unavailable' };
        }
        const current = await tx.get(p.record(id));
        if (!current.exists) return { status: 'skipped', reason: 'record_deleted' };
        if (!current.createTime || `${current.createTime.seconds}:${current.createTime.nanoseconds}` !== saved.recordIdentity) return { status: 'skipped', reason: 'record_replaced' };
        // This immutable receipt was CREATED in the same commit as the category patch.
        // Its createTime is the exact commit revision, unlike serverTimestamp transforms
        // which can have coarser precision. Any later record write fails this CAS fence.
        if (!current.updateTime?.isEqual(receipt.createTime) || !matchesAppliedCategory(current.data()!, saved)) return { status: 'skipped', reason: 'record_changed' };
        const patch = Object.fromEntries(CATEGORY_FIELDS.map(field => {
          const state = saved.before[field];
          return [field, state.present ? state.value : FieldValue.delete()];
        }));
        writes.push(() => { tx.update(p.record(id), patch); });
        return { status: 'restored' };
      },
    });
    writes.forEach(write => write()); return result;
  }) };
}
