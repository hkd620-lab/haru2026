import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { requireAiLibraryDeveloper } from './aiLibrary';
import { isAiLibraryCategory, normalizeAiLibraryCategory } from './aiLibraryCategory';

const digest = (record: Record<string, unknown>) => createHash('sha256')
  .update(JSON.stringify([record.type ?? null, record.content ?? null])).digest('hex');
export function currentAiLibraryReview(record: Record<string, unknown>, review: Record<string, unknown> | undefined) {
  if (!review || review.status !== 'pending' || record.type !== 'ai_log'
    || record.aiCategorySource === 'manual' || review.contentHash !== digest(record)) return null;
  return {
    recommendation: isAiLibraryCategory(review.recommendation) ? review.recommendation : null,
    reason: typeof review.reason === 'string' ? review.reason : 'review',
  };
}
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0
  && Buffer.byteLength(id) <= 1500 && !id.includes('/') && id !== '.' && id !== '..' && !/^__.*__$/.test(id);
function cursorId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new HttpsError('invalid-argument', '보류 페이지가 올바르지 않습니다.');
  try {
    const decoded = Buffer.from(value, 'base64url');
    const parsed = JSON.parse(decoded.toString('utf8'));
    if (decoded.toString('base64url') !== value || !parsed || Object.keys(parsed).sort().join(',') !== 'id,v'
      || parsed.v !== 1 || !validId(parsed.id)) throw new Error();
    return parsed.id as string;
  } catch { throw new HttpsError('invalid-argument', '보류 페이지가 올바르지 않습니다.'); }
}
export const listAiLibraryReviews = onCall({ region: 'asia-northeast3' }, async request => {
  const uid = requireAiLibraryDeveloper(request);
  const after = cursorId(request.data?.cursor);
  const db = admin.firestore();
  const reviews = await db.collection(`aiLibraryClassificationPrivate/${uid}/reviewItems`).limit(1001).get();
  if (reviews.size > 1000) throw new HttpsError('resource-exhausted', '보류 자료가 많아 범위를 나눠야 합니다.');
  const candidates = reviews.docs.filter(doc => validId(doc.id) && (!after || doc.id > after)).sort((a, b) => a.id < b.id ? -1 : 1);
  const logs: Record<string, unknown>[] = [];
  let scanned = 0;
  // Fetch at most 100 current records per page, including changed/deleted/manual skips.
  for (const review of candidates.slice(0, 100)) {
    scanned++;
    const doc = await db.doc(`users/${uid}/records/${review.id}`).get();
    const record = doc.data();
    const state = record && currentAiLibraryReview(record, review.data());
    if (record && state) {
      logs.push({ ...record, id: doc.id, aiCategory: normalizeAiLibraryCategory(record.aiCategory), aiReview: state,
        createdAt: record.createdAt?.toDate?.().toISOString?.() ?? '',
        updatedAt: record.updatedAt?.toDate?.().toISOString?.() ?? '',
        importedAt: record.importedAt?.toDate?.().toISOString?.() ?? '' });
    }
    if (logs.length === 10) break;
  }
  return { logs, ...(scanned > 0 && scanned < candidates.length
    ? { nextCursor: Buffer.from(JSON.stringify({ v: 1, id: candidates[scanned - 1].id })).toString('base64url') } : {}) };
});
