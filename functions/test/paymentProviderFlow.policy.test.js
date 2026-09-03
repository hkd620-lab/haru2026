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
const initialBillingCompletionSection = section(indexSrc, 'async function completeInitialBillingSubscription', 'async function markInitialBillingPaymentPending');
const initialBillingAlreadyProcessedSection = section(indexSrc, 'async function isInitialBillingSubscriptionAlreadyProcessed', 'async function completeInitialBillingSubscription');
const initialBillingSettlementSection = section(indexSrc, 'async function settleInitialBillingPayment', 'type HaruLawSharePreview');
const subscriptionRedirectSection = section(subscriptionPageSrc, 'const redirectedCode = searchParams.get', 'const handleSubscribe = async');
const subscriptionHandleSection = section(subscriptionPageSrc, 'const handleSubscribe = async', 'const selected = PLANS');

assert(subscriptionPageSrc.includes("provider: 'kg_inicis'"));
assert(subscriptionPageSrc.includes("provider: 'kakaopay'"));
assert(!subscriptionPageSrc.includes('createClientPortOneRequestId'));
assert(subscriptionPageSrc.includes("const createSubscriptionBillingRequest = httpsCallable(functions, 'createSubscriptionBillingRequest')"));
assert(subscriptionPageSrc.includes("provider: paymentMethodConfig.provider"));
assert(subscriptionPageSrc.includes('issueId: billingRequest.issueId'));
assert(subscriptionPageSrc.includes('method=${selectedPaymentMethod}&issueId=${billingRequest.issueId}'));
assert(subscriptionPageSrc.includes('type SubscribeWithBillingKeyResult = {'));
assert(subscriptionPageSrc.includes('success: boolean;'));
assert(subscriptionPageSrc.includes('alreadyProcessed?: boolean;'));
assert(subscriptionPageSrc.includes('pending?: boolean;'));
assert(subscriptionPageSrc.includes('status?: string;'));
assert(subscriptionPageSrc.includes("const SUBSCRIPTION_PENDING_MESSAGE = '결제 상태를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.'"));
assert(subscriptionPageSrc.includes('function isSubscriptionPaymentComplete(result: SubscribeWithBillingKeyResult): boolean'));
assert(subscriptionPageSrc.includes('return result.success === true && result.pending !== true;'));
assert(subscriptionPageSrc.includes('httpsCallable<SubscribeWithBillingKeyRequest, SubscribeWithBillingKeyResult>'));
const frontendSubscriptionComplete = (result) => result.success === true && result.pending !== true;
assert.equal(frontendSubscriptionComplete({ success: true }), true);
assert.equal(frontendSubscriptionComplete({ success: true, alreadyProcessed: true }), true);
assert.equal(frontendSubscriptionComplete({ success: true, pending: true, status: 'PENDING' }), false);
assert.equal(frontendSubscriptionComplete({ success: false, status: 'FAILED' }), false);
assert.equal(frontendSubscriptionComplete({ success: false, status: 'CANCELLED' }), false);

assert(subscriptionRedirectSection.includes('.then((result) =>'));
assert(subscriptionRedirectSection.includes('const subscribeResult = result.data'));
assert(subscriptionRedirectSection.includes('if (subscribeResult.pending === true)'));
assert(subscriptionRedirectSection.includes('setResultMessage(SUBSCRIPTION_PENDING_MESSAGE)'));
const redirectPendingBranch = section(subscriptionRedirectSection, 'if (subscribeResult.pending === true)', 'if (!isSubscriptionPaymentComplete(subscribeResult))');
assert(!redirectPendingBranch.includes('결제가 완료되었습니다'));
assert(!redirectPendingBranch.includes('window.history.replaceState'));
assertBefore(subscriptionRedirectSection, 'if (subscribeResult.pending === true)', '결제가 완료되었습니다');
assertBefore(subscriptionRedirectSection, 'if (!isSubscriptionPaymentComplete(subscribeResult))', '결제가 완료되었습니다');
assertBefore(subscriptionRedirectSection, '결제가 완료되었습니다', 'window.history.replaceState');

assert(subscriptionHandleSection.includes('const subscribeResult = await subscribeWithBillingKey'));
assert(subscriptionHandleSection.includes('if (subscribeResult.data.pending === true)'));
assert(subscriptionHandleSection.includes('setResultMessage(SUBSCRIPTION_PENDING_MESSAGE)'));
const handlePendingBranch = section(subscriptionHandleSection, 'if (subscribeResult.data.pending === true)', 'if (!isSubscriptionPaymentComplete(subscribeResult.data))');
assert(!handlePendingBranch.includes('결제가 완료되었습니다'));
assertBefore(subscriptionHandleSection, 'if (subscribeResult.data.pending === true)', '결제가 완료되었습니다');
assertBefore(subscriptionHandleSection, 'if (!isSubscriptionPaymentComplete(subscribeResult.data))', '결제가 완료되었습니다');

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
assert(subscribeSection.includes("freshData.status === 'processed' || freshData.status === 'charging'"));
assert(subscribeSection.includes("return { action: 'settle_existing', paymentId: freshData.lastPaymentId }"));
assert(subscribeSection.includes("if (locked.action === 'settle_existing')"));
assert(subscribeSection.includes('existingPayment = await fetchPortOnePaymentWithRetry(paymentId)'));
assert(subscribeSection.includes("throw new HttpsError('unavailable', '기존 첫 결제 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.')"));
assert(!subscribeSection.includes('return { success: true, alreadyProcessed: true };\n    }\n\n    let payment'));
const settleExistingBranch = section(subscribeSection, "if (locked.action === 'settle_existing')", 'let payment: any;');
assert(settleExistingBranch.includes('isInitialBillingSubscriptionAlreadyProcessed'));
assert(settleExistingBranch.includes('return { success: true, alreadyProcessed: true }'));
assert(settleExistingBranch.includes('fetchPortOnePaymentWithRetry(paymentId)'));
assert(settleExistingBranch.includes('return settleInitialBillingPayment'));
assert(!settleExistingBranch.includes('axios.post'));
assertBefore(settleExistingBranch, 'isInitialBillingSubscriptionAlreadyProcessed', 'fetchPortOnePaymentWithRetry(paymentId)');
assertBefore(subscribeSection, "if (locked.action === 'settle_existing')", 'axios.post');
assert(subscribeSection.includes("status: 'charging'"));
assert(subscribeSection.includes("lastBillingError: e?.message || 'initial_billing_uncertain'"));
assert(subscribeSection.includes("throw new HttpsError('unavailable', '첫 결제 요청 결과를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.')"));

assert(initialBillingAlreadyProcessedSection.includes("requestData.status === 'processed'"));
assert(initialBillingAlreadyProcessedSection.includes("paymentData.status === 'processed'"));
assert(initialBillingAlreadyProcessedSection.includes("subscriptionData.status === 'active'"));
assert(initialBillingAlreadyProcessedSection.includes("billingData.status === 'active'"));
assert(initialBillingAlreadyProcessedSection.includes('subscriptionData.lastPaymentId === params.paymentId'));
assert(initialBillingAlreadyProcessedSection.includes('billingData.lastPaymentId === params.paymentId'));

assert(initialBillingCompletionSection.includes('tx.set(subRef'));
assert(initialBillingCompletionSection.includes('tx.set(billingRef'));
assert(initialBillingCompletionSection.includes('tx.set(params.requestRef'));
assert(initialBillingCompletionSection.includes('tx.set(params.paymentRef'));
assert(initialBillingCompletionSection.includes("status: 'active'"));
assert(initialBillingCompletionSection.includes("status: 'processed'"));
assert(initialBillingCompletionSection.includes('const subscriptionAlreadyActive'));
assert(initialBillingCompletionSection.includes('alreadyProcessed = true'));
assert(initialBillingCompletionSection.includes('requestData.lastPaymentId !== params.paymentId'));

assert(initialBillingSettlementSection.includes("if (portoneStatus === 'PAID')"));
assert(initialBillingSettlementSection.includes('completeInitialBillingSubscription(params)'));
assert(initialBillingSettlementSection.includes('? { success: true, alreadyProcessed: true }'));
assert(initialBillingSettlementSection.includes("if (isFailedOrCancelledPaymentStatus(portoneStatus))"));
assert(initialBillingSettlementSection.includes('await markInitialBillingPaymentFailed(params.requestRef, params.paymentRef, portoneStatus)'));
assert(initialBillingSettlementSection.includes("throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.')"));
assert(initialBillingSettlementSection.includes('await markInitialBillingPaymentPending(params.requestRef, params.paymentRef, portoneStatus)'));
assert(initialBillingSettlementSection.includes('return { success: false, pending: true, status: portoneStatus }'));
assert(!initialBillingSettlementSection.includes('axios.post'));

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
