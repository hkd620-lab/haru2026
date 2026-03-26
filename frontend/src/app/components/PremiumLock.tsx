import React from 'react';

interface Props {
  children: React.ReactNode;
  isPremium: boolean;
  message?: string;
}

export default function PremiumLock({ children, isPremium, message }: Props) {
  if (isPremium) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-xl z-10">
        <span className="text-3xl mb-2">🔒</span>
        <p className="text-sm font-bold text-[#1A3C6E] mb-1">PREMIUM 기능</p>
        <p className="text-xs text-gray-500 mb-3 text-center px-4">
          {message || '이 기능은 프리미엄 구독 후 이용 가능합니다'}
        </p>
        <button
          onClick={() => window.location.href = '/subscription'}
          className="bg-[#1A3C6E] text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-[#10b981] transition-colors"
        >
          월 3,000원으로 시작하기
        </button>
      </div>
    </div>
  );
}
