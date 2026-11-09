const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const fixture = require('./fixtures/aiLibraryJevKorean.synthetic.json');

// Offline only: no transport, SDK, environment, datastore or credential access.
// The VM exposes no fetch, process, timers or general require. Imports fail closed.
const context = vm.createContext({ Buffer });
const cache = new Map();
function loadSource(name) {
  assert.ok(['aiLibraryCategory', 'aiLibraryJevChoice', 'aiLibraryClassification'].includes(name));
  if (cache.has(name)) return cache.get(name);
  const source = fs.readFileSync(path.join(__dirname, `../src/${name}.ts`), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const exports = {};
  vm.runInContext(`(function(require,exports){${code}\n})`, context)((id) => {
    if (id === './aiLibraryCategory') return loadSource('aiLibraryCategory');
    if (name === 'aiLibraryClassification' && id === 'node:crypto') {
      return { createHash() { throw new Error('Hashing is outside this offline fixture test'); } };
    }
    throw new Error(`Dependency not allowed: ${id}`);
  }, exports);
  cache.set(name, exports);
  return exports;
}
const adapter = loadSource('aiLibraryJevChoice');
const core = loadSource('aiLibraryClassification');
const { AI_LIBRARY_CATEGORIES: categories } = loadSource('aiLibraryCategory');
const plain = value => JSON.parse(JSON.stringify(value));
// Parse JSON into the adapter's realm so strict own-property/prototype checks are retained.
const inRealm = value => vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`, context);

test('synthetic provenance, balanced category coverage and human-designed expectations', () => {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.provenance, 'newly-authored-synthetic-korean-no-user-records');
  assert.equal(fixture.expectations, 'human-designed-unvalidated-model-quality');
  assert.equal(fixture.cases.length, 20);
  assert.equal(new Set(fixture.cases.map(c => c.id)).size, 20);
  assert.equal(new Set(fixture.cases.map(c => c.text)).size, 20);
  for (const category of categories) {
    assert.equal(fixture.cases.filter(c => c.expected.category === category).length, 3);
  }
  assert.equal(fixture.cases.filter(c => c.expected.status === 'review').length, 5);
  for (const c of fixture.cases) {
    assert.match(c.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.match(c.rationale, /[가-힣]/u);
    assert.deepEqual(Object.keys(c).sort(), ['expected', 'id', 'rationale', 'text']);
    assert.ok(['classified', 'review'].includes(c.expected.status));
    assert.deepEqual(Object.keys(c.expected).sort(), c.expected.status === 'review' ? ['status'] : ['category', 'status']);
    if (c.expected.status === 'classified') assert.ok(categories.includes(c.expected.category));
  }
});

for (const c of fixture.cases) test(`offline payload integrity: ${c.id}`, () => {
  assert.match(c.text, /[가-힣]/u);
  assert.ok(Buffer.byteLength(c.text, 'utf8') <= 1000, 'compact synthetic text');
  // These checks supplement manual synthetic authorship; they are NOT a PII detector.
  assert.doesNotMatch(c.text, /https?:|www\.|@|\d|[\u0000-\u001f]/iu);
  const payload = core.prepareClassificationPayload({ type: 'ai_log', content: c.text });
  assert.deepEqual(plain(payload), { text: c.text, reason: null });
  const request = adapter.buildJevChoiceRequest(payload.text);
  assert.deepEqual(Object.keys(request).sort(), ['model', 'questions', 'state']);
  assert.equal(request.state, c.text);
  assert.equal(request.model, core.CLASSIFICATION_MODEL);
  assert.deepEqual(plain(Object.keys(request.questions.category.criteria)), plain(categories));
  assert.ok(Buffer.byteLength(request.state, 'utf8') <= adapter.JEV_MAX_TEXT_BYTES);
  assert.ok(Buffer.byteLength(JSON.stringify(request), 'utf8') <= adapter.JEV_MAX_REQUEST_BYTES);
  assert.ok(!JSON.stringify(request).includes(c.rationale), 'labels and rationale stay local');
});

test('minimization strips synthetic routing metadata, and oversized text stays local', () => {
  const text = fixture.cases[0].text;
  const payload = core.prepareClassificationPayload({ type: 'ai_log',
    content: `id: synthetic-only\nsource: fixture-only\n${text}\nhttps://example.invalid/fixture nobody@example.invalid 2099-01-01` });
  assert.deepEqual(plain(payload), { text, reason: null });
  assert.equal(core.prepareClassificationPayload({ type: 'ai_log', content: '가'.repeat(6000) }).reason, 'long_text_review');
});

function fakeResponse(choice) {
  return { model: adapter.JEV_MODEL, answers: {
    category: { type: 'choice', choice, confidence: 0.95,
      probabilities: Object.fromEntries(categories.map(c => [c, c === choice ? 0.96 : 0.01])) },
    in_scope: { type: 'noul', noul: 0.99 },
  }, usage: { input_tokens: 0, output_tokens: 0 } };
}
test('fabricated wire responses obey category/review contract, NOT model quality', () => {
  for (const category of categories) {
    assert.deepEqual(plain(adapter.parseJevChoiceResponse(inRealm(fakeResponse(category))).decision),
      { status: 'classified', category, confidence: 0.95 });
  }
  for (const [reason, mutate] of [
    ['out_of_scope', r => { r.answers.in_scope.noul = 0.1; }],
    ['low_confidence', r => { r.answers.category.confidence = 0.5; }],
    ['ambiguous', r => { r.answers.category.probabilities = { 'medical-tech': 0.01, health: 0.48, life: 0.48, investment: 0.02, 'ai-tech': 0.01 }; }],
  ]) {
    const response = fakeResponse('health'); mutate(response);
    assert.deepEqual(plain(adapter.parseJevChoiceResponse(inRealm(response)).decision), { status: 'review', reason });
  }
});

test('no network capability or transport is available; no call is made', async () => {
  assert.equal(vm.runInContext('typeof fetch', context), 'undefined');
  assert.equal(vm.runInContext('typeof process', context), 'undefined');
  assert.equal(vm.runInContext('typeof require', context), 'undefined');
  const result = await adapter.classifyApprovedText(fixture.cases[0].text);
  assert.deepEqual(plain(result.decision), { status: 'review', reason: 'missing_transport' });
});

test('future single-pass conservative budget is exact and does not authorize execution', () => {
  assert.equal(core.CLASSIFICATION_MIN_RESERVATION_MICROUSD, fixture.maxRequestCostMicrousd);
  assert.equal(fixture.cases.length * fixture.maxRequestCostMicrousd, 55060);
});
