import { PDFDocument } from 'pdf-lib';

export const HARULAW_ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export type HaruLawErrorReason =
  | 'LAW_API_TEMPORARY_UNAVAILABLE'
  | 'ATTACHMENT_PDF_UNREADABLE'
  | 'ATTACHMENT_TOTAL_SIZE_EXCEEDED'
  | 'ATTACHMENT_UNSUPPORTED_TYPE'
  | 'ATTACHMENT_CONTENT_UNREADABLE'
  | 'HARULAW_AI_TEMPORARY_UNAVAILABLE'
  | 'HARULAW_PROCESSING_FAILED';

export type HaruLawProcessingStage =
  | 'attachment_load'
  | 'keyword_ai'
  | 'law_api_search'
  | 'law_api_detail'
  | 'article_select_ai'
  | 'summary_ai';

export type HaruLawErrorDescriptor = {
  code: 'invalid-argument' | 'unavailable' | 'internal';
  message: string;
  details: {
    reason: HaruLawErrorReason;
    retryable: boolean;
  };
};

const ALLOWED_MIME_TYPES = new Set<string>(HARULAW_ALLOWED_ATTACHMENT_MIME_TYPES);
const TEMPORARY_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ENETUNREACH',
  'RESOURCE_EXHAUSTED',
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
]);
export const HARULAW_LAW_API_MAX_ATTEMPTS = 3;

export type HaruLawApiFailureDiagnostics = {
  failureKind: 'timeout' | 'connection' | 'upstream_http' | 'unknown';
  upstreamErrorCode: string | null;
  hasUpstreamHttpStatus: boolean;
  upstreamHttpStatus: number | null;
  attempts: number;
  apiElapsedMs: number;
};

const LAW_API_TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);
const LAW_API_CONNECTION_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'ENETUNREACH',
  'EHOSTUNREACH', 'EPIPE',
]);
const LAW_API_SAFE_ERROR_CODES = new Set([
  ...LAW_API_TIMEOUT_CODES, ...LAW_API_CONNECTION_CODES,
  'ERR_NETWORK', 'ERR_BAD_REQUEST', 'ERR_BAD_RESPONSE', 'ERR_CANCELED',
  'ERR_FR_TOO_MANY_REDIRECTS', 'ERR_INVALID_URL',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export class HaruLawApiTemporaryError extends Error {
  readonly code = 'LAW_API_TEMPORARY_UNAVAILABLE';
  readonly status?: number;
  readonly diagnostics?: HaruLawApiFailureDiagnostics;

  constructor(error: unknown, diagnostics?: HaruLawApiFailureDiagnostics) {
    super('LAW_API_TEMPORARY_UNAVAILABLE');
    this.name = 'HaruLawApiTemporaryError';
    this.status = readStatus(error);
    this.diagnostics = diagnostics;
  }
}

export function isAllowedHaruLawAttachmentMime(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(String(mimeType || '').trim().toLowerCase());
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

function isIsoBmffHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp') return false;
  const brands = String.fromCharCode(...bytes.slice(8, Math.min(bytes.length, 40))).toLowerCase();
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'heif', 'mif1', 'msf1']
    .some((brand) => brands.includes(brand));
}

export async function getHaruLawAttachmentContentError(
  mimeType: string,
  bytes: Uint8Array,
): Promise<HaruLawErrorReason | null> {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  if (!isAllowedHaruLawAttachmentMime(normalizedMimeType)) {
    return 'ATTACHMENT_UNSUPPORTED_TYPE';
  }

  if (normalizedMimeType === 'application/pdf') {
    if (bytes.length < 8 || !startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      return 'ATTACHMENT_PDF_UNREADABLE';
    }
    try {
      await PDFDocument.load(bytes, { updateMetadata: false });
    } catch {
      return 'ATTACHMENT_PDF_UNREADABLE';
    }
    return null;
  }

  const signatureMatches = normalizedMimeType === 'image/png'
    ? startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : normalizedMimeType === 'image/jpeg'
      ? startsWithBytes(bytes, [0xff, 0xd8, 0xff])
      : normalizedMimeType === 'image/webp'
        ? bytes.length >= 12
          && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
          && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
        : isIsoBmffHeif(bytes);

  return signatureMatches ? null : 'ATTACHMENT_UNSUPPORTED_TYPE';
}

function readErrorChain(error: unknown): Array<{
  code?: unknown;
  status?: unknown;
  response?: { status?: unknown; data?: unknown };
  cause?: unknown;
}> {
  const chain = [];
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current) && chain.length < 6) {
    seen.add(current);
    const candidate = current as {
      code?: unknown;
      status?: unknown;
      response?: { status?: unknown; data?: unknown };
      cause?: unknown;
    };
    chain.push(candidate);
    current = candidate.cause;
  }
  return chain;
}

function readStatus(error: unknown): number | undefined {
  for (const candidate of readErrorChain(error)) {
    const status = Number(candidate?.response?.status ?? candidate?.status ?? candidate?.code);
    if (Number.isFinite(status)) return status;
  }
  return undefined;
}

function hasTemporaryErrorCode(error: unknown): boolean {
  return readErrorChain(error).some((candidate) => {
    const code = String(candidate?.code ?? '').trim().toUpperCase();
    return TEMPORARY_ERROR_CODES.has(code);
  });
}

export function isRetryableLawApiError(error: unknown): boolean {
  const candidate = error as { response?: unknown } | null;
  const status = readStatus(error);
  if (status !== undefined) return status === 429 || status >= 500;
  if (hasTemporaryErrorCode(error)) return true;
  return !candidate?.response;
}

function getLawApiFailureDiagnostics(
  error: unknown,
  attempts: number,
  apiElapsedMs: number,
): HaruLawApiFailureDiagnostics {
  const chain = readErrorChain(error);
  // Only response.status proves an upstream HTTP response. Never use the
  // callable's status, raw messages, URLs, request config, or response bodies.
  const upstreamHttpStatus = chain.map((candidate) => candidate.response?.status)
    .find((status): status is number => typeof status === 'number'
      && Number.isInteger(status) && status >= 100 && status <= 599) ?? null;
  const codes = chain.map((candidate) => typeof candidate.code === 'string'
    ? candidate.code.trim().toUpperCase() : '');
  const causeCode = codes.find((code) => LAW_API_TIMEOUT_CODES.has(code)
    || LAW_API_CONNECTION_CODES.has(code));
  const upstreamErrorCode = causeCode
    ?? codes.find((code) => LAW_API_SAFE_ERROR_CODES.has(code)) ?? null;
  const failureKind = upstreamHttpStatus !== null && upstreamHttpStatus >= 300
    ? 'upstream_http'
    : upstreamHttpStatus !== null ? 'unknown'
      : causeCode && LAW_API_TIMEOUT_CODES.has(causeCode) ? 'timeout'
        : causeCode && LAW_API_CONNECTION_CODES.has(causeCode) ? 'connection' : 'unknown';
  return {
    failureKind,
    upstreamErrorCode,
    hasUpstreamHttpStatus: upstreamHttpStatus !== null,
    upstreamHttpStatus,
    attempts,
    apiElapsedMs: Math.max(0, Math.round(apiElapsedMs)),
  };
}

export async function runHaruLawApiRequestWithRetry<T>(
  request: () => Promise<T>,
  options: {
    onRetry?: (attempt: number, error: unknown, diagnostics: HaruLawApiFailureDiagnostics) => void;
    onFailure?: (diagnostics: HaruLawApiFailureDiagnostics) => void;
    wait?: (delayMs: number) => Promise<void>;
    nowMs?: () => number;
  } = {},
): Promise<T> {
  const nowMs = options.nowMs ?? (() => performance.now());
  const startedAt = nowMs();
  for (let attempt = 1; attempt <= HARULAW_LAW_API_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const retryable = isRetryableLawApiError(error);
      const diagnostics = getLawApiFailureDiagnostics(error, attempt, nowMs() - startedAt);
      if (!retryable || attempt === HARULAW_LAW_API_MAX_ATTEMPTS) {
        try { options.onFailure?.(diagnostics); } catch { /* Diagnostics must not replace the API error. */ }
        if (!retryable) throw error;
        throw new HaruLawApiTemporaryError(error, diagnostics);
      }
      try { options.onRetry?.(attempt, error, diagnostics); } catch { /* Preserve retry behavior if logging fails. */ }
      await (options.wait ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))))(attempt * 700);
    }
  }
  throw new Error('HARULAW_LAW_API_RETRY_EXHAUSTED');
}

export function isTemporaryHaruLawAiError(error: unknown): boolean {
  const status = readStatus(error);
  return (status !== undefined && (status === 429 || status >= 500)) || hasTemporaryErrorCode(error);
}

export function classifyHaruLawAiError(
  error: unknown,
  hasAttachments: boolean,
): HaruLawErrorReason {
  if (isTemporaryHaruLawAiError(error)) return 'HARULAW_AI_TEMPORARY_UNAVAILABLE';

  const candidate = error as {
    message?: unknown;
    details?: unknown;
    errorDetails?: unknown;
    response?: { data?: unknown };
  } | null;
  const evidence = [
    candidate?.message,
    candidate?.details,
    candidate?.errorDetails,
    candidate?.response?.data,
  ].map((value) => {
    if (typeof value === 'string') return value;
    try {
      return value == null ? '' : JSON.stringify(value);
    } catch {
      return '';
    }
  }).join(' ').toLowerCase();
  const hasAttachmentSubject = /\b(?:attachments?|documents?|pdfs?|images?|inline.?data|mime|files?|pages?)\b/i.test(evidence);
  const hasReadFailure = /(?:cannot|could not|unable to|fail(?:ed)? to).{0,120}(?:read|process|parse|decode)|(?:read|process|parse|decode).{0,120}(?:invalid|fail|unsupported)|corrupt|encrypt|unsupported.{0,40}(?:mime|file|format|type)|no pages|empty file|password.?protected/i.test(evidence);
  if (hasAttachments && hasAttachmentSubject && hasReadFailure) {
    return 'ATTACHMENT_CONTENT_UNREADABLE';
  }
  return 'HARULAW_PROCESSING_FAILED';
}

export function getHaruLawErrorDescriptor(reason: HaruLawErrorReason): HaruLawErrorDescriptor {
  switch (reason) {
    case 'LAW_API_TEMPORARY_UNAVAILABLE':
      return {
        code: 'unavailable',
        message: '공식 법령 서버에 잠시 연결할 수 없습니다.',
        details: { reason, retryable: true },
      };
    case 'ATTACHMENT_PDF_UNREADABLE':
      return {
        code: 'invalid-argument',
        message: '첨부한 PDF를 읽을 수 없습니다.',
        details: { reason, retryable: false },
      };
    case 'ATTACHMENT_TOTAL_SIZE_EXCEEDED':
      return {
        code: 'invalid-argument',
        message: '첨부파일의 전체 크기가 50MiB를 초과했습니다.',
        details: { reason, retryable: false },
      };
    case 'ATTACHMENT_UNSUPPORTED_TYPE':
      return {
        code: 'invalid-argument',
        message: '지원하지 않는 첨부파일 형식입니다.',
        details: { reason, retryable: false },
      };
    case 'ATTACHMENT_CONTENT_UNREADABLE':
      return {
        code: 'invalid-argument',
        message: '첨부파일에서 내용을 읽지 못했습니다.',
        details: { reason, retryable: false },
      };
    case 'HARULAW_AI_TEMPORARY_UNAVAILABLE':
      return {
        code: 'unavailable',
        message: 'AI 분석이 잠시 원활하지 않습니다.',
        details: { reason, retryable: true },
      };
    default:
      return {
        code: 'internal',
        message: '하루LAW 처리를 완료하지 못했습니다.',
        details: { reason: 'HARULAW_PROCESSING_FAILED', retryable: true },
      };
  }
}
