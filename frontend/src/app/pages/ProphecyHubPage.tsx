import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

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
      <PageHeaderActions onClose={closeToOrigin} />
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: '#1A3C6E' }}>
          🔮 HARU 미래전망
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666' }}>
          어떤 방식으로 미래전망을 시작할까요?
        </p>
      </div>

      {/* 카드 2개 (세로 배치) */}
      <div className="flex flex-col gap-4">

        {/* ── 내 기록으로 미래전망 ── */}
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
          <h2 className="text-lg font-bold mb-1.5">내 기록으로 미래전망</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
            나의 기록을 AI가 분석하여 미래전망 이야기를 만듭니다
          </p>
        </button>

        {/* ── 사전설정으로 미래전망 ── */}
        <button
          type="button"
          onClick={() => navigate('/novel-studio')}
          className="w-full text-left rounded-2xl p-6 transition-all hover:shadow-lg active:scale-[0.99] touch-manipulation"
          style={{
            backgroundColor: '#2C4A7C',
            color: '#fff',
            boxShadow: '0 6px 16px -10px rgba(44,74,124,0.4)',
          }}
        >
          <div className="text-3xl mb-3">🎬</div>
          <h2 className="text-lg font-bold mb-2">사전설정으로 미래전망</h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.88)' }}>
            기록이 없어도 됩니다. 전문 시나리오 창작법에서 발췌한 질문들에 답하면,
            AI가 나만의 미래 이야기를 만들어 드립니다.
          </p>
          {/* 단계 안내 태그 3개 */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: '🔥', text: '욕망 — 내가 진짜 원하는 것' },
              { icon: '⛓', text: '족쇄 — 나를 붙잡는 것' },
              { icon: '⚡', text: '사건 — 삶을 바꾼 순간' },
            ].map(({ icon, text }) => (
              <span
                key={text}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.9)',
                  letterSpacing: '0.01em',
                }}
              >
                {icon} {text}
              </span>
            ))}
          </div>
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            욕망과 족쇄의 긴장이 이야기의 엔진입니다. 질문에 답하는 과정 자체가 나를 발견하는 시간이 됩니다.
          </p>
        </button>

      </div>
    </div>
  );
}
