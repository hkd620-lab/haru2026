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
      const paymentId = `haru-${Date.now()}`;

      const response = await PortOne.requestPayment({
        storeId: import.meta.env.VITE_PORTONE_STORE_ID,
        channelKey: method === 'kakao'
          ? import.meta.env.VITE_PORTONE_CHANNEL_KEY
          : import.meta.env.VITE_PORTONE_TOSS_CHANNEL_KEY,
        paymentId: paymentId,
        orderName: 'HARU PREMIUM 월 구독',
        totalAmount: 3000,
        currency: 'KRW',
        payMethod: 'EASY_PAY',
        easyPay: method === 'toss' ? { easyPayProvider: 'TOSSPAY' } : undefined,
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
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-[#1A3C6E] mb-1">HARU 구독 플랜</h1>
          <p className="text-sm text-gray-500">기록을 더 깊게 활용하세요</p>
        </div>

        {/* 7일 프리미엄 무료 체험 배너 */}
        <div
          className="rounded-2xl p-3 mb-4 text-center"
          style={{
            background: 'linear-gradient(90deg, #1A3C6E 0%, #10b981 100%)',
            color: '#fff',
          }}
        >
          <p className="text-sm font-bold mb-0.5">🎉 신규 가입 시 7일 프리미엄 무료 체험</p>
          <p className="text-[11px] opacity-90">전 기능 7일간 무제한 체험 가능</p>
        </div>

        {/* 카드 비교 */}
        <div className="grid grid-cols-2 gap-3 mb-5">

          {/* LIGHT */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200">
            <div className="text-base font-bold text-gray-500 mb-1">LIGHT</div>
            <div className="text-3xl font-black text-gray-800 mb-1">₩4,000</div>
            <div className="text-xs text-gray-400 mb-3">/ 월</div>
            <ul className="space-y-1 text-xs text-gray-600 text-left">
              <li>✅ 10가지 기록 형식</li>
              <li>✅ SAYU 다듬기</li>
              <li>✅ AI 제목 자동추출</li>
              <li>✅ 통계·합본</li>
              <li>✅ 사진 업로드</li>
              <li>✅ AI 비서실 통합 월 10회</li>
            </ul>
          </div>

          {/* PREMIUM (강조) */}
          <div className="bg-[#1A3C6E] rounded-2xl p-4 relative">
            <div
              className="absolute -top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#F8C554', color: '#1A3C6E' }}
            >
              추천
            </div>
            <div className="text-sm font-bold text-[#10b981] mb-1 mt-1">PREMIUM</div>
            <div className="text-3xl font-black text-white mb-1">₩5,000</div>
            <div className="text-xs text-gray-400 mb-3">/ 월</div>
            <ul className="space-y-1 text-xs text-gray-200 text-left">
              <li>✅ LIGHT 모든 기능</li>
              <li>✅ AI 비서실 각 일 2회 / 월 40회</li>
            </ul>
          </div>
        </div>

        {/* 베타 무료 운영 안내 (정식 결제 시스템 준비 중) */}
        <div
          className="rounded-2xl p-4 mb-3 text-center"
          style={{ backgroundColor: '#FFFBEA', border: '1px solid #F8C554' }}
        >
          <p className="text-sm font-bold mb-1" style={{ color: '#1A3C6E' }}>
            🎁 베타 무료 운영 중
          </p>
          <p className="text-xs" style={{ color: '#7A6F5A' }}>
            정식 결제 시스템 준비 중입니다.
          </p>
        </div>

        {/* === 결제 버튼 영역 임시 숨김 (정식 출시 시 복원) ===
        <p className="text-center text-xs mb-3" style={{ color: '#10b981' }}>
          ✓ 구독 결제 완료 후 즉시 서비스 이용 가능합니다
        </p>

        <button
          onClick={() => handleSubscribe('kakao')}
          disabled={loading || authLoading}
          className="w-full bg-[#FEE500] hover:bg-[#F6D800] text-[#3C1E1E] font-black text-base py-4 rounded-2xl transition-colors disabled:opacity-50 mb-3"
        >
          {loading ? '결제 처리 중...' : '💛 카카오페이로 결제하기'}
        </button>

        <button
          onClick={() => handleSubscribe('toss')}
          disabled={loading || authLoading}
          className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-black text-base py-4 rounded-2xl transition-colors disabled:opacity-50 mb-3"
        >
          {loading ? '결제 처리 중...' : '💳 토스페이로 결제하기'}
        </button>

        <p className="text-center text-xs text-gray-400 mb-2">
          카카오페이 · 신용카드 · 체크카드 결제 가능
        </p>
        === 결제 버튼 영역 임시 숨김 끝 === */}

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
