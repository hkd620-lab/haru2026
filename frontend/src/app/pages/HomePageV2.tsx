import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setOrigin } from '../services/v2Origin';
import { useAuth } from '../contexts/AuthContext';
import { TimelineCollageModal } from '../components/TimelineCollageModal';
import { shouldShowAssistantOnboarding } from '../services/assistantOnboardingService';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

// 일반 사용자 메뉴에서 숨기는 기록형식/비서 (개발자에게는 그대로 노출, 코드·FormatModal은 보존)
const HIDDEN_RECORD_FORMATS = new Set(['선교보고', '일반보고', '주식거래일지']);
const HIDDEN_AGENT_LABELS = new Set([
  'HARU주식',
  '📦 HARU 기록탐정',
  '명작탐정비서',
  '나도작가',
  '영어성경',
]);

const FONT_KR =
  "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";
const FONT_EN = "'Inter', system-ui, sans-serif";
const FONT_SERIF = "'MaruBuri', 'Pretendard', serif";

type RecordItem = {
  label: string;
  sub: string;
  bg: string;
  stroke: string;
  format: string;
  icon: ReactNode;
};

type Agent = {
  label: string;
  sub: string;
  tag: string;
  variant: 'lilac' | 'green' | 'terracotta';
  stroke: string;
  path: string | null;
  action?: 'timeline';
  developerOnly?: boolean;
  state?: Record<string, unknown>;
  icon: ReactNode;
  beta?: boolean;
};

const RECORDS: RecordItem[] = [
  {
    label: '일기',
    sub: '하루 한 페이지',
    bg: '#E0E8B8',
    stroke: '#4A5A2C',
    format: '일기',
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 3v18" />
        <path d="M11 8h6M11 12h6M11 16h4" />
      </>
    ),
  },
  {
    label: '에세이',
    sub: '생각의 결',
    bg: '#DDD0E8',
    stroke: '#5A4E7A',
    format: '에세이',
    icon: (
      <>
        <path d="M4 20h4l11-11-4-4L4 16z" />
        <path d="M14 6l4 4" />
        <path d="M4 20l1-4" />
      </>
    ),
  },
  {
    label: '여행기록',
    sub: '길 위의 메모',
    bg: '#F5E5DC',
    stroke: '#B85C2E',
    format: '여행기록',
    icon: (
      <>
        <path d="M3 12l18-9-7 18-2-7-9-2z" />
      </>
    ),
  },
  {
    label: '독서사유',
    sub: '책과 나의 변화',
    bg: '#E5DBC2',
    stroke: '#7A6F5A',
    format: '독서사유',
    icon: (
      <>
        <path d="M4 5h7a4 4 0 014 4v12H8a4 4 0 00-4-4z" />
        <path d="M20 5h-7a4 4 0 00-4 4v12h7a4 4 0 014-4z" />
        <path d="M8 9h3M13 9h3" />
      </>
    ),
  },
  {
    label: '텃밭일지',
    sub: '자라는 풍경',
    bg: '#C8D38A',
    stroke: '#4A5A2C',
    format: '텃밭일지',
    icon: (
      <>
        <path d="M12 22V8" />
        <path d="M12 8c-3 0-5-2-5-5 3 0 5 2 5 5z" />
        <path d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5z" />
        <path d="M5 22h14" />
      </>
    ),
  },
  {
    label: '반려동물',
    sub: '함께한 시간',
    bg: '#F5E5DC',
    stroke: '#B85C2E',
    format: '애완동물관찰일지',
    icon: (
      <>
        <circle cx="6" cy="10" r="2" />
        <circle cx="10" cy="6" r="2" />
        <circle cx="14" cy="6" r="2" />
        <circle cx="18" cy="10" r="2" />
        <path d="M12 22c-4 0-7-2-6-6 1-3 3-4 6-4s5 1 6 4c1 4-2 6-6 6z" />
      </>
    ),
  },
  {
    label: '육아일기',
    sub: '자라남의 기록',
    bg: '#E9DEF1',
    stroke: '#5A4E7A',
    format: '육아일기',
    icon: (
      <>
        <circle cx="12" cy="6" r="3" />
        <path d="M5 21c0-4 3-7 7-7s7 3 7 7" />
        <path d="M9 5l-1-2M15 5l1-2" />
      </>
    ),
  },
  {
    label: '선교보고',
    sub: '길 위의 소식',
    bg: '#DDD0E8',
    stroke: '#5A4E7A',
    format: '선교보고',
    icon: (
      <>
        <path d="M12 2v5" />
        <path d="M9 5h6" />
        <path d="M5 22V11l7-4 7 4v11" />
        <path d="M10 22v-6h4v6" />
      </>
    ),
  },
  {
    label: '일반보고',
    sub: '사실 정리',
    bg: '#E5DFD0',
    stroke: '#7A6F5A',
    format: '일반보고',
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
        <path d="M14 3v5h5" />
      </>
    ),
  },
  {
    label: '업무일지',
    sub: '오늘의 일',
    bg: '#9BAA67',
    stroke: '#FFFFFF',
    format: '업무일지',
    icon: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
        <path d="M3 13h18" />
      </>
    ),
  },
  {
    label: '주식거래일지',
    sub: '거래와 복기',
    bg: '#E0E8B8',
    stroke: '#4A5A2C',
    format: '주식거래일지',
    icon: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
        <path d="M5 21h14" />
      </>
    ),
  },
  {
    label: '메모',
    sub: '짧은 한 조각',
    bg: '#F5E5DC',
    stroke: '#B85C2E',
    format: '메모',
    icon: (
      <>
        <path d="M5 4h10l4 4v12H5z" />
        <path d="M15 4v4h4" />
        <path d="M9 13h6M9 17h4" />
      </>
    ),
  },
  {
    label: 'HARU보조장부',
    sub: '수입·지출 보조',
    bg: '#E5DBC2',
    stroke: '#7A6F5A',
    format: 'HARU보조장부',
    developerOnly: true,
    icon: (
      <>
        <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
  },
  {
    label: 'HARU가계부',
    sub: '수입·지출 기록',
    bg: '#D4EDD4',
    stroke: '#166534',
    format: 'HARU가계부',
    icon: (
      <>
        <path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
        <path d="M16 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
        <path d="M6 9h4M6 12h2" />
      </>
    ),
  },
];

const AGENTS: Agent[] = [
  {
    label: '정보금고',
    sub: '항상 필요한 내 핵심정보를 빠르게 확인합니다.',
    tag: 'FREE · 핵심정보',
    variant: 'green',
    stroke: '#4A5A2C',
    path: '/vault',
    icon: (
      <>
        <rect x="5" y="9" width="14" height="11" rx="2" />
        <path d="M8 9V7a4 4 0 018 0v2" />
        <path d="M12 13v3" />
        <circle cx="12" cy="13" r="1" />
      </>
    ),
  },
  {
    label: 'HARU타임라인',
    sub: '여러 날짜의 사진 기록을 시간순으로 묶어 변화의 흐름을 한 장으로 보여줍니다.',
    tag: 'TIMELINE · 기록자산',
    variant: 'green',
    stroke: '#4A5A2C',
    path: null,
    action: 'timeline',
    icon: (
      <>
        <path d="M4 17h16" />
        <path d="M7 17V7" />
        <path d="M12 17V4" />
        <path d="M17 17v-7" />
        <circle cx="7" cy="7" r="2" />
        <circle cx="12" cy="4" r="2" />
        <circle cx="17" cy="10" r="2" />
      </>
    ),
  },
  {
    label: 'HARU미래전망',
    sub: '오늘의 한 줄 기록이 모여 당신의 미래를 전망합니다.',
    tag: 'SAYU · 감성',
    variant: 'lilac',
    stroke: '#5A4E7A',
    path: '/prophecy-hub',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
        <path d="M12 3v2M3 12h2" />
      </>
    ),
  },
  {
    label: '하루LAW',
    sub: '법령·판례를 정부 데이터 그대로, 풀이는 AI가 쉬운 말로 풀어드립니다. 환각 제로.',
    tag: 'LAW · 안내',
    variant: 'green',
    stroke: '#4A5A2C',
    path: '/record',
    state: { category: '하루LAW' },
    icon: (
      <>
        <path d="M12 3v18" />
        <path d="M5 7h14" />
        <path d="M5 7l-2 6h6L7 7" />
        <path d="M17 7l-2 6h6l-2-6" />
        <path d="M8 21h8" />
      </>
    ),
  },
  {
    label: '전자소송연습비서',
    sub: '중고거래 분쟁을 질문 단계로 정리하고 사건 타임라인을 만들어봅니다.',
    tag: 'PRACTICE · V1',
    variant: 'terracotta',
    stroke: '#B85C2E',
    path: '/lawsuit-practice',
    beta: true,
    icon: (
      <>
        <path d="M5 4h10l4 4v12H5z" />
        <path d="M15 4v4h4" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
        <path d="M7 9h3" />
      </>
    ),
  },
  {
    label: '영어성경',
    sub: '영어·영한·한영 듣기·말하기·해석·단어·문법을 한 번에 — 영어성경 학습의 결정판',
    tag: 'BIBLE · 학습',
    variant: 'terracotta',
    stroke: '#B85C2E',
    path: '/bible',
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M12 7v8" />
        <path d="M9 11h6" />
        <path d="M4 19h16" />
      </>
    ),
  },
  {
    label: '영어일기',
    sub: '내가 기록한 일기와 에세이로 자연스러운 영작 학습',
    tag: 'WRITE · 영문',
    variant: 'lilac',
    stroke: '#5A4E7A',
    path: '/diary-learn',
    icon: (
      <>
        <path d="M4 20h4l11-11-4-4L4 16z" />
        <path d="M14 6l4 4" />
        <path d="M14 20h7" />
      </>
    ),
  },
  {
    label: 'SNS 가져오기',
    sub: '페이스북과 인스타그램의 추억들을 입맛대로 정렬하고 나만의 책으로 출간해 드립니다.',
    tag: 'IMPORT · 정리',
    variant: 'green',
    stroke: '#4A5A2C',
    path: '/sns-records',
    icon: (
      <>
        <path d="M4 12V6a2 2 0 012-2h6" />
        <path d="M20 12v6a2 2 0 01-2 2h-6" />
        <path d="M9 15l3-3 3 3" />
        <path d="M12 12v8" />
        <path d="M14 4h6v6" />
        <path d="M20 4l-7 7" />
      </>
    ),
  },
  {
    label: 'HARU주식',
    sub: '내가 매도·매수한 종목들의 현재와 미래를 예측하여 주식 투자를 즐겁게.',
    tag: 'STOCK · 안내',
    variant: 'terracotta',
    stroke: '#B85C2E',
    path: '/record',
    state: { format: '주식거래일지' },
    icon: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
      </>
    ),
  },
  {
    label: '하루식물탐정',
    sub: '잎과 열매 사진을 보고 식물 상태와 돌봄 힌트를 알려드립니다.',
    tag: 'GARDEN · 사진',
    variant: 'green',
    stroke: '#4A5A2C',
    path: '/plant-detective',
    beta: true,
    icon: (
      <>
        <path d="M12 21V9" />
        <path d="M12 9c-4 0-7-3-7-7 4 0 7 3 7 7z" />
        <path d="M12 13c4 0 7-3 7-7-4 0-7 3-7 7z" />
        <circle cx="18" cy="18" r="3" />
        <path d="M20.5 20.5L22 22" />
      </>
    ),
  },
  {
    label: '📦 HARU 기록탐정',
    sub: 'Google Drive에서 선택한 문서·이미지·PDF만 HARU 폴더에 정리합니다.',
    tag: 'RECORD · 정리',
    variant: 'lilac',
    stroke: '#5A4E7A',
    path: '/asset-explorer',
    beta: true,
    icon: (
      <>
        <path d="M4 7h6l2 2h8v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    ),
  },
  {
    label: '명작탐정비서',
    sub: '잊혔지만 다시 소개할 가치가 있는 책·채널·영상·음악을 찾아 기록합니다.',
    tag: 'CURATION · 명작',
    variant: 'lilac',
    stroke: '#5A4E7A',
    path: '/dev/masterpiece-detective',
    beta: true,
    developerOnly: true,
    icon: (
      <>
        <path d="M4 19V5a2 2 0 012-2h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
        <path d="M14 3v5h5" />
        <circle cx="10" cy="13" r="3" />
        <path d="M12.5 15.5L15 18" />
      </>
    ),
  },
  {
    label: '온비드 부동산',
    sub: '온비드 공매 부동산을 한눈에 — 입찰 일정·최저가·소재지까지 검색.',
    tag: 'BID · 부동산',
    variant: 'lilac',
    stroke: '#5A4E7A',
    path: '/onbid-realestate',
    beta: true,
    icon: (
      <>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </>
    ),
  },
  {
    label: 'HARU건강관리',
    sub: '명의찾기 · 공식 약정보 · 건강 인포그래픽 — HARU와 함께 챙기는 건강.',
    tag: 'CARE · 건강',
    variant: 'green',
    stroke: '#4A5A2C',
    path: '/sayu-health',
    beta: true,
    icon: (
      <>
        <path d="M12 21s-8-5-8-12a5 5 0 019-3 5 5 0 019 3c0 7-8 12-8 12z" />
        <path d="M9 12h2v-2h2v2h2v2h-2v2h-2v-2H9z" />
      </>
    ),
  },
  {
    label: 'HARU우리아이건강돌봄',
    sub: '성장기록 · 또래 백분위 · 예방접종 일정 — 아이 건강을 HARU와 함께.',
    tag: 'CARE · 아이건강',
    variant: 'teal',
    stroke: '#0F766E',
    path: '/child-health',
    beta: true,
    icon: (
      <>
        <path d="M9 12c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3-3-1.34-3-3z" />
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M8 7l-1-2M16 7l1-2" />
      </>
    ),
  },
  {
    label: '나도작가',
    sub: 'AI와 함께 글쓰기 — 시놉시스부터 단편소설까지 손쉽게 완성합니다.',
    tag: 'WRITE · 창작',
    variant: 'terracotta',
    stroke: '#B85C2E',
    path: '/novel-studio',
    icon: (
      <>
        <path d="M4 20h4l11-11-4-4L4 16z" />
        <path d="M14 6l4 4" />
        <path d="M5 21h14" />
      </>
    ),
  },
];

const agentBg = {
  lilac: 'linear-gradient(135deg, #DDD0E8 0%, #ffffff 65%)',
  green: 'linear-gradient(135deg, #E0E8B8 0%, #ffffff 65%)',
  terracotta: 'linear-gradient(135deg, #F5E5DC 0%, #ffffff 65%)',
  teal: 'linear-gradient(135deg, #CCFBF1 0%, #ffffff 65%)',
} as const;

const agentBorder = {
  lilac: '#C9C0DE',
  green: '#D4DEA0',
  terracotta: '#E8B894',
  teal: '#5EEAD4',
} as const;

const agentText = {
  lilac: '#5A4E7A',
  green: '#4A5A2C',
  terracotta: '#B85C2E',
  teal: '#0F766E',
} as const;

function todayLabel(now: Date) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
  const monthEn = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ][now.getMonth()];
  return {
    cap: `${year} · ${monthEn} · ${weekday}`,
    big: `${month}월 ${day}일`,
  };
}

export function HomePageV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const isDeveloper = user?.uid === DEVELOPER_UID;
  // 숨김 기록 + 개발자 전용 항목은 일반 사용자 홈에서 비노출
  const visibleRecords = useMemo(
    () => RECORDS.filter((r) => !HIDDEN_RECORD_FORMATS.has(r.format) && (!r.developerOnly || isDeveloper)),
    [isDeveloper],
  );
  const today = useMemo(() => todayLabel(new Date()), []);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [onboardingGateReady, setOnboardingGateReady] = useState(false);
  const [onboardingBannerHidden, setOnboardingBannerHidden] = useState(() => {
    try {
      return typeof window !== 'undefined'
        && localStorage.getItem('haru_home_onboarding_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });

  const dismissOnboardingBanner = () => {
    setOnboardingBannerHidden(true);
    try { localStorage.setItem('haru_home_onboarding_banner_dismissed', '1'); } catch { /* ignore */ }
  };

  // v2 진입을 sessionStorage에 기록 → 통계/합본 등 깊은 경로 닫기 시 v2 복귀용
  useEffect(() => {
    setOrigin('/v2');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkOnboardingGate = async () => {
      if (authLoading) {
        setOnboardingGateReady(false);
        return;
      }

      if (!user?.uid || location.pathname.startsWith('/onboarding')) {
        setOnboardingGateReady(true);
        return;
      }

      setOnboardingGateReady(false);
      try {
        const shouldShow = await shouldShowAssistantOnboarding(user.uid);
        if (cancelled) return;

        if (shouldShow) {
          navigate('/onboarding', {
            replace: true,
            state: { from: location.pathname || '/v2' },
          });
          return;
        }

        setOnboardingGateReady(true);
      } catch (error) {
        console.warn('신규 사용자 온보딩 확인 실패:', error);
        if (!cancelled) setOnboardingGateReady(true);
      }
    };

    checkOnboardingGate();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.uid, location.pathname, navigate]);

  const openTimelineModal = () => {
    if (!user?.uid) {
      navigate('/login');
      return;
    }

    setTimelineModalOpen(true);
  };

  if (authLoading || !onboardingGateReady) {
    return (
      <div
        className="min-h-screen"
        style={{
          background: 'linear-gradient(180deg, #F5F0E8 0%, #EDE8DC 100%)',
        }}
      />
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(1200px 600px at 85% -10%, rgba(212,222,160,0.18), transparent 60%),' +
          'radial-gradient(900px 500px at -10% 110%, rgba(201,192,222,0.18), transparent 55%),' +
          'linear-gradient(180deg, #F5F0E8 0%, #EDE8DC 100%)',
        color: '#2C2C2A',
        fontFamily: FONT_KR,
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <style>{`
        .v2-rec:hover { transform: translateY(-2px); border-color:#d8d1bc; box-shadow:0 10px 24px -16px rgba(74,90,44,0.18); }
        .v2-rec:active { transform: translateY(0) scale(0.99); }
        .v2-agent:hover { transform: translateY(-2px); box-shadow:0 12px 28px -18px rgba(74,90,44,0.25); }
        .v2-agent:active { transform: translateY(0) scale(0.99); }
        .v2-cta:hover { background:#3F4F26; }
        .v2-cta:active { transform: scale(0.99); }
        .v2-cta:hover .v2-cta-arrow { transform: translateX(4px); background: rgba(245,240,232,0.2); }
        .v2-pill:hover { color:#2C2C2A; border-color:#d4cdb9; }
        .v2-pill:active { transform: scale(0.98); }
        .v2-nav-item:hover { color:#7A6F5A; }

        /* === 태블릿 (1열 hero) === */
        @media (max-width: 1100px) {
          [data-v2="hero-grid"] { grid-template-columns: 1fr !important; }
          [data-v2="records-grid"] { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          [data-v2="tools-grid"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          [data-v2="agents-grid"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 820px) {
          [data-v2="records-grid"] { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        /* === 모바일 최적화 (PWA 우선) === */
        @media (max-width: 640px) {
          /* 모든 pill / nav 버튼 텍스트 줄바꿈 금지 */
          .v2-pill, [data-v2="hero-date-tag"], [data-v2="hero-date-chips"] > span { white-space: nowrap !important; }
          /* 헤더 액션 pill을 아이콘만 표시 (텍스트 숨김) */
          [data-v2="header-actions"] .v2-pill { font-size: 0 !important; padding: 0 !important; width: 36px !important; height: 36px !important; gap: 0 !important; justify-content: center !important; }
          [data-v2="header-actions"] .v2-pill svg { width: 16px !important; height: 16px !important; }
          [data-v2="header-actions"] .v2-pill > span { display: none !important; }
          /* 히어로 날짜: 5월 7일 한 줄, "입하 立夏"는 다음 줄 */
          [data-v2="hero-date-num"] { flex-wrap: wrap !important; align-items: baseline !important; white-space: nowrap !important; word-break: keep-all !important; }
          [data-v2="hero-date-num"] small { flex-basis: 100% !important; margin-top: 4px !important; white-space: nowrap !important; }
          /* "오늘 0건" 태그가 큰 폰 글자와 겹치지 않게 */
          [data-v2="hero-date-tag"] { font-size: 9px !important; padding: 3px 8px !important; gap: 5px !important; top: 10px !important; right: 10px !important; }
          /* 히어로 칩들 줄바꿈 안 깨지게 */
          [data-v2="hero-date-chips"] { gap: 5px !important; }
          [data-v2="hero-date-chips"] > span { font-size: 10px !important; padding: 5px 9px !important; }

          [data-v2="page"] { padding: 12px 12px 96px !important; }
          [data-v2="header"] { padding: 4px 0 12px !important; }
          [data-v2="logo"] { width: 38px !important; height: 38px !important; border-radius: 11px !important; }
          [data-v2="logo"] svg { width: 19px !important; height: 22px !important; }
          [data-v2="brand-title"] { font-size: 17px !important; }
          [data-v2="brand-sub"] { font-size: 8px !important; letter-spacing: 2px !important; margin-top: 3px !important; }
          [data-v2="header-actions"] { gap: 6px !important; }
          [data-v2="header-actions"] .v2-pill { padding: 6px 9px !important; font-size: 11px !important; }
          [data-v2="profile"] { width: 36px !important; height: 36px !important; }

          [data-v2="hero-grid"] { display: grid !important; grid-template-columns: 1fr !important; gap: 10px !important; margin-bottom: 14px !important; }
          [data-v2="hero-date"] { padding: 16px 16px 14px !important; min-height: auto !important; border-radius: 18px !important; }
          [data-v2="hero-date-cap"] { font-size: 10px !important; letter-spacing: 2px !important; padding-right: 70px !important; }
          [data-v2="hero-date-num"] { font-size: 22px !important; margin-top: 4px !important; gap: 5px !important; }
          [data-v2="hero-date-num"] small { font-size: 11px !important; }
          [data-v2="hero-date-headline"] { font-size: 13px !important; margin-top: 8px !important; }
          [data-v2="hero-date-tag"] { font-size: 10px !important; padding: 4px 9px 4px 8px !important; top: 12px !important; right: 12px !important; }
          [data-v2="hero-date-chips"] { gap: 6px !important; margin-top: 10px !important; }
          [data-v2="hero-date-blob1"] { width: 140px !important; height: 140px !important; top: -36px !important; right: 60px !important; }
          [data-v2="hero-date-blob2"] { width: 110px !important; height: 110px !important; right: -28px !important; }
          [data-v2="hero-date-blob3"] { width: 60px !important; height: 60px !important; right: 140px !important; }

          [data-v2="hero-greet"] { padding: 14px !important; min-height: auto !important; border-radius: 18px !important; }
          [data-v2="hero-greet-cap"] { font-size: 9px !important; letter-spacing: 1.5px !important; white-space: nowrap !important; }
          [data-v2="hero-greet-title"] { font-size: 16px !important; margin: 6px 0 4px !important; }
          [data-v2="hero-greet-body"] { font-size: 12px !important; line-height: 1.55 !important; }
          [data-v2="hero-greet-streak"] { margin-top: 10px !important; padding-top: 10px !important; gap: 8px !important; }
          [data-v2="hero-greet-streak"] > div:last-of-type { font-size: 10px !important; }

          [data-v2="section"] { margin-bottom: 16px !important; }
          [data-v2="section-head"] { gap: 6px !important; margin-bottom: 10px !important; flex-wrap: nowrap !important; }
          [data-v2="section-icon"] { width: 30px !important; height: 30px !important; flex-shrink: 0 !important; }
          [data-v2="section-icon"] svg { width: 16px !important; height: 16px !important; }
          [data-v2="section-title"] { font-size: 16px !important; white-space: nowrap !important; flex-shrink: 0 !important; }
          [data-v2="section-sub"] { display: none !important; }
          [data-v2="section-badge"] { font-size: 8px !important; padding: 3px 7px !important; white-space: nowrap !important; letter-spacing: 0.08em !important; flex-shrink: 0 !important; }

          /* 카드 그리드 강제 — Tailwind arbitrary breakpoint 미동작 우회 */
          [data-v2="records-grid"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
          [data-v2="tools-grid"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
          [data-v2="agents-grid"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }

          .v2-rec { padding: 12px 10px !important; gap: 6px !important; border-radius: 14px !important; }
          .v2-rec > span:first-of-type { width: 38px !important; height: 38px !important; border-radius: 10px !important; }
          .v2-rec > span:nth-of-type(2) { font-size: 12px !important; }
          .v2-rec > span:nth-of-type(3) { font-size: 9px !important; margin-top: -4px !important; }

          [data-v2="agent"] { padding: 12px !important; gap: 8px !important; min-height: 112px !important; border-radius: 14px !important; }
          [data-v2="agent"] > div:first-of-type { width: 38px !important; height: 38px !important; border-radius: 10px !important; }
          [data-v2="agent-title"] { font-size: 13px !important; }
          [data-v2="agent-sub"] { font-size: 10px !important; margin-top: 3px !important; line-height: 1.4 !important; }
          [data-v2="agent-tag"] { font-size: 8px !important; padding: 2px 6px !important; margin-top: 6px !important; }

          [data-v2="cta"] { padding: 16px 18px !important; font-size: 14px !important; border-radius: 18px !important; margin-top: 4px !important; }
          [data-v2="cta-icon"] { width: 36px !important; height: 36px !important; }
          [data-v2="cta-icon"] svg { width: 18px !important; height: 18px !important; }
          [data-v2="cta-arrow"] { width: 36px !important; height: 36px !important; }
          [data-v2="cta-en"] { font-size: 9px !important; letter-spacing: 2px !important; }

          [data-v2="pattern-strip"] { font-size: 9px !important; margin-top: 14px !important; gap: 4px !important; padding: 0 4px !important; }
          [data-v2="pattern-strip"] > span:first-of-type, [data-v2="pattern-strip"] > span:last-of-type { flex: 0 0 24px !important; }

        }
      `}</style>

      <div
        data-v2="page"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '28px 48px 140px',
        }}
        className="max-[820px]:!px-[18px] max-[820px]:!pt-[20px]"
      >
        {/* HEADER */}
        <header
          data-v2="header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 4px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              data-v2="logo"
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: '#4A5A2C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px -12px rgba(74,90,44,0.5)',
              }}
            >
              <svg width="26" height="30" viewBox="0 0 22 26" fill="#F5F0E8" aria-hidden>
                <circle cx="6" cy="10" r="3.6" />
                <circle cx="11" cy="9" r="3.6" />
                <circle cx="16" cy="10" r="3.6" />
                <circle cx="8.5" cy="15" r="3.6" />
                <circle cx="13.5" cy="15" r="3.6" />
                <circle cx="11" cy="20" r="3.6" />
                <path
                  d="M11 6 Q12 3 14 2"
                  stroke="#E8B894"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div style={{ lineHeight: 1 }}>
              <div
                data-v2="brand-title"
                style={{
                  fontFamily: FONT_EN,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: '#2C2C2A',
                }}
              >
                HARU
              </div>
              <div
                data-v2="brand-sub"
                style={{
                  fontFamily: FONT_EN,
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: 3,
                  color: '#7A6F5A',
                  marginTop: 6,
                  textTransform: 'uppercase',
                }}
              >
                BY HARU2026 · EST. 2026
              </div>
            </div>
          </div>

          <div data-v2="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="v2-pill" style={pillStyle}>
              <PillSvg>
                <path d="M21 21l-4.3-4.3" />
                <circle cx="11" cy="11" r="7" />
              </PillSvg>
              기록 검색
            </button>
            <button type="button" className="v2-pill" style={pillStyle}>
              <PillSvg>
                <path d="M6 8a6 6 0 0112 0v5l1.5 3h-15L6 13V8z" />
                <path d="M10 19a2 2 0 004 0" />
              </PillSvg>
              알림
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: '#B85C2E',
                  display: 'inline-block',
                }}
              />
            </button>
            {isDeveloper && (
              <button
                type="button"
                aria-label="개발자 콘솔"
                onClick={() => navigate('/admin/console')}
                className="v2-pill"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: '#fff',
                  border: '1px solid #E5DFD0',
                  color: '#7A6F5A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 18,
                  transition: 'all 180ms cubic-bezier(0.22,0.61,0.36,1)',
                }}
              >
                🛠
              </button>
            )}
            <button
              type="button"
              aria-label="프로필"
              onClick={() => navigate('/settings')}
              className="v2-pill"
              data-v2="profile"
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: '#fff',
                border: '1px solid #E5DFD0',
                color: '#7A6F5A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 180ms cubic-bezier(0.22,0.61,0.36,1)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6" />
              </svg>
            </button>
          </div>
        </header>

        {/* 온보딩(사용 안내) 배너 — 처음 사용자가 클릭 한 번으로 안내를 다시 볼 수 있게 */}
        {!onboardingBannerHidden && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'linear-gradient(135deg, #4A5A2C 0%, #5C6E36 100%)',
              color: '#F5F0E8',
              borderRadius: 18,
              padding: '14px 16px',
              marginBottom: 20,
              boxShadow: '0 10px 28px -18px rgba(74,90,44,0.55)',
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/onboarding')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                minWidth: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(245,240,232,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 20,
                }}
              >
                👋
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>처음이신가요? HARU 사용 안내 보기</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>
                  기록·SAYU·비서실을 1분 만에 둘러보세요
                </span>
              </span>
              <span
                aria-hidden="true"
                style={{
                  marginLeft: 'auto',
                  fontSize: 13,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  background: 'rgba(245,240,232,0.2)',
                  borderRadius: 999,
                  padding: '6px 12px',
                  flexShrink: 0,
                }}
              >
                안내 보기 →
              </span>
            </button>
            <button
              type="button"
              onClick={dismissOnboardingBanner}
              aria-label="안내 배너 닫기"
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                border: '1px solid rgba(245,240,232,0.4)',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* HERO ROW */}
        <div
          data-v2="hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.55fr 1fr',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {/* Hero date */}
          <section
            data-v2="hero-date"
            style={{
              position: 'relative',
              background: '#fff',
              border: '1px solid #E5DFD0',
              borderRadius: 24,
              padding: '36px 40px 32px',
              overflow: 'hidden',
              minHeight: 260,
            }}
          >
            <div
              data-v2="hero-date-blob1"
              style={{
                position: 'absolute',
                top: -54,
                right: 90,
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: '#D4DEA0',
                opacity: 0.42,
              }}
            />
            <div
              data-v2="hero-date-blob2"
              style={{
                position: 'absolute',
                top: 28,
                right: -44,
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: '#C9C0DE',
                opacity: 0.55,
              }}
            />
            <div
              data-v2="hero-date-blob3"
              style={{
                position: 'absolute',
                bottom: -36,
                right: 220,
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: '#E8B894',
                opacity: 0.28,
              }}
            />

            <div
              data-v2="hero-date-tag"
              style={{
                position: 'absolute',
                top: 32,
                right: 36,
                zIndex: 2,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(2px)',
                border: '1px solid #E5DFD0',
                borderRadius: 999,
                padding: '7px 14px 7px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#4A5A2C',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: '#7A8B4E',
                }}
              />
              오늘 0건
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div
                data-v2="hero-date-cap"
                style={{
                  fontFamily: FONT_EN,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: '#B85C2E',
                }}
              >
                {today.cap}
              </div>
              <div
                data-v2="hero-date-num"
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 44,
                  fontWeight: 700,
                  color: '#4A5A2C',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  whiteSpace: 'nowrap',
                  flexWrap: 'wrap',
                }}
              >
                {today.big}
                <small
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 16,
                    fontWeight: 400,
                    color: '#7A6F5A',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  · 입하 立夏
                </small>
              </div>
              <div
                data-v2="hero-date-headline"
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 22,
                  color: '#2C2C2A',
                  marginTop: 24,
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                }}
              >
                간편하게,{' '}
                <b style={{ color: '#4A5A2C', fontWeight: 700 }}>쓸모있게</b>{' '}
                남기다
              </div>
              <div
                data-v2="hero-date-chips"
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 28,
                  flexWrap: 'wrap',
                }}
              >
                <Chip color="warm">
                  <ChipSvg>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
                  </ChipSvg>
                  맑음 · 22°
                </Chip>
                <Chip color="nature">
                  <ChipSvg>
                    <path d="M12 22V8" />
                    <path d="M12 8c-3 0-5-2-5-5 3 0 5 2 5 5z" />
                    <path d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5z" />
                  </ChipSvg>
                  연속 기록 12일째
                </Chip>
                <Chip color="calm">
                  <ChipSvg>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </ChipSvg>
                  오전 7시 14분
                </Chip>
              </div>
            </div>
          </section>

          {/* Greet */}
          <aside
            data-v2="hero-greet"
            style={{
              background: '#fff',
              border: '1px solid #E5DFD0',
              borderRadius: 24,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 260,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                content: '""',
                position: 'absolute',
                top: -36,
                left: -36,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: '#E0E8B8',
                opacity: 0.6,
              }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div
                data-v2="hero-greet-cap"
                style={{
                  fontFamily: FONT_EN,
                  fontSize: 11,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  fontWeight: 500,
                  color: '#888780',
                }}
              >
                GOOD MORNING
              </div>
              <h3
                data-v2="hero-greet-title"
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 26,
                  fontWeight: 700,
                  color: '#2C2C2A',
                  margin: '12px 0 10px',
                  letterSpacing: '-0.01em',
                }}
              >
                오늘도 한 줄, 남겨볼까요?
              </h3>
              <p
                data-v2="hero-greet-body"
                style={{
                  fontSize: 13,
                  color: '#7A6F5A',
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                어젯밤 적어두신{' '}
                <b style={{ color: '#B85C2E' }}>‘텃밭일지’</b>는<br />
                SAYU가 곱게 다듬어 두었어요.
              </p>
            </div>

            <div
              data-v2="hero-greet-streak"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 22,
                paddingTop: 18,
                borderTop: '1px dashed #E5DFD0',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }} aria-label="지난 7일 기록 현황">
                <StreakDot state="on" />
                <StreakDot state="on" />
                <StreakDot state="on" />
                <StreakDot state="semi" />
                <StreakDot state="on" />
                <StreakDot state="on" />
                <StreakDot state="off" />
              </div>
              <div style={{ fontSize: 11, color: '#7A6F5A' }}>
                이번 주{' '}
                <b style={{ color: '#4A5A2C', fontWeight: 700 }}>6일</b> · 평균 7분
              </div>
            </div>
          </aside>
        </div>

        {/* RECORDS SECTION */}
        <section data-v2="section" style={{ marginBottom: 36 }}>
          <SectionHead
            iconBg="#E0E8B8"
            iconStroke="#4A5A2C"
            title="HARU 기록"
            sub="매일의 한 줄, 평생의 자산"
            badge={`${visibleRecords.length}가지 형식`}
            badgeDot="#7A8B4E"
            icon={
              <>
                <path d="M4 4h13a3 3 0 013 3v13H7a3 3 0 01-3-3V4z" />
                <path d="M4 17a3 3 0 013-3h13" />
                <path d="M9 8h7" />
              </>
            }
          />
          <div
            data-v2="records-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 14,
            }}
          >
            {visibleRecords.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => navigate('/record', { state: { format: r.format, from: '/v2' } })}
                className="v2-rec"
                style={{
                  background: '#fff',
                  border: '1px solid #E5DFD0',
                  borderRadius: 20,
                  padding: '22px 18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 14,
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  overflow: 'hidden',
                  transition:
                    'transform 180ms cubic-bezier(0.22,0.61,0.36,1), box-shadow 180ms, border-color 180ms',
                }}
              >
                <span
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: r.bg,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <RecSvg stroke={r.stroke}>{r.icon}</RecSvg>
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#2C2C2A',
                    letterSpacing: '-0.01em',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {r.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: '#888780',
                    marginTop: -8,
                    letterSpacing: '0.04em',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {r.sub}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* AGENTS SECTION */}
        <section data-v2="section" style={{ marginBottom: 36 }}>
          <SectionHead
            iconBg="#DDD0E8"
            iconStroke="#5A4E7A"
            title="HARU 비서실"
            sub="일상 곁의 작은 AI 동료"
            badge="AI 에이전시"
            badgeDot="#5A4E7A"
            icon={
              <>
                <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" />
                <path d="M19 16l.8 1.8L21.5 18.5 19.7 19.3 19 21l-.8-1.7L16.5 18.5l1.7-.7z" />
              </>
            }
          />
          <div
            data-v2="agents-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
            }}
          >
            {AGENTS.filter(
              (a) => !a.developerOnly && !HIDDEN_AGENT_LABELS.has(a.label),
            ).map((a) => {
              const disabled = a.path === null && !a.action;
              return (
              <button
                key={a.label}
                type="button"
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => {
                  if (a.action === 'timeline') {
                    openTimelineModal();
                    return;
                  }
                  if (!a.path) return;
                  navigate(a.path, { state: { ...(a.state || {}), from: '/v2' } });
                }}
                className={disabled ? '' : 'v2-agent'}
                data-v2="agent"
                style={{
                  borderRadius: 20,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition:
                    'transform 180ms cubic-bezier(0.22,0.61,0.36,1), box-shadow 180ms',
                  minHeight: 148,
                  textAlign: 'left',
                  background: disabled ? '#F5F0E8' : agentBg[a.variant],
                  border: `1px solid ${disabled ? '#E5DFD0' : agentBorder[a.variant]}`,
                  color: disabled ? '#888780' : agentText[a.variant],
                  opacity: disabled ? 0.7 : 1,
                }}
              >
                {a.beta && (
                  <span
                    data-v2="agent-beta"
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      zIndex: 2,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: '#1A3C6E',
                      color: '#fff',
                      fontFamily: FONT_EN,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      boxShadow: '0 2px 6px -2px rgba(26,60,110,0.45)',
                    }}
                  >
                    BETA
                  </span>
                )}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                    boxShadow: '0 1px 2px rgba(74,90,44,0.04)',
                  }}
                >
                  <RecSvg stroke={a.stroke}>{a.icon}</RecSvg>
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div
                    data-v2="agent-title"
                    style={{
                      fontFamily: FONT_SERIF,
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {a.label}
                  </div>
                  <div
                    data-v2="agent-sub"
                    style={{
                      fontSize: 11,
                      marginTop: 6,
                      opacity: 0.78,
                      lineHeight: 1.5,
                    }}
                  >
                    {a.sub}
                  </div>
                  <span
                    data-v2="agent-tag"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 12,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.66)',
                      fontFamily: FONT_EN,
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {disabled ? '준비중' : a.tag}
                  </span>
                </div>
              </button>
              );
            })}

            {/* Placeholder */}
            <button
              type="button"
              aria-disabled
              disabled
              style={{
                borderRadius: 20,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden',
                minHeight: 148,
                textAlign: 'left',
                background: 'transparent',
                border: '1.5px dashed #d4cdb9',
                color: '#888780',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: 'transparent',
                  border: '1.5px dashed #d4cdb9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <RecSvg stroke="#888780">
                  <path d="M12 5v14M5 12h14" />
                </RecSvg>
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: '#7A6F5A',
                  }}
                >
                  새 비서 예정
                </div>
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 6,
                    opacity: 0.78,
                    lineHeight: 1.5,
                  }}
                >
                  곧 새로운 동료가 합류합니다
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 12,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'transparent',
                    border: '1px solid #E5DFD0',
                    fontFamily: FONT_EN,
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  COMING SOON
                </span>
              </div>
            </button>
          </div>
        </section>

        {/* ANALYSIS TOOLS SECTION (구 RECORD TOOLS — 비서실 아래로 이동) */}
        <section data-v2="section" style={{ marginBottom: 36 }}>
          <SectionHead
            iconBg="#E5DBC2"
            iconStroke="#7A6F5A"
            title="분석도구"
            sub="기록과 비서 결과물을 통계로 보고, 합본으로 묶습니다."
            badge="2가지"
            badgeDot="#B85C2E"
            icon={
              <>
                <path d="M4 19V5" />
                <path d="M4 19h17" />
                <path d="M8 16v-5" />
                <path d="M12 16V8" />
                <path d="M16 16v-3" />
                <path d="M20 16V6" />
              </>
            }
          />
          <div
            data-v2="tools-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            {[
              {
                label: '기록통계',
                sub: '내 기록과 비서 결과물의 흐름을 봅니다.',
                bg: '#DDD0E8',
                stroke: '#5A4E7A',
                path: '/stats',
                icon: (
                  <>
                    <path d="M4 19V5" />
                    <path d="M4 19h17" />
                    <path d="M8 16v-5" />
                    <path d="M12 16V8" />
                    <path d="M16 16v-3" />
                    <path d="M20 16V6" />
                  </>
                ),
              },
              {
                label: '기록합본',
                sub: '여러 기록과 비서 결과물을 하나로 묶습니다.',
                bg: '#E0E8B8',
                stroke: '#4A5A2C',
                path: '/merge',
                icon: (
                  <>
                    <path d="M4 5h7a4 4 0 014 4v12H8a4 4 0 00-4-4z" />
                    <path d="M20 5h-7a4 4 0 00-4 4v12h7a4 4 0 014-4z" />
                    <path d="M12 9h6" />
                    <path d="M12 13h6" />
                  </>
                ),
              },
            ].map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={() => navigate(tool.path, { state: { from: '/v2' } })}
                className="v2-rec"
                style={{
                  background: '#fff',
                  border: '1px solid #E5DFD0',
                  borderRadius: 20,
                  padding: '22px 18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 14,
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  overflow: 'hidden',
                  transition:
                    'transform 180ms cubic-bezier(0.22,0.61,0.36,1), box-shadow 180ms, border-color 180ms',
                }}
              >
                <span
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: tool.bg,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <RecSvg stroke={tool.stroke}>{tool.icon}</RecSvg>
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#2C2C2A',
                    letterSpacing: '-0.01em',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {tool.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: '#888780',
                    marginTop: -8,
                    letterSpacing: '0.04em',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {tool.sub}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* CTA (MY LIBRARY 서재 배너 — 2026-05-13 폐기. 서재 개념 제거) */}

        {/* Pattern strip */}
        <div
          data-v2="pattern-strip"
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            marginTop: 22,
            color: '#888780',
            fontFamily: FONT_EN,
            fontSize: 10,
            letterSpacing: 3,
            textTransform: 'uppercase',
            justifyContent: 'center',
          }}
        >
          <span style={{ height: 1, flex: '0 0 60px', background: '#E5DFD0' }} />
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#B85C2E',
              opacity: 0.5,
            }}
          />
          <span>REPOSEFUL · 안락하다 · 내추럴</span>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#B85C2E',
              opacity: 0.5,
            }}
          />
          <span style={{ height: 1, flex: '0 0 60px', background: '#E5DFD0' }} />
        </div>
      </div>

      {timelineModalOpen && user?.uid && (
        <TimelineCollageModal
          isOpen={timelineModalOpen}
          onClose={() => setTimelineModalOpen(false)}
          records={[]}
          uid={user.uid}
        />
      )}
    </div>
  );
}

/* ----- helpers ----- */

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 14px',
  borderRadius: 999,
  background: '#fff',
  border: '1px solid #E5DFD0',
  fontSize: 12,
  fontWeight: 500,
  color: '#7A6F5A',
  cursor: 'pointer',
  transition:
    'background 180ms cubic-bezier(0.22,0.61,0.36,1), color 180ms, border-color 180ms, transform 120ms',
};

function PillSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function ChipSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function RecSvg({ stroke, children }: { stroke: string; children: ReactNode }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      stroke={stroke}
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function Chip({
  color,
  children,
}: {
  color: 'warm' | 'nature' | 'calm';
  children: ReactNode;
}) {
  const map = {
    warm: { bg: '#F5E5DC', fg: '#B85C2E' },
    nature: { bg: '#E0E8B8', fg: '#4A5A2C' },
    calm: { bg: '#DDD0E8', fg: '#5A4E7A' },
  } as const;
  const { bg, fg } = map[color];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 12px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </span>
  );
}

function StreakDot({ state }: { state: 'on' | 'semi' | 'off' }) {
  const map = {
    on: { bg: '#7A8B4E', border: '#7A8B4E' },
    semi: { bg: '#E0E8B8', border: '#D4DEA0' },
    off: { bg: '#EDE8DC', border: '#E5DFD0' },
  } as const;
  const { bg, border } = map[state];
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        background: bg,
        border: `1px solid ${border}`,
      }}
    />
  );
}

function SectionHead({
  iconBg,
  iconStroke,
  title,
  sub,
  badge,
  badgeDot,
  icon,
}: {
  iconBg: string;
  iconStroke: string;
  title: string;
  sub: string;
  badge: string;
  badgeDot: string;
  icon: ReactNode;
}) {
  return (
    <div
      data-v2="section-head"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <span
        data-v2="section-icon"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: iconBg,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          stroke={iconStroke}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </span>
      <span
        data-v2="section-title"
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 22,
          fontWeight: 700,
          color: '#2C2C2A',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </span>
      <span data-v2="section-sub" style={{ fontSize: 12, color: '#7A6F5A', marginLeft: 4 }}>{sub}</span>
      <span
        data-v2="section-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 11px',
          borderRadius: 999,
          background: '#fff',
          border: '1px solid #E5DFD0',
          fontFamily: FONT_EN,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.16em',
          color: '#7A6F5A',
          textTransform: 'uppercase',
          marginLeft: 'auto',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: badgeDot,
          }}
        />
        {badge}
      </span>
    </div>
  );
}

export default HomePageV2;
