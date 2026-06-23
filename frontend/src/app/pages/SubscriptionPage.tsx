import { useEffect, useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type PaidPlan = 'basic' | 'premium';
type BillingKeyResponse = {
  code?: string;
  message?: string;
  billingKey?: string;
};

const PLANS: Record<PaidPlan, {
  title: string;
  orderName: string;
  amount: number;
  priceLabel: string;
  description: string;
  features: string[];
}> = {
  basic: {
    title: '베이직',
    orderName: 'HARU 베이직 월 구독',
    amount: 3500,
    priceLabel: '₩3,500',
    description: '기록 생활을 안정적으로 이어가세요',
    features: [
      '12종 기록 형식',
      'SAYU AI 다듬기',
      '기록 저장 및 조회',
      'TEXT/HTML 출력',
    ],
  },
  premium: {
    title: '프리미엄',
    orderName: 'HARU 프리미엄 월 구독',
    amount: 5000,
    priceLabel: '₩5,000',
    description: '기록을 더 깊게 활용하세요',
    features: [
      '베이직 모든 기능',
      'SAYU PDF 저장',
      '월간/분기/연간 기록합침',
      '월간/분기/연간 통계',
    ],
  },
};

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>('premium');

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan === 'basic' || plan === 'premium') {
      setSelectedPlan(plan);
    }
  }, [searchParams]);

  const handleSubscribe = async () => {
    if (authLoading) return;
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setLoading(true);

    try {
      const plan = PLANS[selectedPlan];
      const issueId = `haru-billing-${Date.now()}`;

      const response = await (PortOne as any).requestIssueBillingKey({
        storeId: import.meta.env.VITE_PORTONE_STORE_ID,
        channelKey: import.meta.env.VITE_PORTONE_TOSS_CHANNEL_KEY,
        billingKeyMethod: 'CARD',
        issueId,
        issueName: plan.orderName,
        customer: {
          email: user.email || '',
        },
      }) as BillingKeyResponse;

      if (response?.code) {
        alert('카드 등록이 취소되었습니다.');
        return;
      }

      const billingKey = response?.billingKey;
      if (!billingKey) {
        throw new Error('빌링키 발급 결과가 올바르지 않습니다.');
      }

      const functions = getFunctions(undefined, 'asia-northeast3');
      const subscribeWithBillingKey = httpsCallable(functions, 'subscribeWithBillingKey');
      await subscribeWithBillingKey({
        billingKey,
        plan: selectedPlan,
        payMethod: 'card',
      });

      alert(`🎉 ${plan.title} 구독이 완료되었습니다!`);
      window.location.href = '/';

    } catch (e: any) {
      console.error('결제 오류:', e);
      const msg = e?.message || '결제 중 오류가 발생했습니다. 다시 시도해 주세요.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const selected = PLANS[selectedPlan];

  return (
    <div className="min-h-screen bg-[#EDE9F5] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-1">HARU 구독 플랜</h1>
          <p className="text-sm text-gray-500">필요한 만큼 기록을 확장하세요</p>
        </div>

        <div
          className="rounded-2xl p-3 mb-4 text-center"
          style={{
            background: 'linear-gradient(90deg, #1A3C6E 0%, #10b981 100%)',
            color: '#fff',
          }}
        >
          <p className="text-sm font-bold mb-0.5">🎉 신규 가입 시 7일 프리미엄 무료 체험</p>
          <p className="text-[11px] opacity-90">전 기능 7일간 무제한 체험 가능</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {(Object.keys(PLANS) as PaidPlan[]).map((planId) => {
            const plan = PLANS[planId];
            const isSelected = selectedPlan === planId;

            return (
              <button
                key={planId}
                type="button"
                onClick={() => setSelectedPlan(planId)}
                className={`rounded-2xl p-5 text-left border-2 transition-all ${isSelected ? 'bg-[#1A3C6E] border-[#10b981] shadow-lg' : 'bg-white border-gray-200 hover:border-[#1A3C6E]/40'}`}
              >
                <div className={`text-sm font-bold mb-1 ${isSelected ? 'text-[#10b981]' : 'text-[#1A3C6E]'}`}>{plan.title}</div>
                <div className={`text-3xl font-black mb-1 ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                  {plan.priceLabel}
                </div>
                <div className={`text-xs mb-2 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>/ 월</div>
                <p className={`text-xs mb-3 ${isSelected ? 'text-gray-200' : 'text-gray-600'}`}>{plan.description}</p>
                <ul className={`space-y-1 text-xs ${isSelected ? 'text-gray-100' : 'text-gray-600'}`}>
                  {plan.features.map((feature) => (
                    <li key={feature}>✓ {feature}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs mb-3" style={{ color: '#10b981' }}>
          ✓ {selected.title} {selected.priceLabel}/월 결제 완료 후 즉시 서비스 이용 가능합니다
        </p>

        <button
          onClick={() => handleSubscribe()}
          disabled={loading || authLoading}
          className="w-full bg-[#1A3C6E] hover:bg-[#142f57] text-white font-black text-base py-4 rounded-2xl transition-colors disabled:opacity-50 mb-3"
        >
          {loading ? '결제 처리 중...' : '💳 카드·간편결제로 구독하기'}
        </button>

        <p className="text-center text-xs text-gray-400 mb-2">
          신용/체크카드 · 카카오페이 · 토스페이 결제 가능
        </p>

        <button
          onClick={() => window.history.back()}
          className="w-full text-gray-400 text-sm py-2 hover:text-gray-600"
        >
          돌아가기
        </button>

      </div>
    </div>
  );
}
