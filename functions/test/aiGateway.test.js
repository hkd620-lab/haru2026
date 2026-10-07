// AI 호출 창구(callAi)·모델 설정 표 테스트 — 실제 AI 를 부르지 않고 SDK 대역으로 요청 모양만 확인한다.
// 실행: npm run build && node --test test/aiGateway.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const gateway = require('../lib/ai/aiGateway.js');
const models = require('../lib/ai/aiModels.js');

function fakeGemini(log, response) {
  return (apiKey) => ({
    getGenerativeModel(params, requestOptions) {
      log.push({ apiKey, params, requestOptions, argc: requestOptions === undefined ? 1 : 2 });
      return { async generateContent(input) { log.push({ input }); return response; } };
    },
  });
}

test('Gemini: 설정 표의 모델로, 받은 값만 그대로 넘긴다', async () => {
  const log = [];
  gateway.aiClientFactories.gemini = fakeGemini(log, {
    response: { text: () => '다듬은 글', usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 } },
  });
  const result = await gateway.callAi({ purpose: 'sayuPolish', keys: { gemini: 'k1' }, input: '원문', systemInstruction: '편집자' });
  assert.deepEqual(log[0], { apiKey: 'k1', params: { model: 'gemini-3.1-flash-lite', systemInstruction: '편집자' }, requestOptions: undefined, argc: 1 });
  assert.deepEqual(log[1], { input: '원문' });
  assert.equal(result.text(), '다듬은 글');
  assert.deepEqual([result.provider, result.model, result.inputTokens, result.outputTokens], ['gemini', 'gemini-3.1-flash-lite', 12, 34]);

  log.length = 0;
  await gateway.callAi({ purpose: 'recordStats', keys: { gemini: 'k2' }, input: ['a', { inlineData: { mimeType: 'image/png', data: 'AAA' } }] });
  // 넘기지 않은 설정은 키 자체를 만들지 않는다(기존 getGenerativeModel({ model }) 호출과 같음)
  assert.deepEqual(log[0].params, { model: 'gemini-3.1-flash-lite' });
  assert.deepEqual(log[1].input, ['a', { inlineData: { mimeType: 'image/png', data: 'AAA' } }]);

  log.length = 0;
  await gateway.callAi({
    purpose: 'recordStats', keys: { gemini: 'k3' }, input: 'x',
    generationConfig: { temperature: 0.3 }, geminiParams: { tools: [{ googleSearch: {} }] }, requestOptions: { timeout: 1000 },
  });
  assert.deepEqual(log[0].params, { model: 'gemini-3.1-flash-lite', tools: [{ googleSearch: {} }], generationConfig: { temperature: 0.3 } });
  assert.deepEqual([log[0].requestOptions, log[0].argc], [{ timeout: 1000 }, 2]);
});

test('Gemini: 사용량이 없으면 null, 본문 오류는 text() 를 읽을 때 난다(기존 호출 순서 유지)', async () => {
  gateway.aiClientFactories.gemini = fakeGemini([], { response: { text: () => { throw new Error('blocked'); } } });
  const result = await gateway.callAi({ purpose: 'sayuPolishComment', keys: { gemini: 'k' }, input: 'p' });
  assert.deepEqual([result.inputTokens, result.outputTokens], [null, null]);
  assert.throws(() => result.text(), /blocked/);
  await assert.rejects(gateway.callAi({ purpose: 'sayuPolish', keys: {}, input: 'p' }), /AI 키 없음: gemini/);
});

test('OpenAI 어댑터: 회사를 바꾸면 같은 요청을 OpenAI 형식으로 보낸다', async () => {
  const route = models.AI_ROUTES.recordStats;
  const original = { ...route };
  Object.assign(route, { provider: 'openai', model: 'gpt-test' });
  const calls = [];
  gateway.aiClientFactories.openai = (apiKey) => ({ chat: { completions: { create: async (body) => {
    calls.push({ apiKey, body });
    return { choices: [{ message: { content: '{"ok":1}' } }], usage: { prompt_tokens: 5, completion_tokens: 6 } };
  } } } });
  try {
    const result = await gateway.callAi({
      purpose: 'recordStats', keys: { openai: 'ok' },
      input: ['설명', { inlineData: { mimeType: 'image/jpeg', data: 'BBB' } }],
      systemInstruction: '분석가', generationConfig: { temperature: 0.2, maxOutputTokens: 100, responseMimeType: 'application/json' },
    });
    assert.deepEqual(calls[0], { apiKey: 'ok', body: {
      model: 'gpt-test',
      messages: [
        { role: 'system', content: '분석가' },
        { role: 'user', content: [{ type: 'text', text: '설명' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } }] },
      ],
      temperature: 0.2, max_completion_tokens: 100, response_format: { type: 'json_object' },
    } });
    assert.deepEqual([result.provider, result.model, result.text(), result.inputTokens, result.outputTokens], ['openai', 'gpt-test', '{"ok":1}', 5, 6]);
    await assert.rejects(gateway.callAi({ purpose: 'recordStats', keys: { openai: 'ok' }, input: 'x', geminiParams: { tools: [] } }), /Gemini 전용/);
  } finally {
    Object.assign(route, original);
  }
});

test('설정 표: 이번에 옮긴 기능은 이전과 같은 모델을 쓴다(모델 변경 없음)', () => {
  const migrated = ['sayuPolish', 'sayuPolishComment', 'recordStats', 'recordTitle', 'recordTitleBackfill', 'recordKeywords', 'haruMemo',
    'bookPhotoOcr', 'stockPhotoOcr', 'subledgerPhotoOcr', 'householdPhotoOcr',
    'bibleWordMeaning', 'bibleVerseQuiz', 'bibleVerseTranslation', 'bibleVerseWordMapping', 'englishTranslate',
    'newsDigest', 'newsDigestRefresh', 'newsMetadata', 'prophecyAnalysis', 'prophecySynopsis',
    'drugPhoto', 'symptomSpecialty', 'plantAdvice', 'plantKoreanName', 'plantCrossVerification'];
  // 기존 코드에서 gemini-2.5-flash 를 쓰던 용도
  for (const purpose of ['prophecyStory', 'petFoodCheck']) {
    assert.deepEqual([models.AI_ROUTES[purpose].provider, models.AI_ROUTES[purpose].model], ['gemini', 'gemini-2.5-flash'], purpose);
  }
  for (const purpose of migrated) {
    assert.deepEqual([models.AI_ROUTES[purpose].provider, models.AI_ROUTES[purpose].model], ['gemini', 'gemini-3.1-flash-lite'], purpose);
  }
});

test('옮긴 호출부는 SDK 를 직접 만들지 않고 창구를 쓴다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
  const block = (start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));
  const stats = block('async function analyzeStats(', '\n}\n');
  assert.match(stats, /callAi\(\{ purpose: 'recordStats'/);
  assert.doesNotMatch(stats, /new GoogleGenerativeAI|getGenerativeModel/);
  const polish = block("featureName: 'sayu_polish',", "await logPaidServiceUsage(uid, 'ai_polish'");
  const polishStart = src.lastIndexOf('const aiKeys = { gemini: GEMINI_API_KEY_SECRET.value() };', src.indexOf("featureName: 'sayu_polish',"));
  const polishBlock = src.slice(polishStart, src.indexOf("await logPaidServiceUsage(uid, 'ai_polish'", polishStart));
  assert.ok(polishStart > 0 && polish.length > 0);
  assert.match(polishBlock, /callAi\(\{ purpose: 'sayuPolish'/);
  assert.match(polishBlock, /callAi\(\{ purpose: 'sayuPolishComment'/);
  assert.doesNotMatch(polishBlock, /new GoogleGenerativeAI|getGenerativeModel|gemini-3\.1/);
});

test('옮긴 onCall·예약 함수는 창구만 쓰고, 모델 이름을 코드에 직접 적지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
  const fnBody = (name) => {
    const start = src.indexOf(`export const ${name} =`);
    assert.ok(start > 0, name);
    const next = src.slice(start + 1).search(/\nexport const \w+\s*=/);
    return src.slice(start, next < 0 ? undefined : start + 1 + next);
  };
  const expected = {
    getWordMeaning: 'bibleWordMeaning', getVerseQuiz: 'bibleVerseQuiz', translateToEnglish: 'englishTranslate',
    getVerseTranslation: 'bibleVerseTranslation', getVerseWordMapping: 'bibleVerseWordMapping',
    fetchTopNews: 'newsDigest', refreshNews: 'newsDigestRefresh', extractKNewsMetadata: 'newsMetadata',
    analyzeRecordForProphecy: 'prophecyAnalysis', analyzeDrugPhoto: 'drugPhoto', analyzeSymptomsForSpecialty: 'symptomSpecialty',
    petFoodCheck: 'petFoodCheck',
    extractTitle: 'recordTitle', generateHaruMemo: 'haruMemo', extractKeywords: 'recordKeywords',
    generateTitlesForAll: 'recordTitleBackfill', extractReadingBookTextFromPhoto: 'bookPhotoOcr',
    extractStockTradeTextFromPhoto: 'stockPhotoOcr', extractLedgerTextFromImage: 'subledgerPhotoOcr',
    extractHouseholdTextFromImage: 'householdPhotoOcr',
  };
  for (const [name, purpose] of Object.entries(expected)) {
    const body = fnBody(name);
    assert.match(body, new RegExp(`callAi\\(\\{ purpose: '${purpose}'`), name);
    assert.doesNotMatch(body, /new GoogleGenerativeAI|getGenerativeModel|'gemini-[\w.-]+'|\.response\.text\(\)/, name);
  }
});

test('미래전망은 유형별 용도로, 식물 보조 함수 3개도 창구로 부른다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
  const prophecy = src.slice(src.indexOf('export const generateHaruProphecy ='), src.indexOf('export const getVerseTranslation ='));
  assert.match(prophecy, /purpose: type === 'story' \? 'prophecyStory' : 'prophecySynopsis'/);
  assert.doesNotMatch(prophecy, /new GoogleGenerativeAI|getGenerativeModel|'gemini-[\w.-]+'/);
  for (const [fn, purpose] of [['callGeminiAdvice', 'plantAdvice'], ['resolveKoreanPlantName', 'plantKoreanName'], ['callGeminiCrossVerification', 'plantCrossVerification']]) {
    const start = src.search(new RegExp(`^(?:export )?(?:async )?function ${fn}\\b`, 'm'));
    assert.ok(start > 0, fn);
    const body = src.slice(start, start + 6000);
    assert.match(body, new RegExp(`callAi\\(\\{ purpose: '${purpose}'`), fn);
  }
  // 식물 사진 사용량 기록도 설정 표의 모델을 쓴다
  assert.equal((src.match(/featureName: 'plant_photo',\s*plan: AI_USAGE_PLAN,\s*model: getAiRoute\('plantAdvice'\)\.model,/g) || []).length, 2);
});
