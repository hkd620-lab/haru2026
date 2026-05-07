import { X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getOrigin } from '../services/v2Origin';

export function ProphecyHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;
  const closeToOrigin = () => {
    if (fromPath) {
      navigate(fromPath);
      return;
    }
    const origin = getOrigin();
    if (origin) {
      navigate(origin);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <button
        type="button"
        onClick={closeToOrigin}
        aria-label="닫기"
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 50,
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <X style={{ width: 18, height: 18, color: '#1A3C6E' }} />
      </button>
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: '#1A3C6E' }}>
          🔮 HARU 예언
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666' }}>
          어떤 방식으로 예언을 시작할까요?
        </p>
      </div>

      {/* 카드 3개 (세로 배치) */}
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
          onClick={() => toast.info('준비 중입니다. 곧 만나요! 🚀')}
          className="w-full text-left rounded-2xl p-6 transition-all hover:shadow-lg active:scale-[0.99] touch-manipulation"
          style={{
            backgroundColor: '#1A3C6E',
            color: '#fff',
            boxShadow: '0 6px 16px -10px rgba(26,60,110,0.4)',
          }}
        >
          <div className="text-3xl mb-3">🌐</div>
          <h2 className="text-lg font-bold mb-1.5">사전설정으로 미래 예언</h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.8)' }}>
            미래인재상 예언 등 — 곧 만나요!
          </p>
          <span
            className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.02em',
            }}
          >
            🚧 준비 중
          </span>
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
          <div className="text-3xl mb-3">✍️</div>
          <h2 className="text-lg font-bold mb-1.5">나도 작가</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            처음부터 직접 설정하여 나만의 예언 이야기를 만듭니다
          </p>
        </button>
      </div>
    </div>
  );
}
