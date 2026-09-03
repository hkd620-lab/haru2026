const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, 'functions/src/subscriptionBillingCore.ts'), 'utf8');
const subscriptionPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SubscriptionPage.tsx'), 'utf8');
const firestoreRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

let core;
try {
  core = require('../lib/subscriptionBillingCore');
} catch (error) {
  throw new Error('Run `npm run build` before `npm run test:subscription-billing-customer`.');
}

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

function assertPolicyError(fn, policyCode) {
  assert.throws(fn, (error) => error?.policyCode === policyCode);
}

const createSection = section(indexSrc, 'export const createSubscriptionBillingRequest = onCall', 'export const recoverSubscriptionBillingRequest = onCall');
const recoverSection = section(indexSrc, 'export const recoverSubscriptionBillingRequest = onCall', '// ===== 💳 결제 검증 (PortOne V2) =====');
const subscribeSection = section(indexSrc, 'export const subscribeWithBillingKey = onCall', '// ===== 💳 정기구독 해지 =====');
const recurringSection = section(indexSrc, 'export const processRecurringSubscriptions = onSchedule', '// ===== 💳 일반(단건) 1개월 이용권 검증 =====');
const completionSection = section(indexSrc, 'async function completeInitialBillingSubscription', 'async function markInitialBillingPaymentPending');
const userSubscriptionWriteSection = section(completionSection, 'tx.set(subRef', 'tx.set(billingRef');
const failedSection = section(indexSrc, 'async function markInitialBillingPaymentFailed', 'async function markSubscriptionBillingRequestPreflightFailed');

const normalizedCustomer = core.normalizeSubscriptionBillingCustomer({
  name: '  Haru   Test  ',
  email: 'USER@Example.COM ',
  phoneNumber: '010-1234-5678',
});
assert.deepStrictEqual(normalizedCustomer, {
  name: 'Haru Test',
  email: 'user@example.com',
  phoneNumber: '01012345678',
});
assertPolicyError(() => core.normalizeSubscriptionBillingCustomer({}), 'customer_name_required');
assertPolicyError(() => core.normalizeSubscriptionBillingCustomer({
  name: 'Haru',
  email: 'not-an-email',
  phoneNumber: '01012345678',
}), 'customer_email_invalid');
assertPolicyError(() => core.normalizeSubscriptionBillingCustomer({
  name: 'Haru',
  email: 'user@example.com',
  phoneNumber: '1234',
}), 'customer_phone_invalid');

const payload = core.buildPortOneBillingKeyPaymentPayload({
  storeId: 'store-id',
  billingKey: 'billing-key',
  orderName: 'HARU Premium',
  amount: 9900,
  currency: 'KRW',
  customer: normalizedCustomer,
  customData: {
    uid: 'uid-1',
    plan: 'premium',
    provider: 'kg_inicis',
    paymentType: 'subscription',
  },
});
assert.deepStrictEqual(payload.amount, { total: 9900 });
assert.deepStrictEqual(payload.customer, normalizedCustomer);
assert.equal(JSON.parse(payload.customData).provider, 'kg_inicis');

const invalidRequest = core.getPortOneBillingErrorSummary({
  response: { status: 400, data: { type: 'INVALID_REQUEST', message: 'missing customer' } },
});
assert.equal(invalidRequest.terminal, true);
assert.equal(invalidRequest.portoneStatus, 'FAILED');
assert.equal(invalidRequest.safeReason, 'INVALID_REQUEST');

const portoneOutage = core.getPortOneBillingErrorSummary({
  response: { status: 503, data: { type: 'PORTONE_UNAVAILABLE' } },
});
assert.equal(portoneOutage.terminal, false);
assert.equal(portoneOutage.portoneStatus, 'UNKNOWN');

assert(coreSrc.includes('const CUSTOMER_NAME_MAX_LENGTH = 80'));
assert(coreSrc.includes('const CUSTOMER_EMAIL_MAX_LENGTH = 254'));
assert(coreSrc.includes('const CUSTOMER_PHONE_MIN_DIGITS = 10'));
assert(coreSrc.includes('const CUSTOMER_PHONE_MAX_DIGITS = 15'));
assert(coreSrc.includes("normalizedType === 'INVALID_REQUEST'"));

assert(createSection.includes('normalizeSubscriptionBillingCustomer(request.data?.customer)'));
assert(createSection.includes('customer,'));
assert(createSection.includes("throw new HttpsError('invalid-argument', '구매자 정보가 올바르지 않습니다.')"));
assertBefore(createSection, 'normalizeSubscriptionBillingCustomer(request.data?.customer)', 'tx.set(newRequestRef');
assertBefore(createSection, 'normalizeSubscriptionBillingCustomer(request.data?.customer)', 'tx.set(lockRef');

assert(subscriptionPageSrc.includes('customer: {\n          name: trimmedName,\n          email: trimmedEmail,\n          phoneNumber: normalizedPhone,\n        },'));
assert(subscriptionPageSrc.includes('customer: {\n          fullName: trimmedName,\n          email: trimmedEmail,\n          phoneNumber: normalizedPhone,\n        },'));

assert(subscribeSection.includes('const requestCustomer = getStoredSubscriptionBillingCustomer(requestData)'));
assert(subscribeSection.includes("markSubscriptionBillingRequestPreflightFailed(requestRef, lockRef, 'missing_customer_info')"));
assert(subscribeSection.includes('assertStoredSubscriptionBillingCustomer(freshData)'));
assert(subscribeSection.includes('buildPortOneBillingKeyPaymentPayload({'));
assert(subscribeSection.includes('customer: locked.customer'));
assert(!subscribeSection.includes('request.data?.customer'));
assertBefore(subscribeSection, "markSubscriptionBillingRequestPreflightFailed(requestRef, lockRef, 'missing_customer_info')", 'axios.post');
assertBefore(subscribeSection, 'assertStoredSubscriptionBillingCustomer(freshData)', 'tx.set(newPaymentRef');
assertBefore(subscribeSection, 'customer: locked.customer', 'customData: {');

assert(recoverSection.includes('const customer = getStoredSubscriptionBillingCustomer(requestData)'));
assert(recoverSection.includes('await markInitialBillingPaymentFailed(requestRef, paymentRef, existingPayment?.status || \'UNKNOWN\', lockRef)'));
assert(recoverSection.includes('customer,'));

assert(completionSection.includes('customer: params.customer'));
assert(userSubscriptionWriteSection.includes('tx.set(subRef'));
assert(!userSubscriptionWriteSection.includes('customer'));

assert(recurringSection.includes('const customer = getStoredSubscriptionBillingCustomer(data)'));
assert(recurringSection.includes("lastBillingError: !billingKey || !plan"));
assert(recurringSection.includes("'missing_recurring_customer_info'"));
assert(recurringSection.includes('const freshCustomer = getStoredSubscriptionBillingCustomer(freshData)'));
assert(recurringSection.includes('customer: lockedCustomer'));
assert(recurringSection.includes('billingRef.set({ ...update, billingKey, customer: lockedCustomer }'));
assertBefore(recurringSection, "'missing_recurring_customer_info'", 'axios.post');

assert(subscribeSection.includes('const billingError = getPortOneBillingErrorSummary(e)'));
assert(subscribeSection.includes('if (billingError.terminal)'));
assert(subscribeSection.includes("throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.')"));
assert(subscribeSection.includes("throw new HttpsError('unavailable', '첫 결제 요청 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.')"));
assertBefore(subscribeSection, 'if (billingError.terminal)', "throw new HttpsError('unavailable', '첫 결제 요청 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.')");

assert(subscribeSection.includes("lockRef.set({\n          status: 'charging',\n          lastPaymentId: paymentId"));
assert(subscribeSection.includes("portoneStatus: billingError.portoneStatus"));
assert(failedSection.includes("status: 'failed'"));
assert(failedSection.includes('lockRef.delete()'));
assertBefore(subscribeSection, 'await markInitialBillingPaymentFailed(requestRef, paymentRef, billingError.portoneStatus, lockRef)', "throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.')");

assert(recurringSection.includes('if (billingError.terminal)'));
assert(recurringSection.includes("status: 'needs_attention'"));
assert(recurringSection.includes("status: 'charging'"));
assert(recurringSection.includes('billingLockUntil: null'));

const billingLogText = loggerSnippets([createSection, recoverSection, subscribeSection, recurringSection, completionSection].join('\n')).join('\n---\n');
assert(!/\bcustomer\b/.test(billingLogText));
assert(!/\bemail\b/.test(billingLogText));
assert(!/\bphoneNumber\b/.test(billingLogText));
assert(!/\bbillingKey\b/.test(billingLogText));

assert(firestoreRules.includes('match /paymentRequests/{paymentId}'));
assert(firestoreRules.includes('match /billingSubscriptions/{uid}'));
assert(firestoreRules.includes('match /subscriptionPaymentLocks/{uid}'));
assert(firestoreRules.includes('allow read, write: if false;'));

console.log('subscription billing customer policy tests passed');
