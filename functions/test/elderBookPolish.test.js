const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Execute the compiled callable with local SDK doubles: no API, credentials or Firestore access.
function harness(chapters = []) {
  const requests = [];
  const writes = [];
  const timestamp = 'test-server-timestamp';
  const ref = (segments = []) => ({
    collection: (name) => ref([...segments, name]),
    doc: (id) => ref([...segments, id]),
    get: async () => ({ docs: chapters.map((data, i) => ({ id: `chapter-${i}`, data: () => data })) }),
    set: async (data, options) => writes.push({ path: segments.join('/'), data, options }),
  });
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  class OpenAI {
    chat = { completions: { create: async (body) => {
      requests.push(body);
      return { choices: [{ message: { content: '  다듬은 본문  ' } }] };
    } } };
  }
  const firestore = () => ref();
  firestore.FieldValue = { serverTimestamp: () => timestamp };
  const modules = {
    'firebase-functions/v2/https': { onCall: (options, run) => ({ options, run }), HttpsError },
    'firebase-functions/params': { defineSecret: () => ({ value: () => 'test-only' }) },
    'firebase-admin': { firestore },
    'firebase-functions/logger': { info() {} },
    openai: OpenAI,
    './internalEntitlements': { isInternalDeveloperUid: (uid) => uid === 'test-developer' },
  };
  const context = { exports: {}, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/elderBook.js'), 'utf8'), context);
  return { callable: context.exports.polishElderBookChapters, requests, writes, timestamp };
}

test('polish rejects unauthorized callers before AI or storage writes', async () => {
  const h = harness([{ draft: '초고' }]);
  await assert.rejects(h.callable.run({ auth: { uid: 'other' } }), { code: 'permission-denied' });
  await assert.rejects(h.callable.run({}), { code: 'permission-denied' });
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.length, 0);
});

test('polish rejects missing or blank drafts without AI calls or writes', async () => {
  const h = harness([{ draft: '  ' }, {}]);
  await assert.rejects(h.callable.run({ auth: { uid: 'test-developer' } }), { code: 'failed-precondition' });
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.length, 0);
});

test('polish sends Sol low with the existing limit and preserves chapter storage behavior', async () => {
  const h = harness([{ title: '첫 장', order: 1, draft: '화를 낸 것은 아니다.' }, { draft: ' ' }]);
  const result = await h.callable.run({ auth: { uid: 'test-developer' } });
  assert.equal(h.callable.options.region, 'asia-northeast3');
  assert.equal(h.requests.length, 1);
  const body = h.requests[0];
  assert.equal(body.model, 'gpt-6.1-sol');
  assert.equal(body.reasoning_effort, 'low');
  assert.equal(body.max_completion_tokens, 6000);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].role, 'user');
  assert.ok(body.messages[0].content.endsWith('[초고]\n화를 낸 것은 아니다.'));
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[0].path, 'books/book_haru2026_ai_platform/chapters/chapter-0');
  assert.equal(h.writes[0].data.polished, '다듬은 본문');
  assert.equal(h.writes[0].data.status, 'polished');
  assert.equal(h.writes[0].data.polishedWordCount, '다듬은 본문'.length);
  assert.equal(h.writes[0].options.merge, true);
  assert.equal(h.writes[1].path, 'books/book_haru2026_ai_platform');
  assert.equal(h.writes[1].data.stage, 'polished');
  assert.equal(h.writes[1].options.merge, true);
  assert.equal(result.ok, true);
  assert.equal(result.polished[0].chapterId, 'chapter-0');
});
