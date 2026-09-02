export type PlanType = 'free' | 'basic' | 'premium';

export interface SubscriptionInfo {
  plan: PlanType;
  startDate: string | null;
  endDate: string | null;
  paymentId: string | null;
  lastPaymentId?: string | null;
  billingKey: string | null;
  nextBillingDate: string | null;
  status: 'active' | 'cancelled' | 'none';
  payMethod: string | null;
  paymentType?: 'subscription' | 'one_time' | string | null;
  billingType?: string | null;
  provider?: string | null;
  lastPaidAmount?: number | null;
  hasPaidServiceUsage?: boolean;
  updatedAt: string;
}

export const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  plan: 'free',
  startDate: null,
  endDate: null,
  paymentId: null,
  billingKey: null,
  nextBillingDate: null,
  status: 'none',
  payMethod: null,
  updatedAt: new Date().toISOString(),
};
