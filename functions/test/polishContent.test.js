// Actual callable/helpers with fake AI/quota/logging. Never imports the app or provider SDK.
// Run: npm run build && node --test test/polishContent.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { formatPrefixesOf } = require('../lib/formats/formatRegistry.js');
const { getAiRoute } = require('../lib/ai/aiModels.js');

const source = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
function find(predicate) {
  const matches = [];
  function visit(node) { if (predicate(node)) matches.push(node); ts.forEachChild(node, visit); }
  visit(ast); assert.equal(matches.length, 1); return matches[0];
}
const variable = name => find(n => ts.isVariableDeclaration(n) && n.name.getText(ast) === name).initializer;
const fn = name => find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast);
const handler = variable('polishContent').arguments.at(-1);
const compiled = ts.transpileModule([
  `const STATS_PROMPTS = ${variable('STATS_PROMPTS').getText(ast)};`,
  fn('analyzeStats'), fn('buildAiCommentPrompt'), `(${handler.getText(ast)});`,
].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2019 } }).outputText;
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(options = {}) {
  const calls = [], usage = [], paid = [], reservations = [], rollbacks = [], rateChecks = [];
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const helperModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/polishUsage.js'), 'utf8'), {
    exports: helperModule.exports,
    require: () => ({ createRequestAiUsageLogger: () => async value => usage.push(plain(value)) }),
    Date,
  });
  let requestSequence = 0;
  const run = new vm.Script(compiled).runInNewContext({
    createPolishUsage: helperModule.exports.createPolishUsage,
    createAiUsageRequestId: () => `synthetic-request-${++requestSequence}`,
    HttpsError, formatPrefixesOf, getAiRoute, DEVELOPER_UIDS: new Set(), AI_USAGE_PLAN: 'beta',
    console: { log() {}, warn() {}, error() {} }, logger: { warn() {} },
    enforceRateLimit: async (...args) => { rateChecks.push(args); if (options.rateDenied) throw new HttpsError('resource-exhausted', 'synthetic-rate'); },
    reserveMonthlyAiQuota: async (...args) => {
      if (options.quotaDenied) throw new HttpsError('resource-exhausted', 'synthetic-quota');
      const value = { uid: args[0], featureKey: args[1], used: 1 }; reservations.push(value); return value;
    },
    rollbackMonthlyAiQuotaReservation: async value => { if (value) rollbacks.push(value); },
    getAiUsageErrorCode: error => error.code || 'synthetic-error',
    logAiUsage: async value => usage.push(plain(value)),
    logPaidServiceUsage: async (...args) => paid.push(args),
    callAi: async request => {
      calls.push(plain(request));
      if (options.failPurpose === request.purpose) throw new Error('synthetic-provider-failure');
      const text = request.purpose === 'recordStats' ? options.statsText ?? '{"content_richness":4}'
        : request.purpose === 'sayuPolishComment' ? options.commentText ?? '**합성 한마디**' : '합성 본문';
      return { inputTokens: 11, outputTokens: 7, text: () => { if (options.failTextPurpose === request.purpose) throw new Error('synthetic-text-failure'); return text; } };
    },
  });
  return { calls, usage, paid, reservations, rollbacks, rateChecks, run,
    request: (data = {}) => run({ auth: { uid: 'synthetic-user' }, data: { text: '합성 원문', format: 'diary', ...data } }),
  };
}
const purposes = f => f.calls.map(c => c.purpose);

for (const format of ['diary', 'reading']) {
  for (const [label, option] of [['누락', {}], ['true', { includeAiComment: true }], ['false', { includeAiComment: false }]]) {
    test(`${format}: 옵션 ${label}에서 본문/통계는 유지하고 명시적 false만 한마디를 생략한다`, async () => {
      const f = fixture(); const result = plain(await f.request({ format, ...option }));
      const expected = ['sayuPolish', ...(format === 'diary' ? ['recordStats'] : []), ...(option.includeAiComment === false ? [] : ['sayuPolishComment'])];
      assert.deepEqual(purposes(f), expected);
      assert.deepEqual(Object.keys(result).sort(), ['aiComment', 'stats', 'text']);
      assert.equal(result.text, '합성 본문');
      assert.equal(result.aiComment, option.includeAiComment === false ? '' : '합성 한마디');
      if (format === 'diary') { assert.equal(result.stats.content_richness, 4); assert.ok(result.stats.analyzed_at); }
      else assert.equal(result.stats, null);
      assert.deepEqual(f.rateChecks, [['synthetic-user', 'polishContent', 10, 60]]);
      assert.equal(f.reservations.length, 1); assert.equal(f.rollbacks.length, 0);
      assert.equal(f.paid.length, 1); assert.equal(f.usage.length, expected.length);
      assert.equal(f.calls[0].input, '합성 원문'); assert.ok(f.calls[0].systemInstruction);
    });
  }
}

test('null/숫자/문자열/객체는 false로 간주하지 않아 구형 요청의 생성 동작을 유지한다', async () => {
  for (const includeAiComment of [undefined, null, 0, '', 'false', [], {}]) {
    const f = fixture(); const result = await f.request({ includeAiComment });
    assert.equal(result.aiComment, '합성 한마디'); assert.equal(f.calls.length, 3);
  }
});

test('통계 지원 10형식과 BASIC/PREMIUM 모드에서 false는 통계 요청을 생략하지 않는다', async () => {
  for (const format of ['diary', 'essay', 'mission', 'report', 'work', 'travel', 'garden', 'pet', 'child', 'memo']) {
    for (const mode of ['BASIC', 'PREMIUM']) {
      const f = fixture(); const result = await f.request({ format, mode, includeAiComment: false });
      assert.deepEqual(purposes(f), ['sayuPolish', 'recordStats']); assert.equal(result.stats.content_richness, 4);
      assert.equal(result.aiComment, ''); assert.equal(f.reservations.length, 1);
    }
  }
});

test('format 누락/미지원 형식도 false에서는 본문만 생성하며 반환 계약을 유지한다', async () => {
  for (const format of [undefined, 'unregistered']) {
    const f = fixture(); const result = plain(await f.request({ format, includeAiComment: false }));
    assert.deepEqual(purposes(f), ['sayuPolish']); assert.deepEqual(result, { text: '합성 본문', stats: null, aiComment: '' });
  }
});

test('한마디 옵션은 인증·입력 타입/길이 검증을 우회하지 않는다', async () => {
  for (const includeAiComment of [undefined, false]) {
    for (const text of ['', null, 123, 'x'.repeat(5001)]) {
      const f = fixture();
      await assert.rejects(f.request({ text, includeAiComment }), error => error.code === 'invalid-argument');
      assert.equal(f.calls.length, 0); assert.equal(f.reservations.length, 0);
    }
    const f = fixture();
    await assert.rejects(f.run({ data: { text: '합성 원문', includeAiComment } }), error => error.code === 'unauthenticated');
    assert.equal(f.calls.length, 0); assert.equal(f.rateChecks.length, 0);
  }
});

test('5000자 경계 입력은 false에서도 허용하고 rate/quota 예약을 그대로 거친다', async () => {
  const f = fixture(); await f.request({ text: 'x'.repeat(5000), includeAiComment: false });
  assert.equal(f.calls[0].input.length, 5000); assert.equal(f.reservations.length, 1);
});

for (const denied of ['rateDenied', 'quotaDenied']) {
  test(`${denied}: false가 제한을 우회하거나 모델 요청을 추가하지 않는다`, async () => {
    const f = fixture({ [denied]: true });
    await assert.rejects(f.request({ includeAiComment: false }), error => error.code === 'resource-exhausted');
    assert.equal(f.calls.length, 0); assert.equal(f.reservations.length, 0); assert.equal(f.paid.length, 0);
  });
}

test('본문 호출/text 읽기 실패는 옵션과 무관하게 중단하고 quota를 1회 환원한다', async () => {
  for (const includeAiComment of [undefined, false]) {
    for (const options of [{ failPurpose: 'sayuPolish' }, { failTextPurpose: 'sayuPolish' }]) {
      const f = fixture(options);
      await assert.rejects(f.request({ includeAiComment }), error => error.code === 'internal');
      assert.deepEqual(purposes(f), ['sayuPolish']); assert.equal(f.rollbacks.length, 1); assert.equal(f.paid.length, 0);
    }
  }
});

test('통계 호출/JSON 파싱 실패의 부분 성공 계약은 한마디 옵션과 무관하게 유지한다', async () => {
  for (const includeAiComment of [undefined, false]) {
    for (const options of [{ failPurpose: 'recordStats' }, { statsText: '{broken JSON}' }, { statsText: 'JSON 없음' }]) {
      const f = fixture(options); const result = await f.request({ includeAiComment });
      assert.equal(result.text, '합성 본문'); assert.equal(result.stats, null);
      assert.equal(result.aiComment, includeAiComment === false ? '' : '합성 한마디');
      assert.equal(f.rollbacks.length, 0); assert.equal(f.paid.length, 1);
    }
  }
});

test('기존 한마디 실패는 빈 문자열로 부분 성공하며 false에서는 해당 실패원에 진입하지 않는다', async () => {
  for (const options of [{ failPurpose: 'sayuPolishComment' }, { failTextPurpose: 'sayuPolishComment' }]) {
    for (const includeAiComment of [undefined, true, false]) {
      const f = fixture(options); const result = await f.request({ includeAiComment });
      assert.equal(result.text, '합성 본문'); assert.equal(result.aiComment, ''); assert.equal(result.stats.content_richness, 4);
      assert.equal(f.calls.length, includeAiComment === false ? 2 : 3); assert.equal(f.rollbacks.length, 0);
    }
  }
});

test('옵션 누락 시 한마디 정리·50자 반환 제한도 기존대로 유지한다', async () => {
  const f = fixture({ commentText: `**${'합성'.repeat(40)}**` }); const result = await f.request();
  assert.equal(result.aiComment, '합성'.repeat(25)); assert.equal(f.calls.length, 3);
});

test('요청마다 고유 ID이고 한 요청의 세 단계는 같은 ID·purpose·결과 한 행을 남긴다', async () => {
  const f = fixture(); await f.request(); await f.request();
  assert.equal(new Set(f.usage.map(row => row.requestId)).size, 2);
  for (const rows of [f.usage.slice(0, 3), f.usage.slice(3)]) {
    assert.equal(new Set(rows.map(row => row.requestId)).size, 1);
    assert.deepEqual(rows.map(row => row.purpose), ['sayuPolish', 'recordStats', 'sayuPolishComment']);
    for (const row of rows) {
      assert.equal(row.stage, row.purpose); assert.equal(row.modelInvoked, true);
      assert.equal(row.providerOutcome, 'returned'); assert.equal(row.processingOutcome, 'success');
      assert.equal(row.success, true); assert.ok(row.latencyMs >= 0);
      assert.equal(row.inputTokens, 11); assert.equal(row.outputTokens, 7);
      assert.ok(!JSON.stringify(row).includes('합성 원문'));
    }
  }
});

for (const purpose of ['sayuPolish', 'recordStats', 'sayuPolishComment']) {
  for (const failure of ['failPurpose', 'failTextPurpose']) {
    test(`${purpose}/${failure}: 공급자와 응답 읽기 실패를 중복 행 없이 구분한다`, async () => {
      const f = fixture({ [failure]: purpose });
      if (purpose === 'sayuPolish') await assert.rejects(f.request()); else await f.request();
      const rows = f.usage.filter(row => row.purpose === purpose);
      assert.equal(rows.length, 1);
      assert.equal(f.usage.length, f.calls.length);
      const row = rows[0]; assert.equal(row.success, false);
      assert.equal(row.processingOutcome, failure === 'failPurpose' ? 'provider_error' : 'response_error');
      assert.equal(row.providerOutcome, failure === 'failPurpose' ? 'error' : 'returned');
      assert.equal(row.inputTokens, failure === 'failPurpose' ? null : 11);
      assert.ok(!JSON.stringify(row).includes('synthetic-provider-failure'));
    });
  }
}

test('통계 JSON 없음/파싱 실패는 한 단계 실패로 기록하고 본문·한마디·quota를 유지한다', async () => {
  for (const statsText of ['JSON 없음', '{broken JSON}']) {
    const f = fixture({ statsText }); const result = await f.request();
    assert.equal(result.stats, null); assert.equal(result.text, '합성 본문');
    assert.equal(f.usage.length, 3); assert.equal(f.usage[1].processingOutcome, 'processing_error');
    assert.equal(f.usage[1].providerOutcome, 'returned'); assert.equal(f.usage[1].success, false);
    assert.equal(f.rollbacks.length, 0);
  }
});

test('입력·quota 거부는 모델을 호출하지 않은 요청 실패로만 기록한다', async () => {
  for (const [options, data] of [[{}, { text: '' }], [{ quotaDenied: true }, {}]]) {
    const f = fixture(options); await assert.rejects(f.request(data));
    assert.equal(f.calls.length, 0); assert.equal(f.usage.length, 1);
    assert.equal(f.usage[0].stage, 'request'); assert.equal(f.usage[0].modelInvoked, false);
    assert.equal(f.usage[0].providerOutcome, 'not_called');
  }
});

test('인증·rate 거부는 기존처럼 usage 행을 추가하지 않는다', async () => {
  const f = fixture({ rateDenied: true }); await assert.rejects(f.request());
  assert.equal(f.usage.length, 0); assert.equal(f.rollbacks.length, 0);
});
