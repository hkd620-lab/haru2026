import { useEffect, useRef, useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { httpsCallable } from 'firebase/functions';
import { Link } from 'react-router-dom';
import { functions } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BusinessInfoNotice } from '../components/BusinessInfoNotice';

type PaymentResponse = {
  code?: string;
  message?: string;
  paymentId?: string;
};
type SinglePaymentRequestResult = {
  paymentId: string;
  storeId: string;
  orderName: string;
  amount: number;
  currency: 'KRW';
  customData: Record<string, unknown>;
};

type PaidPlan = 'basic' | 'premium';

const SINGLE_PAYMENT_PRODUCTS: Record<PaidPlan, {
  title: string;
  orderName: string;
  amount: number;
  amountLabel: string;
  description: string;
}> = {
  basic: {
    title: '베이직',
    orderName: 'HARU2026 베이직 1개월 이용권',
    amount: 4000,
    amountLabel: '4,000원 (부가세 포함)',
    description: '자동갱신 없이 30일 동안 베이직 기능을 이용합니다.',
  },
  premium: {
    title: '프리미엄',
    orderName: 'HARU2026 프리미엄 1개월 이용권',
    amount: 6000,
    amountLabel: '6,000원 (부가세 포함)',
    description: '자동갱신 없이 30일 동안 프리미엄 기능을 이용합니다.',
  },
};
const SINGLE_PAYMENT_PAY_METHOD = import.meta.env.VITE_PORTONE_SINGLE_PAYMENT_PAY_METHOD || 'EASY_PAY';

export default function SinglePaymentPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>('premium');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const redirectProcessedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    setFullName((prev) => prev || user.displayName || '');
    setEmail((prev) => prev || user.email || '');
  }, [user]);

  useEffect(() => {
    if (authLoading || redirectProcessedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const redirectedPaymentId = params.get('paymentId');
    const redirectedPlan = params.get('plan') === 'basic' ? 'basic' : 'premium';
    if (!redirectedPaymentId) return;
    redirectProcessedRef.current = true;

    let cancelled = false;
    const verifyRedirectPayment = async () => {
      if (!user) {
        setResultMessage('결제 확인을 위해 로그인이 필요합니다.');
        return;
      }
      setLoading(true);
      try {
        const verifySinglePayment = httpsCallable(functions, 'verifySinglePayment');
        await verifySinglePayment({ paymentId: redirectedPaymentId });
        if (!cancelled) setResultMessage(`${SINGLE_PAYMENT_PRODUCTS[redirectedPlan].title} 1개월 이용권 결제가 완료되었습니다.`);
      } catch (error: any) {
        console.error('단건결제 검증 오류:', error);
        if (!cancelled) setResultMessage(error?.message || '결제 검증에 실패했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verifyRedirectPayment();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const handleSinglePayment = async () => {
    if (authLoading) return;
    if (!user) {
      setResultMessage('HARU2026 이용권은 기록 데이터와 연결되므로 로그인 후 결제할 수 있습니다.');
      return;
    }
    if (!withdrawalConsent) {
      setResultMessage('청약철회 제한 및 환불정책 안내에 동의해 주세요.');
      return;
    }
    setLoading(true);
    setResultMessage('');

    try {
      const kakaoPayChannelKey = import.meta.env.VITE_PORTONE_KAKAOPAY_CHANNEL_KEY
        || import.meta.env.VITE_PORTONE_KAKAOPAY_BILLING_CHANNEL_KEY
        || import.meta.env.VITE_PORTONE_CHANNEL_KEY;
      if (!kakaoPayChannelKey) {
        throw new Error('카카오페이 결제 채널 키가 설정되지 않았습니다.');
      }

      const trimmedName = fullName.trim();
      if (!trimmedName) {
        setResultMessage('구매자 이름을 입력해 주세요.');
        return;
      }

      const trimmedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setResultMessage('카카오페이 결제는 구매자 이메일이 필수입니다. 이메일을 입력해 주세요.');
        return;
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      if (normalizedPhone.length < 10) {
        setResultMessage('카카오페이 결제는 구매자 휴대폰 번호가 필수입니다. 휴대폰 번호를 입력해 주세요.');
        return;
      }

      const createSinglePaymentRequest = httpsCallable(functions, 'createSinglePaymentRequest');
      const requestResult = await createSinglePaymentRequest({ plan: selectedPlan });
      const paymentRequest = requestResult.data as SinglePaymentRequestResult;
      const response = await (PortOne as any).requestPayment({
        storeId: paymentRequest.storeId,
        channelKey: kakaoPayChannelKey,
        paymentId: paymentRequest.paymentId,
        orderName: paymentRequest.orderName,
        totalAmount: paymentRequest.amount,
        currency: paymentRequest.currency,
        payMethod: SINGLE_PAYMENT_PAY_METHOD,
        customer: {
          fullName: trimmedName,
          email: trimmedEmail,
          phoneNumber: normalizedPhone,
        },
        products: [
          {
            id: `haru2026-${selectedPlan}-one-month-pass`,
            name: paymentRequest.orderName,
            amount: paymentRequest.amount,
            quantity: 1,
          },
        ],
        customData: {
          ...paymentRequest.customData,
          purpose: 'kakaopay_one_month_pass',
          durationDays: 30,
          guestAllowed: false,
        },
        redirectUrl: `${window.location.origin}/payment/single?plan=${selectedPlan}`,
      }) as PaymentResponse | undefined;

      if (!response) {
        setResultMessage('결제가 완료되지 않았습니다.');
        return;
      }

      if (response.code) {
        setResultMessage(response.message || '결제가 취소되었습니다.');
        return;
      }

      const completedPaymentId = response.paymentId;
      if (!completedPaymentId) {
        throw new Error('결제 결과가 올바르지 않습니다.');
      }

      const verifySinglePayment = httpsCallable(functions, 'verifySinglePayment');
      await verifySinglePayment({ paymentId: completedPaymentId });
      setResultMessage(`${SINGLE_PAYMENT_PRODUCTS[selectedPlan].title} 1개월 이용권 결제가 완료되었습니다.`);
    } catch (error: any) {
      console.error('단건결제 오류:', error);
      setResultMessage(error?.message || '결제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = SINGLE_PAYMENT_PRODUCTS[selectedPlan];

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-md bg-white border border-[#e5decf] rounded-lg shadow-sm p-6 text-center">
          <p className="text-xs font-bold text-[#4F46E5] mb-2">카카오페이 일반결제</p>
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-3">HARU2026 1개월 이용권</h1>
          <p className="text-sm font-bold text-gray-700 mb-5">결제는 로그인 후 이용할 수 있습니다.</p>
          <p className="text-xs leading-5 text-gray-500 mb-5">
            비회원 구매는 제공하지 않습니다. 심사자는 전달받은 테스트 계정으로 로그인 후 일반결제 흐름을 확인할 수 있습니다.
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
          <p className="text-xs font-bold text-[#4F46E5] mb-2">카카오페이 일반결제</p>
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-2">HARU2026 1개월 이용권</h1>
          <p className="text-sm text-gray-600">자동갱신 없는 30일 이용권입니다. 정기결제와 구분되는 단건 일반결제 상품입니다.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5 text-xs leading-5">
          <div className="rounded-lg border border-[#4F46E5] bg-[#EEF4FF] p-3">
            <p className="font-black text-[#1A3C6E] mb-1">일반결제</p>
            <p className="text-gray-600">1회 결제 후 30일 이용</p>
          </div>
          <div className="rounded-lg border border-[#e5decf] p-3">
            <p className="font-black text-gray-600 mb-1">정기결제</p>
            <p className="text-gray-500">매월 자동결제 구독</p>
            <Link to="/subscription" className="mt-1 inline-block font-bold text-[#1A3C6E] underline">
              정기결제 보기
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {(Object.keys(SINGLE_PAYMENT_PRODUCTS) as PaidPlan[]).map((planId) => {
            const product = SINGLE_PAYMENT_PRODUCTS[planId];
            const isSelected = selectedPlan === planId;

            return (
              <button
                key={planId}
                type="button"
                onClick={() => setSelectedPlan(planId)}
                disabled={loading}
                className="rounded-lg border px-3 py-3 text-left transition-all disabled:opacity-50"
                style={{
                  borderColor: isSelected ? '#1A3C6E' : '#e5decf',
                  backgroundColor: isSelected ? '#EEF4FF' : '#fff',
                }}
              >
                <p className="text-sm font-black text-[#1A3C6E]">{product.title}</p>
                <p className="mt-1 text-lg font-black text-gray-800">{product.amountLabel}</p>
                <p className="mt-1 text-xs leading-4 text-gray-500">{product.description}</p>
              </button>
            );
          })}
        </div>

        <div className="border-y border-gray-100 py-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">상품명</span>
            <span className="text-sm font-bold text-gray-800">{selectedProduct.orderName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">결제금액</span>
            <span className="text-2xl font-black text-[#1A3C6E]">{selectedProduct.amountLabel}</span>
          </div>
          <p className="mt-3 text-xs text-gray-400">자동갱신 없음 · 정기결제 아님 · 30일 이용권</p>
        </div>

        <div className="mb-5">
          <label htmlFor="single-payment-name" className="mb-1.5 block text-sm text-gray-500">
            구매자 이름 <span className="text-[#4F46E5]">(필수)</span>
          </label>
          <input
            id="single-payment-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="홍길동"
            className="w-full rounded-lg border border-[#e5decf] px-4 py-3 text-base text-gray-800 outline-none focus:border-[#1A3C6E]"
          />
        </div>

        <div className="mb-5">
          <label htmlFor="single-payment-email" className="mb-1.5 block text-sm text-gray-500">
            구매자 이메일 <span className="text-[#4F46E5]">(필수)</span>
          </label>
          <input
            id="single-payment-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className="w-full rounded-lg border border-[#e5decf] px-4 py-3 text-base text-gray-800 outline-none focus:border-[#1A3C6E]"
          />
          <p className="mt-1.5 text-xs text-gray-400">카카오페이 결제 영수증 발송을 위해 이메일이 필요합니다.</p>
        </div>

        <div className="mb-5">
          <label htmlFor="single-payment-phone" className="mb-1.5 block text-sm text-gray-500">
            휴대폰 번호 <span className="text-[#4F46E5]">(필수)</span>
          </label>
          <input
            id="single-payment-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
            className="w-full rounded-lg border border-[#e5decf] px-4 py-3 text-base text-gray-800 outline-none focus:border-[#1A3C6E]"
          />
          <p className="mt-1.5 text-xs text-gray-400">카카오페이 결제 승인을 위해 휴대폰 번호가 필요합니다.</p>
        </div>

        <div className="mb-5 rounded-lg border border-[#e5decf] bg-[#FAF8F2] p-4 text-xs leading-5 text-gray-600">
          <p>서비스를 즉시 이용하면 청약철회 및 전액 환불이 제한될 수 있음에 동의합니다.</p>
          <p className="mt-1">
            결제 후 7일 이내이고 서비스 이용 이력이 없는 경우 전액 환불이 가능합니다.{' '}
            <Link to="/refund" className="font-bold text-[#1A3C6E] underline">환불정책 확인</Link>
          </p>
          <label htmlFor="single-payment-withdrawal-consent" className="mt-3 flex items-start gap-2 cursor-pointer">
            <input
              id="single-payment-withdrawal-consent"
              type="checkbox"
              checked={withdrawalConsent}
              onChange={(e) => setWithdrawalConsent(e.target.checked)}
              className="mt-0.5"
              style={{ accentColor: '#1A3C6E' }}
            />
            <span className="font-bold text-gray-800">청약철회 제한 및 환불정책 안내에 동의합니다.</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleSinglePayment}
          disabled={loading || !withdrawalConsent}
          className="w-full rounded-lg bg-[#1A3C6E] px-4 py-4 text-base font-black text-white transition-colors hover:bg-[#142f57] disabled:opacity-50"
        >
          {loading ? '결제 처리 중...' : `${selectedProduct.title} 1개월 이용권 결제`}
        </button>

        {resultMessage && (
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-center">
            <p className="text-sm font-bold text-gray-700">{resultMessage}</p>
            {resultMessage.includes('완료') && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Link to="/settings" className="rounded-lg bg-[#1A3C6E] px-4 py-3 text-sm font-black text-white">
                  결제/구독 상태 확인
                </Link>
                <Link to="/" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-[#1A3C6E]">
                  서비스 이용하기
                </Link>
              </div>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-gray-400">
          HARU2026 이용권은 기록 데이터와 연결되므로 회원 계정 기준으로만 처리됩니다.
        </p>

        <p className="mt-3 text-center text-xs leading-5 text-gray-400">
          환불은 결제 후 7일 이내이고 서비스 이용 이력이 없는 경우 전액 환불이 가능합니다. <Link to="/refund" className="text-[#1A3C6E] underline">환불정책 확인</Link>
        </p>

        <BusinessInfoNotice className="mt-3" />
      </section>
    </div>
  );
}
