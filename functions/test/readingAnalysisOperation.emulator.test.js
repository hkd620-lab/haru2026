const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const admin = require('firebase-admin');

const projectId = 'demo-haru-reading-retry';
if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Run against a local Firestore emulator.');
}
admin.initializeApp({ projectId });
const db = admin.firestore();
const { beginReadingAnalysis, completeReadingAnalysis, refundReadingAnalysis } =
  require('../lib/readingAnalysisOperation');
const PERIOD = '2026-11';
const NOW = Date.parse('2026-11-26T00:00:00Z');
const RESPONSE = { text: '합성 분석', aiComment: '', stats: null };
const prompt = '합성 독서장';

async function makeUser() {
  const uid = 'qa-' + randomUUID();
  await db.doc(`users/${uid}`).set({ displayName: '시험' });
  return uid;
}
async function usage(uid, period = PERIOD) {
  const doc = await db.doc(`users/${uid}/monthlyAiUsage/${period}`).get();
  return [doc.get('usedCount') ?? 0, doc.get('byFeature.polishContent') ?? 0];
}
const begin = (uid, id, text = prompt, now = NOW) => beginReadingAnalysis(db, uid, id, text, now);

test('concurrent duplicate is pending, and the successful result replays without another charge at the quota cap', async () => {
  const uid = await makeUser();
  const id = randomUUID();
  await db.doc(`users/${uid}/monthlyAiUsage/${PERIOD}`).set({ usedCount: 9, byFeature: { polishContent: 9 } });
  const [a, b] = await Promise.all([begin(uid, id), begin(uid, id)]);
  assert.deepEqual([a.status, b.status].sort(), ['claimed', 'processing']);
  assert.deepEqual(await usage(uid), [10, 10]);
  await completeReadingAnalysis((a.lease || b.lease), RESPONSE);
  assert.deepEqual(await begin(uid, id), { status: 'completed', result: RESPONSE });
  await assert.rejects(begin(uid, id, '다른 입력'), { code: 'invalid-argument' });
  await assert.rejects(begin(uid, randomUUID()), { code: 'resource-exhausted' });
  assert.deepEqual(await usage(uid), [10, 10]);

  const other = await makeUser();
  assert.equal((await begin(other, id)).status, 'claimed');
  assert.deepEqual(await usage(other), [1, 1]);
});

test('a failed attempt refunds once and can restart using the same request ID', async () => {
  const uid = await makeUser();
  const id = randomUUID();
  const first = await begin(uid, id);
  await Promise.all([refundReadingAnalysis(first.lease), refundReadingAnalysis(first.lease)]);
  assert.deepEqual(await usage(uid), [0, 0]);
  const retry = await begin(uid, id);
  assert.equal(retry.status, 'claimed');
  await completeReadingAnalysis(retry.lease, RESPONSE);
  await refundReadingAnalysis(retry.lease);
  assert.deepEqual(await usage(uid), [1, 1]);
});

test('a crashed worker can be replaced without another charge, including across a monthly reset', async () => {
  const uid = await makeUser();
  const id = randomUUID();
  const old = await begin(uid, id);
  assert.equal((await begin(uid, id, prompt, NOW + 60_000)).status, 'processing');
  const replacement = await begin(uid, id, prompt, NOW + 120_000);
  assert.equal(replacement.status, 'claimed');
  const nextMonth = Date.parse('2026-12-01T00:00:00Z');
  const current = await begin(uid, id, prompt, nextMonth);
  assert.equal(current.status, 'claimed');
  await assert.rejects(completeReadingAnalysis(old.lease, RESPONSE), { code: 'aborted' });
  await refundReadingAnalysis(old.lease);
  await refundReadingAnalysis(replacement.lease);
  await completeReadingAnalysis(current.lease, RESPONSE);
  assert.deepEqual(await usage(uid), [1, 1]);
  assert.deepEqual(await usage(uid, '2026-12'), [0, 0]);
});

test('an expired replay cannot charge again, and a later request prunes the old result text', async () => {
  const uid = await makeUser();
  const id = randomUUID();
  const op = await begin(uid, id);
  await completeReadingAnalysis(op.lease, RESPONSE);
  const later = Date.now() + 25 * 60 * 60_000;
  await assert.rejects(begin(uid, id, prompt, later), { code: 'failed-precondition' });
  await begin(uid, randomUUID(), prompt, later);
  const old = await op.lease.ref.get();
  assert.equal(old.get('state'), 'expired');
  assert.equal(old.get('result'), null);
  assert.equal(old.get('digest').length, 64);
});

test('account deletion and invalid identifiers cannot reserve usage', async () => {
  const uid = await makeUser();
  await assert.rejects(begin(uid, './other'), { code: 'invalid-argument' });
  await db.doc(`users/${uid}`).update({ accountStatus: 'pending_deletion' });
  await assert.rejects(begin(uid, randomUUID()), { code: 'failed-precondition' });
  assert.deepEqual(await usage(uid), [0, 0]);
});

test.after(() => admin.app().delete());
