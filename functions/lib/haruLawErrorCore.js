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
const pdf_lib_1 = require("pdf-lib");
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
class HaruLawApiTemporaryError extends Error {
    constructor(error, diagnostics) {
        super('LAW_API_TEMPORARY_UNAVAILABLE');
        this.code = 'LAW_API_TEMPORARY_UNAVAILABLE';
        this.name = 'HaruLawApiTemporaryError';
        this.status = readStatus(error);
        this.diagnostics = diagnostics;
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
async function getHaruLawAttachmentContentError(mimeType, bytes) {
    const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
    if (!isAllowedHaruLawAttachmentMime(normalizedMimeType)) {
        return 'ATTACHMENT_UNSUPPORTED_TYPE';
    }
    if (normalizedMimeType === 'application/pdf') {
        if (bytes.length < 8 || !startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
            return 'ATTACHMENT_PDF_UNREADABLE';
        }
        try {
            await pdf_lib_1.PDFDocument.load(bytes, { updateMetadata: false });
        }
        catch {
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
function getLawApiFailureDiagnostics(error, attempts, apiElapsedMs) {
    var _a, _b;
    const chain = readErrorChain(error);
    // Only response.status proves an upstream HTTP response. Never use the
    // callable's status, raw messages, URLs, request config, or response bodies.
    const upstreamHttpStatus = (_a = chain.map((candidate) => { var _a; return (_a = candidate.response) === null || _a === void 0 ? void 0 : _a.status; })
        .find((status) => typeof status === 'number'
        && Number.isInteger(status) && status >= 100 && status <= 599)) !== null && _a !== void 0 ? _a : null;
    const codes = chain.map((candidate) => typeof candidate.code === 'string'
        ? candidate.code.trim().toUpperCase() : '');
    const causeCode = codes.find((code) => LAW_API_TIMEOUT_CODES.has(code)
        || LAW_API_CONNECTION_CODES.has(code));
    const upstreamErrorCode = (_b = causeCode !== null && causeCode !== void 0 ? causeCode : codes.find((code) => LAW_API_SAFE_ERROR_CODES.has(code))) !== null && _b !== void 0 ? _b : null;
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
async function runHaruLawApiRequestWithRetry(request, options = {}) {
    var _a, _b, _c, _d;
    const nowMs = (_a = options.nowMs) !== null && _a !== void 0 ? _a : (() => performance.now());
    const startedAt = nowMs();
    for (let attempt = 1; attempt <= exports.HARULAW_LAW_API_MAX_ATTEMPTS; attempt += 1) {
        try {
            return await request();
        }
        catch (error) {
            const retryable = isRetryableLawApiError(error);
            const diagnostics = getLawApiFailureDiagnostics(error, attempt, nowMs() - startedAt);
            if (!retryable || attempt === exports.HARULAW_LAW_API_MAX_ATTEMPTS) {
                try {
                    (_b = options.onFailure) === null || _b === void 0 ? void 0 : _b.call(options, diagnostics);
                }
                catch { /* Diagnostics must not replace the API error. */ }
                if (!retryable)
                    throw error;
                throw new HaruLawApiTemporaryError(error, diagnostics);
            }
            try {
                (_c = options.onRetry) === null || _c === void 0 ? void 0 : _c.call(options, attempt, error, diagnostics);
            }
            catch { /* Preserve retry behavior if logging fails. */ }
            await ((_d = options.wait) !== null && _d !== void 0 ? _d : ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))))(attempt * 700);
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
    const hasAttachmentSubject = /\b(?:attachments?|documents?|pdfs?|images?|inline.?data|mime|files?|pages?)\b/i.test(evidence);
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
