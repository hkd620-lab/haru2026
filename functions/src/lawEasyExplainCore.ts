import * as crypto from 'crypto';

export const LAW_EASY_EXPLAIN_PROMPT_VERSION = 'law_easy_explain_v2';
export const LAW_EASY_EXPLAIN_MAX_LAW_TEXT_LENGTH = 20_000;
export const LAW_EASY_EXPLAIN_MAX_USER_QUERY_LENGTH = 2_000;
export const LAW_EASY_EXPLAIN_MAX_METADATA_LENGTH = 200;

export class LawEasyExplainInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LawEasyExplainInputError';
  }
}

export class LawEasyExplainGeneratedTextError extends Error {
  constructor() {
    super('법령 해설 결과가 비어 있거나 오류 응답입니다.');
    this.name = 'LawEasyExplainGeneratedTextError';
  }
}

export type ValidatedLawEasyExplainInput = {
  normalizedLawText: string;
  normalizedUserQuery: string;
  lawName: string;
  articleStr: string;
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function requireBoundedString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new LawEasyExplainInputError(`${fieldName}은(는) 문자열이어야 합니다.`);
  }
  if (value.length > maxLength) {
    throw new LawEasyExplainInputError(`${fieldName}이(가) 허용 길이를 초과했습니다.`);
  }
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    throw new LawEasyExplainInputError(`${fieldName}을(를) 입력해주세요.`);
  }
  return normalized;
}

function optionalBoundedString(
  value: unknown,
  fieldName: string,
): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new LawEasyExplainInputError(`${fieldName}은(는) 문자열이어야 합니다.`);
  }
  if (value.length > LAW_EASY_EXPLAIN_MAX_METADATA_LENGTH) {
    throw new LawEasyExplainInputError(`${fieldName}이(가) 허용 길이를 초과했습니다.`);
  }
  return normalizeWhitespace(value);
}

export function validateLawEasyExplainInput(value: unknown): ValidatedLawEasyExplainInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LawEasyExplainInputError('요청 데이터 형식이 올바르지 않습니다.');
  }
  const data = value as Record<string, unknown>;
  return {
    normalizedLawText: requireBoundedString(
      data.lawText,
      'lawText',
      LAW_EASY_EXPLAIN_MAX_LAW_TEXT_LENGTH,
    ),
    normalizedUserQuery: requireBoundedString(
      data.userQuery,
      'userQuery',
      LAW_EASY_EXPLAIN_MAX_USER_QUERY_LENGTH,
    ),
    lawName: optionalBoundedString(data.lawName, 'lawName'),
    articleStr: optionalBoundedString(data.articleStr, 'articleStr'),
  };
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function buildLawConsultCacheKey(params: {
  normalizedLawText: string;
  normalizedUserQuery: string;
}): string {
  const digest = sha256Hex(JSON.stringify([
    LAW_EASY_EXPLAIN_PROMPT_VERSION,
    params.normalizedLawText,
    params.normalizedUserQuery,
  ]));
  return `${LAW_EASY_EXPLAIN_PROMPT_VERSION}_${digest}`;
}

export function normalizeValidLawExplanation(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const explanation = value.trim();
  if (!explanation) return null;
  if (/^(?:오류|에러)(?:\s|[:：-]|$)/.test(explanation)) return null;
  if (/^(?:error|failed|failure)(?:\s|[:：-]|$)/i.test(explanation)) return null;
  if (
    explanation.includes('법령 해설에 실패했습니다')
    || explanation.includes('AI자문을 불러오지 못했습니다')
  ) {
    return null;
  }
  return explanation;
}

type LawEasyExplainGeneration = {
  explanation: unknown;
};

export async function resolveLawEasyExplanation<T extends LawEasyExplainGeneration>(dependencies: {
  readCache: () => Promise<unknown>;
  generate: () => Promise<T>;
  recordUsage: (generation: T) => Promise<void>;
  writeCache: (explanation: string) => Promise<void>;
  onCacheReadError?: (error: unknown) => void;
  onCacheWriteError?: (error: unknown) => void;
}): Promise<{ explanation: string; cached: boolean }> {
  try {
    const cachedExplanation = normalizeValidLawExplanation(await dependencies.readCache());
    if (cachedExplanation) {
      return { explanation: cachedExplanation, cached: true };
    }
  } catch (error) {
    try {
      dependencies.onCacheReadError?.(error);
    } catch {
      // Cache diagnostics must never block generation.
    }
  }

  const generation = await dependencies.generate();
  const explanation = normalizeValidLawExplanation(generation.explanation);
  if (!explanation) {
    throw new LawEasyExplainGeneratedTextError();
  }
  await dependencies.recordUsage(generation);

  try {
    await dependencies.writeCache(explanation);
  } catch (error) {
    try {
      dependencies.onCacheWriteError?.(error);
    } catch {
      // A valid generated explanation must still be returned.
    }
  }

  return { explanation, cached: false };
}
