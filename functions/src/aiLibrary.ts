import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const AI_LIBRARY_DEVELOPER_EMAIL = 'hkd620@gmail.com';
const IMPORT_ID_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_SOURCES = new Set(['slack', 'chatgpt.com', 'claude.ai', 'gemini.google.com']);

export function hasAiLibraryDeveloperEmail(email: unknown, emailVerified: unknown): boolean {
  return typeof email === 'string'
    && email.trim().toLowerCase() === AI_LIBRARY_DEVELOPER_EMAIL
    && emailVerified === true;
}

function requireAiLibraryDeveloper(request: { auth?: { uid: string; token: Record<string, unknown> } | null }): string {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (!hasAiLibraryDeveloperEmail(
    request.auth.token.email,
    request.auth.token.email_verified,
  )) {
    throw new HttpsError('permission-denied', 'AI 학습함은 허용된 개발자 계정 전용입니다.');
  }
  return request.auth.uid;
}

export const listAiLibraryLogs = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = requireAiLibraryDeveloper(request);
  const snap = await admin.firestore().collection(`users/${uid}/records`)
    .where('type', '==', 'ai_log')
    .orderBy('createdAt', 'desc')
    .get();
  const logs = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString?.() ?? data.createdAt ?? '',
      updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? data.updatedAt ?? '',
      importedAt: data.importedAt?.toDate?.().toISOString?.() ?? data.importedAt ?? '',
    };
  });
  return { logs };
});

export const saveAiLibraryImport = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = requireAiLibraryDeveloper(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const importId = typeof data.importId === 'string' ? data.importId : '';
  const content = typeof data.content === 'string' ? data.content.trim() : '';
  const source = typeof data.source === 'string' ? data.source : '';
  const capturedAt = typeof data.capturedAt === 'string' ? data.capturedAt : '';
  const sourceUrl = typeof data.sourceUrl === 'string' ? data.sourceUrl : undefined;
  if (!IMPORT_ID_PATTERN.test(importId) || !content || content.length > 200_000 || !ALLOWED_SOURCES.has(source)) {
    throw new HttpsError('invalid-argument', '가져오기 데이터가 올바르지 않습니다.');
  }
  const capturedAtMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedAtMs) || (sourceUrl && (!sourceUrl.startsWith('https://') || sourceUrl.length > 2_000))) {
    throw new HttpsError('invalid-argument', '가져오기 메타데이터가 올바르지 않습니다.');
  }
  const recordId = `ai_import_${importId}`;
  const ref = admin.firestore().doc(`users/${uid}/records/${recordId}`);
  let duplicate = false;
  await admin.firestore().runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) {
      if (existing.data()?.type !== 'ai_log') throw new HttpsError('already-exists', '같은 식별자의 다른 기록이 존재합니다.');
      duplicate = true;
      return;
    }
    const createdAt = admin.firestore.Timestamp.fromMillis(capturedAtMs);
    transaction.set(ref, {
      title: `[AI수집] ${source === 'slack' ? 'Slack' : source}`,
      content,
      type: 'ai_log',
      source,
      createdAt,
      updatedAt: createdAt,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
      externalImportId: importId,
      ...(sourceUrl ? { sourceUrl } : {}),
    });
  });
  return { recordId, duplicate };
});

export const deleteAiLibraryLogs = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = requireAiLibraryDeveloper(request);
  const requestedIds = request.data?.ids;
  if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
    throw new HttpsError('invalid-argument', '삭제할 기록이 없습니다.');
  }
  if (requestedIds.length > 100) {
    throw new HttpsError('invalid-argument', '한 번에 최대 100개까지 삭제할 수 있습니다.');
  }
  if (requestedIds.some((id: unknown) => typeof id !== 'string' || !id || id.includes('/'))) {
    throw new HttpsError('invalid-argument', '삭제할 기록 식별자가 올바르지 않습니다.');
  }
  const ids = Array.from(new Set(requestedIds as string[]));
  const db = admin.firestore();
  const refs = ids.map((id) => db.doc(`users/${uid}/records/${id}`));
  await db.runTransaction(async (transaction) => {
    const snaps = await transaction.getAll(...refs);
    if (snaps.some((snap) => !snap.exists || snap.data()?.type !== 'ai_log')) {
      throw new HttpsError('failed-precondition', 'AI 학습함 기록만 삭제할 수 있습니다.');
    }
    refs.forEach((ref) => transaction.delete(ref));
  });
  return { deleted: refs.length };
});
