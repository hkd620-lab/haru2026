import type { SubscriptionEntitlement, SubscriptionInfo } from '../types/subscription';

export type SubscriptionPaymentSummary = {
  hasPaidPayment: boolean;
  paidAmount?: number | null;
};

export type SubscriptionDisplay = {
  planLabel: string;
  statusLabel: string;
  amountLabel: string;
  isDeveloperGrant: boolean;
};

export type RefundButtonPolicy = {
  eligibilityCanRequest: boolean;
  hasPaymentId: boolean;
  hasProcessingRefundRequest: boolean;
  latestRefundStatus?: string | null;
};

function formatWon(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '확인 중';
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function isPaidSubscriptionPlan(subscription: SubscriptionInfo): boolean {
  return subscription.plan === 'basic' || subscription.plan === 'premium';
}

export function getPlanLabel(subscription: SubscriptionInfo, entitlement: SubscriptionEntitlement): string {
  if (entitlement.source === 'developer_grant') return '개발자 우대';
  if (subscription.plan === 'basic') return '베이직';
  if (subscription.plan === 'premium') return '프리미엄';
  return '무료';
}

export function getStatusLabel(
  subscription: SubscriptionInfo,
  entitlement: SubscriptionEntitlement,
  payment: SubscriptionPaymentSummary,
): string {
  if (entitlement.source === 'developer_grant' && !payment.hasPaidPayment) return '결제 없음';
  if (subscription.status === 'active') return '이용 중';
  if (subscription.status === 'cancelled') return '해지 예약됨';
  return '미구독';
}

export function getAmountLabel(
  entitlement: SubscriptionEntitlement,
  payment: SubscriptionPaymentSummary,
): string {
  if (!payment.hasPaidPayment && entitlement.source === 'developer_grant') return '결제 없음';
  if (!payment.hasPaidPayment) return '확인 중';
  return formatWon(payment.paidAmount);
}

export function resolveSubscriptionDisplay(
  subscription: SubscriptionInfo,
  entitlement: SubscriptionEntitlement,
  payment: SubscriptionPaymentSummary,
): SubscriptionDisplay {
  return {
    planLabel: getPlanLabel(subscription, entitlement),
    statusLabel: getStatusLabel(subscription, entitlement, payment),
    amountLabel: getAmountLabel(entitlement, payment),
    isDeveloperGrant: entitlement.source === 'developer_grant',
  };
}

export function canRequestSubscriptionRefundFromPolicy(policy: RefundButtonPolicy): boolean {
  return policy.eligibilityCanRequest
    && policy.hasPaymentId
    && !policy.hasProcessingRefundRequest
    && policy.latestRefundStatus !== 'refunded';
}
