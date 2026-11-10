const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function loadSource(name) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, `../src/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  vm.runInThisContext(`(function(require,exports){${code}\n})`)(id => {
    if (['./aiLibraryJevChoice', './aiLibraryCategory'].includes(id)) return loadSource(id.slice(2));
    throw new Error(`Unexpected dependency: ${id}`);
  }, exports);
  return exports;
}
const { createJevChoiceHttpTransport: create, JEV_SYSTEM_ONE_URL, JEV_MAX_RESPONSE_BYTES } = loadSource('aiLibraryJevTransport');
const { buildJevChoiceRequest, classifyApprovedText } = loadSource('aiLibraryJevChoice');
const request = () => buildJevChoiceRequest('synthetic public AI technology article');
const syntheticKey = 'synthetic-test-token-not-a-credential';
const json = (body = '{}', options = {}) => new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8' }, ...options });
function fixture(extra = {}) {
  const calls = [];
  let reads = 0;
  const transport = create({
    fetchImpl: async (...args) => { calls.push(args); return json(); },
    getApiKey: () => { reads++; return syntheticKey; }, isRuntimePermitted: () => true, ...extra,
  });
  return { transport, calls, reads: () => reads };
}
async function fails(promise) {
  await assert.rejects(promise, error => {
    assert.equal(error.message, 'Jev transport unavailable');
    assert.equal(error.cause, undefined);
    assert.ok(!String(error).includes(syntheticKey));
    return true;
  });
}
test('lazy construction; exact pinned HTTPS endpoint/body/auth, no overrides or retries', async () => {
  const f = fixture({ endpoint: 'http://attacker.invalid', headers: { evil: 'header' } });
  assert.equal(f.reads(), 0); assert.equal(f.calls.length, 0);
  assert.deepEqual(await f.transport(request()), {});
  assert.equal(f.reads(), 1); assert.equal(f.calls.length, 1);
  const [url, init] = f.calls[0];
  assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(url, JEV_SYSTEM_ONE_URL); assert.equal(init.method, 'POST');
  assert.deepEqual(init.headers, { Authorization: `Bearer ${syntheticKey}`, 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(init.body), request());
  assert.equal(JSON.parse(init.body).model, 'jev-1.14.0');
  assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal);
});
test('required injection and bounded timeout, never default global fetch or credentials', () => {
  for (const config of [{}, { fetchImpl: async () => json() },
    { fetchImpl: async () => json(), getApiKey: () => syntheticKey },
    ...[0, -1, NaN, Infinity, 30001, 1.1].map(timeoutMs => ({ fetchImpl: async () => json(), getApiKey: () => syntheticKey, isRuntimePermitted: () => true, timeoutMs }))]) {
    assert.throws(() => create(config), /Jev transport unavailable/);
  }
});
test('runtime permit must be literal true before credential access', async () => {
  for (const permit of [false, undefined, 1, 'true']) {
    const f = fixture({ isRuntimePermitted: () => permit });
    await fails(f.transport(request())); assert.equal(f.reads(), 0); assert.equal(f.calls.length, 0);
  }
});
test('permit rechecked after async credential read, and invalid request never reads key', async () => {
  let allowed = true;
  const f = fixture({ isRuntimePermitted: () => allowed, getApiKey: async () => { allowed = false; return syntheticKey; } });
  await fails(f.transport(request())); assert.equal(f.calls.length, 0);
  for (const mutate of [r => r.model = 'jev-latest', r => r.metadata = { uid: 'private' }, r => r.questions.category.instructions = 'changed',
    r => Object.defineProperty(r, 'state', { get() { throw new Error(syntheticKey); } }), r => r.questions.in_scope.extra = 'private', r => r.toJSON = () => ({ private: true })]) {
    const r = request(); mutate(r); const f = fixture();
    await fails(f.transport(r)); assert.equal(f.reads(), 0); assert.equal(f.calls.length, 0);
  }
});
test('provider JSON returned untouched for strict adapter validation', async () => {
  const body = { model: 'jev-1.14.0', answers: {}, usage: { input_tokens: 12, output_tokens: 1 } };
  const f = fixture({ fetchImpl: async () => json(JSON.stringify(body)) });
  assert.deepEqual(await f.transport(request()), body);
  const result = await classifyApprovedText('synthetic article', f.transport);
  assert.equal(result.decision.reason, 'invalid_response');
});
test('HTTP errors, redirects, wrong destination, MIME, malformed JSON/UTF8 are sanitized without retry', async () => {
  const responses = [() => json(syntheticKey, { status: 401 }), () => json(syntheticKey, { status: 429 }),
    () => json(syntheticKey, { status: 500 }), () => json(syntheticKey, { status: 302 }),
    () => { const r = json(); Object.defineProperty(r, 'redirected', { value: true }); return r; },
    () => { const r = json(); Object.defineProperty(r, 'url', { value: 'http://attacker.invalid' }); return r; },
    () => json('{}', { headers: { 'content-type': 'text/html' } }), () => json(syntheticKey),
    () => json(new Uint8Array([0xff]))];
  for (const response of responses) {
    let calls = 0;
    const f = fixture({ fetchImpl: async () => { calls++; return response(); } });
    await fails(f.transport(request())); assert.equal(calls, 1);
  }
});
test('network/key/permission errors cannot leak causes, messages, input or credentials', async () => {
  for (const extra of [ { fetchImpl: async () => { throw new Error(syntheticKey); } },
    { getApiKey: () => { throw new Error(syntheticKey); } },
    { isRuntimePermitted: () => { throw new Error(syntheticKey); } },
    ...['', 'bad\nheader', 'bad key', 'x'.repeat(4097)].map(key => ({ getApiKey: () => key }))]) {
    await fails(fixture(extra).transport(request()));
  }
});
test('response limit applies to announced bytes and actual streamed bytes, cancels oversized stream', async () => {
  await fails(fixture({ fetchImpl: async () => json('{}', { headers: { 'content-type': 'application/json', 'content-length': String(JEV_MAX_RESPONSE_BYTES + 1) } }) }).transport(request()));
  let canceled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(32769)); }, cancel() { canceled = true; } });
  await fails(fixture({ fetchImpl: async () => json(stream) }).transport(request()));
  assert.equal(canceled, true);
  const exact = JSON.stringify('x'.repeat(JEV_MAX_RESPONSE_BYTES - 2));
  assert.equal((await fixture({ fetchImpl: async () => json(exact) }).transport(request())).length, JEV_MAX_RESPONSE_BYTES - 2);
  await fails(fixture({ fetchImpl: async () => json(JSON.stringify('가'.repeat(24000))) }).transport(request()));
});
test('timeout aborts hanging fetch once, no retry even if injected fetch ignores signal', async () => {
  let calls = 0, signal;
  await fails(fixture({ timeoutMs: 10, fetchImpl: async (_, init) => { calls++; signal = init.signal; return new Promise(() => {}); } }).transport(request()));
  assert.equal(calls, 1); assert.equal(signal.aborted, true);
});
test('timeout covers credentials and cannot fetch after late credential resolution', async () => {
  let resolve;
  const f = fixture({ timeoutMs: 10, getApiKey: () => new Promise(r => { resolve = r; }) });
  await fails(f.transport(request())); resolve(syntheticKey);
  await new Promise(r => setImmediate(r)); assert.equal(f.calls.length, 0);
});
test('timeout includes stalled response body and cancels reader', async () => {
  let canceled = false;
  const stream = new ReadableStream({ cancel() { canceled = true; } });
  await fails(fixture({ timeoutMs: 10, fetchImpl: async () => json(stream) }).transport(request()));
  assert.equal(canceled, true);
});
test('pre-abort prevents key/fetch; in-flight external abort propagates without private reason', async () => {
  const before = new AbortController(); before.abort(syntheticKey);
  const f = fixture({ signal: before.signal });
  await fails(f.transport(request())); assert.equal(f.reads(), 0); assert.equal(f.calls.length, 0);
  const during = new AbortController(); let sentSignal;
  const g = fixture({ signal: during.signal, fetchImpl: async (_, init) => {
    sentSignal = init.signal; during.abort(syntheticKey); return new Promise(() => {});
  } });
  await fails(g.transport(request())); assert.equal(sentSignal.aborted, true);
  assert.notEqual(sentSignal.reason, syntheticKey);
});
test('valid structured Choice/Noul response reaches existing adapter unchanged', async () => {
  const body = { model: 'jev-1.14.0', answers: {
    category: { type: 'choice', choice: 'ai-tech', confidence: 0.97,
      probabilities: { 'medical-tech': 0.01, health: 0.01, life: 0.01, investment: 0.01, 'ai-tech': 0.95, harulab: 0.01 } },
    in_scope: { type: 'noul', noul: 0.99 },
  }, usage: { input_tokens: 120, output_tokens: 12 } };
  const f = fixture({ fetchImpl: async () => json(JSON.stringify(body)) });
  assert.deepEqual(await classifyApprovedText('synthetic AI article', f.transport), {
    decision: { status: 'classified', category: 'ai-tech', confidence: 0.97 },
    usage: { inputTokens: 120, outputTokens: 12 },
  });
});
test('asynchronous runtime gate is awaited before key read and again before fetch', async () => {
  const events = [];
  const f = fixture({ isRuntimePermitted: async () => { events.push('permit'); return true; },
    getApiKey: async () => { events.push('key'); return syntheticKey; },
    fetchImpl: async () => { events.push('fetch'); return json(); } });
  await f.transport(request());
  assert.deepEqual(events, ['permit', 'key', 'permit', 'fetch']);
  const denied = fixture({ isRuntimePermitted: async () => false });
  await fails(denied.transport(request())); assert.equal(denied.reads(), 0); assert.equal(denied.calls.length, 0);
});
