import type { Firestore } from 'firebase-admin/firestore';
import { ClassificationStore, ClassificationJob, ClassificationRecord, TrustedClassificationApproval } from './aiLibraryClassification';

/** No matching allow rule exists for this top-level server-only collection. */
export const CLASSIFICATION_PRIVATE_ROOT = 'aiLibraryClassificationPrivate';
export function classificationPaths(db: Firestore, owner: string) {
  const root = db.collection(CLASSIFICATION_PRIVATE_ROOT).doc(owner);
  return { runtime: root.collection('control').doc('runtime'),
    plan: (key: string) => root.collection('plans').doc(key),
    approval: (key: string) => root.collection('approvals').doc(key),
    review: (key: string) => root.collection('reviews').doc(key),
    job: (key: string) => root.collection('jobs').doc(key),
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
      patchRecord: (uid, id, patch) => {
        if (uid !== owner) throw new Error('owner_mismatch');
        writes.push(() => { tx.update(p.record(id), patch); });
      },
    });
    writes.forEach(write => write()); return result;
  }) };
}
