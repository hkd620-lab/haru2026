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
    return {
        start,
        text: Buffer.from(tail.buffer, tail.byteOffset, tail.byteLength).toString('latin1'),
    };
}
function extractPdfDictionary(source, searchFrom) {
    const start = source.indexOf('<<', searchFrom);
    if (start < 0)
        return null;
    let depth = 0;
    let literalDepth = 0;
    let escaped = false;
    let inComment = false;
    for (let index = start; index < source.length - 1; index += 1) {
        const char = source[index];
        const next = source[index + 1];
        if (inComment) {
            if (char === '\r' || char === '\n')
                inComment = false;
            continue;
        }
        if (literalDepth > 0) {
            if (escaped) {
                escaped = false;
            }
            else if (char === '\\') {
                escaped = true;
            }
            else if (char === '(') {
                literalDepth += 1;
            }
            else if (char === ')') {
                literalDepth -= 1;
            }
            continue;
        }
        if (char === '%') {
            inComment = true;
        }
        else if (char === '(') {
            literalDepth = 1;
        }
        else if (char === '<' && next === '<') {
            depth += 1;
            index += 1;
        }
        else if (char === '>' && next === '>') {
            depth -= 1;
            index += 1;
            if (depth === 0)
                return source.slice(start, index + 1);
        }
    }
    return null;
}
function isPdfWhitespace(byte) {
    return byte === 0x00 || byte === 0x09 || byte === 0x0a || byte === 0x0c || byte === 0x0d || byte === 0x20;
}
function matchesAsciiAt(bytes, offset, value) {
    return offset >= 0
        && offset + value.length <= bytes.length
        && [...value].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}
function getPdfXrefDescriptor(dictionary) {
    const previous = /\/Prev\s+(\d+)/.exec(dictionary);
    return {
        hasEncrypt: /\/Encrypt\b/.test(dictionary),
        ...(previous ? { previous: Number(previous[1]) } : {}),
    };
}
function isPdfDelimiter(byte) {
    return isPdfWhitespace(byte)
        || byte === 0x28 || byte === 0x29 || byte === 0x3c || byte === 0x3e
        || byte === 0x5b || byte === 0x5d || byte === 0x7b || byte === 0x7d
        || byte === 0x2f || byte === 0x25;
}
function skipPdfWhitespaceAndComments(bytes, from) {
    let cursor = from;
    while (cursor < bytes.length) {
        if (isPdfWhitespace(bytes[cursor])) {
            cursor += 1;
            continue;
        }
        if (bytes[cursor] !== 0x25)
            break;
        while (cursor < bytes.length && bytes[cursor] !== 0x0a && bytes[cursor] !== 0x0d)
            cursor += 1;
    }
    return cursor;
}
function extractPdfByteDictionaryDescriptor(bytes, searchFrom) {
    let start = -1;
    for (let index = searchFrom; index < bytes.length - 1; index += 1) {
        if (bytes[index] === 0x3c && bytes[index + 1] === 0x3c) {
            start = index;
            break;
        }
    }
    if (start < 0)
        return null;
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
    let previous;
    for (let index = start; index < bytes.length - 1; index += 1) {
        const byte = bytes[index];
        const next = bytes[index + 1];
        if (inComment) {
            if (byte === 0x0a || byte === 0x0d)
                inComment = false;
            continue;
        }
        if (literalDepth > 0) {
            if (escaped) {
                escaped = false;
            }
            else if (byte === 0x5c) {
                escaped = true;
            }
            else if (byte === 0x28) {
                literalDepth += 1;
            }
            else if (byte === 0x29) {
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
            if (byte === 0x28) {
                literalDepth = 1;
            }
            else if (byte === 0x5b) {
                arrayDepth += 1;
            }
            else if (byte === 0x5d) {
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
        }
        else if (byte === 0x28) {
            literalDepth = 1;
            literalWasTopLevelValue = depth === 1 && !topLevelExpectKey;
        }
        else if (byte === 0x5b) {
            arrayDepth = 1;
            arrayWasTopLevelValue = depth === 1 && !topLevelExpectKey;
        }
        else if (byte === 0x3c && next !== 0x3c) {
            inHexString = true;
            hexWasTopLevelValue = depth === 1 && !topLevelExpectKey;
        }
        else if (byte === 0x3c && next === 0x3c) {
            const nestedTopLevelValue = depth === 1 && !topLevelExpectKey;
            depth += 1;
            index += 1;
            if (nestedTopLevelValue)
                topLevelValueStarted = true;
        }
        else if (byte === 0x3e && next === 0x3e) {
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
        }
        else if (depth === 1 && byte === 0x2f) {
            let nameEnd = index + 1;
            while (nameEnd < bytes.length && !isPdfDelimiter(bytes[nameEnd]))
                nameEnd += 1;
            const name = Buffer.from(bytes.subarray(index + 1, nameEnd)).toString('latin1');
            const isKey = topLevelExpectKey || topLevelValueStarted;
            if (isKey) {
                pendingTopLevelKey = name;
                hasEncrypt || (hasEncrypt = name === 'Encrypt');
                if (name === 'Prev') {
                    let digitIndex = skipPdfWhitespaceAndComments(bytes, nameEnd);
                    let value = 0;
                    const digitStart = digitIndex;
                    while (digitIndex < bytes.length && bytes[digitIndex] >= 0x30 && bytes[digitIndex] <= 0x39) {
                        value = value * 10 + bytes[digitIndex] - 0x30;
                        digitIndex += 1;
                    }
                    if (digitIndex > digitStart)
                        previous = value;
                }
                topLevelExpectKey = false;
                topLevelValueStarted = false;
            }
            else {
                if (pendingTopLevelKey === 'Type' && name === 'XRef')
                    isXrefStream = true;
                pendingTopLevelKey = '';
                topLevelExpectKey = true;
            }
            index = nameEnd - 1;
        }
        else if (depth === 1 && !topLevelExpectKey && !isPdfWhitespace(byte)) {
            topLevelValueStarted = true;
        }
    }
    return null;
}
function getLargePdfXrefDescriptor(bytes, xrefOffset) {
    let cursor = xrefOffset;
    while (cursor < bytes.length && isPdfWhitespace(bytes[cursor]))
        cursor += 1;
    if (!matchesAsciiAt(bytes, cursor, 'xref')) {
        const objectHeader = Buffer.from(bytes.subarray(cursor, Math.min(bytes.length, cursor + 64)))
            .toString('latin1')
            .match(/^\d+\s+\d+\s+obj\b/);
        if (!objectHeader)
            return null;
        const descriptor = extractPdfByteDictionaryDescriptor(bytes, cursor + objectHeader[0].length);
        return (descriptor === null || descriptor === void 0 ? void 0 : descriptor.isXrefStream) ? descriptor : null;
    }
    const trailerToken = 'trailer';
    for (let index = cursor + 4; index <= bytes.length - trailerToken.length; index += 1) {
        if ((bytes[index - 1] === 0x0a || bytes[index - 1] === 0x0d)
            && matchesAsciiAt(bytes, index, trailerToken)
            && isPdfWhitespace(bytes[index + trailerToken.length])) {
            return extractPdfByteDictionaryDescriptor(bytes, index + trailerToken.length);
        }
    }
    return null;
}
function getPdfXrefDictionary(pdf, start, xrefOffset) {
    const relativeXrefOffset = xrefOffset - start;
    if (!Number.isSafeInteger(xrefOffset) || relativeXrefOffset < 0 || relativeXrefOffset >= pdf.length) {
        return null;
    }
    const xrefSection = pdf.slice(relativeXrefOffset);
    const contentStart = xrefSection.search(/\S/);
    if (contentStart < 0)
        return null;
    if (/^xref\b/.test(xrefSection.slice(contentStart))) {
        const trailerMatch = /(?:^|[\r\n])trailer\b/g.exec(xrefSection.slice(contentStart));
        if (!trailerMatch)
            return null;
        return extractPdfDictionary(xrefSection, contentStart + trailerMatch.index + trailerMatch[0].length);
    }
    const objectHeader = /^\s*\d+\s+\d+\s+obj\b/.exec(xrefSection);
    if (!objectHeader)
        return null;
    const dictionary = extractPdfDictionary(xrefSection, objectHeader[0].length);
    return dictionary && /\/Type\s*\/XRef\b/.test(dictionary) ? dictionary : null;
}
function hasPdfEncryptionDictionary(bytes) {
    var _a;
    const { start, text: pdf } = getPdfStructureTail(bytes);
    const startXrefMatches = [...pdf.matchAll(/startxref[\t \r\n]+(\d+)/g)];
    let xrefOffset = Number((_a = startXrefMatches.at(-1)) === null || _a === void 0 ? void 0 : _a[1]);
    const visited = new Set();
    for (let depth = 0; depth < 16 && Number.isSafeInteger(xrefOffset) && !visited.has(xrefOffset); depth += 1) {
        visited.add(xrefOffset);
        const descriptor = xrefOffset < start
            ? getLargePdfXrefDescriptor(bytes, xrefOffset)
            : (() => {
                const dictionary = getPdfXrefDictionary(pdf, start, xrefOffset);
                return dictionary ? getPdfXrefDescriptor(dictionary) : null;
            })();
        if (!descriptor)
            break;
        if (descriptor.hasEncrypt)
            return true;
        if (descriptor.previous === undefined)
            break;
        xrefOffset = descriptor.previous;
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
