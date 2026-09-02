const assert = require('assert');
const path = require('path');
const esbuild = require('esbuild');

async function loadSubscriptionDisplay() {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, '../src/app/utils/subscriptionDisplay.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });
  const moduleShim = { exports: {} };
  const evaluate = new Function('module', 'exports', 'require', result.outputFiles[0].text);
  evaluate(moduleShim, moduleShim.exports, require);
  return moduleShim.exports;
}

const defaultSubscription = {
  plan: 'free',
  startDate: null,
  endDate: null,
  paymentId: null,
  billingKey: null,
  nextBillingDate: null,
  status: 'none',
  payMethod: null,
  updatedAt: '2026-09-02T00:00:00.000Z',
};

loadSubscriptionDisplay().then(({
  canRequestSubscriptionRefundFromPolicy,
  resolveSubscriptionDisplay,
}) => {
  const developerEntitlement = {
    plan: 'developer',
    source: 'developer_grant',
    hasDeveloperGrant: true,
    hasPaidAccess: true,
  };
  const paidEntitlement = {
    plan: 'premium',
    source: 'paid_subscription',
    hasDeveloperGrant: false,
    hasPaidAccess: true,
  };

  assert.deepStrictEqual(
    resolveSubscriptionDisplay(defaultSubscription, developerEntitlement, { hasPaidPayment: false }),
    {
      planLabel: '개발자 우대',
      statusLabel: '결제 없음',
      amountLabel: '결제 없음',
      isDeveloperGrant: true,
    },
  );

  assert.deepStrictEqual(
    resolveSubscriptionDisplay(
      { ...defaultSubscription, plan: 'premium', status: 'active' },
      paidEntitlement,
      { hasPaidPayment: true, paidAmount: 6000 },
    ),
    {
      planLabel: '프리미엄',
      statusLabel: '이용 중',
      amountLabel: '6,000원',
      isDeveloperGrant: false,
    },
  );

  assert.strictEqual(canRequestSubscriptionRefundFromPolicy({
    eligibilityCanRequest: false,
    hasPaymentId: false,
    hasProcessingRefundRequest: false,
    latestRefundStatus: null,
  }), false);
  assert.strictEqual(canRequestSubscriptionRefundFromPolicy({
    eligibilityCanRequest: true,
    hasPaymentId: true,
    hasProcessingRefundRequest: false,
    latestRefundStatus: null,
  }), true);
  assert.strictEqual(canRequestSubscriptionRefundFromPolicy({
    eligibilityCanRequest: true,
    hasPaymentId: true,
    hasProcessingRefundRequest: true,
    latestRefundStatus: 'requested',
  }), false);
  assert.strictEqual(canRequestSubscriptionRefundFromPolicy({
    eligibilityCanRequest: true,
    hasPaymentId: true,
    hasProcessingRefundRequest: false,
    latestRefundStatus: 'refunded',
  }), false);

  console.log('subscription display policy tests passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
