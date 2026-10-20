// Read-only audit: AST-extract exact handlers; all storage and AI are in-memory fakes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const deps = process.env.HARU_AUDIT_DEPS;
if (!deps) throw Error('HARU_AUDIT_DEPS must point to existing node_modules');
const parser = require(path.join(deps, '@babel/parser/lib/index.js'));
const esbuild = require(path.join(deps, 'esbuild/lib/main.js'));
const repo = path.resolve(__dirname, '../../..');
const main = fs.readFileSync(path.join(repo, 'functions/src/index.ts'), 'utf8');
const registry = fs.readFileSync(path.join(repo, 'functions/src/formats/formatRegistry.ts'), 'utf8');
const registryModule = { exports: {} };
new vm.Script(esbuild.transformSync(registry, { loader: 'ts', format: 'cjs' }).code)
  .runInNewContext({ module: registryModule, exports: registryModule.exports });
function all(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (predicate(node)) out.push(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(n => all(n, predicate, out));
    else if (value && typeof value === 'object') all(value, predicate, out);
  }
  return out;
}
function extract(source, compiled = false) {
  const ast = parser.parse(source, { sourceType: 'unambiguous', plugins: ['typescript'] });
  const defs = all(ast, n => compiled
    ? n.type === 'AssignmentExpression' && n.left?.object?.name === 'exports' && n.left?.property?.name === 'generateTitlesForAll' && n.right?.type === 'CallExpression'
    : n.type === 'VariableDeclarator' && n.id?.name === 'generateTitlesForAll');
  assert.equal(defs.length, 1);
  const handler = (compiled ? defs[0].right : defs[0].init).arguments.at(-1);
  const validators = all(ast, n => n.type === 'FunctionDeclaration' && n.id?.name === 'isValidTitle');
  assert.equal(validators.length, 1);
  const cut = n => source.slice(n.start, n.end);
  return { handler: cut(handler), validator: cut(validators[0]), line: handler.loc.start.line, sha256: crypto.createHash('sha256').update(source).digest('hex') };
}
const baseRecord = { formats: ['메모'], memo_simple: '실제 사용자 정보가 없는 합성 기록입니다.' };
function setup(extracted, initial, options = {}) {
  const records = initial.map(r => structuredClone(r));
  const trace = [], writes = [], queryLimits = [];
  let failed = false;
  const collection = {
    doc: () => collection, collection: () => collection,
    limit: n => { queryLimits.push(n); return collection; },
    get: async () => ({ docs: records.slice(0, 500).map((record, i) => {
      const snapshot = structuredClone(record);
      return { id: `synthetic-${i}`, data: () => snapshot, ref: { update: async update => {
        if (options.failWriteAt === i && !failed) { failed = true; throw Error('synthetic write failure'); }
        writes.push({ index: i, fields: Object.keys(update) }); Object.assign(record, update);
      } } };
    }) }),
  };
  async function fakeAi(prompt) {
    const call = trace.length + 1;
    trace.push({ call, promptCharacters: String(prompt).length });
    if (options.gate) await options.gate(trace.length);
    return { text: () => `합성 생성 제목 ${call}`, response: { text: () => `합성 생성 제목 ${call}` } };
  }
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  class GoogleGenerativeAI { getGenerativeModel() { return { generateContent: fakeAi }; } }
  const context = {
    db: { collection: () => collection }, HttpsError, GoogleGenerativeAI,
    https_2: { HttpsError }, generative_ai_1: { GoogleGenerativeAI },
    internalEntitlements_1: { isInternalDeveloperUid: uid => uid === 'synthetic-developer' },
    GEMINI_API_KEY_SECRET: { value: () => 'synthetic-never-transmitted' },
    isInternalDeveloperUid: uid => uid === 'synthetic-developer',
    buildFormatPrefixMap: registryModule.exports.buildFormatPrefixMap,
    callAi: async ({ input }) => fakeAi(input), logger: { error() {} },
  };
  const code = `${extracted.validator};const fn=${extracted.handler};fn;`;
  const fn = new vm.Script(esbuild.transformSync(code, { loader: 'ts' }).code).runInNewContext(context);
  const request = { auth: { uid: 'synthetic-developer' } };
  return { fn, request, records, trace, writes, queryLimits };
}
async function twice(extracted, record) {
  const f = setup(extracted, [record]);
  const a = await f.fn(f.request), n = f.trace.length;
  const b = await f.fn(f.request);
  return { firstCalls: n, secondCalls: f.trace.length - n, firstCount: a.count, secondCount: b.count,
    writes: f.writes.length, manualTitle: f.records[0].memo_title ?? null, aiTitle: f.records[0].memo_ai_title ?? null };
}
async function audit(extracted) {
  const cases = {};
  cases.noTitle = await twice(extracted, baseRecord);
  cases.manualTitle = await twice(extracted, { ...baseRecord, memo_title: '사용자가 작성한 제목' });
  cases.existingAiTitle = await twice(extracted, { ...baseRecord, memo_ai_title: '이미 생성된 제목' });
  cases.invalidManualTitle = await twice(extracted, { ...baseRecord, memo_title: '09:00' });
  cases.invalidManualWithValidAiTitle = await twice(extracted, { ...baseRecord, memo_title: '09:00', memo_ai_title: '유효한 기존 AI 제목' });
  cases.invalidAiTitle = await twice(extracted, { ...baseRecord, memo_ai_title: '123' });
  cases.noContent = await twice(extracted, { formats: ['메모'], memo_ai_title: '기존 AI 제목' });
  const malformed = setup(extracted, [{ ...baseRecord, memo_title: 123 }]);
  let malformedError; try { await malformed.fn(malformed.request); } catch (e) { malformedError = e.name; }
  cases.nonStringManualTitle = { error: malformedError, calls: malformed.trace.length, writes: malformed.writes.length };
  const duplicate = setup(extracted, [{ ...baseRecord, formats: ['메모', '메모'] }]);
  const dup = await duplicate.fn(duplicate.request);
  cases.duplicateFormat = { calls: duplicate.trace.length, reportedCount: dup.count, documentWrites: duplicate.writes.length, savedTitleFields: duplicate.writes[0].fields.filter(k => k.endsWith('_ai_title')).length };
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const parallel = setup(extracted, [baseRecord], { gate: async n => { if (n === 2) release(); await pending; } });
  await Promise.all([parallel.fn(parallel.request), parallel.fn(parallel.request)]);
  cases.parallelRequests = { calls: parallel.trace.length, writes: parallel.writes.length };
  const partial = setup(extracted, [baseRecord, baseRecord], { failWriteAt: 1 });
  await assert.rejects(partial.fn(partial.request));
  const firstCalls = partial.trace.length, firstWrites = partial.writes.length;
  await partial.fn(partial.request);
  cases.restartAfterWriteFailure = { firstCalls, firstWrites, retryCalls: partial.trace.length - firstCalls, retryWrites: partial.writes.length - firstWrites };
  for (const [name, req] of [['unauthenticated', {}], ['notDeveloper', { auth: { uid: 'synthetic-ordinary' } }]]) {
    const f = setup(extracted, [baseRecord]);
    let error; try { await f.fn(req); } catch (e) { error = e.code; }
    cases[name] = { error, calls: f.trace.length, queryCount: f.queryLimits.length };
  }
  assert.equal(cases.noTitle.firstCalls, 1); assert.equal(cases.noTitle.secondCalls, 1);
  assert.equal(cases.manualTitle.firstCalls, 0); assert.equal(cases.manualTitle.secondCalls, 0);
  assert.equal(cases.manualTitle.manualTitle, '사용자가 작성한 제목');
  assert.equal(cases.existingAiTitle.firstCalls, 1); assert.equal(cases.existingAiTitle.secondCalls, 1);
  assert.equal(cases.invalidManualWithValidAiTitle.firstCalls, 1);
  assert.equal(cases.noContent.firstCalls, 0);
  assert.equal(cases.nonStringManualTitle.error, 'TypeError'); assert.equal(cases.nonStringManualTitle.calls, 0);
  assert.equal(cases.parallelRequests.calls, 2); assert.equal(cases.parallelRequests.writes, 2);
  assert.equal(cases.duplicateFormat.calls, 2); assert.equal(cases.duplicateFormat.savedTitleFields, 1);
  assert.equal(cases.restartAfterWriteFailure.firstCalls, 2); assert.equal(cases.restartAfterWriteFailure.retryCalls, 2);
  assert.equal(cases.unauthenticated.error, 'unauthenticated'); assert.equal(cases.notDeveloper.error, 'permission-denied');
  assert.equal(cases.unauthenticated.calls + cases.notDeveloper.calls, 0);
  return { source: { sha256: extracted.sha256, handlerLine: extracted.line }, cases };
}
(async () => {
  const result = { base: 'be7f9afee0f686c80d63728263242824893d4c9b', method: 'exact AST-extracted code; synthetic in-memory AI/storage; no Firebase/provider imports or network calls', main: await audit(extract(main)) };
  if (process.env.HARU_DEPLOYED_TS && process.env.HARU_DEPLOYED_JS) {
    result.deployedTypeScript = await audit(extract(fs.readFileSync(process.env.HARU_DEPLOYED_TS, 'utf8')));
    result.deployedJavaScript = await audit(extract(fs.readFileSync(process.env.HARU_DEPLOYED_JS, 'utf8'), true));
    assert.deepEqual(result.main.cases, result.deployedTypeScript.cases);
    assert.deepEqual(result.main.cases, result.deployedJavaScript.cases);
  }
  result.status = 'all assertions passed';
  fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, main: result.main.cases, deployedVariantsVerified: !!result.deployedJavaScript }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
