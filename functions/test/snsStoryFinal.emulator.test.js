const assert = require('node:assert/strict');
const { test } = require('node:test');
const admin = require('firebase-admin');

if (!process.env.FIRESTORE_EMULATOR_HOST || !/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  throw new Error('Only a loopback Firestore emulator is allowed. Never run against production.');
}
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-haru-sns-story';

const {
  SNS_STORY_LEASE_MS,
  buildSnsStoryFinalPayloadHash,
  buildSnsStoryFingerprint,
  commitCompletedSnsStoryRecord,
  toKstDateString,
} = require('../lib/snsStory');

const db = admin.firestore();

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
  const confirmedSynopsis = 'SNS 원문을 바탕으로 확정한 시놉시스입니다. 중요한 흐름과 반복된 주제를 정리했습니다.';
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
