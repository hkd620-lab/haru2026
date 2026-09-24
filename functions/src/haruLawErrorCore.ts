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
const MAX_PDF_STRUCTURE_SCAN_BYTES = 1024 * 1024;

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

function getPdfStructureTail(bytes: Uint8Array): { start: number; text: string } {
  const start = Math.max(0, bytes.byteLength - MAX_PDF_STRUCTURE_SCAN_BYTES);
  const tail = bytes.subarray(start);
  return {
    start,
    text: Buffer.from(tail.buffer, tail.byteOffset, tail.byteLength).toString('latin1'),
  };
}

function extractPdfDictionary(source: string, searchFrom: number): string | null {
  const start = source.indexOf('<<', searchFrom);
  if (start < 0) return null;
  let depth = 0;
  let literalDepth = 0;
  let escaped = false;
  let inComment = false;
  for (let index = start; index < source.length - 1; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inComment) {
      if (char === '\r' || char === '\n') inComment = false;
      continue;
    }
    if (literalDepth > 0) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '(') {
        literalDepth += 1;
      } else if (char === ')') {
        literalDepth -= 1;
      }
      continue;
    }
    if (char === '%') {
      inComment = true;
    } else if (char === '(') {
      literalDepth = 1;
    } else if (char === '<' && next === '<') {
      depth += 1;
      index += 1;
    } else if (char === '>' && next === '>') {
      depth -= 1;
      index += 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function getPdfXrefDictionary(pdf: string, start: number, xrefOffset: number): string | null {
  const relativeXrefOffset = xrefOffset - start;
  if (!Number.isSafeInteger(xrefOffset) || relativeXrefOffset < 0 || relativeXrefOffset >= pdf.length) {
    return null;
  }
  const xrefSection = pdf.slice(relativeXrefOffset, relativeXrefOffset + 64 * 1024);
  const contentStart = xrefSection.search(/\S/);
  if (contentStart < 0) return null;
  if (/^xref\b/.test(xrefSection.slice(contentStart))) {
    const trailerMatch = /(?:^|[\r\n])trailer\b/g.exec(xrefSection.slice(contentStart));
    if (!trailerMatch) return null;
    return extractPdfDictionary(xrefSection, contentStart + trailerMatch.index + trailerMatch[0].length);
  }
  const objectHeader = /^\s*\d+\s+\d+\s+obj\b/.exec(xrefSection);
  if (!objectHeader) return null;
  const dictionary = extractPdfDictionary(xrefSection, objectHeader[0].length);
  return dictionary && /\/Type\s*\/XRef\b/.test(dictionary) ? dictionary : null;
}

function hasPdfEncryptionDictionary(bytes: Uint8Array): boolean {
  const { start, text: pdf } = getPdfStructureTail(bytes);
  const startXrefMatches = [...pdf.matchAll(/startxref[\t \r\n]+(\d+)/g)];
  let xrefOffset = Number(startXrefMatches.at(-1)?.[1]);
  const visited = new Set<number>();
  for (let depth = 0; depth < 16 && Number.isSafeInteger(xrefOffset) && !visited.has(xrefOffset); depth += 1) {
    visited.add(xrefOffset);
    const dictionary = getPdfXrefDictionary(pdf, start, xrefOffset);
    if (!dictionary) break;
    if (/\/Encrypt\b/.test(dictionary)) return true;
    const previous = /\/Prev\s+(\d+)/.exec(dictionary);
    if (!previous) break;
    xrefOffset = Number(previous[1]);
  }
  return false;
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
    if (hasPdfEncryptionDictionary(bytes)) {
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
  const hasAttachmentSubject = /(attachment|document|pdf|image|inline.?data|mime|file|pages?)/i.test(evidence);
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
