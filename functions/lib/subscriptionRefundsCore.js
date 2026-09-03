"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_REFUND_REASON_LABELS = exports.SUBSCRIPTION_REFUND_PROCESSING_STATUSES = exports.SUBSCRIPTION_REFUND_STATUSES = exports.SUBSCRIPTION_REFUND_REMAINING_WINDOW_EXEMPT_REASON_CODES = exports.SUBSCRIPTION_REFUNDING_STALE_MS = exports.SUBSCRIPTION_REFUND_MIN_REMAINING_DAYS = exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS = exports.SUBSCRIPTION_REFUND_FULL_REFUND_DAYS = exports.SubscriptionRefundPolicyError = void 0;
exports.normalizeRefundReasonCode = normalizeRefundReasonCode;
exports.sanitizeRefundDescription = sanitizeRefundDescription;
exports.isProcessingRefundStatus = isProcessingRefundStatus;
exports.createPortOneRefundIdempotencyKey = createPortOneRefundIdempotencyKey;
exports.assertAdminUid = assertAdminUid;
exports.assertRefundRequesterOwnsPayment = assertRefundRequesterOwnsPayment;
exports.assertRefundRequestMatchesPaymentRequest = assertRefundRequestMatchesPaymentRequest;
exports.assertSubscriptionChargePayment = assertSubscriptionChargePayment;
exports.isPaidFirestoreSubscriptionPaymentRequest = isPaidFirestoreSubscriptionPaymentRequest;
exports.hasRefundRequestMarker = hasRefundRequestMarker;
exports.getPaymentAmountTotal = getPaymentAmountTotal;
exports.getPortOneCancellableAmount = getPortOneCancellableAmount;
exports.assertPortOnePaymentIdentityMatchesStoredRequest = assertPortOnePaymentIdentityMatchesStoredRequest;
exports.assertPortOnePaymentMatchesStoredRequest = assertPortOnePaymentMatchesStoredRequest;
exports.assertNoDuplicateRefundRequest = assertNoDuplicateRefundRequest;
exports.isRefundRemainingWindowExempt = isRefundRemainingWindowExempt;
exports.getSubscriptionRefundServicePeriodDays = getSubscriptionRefundServicePeriodDays;
exports.getSubscriptionRefundPeriodEndMs = getSubscriptionRefundPeriodEndMs;
exports.assertRefundRequestWindow = assertRefundRequestWindow;
exports.estimateSubscriptionRefundAmount = estimateSubscriptionRefundAmount;
exports.calculateSubscriptionRefundCancellationAmounts = calculateSubscriptionRefundCancellationAmounts;
exports.resolveApprovedRefundAmount = resolveApprovedRefundAmount;
exports.shouldMarkRefundedFromPortOne = shouldMarkRefundedFromPortOne;
exports.getApproveRefundRecoveryAction = getApproveRefundRecoveryAction;
exports.getRefundWebhookSyncAction = getRefundWebhookSyncAction;
class SubscriptionRefundPolicyError extends Error {
    constructor(policyCode, message) {
        super(message);
        this.name = 'SubscriptionRefundPolicyError';
        this.policyCode = policyCode;
    }
}
exports.SubscriptionRefundPolicyError = SubscriptionRefundPolicyError;
exports.SUBSCRIPTION_REFUND_FULL_REFUND_DAYS = 7;
exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS = 30;
exports.SUBSCRIPTION_REFUND_MIN_REMAINING_DAYS = 7;
exports.SUBSCRIPTION_REFUNDING_STALE_MS = 10 * 60 * 1000;
exports.SUBSCRIPTION_REFUND_REMAINING_WINDOW_EXEMPT_REASON_CODES = [
    'service_issue',
    'duplicate_payment',
    'wrong_payment',
];
exports.SUBSCRIPTION_REFUND_STATUSES = [
    'requested',
    'reviewing',
    'approved',
    'refunding',
    'refunded',
    'rejected',
    'failed',
];
exports.SUBSCRIPTION_REFUND_PROCESSING_STATUSES = [
    'requested',
    'reviewing',
    'approved',
    'refunding',
];
exports.SUBSCRIPTION_REFUND_REASON_LABELS = {
    unused_within_7_days: '결제 후 7일 이내 미사용',
    service_issue: '서비스 이용 문제',
    duplicate_payment: '중복 결제',
    wrong_payment: '잘못된 결제',
    other: '기타',
};
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function normalizeRefundReasonCode(value) {
    const code = String(value || '').trim();
    if (code === 'unused_within_7_days'
        || code === 'service_issue'
        || code === 'duplicate_payment'
        || code === 'wrong_payment'
        || code === 'other') {
        return code;
    }
    throw new SubscriptionRefundPolicyError('not_subscription_payment', '환불 사유가 올바르지 않습니다.');
}
function sanitizeRefundDescription(value) {
    return String(value || '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1000);
}
function isProcessingRefundStatus(status) {
    return exports.SUBSCRIPTION_REFUND_PROCESSING_STATUSES.includes(status);
}
function createPortOneRefundIdempotencyKey(refundRequestId) {
    return `"subscription-refund-${refundRequestId}"`;
}
function assertAdminUid(authUid, adminUid) {
    if (!authUid || authUid !== adminUid) {
        throw new SubscriptionRefundPolicyError('permission_denied', '관리자 권한이 필요합니다.');
    }
}
function assertRefundRequesterOwnsPayment(authUid, paymentRequest) {
    if (!authUid || paymentRequest.uid !== authUid) {
        throw new SubscriptionRefundPolicyError('not_owner', '본인 결제만 환불 요청할 수 있습니다.');
    }
}
function assertRefundRequestMatchesPaymentRequest(refundRequest, paymentRequest) {
    if (!refundRequest.uid || refundRequest.uid !== paymentRequest.uid) {
        throw new SubscriptionRefundPolicyError('not_owner', '환불 요청과 결제 사용자 정보가 일치하지 않습니다.');
    }
}
function assertSubscriptionChargePayment(paymentRequest) {
    const paymentType = paymentRequest.paymentType;
    const billingType = paymentRequest.billingType;
    if (paymentType !== 'subscription'
        || (billingType !== 'initial_billing' && billingType !== 'recurring')) {
        throw new SubscriptionRefundPolicyError('not_subscription_payment', '정기구독 결제만 환불 요청할 수 있습니다.');
    }
}
function isPaidFirestoreSubscriptionPaymentRequest(uid, paymentRequest) {
    if (!uid || paymentRequest.uid !== uid)
        return false;
    try {
        assertSubscriptionChargePayment(paymentRequest);
    }
    catch {
        return false;
    }
    const status = String(paymentRequest.status || '').toUpperCase();
    const portoneStatus = String(paymentRequest.portoneStatus || '').toUpperCase();
    const amount = Number(paymentRequest.amount || 0);
    const paid = status === 'PAID' || (status === 'PROCESSED' && portoneStatus === 'PAID');
    return paid
        && Number.isFinite(amount)
        && amount > 0;
}
function hasRefundRequestMarker(paymentRequest) {
    return Boolean(paymentRequest.refundRequestId || paymentRequest.refundStatus);
}
function getPaymentAmountTotal(payment) {
    var _a, _b, _c;
    const total = Number((_c = (_b = (_a = payment === null || payment === void 0 ? void 0 : payment.amount) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : payment === null || payment === void 0 ? void 0 : payment.totalAmount) !== null && _c !== void 0 ? _c : 0);
    return Number.isFinite(total) ? total : 0;
}
function getPortOneCancellableAmount(payment) {
    var _a, _b;
    const explicit = Number((_b = (_a = payment === null || payment === void 0 ? void 0 : payment.cancellableAmount) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : payment === null || payment === void 0 ? void 0 : payment.cancellableAmount);
    if (Number.isFinite(explicit) && explicit >= 0) {
        return explicit;
    }
    const total = getPaymentAmountTotal(payment);
    const cancellations = Array.isArray(payment === null || payment === void 0 ? void 0 : payment.cancellations) ? payment.cancellations : [];
    const cancelledTotal = cancellations.reduce((sum, cancellation) => {
        var _a, _b, _c, _d;
        const status = String((cancellation === null || cancellation === void 0 ? void 0 : cancellation.status) || '').toUpperCase();
        if (status !== 'SUCCEEDED' && status !== 'SUCCESS')
            return sum;
        const amount = Number((_d = (_c = (_b = (_a = cancellation === null || cancellation === void 0 ? void 0 : cancellation.amount) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : cancellation === null || cancellation === void 0 ? void 0 : cancellation.totalAmount) !== null && _c !== void 0 ? _c : cancellation === null || cancellation === void 0 ? void 0 : cancellation.amount) !== null && _d !== void 0 ? _d : 0);
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    return Math.max(0, total - cancelledTotal);
}
function assertPortOnePaymentIdentityMatchesStoredRequest(payment, paymentRequest, expectedStoreId) {
    if (payment.storeId !== expectedStoreId) {
        throw new SubscriptionRefundPolicyError('store_mismatch', '결제 상점 정보가 일치하지 않습니다.');
    }
    if (payment.currency && payment.currency !== 'KRW') {
        throw new SubscriptionRefundPolicyError('currency_mismatch', '결제 통화가 일치하지 않습니다.');
    }
    if (getPaymentAmountTotal(payment) !== Number(paymentRequest.amount)) {
        throw new SubscriptionRefundPolicyError('amount_mismatch', '결제 금액이 일치하지 않습니다.');
    }
}
function assertPortOnePaymentMatchesStoredRequest(payment, paymentRequest, expectedStoreId, options = {}) {
    assertPortOnePaymentIdentityMatchesStoredRequest(payment, paymentRequest, expectedStoreId);
    if (getPortOneCancellableAmount(payment) <= 0) {
        throw new SubscriptionRefundPolicyError('already_refunded', '이미 전액 환불된 결제입니다.');
    }
    const status = String(payment.status || '').toUpperCase();
    const refundableStatus = status === 'PAID' || (options.allowPartialCancelled === true && status === 'PARTIAL_CANCELLED');
    if (!refundableStatus) {
        throw new SubscriptionRefundPolicyError('not_paid', '결제가 완료된 상태가 아닙니다.');
    }
}
function assertNoDuplicateRefundRequest(existingStatus) {
    if (typeof existingStatus === 'string' && existingStatus) {
        throw new SubscriptionRefundPolicyError('duplicate_request', '이미 등록된 환불 요청이 있습니다.');
    }
}
function isRefundRemainingWindowExempt(reasonCode) {
    return exports.SUBSCRIPTION_REFUND_REMAINING_WINDOW_EXEMPT_REASON_CODES.includes(reasonCode);
}
function getSubscriptionRefundServicePeriodDays(paidAtMs, explicitPeriodEndMs, explicitServicePeriodDays) {
    if (Number.isFinite(explicitServicePeriodDays)
        && explicitServicePeriodDays !== undefined
        && explicitServicePeriodDays > 0) {
        return Math.max(1, Math.ceil(explicitServicePeriodDays));
    }
    if (Number.isFinite(paidAtMs)
        && Number.isFinite(explicitPeriodEndMs)
        && explicitPeriodEndMs !== undefined
        && explicitPeriodEndMs > paidAtMs) {
        return Math.max(1, Math.ceil((explicitPeriodEndMs - paidAtMs) / MS_PER_DAY));
    }
    return exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS;
}
function getSubscriptionRefundPeriodEndMs(paidAtMs, servicePeriodDays, explicitPeriodEndMs) {
    if (Number.isFinite(explicitPeriodEndMs)
        && explicitPeriodEndMs !== undefined
        && explicitPeriodEndMs > paidAtMs) {
        return explicitPeriodEndMs;
    }
    return paidAtMs + Math.max(1, servicePeriodDays) * MS_PER_DAY;
}
function assertRefundRequestWindow(paidAtMs, nowMs, reasonCode, periodEndMs, servicePeriodDays = exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS) {
    if (!Number.isFinite(paidAtMs) || paidAtMs <= 0) {
        throw new SubscriptionRefundPolicyError('request_window_closed', '결제일을 확인할 수 없습니다.');
    }
    if (!isRefundRemainingWindowExempt(reasonCode)) {
        const resolvedPeriodDays = getSubscriptionRefundServicePeriodDays(paidAtMs, periodEndMs, servicePeriodDays);
        const resolvedPeriodEndMs = getSubscriptionRefundPeriodEndMs(paidAtMs, resolvedPeriodDays, periodEndMs);
        const remainingMs = resolvedPeriodEndMs - nowMs;
        if (remainingMs < exports.SUBSCRIPTION_REFUND_MIN_REMAINING_DAYS * MS_PER_DAY) {
            throw new SubscriptionRefundPolicyError('request_window_closed', '구독 만료 7일 미만인 결제는 환불을 신청할 수 없습니다.');
        }
    }
}
function estimateSubscriptionRefundAmount(paidAmount, paidAtMs, nowMs, hasPaidServiceUsage, servicePeriodDays = exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS) {
    if (!Number.isFinite(paidAmount) || paidAmount <= 0)
        return 0;
    const resolvedPeriodDays = Math.max(1, Math.ceil(servicePeriodDays));
    const elapsedMs = Math.max(0, nowMs - paidAtMs);
    if (!hasPaidServiceUsage && elapsedMs <= exports.SUBSCRIPTION_REFUND_FULL_REFUND_DAYS * MS_PER_DAY) {
        return paidAmount;
    }
    const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
    const usedDays = Math.min(resolvedPeriodDays, Math.max(0, elapsedDays));
    const usedAmount = (paidAmount / resolvedPeriodDays) * usedDays;
    return Math.max(0, Math.ceil(paidAmount - usedAmount));
}
function calculateSubscriptionRefundCancellationAmounts(targetRefundAmountInput, cancellableAmountInput, paidAmountInput) {
    const paidAmountRaw = Number(paidAmountInput);
    const paidAmount = Number.isFinite(paidAmountRaw) && paidAmountRaw > 0
        ? Math.ceil(paidAmountRaw)
        : 0;
    const targetRefundAmountRaw = Number(targetRefundAmountInput);
    const targetRefundAmount = Number.isFinite(targetRefundAmountRaw) && targetRefundAmountRaw > 0
        ? Math.min(paidAmount, Math.ceil(targetRefundAmountRaw))
        : 0;
    const cancellableAmountRaw = Number(cancellableAmountInput);
    const cancellableAmount = Number.isFinite(cancellableAmountRaw) && cancellableAmountRaw > 0
        ? Math.min(paidAmount, Math.ceil(cancellableAmountRaw))
        : 0;
    const alreadyRefundedAmount = Math.max(0, paidAmount - cancellableAmount);
    const cancelAmountThisAttempt = Math.min(cancellableAmount, Math.max(0, targetRefundAmount - alreadyRefundedAmount));
    return {
        targetRefundAmount,
        alreadyRefundedAmount,
        cancelAmountThisAttempt,
    };
}
function resolveApprovedRefundAmount(requestedRefundAmount, cancellableAmount, paidAmount) {
    const requested = Number(requestedRefundAmount);
    const targetRefundAmount = Number.isFinite(requested) && requested > 0
        ? requested
        : paidAmount;
    return calculateSubscriptionRefundCancellationAmounts(targetRefundAmount, cancellableAmount, paidAmount).cancelAmountThisAttempt;
}
function shouldMarkRefundedFromPortOne(payment, expectedRefundAmount) {
    const status = String((payment === null || payment === void 0 ? void 0 : payment.status) || '').toUpperCase();
    if (status === 'CANCELLED')
        return true;
    if (getPortOneCancellableAmount(payment) <= 0)
        return true;
    const total = getPaymentAmountTotal(payment);
    if (expectedRefundAmount > 0 && total > 0) {
        return getPortOneCancellableAmount(payment) <= Math.max(0, total - expectedRefundAmount);
    }
    return false;
}
function getApproveRefundRecoveryAction(refundStatus, payment, expectedRefundAmount, refundingStartedAtMs, nowMs) {
    if (refundStatus === 'refunded')
        return 'already_processed';
    if (refundStatus === 'rejected')
        return 'blocked';
    if (shouldMarkRefundedFromPortOne(payment, expectedRefundAmount))
        return 'sync_refunded';
    if (refundStatus !== 'refunding')
        return 'retry_cancel';
    if (!Number.isFinite(refundingStartedAtMs) || refundingStartedAtMs <= 0)
        return 'retry_cancel';
    return nowMs - refundingStartedAtMs >= exports.SUBSCRIPTION_REFUNDING_STALE_MS
        ? 'retry_cancel'
        : 'already_processing';
}
function getRefundWebhookSyncAction(hasDirectRefundRequest, matchingRefundRequestCount) {
    if (hasDirectRefundRequest)
        return 'sync_direct';
    return matchingRefundRequestCount > 0 ? 'sync_matching' : 'ignore_orphan';
}
