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

  // Mock requests only: preserve retry policy and verify terminal diagnostics,
  // including the last attempt that used to lose the underlying Axios code.
  const secret = 'private-question-token-attachment';
  const cases = [
    [{ code: 'ECONNABORTED' }, 'timeout', 'ECONNABORTED', null, 3],
    [{ code: 'ETIMEDOUT' }, 'timeout', 'ETIMEDOUT', null, 3],
    [{ code: 'ECONNRESET' }, 'connection', 'ECONNRESET', null, 3],
    [{ code: 'ENOTFOUND' }, 'connection', 'ENOTFOUND', null, 3],
    [{ code: 'ECONNREFUSED' }, 'connection', 'ECONNREFUSED', null, 3],
    [{ code: 'ERR_NETWORK', cause: { code: 'EHOSTUNREACH' } }, 'connection', 'EHOSTUNREACH', null, 3],
    [{ code: 'ERR_BAD_RESPONSE', response: { status: 503 } }, 'upstream_http', 'ERR_BAD_RESPONSE', 503, 3],
    [{ response: { status: 504 } }, 'upstream_http', null, 504, 3],
    [{ response: { status: 429 } }, 'upstream_http', null, 429, 3],
    [{ code: 'ERR_BAD_REQUEST', response: { status: 400 } }, 'upstream_http', 'ERR_BAD_REQUEST', 400, 1],
    [{ response: { status: 200 } }, 'unknown', null, 200, 1],
    [{ code: 'ERR_CANCELED' }, 'unknown', 'ERR_CANCELED', null, 3],
    [{ code: secret, status: 503 }, 'unknown', null, null, 3],
  ];
  for (const [mock, failureKind, upstreamErrorCode, upstreamHttpStatus, expectedAttempts] of cases) {
    const failure = Object.assign(new Error(secret), mock, {
      config: { url: `https://example.invalid/?token=${secret}`, data: secret },
    });
    if (failure.response) failure.response.data = secret;
    let clock = 0;
    let calls = 0;
    const retries = [];
    const terminal = [];
    await assert.rejects(runHaruLawApiRequestWithRetry(async () => {
      calls += 1;
      clock += 10000;
      throw failure;
    }, {
      nowMs: () => clock,
      wait: async (delay) => { clock += delay; },
      onRetry: (attempt, error, diagnostics) => {
        assert.equal(error, failure);
        assert.equal(attempt, diagnostics.attempts);
        retries.push(diagnostics);
      },
      onFailure: (diagnostics) => { terminal.push(diagnostics); },
    }), (error) => {
      if (expectedAttempts === 1) return error === failure;
      assert.equal(error instanceof HaruLawApiTemporaryError, true);
      assert.deepEqual(error.diagnostics, terminal[0]);
      assert.equal(JSON.stringify(error).includes(secret), false);
      return true;
    });
    assert.equal(calls, expectedAttempts);
    assert.equal(terminal.length, 1);
    assert.equal(retries.length, expectedAttempts - 1);
    assert.deepEqual(terminal[0], {
      failureKind, upstreamErrorCode,
      hasUpstreamHttpStatus: upstreamHttpStatus !== null,
      upstreamHttpStatus, attempts: expectedAttempts,
      apiElapsedMs: expectedAttempts === 3 ? 32100 : 10000,
    });
    assert.equal(JSON.stringify([...retries, ...terminal]).includes(secret), false);
  }
  // An eventual success must not be reported as a terminal failure.
  let recoveryAttempts = 0;
  let recoveryFailureCalls = 0;
  assert.equal(await runHaruLawApiRequestWithRetry(async () => {
    recoveryAttempts += 1;
    if (recoveryAttempts < 3) throw { code: 'ECONNRESET' };
    return 'recovered';
  }, {
    wait: async () => {},
    onRetry: () => { throw new Error('mock logger failure'); },
    onFailure: () => { recoveryFailureCalls += 1; },
  }), 'recovered');
  assert.equal(recoveryAttempts, 3);
  assert.equal(recoveryFailureCalls, 0, 'success must not emit terminal failure');
  await assert.rejects(runHaruLawApiRequestWithRetry(async () => { throw parseError; }, {
    onFailure: () => { throw new Error('mock logger failure'); },
  }), (error) => error === parseError);

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
  assert.match(indexSource, /const HARULAW_GEMINI_FINALIZATION_RESERVE_MS = 15_000/);
  assert.match(indexSource, /const HARULAW_POST_MODEL_WRITE_BUDGET_MS = 15_000/);
  assert.match(indexSource, /const HARULAW_ROLLBACK_DEADLINE_MARGIN_MS = 5_000/);
  assert.match(indexSource, /const HARULAW_CLEANUP_LEDGER_TIMEOUT_MS = 2_000/);
  assert.match(
    indexSource,
    /HARULAW_GEMINI_FILE_TIMEOUT_MS = HARULAW_CALLABLE_TIMEOUT_MS\s*- HARULAW_POST_MODEL_WRITE_BUDGET_MS\s*- HARULAW_GEMINI_FINALIZATION_RESERVE_MS/,
  );
  assert.ok(
    attachmentLoaderSource.indexOf('() => file.getMetadata()') < attachmentLoaderSource.indexOf('() => file.download({ destination: tempPath })'),
    'all metadata validation must precede attachment downloads',
  );
  assert.match(attachmentLoaderSource, /metadataTotalBytes > HARULAW_ATTACH_MAX_TOTAL_BYTES/);
  assert.match(attachmentLoaderSource, /downloadedTotalBytes > HARULAW_ATTACH_MAX_TOTAL_BYTES/);
  assert.match(attachmentLoaderSource, /await fs\.promises\.readFile\(tempPath\)/);
  assert.match(indexSource, /function getHaruLawRemainingWorkMs\(workDeadlineMs: number\)/);
  assert.match(indexSource, /candidate\?\.name === 'GoogleGenerativeAIAbortError'/);
  assert.match(indexSource, /async function runHaruLawModelBeforeDeadline<T>/);
  assert.match(indexSource, /async function runHaruLawOperationBeforeDeadline<T>/);
  assert.match(attachmentLoaderSource, /httpOptions: \{ timeout: remainingUploadMs \}/);
  assert.match(attachmentLoaderSource, /runHaruLawOperationBeforeDeadline\([\s\S]{0,120}\(\) => file\.getMetadata\(\)/);
  assert.match(attachmentLoaderSource, /runHaruLawOperationBeforeDeadline\([\s\S]{0,160}\(\) => file\.download\(\{ destination: tempPath \}\)/);
  assert.match(attachmentLoaderSource, /uploadClient\.files\.upload\(/);
  assert.match(attachmentLoaderSource, /Promise\.all\(\s*trackedFiles\.map/);
  assert.ok(
    attachmentLoaderSource.indexOf('await cleanupDocRef.set({')
      < attachmentLoaderSource.indexOf('const remainingUploadMs = Math.min('),
    'upload timeout must be recomputed after the cleanup ledger write',
  );
  assert.match(attachmentLoaderSource, /fileParts\.push\(\{ fileData:/);
  assert.doesNotMatch(attachmentLoaderSource, /inlineData|toString\('base64'\)/);
  assert.match(attachmentLoaderSource, /export const cleanupHaruLawGeminiFiles = onSchedule\(/);
  assert.match(indexSource, /export const chatWithResult = onCall\([\s\S]{0,160}memory: '512MiB',[\s\S]{0,80}concurrency: 1/);
  assert.match(indexSource, /runHaruLawModelBeforeDeadline\([\s\S]{0,700}abortSignal/);
  assert.match(indexSource, /async function commitAttachedResultChatSuccess/);
  assert.match(indexSource, /async function commitAttachedResultChatSuccessBeforeDeadline/);
  assert.match(indexSource, /return db\.runTransaction\([\s\S]{0,2600}\{ maxAttempts: 1 \}\)/);
  assert.match(indexSource, /lastCommittedRequestId: params\.requestId/);
  assert.match(indexSource, /lastCancelledRequestId: params\.requestId/);
  assert.match(indexSource, /runHaruLawOperationBeforeDeadline\(\s*recoveryDeadlineMs,[\s\S]{0,300}activeRequestId \|\| ''\) !== params\.requestId\) return/);
  assert.match(indexSource, /runHaruLawOperationBeforeDeadline\(\s*recoveryDeadlineMs,[\s\S]{0,160}threadRef\.get/);
  assert.match(indexSource, /usageForAnswer = await commitAttachedResultChatSuccessBeforeDeadline/);
  assert.match(indexSource, /await deleteTrackedHaruLawGeminiFiles\(haruLawFileClient, trackedGeminiFiles\)[\s\S]{0,220}commitAttachedResultChatSuccessBeforeDeadline/);
  assert.match(indexSource, /settleHaruLawCleanupLedgerWrite\(tracked\.cleanupDocRef\.delete\(\)\)/);
  assert.match(indexSource, /settleHaruLawRollbacksBeforeDeadline\([\s\S]{0,160}\[monthlyRollback, webSearchRollback\]/);
  assert.match(indexSource, /export const lawSearch = onCall\([\s\S]{0,220}memory: '1GiB',[\s\S]{0,80}concurrency: 1/);
  const lawSearchSource = indexSource.slice(
    indexSource.indexOf('export const lawSearch = onCall('),
    indexSource.indexOf('export const prepareHaruLawSharePreview = onCall('),
  );
  // Execute the actual handler in an isolated VM. Every external operation is
  // replaced with a mock; importing index.ts would initialize Firebase.
  const vm = require('node:vm');
  const ts = require('typescript');
  const handlerCode = ts.transpileModule(lawSearchSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const stage of ['law_api_search', 'law_api_detail']) {
    for (const mock of [{ code: 'ECONNABORTED' }, { code: 'ECONNRESET' }, { response: { status: 503 } }, { response: { status: 400 } }]) {
      let clock = 0;
      let apiCalls = 0;
      let modelCalls = 0;
      const logs = [];
      const usage = [];
      class MockHttpsError extends Error {
        constructor(code, message, details) { super(message); this.code = code; this.details = details; }
      }
      const context = {
        exports: {},
        require: (name) => {
          assert.equal(name, 'fast-xml-parser');
          return { XMLParser: class { parse(data) { return data; } } };
        },
        onCall: (_options, handler) => handler,
        HttpsError: MockHttpsError,
        HARULAW_GEMINI_FILE_TIMEOUT_MS: 45000,
        HARULAW_CALLABLE_TIMEOUT_MS: 90000,
        HARULAW_GEMINI_FINALIZATION_RESERVE_MS: 15000,
        LAW_API_KEY_SECRET: { value: () => secret },
        GEMINI_API_KEY_SECRET: { value: () => secret },
        enforceRateLimit: async () => {},
        readHaruLawAttachments: () => [],
        crypto: { randomUUID: () => 'mock-upload-id' },
        logger: Object.fromEntries(['warn', 'error', 'debug'].map((level) => [level, (...args) => logs.push({ level, args })])),
        console: { log: (...args) => logs.push({ level: 'console', args }) },
        axios: { get: async (_url, config) => {
          assert.equal(config.timeout, 10000);
          assert.equal(config.headers.Connection, 'close');
          apiCalls += 1;
          if (stage === 'law_api_detail' && apiCalls === 1) {
            return { data: { LawSearch: { law: { 법령명한글: secret, 법령일련번호: 'mock-id' } } } };
          }
          clock += 10000;
          throw Object.assign(new Error(secret), mock, { config: { url: `https://example.invalid/?token=${secret}` } });
        } },
        GoogleGenerativeAI: class {
          getGenerativeModel() { return { generateContent: async () => {
            modelCalls += 1;
            return { response: { text: () => secret } };
          } }; }
        },
        getGeminiUsage: () => ({ inputTokens: 1, outputTokens: 1 }),
        logAiUsage: async (entry) => { usage.push(entry); },
        AI_USAGE_PLAN: 'mock-plan',
        DEVELOPER_UIDS: new Set(),
        HaruLawApiTemporaryError,
        classifyHaruLawAiError,
        runHaruLawApiRequestWithRetry: (request, options) => runHaruLawApiRequestWithRetry(request, {
          ...options, nowMs: () => clock, wait: async (delay) => { clock += delay; },
        }),
        createHaruLawHttpsError: (reason) => {
          const descriptor = getHaruLawErrorDescriptor(reason);
          return new MockHttpsError(descriptor.code, descriptor.message, descriptor.details);
        },
        deleteTrackedHaruLawGeminiFiles: async () => {},
        removePreparedHaruLawAttachments: async () => {},
      };
      vm.runInNewContext(handlerCode, context);
      const isHttp400 = mock.response?.status === 400;
      await assert.rejects(context.exports.lawSearch({ auth: { uid: 'mock-user' }, data: { query: secret } }),
        (error) => error.code === (isHttp400 ? 'internal' : 'unavailable'));
      const finalLog = logs.find((entry) => entry.level === 'error').args[1];
      assert.equal(finalLog.stage, stage);
      assert.equal(finalLog.attempts, isHttp400 ? 1 : 3);
      assert.equal(finalLog.apiElapsedMs, isHttp400 ? 10000 : 32100);
      assert.equal(finalLog.upstreamErrorCode, mock.code ?? null);
      assert.equal(finalLog.upstreamHttpStatus, mock.response?.status ?? null);
      assert.equal(finalLog.hasUpstreamHttpStatus, !!mock.response);
      assert.equal(finalLog.failureKind, mock.response ? 'upstream_http' : mock.code === 'ECONNABORTED' ? 'timeout' : 'connection');
      assert.equal(apiCalls, (stage === 'law_api_detail' ? 1 : 0) + (isHttp400 ? 1 : 3));
      assert.equal(modelCalls, 1);
      assert.equal(usage.length, 2);
      assert.equal(usage[0].success, true);
      assert.equal(usage[1].success, false);
      assert.equal(JSON.stringify(logs).includes(secret), false);
      assert.equal(JSON.stringify(logs).includes('https://'), false);
      assert.equal(JSON.stringify(logs).includes('inputTokens'), false);
    }
  }
  assert.match(lawSearchSource, /processingStage = 'law_api_search'/);
  assert.match(lawSearchSource, /processingStage = 'law_api_detail'/);
  assert.match(lawSearchSource, /runHaruLawModelBeforeDeadline\([\s\S]{0,300}summaryModel\.generateContent\(summaryContents, \{ timeout: timeoutMs \}\)/);
  assert.match(lawSearchSource, /await deleteTrackedHaruLawGeminiFiles\(haruLawFileClient, trackedGeminiFiles\)[\s\S]{0,240}await logSuccess\(\)/);
  assert.match(lawSearchSource, /createHaruLawHttpsError\(reason\)/);
  assert.equal(lawSearchSource.includes("throw new HttpsError('internal', '법령 검색에 실패했습니다.')"), false);
}

run().then(() => console.log('haruLAW error core tests passed'));
