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
  assert.deepEqual(getHaruLawErrorDescriptor('ATTACHMENT_TOTAL_SIZE_EXCEEDED'), {
    code: 'invalid-argument',
    message: '첨부파일의 전체 크기가 50MiB를 초과했습니다.',
    details: { reason: 'ATTACHMENT_TOTAL_SIZE_EXCEEDED', retryable: false },
  });

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

  const fixtureDirectory = path.resolve(__dirname, 'fixtures/harulaw-pdf');
  for (const fileName of ['general.pdf', 'incremental.pdf', 'classic-xref.pdf', 'xref-stream.pdf']) {
    assert.equal(
      await getHaruLawAttachmentContentError('application/pdf', fs.readFileSync(path.join(fixtureDirectory, fileName))),
      null,
      `${fileName} must be accepted`,
    );
  }
  for (const fileName of ['encrypted.pdf', 'corrupt.pdf']) {
    assert.equal(
      await getHaruLawAttachmentContentError('application/pdf', fs.readFileSync(path.join(fixtureDirectory, fileName))),
      'ATTACHMENT_PDF_UNREADABLE',
      `${fileName} must be rejected`,
    );
  }
  assert.equal(
    await getHaruLawAttachmentContentError('application/pdf', Buffer.from('ordinary text pretending to be a pdf')),
    'ATTACHMENT_PDF_UNREADABLE',
  );
  assert.equal(
    await getHaruLawAttachmentContentError('application/zip', Buffer.from('PK')),
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
    assert.equal(await getHaruLawAttachmentContentError(mimeType, content), null, `${mimeType} signature must pass`);
  }
  assert.equal(isAllowedHaruLawAttachmentMime('image/gif'), false);
  assert.equal(
    await getHaruLawAttachmentContentError('image/png', Buffer.from('not a png')),
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
    'Unable to process request; see documentation',
    'Unable to process profile response',
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
  assert.equal(classifyHaruLawAiError({ message: 'Unable to process attached files' }, true), 'ATTACHMENT_CONTENT_UNREADABLE');
  assert.equal(classifyHaruLawAiError({ message: 'Uploaded images failed to decode' }, true), 'ATTACHMENT_CONTENT_UNREADABLE');
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
  const attachmentLoaderSource = indexSource.slice(
    indexSource.indexOf('async function prepareHaruLawAttachments('),
    indexSource.indexOf('export const chatWithResult = onCall('),
  );
  assert.match(indexSource, /const HARULAW_ATTACH_MAX_PDF_BYTES = 50_000_000/);
  assert.match(indexSource, /const HARULAW_ATTACH_MAX_TOTAL_BYTES = 50 \* 1024 \* 1024/);
  assert.ok(
    attachmentLoaderSource.indexOf('await file.getMetadata()') < attachmentLoaderSource.indexOf('await file.download({ destination: tempPath })'),
    'all metadata validation must precede attachment downloads',
  );
  assert.match(attachmentLoaderSource, /metadataTotalBytes > HARULAW_ATTACH_MAX_TOTAL_BYTES/);
  assert.match(attachmentLoaderSource, /downloadedTotalBytes > HARULAW_ATTACH_MAX_TOTAL_BYTES/);
  assert.match(attachmentLoaderSource, /await fs\.promises\.readFile\(tempPath\)/);
  assert.match(attachmentLoaderSource, /ai\.files\.upload\(/);
  assert.match(attachmentLoaderSource, /fileParts\.push\(\{ fileData:/);
  assert.doesNotMatch(attachmentLoaderSource, /inlineData|toString\('base64'\)/);
  assert.match(attachmentLoaderSource, /export const cleanupHaruLawGeminiFiles = onSchedule\(/);
  assert.match(indexSource, /export const chatWithResult = onCall\([\s\S]{0,160}memory: '512MiB',[\s\S]{0,80}concurrency: 1/);
  assert.match(indexSource, /export const lawSearch = onCall\([\s\S]{0,220}memory: '1GiB',[\s\S]{0,80}concurrency: 1/);
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
