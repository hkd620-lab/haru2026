const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');
const { webcrypto } = require('node:crypto');

const source = readFileSync(new URL('../popup.js', `file://${__filename}`), 'utf8');

function createHarness(statuses = [200]) {
  const stored = new Map();
  const opened = [];
  let fetchIndex = 0;
  const context = vm.createContext({
    console,
    crypto: webcrypto,
    TextEncoder,
    URL,
    Blob,
    document: undefined,
    fetch: async () => ({ ok: statuses[fetchIndex] < 300, status: statuses[fetchIndex++] }),
    chrome: {
      storage: { local: { set: async (entries) => Object.entries(entries).forEach(([key, value]) => stored.set(key, value)) } },
      tabs: { create: async (options) => opened.push(options) },
    },
  });
  vm.runInContext(source, context);
  return { context, stored, opened };
}

async function save(harness, sourceName = 'slack') {
  harness.context.__result = await vm.runInContext(
    `saveToDestinations('같은 기록 본문', '${sourceName}', 'general', 'https://example.test/thread')`,
    harness.context,
  );
  return harness.context.__result;
}

test('Slack 저장은 HARU 성공으로 조기 표시하지 않고 확인 탭을 연다', async () => {
  const harness = createHarness([200]);
  const result = await save(harness);
  assert.equal(result.fire, true);
  assert.equal(result.haru, false);
  assert.equal(result.haruQueued, true);
  assert.equal(harness.opened.length, 1);
  assert.match(harness.opened[0].url, /^https:\/\/haru2026\.com\/ai-import#[a-f0-9]{64}$/);
});

test('AI 보관함 실패와 HARU 전달 성공을 분리 보고한다', async () => {
  const harness = createHarness([403]);
  const result = await save(harness);
  assert.equal(result.fire, false);
  assert.equal(result.haru, false);
  assert.equal(result.haruQueued, true);
  assert.equal(result.fireError, 'AI 보관함 HTTP 403');
});

test('중복 클릭은 동일 멱등키를 사용하고 AI 보관함 409를 성공으로 처리한다', async () => {
  const harness = createHarness([200, 409]);
  await save(harness);
  await save(harness);
  assert.equal(harness.stored.size, 1);
  assert.equal(harness.context.__result.fire, true);
  assert.equal(harness.opened[0].url, harness.opened[1].url);
});

for (const sourceName of ['chatgpt.com', 'claude.ai', 'gemini.google.com']) {
  test(`${sourceName} 기존 출처가 HARU 전달 payload에 보존된다`, async () => {
    const harness = createHarness([200]);
    await save(harness, sourceName);
    assert.equal([...harness.stored.values()][0].source, sourceName);
  });
}
