import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type SubFeature = {
  path: string;
  title: string;
  sub: string;
  desc: string;
  icon: ReactNode;
};

const FEATURES: SubFeature[] = [
  {
    path: '/pet-health/food',
    title: '먹어도 되나요?',
    sub: '음식명이나 상황을 입력해 안전 여부를 확인합니다',
    desc: '포도, 양파, 초콜릿 등 반려동물에게 위험한 음식을 빠르게 확인합니다. AI가 판정 결과와 다음 행동을 안내합니다.',
    icon: (
      <>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
        <path d="M12 8v4l3 3" />
      </>
    ),
  },
  {
    path: '/pet-health/symptom',
    title: '아픈 징조',
    sub: '이상 증상을 입력해 병원 상담 필요성을 확인합니다',
    desc: '구토, 식욕 부진, 이상 행동 등의 증상을 입력하면 위험도와 병원 상담 필요 여부를 정리해드립니다. 진단을 대신하지 않습니다.',
    icon: (
      <>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </>
    ),
  },
  {
    path: '/pet-health/vaccine',
    title: '예방접종',
    sub: '접종 기록과 다음 일정을 관리합니다',
    desc: '접종명, 접종일, 다음 예정일, 병원명을 기록해 관리합니다.',
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </>
    ),
  },
];

export function PetHealthHubPage() {
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
            background: '#7C3AED',
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
          HARU · PET CARE
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          🐾 반려동물 건강돌봄
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          반려동물의 먹거리, 아픈 징조, 예방접종을 기록하고 확인합니다.<br />
          이 비서는 진단을 대신하지 않습니다. 위험 신호가 있거나 증상이 반복되면 동물병원 진료를 받으세요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {FEATURES.map((feature) => (
          <button
            key={feature.path}
            onClick={() => navigate(feature.path, { state: { from: location.pathname } })}
            className="text-left w-full rounded-xl border p-4 transition-all hover:shadow-md"
            style={{
              background: '#fff',
              borderColor: '#e5e7eb',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: '#fdf4ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {feature.icon}
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm mb-0.5" style={{ color: '#1A3C6E' }}>
                  {feature.title}
                </p>
                <p className="text-xs mb-1" style={{ color: '#7C3AED' }}>
                  {feature.sub}
                </p>
                <p className="text-xs" style={{ color: '#888', lineHeight: 1.5 }}>
                  {feature.desc}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs mt-6 text-center" style={{ color: '#aaa', lineHeight: 1.6 }}>
        AI 결과는 참고용입니다. 반려동물 상태가 심각하거나 판단이 어려운 경우 동물병원을 방문하세요.
      </p>
    </div>
  );
}
