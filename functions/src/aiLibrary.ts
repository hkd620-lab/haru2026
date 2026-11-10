import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { AiLibraryCategoryBucket, isAiLibraryCategory, normalizeAiLibraryCategory } from './aiLibraryCategory';

const AI_LIBRARY_DEVELOPER_EMAIL = 'hkd620@gmail.com';
const IMPORT_ID_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_SOURCES = new Set(['slack', 'chatgpt.com', 'claude.ai', 'gemini.google.com']);
const AI_LIBRARY_PAGE_SIZE = 10;
const AI_LIBRARY_CURSOR_VERSION = 1;
const AI_LIBRARY_FILTER_SCAN_LIMIT = 100;
const AI_LIBRARY_CURSOR_MAX_LENGTH = 4_096;
const FIRESTORE_MIN_SECONDS = -62_135_596_800;
const FIRESTORE_MAX_SECONDS = 253_402_300_799;
export const AI_LIBRARY_DELETE_LIMIT = 10;

type AiLibraryCursor = {
  v: 1 | 2;
  category?: AiLibraryCategoryBucket;
  seconds: number;
  nanoseconds: number;
  id: string;
};

function invalidAiLibraryCursor(): never {
  throw new HttpsError('invalid-argument', '페이지 커서가 올바르지 않습니다.');
}

function decodeAiLibraryCursor(value: unknown, category?: AiLibraryCategoryBucket): AiLibraryCursor | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > AI_LIBRARY_CURSOR_MAX_LENGTH
    || !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return invalidAiLibraryCursor();
  }

  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64url') !== value) {
      return invalidAiLibraryCursor();
    }
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return invalidAiLibraryCursor();
    }
    const keys = Object.keys(parsed).sort();
    if (keys.join(',') !== (category === undefined ? 'id,nanoseconds,seconds,v' : 'category,id,nanoseconds,seconds,v')) {
      return invalidAiLibraryCursor();
    }
    const { v, seconds, nanoseconds, id } = parsed;
    if (
      v !== (category === undefined ? 1 : 2)
      || (category !== undefined && parsed.category !== category)
      || !Number.isInteger(seconds)
      || (seconds as number) < FIRESTORE_MIN_SECONDS
      || (seconds as number) > FIRESTORE_MAX_SECONDS
      || !Number.isInteger(nanoseconds)
      || (nanoseconds as number) < 0
      || (nanoseconds as number) > 999_999_999
      || typeof id !== 'string'
      || id.length === 0
      || id === '.'
      || id === '..'
      || id.includes('/')
      || /^__.*__$/.test(id)
      || Buffer.byteLength(id, 'utf8') > 1_500
    ) {
      return invalidAiLibraryCursor();
    }
    return {
      v: category === undefined ? 1 : 2,
      ...(category !== undefined ? { category } : {}),
      seconds: seconds as number,
      nanoseconds: nanoseconds as number,
      id,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    return invalidAiLibraryCursor();
  }
}

function encodeAiLibraryCursor(doc: admin.firestore.QueryDocumentSnapshot, category?: AiLibraryCategoryBucket): string {
  const createdAt = doc.get('createdAt');
  if (
    !createdAt
    || !Number.isInteger(createdAt.seconds)
    || !Number.isInteger(createdAt.nanoseconds)
  ) {
    throw new HttpsError('data-loss', '학습함 기록의 생성 시각이 올바르지 않습니다.');
  }
  const cursor: AiLibraryCursor = {
    v: category === undefined ? AI_LIBRARY_CURSOR_VERSION : 2,
    ...(category !== undefined ? { category } : {}),
    seconds: createdAt.seconds,
    nanoseconds: createdAt.nanoseconds,
    id: doc.id,
  };
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function hasAiLibraryDeveloperEmail(email: unknown, emailVerified: unknown): boolean {
  return typeof email === 'string'
    && email.trim().toLowerCase() === AI_LIBRARY_DEVELOPER_EMAIL
    && emailVerified === true;
}

export function requireAiLibraryDeveloper(request: { auth?: { uid: string; token: Record<string, unknown> } | null }): string {
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
  const category = request.data?.category;
  if (category !== undefined && category !== 'unclassified' && !isAiLibraryCategory(category)) {
    throw new HttpsError('invalid-argument', '분류가 올바르지 않습니다.');
  }
  const cursor = decodeAiLibraryCursor(request.data?.cursor, category);
  const records = admin.firestore().collection(`users/${uid}/records`);
  let query = records
    .where('type', '==', 'ai_log')
    .orderBy('createdAt', 'desc')
    .orderBy(admin.firestore.FieldPath.documentId(), 'desc');
  if (cursor) {
    query = query.startAfter(
      new admin.firestore.Timestamp(cursor.seconds, cursor.nanoseconds),
      records.doc(cursor.id),
    );
  }
  let pageDocs: admin.firestore.QueryDocumentSnapshot[];
  let nextCursor: string | undefined;
  if (category === undefined) {
    const snap = await query.limit(AI_LIBRARY_PAGE_SIZE + 1).get();
    pageDocs = snap.docs.slice(0, AI_LIBRARY_PAGE_SIZE);
    if (snap.docs.length > AI_LIBRARY_PAGE_SIZE) {
      nextCursor = encodeAiLibraryCursor(pageDocs[pageDocs.length - 1]);
    }
  } else {
    // Scan the existing indexed query; legacy missing fields need no new index.
    // Stop at the tenth match, not the last fetched document, to avoid skipping matches.
    const snap = await query.limit(AI_LIBRARY_FILTER_SCAN_LIMIT).get();
    pageDocs = [];
    let scanned = 0;
    for (const doc of snap.docs) {
      scanned += 1;
      if (normalizeAiLibraryCategory(doc.get('aiCategory')) === category) pageDocs.push(doc);
      if (pageDocs.length === AI_LIBRARY_PAGE_SIZE) break;
    }
    // A full scan may have more data, including when there were zero matches.
    // An extra terminal empty page is safe and keeps the read bound at 100.
    if (scanned > 0 && (scanned < snap.docs.length || snap.docs.length === AI_LIBRARY_FILTER_SCAN_LIMIT)) {
      nextCursor = encodeAiLibraryCursor(snap.docs[scanned - 1], category);
    }
  }
  const logs = pageDocs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      aiCategory: normalizeAiLibraryCategory(data.aiCategory),
      createdAt: data.createdAt?.toDate?.().toISOString?.() ?? data.createdAt ?? '',
      updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? data.updatedAt ?? '',
      importedAt: data.importedAt?.toDate?.().toISOString?.() ?? data.importedAt ?? '',
    };
  });
  return {
    logs,
    ...(nextCursor ? { nextCursor } : {}),
  };
});

export const saveAiLibraryImport = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = requireAiLibraryDeveloper(request);
  const data = (request.data || {}) as Record<string, unknown>;
  const category = data.category;
  if (category !== undefined && !isAiLibraryCategory(category)) {
    throw new HttpsError('invalid-argument', '분류가 올바르지 않습니다.');
  }
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
      ...(category !== undefined ? {
        aiCategory: category,
        aiCategorySource: 'manual',
        aiCategoryUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      } : {}),
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
  if (requestedIds.length > AI_LIBRARY_DELETE_LIMIT) {
    throw new HttpsError(
      'invalid-argument',
      `한 번에 최대 ${AI_LIBRARY_DELETE_LIMIT}개까지 삭제할 수 있습니다.`,
    );
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

export const moveAiLibraryLog = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = requireAiLibraryDeveloper(request);
  const { id, category, expectedCategory } = request.data || {};
  if (typeof id !== 'string' || !id || id === '.' || id === '..' || id.includes('/')
    || /^__.*__$/.test(id) || Buffer.byteLength(id, 'utf8') > 1_500
    || (category !== 'unclassified' && !isAiLibraryCategory(category))
    || (expectedCategory !== 'unclassified' && !isAiLibraryCategory(expectedCategory))) {
    throw new HttpsError('invalid-argument', '기록 또는 분류가 올바르지 않습니다.');
  }
  // UID comes exclusively from verified auth, never from the caller's payload.
  const ref = admin.firestore().doc(`users/${uid}/records/${id}`);
  await admin.firestore().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists || snap.data()?.type !== 'ai_log') {
      throw new HttpsError('failed-precondition', '본인의 AI 학습함 기록만 이동할 수 있습니다.');
    }
    // A classification finishing after the screen loaded must not defeat the user's choice.
    if (normalizeAiLibraryCategory(snap.data()?.aiCategory) !== expectedCategory
      && snap.data()?.aiCategorySource !== 'auto') {
      throw new HttpsError('aborted', '분류가 변경되었습니다. 새로고침한 후 다시 이동해 주세요.');
    }
    transaction.update(ref, {
      aiCategory: category === 'unclassified' ? admin.firestore.FieldValue.delete() : category,
      aiCategorySource: 'manual',
      aiCategoryUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { id, category };
});
