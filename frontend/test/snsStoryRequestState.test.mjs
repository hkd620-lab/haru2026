import assert from 'node:assert/strict';
import {
  SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS,
  SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS,
  buildSnsStoryFinalLogicalKey,
  buildSnsStorySelectionKey,
  getOrCreateSnsStoryRequestTimestamp,
  isSnsStoryAmbiguousCallableError,
  normalizeSnsStoryRequestBase,
} from '../src/app/utils/snsStoryRequestState.ts';

assert.equal(SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS, 570_000);
assert.equal(SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS, 330_000);

assert.deepEqual(normalizeSnsStoryRequestBase({
  rangeType: 'year',
  year: ' 2024 ',
  from: '2020-01-01',
  to: '2020-12-31',
  excludedRecordIds: ['b', 'a', 'b', ''],
}), {
  rangeType: 'year',
  year: '2024',
  from: undefined,
  to: undefined,
  excludedRecordIds: ['a', 'b'],
});

assert.equal(
  buildSnsStorySelectionKey({
    rangeType: 'custom',
    from: '2024-01-01',
    to: '2024-12-31',
    excludedRecordIds: ['z', 'a'],
  }),
  buildSnsStorySelectionKey({
    rangeType: 'custom',
    from: '2024-01-01',
    to: '2024-12-31',
    excludedRecordIds: ['a', 'z'],
  }),
);

const confirmedSynopsis = '확정한 시놉시스입니다. '.repeat(4);
const finalA = buildSnsStoryFinalLogicalKey({
  rangeType: 'all',
  excludedRecordIds: ['2', '1'],
  sourceFingerprint: 'ABCDEF',
  title: ' 나의 SNS 이야기 ',
  confirmedSynopsis: ` ${confirmedSynopsis}`,
});
const finalB = buildSnsStoryFinalLogicalKey({
  rangeType: 'all',
  excludedRecordIds: ['1', '2'],
  sourceFingerprint: 'abcdef',
  title: '나의 SNS 이야기',
  confirmedSynopsis: confirmedSynopsis.trim(),
});
assert.equal(finalA, finalB, 'same logical final request must produce one key');
assert.notEqual(finalA, buildSnsStoryFinalLogicalKey({
  rangeType: 'all',
  excludedRecordIds: ['1', '2'],
  sourceFingerprint: 'abcdef',
  title: '나의 SNS 이야기',
  confirmedSynopsis: '수정된 시놉시스입니다. '.repeat(4),
}), 'editing the confirmed synopsis must create a new final request key');

const timestamps = new Map();
assert.equal(getOrCreateSnsStoryRequestTimestamp(timestamps, finalA, 101), 101);
assert.equal(getOrCreateSnsStoryRequestTimestamp(timestamps, finalA, 202), 101);
assert.equal(getOrCreateSnsStoryRequestTimestamp(timestamps, 'different', 303), 303);

assert.equal(isSnsStoryAmbiguousCallableError({ code: 'functions/deadline-exceeded' }), true);
assert.equal(isSnsStoryAmbiguousCallableError({ code: 'unavailable' }), true);
assert.equal(isSnsStoryAmbiguousCallableError({ message: 'Network request failed' }), true);
assert.equal(isSnsStoryAmbiguousCallableError({ code: 'functions/invalid-argument' }), false);

console.log('sns story request state tests passed');
