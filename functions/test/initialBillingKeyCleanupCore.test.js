const assert = require('assert');
const {
  getCompleteInitialBillingKeyCleanup,
  resolveInitialBillingKeyCleanupReservation,
  shouldBlockNewSubscriptionForInitialBillingCleanup,
} = require('../lib/subscriptionBillingCore');

const SECRET_BILLING_KEY = 'bk_live_should_not_leak_in_cleanup_state';
const NOW = Date.UTC(2026, 8, 6);

function baseInput(overrides = {}) {
  const requestData = {
    uid: 'user-a',
    issueId: 'billing_issue_a',
    lastPaymentId: 'subscription_payment_a',
    paymentType: 'subscription',
    billingType: 'billing_key_issue',
    provider: 'kg_inicis',
    status: 'failed',
    billingKeyIssuedAt: '2026-09-06T00:00:00.000Z',
  };
  const paymentData = {
    uid: 'user-a',
    issueId: 'billing_issue_a',
    paymentId: 'subscription_payment_a',
    paymentType: 'subscription',
    billingType: 'initial_billing',
    provider: 'kg_inicis',
    status: 'failed',
    portoneStatus: 'FAILED',
  };
  const lockData = {
    uid: 'user-a',
    issueId: 'billing_issue_a',
    lastPaymentId: 'subscription_payment_a',
    paymentType: 'subscription',
    billingType: 'billing_key_issue',
    provider: 'kg_inicis',
    status: 'failed',
    billingKey: SECRET_BILLING_KEY,
    billingKeyIssuedAt: '2026-09-06T00:00:00.000Z',
  };

  return {
    uid: 'user-a',
    issueId: 'billing_issue_a',
    paymentId: 'subscription_payment_a',
    billingKey: SECRET_BILLING_KEY,
    provider: 'kg_inicis',
    failurePortOneStatus: 'FAILED',
    failureReason: 'PORTONE_FAILED',
    nowMs: NOW,
    requestExists: true,
    paymentExists: true,
    lockExists: true,
    requestData,
    paymentData,
    lockData,
    subscriptionData: null,
    billingSubscriptionData: null,
    ...overrides,
  };
}

function decision(overrides = {}) {
  return resolveInitialBillingKeyCleanupReservation(baseInput(overrides));
}

function assertNoBillingKeyLeak(value) {
  assert(!JSON.stringify(value).includes(SECRET_BILLING_KEY));
}

function run() {
  const deleteReady = decision();
  assert.equal(deleteReady.shouldDelete, true);
  assert.equal(deleteReady.reason, 'initial_charge_failed');
  assert.equal(deleteReady.status, 'unknown');
  assertNoBillingKeyLeak(deleteReady);

  const alreadyDeleted = decision({
    requestData: {
      ...baseInput().requestData,
      initialBillingKeyCleanup: {
        status: 'succeeded',
        reason: 'initial_charge_failed_cleanup_succeeded',
      },
    },
  });
  assert.equal(alreadyDeleted.shouldDelete, false);
  assert.equal(alreadyDeleted.cleanupAlreadyComplete, true);
  assert.equal(alreadyDeleted.reason, 'initial_charge_failed_cleanup_succeeded');
  assertNoBillingKeyLeak(alreadyDeleted);

  const notFoundAlreadyCleaned = decision({
    paymentData: {
      ...baseInput().paymentData,
      initialBillingKeyCleanup: {
        status: 'succeeded',
        reason: 'initial_charge_failed_cleanup_succeeded',
      },
    },
  });
  assert.equal(notFoundAlreadyCleaned.shouldDelete, false);
  assert.equal(notFoundAlreadyCleaned.cleanupAlreadyComplete, true);
  assertNoBillingKeyLeak(notFoundAlreadyCleaned);

  const networkFailureRetry = decision({
    lockData: {
      ...baseInput().lockData,
      initialBillingKeyCleanup: {
        status: 'failed',
        reason: 'initial_charge_failed_cleanup_failed',
        error: { code: 'ECONNABORTED', safeReason: 'ECONNABORTED' },
      },
    },
  });
  assert.equal(networkFailureRetry.shouldDelete, true);
  assert.equal(networkFailureRetry.reason, 'initial_charge_failed');
  assertNoBillingKeyLeak(networkFailureRetry);

  const interruptedAfterReservation = decision({
    requestData: {
      ...baseInput().requestData,
      initialBillingKeyCleanup: {
        status: 'unknown',
        reason: 'initial_charge_failed_cleanup_reserved',
      },
    },
    paymentData: {
      ...baseInput().paymentData,
      initialBillingKeyCleanup: {
        status: 'unknown',
        reason: 'initial_charge_failed_cleanup_reserved',
      },
    },
    lockData: {
      ...baseInput().lockData,
      initialBillingKeyCleanup: {
        status: 'unknown',
        reason: 'initial_charge_failed_cleanup_reserved',
      },
    },
  });
  assert.equal(interruptedAfterReservation.shouldDelete, true);
  assert.equal(interruptedAfterReservation.reason, 'initial_charge_failed');
  assertNoBillingKeyLeak(interruptedAfterReservation);

  const activeSubscription = decision({
    subscriptionData: {
      status: 'active',
      endDate: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
  assert.equal(activeSubscription.shouldDelete, false);
  assert.equal(activeSubscription.reason, 'active_subscription_exists');
  assertNoBillingKeyLeak(activeSubscription);

  const unclearPayment = decision({
    paymentData: {
      ...baseInput().paymentData,
      status: 'lookup_failed',
      portoneStatus: 'READY',
    },
    failurePortOneStatus: 'READY',
    failureReason: 'PORTONE_READY',
  });
  assert.equal(unclearPayment.shouldDelete, false);
  assert.equal(unclearPayment.reason, 'initial_charge_result_unconfirmed');
  assert.equal(unclearPayment.status, 'unknown');
  assertNoBillingKeyLeak(unclearPayment);

  const ownershipMismatch = decision({
    lockData: {
      ...baseInput().lockData,
      billingKey: 'different_billing_key',
    },
  });
  assert.equal(ownershipMismatch.shouldDelete, false);
  assert.equal(ownershipMismatch.reason, 'billing_key_ownership_unconfirmed');
  assertNoBillingKeyLeak(ownershipMismatch);

  assert.equal(shouldBlockNewSubscriptionForInitialBillingCleanup({
    requestData: {
      ...baseInput().requestData,
      initialBillingKeyCleanup: {
        status: 'failed',
        reason: 'initial_charge_failed_cleanup_failed',
      },
    },
    lockData: baseInput().lockData,
  }), true);
  assert.equal(shouldBlockNewSubscriptionForInitialBillingCleanup({
    requestData: {
      ...baseInput().requestData,
      initialBillingKeyCleanup: {
        status: 'succeeded',
        reason: 'initial_charge_failed_cleanup_succeeded',
      },
    },
    lockData: baseInput().lockData,
  }), false);
  assert.equal(shouldBlockNewSubscriptionForInitialBillingCleanup({
    requestData: baseInput().requestData,
    lockData: {
      ...baseInput().lockData,
      billingKey: undefined,
    },
  }), false);

  assert.deepEqual(getCompleteInitialBillingKeyCleanup(
    { initialBillingKeyCleanup: { status: 'failed', reason: 'retryable' } },
    { initialBillingKeyCleanup: { status: 'succeeded', reason: 'done' } },
  ), { status: 'succeeded', reason: 'done' });

  console.log('initial billing key cleanup core tests passed');
}

run();
