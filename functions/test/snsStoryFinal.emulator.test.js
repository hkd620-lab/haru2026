const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const admin = require('firebase-admin');

if (!process.env.FIRESTORE_EMULATOR_HOST || !/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  throw new Error('Only a loopback Firestore emulator is allowed. Never run against production.');
}
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-haru-sns-story';

const {
  SNS_STORY_LEASE_MS,
  SNS_STORY_OPERATION_RECOVERY_MS,
  buildSnsStoryFinalPayloadHash,
  buildSnsStoryFingerprint,
  commitCompletedSnsStoryRecord,
  generateSnsStoryFinal,
  recoverSnsStoryOperationByPayloadHash,
  setSnsStoryGeminiFactoryForTest,
  toKstDateString,
} = require('../lib/snsStory');
const { getKstMonthKey } = require('../lib/utils/monthlyAiQuota');

const db = admin.firestore();

afterEach(() => {
  setSnsStoryGeminiFactoryForTest(null);
});

function sourceRecord(id, overrides = {}) {
  const timestampMs = overrides.timestampMs || 1704063600000;
  return {
    id,
    source: overrides.source || 'facebook',
    timestampMs,
    date: toKstDateString(timestampMs),
    text: overrides.text ?? '오늘은 SNS에 남겨 둔 중요한 기록을 다시 읽었다.',
    thumbnails: overrides.thumbnails || [],
    isDeleted: overrides.isDeleted === true,
  };
}

async function seedSource(uid, record) {
  await db.doc(`users/${uid}/snsRecords/${record.id}`).set({
    source: record.source,
    timestamp: admin.firestore.Timestamp.fromMillis(record.timestampMs),
    text: record.text,
    thumbnails: record.thumbnails,
    isDeleted: record.isDeleted,
  });
}

function finalInput(uid, record, suffix = 'normal') {
  const sourceFingerprint = buildSnsStoryFingerprint([record]);
  const requestTimestamp = 1704063600000 + Math.floor(Math.random() * 100000);
  const date = toKstDateString(requestTimestamp);
  const recordId = `${date}_snsStory_${requestTimestamp}_${suffix}`;
  const range = { type: 'all' };
  const title = '나의 SNS 이야기';
  const confirmedSynopsis = 'SNS 원문을 바탕으로 확정한 시놉시스입니다. 중요한 흐름과 반복된 주제를 정리했고, 사용자가 확인한 사실만 남겼습니다.';
  const requestPayloadHash = buildSnsStoryFinalPayloadHash({
    range,
    excludedRecordIds: [],
    sourceFingerprint,
    title,
    confirmedSynopsis,
  });
  return {
    uid,
    recordId,
    leaseOwner: `lease-${suffix}`,
    date,
    title,
    content: '완성된 SNS 이야기입니다. '.repeat(40),
    range,
    counts: { total: 1, included: 1, excluded: 0, textOnly: 1, photoOnly: 0, textAndPhoto: 0 },
    sourceRecordIds: [record.id],
    expectedFingerprint: sourceFingerprint,
    confirmedSynopsis,
    requestTimestamp,
    requestPayloadHash,
  };
}

async function seedLease(input) {
  await db.doc(`users/${input.uid}/records/${input.recordId}`).set({
    source: 'sns_story',
    generationStatus: 'generating',
    leaseOwner: input.leaseOwner,
    leaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + SNS_STORY_LEASE_MS),
    requestTimestamp: input.requestTimestamp,
    requestPayloadHash: input.requestPayloadHash,
    sourceFingerprint: input.expectedFingerprint,
  });
}

function longGeneratedStory(label = '완성된 SNS 이야기') {
  return `${label}입니다. 사용자가 확정한 시놉시스 안의 사실만 바탕으로 차분하게 이어 쓴 문장입니다. `.repeat(35);
}

function createFakeGeminiFactory({ text = longGeneratedStory(), delayMs = 0 } = {}) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    factory: {
      getGenerativeModel() {
        return {
          async generateContent() {
            calls += 1;
            if (delayMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
            return { response: { text: () => text } };
          },
        };
      },
    },
  };
}

function finalCallableData(input, requestTimestamp, overrides = {}) {
  return {
    rangeType: 'all',
    excludedRecordIds: [],
    sourceRecordIds: input.sourceRecordIds,
    sourceFingerprint: input.expectedFingerprint,
    title: input.title,
    confirmedSynopsis: input.confirmedSynopsis,
    requestTimestamp,
    ...overrides,
  };
}

async function runFinalCallable(uid, data) {
  return generateSnsStoryFinal.run({ auth: { uid }, data });
}

async function completedSnsStories(uid) {
  const snapshot = await db.collection(`users/${uid}/records`).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((doc) => doc.source === 'sns_story' && doc.generationStatus === 'completed');
}

async function monthlyAiUsedCount(uid) {
  const period = getKstMonthKey();
  const snap = await db.doc(`users/${uid}/monthlyAiUsage/${period}`).get();
  return Number(snap.data()?.usedCount || 0);
}

test('final save rejects a selected source deleted before the completion transaction', async () => {
  const uid = `sns-story-delete-${Date.now()}`;
  const record = sourceRecord('selected-delete');
  await seedSource(uid, record);
  const input = finalInput(uid, record, 'delete');
  await seedLease(input);
  await db.doc(`users/${uid}/snsRecords/${record.id}`).set({ isDeleted: true }, { merge: true });

  await assert.rejects(
    commitCompletedSnsStoryRecord(input),
    (error) => error.details?.reason === 'SNS_STORY_SOURCE_CHANGED',
  );
  const saved = await db.doc(`users/${uid}/records/${input.recordId}`).get();
  assert.notEqual(saved.data()?.generationStatus, 'completed');
});

test('final save completes for unchanged sources and ignores new SNS records after synopsis', async () => {
  const uid = `sns-story-save-${Date.now()}`;
  const record = sourceRecord('selected-normal');
  await seedSource(uid, record);
  const input = finalInput(uid, record, 'save');
  await seedLease(input);
  await seedSource(uid, sourceRecord('new-after-synopsis', { text: '시놉시스 이후 새로 들어온 기록' }));

  await commitCompletedSnsStoryRecord(input);
  const saved = await db.doc(`users/${uid}/records/${input.recordId}`).get();
  assert.equal(saved.data()?.generationStatus, 'completed');
  assert.deepEqual(saved.data()?.sourceRecordIds, [record.id]);
  assert.equal(saved.data()?.requestPayloadHash, input.requestPayloadHash);
  assert.equal(saved.data()?.sourceAgent, 'SNS 갈무리');
  assert.equal(saved.data()?.sourceType, 'assistant');
  assert.equal(saved.data()?.sourceKey, 'sns_story');
});

for (const [name, patch] of [
  ['text', { text: '생성 중 수정된 본문' }],
  ['timestamp', { timestamp: admin.firestore.Timestamp.fromMillis(1704150000000) }],
  ['thumbnail', { thumbnails: ['users/alice/snsThumbnails/changed.jpg'] }],
]) {
  test(`final save rejects selected source ${name} changes by fingerprint`, async () => {
    const uid = `sns-story-${name}-${Date.now()}`;
    const record = sourceRecord(`selected-${name}`, { thumbnails: ['users/alice/snsThumbnails/original.jpg'] });
    await seedSource(uid, record);
    const input = finalInput(uid, record, name);
    await seedLease(input);
    await db.doc(`users/${uid}/snsRecords/${record.id}`).set(patch, { merge: true });

    await assert.rejects(
      commitCompletedSnsStoryRecord(input),
      (error) => error.details?.reason === 'SNS_STORY_SOURCE_CHANGED',
    );
    const saved = await db.doc(`users/${uid}/records/${input.recordId}`).get();
    assert.notEqual(saved.data()?.generationStatus, 'completed');
  });
}

test('same idempotency request can be committed twice but creates one completed record', async () => {
  const uid = `sns-story-idempotent-${Date.now()}`;
  const record = sourceRecord('selected-idempotent');
  await seedSource(uid, record);
  const input = finalInput(uid, record, 'idempotent');
  await seedLease(input);

  await commitCompletedSnsStoryRecord(input);
  await commitCompletedSnsStoryRecord(input);
  const snapshot = await db.collection(`users/${uid}/records`).get();
  assert.equal(snapshot.size, 1);
  assert.equal(snapshot.docs[0].data().generationStatus, 'completed');
});

test('same payload hash with a completed record is recovered despite a different client timestamp', async () => {
  const uid = `sns-story-recover-completed-${Date.now()}`;
  const record = sourceRecord('selected-recover-completed');
  const input = finalInput(uid, record, 'recover-completed');
  await db.doc(`users/${uid}/records/${input.recordId}`).set({
    source: 'sns_story',
    generationStatus: 'completed',
    requestTimestamp: input.requestTimestamp,
    requestPayloadHash: input.requestPayloadHash,
    essay_title: input.title,
    content: input.content,
  });

  const recovered = await recoverSnsStoryOperationByPayloadHash(
    uid,
    input.requestPayloadHash,
    input.requestTimestamp + 10_000,
  );
  assert.equal(recovered?.action, 'completed');
  assert.equal(recovered?.recordId, input.recordId);

  const snapshot = await db.collection(`users/${uid}/records`).get();
  assert.equal(snapshot.size, 1, 'completed recovery must avoid creating a second record');
});

test('same payload hash with an active generating lease is recovered as in progress', async () => {
  const uid = `sns-story-recover-generating-${Date.now()}`;
  const record = sourceRecord('selected-recover-generating');
  const input = finalInput(uid, record, 'recover-generating');
  const nowMs = Date.now();
  await db.doc(`users/${uid}/records/${input.recordId}`).set({
    source: 'sns_story',
    generationStatus: 'generating',
    requestTimestamp: nowMs - 1_000,
    requestPayloadHash: input.requestPayloadHash,
    leaseExpiresAt: admin.firestore.Timestamp.fromMillis(nowMs + SNS_STORY_LEASE_MS),
  });

  const recovered = await recoverSnsStoryOperationByPayloadHash(uid, input.requestPayloadHash, nowMs);
  assert.equal(recovered?.action, 'generating');
  assert.equal(recovered?.recordId, input.recordId);
});

test('failed or expired operations with the same payload hash are recovered as retry targets', async () => {
  const uid = `sns-story-recover-retry-${Date.now()}`;
  const record = sourceRecord('selected-recover-retry');
  await seedSource(uid, record);
  const failedInput = finalInput(uid, record, 'recover-failed');
  await db.doc(`users/${uid}/records/${failedInput.recordId}`).set({
    source: 'sns_story',
    generationStatus: 'failed',
    requestTimestamp: failedInput.requestTimestamp,
    requestPayloadHash: failedInput.requestPayloadHash,
  });

  const failedRecovered = await recoverSnsStoryOperationByPayloadHash(
    uid,
    failedInput.requestPayloadHash,
    failedInput.requestTimestamp + 1_000,
  );
  assert.equal(failedRecovered?.action, 'retry');
  assert.equal(failedRecovered?.recordId, failedInput.recordId);

  const retryInput = { ...failedInput, leaseOwner: 'lease-retry-recovered' };
  await seedLease(retryInput);
  await commitCompletedSnsStoryRecord(retryInput);
  const snapshot = await db.collection(`users/${uid}/records`).get();
  assert.equal(snapshot.size, 1, 'retry must reuse the recovered failed operation document');
  assert.equal(snapshot.docs[0].data().generationStatus, 'completed');
});

test('different payload hashes and stale operations are not recovered', async () => {
  const uid = `sns-story-recover-none-${Date.now()}`;
  const record = sourceRecord('selected-recover-none');
  const input = finalInput(uid, record, 'recover-none');
  await db.doc(`users/${uid}/records/${input.recordId}`).set({
    source: 'sns_story',
    generationStatus: 'completed',
    requestTimestamp: input.requestTimestamp,
    requestPayloadHash: input.requestPayloadHash,
  });

  const differentHash = buildSnsStoryFinalPayloadHash({
    range: input.range,
    excludedRecordIds: [],
    sourceFingerprint: input.expectedFingerprint,
    title: input.title,
    confirmedSynopsis: `${input.confirmedSynopsis} 다른 내용`,
  });
  assert.equal(await recoverSnsStoryOperationByPayloadHash(uid, differentHash, input.requestTimestamp + 1_000), null);
  assert.equal(
    await recoverSnsStoryOperationByPayloadHash(
      uid,
      input.requestPayloadHash,
      input.requestTimestamp + SNS_STORY_OPERATION_RECOVERY_MS + 1,
    ),
    null,
  );
});

test('concurrent first final requests with the same payload converge to one record and one quota use', async () => {
  const uid = `sns-story-concurrent-${Date.now()}`;
  const record = sourceRecord('selected-concurrent');
  await seedSource(uid, record);
  const input = finalInput(uid, record, 'concurrent');
  const fakeGemini = createFakeGeminiFactory({ delayMs: 120 });
  setSnsStoryGeminiFactoryForTest(fakeGemini.factory);
  const requestTimestamp = Date.now();

  const [first, second] = await Promise.all([
    runFinalCallable(uid, finalCallableData(input, requestTimestamp)),
    runFinalCallable(uid, finalCallableData(input, requestTimestamp + 1)),
  ]);

  assert.equal(new Set([first.recordId, second.recordId]).size, 1, 'both requests must converge to one record id');
  assert.equal(fakeGemini.calls, 1, 'only one request may enter Gemini generation');
  assert.equal(await monthlyAiUsedCount(uid), 1, 'monthly AI quota must be reserved once');
  const completed = await completedSnsStories(uid);
  assert.equal(completed.length, 1, 'only one completed SNS story record may be saved');
  assert.equal(completed[0].id, first.recordId);

  const retried = await runFinalCallable(uid, finalCallableData(input, requestTimestamp + 777));
  assert.equal(retried.status, 'completed');
  assert.equal(retried.recordId, first.recordId, 'new timestamp retries must recover the completed operation');
  assert.equal(fakeGemini.calls, 1, 'completed retry must not call Gemini again');
  assert.equal(await monthlyAiUsedCount(uid), 1, 'completed retry must not reserve quota again');

  const differentPayload = await runFinalCallable(
    uid,
    finalCallableData(input, requestTimestamp + 2_000, { title: '다른 SNS 이야기' }),
  );
  assert.equal(differentPayload.status, 'completed');
  assert.notEqual(differentPayload.recordId, first.recordId, 'different payloads must remain independent');
  assert.equal(fakeGemini.calls, 2);
  assert.equal(await monthlyAiUsedCount(uid), 2);

  const occupiedTimestamp = Number(completed[0].id.match(/_snsStory_(\d+)$/)?.[1]);
  assert(Number.isFinite(occupiedTimestamp), 'completed SNS story id must contain the occupied request timestamp');
  await assert.rejects(
    runFinalCallable(
      uid,
      finalCallableData(input, occupiedTimestamp, { title: '같은 timestamp 다른 payload' }),
    ),
    (error) => error.details?.reason === 'SNS_STORY_IDEMPOTENCY_CONFLICT',
    'different payloads may not reuse an occupied timestamp document id',
  );
  assert.equal(fakeGemini.calls, 2, 'id conflict must fail before Gemini');
  assert.equal(await monthlyAiUsedCount(uid), 2, 'id conflict must fail before quota reservation');
});

test('same payload from a different uid creates an independent operation', async () => {
  const record = sourceRecord('selected-user-scope');
  const uidA = `sns-story-user-a-${Date.now()}`;
  const uidB = `sns-story-user-b-${Date.now()}`;
  await seedSource(uidA, record);
  await seedSource(uidB, record);
  const inputA = finalInput(uidA, record, 'user-a');
  const inputB = { ...inputA, uid: uidB };
  const fakeGemini = createFakeGeminiFactory();
  setSnsStoryGeminiFactoryForTest(fakeGemini.factory);
  const requestTimestamp = Date.now() + 5_000;

  const resultA = await runFinalCallable(uidA, finalCallableData(inputA, requestTimestamp));
  const resultB = await runFinalCallable(uidB, finalCallableData(inputB, requestTimestamp + 1));

  assert.equal(resultA.status, 'completed');
  assert.equal(resultB.status, 'completed');
  assert.equal(fakeGemini.calls, 2, 'different users must not share generation work');
  assert.equal(await monthlyAiUsedCount(uidA), 1);
  assert.equal(await monthlyAiUsedCount(uidB), 1);
  assert.equal((await completedSnsStories(uidA)).length, 1);
  assert.equal((await completedSnsStories(uidB)).length, 1);
});

test('AI failure after Gemini starts keeps quota usage and marks the leased operation failed', async () => {
  const uid = `sns-story-ai-fail-${Date.now()}`;
  const record = sourceRecord('selected-ai-fail');
  await seedSource(uid, record);
  const input = finalInput(uid, record, 'ai-fail');
  const fakeGemini = createFakeGeminiFactory({ text: '짧음' });
  setSnsStoryGeminiFactoryForTest(fakeGemini.factory);
  const requestTimestamp = Date.now() + 10_000;
  const expectedRecordId = `${toKstDateString(requestTimestamp)}_snsStory_${requestTimestamp}`;

  await assert.rejects(
    runFinalCallable(uid, finalCallableData(input, requestTimestamp)),
    (error) => error.details?.reason === 'SNS_STORY_AI_RESULT_TOO_SHORT',
  );

  assert.equal(fakeGemini.calls, 1);
  assert.equal(await monthlyAiUsedCount(uid), 1, 'quota must not be rolled back after Gemini starts');
  const failed = await db.doc(`users/${uid}/records/${expectedRecordId}`).get();
  assert.equal(failed.data()?.generationStatus, 'failed');
});
