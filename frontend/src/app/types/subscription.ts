export type PlanType = 'free' | 'basic' | 'premium';

export interface SubscriptionInfo {
  plan: PlanType;
  startDate: string | null;
  endDate: string | null;
  paymentId: string | null;
  billingKey: string | null;
  nextBillingDate: string | null;
  status: 'active' | 'cancelled' | 'none';
  payMethod: string | null;
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
