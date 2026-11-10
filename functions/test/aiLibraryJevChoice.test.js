const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load current source, never generated lib: only the pure category helper is allowed.
function loadSource(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, `../src/${name}.ts`), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  vm.runInThisContext(`(function(require,exports){${code}\n})`)((id) => {
    if (name === 'aiLibraryJevChoice' && id === './aiLibraryCategory') return loadSource('aiLibraryCategory');
    throw new Error(`Unexpected dependency: ${id}`);
  }, exports);
  return exports;
}
const {
  JEV_MODEL, JEV_MAX_TEXT_BYTES, JEV_MAX_INPUT_TOKENS, JEV_MAX_OUTPUT_TOKENS,
  buildJevChoiceRequest, parseJevChoiceResponse, classifyApprovedText,
} = loadSource('aiLibraryJevChoice');
const categories = ['medical-tech', 'health', 'life', 'investment', 'ai-tech', 'harulab'];
function response(choice = 'health') {
  return { model: JEV_MODEL, answers: {
    category: { type: 'choice', choice, confidence: 0.95,
      probabilities: Object.fromEntries(categories.map(key => [key, key === choice ? 0.95 : 0.01])) },
    in_scope: { type: 'noul', noul: 0.99 },
  }, usage: { input_tokens: 1000, output_tokens: 100 } };
}
test('wire request uses pinned model, one Choice and companion Noul, approved text only', () => {
  const r = buildJevChoiceRequest('일상 건강 정보');
  assert.deepEqual(Object.keys(r), ['model', 'state', 'questions']);
  assert.equal(r.model, 'jev-1.14.0');
  assert.equal(r.state, '일상 건강 정보');
  assert.deepEqual(Object.keys(r.questions), ['category', 'in_scope']);
  assert.deepEqual(Object.keys(r.questions.category), ['type', 'instructions', 'criteria']);
  assert.equal(r.questions.category.type, 'choice');
  assert.equal(r.questions.in_scope.type, 'noul');
  assert.deepEqual(Object.keys(r.questions.category.criteria), categories);
  assert.deepEqual(Object.keys(r.questions.in_scope.criteria), ['true', 'false']);
  assert.ok(!JSON.stringify(r).includes('Long-Context'));
  const another = buildJevChoiceRequest('다른 정보');
  r.questions.category.criteria.health = 'mutated';
  assert.notEqual(another.questions.category.criteria.health, 'mutated');
});
test('input bounded in UTF8 bytes without truncation or metadata coercion', () => {
  for (const input of ['', '   ', null, {}, {text: 'x', uid: 'private'}, 'x\0y', '가'.repeat(6000), 'x'.repeat(JEV_MAX_TEXT_BYTES + 1)]) {
    assert.throws(() => buildJevChoiceRequest(input), /Invalid approved/);
  }
  assert.equal(buildJevChoiceRequest('x'.repeat(JEV_MAX_TEXT_BYTES)).state.length, JEV_MAX_TEXT_BYTES);
});
for (const category of categories) test(`valid ${category} returns decision and usage`, async () => {
  let calls = 0;
  const result = await classifyApprovedText('synthetic approved content', async req => {
    calls++;
    assert.equal(req.model, JEV_MODEL);
    return response(category);
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { decision: {status:'classified', category, confidence:0.95}, usage:{inputTokens:1000,outputTokens:100} });
});
test('reject malformed, prototype, getter, nonfinite and inconsistent answers', () => {
  const mutations = [
    r => {r.model = 'jev-latest';}, r => {r.extra = 'unexpected';},
    r => {r.answers.category.choice = '__proto__';},
    r => {r.answers.category.choice = 'life';},
    r => {r.answers.category.confidence = NaN;}, r => {r.answers.category.confidence = Infinity;},
    r => {r.answers.category.probabilities.health = 1.1;},
    r => {delete r.answers.category.probabilities.life;},
    r => {r.answers.category.probabilities.health = 0.8;},
    r => {r.answers.in_scope.noul = -1;}, r => {r.answers.in_scope.type = 'choice';},
    r => {Object.setPrototypeOf(r.answers, {private:'x'});},
    r => {Object.defineProperty(r.answers.category, 'choice', {get(){throw Error('must not read');}, enumerable:true});},
    r => {r.answers.category.probabilities = JSON.parse('{"__proto__":0,"health":1}');},
  ];
  for (const mutate of mutations) {
    const r = response(); mutate(r);
    assert.equal(parseJevChoiceResponse(r).decision.reason, 'invalid_response');
  }
  for (const r of [null, [], '{}', Object.create(response())]) assert.equal(parseJevChoiceResponse(r).decision.reason, 'invalid_response');
});
test('usage bounds accept only finite nonnegative integers and preserve usage on invalid answer', () => {
  for (const [key,max] of [['input_tokens', JEV_MAX_INPUT_TOKENS], ['output_tokens', JEV_MAX_OUTPUT_TOKENS]]) {
    for (const value of [-1, 1.5, NaN, Infinity, max+1, '10']) {
      const r = response(); r.usage[key] = value;
      assert.deepEqual(parseJevChoiceResponse(r), {decision:{status:'review',reason:'invalid_response'}, usage:null});
    }
    for (const value of [0, max]) {
      const r = response(); r.usage[key] = value;
      assert.equal(parseJevChoiceResponse(r).decision.status, 'classified');
    }
  }
  const r = response(); r.answers.category.choice = 'bad';
  assert.deepEqual(parseJevChoiceResponse(r).usage, {inputTokens:1000,outputTokens:100});
});
test('uncertainty between current-app work and general AI stays pending', () => {
  const r = response('harulab');
  r.answers.category.probabilities = {'medical-tech':0.01,health:0.01,life:0.01,investment:0.01,'ai-tech':0.47,harulab:0.49};
  assert.equal(parseJevChoiceResponse(r).decision.reason, 'ambiguous');
});
test('scope, uncertain confidence and ambiguous primary purpose go to review', () => {
  const out = response(); out.answers.in_scope.noul = 0.1;
  assert.equal(parseJevChoiceResponse(out).decision.reason, 'out_of_scope');
  for (const mutate of [r=>{r.answers.in_scope.noul=0.6;}, r=>{r.answers.category.confidence=0.5;}]) {
    const r = response(); mutate(r);
    assert.equal(parseJevChoiceResponse(r).decision.reason, 'low_confidence');
  }
  const mixed = response(); mixed.answers.category.probabilities = {'medical-tech':0.01,health:0.48,life:0.48,investment:0.02,'ai-tech':0.01,harulab:0};
  assert.equal(parseJevChoiceResponse(mixed).decision.reason, 'ambiguous');
});
test('no injected transport means no call; errors never echo text or retry or log', async () => {
  assert.equal((await classifyApprovedText('secret')).decision.reason, 'missing_transport');
  let calls = 0;
  assert.equal((await classifyApprovedText('', async () => {calls++;})).decision.reason, 'invalid_input');
  assert.equal(calls, 0);
  const logs = [];
  const originals = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = (...args) => logs.push(args);
  try {
    const r = await classifyApprovedText('secret', async () => { calls++; throw new Error('secret'); });
    assert.deepEqual(r, {decision:{status:'review',reason:'transport_error'},usage:null});
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(r).includes('secret'), false);
    assert.deepEqual(logs, []);
  } finally { [console.log, console.warn, console.error] = originals; }
});
