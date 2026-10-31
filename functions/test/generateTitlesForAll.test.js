// Actual callable body + validator, with in-memory Firestore/AI only. No SDK/network imports.
// Run: npm run build && node --test test/generateTitlesForAll.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { buildFormatPrefixMap } = require('../lib/formats/formatRegistry.js');

const source = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const find = predicate => {
  const matches = [];
  const visit = node => { if (predicate(node)) matches.push(node); ts.forEachChild(node, visit); };
  visit(ast);
  assert.equal(matches.length, 1);
  return matches[0];
};
const declaration = find(node => ts.isVariableDeclaration(node) && node.name.getText(ast) === 'generateTitlesForAll');
const handler = declaration.initializer.arguments[declaration.initializer.arguments.length - 1];
const validator = find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'isValidTitle');
const compiled = ts.transpileModule(`${validator.getText(ast)};const handler=${handler.getText(ast)};handler;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
}).outputText;

const memo = { formats: ['메모'], memo_simple: '개인정보 없는 합성 기록', unrelated: 'preserved', updatedAt: 'original-time' };
function fixture(initial = [memo], options = {}) {
  const records = initial.map(record => structuredClone(record)), calls = [], writes = [], limits = [];
  let failWrite = options.failWriteAt;
  const collection = {
    doc: uid => { assert.equal(uid, 'synthetic-developer'); return collection; },
    collection: name => { assert.equal(name, 'records'); return collection; },
    limit: n => { limits.push(n); return collection; },
    get: async () => ({ docs: records.slice(0, 500).map((record, i) => {
      const snapshot = structuredClone(record);
      return { id: `synthetic-${i}`, data: () => snapshot, ref: { update: async value => {
        if (failWrite === i) { failWrite = undefined; throw new Error('synthetic write failure'); }
        writes.push({ index: i, value: structuredClone(value) }); Object.assign(record, value);
      } } };
    }) }),
  };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const fn = new vm.Script(compiled).runInNewContext({
    HttpsError, isInternalDeveloperUid: uid => uid === 'synthetic-developer', buildFormatPrefixMap,
    db: { collection: name => { assert.equal(name, 'users'); return collection; } },
    logger: { error() {} },
    callAi: async request => {
      calls.push(structuredClone(request));
      assert.equal(request.purpose, 'recordTitleBackfill');
      const text = options.respond ? await options.respond(request, calls.length) : '합성 AI 제목';
      return { text: () => text };
    },
  });
  return { records, calls, writes, limits, fn, run: () => fn({ auth: { uid: 'synthetic-developer' } }) };
}

test('유효한 사용자 제목은 AI 제목 상태와 관계없이 원값·updatedAt까지 보존한다', async () => {
  for (const aiTitle of [undefined, '기존 AI 제목', 123, ['배열'], { value: '객체' }]) {
    const original = { ...memo, memo_title: '  사용자가 작성한 제목  ', memo_ai_title: aiTitle };
    const f = fixture([original]);
    assert.equal((await f.run()).count, 0);
    assert.deepEqual(f.records, [original]); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
  }
});

test('유효한 AI 제목은 무효·비문자열 사용자 제목과 함께 있어도 모두 보존한다', async () => {
  for (const manualTitle of [undefined, null, '', ' ', '09:00', '123', 123, true, false, [], ['배열'], { value: '객체' }]) {
    const original = { ...memo, memo_title: manualTitle, memo_ai_title: '  이미 생성한 제목  ' };
    const f = fixture([original]);
    assert.equal((await f.run()).count, 0);
    assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0); assert.deepEqual(f.records, [original]);
  }
});

test('두 제목이 없거나 무효이면 생성하되 비문자열 사용자 값은 덮어쓰지 않는다', async () => {
  for (const invalid of [undefined, null, '', ' ', '1', '09:00', 123, true, [], ['배열'], { value: '객체' }]) {
    const original = { ...memo, memo_title: invalid, memo_ai_title: invalid };
    const f = fixture([original]);
    assert.equal((await f.run()).count, 1);
    assert.equal(f.calls.length, 1); assert.equal(f.writes.length, 1);
    assert.deepEqual(f.records[0].memo_title, invalid); assert.equal(f.records[0].memo_ai_title, '합성 AI 제목');
    assert.equal(f.records[0].unrelated, 'preserved');
    assert.deepEqual(Object.keys(f.writes[0].value).sort(), ['memo_ai_title', 'updatedAt']);
  }
});

test('최초 생성 뒤 재실행은 모델 호출·쓰기 없이 count=0을 반환한다', async () => {
  const f = fixture();
  assert.equal((await f.run()).count, 1);
  const saved = structuredClone(f.records);
  assert.equal((await f.run()).count, 0);
  assert.equal(f.calls.length, 1); assert.equal(f.writes.length, 1); assert.deepEqual(f.records, saved);
  assert.deepEqual(f.limits, [500, 500]);
});

test('한 기록의 중복 형식은 1회만 처리하고 서로 다른 형식은 각각 처리한다', async () => {
  const f = fixture([{ ...memo, formats: ['메모', '메모', '미등록 형식', '에세이', '에세이', '메모'], essay_simple: '합성 에세이' }]);
  assert.equal((await f.run()).count, 2);
  assert.equal(f.calls.length, 2); assert.equal(f.writes.length, 1);
  assert.deepEqual(Object.keys(f.writes[0].value).sort(), ['essay_ai_title', 'memo_ai_title', 'updatedAt']);
});

test('중복 판정은 기록별로 나뉘어 다른 기록의 같은 형식을 생략하지 않는다', async () => {
  const f = fixture([{ ...memo, formats: ['메모', '메모'] }, { ...memo, formats: ['메모', '메모'] }]);
  assert.equal((await f.run()).count, 2);
  assert.equal(f.calls.length, 2); assert.equal(f.writes.length, 2);
});

test('같은 형식의 AI 오류는 한 요청 안에서 재시도하지 않고 다른 형식은 계속 처리한다', async () => {
  const f = fixture([{ ...memo, formats: ['메모', '메모', '에세이'], essay_simple: '합성 에세이' }], {
    respond: request => { if (request.input.includes('기록 형식: 메모')) throw new Error('synthetic AI failure'); return '에세이 제목'; },
  });
  assert.equal((await f.run()).count, 1);
  assert.equal(f.calls.length, 2); assert.equal(f.records[0].memo_ai_title, undefined);
  assert.equal(f.records[0].essay_ai_title, '에세이 제목');
});

test('무효 생성 제목은 저장하지 않으며 중복 형식이 있어도 같은 요청에서 다시 생성하지 않는다', async () => {
  const original = { ...memo, formats: ['메모', '메모'] };
  const f = fixture([original], { respond: () => '09:00' });
  assert.equal((await f.run()).count, 0); assert.equal(f.calls.length, 1);
  assert.equal(f.writes.length, 0); assert.deepEqual(f.records, [original]);
});

test('저장 실패 후 재시작은 이미 완료한 문서를 보존하고 실패 문서만 다시 생성한다', async () => {
  const f = fixture([memo, memo], { failWriteAt: 1 });
  await assert.rejects(f.run(), /synthetic write failure/);
  const completed = structuredClone(f.records[0]);
  assert.equal(f.calls.length, 2); assert.equal(f.writes.length, 1);
  assert.equal((await f.run()).count, 1);
  assert.equal(f.calls.length, 3); assert.equal(f.writes.length, 2); assert.deepEqual(f.records[0], completed);
});

test('제목과 본문이 모두 없으면 생성·쓰기 없이 종료한다', async () => {
  const f = fixture([{ formats: ['메모'], memo_title: '09:00' }]);
  assert.equal((await f.run()).count, 0); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
});

test('인증/개발자 권한 없이는 조회와 모델 호출 전에 거부한다', async () => {
  for (const [request, code] of [[{}, 'unauthenticated'], [{ auth: { uid: 'ordinary-synthetic-user' } }, 'permission-denied']]) {
    const f = fixture();
    await assert.rejects(f.fn(request), error => error.code === code);
    assert.equal(f.limits.length, 0); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
  }
});
