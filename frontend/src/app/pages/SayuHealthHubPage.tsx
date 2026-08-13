import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type SubFeature = {
  path: string;
  title: string;
  sub: string;
  desc: string;
  source: string;
  icon: ReactNode;
};

const FEATURES: SubFeature[] = [
  {
    path: '/sayu-health/ebs',
    title: 'EBS명의찾기',
    sub: '증상·질병 키워드로 명의 정보 안내',
    desc: '키워드를 복사한 뒤 EBS 명의 공식 페이지에서 직접 검색합니다.',
    source: '출처: EBS 명의 (공식 사이트 외부 위임)',
    icon: (
      <>
        <path d="M12 2l3 6 6 1-4.5 4.5 1 6L12 16l-5.5 3.5 1-6L3 9l6-1z" />
      </>
    ),
  },
  {
    path: '/sayu-health/drug',
    title: '약 이름 확인하고 공식 약정보 찾기',
    sub: '약 이름 확인 후 공식 의약품 정보 조회',
    desc: '약 이름을 직접 입력하거나 약봉지 사진에서 후보만 추출한 뒤, 사용자가 확인한 이름으로 공식 정보를 찾습니다.',
    source: '출처: 식품의약품안전처 (공공데이터포털)',
    icon: (
      <>
        <path d="M10.5 3.5a4.95 4.95 0 0 1 7 7l-7 7a4.95 4.95 0 1 1-7-7z" />
        <path d="M7 7l10 10" />
      </>
    ),
  },
  {
    path: '/sayu-health/hospital',
    title: '내 증상 알아보고 병원찾기',
    sub: '증상 입력 → 진료과 분석 → 병원찾기',
    desc: 'HARU 진료과 분석 + 네이버 지도·EBS 명의 통합 안내',
    source: '출처: 네이버 지도 / EBS 명의 (외부 채널 연동)',
    icon: (
      <>
        <path d="M3 21V8l9-5 9 5v13" />
        <path d="M9 21v-7h6v7" />
        <path d="M12 8v4M10 10h4" />
      </>
    ),
  },
  {
    path: '/sayu-health/library',
    title: '건강 정보 라이브러리',
    sub: 'HARU2026이 큐레이션하는 시니어 친화 건강 인포그래픽',
    desc: '협심증·전립선·당뇨병 등 시니어가 꼭 알아야 할 정보. 매일 2개씩 추가됩니다.',
    source: '출처: 국가건강정보포털·심평원·각 학회 (큐레이션)',
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M9 7h6M9 11h6" />
      </>
    ),
  },
  {
    path: '/sayu-health/voiding',
    title: '배뇨일지',
    sub: '음료·배뇨 기록으로 하루 패턴 확인',
    desc: '시간별 기록을 입력하면 주간·야간 배뇨량과 야간뇨 비율을 자동으로 계산합니다.',
    source: '자가 기록 기반 (진단 아님, 참고용)',
    icon: (
      <>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" strokeWidth="1.5" />
        <path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" strokeWidth="1.5" />
      </>
    ),
  },
];

export function SayuHealthHubPage() {
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
            background: '#1A3C6E',
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
          SAYU · CARE
        </span>
      </div>

      <div className="mb-5">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          style={{ color: '#1A3C6E' }}
        >
          🩺 HARU건강관리
        </h1>
        <p className="text-sm mt-1.5" style={{ color: '#666', lineHeight: 1.6 }}>
          공공데이터로 건강 정보를 안내드립니다. 진료·처방을 대체하지 않으며,
          최종 판단은 의료진과 상의하세요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {FEATURES.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => navigate(f.path, { state: { from: '/sayu-health' } })}
            className="block w-full text-left rounded-2xl p-4 md:p-5 transition-all hover:shadow-md active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, #E0E8B8 0%, #ffffff 70%)',
              border: '1px solid #D4DEA0',
              cursor: 'pointer',
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
                  boxShadow: '0 1px 2px rgba(74,90,44,0.04)',
                }}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  stroke="#4A5A2C"
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
                    color: '#2C2C2A',
                    letterSpacing: '-0.01em',
                    marginBottom: 4,
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 12, color: '#4A5A2C', marginBottom: 6 }}>
                  {f.sub}
                </div>
                <div style={{ fontSize: 11, color: '#7A6F5A', lineHeight: 1.55 }}>
                  {f.desc}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#888780',
                    marginTop: 8,
                    letterSpacing: '0.02em',
                  }}
                >
                  {f.source}
                </div>
              </div>
              <div
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: '#fff',
                  border: '1px solid #D4DEA0',
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
                  stroke="#4A5A2C"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div
        className="mt-8 rounded-xl p-4"
        style={{
          backgroundColor: '#F5F0E8',
          border: '1px solid #E5DFD0',
          fontSize: 11,
          color: '#7A6F5A',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#4A5A2C' }}>
          공통 안내
        </div>
        본 서비스는 식품의약품안전처·건강보험심사평가원·EBS 공공정보를 안내하는 참고용입니다.
        의료 행위·처방·특정 기관/의사에 대한 추천이 아닙니다.
        증상이 있으시면 반드시 의료진과 상의하세요.
      </div>
    </div>
  );
}

export default SayuHealthHubPage;
