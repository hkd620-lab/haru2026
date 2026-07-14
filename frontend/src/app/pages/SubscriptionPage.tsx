import { useEffect, useRef, useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BusinessInfoNotice } from '../components/BusinessInfoNotice';

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
    amount: 4000,
    priceLabel: '₩4,000',
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
    amount: 6000,
    priceLabel: '₩6,000',
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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const redirectProcessedRef = useRef(false);

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan === 'basic' || plan === 'premium') {
      setSelectedPlan(plan);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    setFullName((prev) => prev || user.displayName || '');
    setEmail((prev) => prev || user.email || '');
  }, [user]);

  useEffect(() => {
    if (authLoading || redirectProcessedRef.current) return;
    const redirectedCode = searchParams.get('code');
    const redirectedBillingKey = searchParams.get('billingKey');
    if (!redirectedCode && !redirectedBillingKey) return;

    redirectProcessedRef.current = true;
    if (redirectedCode) {
      alert(searchParams.get('message') || '카드 등록이 취소되었습니다.');
      return;
    }

    if (!user || !redirectedBillingKey) {
      alert('정기결제 확인을 위해 로그인이 필요합니다.');
      return;
    }

    const planParam = searchParams.get('plan');
    const redirectedPlan: PaidPlan = planParam === 'basic' || planParam === 'premium' ? planParam : selectedPlan;
    const functions = getFunctions(undefined, 'asia-northeast3');
    const subscribeWithBillingKey = httpsCallable(functions, 'subscribeWithBillingKey');

    setLoading(true);
    subscribeWithBillingKey({
      billingKey: redirectedBillingKey,
      plan: redirectedPlan,
      payMethod: 'kg_inicis_card',
    })
      .then(() => {
        alert(`🎉 ${PLANS[redirectedPlan].title} 구독이 완료되었습니다!`);
        window.history.replaceState({}, '', '/subscription');
        window.location.href = '/';
      })
      .catch((error: any) => {
        console.error('이니시스 정기결제 리다이렉트 처리 오류:', error);
        alert(error?.message || '정기결제 처리 중 오류가 발생했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [authLoading, searchParams, selectedPlan, user]);

  const handleSubscribe = async () => {
    if (authLoading) return;
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setLoading(true);

    try {
      const plan = PLANS[selectedPlan];
      const inicisBillingChannelKey = import.meta.env.VITE_PORTONE_INICIS_BILLING_CHANNEL_KEY || import.meta.env.VITE_PORTONE_CHANNEL_KEY;
      if (!inicisBillingChannelKey) {
        throw new Error('KG이니시스 정기결제 채널 키가 설정되지 않았습니다.');
      }

      const trimmedName = fullName.trim();
      if (!trimmedName) {
        alert('구매자 이름을 입력해 주세요.');
        return;
      }

      const trimmedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        alert('이니시스 정기결제는 구매자 이메일이 필수입니다.');
        return;
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      if (normalizedPhone.length < 10) {
        alert('이니시스 정기결제는 구매자 휴대폰 번호가 필수입니다.');
        return;
      }

      // 이니시스 oid 제한(최대 40자)으로 uid 제외 — 사용자 연결은 subscribeWithBillingKey 인증으로 처리
      const issueId = `haru-bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await (PortOne as any).requestIssueBillingKey({
        storeId: import.meta.env.VITE_PORTONE_STORE_ID,
        channelKey: inicisBillingChannelKey,
        billingKeyMethod: 'CARD',
        displayAmount: plan.amount,
        currency: 'KRW',
        issueId,
        issueName: plan.orderName,
        customer: {
          fullName: trimmedName,
          email: trimmedEmail,
          phoneNumber: normalizedPhone,
        },
        redirectUrl: `${window.location.origin}/subscription?plan=${selectedPlan}`,
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
        payMethod: 'kg_inicis_card',
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

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-[#EDE9F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-3">HARU 구독 플랜</h1>
          <p className="text-sm font-bold text-gray-700 mb-5">결제는 로그인 후 이용할 수 있습니다.</p>
          <Link
            to="/login"
            className="block w-full rounded-2xl bg-[#1A3C6E] px-4 py-4 text-base font-black text-white transition-colors hover:bg-[#142f57]"
          >
            로그인하러 가기
          </Link>
        </section>
      </div>
    );
  }

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
              <p className="text-[11px] opacity-90">회원 계정 기준으로 구독 상태가 반영됩니다</p>
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
          ✓ {selected.title} {selected.priceLabel}/월 KG이니시스 정기결제 완료 후 즉시 서비스 이용 가능합니다
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 space-y-3">
          <div>
            <label htmlFor="subscription-buyer-name" className="block text-xs font-bold text-gray-500 mb-1">
              구매자 이름 <span className="text-[#10b981]">(필수)</span>
            </label>
            <input
              id="subscription-buyer-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="홍길동"
              className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-800 outline-none focus:border-[#1A3C6E]"
            />
          </div>
          <div>
            <label htmlFor="subscription-buyer-email" className="block text-xs font-bold text-gray-500 mb-1">
              구매자 이메일 <span className="text-[#10b981]">(필수)</span>
            </label>
            <input
              id="subscription-buyer-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-800 outline-none focus:border-[#1A3C6E]"
            />
          </div>
          <div>
            <label htmlFor="subscription-buyer-phone" className="block text-xs font-bold text-gray-500 mb-1">
              휴대폰 번호 <span className="text-[#10b981]">(필수)</span>
            </label>
            <input
              id="subscription-buyer-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01012345678"
              className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-800 outline-none focus:border-[#1A3C6E]"
            />
          </div>
        </div>

        <button
          onClick={() => handleSubscribe()}
          disabled={loading || authLoading}
          className="w-full bg-[#1A3C6E] hover:bg-[#142f57] text-white font-black text-base py-4 rounded-2xl transition-colors disabled:opacity-50 mb-3"
        >
          {loading ? '결제 처리 중...' : '💳 KG이니시스 정기결제창 열기'}
        </button>

        <p className="text-center text-xs text-gray-400 mb-2">
          모든 결제는 회원가입 또는 로그인 후 계정 기준으로 진행됩니다
        </p>

        <p className="text-center text-xs mb-2">
          <Link to="/payment/single" className="text-[#1A3C6E] underline">
            자동갱신 없이 1개월만 이용하려면 → 단건결제
          </Link>
        </p>

        <BusinessInfoNotice className="mb-2" />

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
