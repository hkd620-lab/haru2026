const assert = require('assert');
const {
  SubscriptionRefundPolicyError,
  assertAdminUid,
  assertNoDuplicateRefundRequest,
  assertPortOnePaymentMatchesStoredRequest,
  assertRefundRequestWindow,
  assertRefundRequesterOwnsPayment,
  assertSubscriptionChargePayment,
  estimateSubscriptionRefundAmount,
  getPortOneCancellableAmount,
  isProcessingRefundStatus,
  shouldMarkRefundedFromPortOne,
} = require('../lib/subscriptionRefundsCore');

const STORE_ID = 'store-d9310c4a-b5e8-4f6e-9e92-88e6b119e838';
const DAY = 24 * 60 * 60 * 1000;

function expectPolicyError(fn, code) {
  assert.throws(fn, (error) => {
    assert(error instanceof SubscriptionRefundPolicyError);
    assert.equal(error.policyCode, code);
    return true;
  });
}

function run() {
  const paymentRequest = {
    uid: 'user-a',
    paymentType: 'subscription',
    billingType: 'recurring',
    amount: 4000,
  };
  const paidPayment = {
    status: 'PAID',
    storeId: STORE_ID,
    currency: 'KRW',
    amount: { total: 4000 },
  };

  assertRefundRequesterOwnsPayment('user-a', paymentRequest);
  expectPolicyError(() => assertRefundRequesterOwnsPayment('user-b', paymentRequest), 'not_owner');

  assertSubscriptionChargePayment(paymentRequest);
  expectPolicyError(
    () => assertSubscriptionChargePayment({ ...paymentRequest, uid: 'user-a', paymentType: 'one_time', billingType: 'single' }),
    'not_subscription_payment',
  );

  assertPortOnePaymentMatchesStoredRequest(paidPayment, paymentRequest, STORE_ID);
  expectPolicyError(
    () => assertPortOnePaymentMatchesStoredRequest({ ...paidPayment, status: 'READY' }, paymentRequest, STORE_ID),
    'not_paid',
  );
  expectPolicyError(
    () => assertPortOnePaymentMatchesStoredRequest({ ...paidPayment, storeId: 'other-store' }, paymentRequest, STORE_ID),
    'store_mismatch',
  );
  expectPolicyError(
    () => assertPortOnePaymentMatchesStoredRequest({ ...paidPayment, amount: { total: 6000 } }, paymentRequest, STORE_ID),
    'amount_mismatch',
  );
  expectPolicyError(
    () => assertPortOnePaymentMatchesStoredRequest({ ...paidPayment, cancellableAmount: { total: 0 } }, paymentRequest, STORE_ID),
    'already_refunded',
  );

  assertNoDuplicateRefundRequest(undefined);
  expectPolicyError(() => assertNoDuplicateRefundRequest('requested'), 'duplicate_request');
  assert.equal(isProcessingRefundStatus('refunding'), true);
  assert.equal(isProcessingRefundStatus('rejected'), false);

  const now = Date.UTC(2026, 8, 2);
  assertRefundRequestWindow(now - 29 * DAY, now, 'unused_within_7_days');
  expectPolicyError(() => assertRefundRequestWindow(now - 31 * DAY, now, 'unused_within_7_days'), 'request_window_closed');
  assertRefundRequestWindow(now - 120 * DAY, now, 'duplicate_payment');

  assert.equal(estimateSubscriptionRefundAmount(4000, now - 3 * DAY, now, false), 4000);
  assert.equal(estimateSubscriptionRefundAmount(4000, now - 10 * DAY, now, true), 2667);

  assert.equal(getPortOneCancellableAmount({ ...paidPayment, cancellations: [{ status: 'SUCCEEDED', amount: { total: 1000 } }] }), 3000);
  assert.equal(shouldMarkRefundedFromPortOne({ ...paidPayment, status: 'CANCELLED', cancellableAmount: { total: 0 } }, 4000), true);

  assertAdminUid('admin', 'admin');
  expectPolicyError(() => assertAdminUid('user-a', 'admin'), 'permission_denied');

  console.log('subscription refund policy tests passed');
}

run();
