export type PlanType = 'free' | 'premium';

export interface SubscriptionInfo {
  plan: PlanType;
  startDate: string | null;
  endDate: string | null;
  paymentId: string | null;
  updatedAt: string;
}

export const DEFAULT_SUBSCRIPTION: SubscriptionInfo = {
  plan: 'free',
  startDate: null,
  endDate: null,
  paymentId: null,
  updatedAt: new Date().toISOString(),
};
