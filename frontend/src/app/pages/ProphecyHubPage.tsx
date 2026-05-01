import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ProphecyHubPage() {
  const navigate = useNavigate();

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors touch-manipulation"
          aria-label="홈으로"
        >
          <ChevronLeft className="w-6 h-6" style={{ color: '#1A3C6E' }} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: '#1A3C6E' }}>
            🔮 HARU 예언
          </h1>
          <p className="text-sm mt-1.5" style={{ color: '#666' }}>
            어떤 방식으로 예언을 시작할까요?
          </p>
        </div>
      </div>

      {/* 카드 2개 (세로 배치) */}
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate('/record-prophecy')}
          className="w-full text-left rounded-2xl p-6 transition-all hover:shadow-lg active:scale-[0.99] touch-manipulation"
          style={{
            backgroundColor: '#1A3C6E',
            color: '#fff',
            boxShadow: '0 6px 16px -10px rgba(26,60,110,0.4)',
          }}
        >
          <div className="text-3xl mb-3">📖</div>
          <h2 className="text-lg font-bold mb-1.5">내 기록으로 예언</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            나의 기록을 AI가 분석하여 예언 이야기를 만듭니다
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/novel-studio')}
          className="w-full text-left rounded-2xl p-6 transition-all hover:shadow-lg active:scale-[0.99] touch-manipulation"
          style={{
            backgroundColor: '#1A3C6E',
            color: '#fff',
            boxShadow: '0 6px 16px -10px rgba(26,60,110,0.4)',
          }}
        >
          <div className="text-3xl mb-3">✨</div>
          <h2 className="text-lg font-bold mb-1.5">사전설정으로 예언</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            처음부터 직접 설정하여 나만의 예언을 만듭니다
          </p>
        </button>
      </div>
    </div>
  );
}
