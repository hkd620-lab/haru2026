import { X, Crown, Check, Sparkles } from 'lucide-react';

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  daysRemaining: number;
}

const plans = [
  {
    id: 'monthly',
    name: '월간',
    nameEn: 'Monthly',
    price: '₩9,900',
    period: '/월',
    features: [
      '무제한 기록 작성',
      'AI 다이제스트 생성',
      'PDF 내보내기',
      '통계 및 인사이트',
      '클라우드 동기화',
    ],
    popular: false,
  },
  {
    id: 'annual',
    name: '연간',
    nameEn: 'Annual',
    price: '₩99,000',
    period: '/년',
    originalPrice: '₩118,800',
    discount: '17% 할인',
    features: [
      '무제한 기록 작성',
      'AI 다이제스트 생성',
      'PDF 내보내기',
      '통계 및 인사이트',
      '클라우드 동기화',
      '우선 고객 지원',
    ],
    popular: true,
  },
];

export function SubscriptionModal({ open, onClose, daysRemaining }: SubscriptionModalProps) {
  if (!open) return null;

  const handleSubscribe = (planId: string) => {
    alert(`${planId} 플랜 구독 준비 중입니다`);
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
                프리미엄으로 업그레이드
              </h2>
            </div>
            <p className="text-sm mb-4" style={{ color: '#B5D5F0' }}>
              HARU의 모든 기능을 제한 없이 사용하세요
            </p>
            {daysRemaining > 0 && (
              <div 
                className="inline-block px-4 py-2 rounded-full text-xs"
                style={{ backgroundColor: '#00336650', color: '#F9F8F3' }}
              >
                <Sparkles className="w-3 h-3 inline mr-1" />
                무료 체험 {daysRemaining}일 남음
              </div>
            )}
          </div>
        </div>

        {/* Plans */}
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    인기
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
                  
                  {plan.originalPrice && (
                    <div className="mb-2">
                      <span className="text-sm line-through" style={{ color: '#999999' }}>
                        {plan.originalPrice}
                      </span>
                      <span 
                        className="ml-2 text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
                      >
                        {plan.discount}
                      </span>
                    </div>
                  )}
                  
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
                  className="w-full py-3 rounded-lg text-sm tracking-wide transition-all hover:opacity-90"
                  style={{
                    backgroundColor: plan.popular ? '#003366' : '#F9F8F3',
                    color: plan.popular ? '#F9F8F3' : '#003366',
                    border: plan.popular ? 'none' : '1px solid #e5e5e5',
                  }}
                >
                  구독하기
                </button>
              </div>
            ))}
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-6 border-t text-center" style={{ borderColor: '#e5e5e5' }}>
            <p className="text-xs leading-relaxed mb-2" style={{ color: '#999999' }}>
              모든 플랜은 언제든지 해지 가능합니다
            </p>
            <p className="text-xs leading-relaxed" style={{ color: '#999999' }}>
              체험 기간 중 구독 시 남은 기간만큼 무료로 연장됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
