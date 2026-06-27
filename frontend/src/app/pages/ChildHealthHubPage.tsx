import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type SubFeature = {
  path: string;
  title: string;
  sub: string;
  desc: string;
  comingSoon?: boolean;
  icon: ReactNode;
};

const FEATURES: SubFeature[] = [
  {
    path: '/child-health/growth',
    title: '성장기록',
    sub: '키·몸무게 측정 → 또래 백분위 → 성장 그래프',
    desc: '국민건강보험공단 영유아 성장도표 기준으로 또래 백분위를 계산합니다. 기록이 쌓이면 성장 그래프가 자동으로 그려집니다.',
    icon: (
      <>
        <path d="M12 2v20M2 12h20" />
        <path d="M7 7l5-5 5 5" />
        <path d="M7 17l5 5 5-5" />
      </>
    ),
  },
  {
    path: '/child-health/vaccination',
    title: '예방접종 일정',
    sub: '생년월일 입력 → 월령별 접종 일정 확인',
    desc: '아이 생년월일을 입력하면 완료된 접종, 이번 달 접종, 다가오는 접종을 한눈에 확인합니다.',
    icon: (
      <>
        <path d="M3 3l18 18" />
        <path d="M7 7c0-2.2 1.8-4 4-4s4 1.8 4 4v3l2 2" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </>
    ),
  },
];

export function ChildHealthHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-2 flex items-center gap-2">
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: '#0F766E',
            color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          BETA
        </span>
        <span style={{ fontSize: 11, color: '#888780', letterSpacing: '0.04em' }}>
          HARU · 아이건강
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#0F766E' }}
        >
          👶 HARU우리아이건강돌봄
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          아이 성장을 기록하고 또래와 비교해 드립니다. 의료적 판단은 반드시 소아과 전문의와 상의하세요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {FEATURES.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => !f.comingSoon && navigate(f.path, { state: { from: '/child-health' } })}
            className="block w-full text-left rounded-2xl p-4 md:p-5 transition-all hover:shadow-md active:scale-[0.99]"
            style={{
              background: f.comingSoon
                ? 'linear-gradient(135deg, #F3F4F6 0%, #ffffff 70%)'
                : 'linear-gradient(135deg, #CCFBF1 0%, #ffffff 70%)',
              border: f.comingSoon ? '1px solid #E5E7EB' : '1px solid #5EEAD4',
              cursor: f.comingSoon ? 'default' : 'pointer',
              opacity: f.comingSoon ? 0.65 : 1,
            }}
          >
            <div className="flex gap-3 items-start">
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(15,118,110,0.06)',
                }}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  stroke={f.comingSoon ? '#9CA3AF' : '#0F766E'}
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {f.icon}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: f.comingSoon ? '#9CA3AF' : '#134E4A',
                    letterSpacing: '-0.01em',
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {f.title}
                  {f.comingSoon && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#E5E7EB', color: '#6B7280', fontWeight: 600 }}>
                      준비중
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#0F766E', marginBottom: 6, opacity: f.comingSoon ? 0.5 : 1 }}>
                  {f.sub}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.55 }}>
                  {f.desc}
                </div>
              </div>
              {!f.comingSoon && (
                <div
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: '#fff',
                    border: '1px solid #5EEAD4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    alignSelf: 'center',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    stroke="#0F766E"
                    strokeWidth="1.8"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div
        className="mt-8 rounded-xl p-4"
        style={{
          backgroundColor: '#F0FDFA',
          border: '1px solid #CCFBF1',
          fontSize: 11,
          color: '#5EEAD4',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#0F766E' }}>
          안내
        </div>
        <span style={{ color: '#374151' }}>
          성장 백분위는 국민건강보험공단 영유아 성장도표(LMS 기준)를 바탕으로 한 참고 정보입니다.
          3백분위 미만 또는 97백분위 초과 시 소아과 전문의 상담을 권장합니다.
        </span>
      </div>
    </div>
  );
}

export default ChildHealthHubPage;
