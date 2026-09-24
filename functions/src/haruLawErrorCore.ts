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
const TEMPORARY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const TEMPORARY_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EAI_AGAIN',
  'ENETUNREACH',
  'RESOURCE_EXHAUSTED',
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED',
]);
export const HARULAW_LAW_API_MAX_ATTEMPTS = 3;

export class HaruLawApiTemporaryError extends Error {
  readonly code = 'LAW_API_TEMPORARY_UNAVAILABLE';
  readonly status?: number;

  constructor(error: unknown) {
    super('LAW_API_TEMPORARY_UNAVAILABLE');
    this.name = 'HaruLawApiTemporaryError';
    this.status = readStatus(error);
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

export function getHaruLawAttachmentContentError(
  mimeType: string,
  bytes: Uint8Array,
): HaruLawErrorReason | null {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  if (!isAllowedHaruLawAttachmentMime(normalizedMimeType)) {
    return 'ATTACHMENT_UNSUPPORTED_TYPE';
  }

  if (normalizedMimeType === 'application/pdf') {
    if (bytes.length < 8 || !startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      return 'ATTACHMENT_PDF_UNREADABLE';
    }
    const searchablePdf = Buffer.from(bytes).toString('latin1');
    if (/\/Encrypt\b/.test(searchablePdf)) {
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

function readStatus(error: unknown): number | undefined {
  const candidate = error as { code?: unknown; status?: unknown; response?: { status?: unknown } } | null;
  const status = Number(candidate?.response?.status ?? candidate?.status ?? candidate?.code);
  return Number.isFinite(status) ? status : undefined;
}

function readCode(error: unknown): string {
  const candidate = error as { code?: unknown; status?: unknown } | null;
  return String(candidate?.code ?? candidate?.status ?? '').trim().toUpperCase();
}

export function isRetryableLawApiError(error: unknown): boolean {
  const candidate = error as { response?: unknown } | null;
  const status = readStatus(error);
  const code = readCode(error);
  if (status !== undefined) return TEMPORARY_STATUS_CODES.has(status);
  if (TEMPORARY_ERROR_CODES.has(code)) return true;
  return !candidate?.response;
}

export async function runHaruLawApiRequestWithRetry<T>(
  request: () => Promise<T>,
  options: {
    onRetry?: (attempt: number, error: unknown) => void;
    wait?: (delayMs: number) => Promise<void>;
  } = {},
): Promise<T> {
  for (let attempt = 1; attempt <= HARULAW_LAW_API_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const retryable = isRetryableLawApiError(error);
      if (!retryable) {
        throw error;
      }
      if (attempt === HARULAW_LAW_API_MAX_ATTEMPTS) throw new HaruLawApiTemporaryError(error);
      options.onRetry?.(attempt, error);
      await (options.wait ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))))(attempt * 700);
    }
  }
  throw new Error('HARULAW_LAW_API_RETRY_EXHAUSTED');
}

export function isTemporaryHaruLawAiError(error: unknown): boolean {
  const status = readStatus(error);
  const code = readCode(error);
  return (status !== undefined && TEMPORARY_STATUS_CODES.has(status)) || TEMPORARY_ERROR_CODES.has(code);
}

export function classifyHaruLawAiError(
  error: unknown,
  hasAttachments: boolean,
): HaruLawErrorReason {
  if (isTemporaryHaruLawAiError(error)) return 'HARULAW_AI_TEMPORARY_UNAVAILABLE';

  const candidate = error as { message?: unknown } | null;
  const status = readStatus(error);
  const message = String(candidate?.message ?? '').toLowerCase();
  const attachmentReadFailure = /(attachment|document|pdf|image|inline.?data|mime|decode|corrupt|encrypt|unsupported).*(read|process|parse|decode|invalid|fail|support)|(?:cannot|could not|unable to).*(read|process|decode)|no pages|empty file|password.?protected|failed to parse/i;
  if (hasAttachments && (status === 400 || status === 422 || attachmentReadFailure.test(message))) {
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
