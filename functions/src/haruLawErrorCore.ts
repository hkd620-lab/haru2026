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

function getPdfStructureTail(bytes: Uint8Array): Uint8Array {
  const start = Math.max(0, bytes.byteLength - MAX_PDF_STRUCTURE_SCAN_BYTES);
  return bytes.subarray(start);
}

function isPdfWhitespace(byte: number | undefined): boolean {
  return byte === 0x00 || byte === 0x09 || byte === 0x0a || byte === 0x0c || byte === 0x0d || byte === 0x20;
}

function matchesAsciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  return offset >= 0
    && offset + value.length <= bytes.length
    && [...value].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}

type PdfXrefDescriptor = { hasEncrypt: boolean; previous?: number; isXrefStream?: boolean };

function isPdfDelimiter(byte: number | undefined): boolean {
  return isPdfWhitespace(byte)
    || byte === 0x28 || byte === 0x29 || byte === 0x3c || byte === 0x3e
    || byte === 0x5b || byte === 0x5d || byte === 0x7b || byte === 0x7d
    || byte === 0x2f || byte === 0x25;
}

function skipPdfWhitespaceAndComments(bytes: Uint8Array, from: number): number {
  let cursor = from;
  while (cursor < bytes.length) {
    if (isPdfWhitespace(bytes[cursor])) {
      cursor += 1;
      continue;
    }
    if (bytes[cursor] !== 0x25) break;
    while (cursor < bytes.length && bytes[cursor] !== 0x0a && bytes[cursor] !== 0x0d) cursor += 1;
  }
  return cursor;
}

function decodePdfName(bytes: Uint8Array, start: number, end: number): string {
  const decoded: number[] = [];
  for (let index = start; index < end; index += 1) {
    if (bytes[index] === 0x23 && index + 2 < end) {
      const hex = String.fromCharCode(bytes[index + 1], bytes[index + 2]);
      if (/^[0-9a-f]{2}$/i.test(hex)) {
        decoded.push(Number.parseInt(hex, 16));
        index += 2;
        continue;
      }
    }
    decoded.push(bytes[index]);
  }
  return Buffer.from(decoded).toString('latin1');
}

function readPdfIntegerToken(bytes: Uint8Array, from: number): { value: number; end: number } | null {
  let cursor = skipPdfWhitespaceAndComments(bytes, from);
  const start = cursor;
  let value = 0;
  while (cursor < bytes.length && bytes[cursor] >= 0x30 && bytes[cursor] <= 0x39) {
    value = value * 10 + bytes[cursor] - 0x30;
    cursor += 1;
  }
  return cursor > start && isPdfDelimiter(bytes[cursor]) ? { value, end: cursor } : null;
}

function extractPdfByteDictionaryDescriptor(bytes: Uint8Array, searchFrom: number): PdfXrefDescriptor | null {
  const start = skipPdfWhitespaceAndComments(bytes, searchFrom);
  if (bytes[start] !== 0x3c || bytes[start + 1] !== 0x3c) return null;

  let depth = 0;
  let literalDepth = 0;
  let escaped = false;
  let inComment = false;
  let arrayDepth = 0;
  let inHexString = false;
  let literalWasTopLevelValue = false;
  let arrayWasTopLevelValue = false;
  let hexWasTopLevelValue = false;
  let topLevelExpectKey = true;
  let topLevelValueStarted = false;
  let pendingTopLevelKey = '';
  let hasEncrypt = false;
  let isXrefStream = false;
  let previous: number | undefined;
  for (let index = start; index < bytes.length - 1; index += 1) {
    const byte = bytes[index];
    const next = bytes[index + 1];
    if (inComment) {
      if (byte === 0x0a || byte === 0x0d) inComment = false;
      continue;
    }
    if (literalDepth > 0) {
      if (escaped) {
        escaped = false;
      } else if (byte === 0x5c) {
        escaped = true;
      } else if (byte === 0x28) {
        literalDepth += 1;
      } else if (byte === 0x29) {
        literalDepth -= 1;
        if (literalDepth === 0 && literalWasTopLevelValue) {
          topLevelExpectKey = true;
          literalWasTopLevelValue = false;
        }
      }
      continue;
    }
    if (inHexString) {
      if (byte === 0x3e) {
        inHexString = false;
        if (hexWasTopLevelValue) {
          topLevelExpectKey = true;
          hexWasTopLevelValue = false;
        }
      }
      continue;
    }
    if (arrayDepth > 0) {
      if (byte === 0x25) {
        inComment = true;
      } else if (byte === 0x28) {
        literalDepth = 1;
      } else if (byte === 0x5b) {
        arrayDepth += 1;
      } else if (byte === 0x5d) {
        arrayDepth -= 1;
        if (arrayDepth === 0 && arrayWasTopLevelValue) {
          topLevelExpectKey = true;
          arrayWasTopLevelValue = false;
        }
      }
      continue;
    }
    if (byte === 0x25) {
      inComment = true;
    } else if (byte === 0x28) {
      literalDepth = 1;
      literalWasTopLevelValue = depth === 1 && !topLevelExpectKey;
    } else if (byte === 0x5b) {
      arrayDepth = 1;
      arrayWasTopLevelValue = depth === 1 && !topLevelExpectKey;
    } else if (byte === 0x3c && next !== 0x3c) {
      inHexString = true;
      hexWasTopLevelValue = depth === 1 && !topLevelExpectKey;
    } else if (byte === 0x3c && next === 0x3c) {
      const nestedTopLevelValue = depth === 1 && !topLevelExpectKey;
      depth += 1;
      index += 1;
      if (nestedTopLevelValue) topLevelValueStarted = true;
    } else if (byte === 0x3e && next === 0x3e) {
      depth -= 1;
      index += 1;
      if (depth === 0) {
        return {
          hasEncrypt,
          ...(previous !== undefined ? { previous } : {}),
          ...(isXrefStream ? { isXrefStream: true } : {}),
        };
      }
      if (depth === 1 && topLevelValueStarted) {
        topLevelExpectKey = true;
        topLevelValueStarted = false;
      }
    } else if (depth === 1 && byte === 0x2f) {
      let nameEnd = index + 1;
      while (nameEnd < bytes.length && !isPdfDelimiter(bytes[nameEnd])) nameEnd += 1;
      const name = decodePdfName(bytes, index + 1, nameEnd);
      const isKey = topLevelExpectKey || topLevelValueStarted;
      if (isKey) {
        pendingTopLevelKey = name;
        hasEncrypt ||= name === 'Encrypt';
        if (name === 'Prev') {
          let digitIndex = skipPdfWhitespaceAndComments(bytes, nameEnd);
          let value = 0;
          const digitStart = digitIndex;
          while (digitIndex < bytes.length && bytes[digitIndex] >= 0x30 && bytes[digitIndex] <= 0x39) {
            value = value * 10 + bytes[digitIndex] - 0x30;
            digitIndex += 1;
          }
          if (digitIndex > digitStart) previous = value;
        }
        topLevelExpectKey = false;
        topLevelValueStarted = false;
      } else {
        if (pendingTopLevelKey === 'Type' && name === 'XRef') isXrefStream = true;
        pendingTopLevelKey = '';
        topLevelExpectKey = true;
      }
      index = nameEnd - 1;
    } else if (depth === 1 && !topLevelExpectKey && !isPdfWhitespace(byte)) {
      topLevelValueStarted = true;
    }
  }
  return null;
}

function getLargePdfXrefDescriptor(bytes: Uint8Array, xrefOffset: number): PdfXrefDescriptor | null {
  let cursor = skipPdfWhitespaceAndComments(bytes, xrefOffset);
  if (!matchesAsciiAt(bytes, cursor, 'xref')) {
    const objectNumber = readPdfIntegerToken(bytes, cursor);
    const generation = objectNumber && readPdfIntegerToken(bytes, objectNumber.end);
    cursor = generation ? skipPdfWhitespaceAndComments(bytes, generation.end) : -1;
    if (cursor < 0 || !matchesAsciiAt(bytes, cursor, 'obj') || !isPdfDelimiter(bytes[cursor + 3])) return null;
    const descriptor = extractPdfByteDictionaryDescriptor(bytes, cursor + 3);
    return descriptor?.isXrefStream ? descriptor : null;
  }

  const trailerToken = 'trailer';
  let inComment = false;
  for (let index = cursor + 4; index <= bytes.length - trailerToken.length; index += 1) {
    if (inComment) {
      if (bytes[index] === 0x0a || bytes[index] === 0x0d) inComment = false;
      continue;
    }
    if (bytes[index] === 0x25) {
      inComment = true;
      continue;
    }
    if (
      matchesAsciiAt(bytes, index, trailerToken)
      && isPdfDelimiter(bytes[index - 1])
      && isPdfDelimiter(bytes[index + trailerToken.length])
    ) {
      return extractPdfByteDictionaryDescriptor(bytes, index + trailerToken.length);
    }
  }
  return null;
}

function hasPdfEncryptionDictionary(bytes: Uint8Array): boolean {
  const tail = getPdfStructureTail(bytes);
  let xrefOffset = Number.NaN;
  let inComment = false;
  for (let index = 0; index <= tail.length - 9; index += 1) {
    if (inComment) {
      if (tail[index] === 0x0a || tail[index] === 0x0d) inComment = false;
      continue;
    }
    if (tail[index] === 0x25) {
      inComment = true;
      continue;
    }
    if (
      matchesAsciiAt(tail, index, 'startxref')
      && (index === 0 || isPdfDelimiter(tail[index - 1]))
      && isPdfDelimiter(tail[index + 9])
    ) {
      const offset = readPdfIntegerToken(tail, index + 9);
      if (offset) xrefOffset = offset.value;
    }
  }
  const visited = new Set<number>();
  while (Number.isSafeInteger(xrefOffset) && !visited.has(xrefOffset)) {
    visited.add(xrefOffset);
    const descriptor = getLargePdfXrefDescriptor(bytes, xrefOffset);
    if (!descriptor) break;
    if (descriptor.hasEncrypt) return true;
    if (descriptor.previous === undefined) break;
    xrefOffset = descriptor.previous;
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
