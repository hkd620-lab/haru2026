const assert = require('assert');
const {
  SUBSCRIPTION_REFUNDING_STALE_MS,
  SubscriptionRefundPolicyError,
  assertAdminUid,
  assertNoDuplicateRefundRequest,
  assertPortOnePaymentMatchesStoredRequest,
  assertRefundRequestWindow,
  assertRefundRequestMatchesPaymentRequest,
  assertRefundRequesterOwnsPayment,
  assertSubscriptionChargePayment,
  createPortOneRefundIdempotencyKey,
  estimateSubscriptionRefundAmount,
  getApproveRefundRecoveryAction,
  getPortOneCancellableAmount,
  getRefundWebhookSyncAction,
  hasRefundRequestMarker,
  isPaidFirestoreSubscriptionPaymentRequest,
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
  const partialCancelledPayment = {
    ...paidPayment,
    status: 'PARTIAL_CANCELLED',
    cancellableAmount: { total: 3000 },
    cancellations: [{ status: 'SUCCEEDED', amount: { total: 1000 } }],
  };
  const cancelledPayment = {
    ...paidPayment,
    status: 'CANCELLED',
    cancellableAmount: { total: 0 },
    cancellations: [{ status: 'SUCCEEDED', amount: { total: 4000 } }],
  };

  assertRefundRequesterOwnsPayment('user-a', paymentRequest);
  expectPolicyError(() => assertRefundRequesterOwnsPayment('user-b', paymentRequest), 'not_owner');
  assertRefundRequestMatchesPaymentRequest({ uid: 'user-a' }, paymentRequest);
  expectPolicyError(() => assertRefundRequestMatchesPaymentRequest({ uid: 'user-b' }, paymentRequest), 'not_owner');

  assertSubscriptionChargePayment(paymentRequest);
  expectPolicyError(
    () => assertSubscriptionChargePayment({ ...paymentRequest, uid: 'user-a', paymentType: 'one_time', billingType: 'single' }),
    'not_subscription_payment',
  );
  assert.equal(isPaidFirestoreSubscriptionPaymentRequest('user-a', {
    ...paymentRequest,
    status: 'processed',
    portoneStatus: 'PAID',
  }), true);
  assert.equal(isPaidFirestoreSubscriptionPaymentRequest('user-a', {
    ...paymentRequest,
    status: 'processed',
    portoneStatus: 'READY',
  }), false);
  assert.equal(isPaidFirestoreSubscriptionPaymentRequest('user-a', {
    ...paymentRequest,
    paymentType: 'one_time',
    billingType: 'single',
    status: 'processed',
    portoneStatus: 'PAID',
  }), false);
  assert.equal(isPaidFirestoreSubscriptionPaymentRequest('user-b', {
    ...paymentRequest,
    status: 'processed',
    portoneStatus: 'PAID',
  }), false);
  assert.equal(hasRefundRequestMarker({ ...paymentRequest }), false);
  assert.equal(hasRefundRequestMarker({ ...paymentRequest, refundStatus: 'requested' }), true);
  assert.equal(hasRefundRequestMarker({ ...paymentRequest, refundRequestId: 'subscription_payment_123' }), true);

  assertPortOnePaymentMatchesStoredRequest(paidPayment, paymentRequest, STORE_ID);
  expectPolicyError(
    () => assertPortOnePaymentMatchesStoredRequest({ ...paidPayment, status: 'READY' }, paymentRequest, STORE_ID),
    'not_paid',
  );
  expectPolicyError(
    () => assertPortOnePaymentMatchesStoredRequest({ ...paidPayment, storeId: undefined }, paymentRequest, STORE_ID),
    'store_mismatch',
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
    () => assertPortOnePaymentMatchesStoredRequest(partialCancelledPayment, paymentRequest, STORE_ID),
    'not_paid',
  );
  assertPortOnePaymentMatchesStoredRequest(partialCancelledPayment, paymentRequest, STORE_ID, { allowPartialCancelled: true });
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
  assert.equal(getPortOneCancellableAmount({
    ...paidPayment,
    cancellations: [
      { status: 'SUCCEEDED', amount: { total: 1000 } },
      { status: 'REQUESTED', amount: { total: 500 } },
      { status: 'FAILED', amount: { total: 500 } },
    ],
  }), 3000);
  assert.equal(getPortOneCancellableAmount(partialCancelledPayment), 3000);
  assert.equal(shouldMarkRefundedFromPortOne(cancelledPayment, 4000), true);
  assert.equal(createPortOneRefundIdempotencyKey('subscription_payment_123'), '"subscription-refund-subscription_payment_123"');

  assert.equal(
    getApproveRefundRecoveryAction('refunding', cancelledPayment, 4000, now - 1000, now),
    'sync_refunded',
  );
  assert.equal(
    getApproveRefundRecoveryAction('refunding', paidPayment, 4000, now - 1000, now),
    'already_processing',
  );
  assert.equal(
    getApproveRefundRecoveryAction('refunding', paidPayment, 4000, now - SUBSCRIPTION_REFUNDING_STALE_MS - 1, now),
    'retry_cancel',
  );
  assert.equal(
    getApproveRefundRecoveryAction('requested', partialCancelledPayment, 3000, Number.NaN, now),
    'retry_cancel',
  );
  assert.equal(
    getApproveRefundRecoveryAction('refunded', paidPayment, 4000, now - 1000, now),
    'already_processed',
  );
  assert.equal(getRefundWebhookSyncAction(true, 0), 'sync_direct');
  assert.equal(getRefundWebhookSyncAction(false, 2), 'sync_matching');
  assert.equal(getRefundWebhookSyncAction(false, 0), 'ignore_orphan');

  assertAdminUid('admin', 'admin');
  expectPolicyError(() => assertAdminUid('user-a', 'admin'), 'permission_denied');

  console.log('subscription refund policy tests passed');
}

run();
