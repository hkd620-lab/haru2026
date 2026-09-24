const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  HaruLawApiTemporaryError,
  classifyHaruLawAiError,
  getHaruLawAttachmentContentError,
  getHaruLawErrorDescriptor,
  isAllowedHaruLawAttachmentMime,
  isRetryableLawApiError,
  runHaruLawApiRequestWithRetry,
} = require('../src/haruLawErrorCore.ts');

async function run() {
  for (const code of ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED']) {
    assert.equal(isRetryableLawApiError({ code }), true, `${code} must be retryable`);
  }
  assert.equal(isRetryableLawApiError(new Error('no response')), true);
  for (const status of [429, 500, 501, 502, 503, 504, 507, 520, 522]) {
    assert.equal(isRetryableLawApiError({ response: { status } }), true, `HTTP ${status} must be retryable`);
  }
  for (const status of [400, 401, 403, 404]) {
    assert.equal(isRetryableLawApiError({ response: { status } }), false, `HTTP ${status} must not be retried`);
  }

  let attempts = 0;
  const retryDelays = [];
  const timeoutError = Object.assign(new Error('socket included secret=do-not-leak'), { code: 'ETIMEDOUT' });
  await assert.rejects(
    runHaruLawApiRequestWithRetry(
      async () => {
        attempts += 1;
        throw timeoutError;
      },
      { wait: async (delay) => { retryDelays.push(delay); } },
    ),
    (error) => error instanceof HaruLawApiTemporaryError
      && error.code === 'LAW_API_TEMPORARY_UNAVAILABLE'
      && error.message.includes('do-not-leak') === false,
  );
  assert.equal(attempts, 3);
  assert.deepEqual(retryDelays, [700, 1400]);
  const lawApiDescriptor = getHaruLawErrorDescriptor('LAW_API_TEMPORARY_UNAVAILABLE');
  assert.deepEqual(lawApiDescriptor.details, { reason: 'LAW_API_TEMPORARY_UNAVAILABLE', retryable: true });
  assert.equal(lawApiDescriptor.code, 'unavailable');
  assert.equal(JSON.stringify(lawApiDescriptor).includes('do-not-leak'), false);
  assert.equal(JSON.stringify(lawApiDescriptor).toLowerCase().includes('stack'), false);

  const parseError = Object.assign(new SyntaxError('invalid normal XML response'), { response: { status: 200 } });
  let parseAttempts = 0;
  await assert.rejects(
    runHaruLawApiRequestWithRetry(async () => {
      parseAttempts += 1;
      throw parseError;
    }),
    (error) => error === parseError,
  );
  assert.equal(parseAttempts, 1);

  const validPdf = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
  assert.equal(getHaruLawAttachmentContentError('application/pdf', validPdf), null);
  assert.equal(
    getHaruLawAttachmentContentError('application/pdf', Buffer.from('ordinary text pretending to be a pdf')),
    'ATTACHMENT_PDF_UNREADABLE',
  );
  assert.equal(
    getHaruLawAttachmentContentError(
      'application/pdf',
      Buffer.from('%PDF-1.7\n1 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\ntrailer\n<< /Root 1 0 R /Encrypt 4 0 R >>\nstartxref\n0\n%%EOF'),
    ),
    'ATTACHMENT_PDF_UNREADABLE',
  );
  assert.equal(
    getHaruLawAttachmentContentError(
      'application/pdf',
      Buffer.from('%PDF-1.7\n1 0 obj\n<< /Length 31 >>\nstream\nVisible text mentions /Encrypt only\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF'),
    ),
    null,
  );
  const largePdf = Buffer.alloc((2 * 1024 * 1024) + 256, 0x41);
  Buffer.from('%PDF-1.7').copy(largePdf, 0);
  Buffer.from('\ntrailer\n<< /Root 1 0 R /Encrypt 4 0 R >>\nstartxref\n0\n%%EOF').copy(
    largePdf,
    largePdf.length - 72,
  );
  assert.equal(
    getHaruLawAttachmentContentError('application/pdf', largePdf),
    'ATTACHMENT_PDF_UNREADABLE',
  );
  assert.equal(
    getHaruLawAttachmentContentError('application/zip', Buffer.from('PK')),
    'ATTACHMENT_UNSUPPORTED_TYPE',
  );

  const allowedImages = [
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
    ['image/heic', Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypheic')])],
    ['image/heif', Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypmif1')])],
  ];
  for (const [mimeType, content] of allowedImages) {
    assert.equal(isAllowedHaruLawAttachmentMime(mimeType), true);
    assert.equal(getHaruLawAttachmentContentError(mimeType, content), null, `${mimeType} signature must pass`);
  }
  assert.equal(isAllowedHaruLawAttachmentMime('image/gif'), false);
  assert.equal(
    getHaruLawAttachmentContentError('image/png', Buffer.from('not a png')),
    'ATTACHMENT_UNSUPPORTED_TYPE',
  );

  assert.equal(
    classifyHaruLawAiError({ message: 'PDF document could not be processed' }, true),
    'ATTACHMENT_CONTENT_UNREADABLE',
  );
  assert.equal(
    classifyHaruLawAiError({ response: { status: 400 }, message: 'invalid argument' }, true),
    'HARULAW_PROCESSING_FAILED',
  );
  for (const message of [
    'Unable to process request because API key is invalid',
    'Could not process request',
    'Failed to parse provider response',
  ]) {
    assert.equal(
      classifyHaruLawAiError({ response: { status: 400 }, message }, true),
      'HARULAW_PROCESSING_FAILED',
      `generic provider error must not be blamed on attachments: ${message}`,
    );
  }
  assert.equal(
    classifyHaruLawAiError({ response: { status: 400, data: { error: 'PDF failed to parse' } } }, true),
    'ATTACHMENT_CONTENT_UNREADABLE',
  );
  assert.equal(
    classifyHaruLawAiError({ response: { status: 429 }, message: 'raw provider failure' }, true),
    'HARULAW_AI_TEMPORARY_UNAVAILABLE',
  );
  assert.equal(
    classifyHaruLawAiError({ status: 503 }, false),
    'HARULAW_AI_TEMPORARY_UNAVAILABLE',
  );
  for (const status of [501, 507, 520, 522]) {
    assert.equal(
      classifyHaruLawAiError({ status }, false),
      'HARULAW_AI_TEMPORARY_UNAVAILABLE',
      `AI HTTP ${status} must be temporary`,
    );
  }
  assert.equal(
    classifyHaruLawAiError(
      new TypeError('fetch failed', { cause: Object.assign(new Error('socket reset'), { code: 'ECONNRESET' }) }),
      false,
    ),
    'HARULAW_AI_TEMPORARY_UNAVAILABLE',
  );
  assert.equal(
    classifyHaruLawAiError(
      new TypeError('fetch failed', { cause: Object.assign(new Error('dns failed'), { code: 'ENOTFOUND' }) }),
      true,
    ),
    'HARULAW_AI_TEMPORARY_UNAVAILABLE',
  );
  assert.equal(classifyHaruLawAiError(new Error('unexpected implementation error'), false), 'HARULAW_PROCESSING_FAILED');

  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf8');
  const lawSearchSource = indexSource.slice(
    indexSource.indexOf('export const lawSearch = onCall('),
    indexSource.indexOf('export const prepareHaruLawSharePreview = onCall('),
  );
  assert.match(lawSearchSource, /processingStage = 'law_api_search'/);
  assert.match(lawSearchSource, /processingStage = 'law_api_detail'/);
  assert.match(lawSearchSource, /createHaruLawHttpsError\(reason\)/);
  assert.equal(lawSearchSource.includes("throw new HttpsError('internal', '법령 검색에 실패했습니다.')"), false);
}

run().then(() => console.log('haruLAW error core tests passed'));
