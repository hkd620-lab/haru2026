const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(data = {}, failRead = false, failWrite = false) {
  let reads = 0, writes = 0;
  const rows = [];
  const firestore = () => ({
    doc: p => { assert.equal(p, 'users/synthetic/subscription/info'); return {
      get: async () => { reads++; if (failRead) throw Error('private-read-error'); return { data: () => data }; },
    }; },
    collection: p => { assert.equal(p, 'aiUsageLogs'); return {
      add: async row => { writes++; if (failWrite) throw Error('private-write-error'); rows.push(row); },
    }; },
  });
  firestore.FieldValue = { serverTimestamp: () => 'server-time' };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/aiUsageLogger.js'), 'utf8'), {
    exports, require: () => ({ firestore }), console: { error() {} }, Date,
  });
  const input = { uid: 'synthetic', plan: 'beta', isDev: false, featureName: 'sayu_polish',
    model: 'synthetic-model', inputTokens: 1, outputTokens: 2, imageCount: 0,
    externalApiProvider: null, externalApiCalled: false, groundingUsed: false,
    requestId: 'synthetic-request', success: true, errorCode: null };
  return { exports, input, rows, reads: () => reads, writes: () => writes };
}

for (const [name, data, extra, expected, readCount] of [
  ['basic', { plan: 'basic' }, {}, 'basic', 1],
  ['premium/inactive 기존 의미 유지', { plan: 'premium', status: 'inactive' }, {}, 'premium', 1],
  ['만료 endDate', { plan: 'premium', endDate: '2000-01-01' }, {}, 'free', 1],
  ['만료 expiresAt', { plan: 'basic', expiresAt: { toMillis: () => 0 } }, {}, 'free', 1],
  ['미래 만료일', { plan: 'basic', endDate: '2999-01-01' }, {}, 'basic', 1],
  ['문서 없음', {}, {}, 'free', 1],
  ['beta 아닌 fallback', {}, { plan: 'basic' }, 'basic', 1],
  ['개발자', {}, { isDev: true }, 'developer', 0],
  ['명시적 actualPlan', {}, { actualPlan: 'premium' }, 'premium', 0],
]) {
  test(`${name}: 기존 판정 유지·같은 요청 병렬 3로그에 최대 1조회`, async () => {
    const f = fixture(data); const log = f.exports.createRequestAiUsageLogger();
    const input = { ...f.input, ...extra };
    await Promise.all([log(input), log(input), log(input)]);
    assert.equal(f.reads(), readCount); assert.equal(f.rows.length, 3);
    assert.ok(f.rows.every(row => row.actualPlan === expected));
    assert.ok(f.rows.every(row => row.plan === (input.plan === 'beta' ? expected : input.plan)));
  });
}

test('요청 사이 캐시 없음·동일 요청의 최초 로그 판정 스냅샷 유지', async () => {
  const data = { plan: 'basic' }; const f = fixture(data);
  const first = f.exports.createRequestAiUsageLogger(); await first(f.input);
  data.plan = 'premium'; await first(f.input);
  const second = f.exports.createRequestAiUsageLogger(); await second(f.input);
  assert.equal(f.reads(), 2);
  assert.deepEqual(f.rows.map(row => row.actualPlan), ['basic', 'basic', 'premium']);
});

test('조회 실패는 기존 fallback을 요청 내 재사용하고 다음 요청에서 재시도한다', async () => {
  const f = fixture({}, true); const log = f.exports.createRequestAiUsageLogger();
  await log(f.input); await log(f.input); assert.equal(f.reads(), 1);
  await f.exports.createRequestAiUsageLogger()(f.input); assert.equal(f.reads(), 2);
  assert.ok(f.rows.every(row => row.actualPlan === 'free'));
});

test('저장 실패는 밖으로 전파하지 않으며 다른 로그 저장 시도는 계속한다', async () => {
  const f = fixture({}, false, true); const log = f.exports.createRequestAiUsageLogger();
  await log(f.input); await log(f.input);
  assert.equal(f.reads(), 1); assert.equal(f.writes(), 2);
});

test('기존 logAiUsage 직접 호출은 요청 캐시를 적용하지 않는다', async () => {
  const f = fixture({ plan: 'basic' });
  await f.exports.logAiUsage(f.input); await f.exports.logAiUsage(f.input);
  assert.equal(f.reads(), 2);
});
