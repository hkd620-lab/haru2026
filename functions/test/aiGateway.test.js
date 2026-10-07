// AI 호출 창구(callAi)·모델 설정 표 테스트 — 실제 AI 를 부르지 않고 SDK 대역으로 요청 모양만 확인한다.
// 실행: npm run build && node --test test/aiGateway.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const gateway = require('../lib/ai/aiGateway.js');
const models = require('../lib/ai/aiModels.js');

// 키는 창구가 설정 표의 회사에 맞춰 읽는다. 테스트에서는 회사별 가짜 키를 돌려준다.
const keyMap = { gemini: 'k-gemini', openai: 'k-openai' };
gateway.aiCredentials.get = (provider) => keyMap[provider];

function fakeGemini(log, response) {
  return (apiKey) => ({
    getGenerativeModel(params, requestOptions) {
      log.push({ apiKey, params, requestOptions, argc: requestOptions === undefined ? 1 : 2 });
      return {
        async generateContent(...args) {
          log.push(args.length === 1 ? { input: args[0] } : { input: args[0], callOptions: args[1] });
          return response;
        },
      };
    },
  });
}

test('Gemini: 설정 표의 모델로, 받은 값만 그대로 넘긴다', async () => {
  const log = [];
  gateway.aiClientFactories.gemini = fakeGemini(log, {
    response: { text: () => '다듬은 글', usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 } },
  });
  const result = await gateway.callAi({ purpose: 'sayuPolish', input: '원문', systemInstruction: '편집자' });
  assert.deepEqual(log[0], { apiKey: 'k-gemini', params: { model: 'gemini-3.1-flash-lite', systemInstruction: '편집자' }, requestOptions: undefined, argc: 1 });
  assert.deepEqual(log[1], { input: '원문' });
  assert.equal(result.text(), '다듬은 글');
  assert.deepEqual([result.provider, result.model, result.inputTokens, result.outputTokens], ['gemini', 'gemini-3.1-flash-lite', 12, 34]);

  log.length = 0;
  await gateway.callAi({ purpose: 'recordStats', input: ['a', { inlineData: { mimeType: 'image/png', data: 'AAA' } }] });
  // 넘기지 않은 설정은 키 자체를 만들지 않는다(기존 getGenerativeModel({ model }) 호출과 같음)
  assert.deepEqual(log[0].params, { model: 'gemini-3.1-flash-lite' });
  assert.deepEqual(log[1].input, ['a', { inlineData: { mimeType: 'image/png', data: 'AAA' } }]);

  log.length = 0;
  await gateway.callAi({
    purpose: 'recordStats', input: 'x',
    generationConfig: { temperature: 0.3 }, geminiParams: { tools: [{ googleSearch: {} }] }, requestOptions: { timeout: 1000 },
  });
  assert.deepEqual(log[0].params, { model: 'gemini-3.1-flash-lite', tools: [{ googleSearch: {} }], generationConfig: { temperature: 0.3 } });
  assert.deepEqual([log[0].requestOptions, log[0].argc], [{ timeout: 1000 }, 2]);
});

test('Gemini: 사용량이 없으면 null, 본문 오류는 text() 를 읽을 때 난다(기존 호출 순서 유지)', async () => {
  gateway.aiClientFactories.gemini = fakeGemini([], { response: { text: () => { throw new Error('blocked'); } } });
  const result = await gateway.callAi({ purpose: 'sayuPolishComment', input: 'p' });
  assert.deepEqual([result.inputTokens, result.outputTokens], [null, null]);
  assert.throws(() => result.text(), /blocked/);
  keyMap.gemini = '';
  try {
    await assert.rejects(gateway.callAi({ purpose: 'sayuPolish', input: 'p' }), /AI 키 없음: gemini \(sayuPolish\)/);
  } finally {
    keyMap.gemini = 'k-gemini';
  }
});

test('OpenAI 어댑터: 회사를 바꾸면 같은 요청을 OpenAI 형식으로 보낸다', async () => {
  const route = models.AI_ROUTES.recordStats;
  const original = { ...route };
  Object.assign(route, { provider: 'openai', model: 'gpt-test' });
  const calls = [];
  gateway.aiClientFactories.openai = (apiKey) => ({ chat: { completions: { create: async (...args) => {
    const [body] = args;
    calls.push(args.length === 1 ? { apiKey, body } : { apiKey, body, options: args[1] });
    return { choices: [{ message: { content: '{"ok":1}' } }], usage: { prompt_tokens: 5, completion_tokens: 6 } };
  } } } });
  try {
    const result = await gateway.callAi({
      purpose: 'recordStats',
      input: ['설명', { inlineData: { mimeType: 'image/jpeg', data: 'BBB' } }],
      systemInstruction: '분석가', generationConfig: { temperature: 0.2, maxOutputTokens: 100, responseMimeType: 'application/json' },
    });
    assert.deepEqual(calls[0], { apiKey: 'k-openai', body: {
      model: 'gpt-test',
      messages: [
        { role: 'system', content: '분석가' },
        { role: 'user', content: [{ type: 'text', text: '설명' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } }] },
      ],
      temperature: 0.2, max_completion_tokens: 100, response_format: { type: 'json_object' },
    } });
    assert.deepEqual([result.provider, result.model, result.text(), result.inputTokens, result.outputTokens], ['openai', 'gpt-test', '{"ok":1}', 5, 6]);
    await assert.rejects(gateway.callAi({ purpose: 'recordStats', input: 'x', geminiParams: { tools: [] } }), /Gemini 전용/);
  } finally {
    Object.assign(route, original);
  }
});

test('설정 표: 이번에 옮긴 기능은 이전과 같은 모델을 쓴다(모델 변경 없음)', () => {
  const migrated = ['sayuPolish', 'sayuPolishComment', 'recordStats', 'recordTitle', 'recordTitleBackfill', 'recordKeywords', 'haruMemo',
    'bookPhotoOcr', 'stockPhotoOcr', 'subledgerPhotoOcr', 'householdPhotoOcr',
    'bibleWordMeaning', 'bibleVerseQuiz', 'bibleVerseTranslation', 'bibleVerseWordMapping', 'englishTranslate',
    'newsDigest', 'newsDigestRefresh', 'newsMetadata', 'prophecyAnalysis', 'prophecySynopsis',
    'drugPhoto', 'symptomSpecialty', 'plantAdvice', 'plantKoreanName', 'plantCrossVerification',
    'readingChat', 'snsToDiary', 'bookMaterial', 'lawsuitClaimReason'];
  // 기존 코드에서 gemini-2.5-flash 를 쓰던 용도
  for (const purpose of ['prophecyStory', 'petFoodCheck']) {
    assert.deepEqual([models.AI_ROUTES[purpose].provider, models.AI_ROUTES[purpose].model], ['gemini', 'gemini-2.5-flash'], purpose);
  }
  for (const purpose of migrated) {
    assert.deepEqual([models.AI_ROUTES[purpose].provider, models.AI_ROUTES[purpose].model], ['gemini', 'gemini-3.1-flash-lite'], purpose);
  }
  // 설정 표에 위 32개 외 용도가 생기면 이 테스트에도 모델을 고정해야 한다
  assert.deepEqual(Object.keys(models.AI_ROUTES).sort(), [...migrated, 'prophecyStory', 'petFoodCheck'].sort());
});

test('옮긴 호출부는 SDK 를 직접 만들지 않고 창구를 쓴다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
  const block = (start, end) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));
  const stats = block('async function analyzeStats(', '\n}\n');
  assert.match(stats, /callAi\(\{ purpose: 'recordStats'/);
  assert.doesNotMatch(stats, /new GoogleGenerativeAI|getGenerativeModel/);
  const polish = block("featureName: 'sayu_polish',", "await logPaidServiceUsage(uid, 'ai_polish'");
  const polishStart = src.lastIndexOf('export const polishContent =', src.indexOf("featureName: 'sayu_polish',"));
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

test('호출 옵션(callOptions)은 generateContent 두 번째 인자로만 넘긴다', async () => {
  const log = [];
  gateway.aiClientFactories.gemini = fakeGemini(log, { response: { text: () => '{}' } });
  await gateway.callAi({
    purpose: 'readingChat', input: 'q', systemInstruction: 's',
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096, temperature: 0.4 }, callOptions: { timeout: 45000 },
  });
  assert.deepEqual(log[0].params, { model: 'gemini-3.1-flash-lite', systemInstruction: 's', generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096, temperature: 0.4 } });
  assert.equal(log[0].argc, 1);
  assert.deepEqual(log[1], { input: 'q', callOptions: { timeout: 45000 } });
});

test('별도 파일 기능 4개도 창구를 쓰고, 독서 대화 모델 상수는 설정 표 값과 같다', () => {
  const read = (f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
  for (const [file, purpose] of [['readingAi.ts', 'readingChat'], ['snsToDiary.ts', 'snsToDiary'], ['bookMaterial.ts', 'bookMaterial'], ['generateLawsuitClaimReason.ts', 'lawsuitClaimReason']]) {
    const src = read(file);
    assert.match(src, new RegExp(`purpose: '${purpose}'`), file);
    assert.doesNotMatch(src, /new GoogleGenerativeAI|getGenerativeModel|'gemini-[\w.-]+'|\.response\./, file);
  }
  assert.equal(require('../lib/readingAiCore.js').READING_AI_MODEL, models.AI_ROUTES.readingChat.model);
  assert.match(read('readingAi.ts'), /callOptions: \{ timeout: 45000 \}/);
});

test('OpenAI SDK 는 창구를 불러올 때 함께 불러오지 않는다(OpenAI 로 보낼 때만)', () => {
  const { execFileSync } = require('node:child_process');
  const out = execFileSync(process.execPath, ['-e', [
    "const g = require('./lib/ai/aiGateway.js');",
    "const loaded = () => Object.keys(require.cache).some((k) => k.includes('/node_modules/openai/'));",
    "const before = loaded();",
    "g.aiClientFactories.openai('sk-test');",
    "console.log(JSON.stringify([before, loaded()]));",
  ].join('\n')], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out.trim()), [false, true]);
});

test('OpenAI 어댑터: 시간 제한·취소 신호는 요청 옵션으로 옮기고, 옮길 수 없는 설정은 오류로 막는다', async () => {
  const route = models.AI_ROUTES.readingChat;
  const original = { ...route };
  Object.assign(route, { provider: 'openai', model: 'gpt-test' });
  const calls = [];
  gateway.aiClientFactories.openai = (apiKey) => ({ chat: { completions: { create: async (...args) => {
    calls.push(args);
    return { choices: [{ message: { content: '{}' } }] };
  } } } });
  try {
    const signal = new AbortController().signal;
    await gateway.callAi({ purpose: 'readingChat', input: 'q', callOptions: { timeout: 45000, signal } });
    assert.deepEqual(calls[0][1], { timeout: 45000, signal });
    await gateway.callAi({ purpose: 'readingChat', input: 'q', requestOptions: { timeout: 1000 } });
    assert.deepEqual(calls[1][1], { timeout: 1000 });
    await gateway.callAi({ purpose: 'readingChat', input: 'q', generationConfig: { responseMimeType: 'text/plain' } });
    assert.equal(calls[2].length, 1);
    const blocked = [
      [{ generationConfig: { responseSchema: {} } }, /generationConfig\.responseSchema/],
      [{ generationConfig: { topP: 0.9, stopSequences: ['x'] } }, /generationConfig\.topP, generationConfig\.stopSequences/],
      [{ generationConfig: { responseMimeType: 'text/x.enum' } }, /responseMimeType text\/x\.enum/],
      [{ requestOptions: { baseUrl: 'https://x' } }, /requestOptions\.baseUrl/],
      [{ input: { contents: [{ role: 'user', parts: [{ text: 'q' }] }], systemInstruction: 's' } }, /요청 필드.*systemInstruction/],
      [{ input: [{ fileData: { mimeType: 'application/pdf', fileUri: 'x' } }] }, /입력 조각/],
    ];
    for (const [extra, pattern] of blocked) {
      await assert.rejects(gateway.callAi({ purpose: 'readingChat', input: 'q', ...extra }), pattern);
    }
    assert.equal(calls.length, 3);
  } finally {
    Object.assign(route, original);
  }
});

test('키: 설정 표의 회사 키를 창구가 읽고, 함수 secrets 도 설정 표에서 정해진다', async () => {
  const route = models.AI_ROUTES.snsToDiary;
  const original = { ...route };
  assert.deepEqual(gateway.aiSecretsFor('snsToDiary').map((s) => s.name), ['GEMINI_API_KEY']);
  assert.deepEqual(gateway.aiSecretsFor('prophecyStory', 'prophecySynopsis').map((s) => s.name), ['GEMINI_API_KEY']);
  Object.assign(route, { provider: 'openai', model: 'gpt-test' });
  const seen = [];
  gateway.aiClientFactories.openai = (apiKey) => ({ chat: { completions: { create: async () => {
    seen.push(apiKey);
    return { choices: [{ message: { content: 'ok' } }] };
  } } } });
  try {
    // 표만 바꾸면 함수 secrets 에 OpenAI 키가 연결되고, 창구는 OpenAI 키로 보낸다
    assert.deepEqual(gateway.aiSecretsFor('snsToDiary').map((s) => s.name), ['OPENAI_API_KEY']);
    assert.deepEqual(gateway.aiSecretsFor('snsToDiary', 'bookMaterial').map((s) => s.name), ['OPENAI_API_KEY', 'GEMINI_API_KEY']);
    await gateway.callAi({ purpose: 'snsToDiary', input: 'q' });
    assert.deepEqual(seen, ['k-openai']);
  } finally {
    Object.assign(route, original);
  }
});

// 호출부 소스에서 callAi({...}) 인자 객체를 꺼낸다(중괄호 짝 맞춤).
function callAiCalls(src) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf('callAi({', from);
    if (at < 0) return out;
    let i = at + 'callAi('.length;
    let depth = 0;
    const start = i;
    for (; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '{' || ch === '[' || ch === '(') depth += 1;
      else if (ch === '}' || ch === ']' || ch === ')') { depth -= 1; if (depth === 0) break; }
      else if (ch === '`') { i = src.indexOf('`', i + 1); }
      else if (ch === "'") { i = src.indexOf("'", i + 1); }
    }
    out.push(src.slice(start, i + 1));
    from = i;
  }
}
function topLevelKeys(objText) {
  const keys = [];
  let depth = 0;
  for (let i = 0; i < objText.length; i += 1) {
    const ch = objText[i];
    if (ch === '{' || ch === '[' || ch === '(') { depth += 1; if (depth === 1) continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth -= 1; continue; }
    if (ch === '`') { i = objText.indexOf('`', i + 1); continue; }
    if (ch === "'") { i = objText.indexOf("'", i + 1); continue; }
    if (depth === 1) {
      const m = /^\s*([A-Za-z_$][\w$]*)\s*(:|,|\n|\})/.exec(objText.slice(i));
      if (m && (i === 1 || /[,{]\s*$/.test(objText.slice(0, i)))) { keys.push(m[1]); i += m[0].length - 2; }
    }
  }
  return keys.sort();
}

test('호출부마다 넘기는 설정(시스템 지시·생성 설정·호출 옵션·이미지)이 빠지지 않는다', () => {
  const files = ['index.ts', 'readingAi.ts', 'snsToDiary.ts', 'bookMaterial.ts', 'generateLawsuitClaimReason.ts'];
  const found = [];
  for (const file of files) {
    const src = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
    for (const call of callAiCalls(src)) {
      const purpose = (/purpose: (?:type === 'story' \? )?'(\w+)'/.exec(call) || [])[1];
      found.push({ file, purpose, keys: topLevelKeys(call).join(','), image: /inlineData|inlineParts|imageParts|\bparts\b/.test(call.slice(call.indexOf('input'))) });
    }
  }
  const sig = found.map((f) => `${f.file}:${f.purpose}:${f.keys}${f.image ? ':image' : ''}`).sort();
  const base = 'input,purpose';
  const expected = [
    `index.ts:sayuPolish:${base},systemInstruction`, `index.ts:sayuPolishComment:${base}`, `index.ts:recordStats:${base}`,
    `index.ts:recordTitle:${base}`, `index.ts:haruMemo:${base}`, `index.ts:recordKeywords:${base}`, `index.ts:recordTitleBackfill:${base}`,
    `index.ts:bookPhotoOcr:${base}:image`, `index.ts:stockPhotoOcr:${base}:image`, `index.ts:subledgerPhotoOcr:${base}:image`, `index.ts:householdPhotoOcr:${base}:image`,
    `index.ts:bibleWordMeaning:${base}`, `index.ts:bibleWordMeaning:${base}`, `index.ts:bibleVerseQuiz:${base}`, `index.ts:englishTranslate:${base}`,
    `index.ts:newsDigest:${base}`, `index.ts:newsDigestRefresh:${base}`,
    `index.ts:prophecyAnalysis:${base},systemInstruction`, `index.ts:prophecyStory:${base},systemInstruction`,
    `index.ts:bibleVerseTranslation:${base}`, `index.ts:bibleVerseWordMapping:${base}`,
    `index.ts:drugPhoto:${base}:image`, `index.ts:symptomSpecialty:${base},systemInstruction`, `index.ts:newsMetadata:${base}:image`,
    `index.ts:plantAdvice:${base}:image`, `index.ts:plantKoreanName:${base}`, `index.ts:plantCrossVerification:${base}:image`, `index.ts:petFoodCheck:${base}`,
    `readingAi.ts:readingChat:callOptions,generationConfig,${base},systemInstruction`,
    `snsToDiary.ts:snsToDiary:${base},systemInstruction`,
    `bookMaterial.ts:bookMaterial:generationConfig,${base}`,
    `generateLawsuitClaimReason.ts:lawsuitClaimReason:${base},systemInstruction`,
  ].sort();
  assert.deepEqual(sig, expected);
});

test('창구를 쓰는 함수는 secrets 를 설정 표(aiSecretsFor)로 연결하고, Gemini 키를 직접 읽지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
  const expected = {
    polishContent: "'sayuPolish', 'sayuPolishComment', 'recordStats'", extractTitle: "'recordTitle'", generateHaruMemo: "'haruMemo'",
    extractKeywords: "'recordKeywords'", generateTitlesForAll: "'recordTitleBackfill'", extractReadingBookTextFromPhoto: "'bookPhotoOcr'",
    extractStockTradeTextFromPhoto: "'stockPhotoOcr'", extractLedgerTextFromImage: "'subledgerPhotoOcr'", extractHouseholdTextFromImage: "'householdPhotoOcr'",
    getWordMeaning: "'bibleWordMeaning'", getVerseQuiz: "'bibleVerseQuiz'", translateToEnglish: "'englishTranslate'", fetchTopNews: "'newsDigest'",
    refreshNews: "'newsDigestRefresh'", analyzeRecordForProphecy: "'prophecyAnalysis'", generateHaruProphecy: "'prophecyStory', 'prophecySynopsis'",
    getVerseTranslation: "'bibleVerseTranslation'", getVerseWordMapping: "'bibleVerseWordMapping'", analyzeDrugPhoto: "'drugPhoto'",
    analyzeSymptomsForSpecialty: "'symptomSpecialty'", extractKNewsMetadata: "'newsMetadata'", analyzePlantPhoto: "'plantAdvice'",
    detectPlantAdvanced: "'plantKoreanName', 'plantCrossVerification'", petFoodCheck: "'petFoodCheck'",
  };
  for (const [name, purposes] of Object.entries(expected)) {
    const start = src.indexOf(`export const ${name} =`);
    assert.ok(start > 0, name);
    const next = src.slice(start + 1).search(/\nexport const \w+\s*=/);
    const body = src.slice(start, next < 0 ? undefined : start + 1 + next);
    assert.match(body, new RegExp(`secrets: (\\[[^\\]]*)?(\\.\\.\\.)?aiSecretsFor\\(${purposes.replace(/[()]/g, '\\$&')}\\)`), name);
    assert.doesNotMatch(body, /GEMINI_API_KEY_SECRET/, name);
  }
  for (const [file, purpose] of [['readingAi.ts', 'readingChat'], ['snsToDiary.ts', 'snsToDiary'], ['bookMaterial.ts', 'bookMaterial'], ['generateLawsuitClaimReason.ts', 'lawsuitClaimReason']]) {
    const mod = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
    assert.match(mod, new RegExp(`secrets: aiSecretsFor\\('${purpose}'\\)`), file);
    assert.doesNotMatch(mod, /GEMINI_API_KEY|keys:/, file);
  }
});
