const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');
const subscriptionPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SubscriptionPage.tsx'), 'utf8');
const firestoreRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

let core;
try {
  core = require('../lib/subscriptionBillingCore');
} catch {
  throw new Error('Run `npm run build` before `npm run test:subscription-payment-locks`.');
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

const createSection = section(indexSrc, 'export const createSubscriptionBillingRequest = onCall', 'export const recoverSubscriptionBillingRequest = onCall');
const recoverSection = section(indexSrc, 'export const recoverSubscriptionBillingRequest = onCall', '// ===== 💳 결제 검증 (PortOne V2) =====');
const subscribeSection = section(indexSrc, 'export const subscribeWithBillingKey = onCall', '// ===== 💳 정기구독 해지 =====');
const completionSection = section(indexSrc, 'async function completeInitialBillingSubscription', 'async function markInitialBillingPaymentPending');
const failedSection = section(indexSrc, 'async function markInitialBillingPaymentFailed', 'async function markSubscriptionBillingRequestPreflightFailed');
const recoverProgressWriteSection = section(indexSrc, 'async function writeRecoverInitialBillingProgressIfLockActive', 'async function markSubscriptionBillingRequestPreflightFailed');
const retrySection = section(subscriptionPageSrc, 'const handleRetryPendingSubscription = async', 'const selected = PLANS');
const handleSection = section(subscriptionPageSrc, 'const handleSubscribe = async', 'const selected = PLANS');
const requestChargingWriteSection = section(subscribeSection, 'tx.set(requestRef, {', 'tx.set(lockRef, {');

function recoverLockDecision(overrides = {}) {
  return core.resolveRecoverInitialBillingLockWrite({
    uid: 'user-a',
    issueId: 'issue-a',
    lockExists: true,
    lockData: {
      uid: 'user-a',
      issueId: 'issue-a',
    },
    requestData: {
      status: 'charging',
    },
    paymentData: {
      status: 'pending',
    },
    ...overrides,
  });
}

const missingLockAtEntry = recoverLockDecision({
  lockExists: false,
  lockData: null,
});
assert.equal(missingLockAtEntry.action, 'skip_missing_lock');
assert.equal(missingLockAtEntry.shouldWriteRequest, false);
assert.equal(missingLockAtEntry.shouldWritePayment, false);
assert.equal(missingLockAtEntry.shouldWriteLock, false);

const deletedBeforeRecoverWrite = recoverLockDecision({
  lockExists: false,
  lockData: null,
  requestData: { status: 'charging' },
  paymentData: { status: 'pending' },
});
assert.equal(deletedBeforeRecoverWrite.action, 'skip_missing_lock');
assert.equal(deletedBeforeRecoverWrite.reason, 'lock_missing');
assert.equal(deletedBeforeRecoverWrite.shouldWriteLock, false);

const processedRequestBeforeRecoverWrite = recoverLockDecision({
  requestData: { status: 'processed' },
  paymentData: { status: 'processed' },
});
assert.equal(processedRequestBeforeRecoverWrite.action, 'skip_already_processed');
assert.equal(processedRequestBeforeRecoverWrite.shouldWriteRequest, false);
assert.equal(processedRequestBeforeRecoverWrite.shouldWritePayment, false);
assert.equal(processedRequestBeforeRecoverWrite.shouldWriteLock, false);

const matchingLockBeforeRecoverWrite = recoverLockDecision();
assert.equal(matchingLockBeforeRecoverWrite.action, 'write_existing_lock');
assert.equal(matchingLockBeforeRecoverWrite.shouldWriteRequest, true);
assert.equal(matchingLockBeforeRecoverWrite.shouldWritePayment, true);
assert.equal(matchingLockBeforeRecoverWrite.shouldWriteLock, true);

const mismatchedUidLockBeforeRecoverWrite = recoverLockDecision({
  lockData: {
    uid: 'user-b',
    issueId: 'issue-a',
  },
});
assert.equal(mismatchedUidLockBeforeRecoverWrite.action, 'reject_mismatched_lock');
assert.equal(mismatchedUidLockBeforeRecoverWrite.shouldWriteLock, false);

const mismatchedIssueLockBeforeRecoverWrite = recoverLockDecision({
  lockData: {
    uid: 'user-a',
    issueId: 'issue-b',
  },
});
assert.equal(mismatchedIssueLockBeforeRecoverWrite.action, 'reject_mismatched_lock');
assert.equal(mismatchedIssueLockBeforeRecoverWrite.shouldWriteRequest, false);

assert(indexSrc.includes('function getSubscriptionPaymentLockRef(uid: string)'));
assert(indexSrc.includes('return db.doc(`subscriptionPaymentLocks/${uid}`)'));
assert(firestoreRules.includes('match /subscriptionPaymentLocks/{uid}'));
assert(firestoreRules.includes('allow read, write: if false;'));

assert(createSection.includes('const lockRef = getSubscriptionPaymentLockRef(uid)'));
assert(createSection.includes('return db.runTransaction(async (tx) =>'));
assert(createSection.includes('tx.get(lockRef)'));
assert(createSection.includes('tx.get(subscriptionRef)'));
assert(createSection.includes('isActiveSubscriptionData(subscriptionData, nowMs)'));
assert(createSection.includes("throw new HttpsError('failed-precondition', '이미 활성화된 정기구독이 있습니다.')"));
assert(createSection.includes("const issueId = createPortOneRequestId('billing')"));
assert(createSection.includes('tx.set(newRequestRef'));
assert(createSection.includes('tx.set(lockRef'));
assertBefore(createSection, 'tx.get(lockRef)', 'tx.set(newRequestRef');
assertBefore(createSection, 'tx.get(lockRef)', 'tx.set(lockRef');

assert(createSection.includes("lockedStatus === 'created' && !hasStartedInitialBilling"));
assert(createSection.includes('existing: true'));
assert(createSection.includes("lockedStatus === 'failed' || lockedStatus === 'cancelled'"));
assert(createSection.includes('expired_without_initial_billing'));
assert(createSection.includes('pending: true'));
assertBefore(handleSection, 'if (billingRequest.pending === true)', 'requestIssueBillingKey');

assert(subscribeSection.includes('const lockRef = getSubscriptionPaymentLockRef(uid)'));
assert(subscribeSection.includes('tx.get(lockRef)'));
assert(subscribeSection.includes('freshLockData.issueId !== issueId'));
assert(subscribeSection.includes('billingKey,'));
assert(requestChargingWriteSection.includes('billingKeyIssuedAt'));
assert(!requestChargingWriteSection.includes('billingKey,'));
assert(subscribeSection.includes('lastPaymentId: newPaymentId'));
assert(subscribeSection.includes("action: 'settle_existing'"));
assert(subscribeSection.includes('customer: getStoredSubscriptionBillingCustomer(freshData)'));
assertBefore(subscribeSection, "if (locked.action === 'settle_existing')", 'axios.post');

assert(recoverSection.includes('const lockRef = getSubscriptionPaymentLockRef(uid)'));
assert(recoverSection.includes('const lockSnap = await lockRef.get()'));
assert(recoverSection.includes('const requestRef = getPaymentRequestRef(issueId)'));
assert(recoverSection.includes('requestData.uid !== uid'));
assert(recoverSection.includes('const lastPaymentId = typeof requestData.lastPaymentId'));
assert(recoverSection.includes('fetchPortOnePaymentWithRetry(lastPaymentId)'));
assert(recoverSection.includes('writeRecoverInitialBillingProgressIfLockActive({'));
assert(recoverSection.includes("writeResult === 'lock_missing'"));
assert(recoverSection.includes("writeResult === 'already_processed'"));
assert(recoverSection.includes('return settleInitialBillingPayment({'));
assert(recoverSection.includes('status: \'lookup_failed\''));
assert(recoverSection.includes('await lockRef.delete()'));
assert(!recoverSection.includes('return { billingKey'));
assert(!recoverSection.includes('lockRef.set('));
assert(!recoverSection.includes('markInitialBillingPaymentPending('));
assert(!recoverSection.includes('markInitialBillingPaymentFailed('));

assert(indexSrc.includes('resolveRecoverInitialBillingLockWrite'));
assert(recoverProgressWriteSection.includes('return db.runTransaction(async (tx) =>'));
assert(recoverProgressWriteSection.includes('tx.get(params.lockRef)'));
assert(recoverProgressWriteSection.includes('tx.get(params.requestRef)'));
assert(recoverProgressWriteSection.includes('tx.get(params.paymentRef)'));
assert(recoverProgressWriteSection.includes("decision.action === 'skip_missing_lock'"));
assert(recoverProgressWriteSection.includes("decision.action === 'skip_already_processed'"));
assert(recoverProgressWriteSection.includes("decision.action === 'reject_mismatched_lock'"));
assert(recoverProgressWriteSection.includes('tx.delete(params.lockRef)'));
assert(recoverProgressWriteSection.includes('tx.set(params.lockRef, params.lockWrite, { merge: true })'));
assertBefore(recoverProgressWriteSection, "decision.action === 'skip_missing_lock'", 'tx.set(params.lockRef, params.lockWrite, { merge: true })');

assert(completionSection.includes('tx.delete(lockRef)'));
assert(completionSection.includes('billingKey: admin.firestore.FieldValue.delete()'));
assert(failedSection.includes('lockRef.set({'));
assert(!failedSection.includes('lockRef.delete()'));

assert(subscriptionPageSrc.includes("recoverSubscriptionBillingRequest')({})"));
assert(subscriptionPageSrc.includes('if (billingRequest.pending === true)'));
assert(subscriptionPageSrc.includes('setPendingSubscriptionRecovery({'));
assert(subscriptionPageSrc.includes('hasPendingSubscriptionRecovery ? \'기존 정기결제 상태 확인 필요\''));
assert(retrySection.includes('await confirmPendingSubscription(recovery)'));
assert(!retrySection.includes('requestIssueBillingKey'));
assert(!retrySection.includes('createSubscriptionBillingRequest'));

console.log('subscription payment lock policy tests passed');
