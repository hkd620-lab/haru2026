import assert from 'node:assert/strict';
import {
  getHaruLawUserError,
  getHaruLawUserErrorByReason,
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

console.log('haruLAW frontend error mapping tests passed');
