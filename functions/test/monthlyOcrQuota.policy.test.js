const assert = require('assert');

const {
  MONTHLY_OCR_QUOTA_LIMITS,
  MONTHLY_OCR_FEATURE_KEY,
  buildMonthlyOcrQuotaStatus,
  previewMonthlyAiQuotaReservation,
  previewMonthlyOcrQuotaReservation,
  resolveMonthlyAiPlanFromSubscriptionData,
} = require('../lib/utils/monthlyAiQuota');

// 0. 확정된 월간 OCR 한도 상수 (허 대표님 2026-09-03 확정) — 값이 바뀌면 여기서 즉시 실패해야 함
assert.deepStrictEqual(MONTHLY_OCR_QUOTA_LIMITS, {
  free: 20,
  basic: 100,
  premium: 300,
  developer: 300,
});
assert.strictEqual(MONTHLY_OCR_FEATURE_KEY, 'book_ocr');

// 1. 경계값 — free 19→허용/20→차단, basic 99→허용/100→차단, premium 299→허용/300→차단
function assertOcrBoundary(plan, seedUsed, limit) {
  const beforeLast = previewMonthlyOcrQuotaReservation({ byFeature: { book_ocr: seedUsed } }, plan, '2026-08');
  assert.strictEqual(beforeLast.allowed, true, `${plan} ${seedUsed} should allow one more OCR`);
  assert.strictEqual(beforeLast.nextStatus.used, limit);
  assert.strictEqual(beforeLast.nextStatus.remaining, 0);

  const exhausted = previewMonthlyOcrQuotaReservation({ byFeature: { book_ocr: limit } }, plan, '2026-08');
  assert.strictEqual(exhausted.allowed, false, `${plan} ${limit} should block next OCR`);
  assert.strictEqual(exhausted.status.used, limit);
  assert.strictEqual(exhausted.status.remaining, 0);
}

assertOcrBoundary('free', 19, 20);
assertOcrBoundary('basic', 99, 100);
assertOcrBoundary('premium', 299, 300);

// 2. 분리 검증 (가장 중요) — 공용 쿼터(usedCount)가 다 찼어도 OCR(byFeature.book_ocr)은 별개로 정상 사용 가능해야 함
const sharedExhaustedData = { usedCount: 10, byFeature: { book_ocr: 0 } };

const ocrStillAllowed = previewMonthlyOcrQuotaReservation(sharedExhaustedData, 'free', '2026-08');
assert.strictEqual(ocrStillAllowed.allowed, true, '공용 AI 쿼터가 소진돼도 OCR 전용 카운터가 0이면 허용되어야 함');
assert.strictEqual(ocrStillAllowed.status.used, 0);
assert.strictEqual(ocrStillAllowed.nextStatus.used, 1);

const generalBlocked = previewMonthlyAiQuotaReservation(sharedExhaustedData, 'free', '2026-08');
assert.strictEqual(generalBlocked.allowed, false, 'free usedCount 10은 기존 공용 AI 쿼터 기준으로 이미 소진 상태여야 함');

// 3. 역방향 분리 — OCR 전용 카운터만 소진돼도 공용 AI 쿼터(usedCount)는 영향받지 않아야 함
const ocrExhaustedData = { usedCount: 0, byFeature: { book_ocr: 20 } };

const ocrBlocked = previewMonthlyOcrQuotaReservation(ocrExhaustedData, 'free', '2026-08');
assert.strictEqual(ocrBlocked.allowed, false, 'free byFeature.book_ocr 20은 OCR을 차단해야 함');

const generalStillAllowed = previewMonthlyAiQuotaReservation(ocrExhaustedData, 'free', '2026-08');
assert.strictEqual(generalStillAllowed.allowed, true, 'OCR만 소진되어도 공용 AI 쿼터는 영향받지 않아야 함');
assert.strictEqual(generalStillAllowed.status.used, 0);

// 4. 초기 상태 — byFeature 필드 자체가 없는 문서(신규 유저 첫 사용 등)에서 used = 0으로 읽힐 것
assert.strictEqual(previewMonthlyOcrQuotaReservation({}, 'free', '2026-08').status.used, 0);
assert.strictEqual(previewMonthlyOcrQuotaReservation(null, 'basic', '2026-08').status.used, 0);
assert.strictEqual(previewMonthlyOcrQuotaReservation(undefined, 'premium', '2026-08').status.used, 0);
assert.strictEqual(previewMonthlyOcrQuotaReservation({ usedCount: 5 }, 'free', '2026-08').status.used, 0);

// 5. 요금제 판정 재사용 — resolveMonthlyAiPlanFromSubscriptionData로 만료 구독이 free로 떨어지는지 (기존 로직 회귀 없음)
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData('normal-user', {
  plan: 'premium',
  status: 'cancelled',
  endDate: '2020-01-01T00:00:00.000Z',
}), 'free', '만료된 구독은 OCR 쿼터 판정에서도 free로 떨어져야 함');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData('normal-user', {
  plan: 'basic',
  status: 'active',
  endDate: '2099-01-01T00:00:00.000Z',
}), 'basic');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData('normal-user', {
  plan: 'premium',
  status: 'cancelled',
  endDate: '2099-01-01T00:00:00.000Z',
}), 'premium', '해지 예약 프리미엄은 종료일까지 OCR 쿼터 판정에서도 유지되어야 함');
assert.strictEqual(resolveMonthlyAiPlanFromSubscriptionData('normal-user', {
  plan: 'basic',
  status: 'none',
  endDate: '2099-01-01T00:00:00.000Z',
}), 'free', '활성/해지예약 상태가 아닌 플랜 잔여값은 OCR 권한으로 인정하지 않아야 함');

// buildMonthlyOcrQuotaStatus 반환 형태 고정 (plan/used/limit/remaining/period)
assert.deepStrictEqual(buildMonthlyOcrQuotaStatus('basic', 10, '2026-08'), {
  plan: 'basic',
  used: 10,
  limit: 100,
  remaining: 90,
  period: '2026-08',
});

console.log('monthly OCR quota policy tests passed');
