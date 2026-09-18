const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'functions/src/snsStory.ts'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const {
  SNS_STORY_MODEL,
  SNS_STORY_REGION,
  SNS_STORY_MEMORY,
  normalizeSnsTimestampMs,
  toKstDateString,
  resolveSnsStoryRange,
  buildSnsStoryCounts,
  buildSnsStorySourceChunks,
  groupSnsStoryChunks,
} = require('../lib/snsStory');

assert.strictEqual(SNS_STORY_MODEL, 'gemini-3.1-flash-lite');
assert.strictEqual(SNS_STORY_REGION, 'asia-northeast3');
assert.strictEqual(SNS_STORY_MEMORY, '512MiB');

assert(src.includes("users').doc(uid).collection('snsRecords')"), 'server must read users/{uid}/snsRecords');
assert(!src.includes('request.data.uid'), 'client uid must not be trusted');
assert(src.includes('record.isDeleted !== true'), 'isDeleted === true records must be excluded');
assert(src.includes('SNS_STORY_RANGE_TOO_LARGE'), 'large ranges must fail explicitly');
assert(src.includes('SNS_STORY_PHOTO_ONLY'), 'photo-only ranges must fail explicitly');
assert(src.includes('SNS_STORY_SOURCE_CHANGED'), 'source fingerprint changes must be rejected');
assert(src.includes("reserveMonthlyAiQuota(uid, 'sns_story_synopsis')"), 'synopsis must reserve shared monthly AI quota once');
assert(src.includes("reserveMonthlyAiQuota(uid, 'sns_story_final')"), 'final story must reserve shared monthly AI quota once');
assert(src.includes('rollbackMonthlyAiQuotaReservation(monthlyQuotaReservation)'), 'failed AI work must roll back quota');
assert(src.includes("generationStatus: 'generating'"), 'final generation must create a lease state');
assert(src.includes('leaseExpiresAt'), 'generating state must have a retryable lease');
assert(src.includes("formats: ['에세이']"), 'completed records must be saved as essays');
assert(src.includes("source: 'sns_story'"), 'completed records must identify the sns_story source');
assert(src.includes('sns_story_source'), 'completed records must store source metadata');
assert(src.includes('confirmedSynopsis'), 'confirmed user-edited synopsis must be stored');
assert(src.includes('전체 SNS 원문은 제공되지 않습니다'), 'final function must not send all SNS raw text again');
assert(indexSrc.includes('generateSnsStorySynopsis'), 'index must export generateSnsStorySynopsis');
assert(indexSrc.includes('generateSnsStoryFinal'), 'index must export generateSnsStoryFinal');

const secondTimestamp = 1704063600;
const milliTimestamp = 1704063600000;
assert.strictEqual(normalizeSnsTimestampMs(secondTimestamp), milliTimestamp);
assert.strictEqual(normalizeSnsTimestampMs(milliTimestamp), milliTimestamp);
assert.strictEqual(toKstDateString(Date.UTC(2023, 11, 31, 14, 59, 59)), '2023-12-31');
assert.strictEqual(toKstDateString(Date.UTC(2023, 11, 31, 15, 0, 0)), '2024-01-01');
assert.strictEqual(toKstDateString(secondTimestamp * 1000), '2024-01-01');

assert.deepStrictEqual(resolveSnsStoryRange({ rangeType: 'all' }), { type: 'all' });
assert.deepStrictEqual(resolveSnsStoryRange({ rangeType: 'year', year: '2024' }), { type: 'year', year: 2024 });
assert.deepStrictEqual(resolveSnsStoryRange({ rangeType: 'custom', from: '2024-01-01', to: '2024-12-31' }), {
  type: 'custom',
  from: '2024-01-01',
  to: '2024-12-31',
});
assert.throws(() => resolveSnsStoryRange({ rangeType: 'custom', from: '2024-12-31', to: '2024-01-01' }));

const periodRecords = [
  { id: 'a', text: '글', thumbnails: [], source: 'facebook', timestampMs: 1, date: '2024-01-01', isDeleted: false },
  { id: 'b', text: '', thumbnails: ['p'], source: 'facebook', timestampMs: 2, date: '2024-01-02', isDeleted: false },
  { id: 'c', text: '글사진', thumbnails: ['p'], source: 'instagram', timestampMs: 3, date: '2024-01-03', isDeleted: false },
];
assert.deepStrictEqual(buildSnsStoryCounts(periodRecords, [periodRecords[0], periodRecords[2]]), {
  total: 3,
  included: 2,
  excluded: 1,
  textOnly: 1,
  photoOnly: 0,
  textAndPhoto: 1,
});

const longText = `${'가'.repeat(13000)}끝`;
const chunks = buildSnsStorySourceChunks([{
  id: 'long',
  source: 'facebook',
  timestampMs: milliTimestamp,
  date: '2024-01-01',
  text: longText,
  thumbnails: [],
  isDeleted: false,
}]);
assert(chunks.length >= 2, 'long individual records must be split instead of truncated');
assert(chunks.some((chunk) => chunk.text.includes('끝')), 'the final slice of a long record must be preserved');
const grouped = groupSnsStoryChunks(chunks);
assert(grouped.every((group) => group.length <= 16000), 'source groups should fit the configured Gemini chunk size');

const photoOnlyChunks = buildSnsStorySourceChunks([{
  id: 'photo',
  source: 'facebook',
  timestampMs: milliTimestamp,
  date: '2024-01-01',
  text: '',
  thumbnails: ['users/u/snsThumbnails/photo/0.jpg'],
  isDeleted: false,
}]);
assert(photoOnlyChunks[0].text.includes('contentType: photo_only'));
assert(photoOnlyChunks[0].text.includes('사진 내용은 분석하지 않으며 장수만 반영'));

console.log('sns story policy tests passed');
