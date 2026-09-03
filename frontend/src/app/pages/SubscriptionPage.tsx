import { useEffect, useRef, useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BusinessInfoNotice } from '../components/BusinessInfoNotice';

type PaidPlan = 'basic' | 'premium';
type SubscriptionPaymentMethod = 'card' | 'kakaopay';
type SubscriptionPaymentProvider = 'kg_inicis' | 'kakaopay';
type SubscriptionBillingKeyMethod = 'CARD' | 'EASY_PAY';
type BillingKeyResponse = {
  code?: string;
  message?: string;
  billingKey?: string;
};
type SubscriptionBillingRequestResult = {
  issueId: string;
  storeId: string;
  issueName: string;
  amount: number;
  currency: 'KRW';
  customData: Record<string, unknown>;
  success?: boolean;
  pending?: boolean;
  status?: string;
  existing?: boolean;
  plan?: PaidPlan;
  provider?: SubscriptionPaymentProvider;
  payMethod?: string;
};
type SubscriptionPaymentMethodConfig = {
  label: string;
  description: string;
  provider: SubscriptionPaymentProvider;
  payMethod: string;
  billingKeyMethod: SubscriptionBillingKeyMethod;
};
type SubscribeWithBillingKeyRequest = {
  billingKey: string;
  plan: PaidPlan;
  issueId: string;
  provider: SubscriptionPaymentProvider;
  payMethod: string;
};
type SubscribeWithBillingKeyResult = {
  success: boolean;
  alreadyProcessed?: boolean;
  pending?: boolean;
  status?: string;
};
type PendingSubscriptionRecovery = {
  plan: PaidPlan;
  method: SubscriptionPaymentMethod;
  issueId: string;
  billingKey?: string;
};
type RecoverSubscriptionBillingRequestResult = SubscribeWithBillingKeyResult & {
  issueId?: string;
  plan?: PaidPlan;
  provider?: SubscriptionPaymentProvider;
  payMethod?: string;
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
    orderName: 'HARU2026 베이직 1개월 정기구독',
    amount: 4000,
    priceLabel: '₩4,000',
    description: '1개월 단위로 자동 갱신되는 기본 구독입니다',
    features: [
      '12종 기록 형식',
      'SAYU AI 다듬기',
      '기록 저장 및 조회',
      'TEXT/HTML 출력',
    ],
  },
  premium: {
    title: '프리미엄',
    orderName: 'HARU2026 프리미엄 1개월 정기구독',
    amount: 6000,
    priceLabel: '₩6,000',
    description: '1개월 단위로 자동 갱신되는 확장 구독입니다',
    features: [
      '베이직 모든 기능',
      'SAYU PDF 저장',
      '월간/분기/연간 기록합침',
      '월간/분기/연간 통계',
    ],
  },
};

const SUBSCRIPTION_PAYMENT_METHODS: Record<SubscriptionPaymentMethod, SubscriptionPaymentMethodConfig> = {
  card: {
    label: '신용·체크카드',
    description: 'KG이니시스 카드 정기결제',
    provider: 'kg_inicis',
    payMethod: 'kg_inicis_card',
    billingKeyMethod: 'CARD',
  },
  kakaopay: {
    label: '카카오페이',
    description: '카카오페이 간편 정기결제',
    provider: 'kakaopay',
    payMethod: 'kakaopay_easy_pay',
    billingKeyMethod: 'EASY_PAY',
  },
};
const SUBSCRIPTION_PENDING_MESSAGE = '결제 상태를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.';
const SUBSCRIPTION_RECOVERY_STORAGE_KEY = 'haru.subscription.pendingBillingKey';

function getSubscriptionPaymentMethod(value: string | null): SubscriptionPaymentMethod | null {
  return value === 'card' || value === 'kakaopay' ? value : null;
}

function getSubscriptionPaymentMethodForProvider(provider: SubscriptionPaymentProvider | undefined): SubscriptionPaymentMethod {
  return provider === 'kakaopay' ? 'kakaopay' : 'card';
}

function isSubscriptionPaymentComplete(result: SubscribeWithBillingKeyResult): boolean {
  return result.success === true && result.pending !== true;
}

function parsePendingSubscriptionRecovery(value: string | null): PendingSubscriptionRecovery | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PendingSubscriptionRecovery>;
    const method = getSubscriptionPaymentMethod(parsed.method || null);
    const plan = parsed.plan === 'basic' || parsed.plan === 'premium' ? parsed.plan : null;
    if (!plan || !method || !parsed.issueId) return null;
    return {
      plan,
      method,
      issueId: parsed.issueId,
      billingKey: typeof parsed.billingKey === 'string' && parsed.billingKey ? parsed.billingKey : undefined,
    };
  } catch {
    return null;
  }
}

function readPendingSubscriptionRecovery(): PendingSubscriptionRecovery | null {
  if (typeof window === 'undefined') return null;
  try {
    return parsePendingSubscriptionRecovery(window.sessionStorage.getItem(SUBSCRIPTION_RECOVERY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writePendingSubscriptionRecovery(recovery: PendingSubscriptionRecovery): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SUBSCRIPTION_RECOVERY_STORAGE_KEY, JSON.stringify(recovery));
  } catch {
    // A failed session write should not start a second payment attempt.
  }
}

function removePendingSubscriptionRecovery(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SUBSCRIPTION_RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; server state remains authoritative.
  }
}

function isTerminalSubscriptionStatus(status?: string): boolean {
  const normalized = status?.toUpperCase() || '';
  return normalized.includes('FAILED') || normalized.includes('CANCEL');
}

function isTerminalSubscriptionError(error: any): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === 'functions/failed-precondition'
    && (message.includes('실패') || message.includes('취소'));
}

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>('premium');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<SubscriptionPaymentMethod>('card');
  const [pendingSubscriptionRecovery, setPendingSubscriptionRecovery] = useState<PendingSubscriptionRecovery | null>(() => readPendingSubscriptionRecovery());
  const redirectProcessedRef = useRef(false);

  const savePendingSubscriptionRecovery = (recovery: PendingSubscriptionRecovery) => {
    writePendingSubscriptionRecovery(recovery);
    setPendingSubscriptionRecovery(recovery);
  };

  const clearPendingSubscriptionRecovery = () => {
    removePendingSubscriptionRecovery();
    setPendingSubscriptionRecovery(null);
  };

  const confirmPendingSubscription = async (recovery: PendingSubscriptionRecovery): Promise<boolean> => {
    const functions = getFunctions(undefined, 'asia-northeast3');
    const paymentMethodConfig = SUBSCRIPTION_PAYMENT_METHODS[recovery.method];
    const result = recovery.billingKey
      ? await httpsCallable<SubscribeWithBillingKeyRequest, SubscribeWithBillingKeyResult>(functions, 'subscribeWithBillingKey')({
        billingKey: recovery.billingKey,
        plan: recovery.plan,
        issueId: recovery.issueId,
        provider: paymentMethodConfig.provider,
        payMethod: paymentMethodConfig.payMethod,
      })
      : await httpsCallable<Record<string, never>, RecoverSubscriptionBillingRequestResult>(functions, 'recoverSubscriptionBillingRequest')({});
    const subscribeResult = result.data;

    if (subscribeResult.pending === true) {
      if ('issueId' in subscribeResult && subscribeResult.issueId && subscribeResult.plan) {
        const method = getSubscriptionPaymentMethodForProvider(subscribeResult.provider);
        setPendingSubscriptionRecovery({
          plan: subscribeResult.plan,
          method,
          issueId: subscribeResult.issueId,
        });
        setSelectedPlan(subscribeResult.plan);
        setSelectedPaymentMethod(method);
      }
      setResultMessage(SUBSCRIPTION_PENDING_MESSAGE);
      return false;
    }
    if (!isSubscriptionPaymentComplete(subscribeResult)) {
      if (isTerminalSubscriptionStatus(subscribeResult.status)) {
        clearPendingSubscriptionRecovery();
      }
      throw new Error('정기결제 처리 결과가 완료 상태가 아닙니다.');
    }

    clearPendingSubscriptionRecovery();
    setResultMessage(`${PLANS[recovery.plan].orderName} ${paymentMethodConfig.label} 결제가 완료되었습니다. 설정 화면에서 구독 상태를 확인할 수 있습니다.`);
    return true;
  };

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (plan === 'basic' || plan === 'premium') {
      setSelectedPlan(plan);
    }
    const paymentMethod = getSubscriptionPaymentMethod(searchParams.get('method'));
    if (paymentMethod) {
      setSelectedPaymentMethod(paymentMethod);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    setFullName((prev) => prev || user.displayName || '');
    setEmail((prev) => prev || user.email || '');
  }, [user]);

  useEffect(() => {
    const recovery = readPendingSubscriptionRecovery();
    if (!recovery) return;
    setPendingSubscriptionRecovery(recovery);
    setSelectedPlan(recovery.plan);
    setSelectedPaymentMethod(recovery.method);
    setResultMessage((prev) => prev || SUBSCRIPTION_PENDING_MESSAGE);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    if (searchParams.get('billingKey') || searchParams.get('code')) return;
    if (readPendingSubscriptionRecovery()) return;

    let cancelled = false;
    const recoverFromServer = async () => {
      try {
        const functions = getFunctions(undefined, 'asia-northeast3');
        const recoverSubscriptionBillingRequest = httpsCallable<Record<string, never>, RecoverSubscriptionBillingRequestResult>(functions, 'recoverSubscriptionBillingRequest');
        const result = await recoverSubscriptionBillingRequest({});
        if (cancelled) return;
        const recoveryResult = result.data;
        if (recoveryResult.pending === true && recoveryResult.issueId && recoveryResult.plan) {
          const method = getSubscriptionPaymentMethodForProvider(recoveryResult.provider);
          setPendingSubscriptionRecovery({
            plan: recoveryResult.plan,
            method,
            issueId: recoveryResult.issueId,
          });
          setSelectedPlan(recoveryResult.plan);
          setSelectedPaymentMethod(method);
          setResultMessage(SUBSCRIPTION_PENDING_MESSAGE);
        }
      } catch (error) {
        console.error('서버 정기결제 복구 확인 오류:', error);
      }
    };

    recoverFromServer();
    return () => {
      cancelled = true;
    };
  }, [authLoading, searchParams, user]);

  useEffect(() => {
    if (authLoading || redirectProcessedRef.current) return;
    const redirectedCode = searchParams.get('code');
    const redirectedBillingKey = searchParams.get('billingKey');
    const redirectedIssueId = searchParams.get('issueId');
    const redirectedPaymentMethod = getSubscriptionPaymentMethod(searchParams.get('method'))
      || (redirectedIssueId ? 'kakaopay' : 'card');
    if (!redirectedCode && !redirectedBillingKey) return;

    redirectProcessedRef.current = true;
    setSelectedPaymentMethod(redirectedPaymentMethod);
    if (redirectedCode) {
      alert(searchParams.get('message') || '카드 등록이 취소되었습니다.');
      return;
    }

    if (!user || !redirectedBillingKey) {
      alert('정기결제 확인을 위해 로그인이 필요합니다.');
      return;
    }
    if (!redirectedIssueId) {
      alert('정기결제 요청 정보를 찾을 수 없습니다.');
      return;
    }

    const planParam = searchParams.get('plan');
    const redirectedPlan: PaidPlan = planParam === 'basic' || planParam === 'premium' ? planParam : selectedPlan;
    const recovery = {
      plan: redirectedPlan,
      method: redirectedPaymentMethod,
      issueId: redirectedIssueId,
      billingKey: redirectedBillingKey,
    };
    savePendingSubscriptionRecovery(recovery);

    setLoading(true);
    confirmPendingSubscription(recovery)
      .then((completed) => {
        if (completed) {
          window.history.replaceState({}, '', '/subscription');
        }
      })
      .catch((error: any) => {
        const paymentMethodConfig = SUBSCRIPTION_PAYMENT_METHODS[redirectedPaymentMethod];
        console.error(`${paymentMethodConfig.label} 정기결제 리다이렉트 처리 오류:`, error);
        if (isTerminalSubscriptionError(error)) {
          clearPendingSubscriptionRecovery();
        }
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
    if (!withdrawalConsent) {
      alert('청약철회 제한 및 환불정책 안내에 동의해 주세요.');
      return;
    }
    const existingRecovery = pendingSubscriptionRecovery || readPendingSubscriptionRecovery();
    if (existingRecovery) {
      setPendingSubscriptionRecovery(existingRecovery);
      setSelectedPlan(existingRecovery.plan);
      setSelectedPaymentMethod(existingRecovery.method);
      setResultMessage(SUBSCRIPTION_PENDING_MESSAGE);
      return;
    }

    setLoading(true);
    setResultMessage('');

    try {
      const trimmedName = fullName.trim();
      if (!trimmedName) {
        alert('구매자 이름을 입력해 주세요.');
        return;
      }

      const trimmedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        alert('정기결제는 구매자 이메일이 필수입니다.');
        return;
      }

      const normalizedPhone = phone.replace(/[^0-9]/g, '');
      if (normalizedPhone.length < 10) {
        alert('정기결제는 구매자 휴대폰 번호가 필수입니다.');
        return;
      }

      const functions = getFunctions(undefined, 'asia-northeast3');
      const createSubscriptionBillingRequest = httpsCallable(functions, 'createSubscriptionBillingRequest');
      const paymentMethodConfig = SUBSCRIPTION_PAYMENT_METHODS[selectedPaymentMethod];
      let channelKey = '';

      if (selectedPaymentMethod === 'kakaopay') {
        channelKey = import.meta.env.VITE_PORTONE_KAKAOPAY_BILLING_CHANNEL_KEY
          || import.meta.env.VITE_PORTONE_KAKAOPAY_CHANNEL_KEY
          || import.meta.env.VITE_PORTONE_CHANNEL_KEY;
        if (!channelKey) {
          throw new Error('카카오페이 결제 채널 키가 설정되지 않았습니다.');
        }
      } else {
        channelKey = import.meta.env.VITE_PORTONE_INICIS_BILLING_CHANNEL_KEY
          || import.meta.env.VITE_PORTONE_CHANNEL_KEY;
        if (!channelKey) {
          throw new Error('KG이니시스 카드 정기결제 채널 키가 설정되지 않았습니다.');
        }
      }

      const requestResult = await createSubscriptionBillingRequest({
        plan: selectedPlan,
        provider: paymentMethodConfig.provider,
        customer: {
          name: trimmedName,
          email: trimmedEmail,
          phoneNumber: normalizedPhone,
        },
      });
      const billingRequest = requestResult.data as SubscriptionBillingRequestResult;
      if (billingRequest.pending === true) {
        const method = getSubscriptionPaymentMethodForProvider(billingRequest.provider);
        setPendingSubscriptionRecovery({
          plan: billingRequest.plan || selectedPlan,
          method,
          issueId: billingRequest.issueId,
        });
        setSelectedPlan(billingRequest.plan || selectedPlan);
        setSelectedPaymentMethod(method);
        setResultMessage(SUBSCRIPTION_PENDING_MESSAGE);
        return;
      }

      const response = await (PortOne as any).requestIssueBillingKey({
        storeId: billingRequest.storeId,
        channelKey,
        billingKeyMethod: paymentMethodConfig.billingKeyMethod,
        displayAmount: billingRequest.amount,
        amount: {
          total: billingRequest.amount,
        },
        currency: billingRequest.currency,
        issueId: billingRequest.issueId,
        issueName: billingRequest.issueName,
        customer: {
          fullName: trimmedName,
          email: trimmedEmail,
          phoneNumber: normalizedPhone,
        },
        customData: billingRequest.customData,
        redirectUrl: `${window.location.origin}/subscription?plan=${selectedPlan}&method=${selectedPaymentMethod}&issueId=${billingRequest.issueId}`,
      }) as BillingKeyResponse;

      if (response?.code) {
        alert('카드 등록이 취소되었습니다.');
        return;
      }

      const billingKey = response?.billingKey;
      if (!billingKey) {
        throw new Error('빌링키 발급 결과가 올바르지 않습니다.');
      }

      const recovery = {
        plan: selectedPlan,
        method: selectedPaymentMethod,
        issueId: billingRequest.issueId,
        billingKey,
      };
      savePendingSubscriptionRecovery(recovery);

      try {
        await confirmPendingSubscription(recovery);
      } catch (error: any) {
        if (isTerminalSubscriptionError(error)) {
          clearPendingSubscriptionRecovery();
        }
        throw error;
      }

    } catch (e: any) {
      console.error('결제 오류:', e);
      const msg = e?.message || '결제 중 오류가 발생했습니다. 다시 시도해 주세요.';
      setResultMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPendingSubscription = async () => {
    if (authLoading) return;
    if (!user) {
      alert('정기결제 확인을 위해 로그인이 필요합니다.');
      return;
    }
    const recovery = pendingSubscriptionRecovery || readPendingSubscriptionRecovery();
    if (!recovery) {
      setResultMessage('');
      return;
    }

    setLoading(true);
    try {
      setSelectedPlan(recovery.plan);
      setSelectedPaymentMethod(recovery.method);
      await confirmPendingSubscription(recovery);
    } catch (error: any) {
      console.error('정기결제 상태 재확인 오류:', error);
      if (isTerminalSubscriptionError(error)) {
        clearPendingSubscriptionRecovery();
      }
      setResultMessage(error?.message || '정기결제 상태 확인 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const selected = PLANS[selectedPlan];
  const selectedPaymentOption = SUBSCRIPTION_PAYMENT_METHODS[selectedPaymentMethod];
  const hasPendingSubscriptionRecovery = pendingSubscriptionRecovery !== null;

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-[#EDE9F5] flex items-center justify-center p-4">
        <section className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-3">HARU 구독 플랜</h1>
          <p className="text-sm font-bold text-gray-700 mb-5">결제는 로그인 후 이용할 수 있습니다.</p>
          <p className="text-xs leading-5 text-gray-500 mb-5">
            비회원 구매는 제공하지 않습니다. 심사자는 전달받은 테스트 계정으로 로그인 후 구독/결제 흐름을 확인할 수 있습니다.
          </p>
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
          <p className="text-sm text-gray-500">1개월 구독 상품과 결제수단을 선택합니다</p>
        </div>

        <div
          className="rounded-2xl p-3 mb-4 text-center"
          style={{
            background: 'linear-gradient(90deg, #1A3C6E 0%, #10b981 100%)',
            color: '#fff',
          }}
        >
          <p className="text-sm font-bold mb-0.5">1개월 정기구독 상품</p>
          <p className="text-[11px] opacity-90">회원 계정 기준으로 구독 상태가 반영되며 비회원 구매는 제공하지 않습니다</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-5">
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="font-black text-[#1A3C6E] mb-1">일반결제</p>
              <p className="text-gray-600">자동갱신 없는 1개월 이용권입니다.</p>
              <Link to="/payment/single" className="mt-2 inline-block font-bold text-[#1A3C6E] underline">
                일반결제 화면으로 이동
              </Link>
            </div>
            <div className="rounded-xl border border-[#10b981] bg-[#F0FDF4] p-3">
              <p className="font-black text-[#047857] mb-1">정기결제</p>
              <p className="text-gray-700">1개월 단위로 자동 갱신되는 구독 상품입니다.</p>
              <p className="mt-2 font-bold text-[#047857]">현재 화면에서 정기결제 진행</p>
            </div>
          </div>
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
                <div className={`text-xs font-bold mb-2 ${isSelected ? 'text-[#bbf7d0]' : 'text-[#047857]'}`}>
                  부가세 포함
                </div>
                <div className={`text-xs font-bold mb-2 ${isSelected ? 'text-[#bbf7d0]' : 'text-[#047857]'}`}>
                  1개월 정기구독 · 매월 자동결제
                </div>
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

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <p className="text-sm font-black text-[#1A3C6E] mb-3">결제수단 선택</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(SUBSCRIPTION_PAYMENT_METHODS) as SubscriptionPaymentMethod[]).map((method) => {
              const option = SUBSCRIPTION_PAYMENT_METHODS[method];
              const isSelected = selectedPaymentMethod === method;
              return (
                <label
                  key={method}
                  htmlFor={`subscription-payment-method-${method}`}
                  className={`rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${isSelected ? 'border-[#1A3C6E] bg-[#EEF4FF]' : 'border-gray-200 bg-white hover:border-[#1A3C6E]/40'}`}
                >
                  <input
                    id={`subscription-payment-method-${method}`}
                    type="radio"
                    name="subscription-payment-method"
                    value={method}
                    checked={isSelected}
                    onChange={() => setSelectedPaymentMethod(method)}
                    disabled={loading}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 text-sm font-black text-[#1A3C6E]">
                    <span aria-hidden="true">{isSelected ? '●' : '○'}</span>
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">{option.description}</span>
                </label>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs mb-3" style={{ color: '#10b981' }}>
          선택 상품: {selected.orderName} · {selected.priceLabel}/월 · 부가세 포함 · {selectedPaymentOption.label} 정기결제 완료 후 즉시 이용 가능
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

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 text-xs leading-5 text-gray-600">
          <p>서비스를 즉시 이용하면 청약철회 및 전액 환불이 제한될 수 있음에 동의합니다.</p>
          <p className="mt-1">
            결제 후 7일 이내이고 서비스 이용 이력이 없는 경우 전액 환불이 가능합니다.{' '}
            <Link to="/refund" className="font-bold text-[#1A3C6E] underline">환불정책 확인</Link>
          </p>
          <label htmlFor="subscription-withdrawal-consent" className="mt-3 flex items-start gap-2 cursor-pointer">
            <input
              id="subscription-withdrawal-consent"
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
          onClick={() => handleSubscribe()}
          disabled={loading || authLoading || !withdrawalConsent || hasPendingSubscriptionRecovery}
          className="w-full bg-[#1A3C6E] hover:bg-[#142f57] text-white font-black text-base py-4 rounded-2xl transition-colors disabled:opacity-50 mb-3"
        >
          {loading ? '결제 처리 중...' : hasPendingSubscriptionRecovery ? '기존 정기결제 상태 확인 필요' : `${selected.title} 1개월 ${selectedPaymentOption.label} 결제창 열기`}
        </button>

        {resultMessage && (
          <div className="rounded-2xl bg-white border border-[#10b981]/40 px-4 py-4 mb-3 text-center">
            <p className="text-sm font-bold text-gray-800">{resultMessage}</p>
            {hasPendingSubscriptionRecovery ? (
              <button
                type="button"
                onClick={() => handleRetryPendingSubscription()}
                disabled={loading || authLoading}
                className="mt-3 w-full rounded-xl bg-[#1A3C6E] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {loading ? '결제 상태 확인 중...' : '결제 상태 다시 확인'}
              </button>
            ) : (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <Link to="/settings" className="flex-1 rounded-xl bg-[#1A3C6E] px-4 py-3 text-sm font-black text-white">
                  구독 상태 확인
                </Link>
                <Link to="/" className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-[#1A3C6E]">
                  서비스 이용하기
                </Link>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mb-2">
          모든 결제는 회원가입 또는 로그인 후 계정 기준으로 진행됩니다
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 text-xs leading-5 text-gray-600">
          <p className="font-black text-[#1A3C6E] mb-1">구독해지 및 환불 안내</p>
          <p>구독은 설정 &gt; 구독 관리에서 언제든 해지할 수 있으며, 해지 시 다음 결제일부터 청구되지 않습니다.</p>
          <p className="mt-1">1개월 구독 환불은 결제 후 7일 이내이고 서비스 이용 이력이 없는 경우 전액 환불이 가능합니다.</p>
          <Link to="/refund" className="mt-2 inline-block font-bold text-[#1A3C6E] underline">
            환불정책 확인
          </Link>
        </div>

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
