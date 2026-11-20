// '내 영상 찾기' Firestore 저장소. 판정 규칙은 videoFinderCore.ts에 두고 여기서는 트랜잭션 경계만 지킨다.
// - 사용자 데이터를 만들거나 바꾸는 모든 쓰기는 같은 트랜잭션에서 users/{uid}를 읽고 assertActiveAccount로 확인한다.
//   requestAccountDeletion·executeScheduledDeletion도 같은 문서를 트랜잭션으로 쓰므로, 탈퇴 신청·삭제 시작 뒤
//   커밋되는 쓰기는 없다(삭제가 끝난 데이터가 되살아나지 않음).
// - 기존 보관 문서는 set으로 통째 덮어쓰지 않고 update로 바뀐 필드만 쓴다.
// - 보관 생성·삭제는 사용자별 레지스터 문서(users/{uid}/rateLimits/videoFinderSavedLock)를 함께 읽고 써서
//   서로 직렬화한다. 그래서 트랜잭션 안의 개수 집계가 동시 요청에서도 최대 개수를 넘기지 않는다.
import type { Auth } from 'firebase-admin/auth';
import { FieldValue, type DocumentData, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import {
  GLOBAL_QUOTA_TIME_ZONE,
  USER_QUOTA_TIME_ZONE,
  VIDEO_FINDER_CONFIG_DOC,
  VIDEO_FINDER_GLOBAL_QUOTA_COLLECTION,
  VIDEO_FINDER_HISTORY_COLLECTION,
  VIDEO_FINDER_SAVED_COLLECTION,
  VIDEO_FINDER_SAVED_LOCK_FEATURE,
  VIDEO_FINDER_SESSION_COLLECTION,
  VIDEO_FINDER_USER_QUOTA_FEATURE,
  assertActiveAccount,
  dayKey,
  evaluateQuotaReservation,
  planMetaUpdate,
  quotaErrorFor,
  resolveVideoFinderLimits,
  type HistoryEntry,
  type SavedDoc,
  type SessionRecord,
  type VideoFinderLimits,
  type VideoFinderStore,
  type VideoMeta,
} from './videoFinderCore';

export function toSavedDoc(videoId: string, data: DocumentData | undefined): SavedDoc {
  const d = data || {};
  return {
    videoId,
    category: typeof d.category === 'string' ? d.category : '전체 분야',
    note: typeof d.note === 'string' ? d.note : '',
    tags: Array.isArray(d.tags) ? d.tags.filter((t: unknown) => typeof t === 'string') : [],
    favorite: d.favorite === true,
    savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
    meta: d.meta && typeof d.meta === 'object' ? (d.meta as VideoMeta) : null,
    metaFetchedAt: typeof d.metaFetchedAt === 'number' ? d.metaFetchedAt : null,
    metaStatus: d.metaStatus === 'expired' || d.metaStatus === 'unavailable' ? d.metaStatus : 'fresh',
    metaCheckedAt: typeof d.metaCheckedAt === 'number' ? d.metaCheckedAt : null,
  };
}

function fromSavedDoc(doc: SavedDoc) {
  return {
    videoId: doc.videoId,
    category: doc.category,
    note: doc.note,
    tags: doc.tags,
    favorite: doc.favorite,
    savedAt: doc.savedAt,
    updatedAt: doc.updatedAt,
    meta: doc.meta,
    metaFetchedAt: doc.metaFetchedAt,
    metaStatus: doc.metaStatus,
    metaCheckedAt: doc.metaCheckedAt,
  };
}

function toSessionRecord(data: DocumentData | undefined): SessionRecord | null {
  if (!data || typeof data.uid !== 'string' || typeof data.audience !== 'string'
    || typeof data.createdAt !== 'number' || typeof data.expiresAt !== 'number') return null;
  return { uid: data.uid, audience: data.audience, createdAt: data.createdAt, expiresAt: data.expiresAt };
}

export function createFirestoreVideoFinderStore(db: Firestore, auth: Auth): VideoFinderStore & {
  readLimits(): Promise<VideoFinderLimits>;
} {
  const userRef = (uid: string) => db.collection('users').doc(uid);
  const savedCol = (uid: string) => userRef(uid).collection(VIDEO_FINDER_SAVED_COLLECTION);
  const historyCol = (uid: string) => userRef(uid).collection(VIDEO_FINDER_HISTORY_COLLECTION);
  const rateLimitRef = (uid: string, feature: string) => userRef(uid).collection('rateLimits').doc(feature);
  const sessionRef = (hash: string) => db.collection(VIDEO_FINDER_SESSION_COLLECTION).doc(hash);

  async function readLimits(): Promise<VideoFinderLimits> {
    const snap = await db.doc(VIDEO_FINDER_CONFIG_DOC).get();
    return resolveVideoFinderLimits(snap.exists ? snap.data() : null);
  }

  return {
    readLimits,
    getLimits: readLimits,

    async reserveQuota(uid, units, countSearch, nowMs, limits) {
      const userDay = dayKey(nowMs, USER_QUOTA_TIME_ZONE);
      const globalDay = dayKey(nowMs, GLOBAL_QUOTA_TIME_ZONE);
      const quotaRef = rateLimitRef(uid, VIDEO_FINDER_USER_QUOTA_FEATURE);
      const globalRef = db.collection(VIDEO_FINDER_GLOBAL_QUOTA_COLLECTION).doc(globalDay);
      // 같은 트랜잭션에서 계정 상태·사용자·전체 카운터를 읽고 함께 쓴다. 동시 요청은 Firestore가 재시도시켜 초과하지 않는다.
      return db.runTransaction(async (tx) => {
        const [accountSnap, userSnap, globalSnap] = await Promise.all([tx.get(userRef(uid)), tx.get(quotaRef), tx.get(globalRef)]);
        assertActiveAccount(accountSnap.exists ? accountSnap.data() : null);
        const decision = evaluateQuotaReservation({
          user: userSnap.data(),
          global: globalSnap.data(),
          userDay,
          globalDay,
          units,
          countSearch,
          limits,
        });
        if (!decision.ok) throw quotaErrorFor(decision.reason);
        tx.set(quotaRef, { ...decision.user, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(globalRef, { ...decision.global, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return decision.remainingSearches;
      });
    },

    async listSaved(uid, limit) {
      const snap = await savedCol(uid).orderBy('savedAt', 'desc').limit(limit).get();
      return snap.docs.map((d) => toSavedDoc(d.id, d.data()));
    },

    async getSaved(uid, videoId) {
      const snap = await savedCol(uid).doc(videoId).get();
      return snap.exists ? toSavedDoc(snap.id, snap.data()) : null;
    },

    async createSaved(uid, doc, maxCount) {
      const ref = savedCol(uid).doc(doc.videoId);
      const lockRef = rateLimitRef(uid, VIDEO_FINDER_SAVED_LOCK_FEATURE);
      return db.runTransaction(async (tx) => {
        const [accountSnap, , existing] = await Promise.all([tx.get(userRef(uid)), tx.get(lockRef), tx.get(ref)]);
        assertActiveAccount(accountSnap.exists ? accountSnap.data() : null);
        if (existing.exists) return { created: false, doc: toSavedDoc(existing.id, existing.data()) };
        // 생성·삭제가 모두 레지스터를 쓰므로 이 집계는 직렬화된 최신 개수다.
        const countSnap = await tx.get(savedCol(uid).count());
        if (countSnap.data().count >= maxCount) return { limitReached: true as const };
        tx.create(ref, fromSavedDoc(doc));
        tx.set(lockRef, { savedChangedAt: FieldValue.serverTimestamp() }, { merge: true });
        return { created: true, doc };
      });
    },

    async updateSavedFields(uid, videoId, plan) {
      const ref = savedCol(uid).doc(videoId);
      return db.runTransaction(async (tx) => {
        const [accountSnap, snap] = await Promise.all([tx.get(userRef(uid)), tx.get(ref)]);
        assertActiveAccount(accountSnap.exists ? accountSnap.data() : null);
        // 지워진 항목은 되살리지 않는다(set 대신 update만 사용).
        if (!snap.exists) return { doc: null };
        const current = toSavedDoc(snap.id, snap.data());
        const fields = plan(current);
        if (!fields) return { doc: current };
        tx.update(ref, fields);
        return { doc: { ...current, ...fields } };
      });
    },

    async deleteSaved(uid, videoId) {
      const ref = savedCol(uid).doc(videoId);
      const lockRef = rateLimitRef(uid, VIDEO_FINDER_SAVED_LOCK_FEATURE);
      return db.runTransaction(async (tx) => {
        const [, snap] = await Promise.all([tx.get(lockRef), tx.get(ref)]);
        if (!snap.exists) return false;
        tx.delete(ref);
        tx.set(lockRef, { savedChangedAt: FieldValue.serverTimestamp() }, { merge: true });
        return true;
      });
    },

    async listHistory(uid, limit) {
      const snap = await historyCol(uid).orderBy('createdAt', 'desc').limit(limit).get();
      return snap.docs.map((d) => ({ ...(d.data() as Omit<HistoryEntry, 'id'>), id: d.id }));
    },

    async putHistory(uid, entry) {
      const { id, ...rest } = entry;
      await db.runTransaction(async (tx) => {
        const accountSnap = await tx.get(userRef(uid));
        assertActiveAccount(accountSnap.exists ? accountSnap.data() : null);
        tx.set(historyCol(uid).doc(id), rest);
      });
    },

    async trimHistory(uid, keep) {
      const snap = await historyCol(uid).orderBy('createdAt', 'desc').offset(keep).limit(100).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    },

    async deleteHistory(uid, historyId) {
      if (historyId) {
        await historyCol(uid).doc(historyId).delete();
        return;
      }
      await db.recursiveDelete(historyCol(uid));
    },

    async deleteAll(uid) {
      // 사용자 일일 검색 카운터(rateLimits)는 남긴다. 삭제 후 재시작으로 한도를 우회하지 못하게 한다.
      await db.recursiveDelete(savedCol(uid));
      await db.recursiveDelete(historyCol(uid));
    },

    async createSession(tokenHash, record) {
      await db.runTransaction(async (tx) => {
        const accountSnap = await tx.get(userRef(record.uid));
        assertActiveAccount(accountSnap.exists ? accountSnap.data() : null);
        tx.create(sessionRef(tokenHash), { ...record, createdAtServer: FieldValue.serverTimestamp() });
      });
    },

    async getSession(tokenHash) {
      const snap = await sessionRef(tokenHash).get();
      return snap.exists ? toSessionRecord(snap.data()) : null;
    },

    async deleteSession(tokenHash) {
      await sessionRef(tokenHash).delete();
    },

    async getAccount(uid) {
      const [userSnap, authUser] = await Promise.all([
        userRef(uid).get(),
        auth.getUser(uid).catch((error: { code?: string }) => {
          if (error?.code === 'auth/user-not-found') return null;
          throw error;
        }),
      ]);
      const validAfter = authUser?.tokensValidAfterTime ? Date.parse(authUser.tokensValidAfterTime) : NaN;
      return {
        userData: userSnap.exists ? userSnap.data() : null,
        authUser: authUser ? {
          disabled: authUser.disabled === true,
          emailVerified: authUser.emailVerified === true,
          providerIds: authUser.providerData.map((p) => p.providerId),
          tokensValidAfterMs: Number.isFinite(validAfter) ? validAfter : null,
        } : null,
      };
    },
  };
}

// 정리 작업용: 문서 하나를 트랜잭션으로 다시 읽고, 여전히 오래됐을 때만 영상 정보 필드를 지운다.
// 그사이 지워졌거나 최신화됐으면 아무것도 쓰지 않는다. 메모·태그·즐겨찾기는 건드리지 않는다.
export async function expireSavedMetaIfStale(
  db: Firestore,
  ref: DocumentReference,
  nowMs: number,
): Promise<'expired' | 'skipped' | 'missing'> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'missing' as const;
    const fields = planMetaUpdate(toSavedDoc(snap.id, snap.data()), { kind: 'expired', nowMs });
    if (!fields) return 'skipped' as const;
    tx.update(ref, fields);
    return 'expired' as const;
  });
}
