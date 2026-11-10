const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const { TextEncoder } = require('node:util');
const { webcrypto } = require('node:crypto');

const popup = readFileSync(new URL('../popup.js', `file://${__filename}`), 'utf8');
const background = readFileSync(new URL('../background.js', `file://${__filename}`), 'utf8');
const categories = ['medical-tech', 'health', 'life', 'investment', 'ai-tech', 'harulab'];

function harness(selected, { storageFails = false, popupUi = false } = {}) {
  const stored = new Map(selected ? [['aiCollectorCategory', selected]] : []);
  const calls = [];
  const opened = [];
  const listeners = [];
  const domListeners = {};
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', disabled: false, textContent: '', listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; } });
    return elements.get(id);
  };
  const document = popupUi ? { addEventListener: (type, fn) => { domListeners[type] = fn; }, getElementById: element } : undefined;
  const local = {
    get: async (key) => {
      if (storageFails) throw new Error('storage not available');
      return { [key]: stored.get(key) };
    },
    set: async (entries) => Object.entries(entries).forEach(([key, value]) => stored.set(key, value)),
    remove: (key) => stored.delete(key),
  };
  const context = vm.createContext({ document, console, crypto: webcrypto, TextEncoder, URL, Blob,
    importScripts: () => {},
    fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, status: 200 }; },
    chrome: { storage: { local }, tabs: { create: async (tab) => opened.push(tab) },
      runtime: { id: 'fixture-extension', onMessage: { addListener: (fn) => listeners.push(fn) } } },
  });
  vm.runInContext(popup, context);
  vm.runInContext(background, context);
  return { context, stored, calls, opened, listeners, element, domListeners };
}

test('purpose and harulab categories travel to HARU and archive without changing body, source URL or hash', async () => {
  const ids = [];
  for (const category of categories) {
    const h = harness(category);
    await vm.runInContext(`saveToDestinations('synthetic body', 'chatgpt.com', '${category}', 'https://chatgpt.com/dots/fixture')`, h.context);
    const payload = [...h.stored.entries()].find(([key]) => key.startsWith('haruImport:'))[1];
    assert.equal(payload.category, category);
    assert.equal(payload.content, 'synthetic body');
    assert.equal(payload.source, 'chatgpt.com');
    assert.equal(payload.sourceUrl, 'https://chatgpt.com/dots/fixture');
    assert.equal(h.calls[0].body.fields.category.stringValue, category);
    assert.equal(h.opened.length, 1);
    ids.push(payload.importId);
  }
  assert.equal(new Set(ids).size, 1, 'changing category must not duplicate an existing record');
});

test('inline AI and Slack saves use popup folder and ignore page-supplied category', async () => {
  for (const [action, url] of [
    ['saveAiMessage', 'https://chatgpt.com/dots/fixture'],
    ['saveAiMessage', 'https://claude.ai/chat/fixture'],
    ['saveAiMessage', 'https://gemini.google.com/app/fixture'],
    ['saveSlackMessage', 'https://app.slack.com/client/fixture'],
  ]) {
    const h = harness('health');
    const result = await new Promise(resolve => h.listeners[0](
      { action, content: 'synthetic body', sourceUrl: url, category: 'investment' }, { url }, resolve));
    assert.equal(result.ok, true);
    assert.equal([...h.stored.entries()].find(([key]) => key.startsWith('haruImport:'))[1].category, 'health');
  }
});

test('unselected and legacy categories remain unclassified, with no Jev request', async () => {
  for (const category of [undefined, 'general', 'coding', '__proto__', 'arbitrary']) {
    const h = harness(category);
    await vm.runInContext(`saveWithSelectedCategory('synthetic body', 'chatgpt.com', 'https://chatgpt.com/c/fixture')`, h.context);
    const payload = [...h.stored.entries()].find(([key]) => key.startsWith('haruImport:'))[1];
    assert.equal(Object.hasOwn(payload, 'category'), false);
    assert.equal(h.calls.length, 1);
    assert.match(h.calls[0].url, /^https:\/\/firestore\.googleapis\.com\//);
  }
});

test('folder setting failure stops inline saving instead of silently choosing another folder', async () => {
  const h = harness('health', { storageFails: true });
  const result = await new Promise(resolve => h.listeners[0](
    { action: 'saveAiMessage', content: 'synthetic', sourceUrl: 'https://chatgpt.com/c/fixture' },
    { url: 'https://chatgpt.com/c/fixture' }, resolve));
  assert.equal(result.ok, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.opened.length, 0);
});

test('health-only check and invalid page origin never send contents', async () => {
  const h = harness('health');
  let health;
  h.listeners[0]({ action: 'collectorHealth' }, {}, result => { health = result; });
  assert.equal(health.build, '3.0-auto-folders-1');
  const bad = await new Promise(resolve => h.listeners[0](
    { action: 'saveAiMessage', content: 'synthetic', sourceUrl: 'https://attacker.test/fixture' },
    { url: 'https://chatgpt.com/c/fixture' }, resolve));
  assert.equal(bad.ok, false);
  assert.equal(h.calls.length, 0);
});

test('popup restores the last selected folder and persists manual changes', async () => {
  const h = harness('life', { popupUi: true });
  h.domListeners.DOMContentLoaded();
  assert.equal(h.element('extractBtn').disabled, true);
  await new Promise(setImmediate);
  assert.equal(h.element('categorySelect').value, 'life');
  assert.equal(h.element('extractBtn').disabled, false);
  h.element('categorySelect').value = 'medical-tech';
  h.element('categorySelect').listeners.change();
  assert.equal(h.element('extractBtn').disabled, true);
  await new Promise(setImmediate);
  assert.equal(h.stored.get('aiCollectorCategory'), 'medical-tech');
  assert.equal(h.element('extractBtn').disabled, false);
  assert.match(h.element('categoryStatus').textContent, /의료신기술/);
  assert.equal(h.calls.length, 0);
});

test('preview extension keeps original host/permissions and contains no AI provider access', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', `file://${__filename}`), 'utf8'));
  assert.equal(manifest.version, '3.0');
  assert.equal(manifest.host_permissions.some(host => /typesafe|openai|anthropic/.test(host)), false);
  for (const permission of ['cookies', 'webRequest', 'declarativeNetRequest']) assert.equal(manifest.permissions.includes(permission), false);
  const html = readFileSync(new URL('../popup.html', `file://${__filename}`), 'utf8');
  for (const category of categories) assert.ok(html.includes(`value="${category}"`));
  const content = readFileSync(new URL('../content.js', `file://${__filename}`), 'utf8');
  assert.match(content, /3\.0-auto-folders-1/);
  assert.match(content, /sourceUrl: window\.location\.href/);
});
