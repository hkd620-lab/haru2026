import { useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (method: 'kakao' | 'toss') => {
    if (authLoading) return;
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

      // 서버에서 결제 검증 후 Firestore 저장
      const functions = getFunctions(undefined, 'asia-northeast3');
      const verifyPayment = httpsCallable(functions, 'verifyPayment');
      await verifyPayment({ paymentId });

      alert('🎉 PREMIUM 구독이 완료되었습니다!');
      window.location.href = '/';

    } catch (e: any) {
      console.error('결제 오류:', e);
      const msg = e?.message || '결제 중 오류가 발생했습니다. 다시 시도해 주세요.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE9F5] flex items-center justify-center p-4">
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
            <div className="text-base font-bold text-gray-400 mb-1">FREE</div>
            <div className="text-3xl font-black text-gray-800 mb-3">₩0</div>
            <ul className="space-y-1 text-sm text-gray-600">
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
            <div className="text-sm font-bold text-[#10b981] mb-1 mt-1">PREMIUM</div>
            <div className="text-3xl font-black text-white mb-1">
              ₩3,000
            </div>
            <div className="text-xs text-gray-400 mb-3">/ 월</div>
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

        {/* 서비스 제공기간 안내 */}
        <p className="text-center text-xs mb-3" style={{ color: '#10b981' }}>
          ✓ 구독 결제 완료 후 즉시 서비스 이용 가능합니다
        </p>

        {/* 카카오페이 버튼 */}
        <button
          onClick={() => handleSubscribe('kakao')}
          disabled={loading || authLoading}
          className="w-full bg-[#FEE500] hover:bg-[#F6D800] text-[#3C1E1E] font-black text-base py-4 rounded-2xl transition-colors disabled:opacity-50 mb-3"
        >
          {loading ? '결제 처리 중...' : '💛 카카오페이로 결제하기'}
        </button>

        {/* 토스페이먼츠 버튼 */}
        <button
          onClick={() => handleSubscribe('toss')}
          disabled={loading || authLoading}
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
