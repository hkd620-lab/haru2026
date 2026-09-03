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
const createSubscriptionSection = section(indexSrc, 'export const createSubscriptionBillingRequest = onCall', 'export const recoverSubscriptionBillingRequest = onCall');
const recoverSubscriptionSection = section(indexSrc, 'export const recoverSubscriptionBillingRequest = onCall', '// ===== 💳 결제 검증 (PortOne V2) =====');
const subscriptionRedirectSection = section(subscriptionPageSrc, 'const redirectedCode = searchParams.get', 'const handleSubscribe = async');
const subscriptionHandleSection = section(subscriptionPageSrc, 'const handleSubscribe = async', 'const selected = PLANS');
const subscriptionConfirmSection = section(subscriptionPageSrc, 'const confirmPendingSubscription = async', 'useEffect(() => {\n    const plan = searchParams.get');
const subscriptionRetrySection = section(subscriptionPageSrc, 'const handleRetryPendingSubscription = async', 'const selected = PLANS');

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
assert(subscriptionPageSrc.includes('type PendingSubscriptionRecovery = {'));
assert(subscriptionPageSrc.includes('plan: PaidPlan;'));
assert(subscriptionPageSrc.includes('method: SubscriptionPaymentMethod;'));
assert(subscriptionPageSrc.includes('issueId: string;'));
assert(subscriptionPageSrc.includes('billingKey?: string;'));
assert(subscriptionPageSrc.includes("const SUBSCRIPTION_PENDING_MESSAGE = '결제 상태를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.'"));
assert(subscriptionPageSrc.includes("const SUBSCRIPTION_RECOVERY_STORAGE_KEY = 'haru.subscription.pendingBillingKey'"));
assert(subscriptionPageSrc.includes('window.sessionStorage.getItem(SUBSCRIPTION_RECOVERY_STORAGE_KEY)'));
assert(subscriptionPageSrc.includes('window.sessionStorage.setItem(SUBSCRIPTION_RECOVERY_STORAGE_KEY, JSON.stringify(recovery))'));
assert(subscriptionPageSrc.includes('window.sessionStorage.removeItem(SUBSCRIPTION_RECOVERY_STORAGE_KEY)'));
assert(!subscriptionPageSrc.includes('localStorage'));
assert(subscriptionPageSrc.includes('function isSubscriptionPaymentComplete(result: SubscribeWithBillingKeyResult): boolean'));
assert(subscriptionPageSrc.includes('return result.success === true && result.pending !== true;'));
assert(subscriptionPageSrc.includes('httpsCallable<SubscribeWithBillingKeyRequest, SubscribeWithBillingKeyResult>'));
assert(subscriptionPageSrc.includes("httpsCallable<Record<string, never>, RecoverSubscriptionBillingRequestResult>(functions, 'recoverSubscriptionBillingRequest')"));
const frontendSubscriptionComplete = (result) => result.success === true && result.pending !== true;
assert.equal(frontendSubscriptionComplete({ success: true }), true);
assert.equal(frontendSubscriptionComplete({ success: true, alreadyProcessed: true }), true);
assert.equal(frontendSubscriptionComplete({ success: true, pending: true, status: 'PENDING' }), false);
assert.equal(frontendSubscriptionComplete({ success: false, status: 'FAILED' }), false);
assert.equal(frontendSubscriptionComplete({ success: false, status: 'CANCELLED' }), false);

assert(subscriptionConfirmSection.includes('const result = recovery.billingKey'));
assert(subscriptionConfirmSection.includes('billingKey: recovery.billingKey'));
assert(subscriptionConfirmSection.includes('issueId: recovery.issueId'));
assert(subscriptionConfirmSection.includes('provider: paymentMethodConfig.provider'));
assert(subscriptionConfirmSection.includes('payMethod: paymentMethodConfig.payMethod'));
assert(subscriptionConfirmSection.includes("recoverSubscriptionBillingRequest')({})"));
assert(subscriptionConfirmSection.includes('if (subscribeResult.pending === true)'));
assert(subscriptionConfirmSection.includes('setResultMessage(SUBSCRIPTION_PENDING_MESSAGE)'));
const redirectPendingBranch = section(subscriptionConfirmSection, 'if (subscribeResult.pending === true)', 'if (!isSubscriptionPaymentComplete(subscribeResult))');
assert(!redirectPendingBranch.includes('결제가 완료되었습니다'));
assert(!redirectPendingBranch.includes('window.history.replaceState'));
assertBefore(subscriptionConfirmSection, 'if (subscribeResult.pending === true)', '결제가 완료되었습니다');
assertBefore(subscriptionConfirmSection, 'if (!isSubscriptionPaymentComplete(subscribeResult))', '결제가 완료되었습니다');
assertBefore(subscriptionConfirmSection, 'clearPendingSubscriptionRecovery();\n    setResultMessage', '결제가 완료되었습니다');
assert(subscriptionConfirmSection.includes('if (isTerminalSubscriptionStatus(subscribeResult.status))'));
assert(subscriptionConfirmSection.includes('clearPendingSubscriptionRecovery();'));

assert(subscriptionRedirectSection.includes('savePendingSubscriptionRecovery(recovery)'));
assert(subscriptionRedirectSection.includes('confirmPendingSubscription(recovery)'));
assertBefore(subscriptionRedirectSection, 'savePendingSubscriptionRecovery(recovery)', 'confirmPendingSubscription(recovery)');
assertBefore(subscriptionRedirectSection, 'confirmPendingSubscription(recovery)', 'window.history.replaceState');

assert(subscriptionHandleSection.includes('const existingRecovery = pendingSubscriptionRecovery || readPendingSubscriptionRecovery()'));
assert(subscriptionHandleSection.includes('setResultMessage(SUBSCRIPTION_PENDING_MESSAGE)'));
assertBefore(subscriptionHandleSection, 'const existingRecovery = pendingSubscriptionRecovery || readPendingSubscriptionRecovery()', "const createSubscriptionBillingRequest = httpsCallable(functions, 'createSubscriptionBillingRequest')");
assert(subscriptionHandleSection.includes('if (billingRequest.pending === true)'));
assertBefore(subscriptionHandleSection, 'if (billingRequest.pending === true)', 'requestIssueBillingKey');
assert(subscriptionHandleSection.includes('savePendingSubscriptionRecovery(recovery)'));
assert(subscriptionHandleSection.includes('await confirmPendingSubscription(recovery)'));
assertBefore(subscriptionHandleSection, 'savePendingSubscriptionRecovery(recovery)', 'await confirmPendingSubscription(recovery)');

assert(subscriptionRetrySection.includes('const recovery = pendingSubscriptionRecovery || readPendingSubscriptionRecovery()'));
assert(subscriptionRetrySection.includes('await confirmPendingSubscription(recovery)'));
assert(subscriptionRetrySection.includes('if (isTerminalSubscriptionError(error))'));
assert(subscriptionRetrySection.includes('clearPendingSubscriptionRecovery()'));
assert(!subscriptionRetrySection.includes('requestIssueBillingKey'));
assert(!subscriptionRetrySection.includes('createSubscriptionBillingRequest'));
assert(subscriptionPageSrc.includes('hasPendingSubscriptionRecovery ? \'기존 정기결제 상태 확인 필요\''));
assert(subscriptionPageSrc.includes('결제 상태 다시 확인'));

assert(indexSrc.includes('function getSubscriptionPaymentLockRef(uid: string)'));
assert(indexSrc.includes('return db.doc(`subscriptionPaymentLocks/${uid}`)'));
assert(createSubscriptionSection.includes('const lockRef = getSubscriptionPaymentLockRef(uid)'));
assert(createSubscriptionSection.includes('return db.runTransaction(async (tx) =>'));
assert(createSubscriptionSection.includes('tx.get(lockRef)'));
assert(createSubscriptionSection.includes('tx.get(subscriptionRef)'));
assert(createSubscriptionSection.includes('isActiveSubscriptionData(subscriptionData, nowMs)'));
assert(createSubscriptionSection.includes("throw new HttpsError('failed-precondition', '이미 활성화된 정기구독이 있습니다.')"));
assert(createSubscriptionSection.includes('return buildSubscriptionBillingRequestResponse({'));
assert(createSubscriptionSection.includes('existing: true'));
assert(createSubscriptionSection.includes('pending: true'));
assert(createSubscriptionSection.includes('tx.set(newRequestRef'));
assert(createSubscriptionSection.includes('tx.set(lockRef'));

assert(recoverSubscriptionSection.includes('const lockRef = getSubscriptionPaymentLockRef(uid)'));
assert(recoverSubscriptionSection.includes('const requestRef = getPaymentRequestRef(issueId)'));
assert(recoverSubscriptionSection.includes('requestData.uid !== uid'));
assert(recoverSubscriptionSection.includes('const lastPaymentId = typeof requestData.lastPaymentId'));
assert(recoverSubscriptionSection.includes('fetchPortOnePaymentWithRetry(lastPaymentId)'));
assert(recoverSubscriptionSection.includes('return settleInitialBillingPayment({'));
assert(recoverSubscriptionSection.includes('await lockRef.delete()'));
assert(!recoverSubscriptionSection.includes('return { billingKey'));

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
assert(subscribeSection.includes("action: 'settle_existing'"));
assert(subscribeSection.includes('customer: getStoredSubscriptionBillingCustomer(freshData)'));
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
assert(subscribeSection.includes('const billingError = getPortOneBillingErrorSummary(e)'));
assert(subscribeSection.includes('if (billingError.terminal)'));
assert(subscribeSection.includes("throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.')"));
assert(subscribeSection.includes("throw new HttpsError('unavailable', '첫 결제 요청 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.')"));

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
assert(initialBillingSettlementSection.includes('await markInitialBillingPaymentFailed(params.requestRef, params.paymentRef, portoneStatus, params.lockRef)'));
assert(initialBillingSettlementSection.includes("throw new HttpsError('failed-precondition', '첫 결제가 실패 또는 취소되었습니다.')"));
assert(initialBillingSettlementSection.includes('await markInitialBillingPaymentPending(params.requestRef, params.paymentRef, portoneStatus, params.lockRef)'));
assert(initialBillingSettlementSection.includes('return { success: false, pending: true, status: portoneStatus }'));
assert(!initialBillingSettlementSection.includes('axios.post'));

assert(recurringSection.includes('shouldExcludeFromRecurringBilling(uid)'));
assert(recurringSection.includes('const provider = getStoredPaymentProvider(data)'));
assertBefore(recurringSection, 'shouldExcludeFromRecurringBilling(uid)', 'const provider = getStoredPaymentProvider(data)');
assert(recurringSection.includes('provider,'));
assert(recurringSection.includes('payMethod,'));
assert(recurringSection.includes('const customer = getStoredSubscriptionBillingCustomer(data)'));
assert(recurringSection.includes('missing_recurring_customer_info'));
assert(recurringSection.includes('buildPortOneBillingKeyPaymentPayload({'));
assert(recurringSection.includes('customer: lockedCustomer'));
assert(recurringSection.includes('const billingError = getPortOneBillingErrorSummary(error)'));

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
