import { useEffect, useMemo, useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';

type BillingKeyResponse = {
  code?: string;
  message?: string;
  billingKey?: string;
};

const INICIS_BILLING_PRODUCT = {
  issueName: 'HARU2026 정기결제 카드 등록',
};

export default function SubscriptionInicisPage() {
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const issueId = useMemo(() => `haru-inicis-billing-${Date.now()}`, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectedCode = params.get('code');
    const redirectedBillingKey = params.get('billingKey');
    if (!redirectedCode && !redirectedBillingKey) return;

    if (redirectedCode) {
      setResultMessage(params.get('message') || '카드 등록이 취소되었습니다.');
      return;
    }
    if (redirectedBillingKey) {
      setResultMessage('KG이니시스 빌링키(정기결제 카드)가 정상 발급되었습니다.');
    }
  }, []);

  const handleIssueBillingKey = async () => {
    setLoading(true);
    setResultMessage('');

    try {
      const inicisBillingChannelKey = import.meta.env.VITE_PORTONE_INICIS_BILLING_CHANNEL_KEY;
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

      const response = await (PortOne as any).requestIssueBillingKey({
        storeId: import.meta.env.VITE_PORTONE_STORE_ID,
        channelKey: inicisBillingChannelKey,
        billingKeyMethod: 'CARD',
        issueId,
        issueName: INICIS_BILLING_PRODUCT.issueName,
        customer: {
          fullName: trimmedName,
          email: trimmedEmail,
          phoneNumber: normalizedPhone,
        },
        redirectUrl: `${window.location.origin}/subscription/inicis`,
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

      setResultMessage('KG이니시스 빌링키(정기결제 카드)가 정상 발급되었습니다.');
    } catch (error: any) {
      console.error('KG이니시스 정기결제 빌링키 발급 오류:', error);
      setResultMessage(error?.message || '카드 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white border border-[#e5decf] rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <p className="text-xs font-bold text-[#4F46E5] mb-2">KG이니시스 심사용 정기결제</p>
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-2">HARU2026 정기결제 카드 등록</h1>
          <p className="text-sm text-gray-600">KG이니시스 빌링키(정기결제 카드) 발급창을 확인하는 심사용 페이지입니다.</p>
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
          disabled={loading}
          className="w-full rounded-lg bg-[#1A3C6E] px-4 py-4 text-base font-black text-white transition-colors hover:bg-[#142f57] disabled:opacity-50"
        >
          {loading ? '카드 등록 처리 중...' : '정기결제 카드 등록창 열기'}
        </button>

        {resultMessage && (
          <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-center text-sm font-bold text-gray-700">
            {resultMessage}
          </p>
        )}

        <p className="mt-5 text-center text-xs leading-5 text-gray-400">
          이 페이지는 KG이니시스 심사용 정기결제(빌링키 발급) 확인 용도이며 기존 토스페이 정기결제와 분리되어 있습니다.
        </p>
      </section>
    </div>
  );
}
