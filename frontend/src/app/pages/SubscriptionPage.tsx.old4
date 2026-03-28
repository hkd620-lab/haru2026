import { useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (method: 'kakao' | 'toss') => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setLoading(true);

    try {
      const paymentId = `haru-${user.uid}-${Date.now()}`;

      const response = await PortOne.requestPayment({
        storeId: import.meta.env.VITE_PORTONE_STORE_ID,
        channelKey: method === 'kakao'
          ? import.meta.env.VITE_PORTONE_CHANNEL_KEY
          : import.meta.env.VITE_PORTONE_TOSS_CHANNEL_KEY,
        paymentId: paymentId,
        orderName: 'HARU PREMIUM 월 구독',
        totalAmount: 3000,
        currency: 'KRW',
        payMethod: method === 'kakao' ? 'EASY_PAY' : 'CARD',
        customer: {
          email: user.email || '',
        },
      });

      if (response?.code) {
        alert('결제가 취소되었습니다.');
        return;
      }

      const now = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await setDoc(
        doc(db, 'users', user.uid, 'subscription', 'info'),
        {
          plan: 'premium',
          startDate: now.toISOString(),
          endDate: endDate.toISOString(),
          paymentId: paymentId,
          updatedAt: now.toISOString(),
        }
      );

      alert('🎉 PREMIUM 구독이 완료되었습니다!');
      window.location.href = '/';

    } catch (e) {
      console.error('결제 오류:', e);
      alert('결제 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-1">HARU PREMIUM</h1>
          <p className="text-sm text-gray-500">기록을 더 깊게 활용하세요</p>
        </div>

        {/* 카드 비교 */}
        <div className="grid grid-cols-2 gap-3 mb-5">

          {/* FREE */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200">
            <div className="text-sm font-bold text-gray-400 mb-1">FREE</div>
            <div className="text-2xl font-black text-gray-800 mb-3">₩0</div>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>✅ 기록 형식 10개</li>
              <li>✅ SAYU 다듬기 전체</li>
              <li>✅ TEXT/HTML 출력</li>
              <li>✅ 주간 합침 + PDF</li>
              <li>✅ 주간 통계</li>
              <li className="text-gray-300">🔒 SAYU PDF 저장</li>
              <li className="text-gray-300">🔒 월간/분기/연간</li>
            </ul>
          </div>

          {/* PREMIUM */}
          <div className="bg-[#1A3C6E] rounded-2xl p-4 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#10b981] text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
              2개월 무료
            </div>

            {/* 중앙정렬: 타이틀 + 가격 */}
            <div className="text-center">
              <div className="text-sm font-bold text-[#10b981] mb-2 mt-1">PREMIUM</div>

              {/* 월간 */}
              <div className="border-b border-white/15 pb-2 mb-2">
                <div className="text-xs text-gray-400 mb-1">월간</div>
                <div className="text-lg font-black text-white">
                  ₩3,000 <span className="text-xs text-gray-400 font-normal">/ 월</span>
                </div>
              </div>

              {/* 연간 */}
              <div className="pb-3 mb-3">
                <div className="text-xs text-gray-400 mb-1">연간</div>
                <div className="text-xs text-red-400 line-through mb-1">❌ ₩36,000</div>
                <div className="text-lg font-black text-white">
                  ₩30,000 <span className="text-xs text-gray-400 font-normal">/ 년</span>
                </div>
                <div className="text-xs text-[#10b981] mt-1">월 2,500원</div>
              </div>
            </div>

            {/* 왼쪽정렬: 체크 항목 */}
            <ul className="space-y-1 text-xs text-gray-200 text-left">
              <li>✅ FREE 모든 기능</li>
              <li>✅ SAYU PDF 저장</li>
              <li>✅ 월간 기록합침</li>
              <li>✅ 분기 기록합침</li>
              <li>✅ 연간 기록합침</li>
              <li>✅ 월간/분기/연간 통계</li>
            </ul>
          </div>
        </div>

        {/* 카카오페이 버튼 */}
        <button
          onClick={() => handleSubscribe('kakao')}
          disabled={loading}
          className="w-full bg-[#FEE500] hover:bg-[#F6D800] text-[#3C1E1E] font-black text-base py-4 rounded-2xl transition-colors disabled:opacity-50 mb-3"
        >
          {loading ? '결제 처리 중...' : '💛 카카오페이로 결제하기'}
        </button>

        {/* 토스페이먼츠 버튼 */}
        <button
          onClick={() => handleSubscribe('toss')}
          disabled={loading}
          className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-black text-base py-4 rounded-2xl transition-colors disabled:opacity-50 mb-3"
        >
          {loading ? '결제 처리 중...' : '💳 토스페이먼츠로 결제하기'}
        </button>

        <p className="text-center text-xs text-gray-400 mb-2">
          카카오페이 · 신용카드 · 체크카드 결제 가능
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
