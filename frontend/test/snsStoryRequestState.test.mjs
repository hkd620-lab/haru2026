import assert from 'node:assert/strict';
import {
  SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS,
  SNS_STORY_FINAL_OPERATION_TTL_MS,
  SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS,
  buildSnsStoryFinalLogicalKey,
  buildSnsStorySelectionKey,
  createSnsStoryRequestCoordinator,
  getOrCreateDurableSnsStoryRequestTimestamp,
  getOrCreateSnsStoryRequestTimestamp,
  getSnsStoryFinalOperationStorageKey,
  isSnsStoryAmbiguousCallableError,
  normalizeSnsStoryRequestBase,
} from '../src/app/utils/snsStoryRequestState.ts';

class MemoryStorage {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
}

function createSerialLocks() {
  let queue = Promise.resolve();
  return {
    calls: [],
    request(name, callback) {
      this.calls.push(name);
      const run = queue.then(() => callback());
      queue = run.catch(() => {});
      return run;
    },
  };
}

assert.equal(SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS, 570_000);
assert.equal(SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS, 330_000);
assert.equal(SNS_STORY_FINAL_OPERATION_TTL_MS, 24 * 60 * 60 * 1000);

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

const storage = new MemoryStorage();
const uidA = 'uid-a';
const uidB = 'uid-b';
const durableA = await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidA,
  logicalKey: finalA,
  memoryFallback: new Map(),
  storage,
  locks: null,
  nowMs: 1_000,
});
assert.equal(durableA.requestTimestamp, 1_000);
assert.equal(durableA.durable, true);
assert.match(durableA.logicalKeyHash, /^[a-f0-9]{64}$/);

const durableAfterRemount = await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidA,
  logicalKey: finalA,
  memoryFallback: new Map(),
  storage,
  locks: null,
  nowMs: 2_000,
});
assert.equal(durableAfterRemount.requestTimestamp, 1_000, 'same uid/key must survive a new memory map');

const durableOtherUid = await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidB,
  logicalKey: finalA,
  memoryFallback: new Map(),
  storage,
  locks: null,
  nowMs: 3_000,
});
assert.equal(durableOtherUid.requestTimestamp, 3_000, 'different users must not share an operation');

const ttlStorage = new MemoryStorage();
await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidA,
  logicalKey: 'expires',
  memoryFallback: new Map(),
  storage: ttlStorage,
  locks: null,
  nowMs: 4_000,
  ttlMs: 10,
});
const renewed = await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidA,
  logicalKey: 'expires',
  memoryFallback: new Map(),
  storage: ttlStorage,
  locks: null,
  nowMs: 4_011,
  ttlMs: 10,
});
assert.equal(renewed.requestTimestamp, 4_011, 'expired operations must not be reused');

const corruptedStorage = new MemoryStorage({
  [getSnsStoryFinalOperationStorageKey(uidA)]: '{broken json',
});
const recoveredFromCorruption = await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidA,
  logicalKey: 'after-corruption',
  memoryFallback: new Map(),
  storage: corruptedStorage,
  locks: null,
  nowMs: 5_000,
});
assert.equal(recoveredFromCorruption.requestTimestamp, 5_000, 'corrupted storage must not throw');

const secretStorage = new MemoryStorage();
const sensitiveLogicalKey = JSON.stringify({
  title: 'RAW_TITLE_SECRET',
  synopsis: 'RAW_SYNOPSIS_SECRET',
  body: 'RAW_SNS_BODY_SECRET',
});
await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidA,
  logicalKey: sensitiveLogicalKey,
  memoryFallback: new Map(),
  storage: secretStorage,
  locks: null,
  nowMs: 6_000,
});
const storedSecretPayload = secretStorage.getItem(getSnsStoryFinalOperationStorageKey(uidA));
assert(storedSecretPayload);
assert(!storedSecretPayload.includes('RAW_TITLE_SECRET'));
assert(!storedSecretPayload.includes('RAW_SYNOPSIS_SECRET'));
assert(!storedSecretPayload.includes('RAW_SNS_BODY_SECRET'));
assert.deepEqual(Object.keys(JSON.parse(storedSecretPayload)[0]).sort(), [
  'expiresAt',
  'logicalKeyHash',
  'requestTimestamp',
]);

const throwingStorage = {
  getItem() {
    throw new Error('private mode');
  },
  setItem() {
    throw new Error('quota');
  },
};
const fallbackMemory = new Map();
const fallbackA = await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidA,
  logicalKey: 'fallback',
  memoryFallback: fallbackMemory,
  storage: throwingStorage,
  locks: null,
  nowMs: 7_000,
});
const fallbackB = await getOrCreateDurableSnsStoryRequestTimestamp({
  uid: uidA,
  logicalKey: 'fallback',
  memoryFallback: fallbackMemory,
  storage: throwingStorage,
  locks: null,
  nowMs: 8_000,
});
assert.equal(fallbackA.durable, false);
assert.equal(fallbackB.requestTimestamp, 7_000, 'storage failures must fall back to memory safely');

const concurrentStorage = new MemoryStorage();
const serialLocks = createSerialLocks();
const [concurrentA, concurrentB] = await Promise.all([
  getOrCreateDurableSnsStoryRequestTimestamp({
    uid: uidA,
    logicalKey: 'same-tab-race',
    memoryFallback: new Map(),
    storage: concurrentStorage,
    locks: serialLocks,
    nowMs: 9_000,
  }),
  getOrCreateDurableSnsStoryRequestTimestamp({
    uid: uidA,
    logicalKey: 'same-tab-race',
    memoryFallback: new Map(),
    storage: concurrentStorage,
    locks: serialLocks,
    nowMs: 9_500,
  }),
]);
assert.equal(concurrentA.requestTimestamp, concurrentB.requestTimestamp, 'concurrent same-browser calls must share one timestamp');
assert.equal(serialLocks.calls.length, 2);

const limitedStorage = new MemoryStorage();
for (let i = 0; i < 5; i += 1) {
  await getOrCreateDurableSnsStoryRequestTimestamp({
    uid: uidA,
    logicalKey: `limited-${i}`,
    memoryFallback: new Map(),
    storage: limitedStorage,
    locks: null,
    nowMs: 10_000 + i,
    maxEntries: 3,
  });
}
assert.equal(JSON.parse(limitedStorage.getItem(getSnsStoryFinalOperationStorageKey(uidA))).length, 3);

const coordinator = createSnsStoryRequestCoordinator(uidA);
const applied = { synopsis: '', error: '', loading: false };
applied.loading = true;
const requestA = coordinator.start('synopsis', 'selection-a', uidA);
coordinator.invalidate('synopsis');
const requestB = coordinator.start('synopsis', 'selection-b', uidA);
if (coordinator.isCurrent(requestA, 'selection-a', uidA)) applied.synopsis = 'A success';
if (coordinator.isCurrent(requestA, 'selection-a', uidA)) applied.error = 'A error';
if (coordinator.finish(requestA, 'selection-a', uidA)) applied.loading = false;
assert.deepEqual(applied, {
  synopsis: '',
  error: '',
  loading: true,
}, 'stale success/error/finally must not mutate current state');
if (coordinator.isCurrent(requestB, 'selection-b', uidA)) applied.synopsis = 'B success';
if (coordinator.finish(requestB, 'selection-b', uidA)) applied.loading = false;
assert.deepEqual(applied, {
  synopsis: 'B success',
  error: '',
  loading: false,
}, 'only the current request may apply success/finally');

const userToken = coordinator.start('final', 'final-key', uidA);
coordinator.setUser(uidB);
assert.equal(coordinator.isCurrent(userToken, 'final-key', uidA), false, 'uid changes must invalidate old requests');

assert.equal(isSnsStoryAmbiguousCallableError({ code: 'functions/deadline-exceeded' }), true);
assert.equal(isSnsStoryAmbiguousCallableError({ code: 'unavailable' }), true);
assert.equal(isSnsStoryAmbiguousCallableError({ message: 'Network request failed' }), true);
assert.equal(isSnsStoryAmbiguousCallableError({ code: 'functions/invalid-argument' }), false);

console.log('sns story request state tests passed');
