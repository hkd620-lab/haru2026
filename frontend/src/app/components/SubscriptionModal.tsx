import { X, Crown, Check } from 'lucide-react';

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  daysRemaining: number;
}

const plans = [
  {
    id: 'free',
    name: '무료',
    nameEn: 'Free',
    price: '₩0',
    period: '/월',
    features: [
      '기본 기록 작성 및 조회',
      'SAYU AI 다듬기 기존 제한 내 이용',
      '독서 OCR 월 20장',
      '결제·빌링키 등록 없음',
    ],
    popular: false,
    available: false,
    statusLabel: '현재 이용 가능',
  },
  {
    id: 'basic',
    name: '베이직',
    nameEn: 'Basic',
    price: '₩4,000',
    period: '/월',
    features: [
      'EPUB 저장',
      '하루LAW 결과 대화',
      'SNS 하루탭',
      '독서 OCR 월 100장',
    ],
    popular: true,
    available: true,
    statusLabel: '구독 가능',
  },
  {
    id: 'premium',
    name: '프리미엄',
    nameEn: 'Premium',
    price: '₩6,000 예정',
    period: '/월',
    features: [
      '독서 OCR 월 300장 예정',
      '장기 범위 합본 준비 중',
      '장기 범위 통계 준비 중',
      '식물탐정 프리미엄 판정 유지',
    ],
    popular: false,
    available: false,
    statusLabel: '준비 중',
  },
];

export function SubscriptionModal({ open, onClose, daysRemaining }: SubscriptionModalProps) {
  if (!open) return null;

  const handleSubscribe = (planId: string) => {
    if (planId !== 'basic') return;
    window.location.href = '/subscription?plan=basic';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="px-6 py-8 border-b relative overflow-hidden"
          style={{ 
            borderColor: '#e5e5e5',
            background: 'linear-gradient(135deg, #003366 0%, #2D5F8D 100%)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded hover:bg-white/10 transition-all"
            style={{ color: '#F9F8F3' }}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Crown className="w-8 h-8" style={{ color: '#F9F8F3' }} />
              <h2 className="text-2xl md:text-3xl tracking-wide" style={{ color: '#F9F8F3' }}>
                HARU2026 구독 안내
              </h2>
            </div>
            <p className="text-sm mb-4" style={{ color: '#B5D5F0' }}>
              현재 결제 가능한 유료 플랜은 베이직 월 4,000원입니다
            </p>
          </div>
        </div>

        {/* Plans */}
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="relative rounded-lg p-6 border-2 transition-all hover:shadow-lg"
                style={{
                  borderColor: plan.popular ? '#003366' : '#e5e5e5',
                  backgroundColor: plan.popular ? '#F9F8F3' : '#fff',
                }}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs"
                    style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
                  >
                    구독 가능
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6 pt-2">
                  <h3 className="text-lg mb-1 tracking-wide" style={{ color: '#003366' }}>
                    {plan.name}
                  </h3>
                  <p className="text-xs mb-4" style={{ color: '#999999' }}>
                    {plan.nameEn}
                  </p>
                  <p className="mb-3 inline-block rounded-full px-3 py-1 text-xs" style={{ backgroundColor: '#EEF4FF', color: '#003366' }}>
                    {plan.statusLabel}
                  </p>
                  
                  <div className="flex items-baseline justify-center">
                    <span className="text-3xl md:text-4xl" style={{ color: '#003366' }}>
                      {plan.price}
                    </span>
                    <span className="text-sm ml-1" style={{ color: '#999999' }}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#003366' }} />
                      <span className="text-sm" style={{ color: '#666666' }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subscribe Button */}
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={!plan.available}
                  className="w-full py-3 rounded-lg text-sm tracking-wide transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    backgroundColor: plan.popular ? '#003366' : '#F9F8F3',
                    color: plan.popular ? '#F9F8F3' : '#003366',
                    border: plan.popular ? 'none' : '1px solid #e5e5e5',
                  }}
                >
                  {plan.available ? '베이직 구독하기' : plan.statusLabel}
                </button>
              </div>
            ))}
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-6 border-t text-center" style={{ borderColor: '#e5e5e5' }}>
            <p className="text-xs leading-relaxed mb-2" style={{ color: '#999999' }}>
              베이직 구독은 설정 화면에서 언제든지 해지할 수 있습니다
            </p>
            <p className="text-xs leading-relaxed" style={{ color: '#999999' }}>
              프리미엄은 준비 중이며 이번 출시에서는 결제되지 않습니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
