import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionInfo, DEFAULT_SUBSCRIPTION } from '../types/subscription';

const DEVELOPER_UIDS = ['naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8'];

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo>(DEFAULT_SUBSCRIPTION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(DEFAULT_SUBSCRIPTION);
      setLoading(false);
      return;
    }

    if (DEVELOPER_UIDS.includes(user.uid)) {
      setSubscription({ ...DEFAULT_SUBSCRIPTION, plan: 'premium' });
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const ref = doc(db, 'users', user.uid, 'subscription', 'info');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setSubscription(snap.data() as SubscriptionInfo);
        } else {
          setSubscription(DEFAULT_SUBSCRIPTION);
        }
      } catch (e) {
        console.error('구독 정보 조회 실패:', e);
        setSubscription(DEFAULT_SUBSCRIPTION);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  const isPremium = subscription.plan === 'premium';

  return { subscription, isPremium, loading };
}
