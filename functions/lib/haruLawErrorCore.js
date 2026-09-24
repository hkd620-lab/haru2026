"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HaruLawApiTemporaryError = exports.HARULAW_LAW_API_MAX_ATTEMPTS = exports.HARULAW_ALLOWED_ATTACHMENT_MIME_TYPES = void 0;
exports.isAllowedHaruLawAttachmentMime = isAllowedHaruLawAttachmentMime;
exports.getHaruLawAttachmentContentError = getHaruLawAttachmentContentError;
exports.isRetryableLawApiError = isRetryableLawApiError;
exports.runHaruLawApiRequestWithRetry = runHaruLawApiRequestWithRetry;
exports.isTemporaryHaruLawAiError = isTemporaryHaruLawAiError;
exports.classifyHaruLawAiError = classifyHaruLawAiError;
exports.getHaruLawErrorDescriptor = getHaruLawErrorDescriptor;
exports.HARULAW_ALLOWED_ATTACHMENT_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
];
const ALLOWED_MIME_TYPES = new Set(exports.HARULAW_ALLOWED_ATTACHMENT_MIME_TYPES);
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
exports.HARULAW_LAW_API_MAX_ATTEMPTS = 3;
const MAX_PDF_STRUCTURE_SCAN_BYTES = 1024 * 1024;
class HaruLawApiTemporaryError extends Error {
    constructor(error) {
        super('LAW_API_TEMPORARY_UNAVAILABLE');
        this.code = 'LAW_API_TEMPORARY_UNAVAILABLE';
        this.name = 'HaruLawApiTemporaryError';
        this.status = readStatus(error);
    }
}
exports.HaruLawApiTemporaryError = HaruLawApiTemporaryError;
function isAllowedHaruLawAttachmentMime(mimeType) {
    return ALLOWED_MIME_TYPES.has(String(mimeType || '').trim().toLowerCase());
}
function startsWithBytes(bytes, signature) {
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}
function isIsoBmffHeif(bytes) {
    if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp')
        return false;
    const brands = String.fromCharCode(...bytes.slice(8, Math.min(bytes.length, 40))).toLowerCase();
    return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'heif', 'mif1', 'msf1']
        .some((brand) => brands.includes(brand));
}
function getPdfStructureTail(bytes) {
    const start = Math.max(0, bytes.byteLength - MAX_PDF_STRUCTURE_SCAN_BYTES);
    const tail = bytes.subarray(start);
    return Buffer.from(tail.buffer, tail.byteOffset, tail.byteLength).toString('latin1');
}
function hasPdfEncryptionDictionary(bytes) {
    const pdf = getPdfStructureTail(bytes);
    const trailerPattern = /(?:^|[\r\n])trailer[\t \r\n]*<</g;
    for (let match = trailerPattern.exec(pdf); match; match = trailerPattern.exec(pdf)) {
        const end = pdf.indexOf('startxref', match.index);
        const trailer = pdf.slice(match.index, end >= 0 ? end : Math.min(pdf.length, match.index + 8192));
        if (/\/Encrypt\b/.test(trailer))
            return true;
    }
    const xrefPattern = /\/Type\s*\/XRef\b/g;
    for (let match = xrefPattern.exec(pdf); match; match = xrefPattern.exec(pdf)) {
        const objectStart = pdf.lastIndexOf('obj', match.index);
        const dictionaryStart = objectStart >= 0 ? pdf.indexOf('<<', objectStart) : -1;
        const streamStart = pdf.indexOf('stream', match.index);
        if (dictionaryStart >= 0 && dictionaryStart < match.index && streamStart > match.index) {
            const dictionary = pdf.slice(dictionaryStart, streamStart);
            if (/\/Encrypt\b/.test(dictionary))
                return true;
        }
    }
    return false;
}
function getHaruLawAttachmentContentError(mimeType, bytes) {
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
function readErrorChain(error) {
    const chain = [];
    let current = error;
    const seen = new Set();
    while (current && typeof current === 'object' && !seen.has(current) && chain.length < 6) {
        seen.add(current);
        const candidate = current;
        chain.push(candidate);
        current = candidate.cause;
    }
    return chain;
}
function readStatus(error) {
    var _a, _b, _c;
    for (const candidate of readErrorChain(error)) {
        const status = Number((_c = (_b = (_a = candidate === null || candidate === void 0 ? void 0 : candidate.response) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : candidate === null || candidate === void 0 ? void 0 : candidate.status) !== null && _c !== void 0 ? _c : candidate === null || candidate === void 0 ? void 0 : candidate.code);
        if (Number.isFinite(status))
            return status;
    }
    return undefined;
}
function hasTemporaryErrorCode(error) {
    return readErrorChain(error).some((candidate) => {
        var _a;
        const code = String((_a = candidate === null || candidate === void 0 ? void 0 : candidate.code) !== null && _a !== void 0 ? _a : '').trim().toUpperCase();
        return TEMPORARY_ERROR_CODES.has(code);
    });
}
function isRetryableLawApiError(error) {
    const candidate = error;
    const status = readStatus(error);
    if (status !== undefined)
        return status === 429 || status >= 500;
    if (hasTemporaryErrorCode(error))
        return true;
    return !(candidate === null || candidate === void 0 ? void 0 : candidate.response);
}
async function runHaruLawApiRequestWithRetry(request, options = {}) {
    var _a, _b;
    for (let attempt = 1; attempt <= exports.HARULAW_LAW_API_MAX_ATTEMPTS; attempt += 1) {
        try {
            return await request();
        }
        catch (error) {
            const retryable = isRetryableLawApiError(error);
            if (!retryable) {
                throw error;
            }
            if (attempt === exports.HARULAW_LAW_API_MAX_ATTEMPTS)
                throw new HaruLawApiTemporaryError(error);
            (_a = options.onRetry) === null || _a === void 0 ? void 0 : _a.call(options, attempt, error);
            await ((_b = options.wait) !== null && _b !== void 0 ? _b : ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))))(attempt * 700);
        }
    }
    throw new Error('HARULAW_LAW_API_RETRY_EXHAUSTED');
}
function isTemporaryHaruLawAiError(error) {
    const status = readStatus(error);
    return (status !== undefined && (status === 429 || status >= 500)) || hasTemporaryErrorCode(error);
}
function classifyHaruLawAiError(error, hasAttachments) {
    var _a;
    if (isTemporaryHaruLawAiError(error))
        return 'HARULAW_AI_TEMPORARY_UNAVAILABLE';
    const candidate = error;
    const evidence = [
        candidate === null || candidate === void 0 ? void 0 : candidate.message,
        candidate === null || candidate === void 0 ? void 0 : candidate.details,
        candidate === null || candidate === void 0 ? void 0 : candidate.errorDetails,
        (_a = candidate === null || candidate === void 0 ? void 0 : candidate.response) === null || _a === void 0 ? void 0 : _a.data,
    ].map((value) => {
        if (typeof value === 'string')
            return value;
        try {
            return value == null ? '' : JSON.stringify(value);
        }
        catch {
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
function getHaruLawErrorDescriptor(reason) {
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
