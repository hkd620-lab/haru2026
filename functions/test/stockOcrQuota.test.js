const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const quota = require('../lib/utils/monthlyAiQuota');
class HttpsError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}
const helperSource = fs.readFileSync(require.resolve('../src/stockOcrQuota.ts'), 'utf8');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const handlerSource = source.slice(source.indexOf('export const extractStockTradeTextFromPhoto ='), source.indexOf('type LedgerOcrImageInput ='));
function fixture({ plan = 'free', used = 0, provider } = {}) {
  let period = '2026-11', tail = Promise.resolve(), calls = 0;
  const key = month => `users/user/monthlyAiUsage/${month}`;
  const docs = new Map([[key(period), { usedCount: 10, byFeature: { stock_ocr: used, book_ocr: 20 } }]]);
  const merge = (ref, update) => {
    const data = docs.get(ref.path) || {};
    for (const [k, v] of Object.entries(update)) {
      if (k === 'byFeature') {
        data.byFeature ||= {};
        for (const [feature, n] of Object.entries(v)) data.byFeature[feature] = (data.byFeature[feature] || 0) + n.increment;
      } else data[k] = v;
    }
    docs.set(ref.path, data);
  };
  const db = {
    doc: path => ({ path, set: async value => merge({ path }, value) }),
    runTransaction: fn => {
      const next = tail.then(() => fn({
        get: async ref => ({ exists: docs.has(ref.path), data: () => docs.get(ref.path) }),
        set: merge,
      }));
      tail = next.catch(() => {}); return next;
    },
  };
  const firestore = Object.assign(() => db, { FieldValue: { increment: n => ({ increment: n }), serverTimestamp: () => 'timestamp' } });
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    module, exports: module.exports, console: { warn() {} },
    require: name => {
      if (name === 'firebase-admin') return { firestore };
      if (name === 'firebase-functions/v2/https') return { HttpsError };
      if (name === './utils/monthlyAiQuota') return { ...quota, resolveMonthlyAiPlan: async () => plan, getKstMonthKey: () => period };
      throw Error(name);
    },
  });
  const helpers = module.exports;
  const context = {
    onCall: (_, fn) => fn, aiSecretsFor: () => [], HttpsError,
    enforceRateLimit: async () => {}, ...helpers,
    reserveStockOcrQuota: helpers.reserveStockOcrQuota,
    rollbackStockOcrQuota: helpers.rollbackStockOcrQuota,
    logger: { error() {} },
    callAi: async () => { calls++; return provider ? provider(() => { period = '2026-12'; }) : { text: () => '{"text":"시험 거래","trade":{"stock_name":"시험종목"}}' }; },
  };
  vm.runInNewContext(ts.transpileModule(handlerSource.replace('export const extractStockTradeTextFromPhoto =', 'globalThis.handler ='), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
  return {
    call: (data = { imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg' }, auth = { uid: 'user' }) => context.handler({ data, auth }),
    reserve: () => helpers.reserveStockOcrQuota('user'),
    calls: () => calls,
    data: (month = '2026-11') => docs.get(key(month)),
  };
}

for (const [plan, limit] of Object.entries(quota.MONTHLY_OCR_QUOTA_LIMITS)) {
  test(`${plan}: 마지막 1장만 허용하고 초과는 AI 호출 전에 차단`, async () => {
    const f = fixture({ plan, used: limit - 1 });
    const result = await f.call();
    assert.equal(result.trade.stock_name, '시험종목');
    assert.equal(result.quota.remaining, 0);
    await assert.rejects(f.call(), e => e.code === 'resource-exhausted' && e.details.reason === 'MONTHLY_STOCK_OCR_QUOTA_EXCEEDED');
    assert.equal(f.calls(), 1);
    assert.equal(f.data().byFeature.stock_ocr, limit);
    assert.equal(f.data().byFeature.book_ocr, 20);
    assert.equal(f.data().usedCount, 10);
  });
}

test('일반 AI·독서 OCR이 소진돼도 주식은 독립 사용', async () => {
  const f = fixture(); await f.call();
  assert.equal(f.data().byFeature.stock_ocr, 1);
  assert.equal(f.data().byFeature.book_ocr, 20);
  assert.equal(f.data().usedCount, 10);
});

test('마지막 한도에 동시 요청해도 1개만 공급자를 호출', async () => {
  const f = fixture({ used: 19 });
  const results = await Promise.allSettled([f.call(), f.call(), f.call()]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.calls(), 1); assert.equal(f.data().byFeature.stock_ocr, 20);
});

test('공급자 실패는 주식 예약만 복원하고 월 경계도 원래 월로 복원', async () => {
  const f = fixture({ used: 3, provider: changeMonth => { changeMonth(); throw Error('provider failure'); } });
  await assert.rejects(f.call(), e => e.code === 'internal');
  assert.equal(f.data().byFeature.stock_ocr, 3);
  assert.equal(f.data().byFeature.book_ocr, 20);
  assert.equal(f.data().usedCount, 10);
  assert.equal(f.data('2026-12'), undefined);
});

test('미인증·빈 이미지·크기 초과는 예약도 AI도 실행하지 않는다', async () => {
  const f = fixture();
  await assert.rejects(f.call({}, null), e => e.code === 'unauthenticated');
  await assert.rejects(f.call({}), e => e.code === 'invalid-argument');
  await assert.rejects(f.call({ imageBase64: 'a'.repeat(10 * 1024 * 1024) }), e => e.code === 'invalid-argument');
  assert.equal(f.calls(), 0); assert.equal(f.data().byFeature.stock_ocr, 0);
});
