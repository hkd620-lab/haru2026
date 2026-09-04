const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, 'functions/src/subscriptionBillingCore.ts'), 'utf8');
const subscriptionPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SubscriptionPage.tsx'), 'utf8');
const refundsSrc = fs.readFileSync(path.join(root, 'functions/src/subscriptionRefunds.ts'), 'utf8');

let core;
try {
  core = require('../lib/subscriptionBillingCore');
} catch (error) {
  throw new Error('Run `npm run build` before `npm run test:payment-method-normalization`.');
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

const kgInicisKakaoPay = core.buildNormalizedPaymentMethodFields({
  selectedChannel: {
    pgProvider: 'INICIS_V2',
    id: 'channel-kg-billing',
  },
  method: {
    type: 'EASY_PAY',
    provider: 'KAKAOPAY',
    easyPayMethod: {
      type: 'CARD',
      card: {
        issuer: 'SHINHAN_CARD',
      },
    },
  },
});
assert.deepStrictEqual(kgInicisKakaoPay, {
  pgProvider: 'kg_inicis',
  payMethodType: 'easy_pay',
  easyPayProvider: 'kakao_pay',
  cardCompany: 'shinhan_card',
  paymentChannelId: 'channel-kg-billing',
});

const cardPayment = core.buildNormalizedPaymentMethodFields({
  selectedChannel: {
    provider: 'KG_INICIS',
    id: 'channel-card',
  },
  method: {
    type: 'CARD',
    card: {
      publisher: { code: 'HYUNDAI_CARD' },
    },
  },
});
assert.deepStrictEqual(cardPayment, {
  pgProvider: 'kg_inicis',
  payMethodType: 'card',
  easyPayProvider: null,
  cardCompany: 'hyundai_card',
  paymentChannelId: 'channel-card',
});

const unknownPayment = core.buildNormalizedPaymentMethodFields({
  method: {
    type: 'EASY_PAY',
  },
});
assert.deepStrictEqual(unknownPayment, {
  pgProvider: null,
  payMethodType: 'easy_pay',
  easyPayProvider: null,
  cardCompany: null,
  paymentChannelId: null,
});

assert.equal(core.getRecurringBillingPeriodKey('2026-09-04T00:00:00.000Z'), '2026-09-04');
assert.equal(core.getRecurringBillingPeriodKey('bad period !!'), 'bad_period');
const recurringPaymentId = core.createDeterministicRecurringPaymentId('uid-1', '2026-09-04');
assert.equal(recurringPaymentId, core.createDeterministicRecurringPaymentId('uid-1', '2026-09-04'));
assert.notEqual(recurringPaymentId, core.createDeterministicRecurringPaymentId('uid-1', '2026-10-04'));
assert.notEqual(recurringPaymentId, core.createDeterministicRecurringPaymentId('uid-2', '2026-09-04'));
assert.equal(recurringPaymentId.length, 50);
assert(/^haru-recurring-2026-09-04-[a-f0-9]{24}$/.test(recurringPaymentId));
assert(recurringPaymentId.length < 100);

assert(coreSrc.includes('export type NormalizedPaymentMethod = {'));
assert(coreSrc.includes('pgProvider: string | null;'));
assert(coreSrc.includes("payMethod: NormalizedPaymentMethodType;"));
assert(coreSrc.includes('easyPayProvider: string | null;'));
assert(coreSrc.includes('cardCompany: string | null;'));
assert(coreSrc.includes('channelId: string | null;'));
assert(coreSrc.includes('export function buildNormalizedPaymentMethodFields'));
assert(coreSrc.includes('export function getRecurringBillingPeriodKey'));
assert(coreSrc.includes('export function createDeterministicRecurringPaymentId'));
assert(coreSrc.includes(".slice(0, 24)"));
assert(coreSrc.includes('payMethodType: normalized.payMethod'));
assert(!coreSrc.includes("return 'kakao_pay';\n  }\n  return 'kg_inicis';"));

const handleSubscribeSection = section(subscriptionPageSrc, 'const handleSubscribe = async', 'const selected = PLANS');
const kakaoChannelSection = section(
  handleSubscribeSection,
  "if (selectedPaymentMethod === 'kakaopay') {",
  "      } else {\n        channelKey = import.meta.env.VITE_PORTONE_INICIS_BILLING_CHANNEL_KEY",
);
assert(kakaoChannelSection.includes('VITE_PORTONE_KAKAOPAY_BILLING_CHANNEL_KEY'));
assert(!kakaoChannelSection.includes('VITE_PORTONE_KAKAOPAY_CHANNEL_KEY'));
assert(!kakaoChannelSection.includes('VITE_PORTONE_CHANNEL_KEY'));
assert(kakaoChannelSection.includes('setResultMessage(KAKAOPAY_BILLING_UNAVAILABLE_MESSAGE)'));
assertBefore(handleSubscribeSection, "if (selectedPaymentMethod === 'kakaopay')", "const createSubscriptionBillingRequest = httpsCallable(functions, 'createSubscriptionBillingRequest')");

const completionSection = section(indexSrc, 'async function completeInitialBillingSubscription', 'async function markInitialBillingPaymentPending');
const requestChargingWriteSection = section(indexSrc, 'tx.set(requestRef, {', 'tx.set(lockRef, {');
const recurringSection = section(indexSrc, 'export const processRecurringSubscriptions = onSchedule', '// ===== 💳 일반(단건) 1개월 이용권 검증 =====');
const recurringSettlementSection = section(indexSrc, 'async function settleRecurringBillingPayment', 'type HaruLawSharePreview');
const webhookSection = section(indexSrc, 'export const portoneWebhook = onRequest', '// ===== 🗑️ 일회성 마이그레이션');

assert(completionSection.includes('const paymentMethodFields = getPortOnePaymentMethodWriteFields(params.payment)'));
assert(completionSection.includes('billingKeyIssued: true'));
assert(completionSection.includes('...paymentMethodFields'));
assert(requestChargingWriteSection.includes('billingKeyIssuedAt'));
assert(!requestChargingWriteSection.includes('billingKey,'));
assert(!indexSrc.includes('billingKeyId'));

assert(recurringSection.includes('const paymentId = createRecurringPaymentId(uid, billingPeriod)'));
assert(recurringSection.includes("status: 'processing'"));
assert(recurringSection.includes("action: 'recover'"));
assert(recurringSection.includes('fetchPortOnePaymentWithRetry(recurringAction.paymentId)'));
assert(recurringSection.includes("'Idempotency-Key': createPortOneIdempotencyKey(recurringAction.paymentId)"));
assertBefore(recurringSection, 'tx.set(paymentRef, {', 'axios.post');
assert(recurringSettlementSection.includes("if (portoneStatus === 'PAID')"));
assert(recurringSettlementSection.includes('billingSettlementApplied'));
assert(recurringSettlementSection.includes('isPaidRecurringAttempt(freshPaymentData)'));
assert(!recurringSettlementSection.includes('billingKey:'));

assert(webhookSection.includes("orderData?.paymentType === 'subscription' && orderData?.billingType === 'recurring'"));
assert(webhookSection.includes('await settleRecurringBillingPayment({'));
assert(webhookSection.includes("processedBy: 'webhook'"));
assert(webhookSection.includes('recurringSettlementAlreadyProcessed'));

assert(refundsSrc.includes("import { buildNormalizedPaymentMethodFields } from './subscriptionBillingCore';"));
assert(refundsSrc.includes('const paymentMethodFields = buildNormalizedPaymentMethodFields(payment)'));
assert(refundsSrc.includes('...paymentMethodFields'));

console.log('payment method normalization policy tests passed');
