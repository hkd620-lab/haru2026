import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

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
  icon: ReactNode;
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
];

const AGENTS: Agent[] = [
  {
    label: 'HARU예언',
    sub: '오늘의 한 줄, 차분히 건네드려요',
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
    sub: '법령·판례를 쉬운 말로 풀어드립니다',
    tag: 'LAW · 안내',
    variant: 'green',
    stroke: '#4A5A2C',
    path: null,
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
    label: '영어성경',
    sub: '매일 한 구절, 천천히 읽어드려요',
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
    sub: '오늘의 한국어를 자연스러운 영문으로',
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
    sub: '흩어진 글을 한 곳으로 모아드립니다',
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
    sub: '관심 종목과 시장 흐름을 차분히',
    tag: 'STOCK · 안내',
    variant: 'terracotta',
    stroke: '#B85C2E',
    path: null,
    icon: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
      </>
    ),
  },
  {
    label: '원기충전소',
    sub: '오늘 컨디션, 작은 회복 루틴 추천',
    tag: 'CARE · 회복',
    variant: 'green',
    stroke: '#4A5A2C',
    path: '/book-studio',
    icon: (
      <>
        <path d="M12 21s-8-5-8-12a5 5 0 019-3 5 5 0 019 3c0 7-8 12-8 12z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
];

const agentBg = {
  lilac: 'linear-gradient(135deg, #DDD0E8 0%, #ffffff 65%)',
  green: 'linear-gradient(135deg, #E0E8B8 0%, #ffffff 65%)',
  terracotta: 'linear-gradient(135deg, #F5E5DC 0%, #ffffff 65%)',
} as const;

const agentBorder = {
  lilac: '#C9C0DE',
  green: '#D4DEA0',
  terracotta: '#E8B894',
} as const;

const agentText = {
  lilac: '#5A4E7A',
  green: '#4A5A2C',
  terracotta: '#B85C2E',
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
  const today = useMemo(() => todayLabel(new Date()), []);

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
      `}</style>

      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '28px 48px 140px',
        }}
        className="max-[820px]:!px-[18px] max-[820px]:!pt-[20px]"
      >
        {/* HEADER */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 4px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
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
                BY JOYEL · 2026
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <button
              type="button"
              aria-label="프로필"
              onClick={() => navigate('/settings')}
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

        {/* HERO ROW */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.55fr 1fr',
            gap: 16,
            marginBottom: 32,
          }}
          className="max-[820px]:!grid-cols-1"
        >
          {/* Hero date */}
          <section
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
                style={{
                  fontFamily: FONT_SERIF,
                  fontSize: 88,
                  fontWeight: 700,
                  color: '#4A5A2C',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 14,
                }}
                className="max-[820px]:!text-[60px]"
              >
                {today.big}
                <small
                  style={{
                    fontFamily: FONT_SERIF,
                    fontSize: 28,
                    fontWeight: 400,
                    color: '#7A6F5A',
                    letterSpacing: '-0.01em',
                  }}
                >
                  · 입하 立夏
                </small>
              </div>
              <div
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
                <br />
                서재에서 마저 살펴보세요.
              </p>
            </div>

            <div
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
        <section style={{ marginBottom: 36 }}>
          <SectionHead
            iconBg="#E0E8B8"
            iconStroke="#4A5A2C"
            title="HARU 기록"
            sub="매일의 한 줄, 평생의 자산"
            badge="10가지 형식"
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
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 14,
            }}
            className="max-[1100px]:!grid-cols-4 max-[820px]:!grid-cols-3 max-[520px]:!grid-cols-2"
          >
            {RECORDS.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => navigate('/record', { state: { format: r.format } })}
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
        <section style={{ marginBottom: 36 }}>
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
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
            }}
            className="max-[1100px]:!grid-cols-2 max-[520px]:!grid-cols-1"
          >
            {AGENTS.map((a) => {
              const disabled = a.path === null;
              return (
              <button
                key={a.label}
                type="button"
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => { if (a.path) navigate(a.path); }}
                className={disabled ? '' : 'v2-agent'}
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

        {/* CTA */}
        <button
          type="button"
          className="v2-cta"
          onClick={() => navigate('/library')}
          style={{
            width: '100%',
            background: '#4A5A2C',
            color: '#F5F0E8',
            border: 'none',
            borderRadius: 22,
            padding: '26px 28px',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 10px 28px -16px rgba(74,90,44,0.55)',
            transition:
              'background 180ms cubic-bezier(0.22,0.61,0.36,1), transform 120ms',
            position: 'relative',
            overflow: 'hidden',
            marginTop: 8,
            fontFamily: FONT_KR,
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(245,240,232,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                stroke="#F5F0E8"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h12a4 4 0 014 4v13H8a4 4 0 01-4-4V4z" />
                <path d="M4 17a4 4 0 014-4h12" />
                <path d="M9 8h7M9 12h5" />
              </svg>
            </span>
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                alignItems: 'flex-start',
              }}
            >
              <small
                style={{
                  fontFamily: FONT_EN,
                  fontSize: 10,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  opacity: 0.65,
                  fontWeight: 500,
                }}
              >
                MY LIBRARY
              </small>
              내 기록 서재 보기
            </span>
          </span>
          <span
            className="v2-cta-arrow"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              background: 'rgba(245,240,232,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 180ms, background 180ms',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              stroke="#F5F0E8"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* Pattern strip */}
        <div
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

      {/* BOTTOM PILL NAV */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 50,
        }}
      >
        <nav
          aria-label="주 탐색"
          style={{
            pointerEvents: 'auto',
            background: '#fff',
            border: '1px solid #E5DFD0',
            borderRadius: 999,
            padding: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))',
            gap: 4,
            boxShadow: '0 16px 40px -20px rgba(74,90,44,0.35)',
          }}
          className="max-[820px]:!grid-cols-[repeat(3,minmax(96px,1fr))]"
        >
          <NavItem active onClick={() => navigate('/v2')}>
            <NavSvg>
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10h14V10" />
            </NavSvg>
            HARU 홈
          </NavItem>
          <NavItem onClick={() => navigate('/sayu')}>
            <NavSvg>
              <path d="M12 3v3M5 6l2 2M3 12h3M5 18l2-2M12 18v3M17 16l2 2M18 12h3M19 6l-2 2" />
              <circle cx="12" cy="12" r="4" />
            </NavSvg>
            SAYU·다듬기
          </NavItem>
          <NavItem onClick={() => navigate('/settings')}>
            <NavSvg>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </NavSvg>
            설정
          </NavItem>
        </nav>
      </div>
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

function NavSvg({ children }: { children: ReactNode }) {
  return (
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <span
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
      <span style={{ fontSize: 12, color: '#7A6F5A', marginLeft: 4 }}>{sub}</span>
      <span
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

function NavItem({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? '' : 'v2-nav-item'}
      style={{
        background: active ? '#4A5A2C' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '12px 22px',
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: active ? '#F5F0E8' : '#888780',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        letterSpacing: '-0.01em',
        transition: 'background 180ms, color 180ms',
        fontFamily: FONT_KR,
      }}
    >
      {children}
    </button>
  );
}

export default HomePageV2;
