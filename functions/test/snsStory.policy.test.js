const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'functions/src/snsStory.ts'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const {
  SNS_STORY_MODEL,
  SNS_STORY_REGION,
  SNS_STORY_MEMORY,
  SNS_STORY_SUMMARY_TIMEOUT_MS,
  SNS_STORY_COMPRESSION_TIMEOUT_MS,
  SNS_STORY_FINAL_SYNOPSIS_TIMEOUT_MS,
  SNS_STORY_FINAL_STORY_TIMEOUT_MS,
  SNS_STORY_SUMMARY_MAX_OUTPUT_TOKENS,
  SNS_STORY_COMPRESSION_MAX_OUTPUT_TOKENS,
  SNS_STORY_FINAL_SYNOPSIS_MAX_OUTPUT_TOKENS,
  SNS_STORY_FINAL_STORY_MAX_OUTPUT_TOKENS,
  SNS_STORY_OPERATION_RECOVERY_MS,
  SNS_STORY_OPERATION_RECOVERY_LIMIT,
  normalizeSnsTimestampMs,
  toKstDateString,
  resolveSnsStoryRange,
  buildSnsStoryCounts,
  buildSnsStoryFinalPayloadHash,
  buildSnsStorySourceChunks,
  createSnsStoryGeminiCallBudget,
  groupSnsStoryChunks,
  reserveSnsStoryGeminiCall,
  validateSnsStoryGeneratedText,
  validateSnsStorySourceGroupBudget,
  assertSnsStoryIdempotencyCompatible,
  chooseSnsStoryRecoveredOperation,
  invokeSnsStoryGeminiText,
} = require('../lib/snsStory');

assert.strictEqual(SNS_STORY_MODEL, 'gemini-3.1-flash-lite');
assert.strictEqual(SNS_STORY_REGION, 'asia-northeast3');
assert.strictEqual(SNS_STORY_MEMORY, '512MiB');
assert.strictEqual(SNS_STORY_SUMMARY_TIMEOUT_MS, 45_000);
assert.strictEqual(SNS_STORY_COMPRESSION_TIMEOUT_MS, 45_000);
assert.strictEqual(SNS_STORY_FINAL_SYNOPSIS_TIMEOUT_MS, 90_000);
assert.strictEqual(SNS_STORY_FINAL_STORY_TIMEOUT_MS, 180_000);
assert.strictEqual(SNS_STORY_SUMMARY_MAX_OUTPUT_TOKENS, 1024);
assert.strictEqual(SNS_STORY_COMPRESSION_MAX_OUTPUT_TOKENS, 1024);
assert.strictEqual(SNS_STORY_FINAL_SYNOPSIS_MAX_OUTPUT_TOKENS, 2048);
assert.strictEqual(SNS_STORY_FINAL_STORY_MAX_OUTPUT_TOKENS, 8192);
assert.strictEqual(SNS_STORY_OPERATION_RECOVERY_MS, 24 * 60 * 60 * 1000);
assert.strictEqual(SNS_STORY_OPERATION_RECOVERY_LIMIT, 20);

assert(src.includes("users').doc(uid).collection('snsRecords')"), 'server must read users/{uid}/snsRecords');
assert(!src.includes('request.data.uid'), 'client uid must not be trusted');
assert(src.includes('record.isDeleted !== true'), 'isDeleted === true records must be excluded');
assert(src.includes('SNS_STORY_RANGE_TOO_LARGE'), 'large ranges must fail explicitly');
assert(src.includes('SNS_STORY_PHOTO_ONLY'), 'photo-only ranges must fail explicitly');
assert(src.includes('SNS_STORY_SOURCE_CHANGED'), 'source fingerprint changes must be rejected');
assert(src.includes("reserveMonthlyAiQuota(uid, 'sns_story_synopsis')"), 'synopsis must reserve shared monthly AI quota once');
assert(src.includes("reserveMonthlyAiQuota(uid, 'sns_story_final')"), 'final story must reserve shared monthly AI quota once');
assert(src.includes('rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation)'), 'failed AI work must roll back quota');
assert(src.includes('if (!billableAiWorkStarted)'), 'SNS story quota rollback must stop after a Gemini call begins');
assert(src.includes('requestPayloadHash'), 'final generation must store a normalized request payload hash');
assert(src.includes("where('requestPayloadHash', '==', requestPayloadHash)"), 'final generation must recover same-payload operations');
assert(src.includes('SNS_STORY_IDEMPOTENCY_CONFLICT'), 'same document id with different final inputs must fail explicitly');
assert(src.includes('await tx.getAll(...sourceRefs)'), 'final save transaction must read selected source docs atomically');
assert(src.includes('sanitizeSourceRecordIds(data.sourceRecordIds)'), 'final generation must require synopsis source ids');
assert(src.includes('loadSelectedSnsStorySourceByIds'), 'final generation must validate the synopsis source snapshot instead of the whole current range');
assert(src.includes("generationStatus: 'generating'"), 'final generation must create a lease state');
assert(src.includes('leaseExpiresAt'), 'generating state must have a retryable lease');
assert(src.includes("formats: ['에세이']"), 'completed records must be saved as essays');
assert(src.includes("source: 'sns_story'"), 'completed records must identify the sns_story source');
assert(src.includes('sns_story_source'), 'completed records must store source metadata');
assert(src.includes('confirmedSynopsis'), 'confirmed user-edited synopsis must be stored');
assert(src.includes('전체 SNS 원문은 제공되지 않습니다'), 'final function must not send all SNS raw text again');
assert(src.includes('{ timeout: options.timeoutMs }'), 'Gemini SDK calls must receive the real request timeout');
assert(src.includes('requestStartedAt + (540 * 1000)'), 'synopsis deadline must be based on handler entry time');
assert(src.includes('requestStartedAt + (300 * 1000)'), 'final deadline must be based on handler entry time');
assert(indexSrc.includes('generateSnsStorySynopsis'), 'index must export generateSnsStorySynopsis');
assert(indexSrc.includes('generateSnsStoryFinal'), 'index must export generateSnsStoryFinal');

const secondTimestamp = 1704063600;
const milliTimestamp = 1704063600000;
assert.strictEqual(normalizeSnsTimestampMs(secondTimestamp), milliTimestamp);
assert.strictEqual(normalizeSnsTimestampMs(milliTimestamp), milliTimestamp);
assert.strictEqual(toKstDateString(Date.UTC(2023, 11, 31, 14, 59, 59)), '2023-12-31');
assert.strictEqual(toKstDateString(Date.UTC(2023, 11, 31, 15, 0, 0)), '2024-01-01');
assert.strictEqual(toKstDateString(secondTimestamp * 1000), '2024-01-01');

assert.deepStrictEqual(resolveSnsStoryRange({ rangeType: 'all' }), { type: 'all' });
assert.deepStrictEqual(resolveSnsStoryRange({ rangeType: 'year', year: '2024' }), { type: 'year', year: 2024 });
assert.deepStrictEqual(resolveSnsStoryRange({ rangeType: 'custom', from: '2024-01-01', to: '2024-12-31' }), {
  type: 'custom',
  from: '2024-01-01',
  to: '2024-12-31',
});
assert.throws(() => resolveSnsStoryRange({ rangeType: 'custom', from: '2024-12-31', to: '2024-01-01' }));

const periodRecords = [
  { id: 'a', text: '글', thumbnails: [], source: 'facebook', timestampMs: 1, date: '2024-01-01', isDeleted: false },
  { id: 'b', text: '', thumbnails: ['p'], source: 'facebook', timestampMs: 2, date: '2024-01-02', isDeleted: false },
  { id: 'c', text: '글사진', thumbnails: ['p'], source: 'instagram', timestampMs: 3, date: '2024-01-03', isDeleted: false },
];
assert.deepStrictEqual(buildSnsStoryCounts(periodRecords, [periodRecords[0], periodRecords[2]]), {
  total: 3,
  included: 2,
  excluded: 1,
  textOnly: 1,
  photoOnly: 0,
  textAndPhoto: 1,
});

const longText = `${'가'.repeat(13000)}끝`;
const chunks = buildSnsStorySourceChunks([{
  id: 'long',
  source: 'facebook',
  timestampMs: milliTimestamp,
  date: '2024-01-01',
  text: longText,
  thumbnails: [],
  isDeleted: false,
}]);
assert(chunks.length >= 2, 'long individual records must be split instead of truncated');
assert(chunks.some((chunk) => chunk.text.includes('끝')), 'the final slice of a long record must be preserved');
const grouped = groupSnsStoryChunks(chunks);
assert(grouped.every((group) => group.length <= 16000), 'source groups should fit the configured Gemini chunk size');
assert.throws(
  () => validateSnsStorySourceGroupBudget(new Array(15).fill('group')),
  (error) => error.details?.reason === 'SNS_STORY_RANGE_TOO_LARGE',
  'too many initial source groups must fail before AI work starts',
);

const photoOnlyChunks = buildSnsStorySourceChunks([{
  id: 'photo',
  source: 'facebook',
  timestampMs: milliTimestamp,
  date: '2024-01-01',
  text: '',
  thumbnails: ['users/u/snsThumbnails/photo/0.jpg'],
  isDeleted: false,
}]);
assert(photoOnlyChunks[0].text.includes('contentType: photo_only'));
assert(photoOnlyChunks[0].text.includes('사진 내용은 분석하지 않으며 장수만 반영'));

const payloadHashA = buildSnsStoryFinalPayloadHash({
  range: { type: 'custom', from: '2024-01-01', to: '2024-12-31' },
  excludedRecordIds: ['z', 'a'],
  sourceFingerprint: 'ABCDEF',
  title: '  제목  ',
  confirmedSynopsis: '  확정 시놉시스  ',
});
const payloadHashB = buildSnsStoryFinalPayloadHash({
  range: { type: 'custom', from: '2024-01-01', to: '2024-12-31' },
  excludedRecordIds: ['a', 'z'],
  sourceFingerprint: 'abcdef',
  title: '제목',
  confirmedSynopsis: '확정 시놉시스',
});
assert.strictEqual(payloadHashA, payloadHashB, 'same logical final request must hash identically');
assert.notStrictEqual(payloadHashA, buildSnsStoryFinalPayloadHash({
  range: { type: 'custom', from: '2024-01-01', to: '2024-12-31' },
  excludedRecordIds: ['a', 'z'],
  sourceFingerprint: 'abcdef',
  title: '제목',
  confirmedSynopsis: '수정된 시놉시스',
}), 'edited synopsis must change payload hash');
assert.doesNotThrow(() => assertSnsStoryIdempotencyCompatible({ source: 'sns_story', requestPayloadHash: payloadHashA }, payloadHashA));
const payloadHashDifferentSynopsis = buildSnsStoryFinalPayloadHash({
  range: { type: 'custom', from: '2024-01-01', to: '2024-12-31' },
  excludedRecordIds: ['a', 'z'],
  sourceFingerprint: 'abcdef',
  title: '제목',
  confirmedSynopsis: '수정된 시놉시스',
});
assert.throws(
  () => assertSnsStoryIdempotencyCompatible({ source: 'sns_story', requestPayloadHash: payloadHashA }, payloadHashDifferentSynopsis),
  (error) => error.details?.reason === 'SNS_STORY_IDEMPOTENCY_CONFLICT',
);

const budget = createSnsStoryGeminiCallBudget(2, Date.now() + 120_000);
assert.strictEqual(reserveSnsStoryGeminiCall(budget, 'summary', 45_000), 1);
assert.strictEqual(reserveSnsStoryGeminiCall(budget, 'summary', 45_000), 2);
assert.throws(
  () => reserveSnsStoryGeminiCall(budget, 'summary', 45_000),
  (error) => error.details?.reason === 'SNS_STORY_AI_BUDGET_EXCEEDED',
);
assert.throws(
  () => reserveSnsStoryGeminiCall(createSnsStoryGeminiCallBudget(1, Date.now() + 10_000), 'final-story', 180_000),
  (error) => error.details?.reason === 'SNS_STORY_AI_DEADLINE_TOO_CLOSE',
);
assert.strictEqual(validateSnsStoryGeneratedText('  충분한 응답입니다.  ', 'summary', 1, 100), '충분한 응답입니다.');
assert.throws(
  () => validateSnsStoryGeneratedText('', 'summary', 1, 100),
  (error) => error.details?.reason === 'SNS_STORY_AI_EMPTY_RESULT',
);
assert.throws(
  () => validateSnsStoryGeneratedText('짧음', 'final-story', 500, 1000),
  (error) => error.details?.reason === 'SNS_STORY_AI_RESULT_TOO_SHORT',
);

const recoveryNow = 1_800_000_000_000;
const recoveryHash = 'a'.repeat(64);
assert.deepStrictEqual(
  chooseSnsStoryRecoveredOperation([
    {
      id: '2027-01-15_snsStory_1799999999000',
      data: {
        source: 'sns_story',
        generationStatus: 'completed',
        requestPayloadHash: recoveryHash,
        requestTimestamp: recoveryNow - 1_000,
      },
    },
    {
      id: '2027-01-15_snsStory_1799999999500',
      data: {
        source: 'sns_story',
        generationStatus: 'completed',
        requestPayloadHash: recoveryHash,
        requestTimestamp: recoveryNow - 500,
      },
    },
  ], recoveryHash, recoveryNow)?.recordId,
  '2027-01-15_snsStory_1799999999500',
  'completed recovery must choose the newest matching completed operation',
);
assert.strictEqual(
  chooseSnsStoryRecoveredOperation([
    {
      id: 'generating',
      data: {
        source: 'sns_story',
        generationStatus: 'generating',
        requestPayloadHash: recoveryHash,
        requestTimestamp: recoveryNow - 2_000,
        leaseExpiresAt: recoveryNow + 10_000,
      },
    },
  ], recoveryHash, recoveryNow)?.action,
  'generating',
  'active generating leases must be recovered as in progress',
);
assert.strictEqual(
  chooseSnsStoryRecoveredOperation([
    {
      id: 'expired-generating',
      data: {
        source: 'sns_story',
        generationStatus: 'generating',
        requestPayloadHash: recoveryHash,
        requestTimestamp: recoveryNow - 2_000,
        leaseExpiresAt: recoveryNow - 1,
      },
    },
  ], recoveryHash, recoveryNow)?.action,
  'retry',
  'expired generating leases must be reusable retry targets',
);
assert.strictEqual(
  chooseSnsStoryRecoveredOperation([
    {
      id: 'failed',
      data: {
        source: 'sns_story',
        generationStatus: 'failed',
        requestPayloadHash: recoveryHash,
        requestTimestamp: recoveryNow - 3_000,
      },
    },
  ], recoveryHash, recoveryNow)?.action,
  'retry',
  'failed operations must be reusable retry targets',
);
assert.strictEqual(
  chooseSnsStoryRecoveredOperation([
    {
      id: 'different',
      data: {
        source: 'sns_story',
        generationStatus: 'completed',
        requestPayloadHash: 'b'.repeat(64),
        requestTimestamp: recoveryNow - 1_000,
      },
    },
    {
      id: 'too-old',
      data: {
        source: 'sns_story',
        generationStatus: 'completed',
        requestPayloadHash: recoveryHash,
        requestTimestamp: recoveryNow - SNS_STORY_OPERATION_RECOVERY_MS - 1,
      },
    },
  ], recoveryHash, recoveryNow),
  null,
  'different hashes and stale operations must not be recovered',
);

async function runAsyncPolicyTests() {
  const factory = {
    calls: [],
    getGenerativeModel(modelParams, requestOptions) {
      this.calls.push({ modelParams, requestOptions });
      return {
        async generateContent() {
          return { response: { text: () => '충분한 Gemini 응답입니다.' } };
        },
      };
    },
  };
  let billableStarted = false;
  const response = await invokeSnsStoryGeminiText(
    factory,
    'system',
    'prompt',
    {
      stageName: 'summary',
      maxOutputTokens: SNS_STORY_SUMMARY_MAX_OUTPUT_TOKENS,
      timeoutMs: SNS_STORY_SUMMARY_TIMEOUT_MS,
      budget: createSnsStoryGeminiCallBudget(1, Date.now() + 120_000),
      maxChars: 1_000,
      onBillableAiWorkStarted: () => {
        billableStarted = true;
      },
    },
  );
  assert.strictEqual(response, '충분한 Gemini 응답입니다.');
  assert.strictEqual(factory.calls[0].requestOptions.timeout, SNS_STORY_SUMMARY_TIMEOUT_MS);
  assert.strictEqual(factory.calls[0].modelParams.generationConfig.maxOutputTokens, SNS_STORY_SUMMARY_MAX_OUTPUT_TOKENS);
  assert.strictEqual(billableStarted, true);

  const noCallFactory = {
    calls: [],
    getGenerativeModel() {
      this.calls.push({});
      throw new Error('should not start Gemini when deadline is too close');
    },
  };
  await assert.rejects(
    () => invokeSnsStoryGeminiText(
      noCallFactory,
      'system',
      'prompt',
      {
        stageName: 'final-story',
        maxOutputTokens: SNS_STORY_FINAL_STORY_MAX_OUTPUT_TOKENS,
        timeoutMs: SNS_STORY_FINAL_STORY_TIMEOUT_MS,
        budget: createSnsStoryGeminiCallBudget(1, Date.now() + 10_000),
        maxChars: 1_000,
      },
    ),
    (error) => error.details?.reason === 'SNS_STORY_AI_DEADLINE_TOO_CLOSE',
  );
  assert.strictEqual(noCallFactory.calls.length, 0, 'Gemini must not be called when the deadline is too close');

  const hangingFactory = {
    calls: [],
    getGenerativeModel(modelParams, requestOptions) {
      this.calls.push({ modelParams, requestOptions });
      return {
        generateContent() {
          return new Promise(() => {});
        },
      };
    },
  };
  let timeoutBillableStarted = false;
  await assert.rejects(
    () => invokeSnsStoryGeminiText(
      hangingFactory,
      'system',
      'prompt',
      {
        stageName: 'summary',
        maxOutputTokens: SNS_STORY_SUMMARY_MAX_OUTPUT_TOKENS,
        timeoutMs: 5,
        budget: createSnsStoryGeminiCallBudget(1, Date.now() + 30_000),
        maxChars: 1_000,
        onBillableAiWorkStarted: () => {
          timeoutBillableStarted = true;
        },
      },
    ),
    (error) => error.details?.reason === 'SNS_STORY_AI_TIMEOUT',
  );
  assert.strictEqual(hangingFactory.calls[0].requestOptions.timeout, 5);
  assert.strictEqual(timeoutBillableStarted, true, 'Gemini-started timeouts must count as billable work');
}

runAsyncPolicyTests()
  .then(() => {
    console.log('sns story policy tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
