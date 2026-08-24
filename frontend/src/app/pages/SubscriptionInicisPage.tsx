import { useEffect, useRef, useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { httpsCallable } from 'firebase/functions';
import { Link } from 'react-router-dom';
import { functions } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

type BillingKeyResponse = {
  code?: string;
  message?: string;
  billingKey?: string;
};

type PaidPlan = 'basic' | 'premium';

const INICIS_BILLING_PLANS: Record<PaidPlan, { title: string; orderName: string; amount: number; priceLabel: string }> = {
  basic: {
    title: '베이직',
    orderName: 'HARU2026 베이직 1개월 정기구독',
    amount: 4000,
    priceLabel: '4,000원 / 월 (부가세 포함)',
  },
  premium: {
    title: '프리미엄',
    orderName: 'HARU2026 프리미엄 1개월 정기구독',
    amount: 6000,
    priceLabel: '6,000원 / 월 (부가세 포함)',
  },
};

export default function SubscriptionInicisPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>('premium');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const redirectProcessedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    setFullName((prev) => prev || user.displayName || '');
    setEmail((prev) => prev || user.email || '');
  }, [user]);

  useEffect(() => {
    if (authLoading || redirectProcessedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const redirectedCode = params.get('code');
    const redirectedBillingKey = params.get('billingKey');
    if (!redirectedCode && !redirectedBillingKey) return;
    redirectProcessedRef.current = true;

    if (redirectedCode) {
      setResultMessage(params.get('message') || '카드 등록이 취소되었습니다.');
      return;
    }
    if (redirectedBillingKey) {
      if (!user) {
        setResultMessage('정기결제 처리를 위해 로그인이 필요합니다.');
        return;
      }

      const planParam = params.get('plan');
      const redirectedPlan: PaidPlan = planParam === 'basic' || planParam === 'premium' ? planParam : selectedPlan;
      const subscribeWithBillingKey = httpsCallable(functions, 'subscribeWithBillingKey');
      setLoading(true);
      subscribeWithBillingKey({
        billingKey: redirectedBillingKey,
        plan: redirectedPlan,
        payMethod: 'kg_inicis_card',
      })
        .then(() => {
          setResultMessage(`${INICIS_BILLING_PLANS[redirectedPlan].orderName} 결제가 완료되었습니다. 설정 화면에서 구독 상태를 확인할 수 있습니다.`);
          window.history.replaceState({}, '', '/subscription/inicis');
        })
        .catch((error: any) => {
          console.error('KG이니시스 정기결제 리다이렉트 처리 오류:', error);
          setResultMessage(error?.message || '정기결제 처리 중 오류가 발생했습니다.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [authLoading, selectedPlan, user]);

  const handleIssueBillingKey = async () => {
    if (authLoading) return;
    if (!user) {
      setResultMessage('로그인 후 정기결제를 신청할 수 있습니다.');
      return;
    }
    setLoading(true);
    setResultMessage('');

    try {
      const inicisBillingChannelKey = import.meta.env.VITE_PORTONE_INICIS_BILLING_CHANNEL_KEY || import.meta.env.VITE_PORTONE_CHANNEL_KEY;
      if (!inicisBillingChannelKey) {
        throw new Error('KG이니시스 정기결제 채널 키가 설정되지 않았습니다.');
      }

      const trimmedName = fullName.trim();
      if (!trimmedName) {
        setResultMessage('이니시스 정기결제는 구매자 이름이 필수입니다. 이름을 입력해 주세요.');
        return;
      }

      const trimmedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setResultMessage('이니시스 정기결제는 구매자 이메일이 필수입니다. 이메일을 입력해 주세요.');
        return;
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      if (normalizedPhone.length < 10) {
        setResultMessage('이니시스 정기결제는 구매자 휴대폰 번호가 필수입니다. 휴대폰 번호를 입력해 주세요.');
        return;
      }

      const plan = INICIS_BILLING_PLANS[selectedPlan];
      const issueId = `haru-inicis-billing-${user.uid}-${Date.now()}`;
      const response = await (PortOne as any).requestIssueBillingKey({
        storeId: import.meta.env.VITE_PORTONE_STORE_ID,
        channelKey: inicisBillingChannelKey,
        billingKeyMethod: 'EASY_PAY',
        displayAmount: plan.amount,
        amount: {
          total: plan.amount,
        },
        currency: 'KRW',
        issueId,
        issueName: plan.orderName,
        customer: {
          fullName: trimmedName,
          email: trimmedEmail,
          phoneNumber: normalizedPhone,
        },
        redirectUrl: `${window.location.origin}/subscription/inicis?plan=${selectedPlan}`,
      }) as BillingKeyResponse | undefined;

      if (!response) {
        setResultMessage('카드 등록이 완료되지 않았습니다.');
        return;
      }

      if (response.code) {
        setResultMessage(response.message || '카드 등록이 취소되었습니다.');
        return;
      }

      if (!response.billingKey) {
        throw new Error('빌링키 발급 결과가 올바르지 않습니다.');
      }

      const subscribeWithBillingKey = httpsCallable(functions, 'subscribeWithBillingKey');
      await subscribeWithBillingKey({
        billingKey: response.billingKey,
        plan: selectedPlan,
        payMethod: 'kg_inicis_card',
      });
      setResultMessage(`${plan.orderName} 결제가 완료되었습니다. 설정 화면에서 구독 상태를 확인할 수 있습니다.`);
    } catch (error: any) {
      console.error('KG이니시스 정기결제 빌링키 발급 오류:', error);
      setResultMessage(error?.message || '정기결제 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-md bg-white border border-[#e5decf] rounded-lg shadow-sm p-6 text-center">
          <p className="text-xs font-bold text-[#4F46E5] mb-2">KG이니시스 정기결제</p>
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-3">HARU2026 정기구독 신청</h1>
          <p className="text-sm font-bold text-gray-700 mb-5">결제는 로그인 후 이용할 수 있습니다.</p>
          <p className="text-xs leading-5 text-gray-500 mb-5">
            비회원 구매는 제공하지 않습니다. 심사자는 전달받은 테스트 계정으로 로그인 후 정기결제 흐름을 확인할 수 있습니다.
          </p>
          <Link
            to="/login"
            className="block w-full rounded-lg bg-[#1A3C6E] px-4 py-4 text-base font-black text-white transition-colors hover:bg-[#142f57]"
          >
            로그인하러 가기
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white border border-[#e5decf] rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <p className="text-xs font-bold text-[#4F46E5] mb-2">KG이니시스 정기결제</p>
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-2">HARU2026 1개월 정기구독</h1>
          <p className="text-sm text-gray-600">1개월 단위로 자동 갱신되는 구독 상품입니다. KG이니시스 정기결제창에서 카드를 등록하고 첫 결제를 진행합니다.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5 text-xs leading-5">
          <div className="rounded-lg border border-[#e5decf] p-3">
            <p className="font-black text-gray-600 mb-1">일반결제</p>
            <p className="text-gray-500">1회 결제 후 30일 이용</p>
            <Link to="/payment/single" className="mt-1 inline-block font-bold text-[#1A3C6E] underline">
              일반결제 보기
            </Link>
          </div>
          <div className="rounded-lg border border-[#4F46E5] bg-[#EEF4FF] p-3">
            <p className="font-black text-[#1A3C6E] mb-1">정기결제</p>
            <p className="text-gray-600">매월 자동결제 구독</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {(Object.keys(INICIS_BILLING_PLANS) as PaidPlan[]).map((planId) => {
            const plan = INICIS_BILLING_PLANS[planId];
            const selected = selectedPlan === planId;
            return (
              <button
                key={planId}
                type="button"
                onClick={() => setSelectedPlan(planId)}
                className={`rounded-lg border px-3 py-3 text-left ${selected ? 'border-[#1A3C6E] bg-[#EEF4FF]' : 'border-[#e5decf] bg-white'}`}
              >
                <div className="text-sm font-black text-[#1A3C6E]">{plan.title}</div>
                <div className="mt-1 text-xs text-gray-500">{plan.priceLabel}</div>
                <div className="mt-1 text-xs font-bold text-[#047857]">1개월 정기구독</div>
              </button>
            );
          })}
        </div>

        <div className="mb-5">
          <label htmlFor="inicis-billing-name" className="mb-1.5 block text-sm text-gray-500">
            구매자 이름 <span className="text-[#4F46E5]">(필수)</span>
          </label>
          <input
            id="inicis-billing-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="홍길동"
            className="w-full rounded-lg border border-[#e5decf] px-4 py-3 text-base text-gray-800 outline-none focus:border-[#1A3C6E]"
          />
        </div>

        <div className="mb-5">
          <label htmlFor="inicis-billing-email" className="mb-1.5 block text-sm text-gray-500">
            구매자 이메일 <span className="text-[#4F46E5]">(필수)</span>
          </label>
          <input
            id="inicis-billing-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full rounded-lg border border-[#e5decf] px-4 py-3 text-base text-gray-800 outline-none focus:border-[#1A3C6E]"
          />
        </div>

        <div className="mb-5">
          <label htmlFor="inicis-billing-phone" className="mb-1.5 block text-sm text-gray-500">
            휴대폰 번호 <span className="text-[#4F46E5]">(필수)</span>
          </label>
          <input
            id="inicis-billing-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
            className="w-full rounded-lg border border-[#e5decf] px-4 py-3 text-base text-gray-800 outline-none focus:border-[#1A3C6E]"
          />
          <p className="mt-1.5 text-xs text-gray-400">이니시스 정기결제 카드 등록을 위해 이름·이메일·휴대폰 번호가 필요합니다.</p>
        </div>

        <button
          type="button"
          onClick={handleIssueBillingKey}
          disabled={loading || authLoading}
          className="w-full rounded-lg bg-[#1A3C6E] px-4 py-4 text-base font-black text-white transition-colors hover:bg-[#142f57] disabled:opacity-50"
        >
          {loading ? '정기결제 처리 중...' : '정기결제창 열기'}
        </button>

        {resultMessage && (
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-center">
            <p className="text-sm font-bold text-gray-700">{resultMessage}</p>
            {resultMessage.includes('완료') && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Link to="/settings" className="rounded-lg bg-[#1A3C6E] px-4 py-3 text-sm font-black text-white">
                  구독 상태 확인
                </Link>
                <Link to="/" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-[#1A3C6E]">
                  서비스 이용하기
                </Link>
              </div>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-gray-400">
          모든 정기결제는 회원가입 또는 로그인 후 계정 기준으로 진행됩니다.
        </p>
        <p className="mt-3 text-center text-xs leading-5 text-gray-400">
          구독은 설정에서 해지할 수 있으며, 환불은 1개월 상품 환불정책에 따릅니다. <Link to="/refund" className="text-[#1A3C6E] underline">환불정책 확인</Link>
        </p>
      </section>
    </div>
  );
}
