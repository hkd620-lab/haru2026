import { doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export const AI_IMPORT_REQUEST_EVENT = 'haru:ai-import-request';
export const AI_IMPORT_PAYLOAD_EVENT = 'haru:ai-import-payload';
export const AI_IMPORT_RESULT_EVENT = 'haru:ai-import-result';

export type AiImportPayload = {
  importId: string;
  content: string;
  source: 'slack' | 'chatgpt.com' | 'claude.ai' | 'gemini.google.com';
  capturedAt: string;
  sourceUrl?: string;
};

const IMPORT_ID_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_SOURCES = new Set<AiImportPayload['source']>([
  'slack',
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
]);

export function parseAiImportPayload(value: unknown, expectedImportId: string): AiImportPayload {
  if (!value || typeof value !== 'object') throw new Error('가져올 기록 정보가 없습니다.');
  const candidate = value as Partial<AiImportPayload>;
  if (!IMPORT_ID_PATTERN.test(expectedImportId) || candidate.importId !== expectedImportId) {
    throw new Error('가져오기 요청 식별자가 올바르지 않습니다.');
  }
  if (typeof candidate.content !== 'string' || !candidate.content.trim() || candidate.content.length > 200_000) {
    throw new Error('저장할 본문이 없거나 너무 깁니다.');
  }
  if (!candidate.source || !ALLOWED_SOURCES.has(candidate.source)) {
    throw new Error('지원하지 않는 출처입니다.');
  }
  if (!candidate.capturedAt || Number.isNaN(Date.parse(candidate.capturedAt))) {
    throw new Error('작성 시각이 올바르지 않습니다.');
  }
  if (candidate.sourceUrl && (!candidate.sourceUrl.startsWith('https://') || candidate.sourceUrl.length > 2_000)) {
    throw new Error('출처 주소가 올바르지 않습니다.');
  }
  return {
    importId: candidate.importId,
    content: candidate.content.trim(),
    source: candidate.source,
    capturedAt: candidate.capturedAt,
    sourceUrl: candidate.sourceUrl,
  };
}

export async function saveAiImportForUser(uid: string, payload: AiImportPayload) {
  const recordId = `ai_import_${payload.importId}`;
  const recordRef = doc(db, 'users', uid, 'records', recordId);
  let duplicate = false;

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(recordRef);
    if (existing.exists()) {
      duplicate = true;
      return;
    }
    const createdAt = Timestamp.fromDate(new Date(payload.capturedAt));
    transaction.set(recordRef, {
      title: `[AI수집] ${payload.source === 'slack' ? 'Slack' : payload.source}`,
      content: payload.content,
      type: 'ai_log',
      source: payload.source,
      createdAt,
      updatedAt: createdAt,
      importedAt: Timestamp.now(),
      externalImportId: payload.importId,
      ...(payload.sourceUrl ? { sourceUrl: payload.sourceUrl } : {}),
    });
  });

  const verified = await getDoc(recordRef);
  if (!verified.exists() || verified.data().type !== 'ai_log' || verified.data().source !== payload.source) {
    throw new Error('HARU 기록 생성 여부를 확인하지 못했습니다.');
  }
  return { recordId, duplicate };
}
