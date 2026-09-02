"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_REFUND_REASON_LABELS = exports.SUBSCRIPTION_REFUND_PROCESSING_STATUSES = exports.SUBSCRIPTION_REFUND_STATUSES = exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS = exports.SUBSCRIPTION_REFUND_FULL_REFUND_DAYS = exports.SUBSCRIPTION_REFUND_REQUEST_WINDOW_DAYS = exports.SubscriptionRefundPolicyError = void 0;
exports.normalizeRefundReasonCode = normalizeRefundReasonCode;
exports.sanitizeRefundDescription = sanitizeRefundDescription;
exports.isProcessingRefundStatus = isProcessingRefundStatus;
exports.assertAdminUid = assertAdminUid;
exports.assertRefundRequesterOwnsPayment = assertRefundRequesterOwnsPayment;
exports.assertSubscriptionChargePayment = assertSubscriptionChargePayment;
exports.getPaymentAmountTotal = getPaymentAmountTotal;
exports.getPortOneCancellableAmount = getPortOneCancellableAmount;
exports.assertPortOnePaymentMatchesStoredRequest = assertPortOnePaymentMatchesStoredRequest;
exports.assertNoDuplicateRefundRequest = assertNoDuplicateRefundRequest;
exports.assertRefundRequestWindow = assertRefundRequestWindow;
exports.estimateSubscriptionRefundAmount = estimateSubscriptionRefundAmount;
exports.shouldMarkRefundedFromPortOne = shouldMarkRefundedFromPortOne;
class SubscriptionRefundPolicyError extends Error {
    constructor(policyCode, message) {
        super(message);
        this.name = 'SubscriptionRefundPolicyError';
        this.policyCode = policyCode;
    }
}
exports.SubscriptionRefundPolicyError = SubscriptionRefundPolicyError;
exports.SUBSCRIPTION_REFUND_REQUEST_WINDOW_DAYS = 30;
exports.SUBSCRIPTION_REFUND_FULL_REFUND_DAYS = 7;
exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS = 30;
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
function assertSubscriptionChargePayment(paymentRequest) {
    const paymentType = paymentRequest.paymentType;
    const billingType = paymentRequest.billingType;
    if (paymentType !== 'subscription'
        || (billingType !== 'initial_billing' && billingType !== 'recurring')) {
        throw new SubscriptionRefundPolicyError('not_subscription_payment', '정기구독 결제만 환불 요청할 수 있습니다.');
    }
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
        if (status === 'FAILED')
            return sum;
        const amount = Number((_d = (_c = (_b = (_a = cancellation === null || cancellation === void 0 ? void 0 : cancellation.amount) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : cancellation === null || cancellation === void 0 ? void 0 : cancellation.totalAmount) !== null && _c !== void 0 ? _c : cancellation === null || cancellation === void 0 ? void 0 : cancellation.amount) !== null && _d !== void 0 ? _d : 0);
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
    return Math.max(0, total - cancelledTotal);
}
function assertPortOnePaymentMatchesStoredRequest(payment, paymentRequest, expectedStoreId) {
    if (payment.status !== 'PAID') {
        throw new SubscriptionRefundPolicyError('not_paid', '결제가 완료된 상태가 아닙니다.');
    }
    if (payment.storeId && payment.storeId !== expectedStoreId) {
        throw new SubscriptionRefundPolicyError('store_mismatch', '결제 상점 정보가 일치하지 않습니다.');
    }
    if (payment.currency && payment.currency !== 'KRW') {
        throw new SubscriptionRefundPolicyError('currency_mismatch', '결제 통화가 일치하지 않습니다.');
    }
    if (getPaymentAmountTotal(payment) !== Number(paymentRequest.amount)) {
        throw new SubscriptionRefundPolicyError('amount_mismatch', '결제 금액이 일치하지 않습니다.');
    }
    if (getPortOneCancellableAmount(payment) <= 0) {
        throw new SubscriptionRefundPolicyError('already_refunded', '이미 전액 환불된 결제입니다.');
    }
}
function assertNoDuplicateRefundRequest(existingStatus) {
    if (typeof existingStatus === 'string' && existingStatus) {
        throw new SubscriptionRefundPolicyError('duplicate_request', '이미 등록된 환불 요청이 있습니다.');
    }
}
function assertRefundRequestWindow(paidAtMs, nowMs, reasonCode) {
    if (!Number.isFinite(paidAtMs) || paidAtMs <= 0) {
        throw new SubscriptionRefundPolicyError('request_window_closed', '결제일을 확인할 수 없습니다.');
    }
    if (reasonCode === 'service_issue' || reasonCode === 'duplicate_payment' || reasonCode === 'wrong_payment') {
        return;
    }
    const elapsedDays = Math.floor(Math.max(0, nowMs - paidAtMs) / MS_PER_DAY);
    if (elapsedDays > exports.SUBSCRIPTION_REFUND_REQUEST_WINDOW_DAYS) {
        throw new SubscriptionRefundPolicyError('request_window_closed', '환불 신청 가능 기간이 지났습니다.');
    }
}
function estimateSubscriptionRefundAmount(paidAmount, paidAtMs, nowMs, hasPaidServiceUsage) {
    if (!Number.isFinite(paidAmount) || paidAmount <= 0)
        return 0;
    const elapsedDays = Math.floor(Math.max(0, nowMs - paidAtMs) / MS_PER_DAY);
    if (!hasPaidServiceUsage && elapsedDays <= exports.SUBSCRIPTION_REFUND_FULL_REFUND_DAYS) {
        return paidAmount;
    }
    const usedDays = Math.min(exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS, Math.max(0, elapsedDays));
    const usedAmount = (paidAmount / exports.SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS) * usedDays;
    return Math.max(0, Math.ceil(paidAmount - usedAmount));
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
