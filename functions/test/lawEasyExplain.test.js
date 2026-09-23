const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  LAW_EASY_EXPLAIN_MAX_LAW_TEXT_LENGTH,
  LAW_EASY_EXPLAIN_MAX_METADATA_LENGTH,
  LAW_EASY_EXPLAIN_MAX_USER_QUERY_LENGTH,
  LAW_EASY_EXPLAIN_PROMPT_VERSION,
  LawEasyExplainGeneratedTextError,
  LawEasyExplainInputError,
  buildLawConsultCacheKey,
  resolveLawEasyExplanation,
  validateLawEasyExplainInput,
} = require('../src/lawEasyExplainCore.ts');

function cacheKey(input) {
  const validated = validateLawEasyExplainInput(input);
  return buildLawConsultCacheKey(validated);
}

async function run() {
  const base = {
    lawText: ' 형법   제1조\n 범죄의 성립과 처벌 ',
    userQuery: ' 이 경우   처벌은? ',
    lawName: '형법',
    articleStr: '제1조',
  };
  const normalized = validateLawEasyExplainInput(base);
  assert.equal(normalized.normalizedLawText, '형법 제1조 범죄의 성립과 처벌');
  assert.equal(normalized.normalizedUserQuery, '이 경우 처벌은?');

  const firstKey = cacheKey(base);
  assert.match(firstKey, new RegExp(`^${LAW_EASY_EXPLAIN_PROMPT_VERSION}_[a-f0-9]{64}$`));
  assert.equal(firstKey, cacheKey({ ...base }));
  assert.notEqual(firstKey, cacheKey({ ...base, lawText: '형법 제2조 다른 법률 원문' }));
  assert.notEqual(firstKey, cacheKey({ ...base, userQuery: '피해자는 어떻게 해야 하나요?' }));
  assert.equal(
    firstKey,
    cacheKey({ ...base, lawName: '조작된 법령명', articleStr: '제999조' }),
    'display metadata must not affect cache identity',
  );
  assert.equal(
    firstKey,
    cacheKey({ lawText: base.lawText, userQuery: base.userQuery }),
    'legacy requests without lawName/articleStr must remain safe',
  );

  for (const invalid of [
    null,
    {},
    { lawText: '', userQuery: '질문' },
    { lawText: '원문', userQuery: '   ' },
    { lawText: 1, userQuery: '질문' },
    { lawText: '원문', userQuery: [] },
    { lawText: '가'.repeat(LAW_EASY_EXPLAIN_MAX_LAW_TEXT_LENGTH + 1), userQuery: '질문' },
    { lawText: '원문', userQuery: '가'.repeat(LAW_EASY_EXPLAIN_MAX_USER_QUERY_LENGTH + 1) },
    { lawText: '원문', userQuery: '질문', lawName: 1 },
    { lawText: '원문', userQuery: '질문', articleStr: '가'.repeat(LAW_EASY_EXPLAIN_MAX_METADATA_LENGTH + 1) },
  ]) {
    assert.throws(() => validateLawEasyExplainInput(invalid), LawEasyExplainInputError);
  }

  {
    const calls = { read: 0, generate: 0, usage: 0, write: 0 };
    const result = await resolveLawEasyExplanation({
      readCache: async () => { calls.read += 1; return ' 캐시 해설 '; },
      generate: async () => { calls.generate += 1; return { explanation: '새 해설' }; },
      recordUsage: async () => { calls.usage += 1; },
      writeCache: async () => { calls.write += 1; },
    });
    assert.deepEqual(result, { explanation: '캐시 해설', cached: true });
    assert.deepEqual(calls, { read: 1, generate: 0, usage: 0, write: 0 });
  }

  {
    const calls = { generate: 0, usage: 0, write: 0, readError: 0 };
    const result = await resolveLawEasyExplanation({
      readCache: async () => { throw new Error('cache unavailable'); },
      generate: async () => { calls.generate += 1; return { explanation: '정상 생성 해설' }; },
      recordUsage: async () => { calls.usage += 1; },
      writeCache: async (value) => { calls.write += 1; assert.equal(value, '정상 생성 해설'); },
      onCacheReadError: () => { calls.readError += 1; },
    });
    assert.deepEqual(result, { explanation: '정상 생성 해설', cached: false });
    assert.deepEqual(calls, { generate: 1, usage: 1, write: 1, readError: 1 });
  }

  {
    let writeErrors = 0;
    const result = await resolveLawEasyExplanation({
      readCache: async () => null,
      generate: async () => ({ explanation: '저장 실패와 무관한 정상 해설' }),
      recordUsage: async () => {},
      writeCache: async () => { throw new Error('write unavailable'); },
      onCacheWriteError: () => { writeErrors += 1; },
    });
    assert.deepEqual(result, { explanation: '저장 실패와 무관한 정상 해설', cached: false });
    assert.equal(writeErrors, 1);
  }

  for (const badExplanation of ['', '   ', '오류: 생성 실패', 'Error: generation failed', 'AI자문을 불러오지 못했습니다.']) {
    let usageCalls = 0;
    let writeCalls = 0;
    await assert.rejects(
      resolveLawEasyExplanation({
        readCache: async () => null,
        generate: async () => ({ explanation: badExplanation }),
        recordUsage: async () => { usageCalls += 1; },
        writeCache: async () => { writeCalls += 1; },
      }),
      LawEasyExplainGeneratedTextError,
    );
    assert.equal(usageCalls, 0);
    assert.equal(writeCalls, 0);
  }

  const indexSource = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf8');
  const handlerStart = indexSource.indexOf('export const lawEasyExplain = onCall(');
  const handlerEnd = indexSource.indexOf('export const lawPrecedent = onCall(', handlerStart);
  const handlerSource = indexSource.slice(handlerStart, handlerEnd);
  const authCheck = handlerSource.indexOf('if (!request.auth)');
  const inputValidation = handlerSource.indexOf('validateLawEasyExplainInput(request.data)');
  assert(authCheck >= 0 && authCheck < inputValidation, 'authentication must be checked before input/cache work');
  assert(handlerSource.includes("throw new HttpsError('unauthenticated', '로그인이 필요합니다')"));
  assert(handlerSource.includes("region: 'asia-northeast3'"));
  assert(handlerSource.includes("const modelName = 'gemini-3.1-flash-lite'"));
  assert(handlerSource.includes('본 내용은 법령 정보 제공 목적이며, 전문적인 법률 자문을 대체할 수 없습니다.'));
  assert(handlerSource.includes('LAW_EASY_EXPLAIN_PROMPT_VERSION'));
  assert(handlerSource.includes('lawTextHash: sha256Hex(normalizedLawText)'));
  assert(handlerSource.includes('questionHash: sha256Hex(normalizedUserQuery)'));
}

run().then(() => console.log('lawEasyExplain cache and policy tests passed'));
