const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, 'functions/src/subscriptionBillingCore.ts'), 'utf8');
const firestoreRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

let core;
try {
  core = require('../lib/subscriptionBillingCore');
} catch {
  throw new Error('Run `npm run build` before `npm run test:initial-billing-paid-settlement`.');
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

const directPayment = { id: 'payment-direct', status: 'PAID', amount: { total: 4000 }, currency: 'KRW' };
const wrappedPayment = { payment: { id: 'payment-wrapped', status: 'PAID', amount: { total: 4000 }, currency: 'KRW' } };
assert.strictEqual(core.normalizePortOnePaymentResponse(directPayment), directPayment);
assert.strictEqual(core.normalizePortOnePaymentResponse(wrappedPayment), wrappedPayment.payment);
assert.equal(core.getPortOnePaymentStatus(directPayment), 'PAID');
assert.equal(core.getPortOnePaymentStatus(wrappedPayment), 'PAID');
assert.equal(core.getPortOnePaymentStatus({ payment: { id: 'payment-unknown' } }), 'UNKNOWN');
assert.equal(core.getPortOnePaymentId({ payment: { paymentId: 'payment-id-field' } }), 'payment-id-field');
assert.equal(core.getPortOnePaymentId({ payment: { id: 'payment-id-only' } }), 'payment-id-only');

const payload = core.buildPortOneBillingKeyPaymentPayload({
  storeId: 'store-id',
  billingKey: 'billing-key',
  orderName: 'HARU Basic',
  amount: 4000,
  currency: 'KRW',
  customer: {
    name: 'Haru User',
    email: 'haru@example.com',
    phoneNumber: '01012345678',
  },
  customData: {
    uid: 'uid-1',
    issueId: 'issue-1',
    plan: 'basic',
    provider: 'kakaopay',
    paymentType: 'subscription',
    billingType: 'initial_billing',
  },
});
assert.notEqual(typeof payload.customer.name, 'string');
assert.equal(payload.customer.name.full, 'Haru User');
assert.equal(payload.customer.email, 'haru@example.com');
assert.equal(payload.customer.phoneNumber, '01012345678');
assert.equal(typeof payload.customData, 'string');
assert.deepStrictEqual(JSON.parse(payload.customData), {
  uid: 'uid-1',
  issueId: 'issue-1',
  plan: 'basic',
  provider: 'kakaopay',
  paymentType: 'subscription',
  billingType: 'initial_billing',
});

assert(coreSrc.includes('export function normalizePortOnePaymentResponse'));
assert(coreSrc.includes('response.payment'));
assert(coreSrc.includes('export function getPortOnePaymentStatus'));
assert(coreSrc.includes('export function getPortOnePaymentId'));

const assertPaymentMatchesRequestSection = section(
  indexSrc,
  'function assertPaymentMatchesRequest(payment: any, requestData: any)',
  'function getPaymentRequestRef(id: string)',
);
assert(assertPaymentMatchesRequestSection.includes('const normalizedPayment = normalizePortOnePaymentResponse(payment)'));
assert(assertPaymentMatchesRequestSection.includes('const expectedPaymentId = typeof requestData.paymentId'));
assert(assertPaymentMatchesRequestSection.includes('const actualPaymentId = getPortOnePaymentId(normalizedPayment)'));
assert(assertPaymentMatchesRequestSection.includes('actualPaymentId !== expectedPaymentId'));
assert(assertPaymentMatchesRequestSection.includes('customData.issueId && requestData.issueId && customData.issueId !== requestData.issueId'));
assert(assertPaymentMatchesRequestSection.includes('customData.uid && customData.uid !== requestData.uid'));
assert(assertPaymentMatchesRequestSection.includes('customData.plan && customData.plan !== requestData.plan'));
assert(assertPaymentMatchesRequestSection.includes('customData.provider && requestData.provider && customData.provider !== requestData.provider'));

const fetchPortOnePaymentSection = section(
  indexSrc,
  'async function fetchPortOnePayment(paymentId: string): Promise<any>',
  'async function fetchPortOnePaymentWithRetry(paymentId: string): Promise<any>',
);
assert(fetchPortOnePaymentSection.includes('return normalizePortOnePaymentResponse(portoneRes.data)'));

const initialSettlementSection = section(
  indexSrc,
  'async function settleInitialBillingPayment(params: InitialBillingCompletionParams)',
  'async function settleInitialBillingPaymentFromStoredRequest',
);
assert(initialSettlementSection.includes('const payment = normalizePortOnePaymentResponse(params.payment)'));
assert(initialSettlementSection.includes('const portoneStatus = getPortOnePaymentStatus(payment)'));
assert(initialSettlementSection.includes("if (portoneStatus === 'PAID')"));
assert(initialSettlementSection.includes('assertPaymentMatchesRequest(payment, paymentData)'));
assert(initialSettlementSection.includes('completeInitialBillingSubscription({ ...params, payment })'));
assertBefore(initialSettlementSection, "if (portoneStatus === 'PAID')", 'cleanupInitialBillingKeyAfterInitialChargeFailure({');
assert(!initialSettlementSection.includes('axios.post'));

const storedInitialSettlementSection = section(
  indexSrc,
  'async function settleInitialBillingPaymentFromStoredRequest',
  'async function settleRecurringBillingPayment',
);
assert(storedInitialSettlementSection.includes("paymentData.paymentType !== 'subscription' || paymentData.billingType !== 'initial_billing'"));
assert(storedInitialSettlementSection.includes("if (portoneStatus !== 'PAID')"));
assert(storedInitialSettlementSection.includes('assertPaymentMatchesRequest(payment, paymentData)'));
assert(storedInitialSettlementSection.includes("requestData.billingType !== 'billing_key_issue'"));
assert(storedInitialSettlementSection.includes('requestData.lastPaymentId !== params.paymentId'));
assert(storedInitialSettlementSection.includes('requestData.amount !== amount'));
assert(storedInitialSettlementSection.includes("requestData.currency !== 'KRW'"));
assert(storedInitialSettlementSection.includes('requestProvider !== provider'));
assert(storedInitialSettlementSection.includes('requestPayMethod !== payMethod'));
assert(storedInitialSettlementSection.includes('isInitialBillingSubscriptionAlreadyProcessed({'));
assert(storedInitialSettlementSection.includes('return { handled: true, success: true, alreadyProcessed: true, status: portoneStatus }'));
assert(storedInitialSettlementSection.includes('getStoredSubscriptionBillingCustomer(requestData)'));
assert(storedInitialSettlementSection.includes('return { handled: true, success: false, pending: true, status: portoneStatus }'));
assert(storedInitialSettlementSection.includes('const settlement = await settleInitialBillingPayment({'));
assert(!storedInitialSettlementSection.includes('axios.post'));
assert(!storedInitialSettlementSection.includes('cleanupInitialBillingKeyAfterInitialChargeFailure'));

const recurringSettlementSection = section(
  indexSrc,
  'async function settleRecurringBillingPayment(params: {',
  'type HaruLawSharePreview',
);
assert(recurringSettlementSection.includes('const payment = normalizePortOnePaymentResponse(params.payment)'));
assert(recurringSettlementSection.includes('const portoneStatus = getPortOnePaymentStatus(payment)'));
assert(recurringSettlementSection.includes('assertPaymentMatchesRequest(payment, paymentData)'));

const subscribeSection = section(indexSrc, 'export const subscribeWithBillingKey = onCall', '// ===== 💳 정기구독 해지 =====');
assert(subscribeSection.includes('payment = normalizePortOnePaymentResponse(portoneRes.data)'));
assert(subscribeSection.includes('return settleInitialBillingPayment({'));
assert(!section(subscribeSection, "if (locked.action === 'settle_existing')", 'let payment: any;').includes('axios.post'));

const recurringScheduleSection = section(indexSrc, 'export const processRecurringSubscriptions = onSchedule', '// ===== 💳 일반(단건) 1개월 이용권 검증 =====');
assert(recurringScheduleSection.includes('const payment = normalizePortOnePaymentResponse(portoneRes.data)'));

const webhookSection = section(indexSrc, 'export const portoneWebhook = onRequest', '// ===== 🗑️ 일회성 마이그레이션');
assert(webhookSection.includes("webhook.type === 'Transaction.Paid'"));
assert(webhookSection.includes("duplicateOrderData?.billingType === 'initial_billing'"));
assert(webhookSection.includes("orderData?.billingType === 'initial_billing'"));
assert(webhookSection.includes('settleInitialBillingPaymentFromStoredRequest({'));
assert(webhookSection.includes('initialBillingSettlementHandled'));
assert(webhookSection.includes('initialBillingSettlementAlreadyProcessed'));
assert(webhookSection.includes('PortOne initial billing 웹훅 중복 수신 후 정산 복구 실패'));
assert(webhookSection.includes('PortOne initial billing 웹훅 정산 실패'));
const freshWebhookInitialSettlementSection = section(
  webhookSection,
  'let payment: any;',
  "if (orderData?.paymentType === 'subscription' && orderData?.billingType === 'recurring')",
);
assertBefore(freshWebhookInitialSettlementSection, 'payment = await fetchPortOnePaymentWithRetry(paymentId)', 'settleInitialBillingPaymentFromStoredRequest({');
assert(!freshWebhookInitialSettlementSection.includes('axios.post'));

const recoverSection = section(indexSrc, 'export const recoverSubscriptionBillingRequest = onCall', '// ===== 💳 결제 검증 (PortOne V2) =====');
assert(recoverSection.includes('fetchPortOnePaymentWithRetry(lastPaymentId)'));
assert(recoverSection.includes('return settleInitialBillingPayment({'));
assert(!recoverSection.includes('axios.post'));
assert(!recoverSection.includes('return { billingKey'));

const settlementLogText = loggerSnippets(initialSettlementSection + storedInitialSettlementSection + webhookSection).join('\n---\n');
assert(!settlementLogText.includes('params.billingKey'));
assert(!settlementLogText.includes('billingKey:'));
assert(!settlementLogText.includes('billingKeyHash'));

assert(firestoreRules.includes('match /users/{userId}/records/{recordId}'));

console.log('initial billing paid settlement policy tests passed');
