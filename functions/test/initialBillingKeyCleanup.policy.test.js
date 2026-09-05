const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const helpersSrc = fs.readFileSync(path.join(root, 'functions/src/subscriptionHelpers.ts'), 'utf8');

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

function assertBefore(source, earlier, later) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `missing earlier marker: ${earlier}`);
  assert.notEqual(laterIndex, -1, `missing later marker: ${later}`);
  assert(earlierIndex < laterIndex, `expected "${earlier}" before "${later}"`);
}

function loggerSnippets(source) {
  const lines = source.split('\n');
  const snippets = [];
  lines.forEach((line, index) => {
    if (!line.includes('logger.')) return;
    const chunk = [];
    for (let offset = index; offset < lines.length; offset += 1) {
      chunk.push(lines[offset]);
      if (lines[offset].includes(');')) break;
    }
    snippets.push(chunk.join('\n'));
  });
  return snippets;
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

const subscribeSection = section(indexSrc, 'export const subscribeWithBillingKey = onCall', '// ===== 💳 정기구독 해지 =====');
const recoverSection = section(indexSrc, 'export const recoverSubscriptionBillingRequest = onCall', '// ===== 💳 결제 검증 (PortOne V2) =====');
const completionSection = section(indexSrc, 'async function completeInitialBillingSubscription', 'async function markInitialBillingPaymentPending');
const settlementSection = section(indexSrc, 'async function settleInitialBillingPayment', 'async function settleRecurringBillingPayment');
const cleanupTypesSection = section(indexSrc, "type InitialBillingKeyCleanupStatus = 'succeeded' | 'failed' | 'not_needed' | 'unknown';", 'async function settleInitialBillingPayment');
const reserveSection = section(indexSrc, 'async function reserveInitialBillingKeyCleanupAfterFailure', 'async function cleanupInitialBillingKeyAfterInitialChargeFailure');
const cleanupSection = section(indexSrc, 'async function cleanupInitialBillingKeyAfterInitialChargeFailure', 'async function settleInitialBillingPayment');
const recurringSection = section(indexSrc, 'export const processRecurringSubscriptions = onSchedule', '// ===== 💳 일반(단건) 1개월 이용권 검증 =====');
const subscribeChargeErrorSection = section(
  subscribeSection,
  'const billingError = getPortOneBillingErrorSummary(e)',
  "throw new HttpsError('unavailable', '첫 결제 요청 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.')",
);

assert(helpersSrc.includes('export async function revokePortOneBillingKey'));
assert(helpersSrc.includes('axios.delete(`https://api.portone.io/billing-keys/${encodeURIComponent(billingKey)}`'));
assert(helpersSrc.includes('if (error?.response?.status === 404)'));
assert(helpersSrc.includes('export function getSafePortOneBillingKeyRevocationError'));
assert(!helpersSrc.includes('message: %s'));

assert(cleanupTypesSection.includes("type InitialBillingKeyCleanupStatus = 'succeeded' | 'failed' | 'not_needed' | 'unknown';"));
assert(cleanupTypesSection.includes('initialBillingKeyCleanup: {'));
assert(cleanupTypesSection.includes("status,\n      reason,"));
assert(cleanupTypesSection.includes('failureReason'));

assert(reserveSection.includes("getInitialBillingKeyCleanup(requestData)"));
assert(reserveSection.includes("getInitialBillingKeyCleanup(paymentData)"));
assert(cleanupTypesSection.includes("cleanup.status === 'succeeded'"));
assert(cleanupTypesSection.includes("cleanup.status === 'failed'"));
assert(cleanupTypesSection.includes("cleanup.status === 'not_needed'"));
assert(cleanupTypesSection.includes("cleanup.status === 'unknown' && cleanup.reason === 'initial_charge_failed_cleanup_reserved'"));
assert(reserveSection.includes('requestData.uid === params.uid'));
assert(reserveSection.includes('paymentData.uid === params.uid'));
assert(reserveSection.includes('requestData.issueId === params.issueId'));
assert(reserveSection.includes('paymentData.issueId === params.issueId'));
assert(reserveSection.includes('requestData.lastPaymentId === params.paymentId'));
assert(reserveSection.includes('paymentData.paymentId === params.paymentId'));
assert(reserveSection.includes("requestData.billingType === 'billing_key_issue'"));
assert(reserveSection.includes("paymentData.billingType === 'initial_billing'"));
assert(reserveSection.includes('requestProvider === params.provider'));
assert(reserveSection.includes('paymentProvider === params.provider'));
assert(reserveSection.includes('requestData.billingKeyIssuedAt'));
assert(reserveSection.includes("requestStatus === 'processed' || paymentStatus === 'processed' || portoneStatus === 'PAID'"));
assert(reserveSection.includes('isActiveSubscriptionData(subscriptionData, Date.now())'));
assert(reserveSection.includes('billingSnap.exists'));
assert(reserveSection.includes("skipReason = 'billing_key_ownership_unconfirmed'"));
assert(reserveSection.includes("skipReason = 'active_subscription_exists'"));
assert(reserveSection.includes("skipReason = 'billing_subscription_exists'"));
assert(reserveSection.includes("skipReason = 'initial_charge_result_unconfirmed'"));
assert(reserveSection.includes("const reserveWrite = buildInitialBillingKeyCleanupWrite('unknown', 'initial_charge_failed_cleanup_reserved'"));
assertBefore(reserveSection, "initial_charge_failed_cleanup_reserved", 'reservation = { shouldDelete: true');

assert.equal(countOccurrences(cleanupSection, 'revokePortOneBillingKey(params.billingKey'), 1);
assert(cleanupSection.includes("writeInitialBillingKeyCleanupStatus(params, 'succeeded', 'initial_charge_failed_cleanup_succeeded'"));
assert(cleanupSection.includes("writeInitialBillingKeyCleanupStatus(params, 'failed', 'initial_charge_failed_cleanup_failed'"));
assert(cleanupSection.includes('getSafePortOneBillingKeyRevocationError(error)'));
assert(cleanupSection.includes("cleanupStatus: 'failed'"));
assert(cleanupSection.includes("cleanupStatus: 'unknown'"));
assert(!cleanupSection.includes('throw new HttpsError'));
assert(!cleanupSection.includes('billingKey:'));
assert(!cleanupSection.includes('billingKeyHash'));

assert(subscribeSection.includes("billingKey: storedBillingKey && storedBillingKey === billingKey ? storedBillingKey : null"));
assert(subscribeSection.includes("markInitialBillingKeyCleanupUnknown(\n          requestRef,\n          paymentRef,\n          'billing_key_ownership_unconfirmed'"));
assert(subscribeSection.includes('billingKey: locked.billingKey'));
assert(subscribeSection.includes('cleanupInitialBillingKeyAfterInitialChargeFailure({'));
assertBefore(subscribeChargeErrorSection, 'await markInitialBillingPaymentFailed(requestRef, paymentRef, billingError.portoneStatus, lockRef)', 'cleanupInitialBillingKeyAfterInitialChargeFailure({');
assertBefore(subscribeChargeErrorSection, 'cleanupInitialBillingKeyAfterInitialChargeFailure({', "throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.')");
assertBefore(subscribeChargeErrorSection, 'lastBillingError: billingError.safeReason', 'cleanupInitialBillingKeyAfterInitialChargeFailure({');
assert(subscribeSection.includes("markInitialBillingKeyCleanupUnknown(\n        requestRef,\n        paymentRef,\n        'initial_charge_result_unconfirmed'"));

assert(recoverSection.includes('cleanupInitialBillingKeyAfterInitialChargeFailure({'));
assert(recoverSection.includes("failureReason: 'stored_customer_invalid'"));
assert(recoverSection.includes('billingKey,'));

assert(settlementSection.includes("if (portoneStatus === 'PAID')"));
assert(settlementSection.includes('completeInitialBillingSubscription(params)'));
assert(settlementSection.includes('cleanupInitialBillingKeyAfterInitialChargeFailure({'));
assert(settlementSection.includes("failureReason: `PORTONE_${portoneStatus}`"));
assertBefore(settlementSection, 'await markInitialBillingPaymentFailed(params.requestRef, params.paymentRef, portoneStatus, params.lockRef)', 'cleanupInitialBillingKeyAfterInitialChargeFailure({');
assertBefore(settlementSection, 'cleanupInitialBillingKeyAfterInitialChargeFailure({', "throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.')");
assert(settlementSection.includes("markInitialBillingKeyCleanupUnknown(\n    params.requestRef,\n    params.paymentRef,\n    'initial_charge_result_unconfirmed'"));

assert(completionSection.includes("status: 'not_needed'"));
assert(completionSection.includes("reason: 'initial_charge_paid'"));
assert(!completionSection.includes('revokePortOneBillingKey'));

assert(!recurringSection.includes('cleanupInitialBillingKeyAfterInitialChargeFailure'));
assert(!recurringSection.includes('initialBillingKeyCleanup'));

const cleanupLogText = loggerSnippets(cleanupSection).join('\n---\n');
assert(!cleanupLogText.includes('params.billingKey'));
assert(!cleanupLogText.includes('billingKey:'));
assert(!cleanupLogText.includes('billingKeyHash'));

console.log('initial billing key cleanup policy tests passed');
