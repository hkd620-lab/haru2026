import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  SubscriptionEntitlement,
  SubscriptionInfo,
  DEFAULT_SUBSCRIPTION,
} from '../types/subscription';
import { isPaidSubscriptionPlan } from '../utils/subscriptionDisplay';

const DEVELOPER_UIDS = ['naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8'];
const DEFAULT_ENTITLEMENT: SubscriptionEntitlement = {
  plan: 'free',
  source: 'none',
  hasDeveloperGrant: false,
  hasPaidAccess: false,
};

function isDeveloperGrantUid(uid: string | undefined): boolean {
  return Boolean(uid && DEVELOPER_UIDS.includes(uid));
}

function isExpired(subscription: SubscriptionInfo): boolean {
  const expiresAt = (subscription as SubscriptionInfo & { expiresAt?: { toMillis?: () => number } }).expiresAt;
  const endTime = subscription.endDate
    ? Date.parse(subscription.endDate)
    : typeof expiresAt?.toMillis === 'function'
      ? expiresAt.toMillis()
      : Number.NaN;
  return Number.isFinite(endTime) && endTime < Date.now();
}

function normalizeSubscription(data: Partial<SubscriptionInfo> | undefined): SubscriptionInfo {
  if (!data) return DEFAULT_SUBSCRIPTION;
  const plan = data.plan === 'basic' || data.plan === 'premium' ? data.plan : 'free';
  const status = data.status === 'active' || data.status === 'cancelled' ? data.status : 'none';
  return {
    ...DEFAULT_SUBSCRIPTION,
    ...data,
    plan,
    status,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    paymentId: data.paymentId || null,
    lastPaymentId: data.lastPaymentId || null,
    billingKey: data.billingKey || null,
    nextBillingDate: data.nextBillingDate || null,
    payMethod: data.payMethod || null,
    updatedAt: data.updatedAt || DEFAULT_SUBSCRIPTION.updatedAt,
  };
}

function buildEffectiveSubscription(
  actualSubscription: SubscriptionInfo,
  hasDeveloperGrant: boolean,
): { subscription: SubscriptionInfo; entitlement: SubscriptionEntitlement } {
  if (hasDeveloperGrant) {
    return {
      subscription: {
        ...actualSubscription,
        plan: 'premium',
        status: 'active',
      },
      entitlement: {
        plan: 'developer',
        source: 'developer_grant',
        hasDeveloperGrant: true,
        hasPaidAccess: true,
      },
    };
  }

  if (!isExpired(actualSubscription) && isPaidSubscriptionPlan(actualSubscription)) {
    return {
      subscription: actualSubscription,
      entitlement: {
        plan: actualSubscription.plan,
        source: actualSubscription.status === 'active' ? 'paid_subscription' : 'none',
        hasDeveloperGrant: false,
        hasPaidAccess: actualSubscription.status === 'active',
      },
    };
  }

  return {
    subscription: {
      ...DEFAULT_SUBSCRIPTION,
      endDate: actualSubscription.endDate,
      updatedAt: actualSubscription.updatedAt,
    },
    entitlement: DEFAULT_ENTITLEMENT,
  };
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo>(DEFAULT_SUBSCRIPTION);
  const [actualSubscription, setActualSubscription] = useState<SubscriptionInfo>(DEFAULT_SUBSCRIPTION);
  const [entitlement, setEntitlement] = useState<SubscriptionEntitlement>(DEFAULT_ENTITLEMENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(DEFAULT_SUBSCRIPTION);
      setActualSubscription(DEFAULT_SUBSCRIPTION);
      setEntitlement(DEFAULT_ENTITLEMENT);
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const ref = doc(db, 'users', user.uid, 'subscription', 'info');
        const snap = await getDoc(ref);
        const hasDeveloperGrant = isDeveloperGrantUid(user.uid);
        const actual = snap.exists()
          ? normalizeSubscription(snap.data() as Partial<SubscriptionInfo>)
          : DEFAULT_SUBSCRIPTION;
        const effective = buildEffectiveSubscription(actual, hasDeveloperGrant);
        setActualSubscription(actual);
        setSubscription(effective.subscription);
        setEntitlement(effective.entitlement);
      } catch (e) {
        console.error('구독 정보 조회 실패:', e);
        const hasDeveloperGrant = isDeveloperGrantUid(user.uid);
        const effective = buildEffectiveSubscription(DEFAULT_SUBSCRIPTION, hasDeveloperGrant);
        setActualSubscription(DEFAULT_SUBSCRIPTION);
        setSubscription(effective.subscription);
        setEntitlement(effective.entitlement);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  const isPremium = subscription.plan === 'premium' && subscription.status === 'active';

  return { subscription, actualSubscription, entitlement, isPremium, loading };
}
