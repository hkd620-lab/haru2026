import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HARULAW_ATTACH_MAX_PDF_BYTES,
  HARULAW_ATTACH_MAX_TOTAL_BYTES,
  getHaruLawUserError,
  getHaruLawUserErrorByReason,
  getHaruLawPdfReadErrorName,
  hasReadableHaruLawPdfHeader,
} from '../src/app/utils/haruLawError.ts';

const expected = {
  LAW_API_TEMPORARY_UNAVAILABLE: [
    '공식 법령 서버에 잠시 연결할 수 없습니다',
    '질문과 첨부파일은 그대로 유지했습니다. 잠시 후 다시 시도해 주세요.',
    true,
    '다시 시도',
  ],
  ATTACHMENT_PDF_UNREADABLE: [
    '이 PDF를 읽을 수 없습니다',
    '파일이 손상되었거나 암호가 설정됐을 수 있습니다. 문제가 있는 첨부를 제거한 뒤 PDF를 다시 저장하거나 다른 파일을 첨부해 주세요.',
    false,
    undefined,
  ],
  ATTACHMENT_TOTAL_SIZE_EXCEEDED: [
    '첨부파일의 전체 크기가 너무 큽니다',
    '한 번에 첨부할 수 있는 파일의 전체 크기는 50MiB입니다. 파일 수나 크기를 줄인 뒤 다시 시도해 주세요.',
    false,
    undefined,
  ],
  ATTACHMENT_UNSUPPORTED_TYPE: [
    '지원하지 않는 파일 형식입니다',
    'PNG, JPEG, WebP, HEIC 또는 PDF 파일로 다시 첨부해 주세요.',
    false,
    undefined,
  ],
  ATTACHMENT_CONTENT_UNREADABLE: [
    '파일에서 내용을 읽지 못했습니다',
    '스캔 상태가 흐리거나 내용이 없는 파일일 수 있습니다. 더 선명한 파일을 첨부하거나 질문에 핵심 내용을 직접 입력해 주세요.',
    false,
    undefined,
  ],
  HARULAW_AI_TEMPORARY_UNAVAILABLE: [
    'AI 분석이 잠시 원활하지 않습니다',
    '질문과 첨부파일은 그대로 유지했습니다. 잠시 후 다시 시도해 주세요.',
    true,
    '다시 시도',
  ],
  HARULAW_PROCESSING_FAILED: [
    '하루LAW 처리를 완료하지 못했습니다',
    '질문과 첨부파일은 그대로 유지했습니다. 잠시 후 다시 시도해 주세요. 같은 문제가 계속되면 첨부파일을 제거한 뒤 다시 확인해 주세요.',
    true,
    '다시 시도',
  ],
};

assert.equal(HARULAW_ATTACH_MAX_TOTAL_BYTES, 52_428_800);
assert.equal(HARULAW_ATTACH_MAX_PDF_BYTES, 50_000_000);

for (const [reason, [title, message, retryable, actionLabel]] of Object.entries(expected)) {
  assert.deepEqual(getHaruLawUserError({ details: { reason } }), {
    reason,
    title,
    message,
    retryable,
    ...(actionLabel ? { actionLabel } : {}),
  });
}

assert.deepEqual(
  getHaruLawUserError({ customData: { details: { reason: 'ATTACHMENT_PDF_UNREADABLE' } } }),
  getHaruLawUserErrorByReason('ATTACHMENT_PDF_UNREADABLE'),
);

for (const unknownError of [new Error('raw secret provider failure'), { code: 'functions/internal', message: '500 internal' }, null]) {
  const mapped = getHaruLawUserError(unknownError);
  assert.equal(mapped.reason, 'HARULAW_PROCESSING_FAILED');
  assert.equal(JSON.stringify(mapped).includes('raw secret provider failure'), false);
  assert.equal(JSON.stringify(mapped).includes('500 internal'), false);
}

assert.equal(hasReadableHaruLawPdfHeader(Buffer.from('%PDF-1.7')), true);
assert.equal(hasReadableHaruLawPdfHeader(Buffer.from('not pdf content')), false);
assert.equal(hasReadableHaruLawPdfHeader(Buffer.from('%PDF-')), false);

for (const name of ['NotReadableError', 'SecurityError', 'AbortError', 'InvalidStateError', 'TypeError']) {
  const error = new Error('synthetic private message');
  error.name = name;
  error.stack = 'synthetic private stack';
  assert.equal(getHaruLawPdfReadErrorName(error), name);
  assert.equal(getHaruLawPdfReadErrorName(new DOMException('synthetic private message', name)), name);
}

for (const input of [
  new Error('synthetic private message'),
  { name: 'synthetic private unknown name', message: 'synthetic private message', stack: 'synthetic private stack' },
  { name: 123 },
  {},
  null,
  undefined,
  'synthetic private string',
  123,
  true,
  Symbol('synthetic private symbol'),
]) {
  assert.equal(getHaruLawPdfReadErrorName(input), 'UnknownError');
}
assert.equal(getHaruLawPdfReadErrorName({ name: 'AbortError' }), 'AbortError');
assert.equal(getHaruLawPdfReadErrorName({ get name() { throw new Error('synthetic private getter failure'); } }), 'UnknownError');
assert.equal(getHaruLawPdfReadErrorName({
  name: 'SecurityError',
  get message() { assert.fail('normalization must not read message'); },
  get stack() { assert.fail('normalization must not read stack'); },
  get cause() { assert.fail('normalization must not read cause'); },
}), 'SecurityError');

const resultChatSource = await readFile(new URL('../src/app/components/ResultChatModal.tsx', import.meta.url), 'utf8');
const recordPageSource = await readFile(new URL('../src/app/pages/RecordPage.tsx', import.meta.url), 'utf8');
assert.match(
  resultChatSource,
  /attachments: pendingAttachmentsRef\.current\.length > 0\s+\? pendingAttachmentsRef\.current\s+: undefined/,
  'retry must use the current pending attachments after the user removes or replaces a file',
);
assert.doesNotMatch(resultChatSource, /retryRequest: userError\.retryable[\s\S]{0,160}attachments: attachmentsToSend/);
assert.match(
  resultChatSource,
  /const uploadScopeId = attachmentScopeRef\.current;[\s\S]*uploadingFilesRef\.current = true;[\s\S]*await file\.slice\(0, 8\)\.arrayBuffer\(\)\);[\s\S]*attachmentScopeRef\.current !== uploadScopeId/,
  'PDF validation must be tracked as active and abort if its attachment scope changes',
);
assert.match(
  resultChatSource,
  /if \(file\.type === 'application\/pdf'\) \{[\s\S]*try \{[\s\S]*await file\.slice\(0, 8\)\.arrayBuffer\(\)[\s\S]*\} catch \{[\s\S]*ATTACHMENT_PDF_UNREADABLE[\s\S]*setHaruLawErrorNotice\(\{ userError \}\)/,
  'ResultChatModal must map PDF header read failures to the structured unreadable-PDF notice',
);
assert.match(
  recordPageSource,
  /setUploadingLawFiles\(true\);[\s\S]*try \{[\s\S]*try \{[\s\S]*await file\.slice\(0, 8\)\.arrayBuffer\(\)\);[\s\S]*catch \(error\) \{[\s\S]*ATTACHMENT_PDF_UNREADABLE[\s\S]*finally \{[\s\S]*event\.target\.value = ''/,
  'RecordPage must report PDF header read failures and always reset the file input',
);
for (const [source, surface] of [[resultChatSource, 'ResultChatModal'], [recordPageSource, 'RecordPage']]) {
  assert.match(source, /HARULAW_ATTACH_MAX_TOTAL_BYTES/);
  assert.match(source, /HARULAW_ATTACH_MAX_PDF_BYTES/);
  assert.match(source, /ATTACHMENT_TOTAL_SIZE_EXCEEDED/);
  assert.match(source, /selectedTotalBytes/);
  assert.match(source, /sizeBytes: file\.size/);
  assert.match(
    source,
    /selectedTotalBytes > HARULAW_ATTACH_MAX_TOTAL_BYTES/,
    `${surface} must reject an over-limit selection before upload`,
  );
}

console.log('haruLAW frontend error mapping tests passed');
