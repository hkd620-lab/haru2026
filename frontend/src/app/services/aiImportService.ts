import { getFunctions, httpsCallable } from 'firebase/functions';

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

export async function saveAiImportForUser(payload: AiImportPayload) {
  const callable = httpsCallable<AiImportPayload, { recordId: string; duplicate: boolean }>(
    getFunctions(undefined, 'asia-northeast3'),
    'saveAiLibraryImport',
  );
  const result = await callable(payload);
  return result.data;
}
