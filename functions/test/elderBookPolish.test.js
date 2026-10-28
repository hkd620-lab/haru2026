const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Execute the compiled callable with local SDK doubles: no API, credentials or Firestore access.
function harness(chapters = [], respond = () => ({ content: '  다듬은 본문  ', finish_reason: 'stop' })) {
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
      const reply = respond(body, requests.length - 1);
      return { choices: [{ message: { content: reply.content }, finish_reason: reply.finish_reason }] };
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

const run = (h) => h.callable.run({ auth: { uid: 'test-developer' } });
const reply = (content) => ({ content, finish_reason: 'stop' });

test('polish preserves supported quote styles, nested quotes, repeats, spaces and newlines exactly', async () => {
  const quotes = ['“가상 문장?”', '"두  칸\n다음 줄"', "‘작은 인용’", "'직접 인용'", '「바깥 『안쪽』」', '“그는 ‘I don’t know’라고 했다.”', '“가상 문장?”'];
  const draft = `초고. ${quotes.join(' 사이. ')} 끝.`;
  const output = `다듬은 글. ${quotes.join(' 연결을 고쳤다. ')} 마침.`;
  const h = harness([{ draft }], () => reply(output));
  await run(h);
  assert.equal(h.writes[0].data.polished, output);
  assert.equal(h.writes[0].data.polishedWordCount, output.length);
  assert.ok(h.requests[0].messages[0].content.includes('띄어쓰기·줄바꿈까지 원문 그대로 유지'));
});

for (const [name, draft, output] of [
  ['wording', '그는 “가볼까?”라고 했다.', '그는 “가보자.”라고 했다.'],
  ['spacing', '“두  칸”', '“두 칸”'],
  ['punctuation', '“정말?”', '“정말!”'],
  ['newline', '“첫 줄\n다음 줄”', '“첫 줄 다음 줄”'],
  ['delimiters', '“그대로”', '"그대로"'],
  ['deletion', '“첫째” 그리고 “둘째”', '“첫째”만 있다.'],
  ['addition', '따옴표 없는 초고', '“새 인용”을 더했다.'],
  ['duplicate', '“하나”', '“하나” “하나”'],
  ['reorder', '“하나” “둘”', '“둘” “하나”'],
  ['nested change', '“그는 ‘안쪽’이라고 했다.”', '“그는 ‘변경’이라고 했다.”'],
  ['unclosed result', '“닫힘”', '“닫히지 않음'],
]) {
  test(`polish refuses ${name} without any writes, including earlier chapters`, async () => {
    const h = harness([{ draft: '앞 장 초고', order: 1 }, { draft, order: 2 }], (_, i) => reply(i ? output : '앞 장 윤문'));
    await assert.rejects(run(h), { code: 'failed-precondition' });
    assert.equal(h.requests.length, 2);
    assert.equal(h.writes.length, 0);
  });
}

test('unbalanced draft quotes fail before AI calls and leave all existing results intact', async () => {
  for (const draft of ['“열림', '잘못된 닫힘”', '「겹친 『인용」』']) {
    const h = harness([{ draft: '앞 장', order: 1 }, { draft, order: 2 }]);
    await assert.rejects(run(h), { code: 'failed-precondition' });
    assert.equal(h.requests.length, 0);
    assert.equal(h.writes.length, 0);
  }
});

test('ordinary English apostrophes are allowed outside and inside quotations', async () => {
  const draft = `I don't know. It’s fine. “Don't change this.”`;
  const h = harness([{ draft }], () => reply(`I don't know yet. It’s fine. “Don't change this.”`));
  await run(h);
  assert.equal(h.writes.length, 2);
});

test('empty or truncated output never overwrites a saved chapter or book stage', async () => {
  for (const response of [reply('  '), { content: '본문 일부', finish_reason: 'length' }, { content: '본문', finish_reason: 'content_filter' }]) {
    const h = harness([{ draft: '따옴표 없는 초고' }], () => response);
    await assert.rejects(run(h), { code: 'failed-precondition' });
    assert.equal(h.writes.length, 0);
  }
});

test('AI failure in a later chapter leaves the entire batch unsaved', async () => {
  const h = harness([{ draft: '첫 장', order: 1 }, { draft: '둘째 장', order: 2 }], (_, i) => {
    if (i) throw new Error('simulated API failure');
    return reply('첫 장 윤문');
  });
  await assert.rejects(run(h), /simulated API failure/);
  assert.equal(h.writes.length, 0);
});


test('successful multi-chapter polish keeps ordering and changes only the existing result fields', async () => {
  const h = harness([{ draft: '“둘”', order: 2 }, { draft: '“하나”', order: 1 }], (body) => {
    return reply(body.messages[0].content.split('[초고]\n')[1]);
  });
  const result = await run(h);
  assert.equal(h.writes.length, 3);
  assert.equal(h.writes[0].path, 'books/book_haru2026_ai_platform/chapters/chapter-1');
  assert.equal(h.writes[1].path, 'books/book_haru2026_ai_platform/chapters/chapter-0');
  for (const write of h.writes.slice(0, 2)) {
    assert.deepEqual(Object.keys(write.data).sort(), ['polished', 'polishedWordCount', 'status', 'updatedAt']);
    assert.equal(write.options.merge, true);
  }
  assert.equal(result.polished.length, 2);
});
