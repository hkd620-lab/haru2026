const assert = require('assert');

const {
  buildMonthlyAiQuotaStatus,
  getKstMonthKey,
  normalizeMonthlyAiPlan,
  previewMonthlyAiQuotaReservation,
  resolveMonthlyAiPlanFromSubscriptionData,
  sanitizeMonthlyAiFeatureKey,
} = require('../lib/utils/monthlyAiQuota');
const { INTERNAL_ADMIN_UID } = require('../lib/internalEntitlements');

function assertBoundary(plan, seedUsed, limit) {
  const beforeLast = previewMonthlyAiQuotaReservation({ usedCount: seedUsed }, plan, '2026-08');
  assert.strictEqual(beforeLast.allowed, true, `${plan} ${seedUsed} should allow one more`);
  assert.strictEqual(beforeLast.nextStatus.used, limit);
  assert.strictEqual(beforeLast.nextStatus.remaining, 0);

  const exhausted = previewMonthlyAiQuotaReservation({ usedCount: limit }, plan, '2026-08');
  assert.strictEqual(exhausted.allowed, false, `${plan} ${limit} should block next use`);
  assert.strictEqual(exhausted.status.used, limit);
  assert.strictEqual(exhausted.status.remaining, 0);
}

assertBoundary('free', 9, 10);
assertBoundary('basic', 99, 100);
assertBoundary('premium', 299, 300);
assertBoundary('developer', 299, 300);

let used = 0;
for (const count of [3, 2, 2]) {
  for (let i = 0; i < count; i += 1) {
    const preview = previewMonthlyAiQuotaReservation({ usedCount: used }, 'free', '2026-08');
    assert.strictEqual(preview.allowed, true);
    used = preview.nextStatus.used;
  }
}
assert.strictEqual(used, 7, 'polishContent 3 + SAYU 2 + SNS 2 should share one counter');

let concurrentUsed = 9;
let concurrentAllowed = 0;
for (let i = 0; i < 2; i += 1) {
  const preview = previewMonthlyAiQuotaReservation({ usedCount: concurrentUsed }, 'free', '2026-08');
  if (preview.allowed) {
    concurrentAllowed += 1;
    concurrentUsed = preview.nextStatus.used;
  }
}
assert.strictEqual(concurrentAllowed, 1, 'free 9 with two serialized reservations should allow only one');
assert.strictEqual(concurrentUsed, 10);

const reserved = previewMonthlyAiQuotaReservation({ usedCount: 5 }, 'free', '2026-08');
assert.strictEqual(reserved.nextStatus.used, 6);
const rolledBackUsed = reserved.nextStatus.used - 1;
assert.strictEqual(rolledBackUsed, 5, 'failed AI work should roll back the reservation');

assert.strictEqual(getKstMonthKey(Date.UTC(2026, 7, 31, 14, 59, 59)), '2026-08');
assert.strictEqual(getKstMonthKey(Date.UTC(2026, 7, 31, 15, 0, 0)), '2026-09');

assert.deepStrictEqual(buildMonthlyAiQuotaStatus('basic', 10, '2026-08'), {
  plan: 'basic',
  used: 10,
  limit: 100,
  remaining: 90,
  period: '2026-08',
  freeLimit: 10,
  basicLimit: 100,
  premiumLimit: 300,
  developerLimit: 300,
});

assert.strictEqual(normalizeMonthlyAiPlan('PREMIUM'), 'premium');
assert.strictEqual(normalizeMonthlyAiPlan('basic'), 'basic');
assert.strictEqual(normalizeMonthlyAiPlan('developer'), 'free');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData(INTERNAL_ADMIN_UID, undefined), 'developer');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData(INTERNAL_ADMIN_UID, {
  plan: 'premium',
  status: 'cancelled',
  endDate: '2020-01-01T00:00:00.000Z',
}), 'developer');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData('normal-user', {
  plan: 'premium',
  status: 'cancelled',
  endDate: '2020-01-01T00:00:00.000Z',
}), 'free');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData('normal-user', {
  plan: 'basic',
  status: 'active',
  endDate: '2099-01-01T00:00:00.000Z',
}), 'basic');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData('normal-user', {
  plan: 'basic',
  status: 'cancelled',
  endDate: '2099-01-01T00:00:00.000Z',
}), 'basic', '해지 예약 구독은 이용 종료일까지 기존 플랜으로 판정해야 함');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData('normal-user', {
  plan: 'premium',
  status: 'none',
  endDate: '2099-01-01T00:00:00.000Z',
}), 'free', '활성/해지예약 상태가 아닌 플랜 잔여값은 권한으로 인정하지 않아야 함');
assert.strictEqual(sanitizeMonthlyAiFeatureKey('bad/key.name'), 'bad_key_name');

console.log('monthly AI quota policy tests passed');
