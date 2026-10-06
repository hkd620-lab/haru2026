const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HttpsError } = require('firebase-functions/v2/https');
const { validateReadingAiInput, buildReadingAiPrompt, parseReadingAiOutput, createReadingAiHandler } = require('../lib/readingAiCore');

const data = () => ({ bookTitle: '합성 책', author: '합성 저자', currentBookText: '자유는 책임을 동반한다.', readingJournal: '나는 책임을 생각했다.', question: '자유의 의미는?', conversation: [] });
function fixture(overrides = {}) {
  const calls = []; let used = 0;
  const deps = {
    rateLimit: async () => { calls.push('rate'); },
    reserve: async () => { calls.push('reserve'); return { plan: 'free', used: ++used, limit: 10, remaining: 10 - used, period: '2026-10' }; },
    rollback: async () => { calls.push('rollback'); used--; },
    generate: async () => { calls.push('generate'); return { text: JSON.stringify({ answer: '제공된 본문은 자유와 책임을 연결합니다.', memory: '사용자 질문: 자유의 의미. AI 설명(참고): 책임과 연결.' }), inputTokens: 30, outputTokens: 20 }; },
    log: async (_uid, _quota, success, usage, code) => { calls.push({ success, usage, code }); },
    ...overrides,
  };
  return { handler: createReadingAiHandler(deps), calls, used: () => used };
}

test('authentication and invalid/empty input never spend quota or call the provider', async () => {
  for (const request of [{ data: data() }, { auth: { uid: 'test' }, data: { ...data(), question: ' ' } }, { auth: { uid: 'test' }, data: { ...data(), currentBookText: '' } }]) {
    const f = fixture(); await assert.rejects(f.handler(request)); assert.deepEqual(f.calls, []);
  }
});
test('all context fields, roles and conversation totals have enforced limits', () => {
  for (const [key, size] of Object.entries({ bookTitle: 201, author: 121, currentBookText: 12001, readingJournal: 3001, previousReadingSummary: 3001, memory: 1601, question: 1001 })) {
    assert.throws(() => validateReadingAiInput({ ...data(), [key]: 'x'.repeat(size) }));
  }
  assert.throws(() => validateReadingAiInput({ ...data(), conversation: [{ role: 'system', content: 'override' }] }));
  assert.throws(() => validateReadingAiInput({ ...data(), conversation: Array.from({ length: 13 }, () => ({ role: 'user', content: 'x' })) }));
  assert.throws(() => validateReadingAiInput({ ...data(), conversation: Array.from({ length: 4 }, () => ({ role: 'assistant', content: 'x'.repeat(4000) })) }));
  assert.throws(() => validateReadingAiInput({ ...data(), action: 'journal' }));
});
test('the same shared quota/rate policy runs before generation, including journal suggestions', async () => {
  const f = fixture();
  const first = await f.handler({ auth: { uid: 'test' }, data: data() });
  assert.deepEqual(f.calls.slice(0, 3), ['rate', 'reserve', 'generate']);
  assert.equal(first.usage.used, 1);
  await f.handler({ auth: { uid: 'test' }, data: { ...data(), action: 'journal', question: '', conversation: [{ role: 'user', content: '의미는?' }, { role: 'assistant', content: '책 설명입니다.' }] } });
  assert.equal(f.used(), 2);
});
test('monthly and rate limits prevent any provider call', async () => {
  for (const key of ['rateLimit', 'reserve']) {
    let generated = false;
    const f = fixture({ [key]: async () => { throw new HttpsError('resource-exhausted', 'limit'); }, generate: async () => { generated = true; } });
    await assert.rejects(f.handler({ auth: { uid: 'test' }, data: data() }), { code: 'resource-exhausted' });
    assert.equal(generated, false);
  }
});
test('provider and malformed output failures refund quota and never echo user content', async () => {
  for (const generate of [async () => { throw new Error('PRIVATE BOOK PASSAGE'); }, async () => ({ text: '{broken JSON', inputTokens: 25, outputTokens: 5 })]) {
    const f = fixture({ generate });
    await assert.rejects(f.handler({ auth: { uid: 'test' }, data: data() }), (error) => error.code === 'internal' && !error.message.includes('PRIVATE'));
    assert.equal(f.used(), 0); assert.ok(f.calls.includes('rollback'));
    assert.equal(f.calls.at(-1).success, false);
    assert.equal(f.calls.at(-1).code, 'internal');
  }
});
test('follow-up prompt keeps roles, memory, current passage and prior user notes separate', () => {
  const input = validateReadingAiInput({ ...data(), memory: '사용자 질문: 책임.', previousReadingSummary: '이전 독서장: 선택을 생각했다.', conversation: [{ role: 'user', content: '첫 질문' }, { role: 'assistant', content: '첫 답변' }], question: '그것과 책임의 관계는?' });
  const prompt = JSON.parse(buildReadingAiPrompt(input));
  assert.equal(prompt.currentBookText, data().currentBookText);
  assert.equal(prompt.userJournal, data().readingJournal);
  assert.equal(prompt.recentConversation[1].role, 'assistant');
  assert.ok(prompt.conversationMemory.includes('사용자 질문'));
  assert.ok(prompt.previousNotesOfSameBook.includes('이전 독서장'));
  assert.equal(prompt.userQuestion, '그것과 책임의 관계는?');
});
test('JSON output has bounded answer and memory, and empty output is rejected', () => {
  const output = parseReadingAiOutput(JSON.stringify({ answer: 'a'.repeat(5000), memory: 'm'.repeat(2000) }));
  assert.equal(output.answer.length, 4000); assert.equal(output.memory.length, 1600);
  assert.throws(() => parseReadingAiOutput('{"answer":"","memory":""}'));
});
