const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const subscriptionPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SubscriptionPage.tsx'), 'utf8');
const singlePaymentPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SinglePaymentPage.tsx'), 'utf8');

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
  assert(
    earlierIndex < laterIndex,
    `expected "${earlier}" before "${later}"`,
  );
}

const subscribeSection = section(indexSrc, 'export const subscribeWithBillingKey = onCall', '// ===== 💳 정기구독 해지 =====');
const recurringSection = section(indexSrc, 'export const processRecurringSubscriptions = onSchedule', '// ===== 💳 일반(단건) 1개월 이용권 검증 =====');
const verifySingleSection = section(indexSrc, 'export const verifySinglePayment = onCall', '// ===== 💳 PortOne V2 결제 웹훅 =====');
const webhookSection = section(indexSrc, 'export const portoneWebhook = onRequest', '// ===== 🗑️ 일회성 마이그레이션');

assert(subscriptionPageSrc.includes("provider: 'kg_inicis'"));
assert(subscriptionPageSrc.includes("provider: 'kakaopay'"));
assert(!subscriptionPageSrc.includes('createClientPortOneRequestId'));
assert(subscriptionPageSrc.includes("const createSubscriptionBillingRequest = httpsCallable(functions, 'createSubscriptionBillingRequest')"));
assert(subscriptionPageSrc.includes("provider: paymentMethodConfig.provider"));
assert(subscriptionPageSrc.includes('issueId: billingRequest.issueId'));
assert(subscriptionPageSrc.includes('method=${selectedPaymentMethod}&issueId=${billingRequest.issueId}'));

assert(singlePaymentPageSrc.includes("provider: 'kg_inicis'"));
assert(singlePaymentPageSrc.includes("const KG_INICIS_SINGLE_PAYMENT_PAY_METHOD = 'CARD'"));
assert(singlePaymentPageSrc.includes("const createSinglePaymentRequest = httpsCallable(functions, 'createSinglePaymentRequest')"));
assert(singlePaymentPageSrc.includes("const paymentRequest = requestResult.data as SinglePaymentRequestResult"));
assert(singlePaymentPageSrc.includes('paymentId: paymentRequest.paymentId'));
assert(singlePaymentPageSrc.includes('payMethod: KG_INICIS_SINGLE_PAYMENT_PAY_METHOD'));
assert(!singlePaymentPageSrc.includes("import.meta.env.VITE_PORTONE_SINGLE_PAYMENT_PAY_METHOD || 'EASY_PAY'"));
assert(!singlePaymentPageSrc.includes('`haru-single-${Date.now()}-${Math.random()'));
assert(!singlePaymentPageSrc.includes('verifySinglePayment({ paymentId: completedPaymentId, plan: selectedPlan })'));

assert(subscribeSection.includes("throw new HttpsError('invalid-argument', 'issueId가 필요합니다.')"));
assert(subscribeSection.includes('const requestRef = getPaymentRequestRef(issueId)'));
assert(subscribeSection.includes("requestData.uid !== uid || requestData.paymentType !== 'subscription' || requestData.billingType !== 'billing_key_issue'"));
assert(subscribeSection.includes('const plan = assertPaidPlan(requestData.plan)'));
assert(subscribeSection.includes('const provider = getStoredPaymentProvider(requestData)'));
assert(subscribeSection.includes("freshData.status === 'processed' && freshData.lastPaymentId"));
assert(subscribeSection.includes("freshData.status === 'charging' && freshData.lastPaymentId"));
assertBefore(subscribeSection, "freshData.status === 'charging' && freshData.lastPaymentId", 'axios.post');

assert(recurringSection.includes('shouldExcludeFromRecurringBilling(uid)'));
assert(recurringSection.includes('const provider = getStoredPaymentProvider(data)'));
assertBefore(recurringSection, 'shouldExcludeFromRecurringBilling(uid)', 'const provider = getStoredPaymentProvider(data)');
assert(recurringSection.includes('provider,'));
assert(recurringSection.includes('payMethod,'));

assert(verifySingleSection.includes('const orderRef = getPaymentRequestRef(paymentId)'));
assert(verifySingleSection.includes('if (!orderSnap.exists || orderSnap.data()?.uid !== uid)'));
assert(verifySingleSection.includes('const requestedPlan = assertPaidPlan(orderData.plan)'));
assert(!verifySingleSection.includes('directPlan'));
assert(!verifySingleSection.includes('!orderExists'));

assert(webhookSection.includes("freshOrderData?.paymentType === 'one_time'"));
assert(webhookSection.includes("freshOrderData?.billingType === 'single'"));
assert(webhookSection.includes('tx.set(db.doc(`users/${uid}/subscription/info`)'));
assert(webhookSection.includes('tx.set(singlePaymentRef'));
assert(webhookSection.includes('const provider = getStoredPaymentProvider(freshOrderData)'));

console.log('payment provider flow policy tests passed');
