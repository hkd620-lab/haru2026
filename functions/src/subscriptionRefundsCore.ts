export type SubscriptionRefundStatus =
  | 'requested'
  | 'reviewing'
  | 'approved'
  | 'refunding'
  | 'refunded'
  | 'rejected'
  | 'failed';

export type SubscriptionRefundReasonCode =
  | 'unused_within_7_days'
  | 'service_issue'
  | 'duplicate_payment'
  | 'wrong_payment'
  | 'other';

export type SubscriptionRefundPolicyErrorCode =
  | 'not_owner'
  | 'not_subscription_payment'
  | 'not_paid'
  | 'store_mismatch'
  | 'amount_mismatch'
  | 'currency_mismatch'
  | 'already_refunded'
  | 'duplicate_request'
  | 'request_window_closed'
  | 'permission_denied'
  | 'nothing_to_refund';

export class SubscriptionRefundPolicyError extends Error {
  readonly policyCode: SubscriptionRefundPolicyErrorCode;

  constructor(policyCode: SubscriptionRefundPolicyErrorCode, message: string) {
    super(message);
    this.name = 'SubscriptionRefundPolicyError';
    this.policyCode = policyCode;
  }
}

export const SUBSCRIPTION_REFUND_FULL_REFUND_DAYS = 7;
export const SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS = 30;
export const SUBSCRIPTION_REFUND_MIN_REMAINING_DAYS = 7;
export const SUBSCRIPTION_REFUNDING_STALE_MS = 10 * 60 * 1000;
export const SUBSCRIPTION_REFUND_REMAINING_WINDOW_EXEMPT_REASON_CODES: SubscriptionRefundReasonCode[] = [
  'service_issue',
  'duplicate_payment',
  'wrong_payment',
];

export const SUBSCRIPTION_REFUND_STATUSES: SubscriptionRefundStatus[] = [
  'requested',
  'reviewing',
  'approved',
  'refunding',
  'refunded',
  'rejected',
  'failed',
];

export const SUBSCRIPTION_REFUND_PROCESSING_STATUSES: SubscriptionRefundStatus[] = [
  'requested',
  'reviewing',
  'approved',
  'refunding',
];

export const SUBSCRIPTION_REFUND_REASON_LABELS: Record<SubscriptionRefundReasonCode, string> = {
  unused_within_7_days: '결제 후 7일 이내 미사용',
  service_issue: '서비스 이용 문제',
  duplicate_payment: '중복 결제',
  wrong_payment: '잘못된 결제',
  other: '기타',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeRefundReasonCode(value: unknown): SubscriptionRefundReasonCode {
  const code = String(value || '').trim();
  if (
    code === 'unused_within_7_days'
    || code === 'service_issue'
    || code === 'duplicate_payment'
    || code === 'wrong_payment'
    || code === 'other'
  ) {
    return code;
  }
  throw new SubscriptionRefundPolicyError('not_subscription_payment', '환불 사유가 올바르지 않습니다.');
}

export function sanitizeRefundDescription(value: unknown): string {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
}

export function isProcessingRefundStatus(status: unknown): boolean {
  return SUBSCRIPTION_REFUND_PROCESSING_STATUSES.includes(status as SubscriptionRefundStatus);
}

export function createPortOneRefundIdempotencyKey(refundRequestId: string): string {
  return `"subscription-refund-${refundRequestId}"`;
}

export function assertAdminUid(authUid: string | undefined, adminUid: string): void {
  if (!authUid || authUid !== adminUid) {
    throw new SubscriptionRefundPolicyError('permission_denied', '관리자 권한이 필요합니다.');
  }
}

export function assertRefundRequesterOwnsPayment(authUid: string, paymentRequest: Record<string, any>): void {
  if (!authUid || paymentRequest.uid !== authUid) {
    throw new SubscriptionRefundPolicyError('not_owner', '본인 결제만 환불 요청할 수 있습니다.');
  }
}

export function assertRefundRequestMatchesPaymentRequest(
  refundRequest: Record<string, any>,
  paymentRequest: Record<string, any>,
): void {
  if (!refundRequest.uid || refundRequest.uid !== paymentRequest.uid) {
    throw new SubscriptionRefundPolicyError('not_owner', '환불 요청과 결제 사용자 정보가 일치하지 않습니다.');
  }
}

export function assertSubscriptionChargePayment(paymentRequest: Record<string, any>): void {
  const paymentType = paymentRequest.paymentType;
  const billingType = paymentRequest.billingType;
  if (
    paymentType !== 'subscription'
    || (billingType !== 'initial_billing' && billingType !== 'recurring')
  ) {
    throw new SubscriptionRefundPolicyError('not_subscription_payment', '정기구독 결제만 환불 요청할 수 있습니다.');
  }
}

export function isPaidFirestoreSubscriptionPaymentRequest(
  uid: string,
  paymentRequest: Record<string, any>,
): boolean {
  if (!uid || paymentRequest.uid !== uid) return false;
  try {
    assertSubscriptionChargePayment(paymentRequest);
  } catch {
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

export function hasRefundRequestMarker(paymentRequest: Record<string, any>): boolean {
  return Boolean(paymentRequest.refundRequestId || paymentRequest.refundStatus);
}

export function getPaymentAmountTotal(payment: Record<string, any>): number {
  const total = Number(payment?.amount?.total ?? payment?.totalAmount ?? 0);
  return Number.isFinite(total) ? total : 0;
}

export function getPortOneCancellableAmount(payment: Record<string, any>): number {
  const explicit = Number(payment?.cancellableAmount?.total ?? payment?.cancellableAmount);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }

  const total = getPaymentAmountTotal(payment);
  const cancellations = Array.isArray(payment?.cancellations) ? payment.cancellations : [];
  const cancelledTotal = cancellations.reduce((sum: number, cancellation: Record<string, any>) => {
    const status = String(cancellation?.status || '').toUpperCase();
    if (status !== 'SUCCEEDED' && status !== 'SUCCESS') return sum;
    const amount = Number(cancellation?.amount?.total ?? cancellation?.totalAmount ?? cancellation?.amount ?? 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  return Math.max(0, total - cancelledTotal);
}

export function assertPortOnePaymentIdentityMatchesStoredRequest(
  payment: Record<string, any>,
  paymentRequest: Record<string, any>,
  expectedStoreId: string,
): void {
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

export function assertPortOnePaymentMatchesStoredRequest(
  payment: Record<string, any>,
  paymentRequest: Record<string, any>,
  expectedStoreId: string,
  options: { allowPartialCancelled?: boolean } = {},
): void {
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

export function assertNoDuplicateRefundRequest(existingStatus: unknown): void {
  if (typeof existingStatus === 'string' && existingStatus) {
    throw new SubscriptionRefundPolicyError('duplicate_request', '이미 등록된 환불 요청이 있습니다.');
  }
}

export function isRefundRemainingWindowExempt(reasonCode: SubscriptionRefundReasonCode): boolean {
  return SUBSCRIPTION_REFUND_REMAINING_WINDOW_EXEMPT_REASON_CODES.includes(reasonCode);
}

export function getSubscriptionRefundServicePeriodDays(
  paidAtMs: number,
  explicitPeriodEndMs?: number,
  explicitServicePeriodDays?: number,
): number {
  void paidAtMs;
  void explicitPeriodEndMs;
  void explicitServicePeriodDays;
  return SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS;
}

export function getSubscriptionRefundPeriodEndMs(
  paidAtMs: number,
  servicePeriodDays: number,
  explicitPeriodEndMs?: number,
): number {
  if (
    Number.isFinite(explicitPeriodEndMs)
    && explicitPeriodEndMs !== undefined
    && explicitPeriodEndMs > paidAtMs
  ) {
    return explicitPeriodEndMs;
  }
  return paidAtMs + Math.max(1, servicePeriodDays) * MS_PER_DAY;
}

export function assertRefundRequestWindow(
  paidAtMs: number,
  nowMs: number,
  reasonCode: SubscriptionRefundReasonCode,
  periodEndMs?: number,
  servicePeriodDays = SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS,
): void {
  if (!Number.isFinite(paidAtMs) || paidAtMs <= 0) {
    throw new SubscriptionRefundPolicyError('request_window_closed', '결제일을 확인할 수 없습니다.');
  }
  if (!isRefundRemainingWindowExempt(reasonCode)) {
    const resolvedPeriodDays = getSubscriptionRefundServicePeriodDays(paidAtMs, periodEndMs, servicePeriodDays);
    const resolvedPeriodEndMs = getSubscriptionRefundPeriodEndMs(paidAtMs, resolvedPeriodDays, periodEndMs);
    const remainingMs = resolvedPeriodEndMs - nowMs;
    if (remainingMs < SUBSCRIPTION_REFUND_MIN_REMAINING_DAYS * MS_PER_DAY) {
      throw new SubscriptionRefundPolicyError('request_window_closed', '구독 만료 7일 미만인 결제는 환불을 신청할 수 없습니다.');
    }
  }
}

export function estimateSubscriptionRefundAmount(
  paidAmount: number,
  paidAtMs: number,
  nowMs: number,
  hasPaidServiceUsage: boolean,
  servicePeriodDays = SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS,
): number {
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) return 0;
  void servicePeriodDays;
  const resolvedPeriodDays = SUBSCRIPTION_REFUND_SERVICE_PERIOD_DAYS;
  const elapsedMs = Math.max(0, nowMs - paidAtMs);
  if (!hasPaidServiceUsage && elapsedMs <= SUBSCRIPTION_REFUND_FULL_REFUND_DAYS * MS_PER_DAY) {
    return paidAmount;
  }
  const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
  const usedDays = Math.min(resolvedPeriodDays, Math.max(0, elapsedDays));
  const usedAmount = (paidAmount / resolvedPeriodDays) * usedDays;
  return Math.max(0, Math.ceil(paidAmount - usedAmount));
}

export interface SubscriptionRefundCancellationAmounts {
  targetRefundAmount: number;
  alreadyRefundedAmount: number;
  cancelAmountThisAttempt: number;
}

export function calculateSubscriptionRefundCancellationAmounts(
  targetRefundAmountInput: unknown,
  cancellableAmountInput: unknown,
  paidAmountInput: unknown,
): SubscriptionRefundCancellationAmounts {
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
  const cancelAmountThisAttempt = Math.min(
    cancellableAmount,
    Math.max(0, targetRefundAmount - alreadyRefundedAmount),
  );

  return {
    targetRefundAmount,
    alreadyRefundedAmount,
    cancelAmountThisAttempt,
  };
}

export function resolveApprovedRefundAmount(
  requestedRefundAmount: unknown,
  cancellableAmount: number,
  paidAmount: number,
): number {
  const requested = Number(requestedRefundAmount);
  const targetRefundAmount = Number.isFinite(requested) && requested > 0
    ? requested
    : paidAmount;
  return calculateSubscriptionRefundCancellationAmounts(
    targetRefundAmount,
    cancellableAmount,
    paidAmount,
  ).cancelAmountThisAttempt;
}

export function shouldMarkRefundedFromPortOne(payment: Record<string, any>, expectedRefundAmount: number): boolean {
  const status = String(payment?.status || '').toUpperCase();
  if (status === 'CANCELLED') return true;
  if (getPortOneCancellableAmount(payment) <= 0) return true;

  const total = getPaymentAmountTotal(payment);
  if (expectedRefundAmount > 0 && total > 0) {
    return getPortOneCancellableAmount(payment) <= Math.max(0, total - expectedRefundAmount);
  }
  return false;
}

export type ApproveRefundRecoveryAction =
  | 'already_processed'
  | 'sync_refunded'
  | 'already_processing'
  | 'retry_cancel'
  | 'blocked';

export type RefundWebhookSyncAction =
  | 'sync_direct'
  | 'sync_matching'
  | 'ignore_orphan';

export function getApproveRefundRecoveryAction(
  refundStatus: unknown,
  payment: Record<string, any>,
  expectedRefundAmount: number,
  refundingStartedAtMs: number,
  nowMs: number,
): ApproveRefundRecoveryAction {
  if (refundStatus === 'refunded') return 'already_processed';
  if (refundStatus === 'rejected') return 'blocked';
  if (shouldMarkRefundedFromPortOne(payment, expectedRefundAmount)) return 'sync_refunded';
  if (refundStatus !== 'refunding') return 'retry_cancel';
  if (!Number.isFinite(refundingStartedAtMs) || refundingStartedAtMs <= 0) return 'retry_cancel';
  return nowMs - refundingStartedAtMs >= SUBSCRIPTION_REFUNDING_STALE_MS
    ? 'retry_cancel'
    : 'already_processing';
}

export function getRefundWebhookSyncAction(
  hasDirectRefundRequest: boolean,
  matchingRefundRequestCount: number,
): RefundWebhookSyncAction {
  if (hasDirectRefundRequest) return 'sync_direct';
  return matchingRefundRequestCount > 0 ? 'sync_matching' : 'ignore_orphan';
}
