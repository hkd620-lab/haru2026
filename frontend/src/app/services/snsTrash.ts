import { deleteField, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { snsRecordRevision } from '../utils/snsRecordState.ts';
import type { SnsRecord } from '../utils/snsRecordState.ts';

export class SnsTrashError extends Error {
  readonly code: 'session' | 'conflict' | 'missing' | 'busy';
  constructor(code: 'session' | 'conflict' | 'missing' | 'busy') {
    super({
      session: '로그인 상태가 바뀌었습니다. 다시 로그인해 주세요.',
      conflict: '다른 기기에서 변경된 기록입니다. 최신 내용을 확인하고 다시 선택해 주세요.',
      missing: '기록을 찾을 수 없습니다. 목록을 다시 확인해 주세요.',
      busy: '이 기록을 처리하고 있습니다. 잠시 기다려 주세요.',
    }[code]);
    this.code = code;
  }
}

/** One controller per mounted auth session. Never accepts grouped record IDs. */
export function createSnsTrashActions(db: Firestore, uid: string, isCurrent: () => boolean) {
  const pending = new Map<string, { deleted: boolean; revision: string; promise: Promise<boolean> }>();
  const assertCurrent = () => {
    if (!uid || !isCurrent()) throw new SnsTrashError('session');
  };

  return {
    change(record: SnsRecord, deleted: boolean): Promise<boolean> {
      try {
        assertCurrent();
        if (!record.id || record.id.includes('/')) throw new SnsTrashError('missing');
        const existing = pending.get(record.id);
        if (existing) {
          if (existing.deleted === deleted && existing.revision === record.revision) return existing.promise;
          throw new SnsTrashError('busy');
        }
      } catch (error) {
        return Promise.reject(error);
      }

      const ref = doc(db, 'users', uid, 'snsRecords', record.id);
      const promise = runTransaction(db, async (transaction) => {
        assertCurrent();
        const snapshot = await transaction.get(ref);
        assertCurrent();
        if (!snapshot.exists()) throw new SnsTrashError('missing');
        const current = snapshot.data();
        // Repeated requests for a state already reached never rewrite timestamps.
        if ((current.isDeleted === true) === deleted) return false;
        if (snsRecordRevision(current) !== record.revision) throw new SnsTrashError('conflict');

        // The SDK commits against the version read by transaction.get. A server
        // updateTime conflict retries the read, then rechecks the displayed revision.
        // Only trash metadata changes: original text/date/photos remain untouched.
        transaction.update(ref, {
          isDeleted: deleted,
          deletedAt: deleted ? serverTimestamp() : deleteField(),
          restoredAt: deleted ? deleteField() : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return true;
      }).finally(() => pending.delete(record.id));
      pending.set(record.id, { deleted, revision: record.revision, promise });
      return promise;
    },
  };
}
