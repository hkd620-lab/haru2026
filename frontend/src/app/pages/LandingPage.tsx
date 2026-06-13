import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

/* ────────────────────────────────────────────────────────────
   HARU by JOYEL — 랜딩 (CD "Reposeful" 디자인 핸드오프 구현)
   · 디자인: 색·타이포·레이아웃은 CD 시안 기준
   · 데이터: 형식·비서실은 실제 앱 기준 (역할·숫자 정확)
   · 로그인/Firestore/Functions/라우터는 건드리지 않음
   ──────────────────────────────────────────────────────────── */

const C = {
  olive: '#7A8B4E', oliveDark: '#4A5A2C',
  lilac: '#C9C0DE', lilacDark: '#5A4E7A', lilacLight: '#DDD0E8',
  lightGreen: '#D4DEA0', greenLight: '#E0E8B8',
  terracotta: '#B85C2E', terracottaLight: '#F5E5DC', peach: '#E8B894',
  fg: '#2C2C2A', fg2: '#7A6F5A', mute: '#888780',
  bg: '#F5F0E8', bg2: '#EDE8DC', card: '#FFFFFF', border: '#E5DFD0',
};

type Hue = 'green' | 'lilac' | 'terracotta';
const hueBg: Record<Hue, string> = { green: C.greenLight, lilac: C.lilacLight, terracotta: C.terracottaLight };
const hueFg: Record<Hue, string> = { green: C.oliveDark, lilac: C.lilacDark, terracotta: C.terracotta };
const agentBg: Record<Hue, string> = {
  green: `linear-gradient(135deg, ${C.greenLight} 0%, #ffffff 65%)`,
  lilac: `linear-gradient(135deg, ${C.lilacLight} 0%, #ffffff 65%)`,
  terracotta: `linear-gradient(135deg, ${C.terracottaLight} 0%, #ffffff 65%)`,
};
const agentBorder: Record<Hue, string> = { green: C.lightGreen, lilac: C.lilac, terracotta: C.peach };

const SHOW_PRICING = import.meta.env.VITE_SHOW_PRICING === 'true';

/* ── 기록 형식 11개 (홈 화면 일반 사용자 노출 기준과 일치) ── */
const FORMATS: { name: string; icon: string; hue: Hue; cat: string; badge?: string }[] = [
  { name: '일기',         icon: 'diary',     hue: 'green',      cat: '생활' },
  { name: '에세이',       icon: 'pen',       hue: 'lilac',      cat: '생활' },
  { name: '여행기록',     icon: 'plane',     hue: 'terracotta', cat: '생활' },
  { name: '독서사유',     icon: 'book',      hue: 'green',      cat: '생활' },
  { name: '텃밭일지',     icon: 'seed',      hue: 'green',      cat: '생활' },
  { name: '애완동물관찰일지', icon: 'paw',   hue: 'terracotta', cat: '생활' },
  { name: '육아일기',     icon: 'baby',      hue: 'lilac',      cat: '생활' },
  { name: '업무일지',     icon: 'briefcase', hue: 'lilac',      cat: '업무' },
  { name: '메모',         icon: 'memo',      hue: 'green',      cat: '업무', badge: 'AI 제목' },
  { name: 'HARU보조장부', icon: 'bookbind',  hue: 'terracotta', cat: '업무' },
  { name: '하루LAW',      icon: 'law',       hue: 'terracotta', cat: '전문' },
];

const SCATTER = [
  { name: '메모장',   sub: '제목 없이 쌓인 글', icon: 'memo',    rot: -2 },
  { name: '사진첩',   sub: '날짜만 남은 풍경',  icon: 'camera',  rot: 1.5 },
  { name: '카톡 대화', sub: '나에게 보낸 메모',  icon: 'message', rot: -1 },
  { name: '문서 폴더', sub: '어디 있더라…',     icon: 'folder',  rot: 2 },
  { name: '종이 노트', sub: '꺼내보기 어려운',  icon: 'diary',   rot: -1.5 },
];

const DOORS: { n: string; icon: string; hue: Hue; title: string; body: string; chip: string; note?: string }[] = [
  {
    n: '01', icon: 'pen', hue: 'green',
    title: '기록하기',
    body: '오늘의 일, 생각, 사진, 경험을 남깁니다. 형식이 먼저 정해져 있어, 무엇을 적을지부터 자리가 잡힙니다.',
    chip: '일기 · 여행기록 · 업무일지',
  },
  {
    n: '02', icon: 'spark', hue: 'lilac',
    title: '이해하기',
    body: '쌓인 기록을 돌아보고 내 삶의 흐름을 정리합니다. SAYU가 표현을 다듬고, 통계와 합본이 변화를 보여줍니다.',
    chip: 'SAYU · 통계 · 합본 회고',
    note: 'SAYU는 흩어진 기록을 모아 생각과 흐름을 정리하는 HARU의 사유 기능입니다.',
  },
  {
    n: '03', icon: 'shield', hue: 'terracotta',
    title: '도움받기',
    body: '건강·문서·생활 문제를 기록을 바탕으로 점검합니다. 필요한 순간에 내 기록을 다시 꺼내 씁니다.',
    chip: '건강 기록 · 문서정리 · 전자소송연습',
    note: '전자소송연습은 법률 판단이나 대리 업무가 아니라, 서류와 기한을 빠뜨리지 않도록 돕는 체크리스트형 연습 기능입니다.',
  },
  {
    n: '04', icon: 'seed', hue: 'green',
    title: '발견하기',
    body: '식물, 책, 채널, 장소처럼 내가 발견한 가치를 모읍니다. 기록은 나만의 발견 목록이 됩니다.',
    chip: '식물탐정 · 명작탐정 · 숨은 채널',
    note: '명작탐정은 향후 잊힌 책과 숨은 채널처럼 다시 소개할 가치가 있는 콘텐츠를 기록하는 발견형 비서로 확장될 예정입니다.',
  },
];

const FLOW = [
  { n: '01', t: '기록 입력',   d: '오늘 있었던 일을 평소 말투로 자유롭게 적습니다.' },
  { n: '02', t: 'AI 정리',     d: 'SAYU가 표현만 다듬어 읽기 좋은 글로 정돈합니다.' },
  { n: '03', t: '분류 · 검색', d: '형식과 날짜로 자동 분류되고, 키워드로 찾을 수 있습니다.' },
  { n: '04', t: '통계 · 합본', d: '월별·연도별로 흐름을 보여주고, 한 권으로 묶어 보관합니다.' },
  { n: '05', t: '평생 자산',   d: '책 소재가 되고, 회고 자료가 되고, 다음 세대에 남길 기록이 됩니다.' },
];

const PRICING = [
  {
    plan: 'LIGHT', price: '₩4,000', period: '/월',
    note: '기록하고 정리하는 기본 구독 · AI 비서 월 10회',
    bullets: ['목적별 기록 형식', 'SAYU BASIC 다듬기', '통계 · 합본'],
    highlight: false, badge: '',
  },
  {
    plan: 'PREMIUM', price: '₩5,000', period: '/월',
    note: '기록을 해석하고 활용하는 확장 구독 · AI 비서 일 2회 / 월 40회',
    bullets: ['LIGHT 모든 기능', '전문 AI 비서실', 'SAYU PREMIUM'],
    highlight: true, badge: 'RECOMMENDED',
  },
];

/* ── 아이콘 (Tabler 스타일 outline) ── */
const ICON_PATHS: Record<string, JSX.Element> = {
  diary: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 3v18M9 8h11M9 13h11" /></>,
  pen: <><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  book: <><path d="M4 4h6a3 3 0 013 3v14a2 2 0 00-2-2H4z" /><path d="M20 4h-6a3 3 0 00-3 3v14a2 2 0 012-2h7z" /></>,
  invest: <><path d="M3 17l6-6 4 4 8-9" /><path d="M14 6h7v7" /></>,
  plane: <><path d="M3 12l18-9-7 18-2-7-9-2z" /></>,
  seed: <><path d="M12 22V8" /><path d="M12 8c-3 0-5-2-5-5 3 0 5 2 5 5z" /><path d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5z" /></>,
  paw: <><circle cx="9" cy="6" r="2" /><circle cx="15" cy="6" r="2" /><circle cx="6" cy="11" r="2" /><circle cx="18" cy="11" r="2" /><path d="M12 14c-4 0-7 3-5 7 1 2 3 1 5 1s4 1 5-1c2-4-1-7-5-7z" /></>,
  baby: <><circle cx="12" cy="6" r="3" /><path d="M5 21c0-4 3-7 7-7s7 3 7 7" /></>,
  church: <><path d="M12 2v4M10 4h4" /><path d="M5 22V10l7-4 7 4v12" /><path d="M10 22v-6h4v6" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" /></>,
  study: <><path d="M3 7l9-4 9 4-9 4z" /><path d="M21 10v5" /><path d="M7 9v6c0 1.5 2.5 3 5 3s5-1.5 5-3V9" /></>,
  memo: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  spark: <><path d="M12 3v3M5 6l2 2M3 12h3M5 18l2-2M12 18v3M17 16l2 2M18 12h3M19 6l-2 2" /><circle cx="12" cy="12" r="4" /></>,
  brain: <><path d="M9 4a3 3 0 013 3v10a3 3 0 01-6 0V8a3 3 0 013-4z" /><path d="M15 4a3 3 0 00-3 3v10a3 3 0 006 0V8a3 3 0 00-3-4z" /><path d="M6 11h12" /></>,
  law: <><path d="M5 21h14" /><path d="M12 3v18" /><path d="M7 8l-3 6h6z" /><path d="M17 8l3 6h-6z" /><path d="M12 3l-5 5M12 3l5 5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  bible: <><path d="M5 4h12a2 2 0 012 2v15H7a2 2 0 01-2-2z" /><path d="M12 8v6M9 11h6" /></>,
  chart: <><path d="M4 20V8M10 20V4M16 20v-8M22 20H4" /></>,
  bookbind: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M10 8h7M10 12h7M10 16h4" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" /><path d="M10 12h4" /></>,
  arrowR: <><path d="M5 12h14M13 5l7 7-7 7" /></>,
  check: <><path d="M5 12l5 5 9-9" /></>,
  x: <><path d="M6 6l12 12M18 6L6 18" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6" /></>,
  message: <><path d="M3 11c0-3 2-5 5-5h8c3 0 5 2 5 5v3c0 3-2 5-5 5h-2l-4 3v-3H8c-3 0-5-2-5-5z" /></>,
  camera: <><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></>,
  folder: <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></>,
  filter: <><path d="M4 4h16l-6 8v6l-4 2v-8z" /></>,
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.82 1.17V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>,
};

function Icon({ name, size = 22, color = 'currentColor', sw = 1.5 }: { name: string; size?: number; color?: string; sw?: number }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      {d}
    </svg>
  );
}

function GrapeMark({ size = 22, color = '#F5F0E8', accent = '#E8B894' }: { size?: number; color?: string; accent?: string }) {
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 22 26" fill={color} style={{ display: 'block' }}>
      <circle cx="6" cy="10" r="3.6" />
      <circle cx="11" cy="9" r="3.6" />
      <circle cx="16" cy="10" r="3.6" />
      <circle cx="8.5" cy="15" r="3.6" />
      <circle cx="13.5" cy="15" r="3.6" />
      <circle cx="11" cy="20" r="3.6" />
      <path d="M11 6 Q12 3 14 2" stroke={accent} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ── 히어로 폰 목업 (앱 홈 미리보기) ── */
const PH_RECORDS: { name: string; icon: string; hue: Hue }[] = [
  { name: '일기', icon: 'diary', hue: 'green' },
  { name: '에세이', icon: 'pen', hue: 'lilac' },
  { name: '독서', icon: 'book', hue: 'terracotta' },
  { name: '주식', icon: 'invest', hue: 'green' },
  { name: '여행', icon: 'plane', hue: 'lilac' },
  { name: '텃밭', icon: 'seed', hue: 'green' },
  { name: '반려', icon: 'paw', hue: 'terracotta' },
  { name: '메모', icon: 'memo', hue: 'lilac' },
];
const PH_AGENTS: { name: string; sub: string; icon: string; hue: Hue }[] = [
  { name: '하루LAW', sub: '법령·판례', icon: 'law', hue: 'terracotta' },
  { name: '영어성경', sub: '듣기·해석', icon: 'bible', hue: 'green' },
];

function HaruPhone() {
  return (
    <div className="lp-phone" role="img" aria-label="HARU 앱 홈 화면 미리보기">
      <div className="lp-phone__notch" />
      <div className="lp-phone__inner">
        <div className="ph-stack">
          <div className="ph-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="ph-mark"><GrapeMark size={16} color="#F5F0E8" accent={C.peach} /></div>
              <div className="ph-titleblock">
                <div className="ph-title">HARU</div>
                <div className="ph-by">BY JOYEL</div>
              </div>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${C.border}`, background: '#fff', display: 'grid', placeItems: 'center', color: C.fg2 }}>
              <Icon name="user" size={14} />
            </div>
          </div>

          <div className="ph-hero">
            <div className="ph-hero__decoA" />
            <div className="ph-hero__decoB" />
            <div className="ph-hero__cap">2026 · NOV · FRI</div>
            <div className="ph-hero__date">11월 6일</div>
            <div className="ph-hero__pill">오늘 3건</div>
          </div>

          <div className="ph-section">HARU 기록</div>
          <div className="ph-grid">
            {PH_RECORDS.map((r) => (
              <div key={r.name} className="ph-cell">
                <div className="ph-cell__ico" style={{ background: hueBg[r.hue] }}>
                  <Icon name={r.icon} size={16} color={hueFg[r.hue]} />
                </div>
                <div className="ph-cell__lbl">{r.name}</div>
              </div>
            ))}
          </div>

          <div className="ph-section">HARU 비서실</div>
          <div className="ph-agents">
            {PH_AGENTS.map((a) => (
              <div key={a.name} className="ph-agent" style={{ background: agentBg[a.hue], borderColor: agentBorder[a.hue], color: hueFg[a.hue] }}>
                <div className="ph-agent__ico"><Icon name={a.icon} size={16} color={hueFg[a.hue]} /></div>
                <div>
                  <div className="ph-agent__t">{a.name}</div>
                  <div className="ph-agent__s">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="ph-cta">내 기록 서재 보기<Icon name="arrowR" size={12} color="#F5F0E8" /></div>

          <div className="ph-tab">
            <div className="ph-tab__item active"><Icon name="home" size={14} sw={2} /><span>HARU</span></div>
            <div className="ph-tab__item"><Icon name="spark" size={14} /><span>SAYU</span></div>
            <div className="ph-tab__item"><Icon name="cog" size={14} /><span>설정</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroFloats() {
  return (
    <>
      <div className="lp-float lp-float--a" style={{ width: 168, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name="spark" size={14} color={C.lilacDark} />
          <div style={{ fontSize: 11, fontWeight: 600, color: C.lilacDark, letterSpacing: '0.04em' }}>SAYU 정리됨</div>
        </div>
        <div style={{ fontSize: 11, color: C.fg2, lineHeight: 1.5 }}>원문 감정 그대로, 표현만 다듬었어요.</div>
      </div>
      <div className="lp-float lp-float--c" style={{ width: 160, padding: '12px 14px' }}>
        <div style={{ fontFamily: 'var(--lp-en)', fontSize: 9, letterSpacing: '2.5px', color: C.mute, textTransform: 'uppercase', marginBottom: 4 }}>이번 달 합본</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.fg, lineHeight: 1.35 }}>11월 일기 · 28편</div>
      </div>
    </>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { user, loading, googleSignIn } = useAuth();
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ color: C.oliveDark, fontSize: '18px' }}>로딩 중...</div>
      </div>
    );
  }

  const goToLogin = () => navigate('/login');
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleGoogleLogin = async () => {
    setIsLoginLoading(true);
    if (import.meta.env.DEV) {
      try {
        await googleSignIn();
        navigate('/');
      } catch (e: any) {
        console.error('[dev] Google login failed:', e);
        toast.error('Google 로그인 실패');
        setIsLoginLoading(false);
      }
      return;
    }
    setTimeout(() => {
      window.location.href = 'https://asia-northeast3-haru2026-8abb8.cloudfunctions.net/googleLoginStart';
    }, 1500);
  };

  const handleKakaoLogin = () => {
    setIsLoginLoading(true);
    setTimeout(() => {
      window.location.href = 'https://kakaologinstart-6ieesxet3q-du.a.run.app';
    }, 1500);
  };

  const handleNaverLogin = () => {
    setIsLoginLoading(true);
    setTimeout(() => {
      window.location.href = 'https://naverloginstart-6ieesxet3q-du.a.run.app';
    }, 1500);
  };

  const socialLoginButtons = [
    { label: 'Google', onClick: handleGoogleLogin },
    { label: '카카오', onClick: handleKakaoLogin },
    { label: '네이버', onClick: handleNaverLogin },
  ];

  return (
    <div className="lp-page">
      <style>{LP_CSS}</style>

      {/* ───── Top nav ───── */}
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav__inner">
          <a className="lp-nav__brand" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div className="lp-nav__mark"><GrapeMark size={20} color={C.bg} accent={C.peach} /></div>
            <div>
              <div className="lp-nav__name">HARU</div>
              <div className="lp-nav__by">BY JOYEL</div>
            </div>
          </a>
          <div className="lp-nav__links">
            <a href="#how" onClick={(e) => { e.preventDefault(); scrollTo('how'); }}>네 개의 문</a>
            <a href="#formats" onClick={(e) => { e.preventDefault(); scrollTo('formats'); }}>기록 형식</a>
            <a href="#sayu" onClick={(e) => { e.preventDefault(); scrollTo('sayu'); }}>SAYU 원칙</a>
            <a href="#flow" onClick={(e) => { e.preventDefault(); scrollTo('flow'); }}>사용 흐름</a>
          </div>
          <div className="lp-nav__cta">
            <button className="lp-btn lp-btn--primary lp-btn--sm" onClick={goToLogin}>무료로 시작하기</button>
          </div>
        </div>
      </nav>

      <div className="lp-wrap lp-onboarding">
        <button type="button" className="lp-onboarding__button" onClick={() => navigate('/onboarding')}>
          <span className="lp-onboarding__icon" aria-hidden="true">
            <Icon name="spark" size={20} color={C.bg} sw={1.8} />
          </span>
          <span className="lp-onboarding__copy">
            <span className="lp-onboarding__title">처음이신가요? HARU 사용 안내 보기</span>
            <span className="lp-onboarding__desc">기록·SAYU·비서실을 1분 만에 둘러보세요</span>
          </span>
          <span className="lp-onboarding__cta">
            안내 보기<Icon name="arrowR" size={15} color={C.bg} sw={2} />
          </span>
        </button>
      </div>

      {/* ───── Hero ───── */}
      <section className="lp-hero" id="top">
        <div className="lp-hero__deco"><span /><span /></div>
        <div className="lp-wrap lp-hero__grid">
          <div>
            <div className="lp-cap">RECORD · UNDERSTAND · USE · DISCOVER</div>
            <h1 className="lp-h1">
              흘러가는 하루를,<br />
              <span style={{ color: C.oliveDark }}>다시 꺼내 쓸 수 있는</span> 기록으로.
            </h1>
            <p className="lp-hero__sub">
              HARU2026은 하루의 기록, 생각, 건강, 배움, 발견을 모아<br />
              필요한 순간에 다시 활용할 수 있도록 돕는 <strong style={{ color: C.fg, fontWeight: 600 }}>AI 기록 플랫폼</strong>입니다.
            </p>
            <div className="lp-hero__cta-row">
              <button className="lp-btn lp-btn--primary" onClick={goToLogin}>
                무료로 시작하기<Icon name="arrowR" size={18} sw={2} />
              </button>
              <button className="lp-btn lp-btn--ghost" onClick={() => scrollTo('how')}>HARU가 하는 일 보기</button>
            </div>
            <div className="lp-hero__login">
              <span className="lp-hero__login-title">기존 회원은 바로 로그인하세요</span>
              {socialLoginButtons.map((b) => (
                <button key={b.label} type="button" onClick={b.onClick} disabled={isLoginLoading} className="lp-hero__login-btn">
                  {b.label}
                </button>
              ))}
            </div>
            <div className="lp-hero__trust">
              <span><Icon name="shield" size={18} color={C.olive} />원문 감정 그대로</span>
              <span><Icon name="user" size={18} color={C.olive} />평생 사용을 위한 설계</span>
              <span><Icon name="archive" size={18} color={C.olive} />언제든 합본·내보내기</span>
            </div>
          </div>
          <div className="lp-hero__visual">
            <HaruPhone />
            <HeroFloats />
          </div>
        </div>
      </section>

      {/* ───── Trust strip ───── */}
      <div className="lp-divider">
        <div className="lp-wrap lp-divider__inner">
          <span><Icon name="shield" size={14} />원문 감정 보존</span>
          <span><Icon name="spark" size={14} />SAYU AI 정리</span>
          <span><Icon name="archive" size={14} />평생 자산화</span>
          <span><Icon name="bookbind" size={14} />합본 · 책 소재</span>
          <span><Icon name="chart" size={14} />통계 · 회고</span>
        </div>
      </div>

      {/* ───── Problem ───── */}
      <section className="lp-section lp-section--soft" id="problem">
        <div className="lp-wrap">
          <div className="lp-cap">PROBLEM · 흩어진 기록</div>
          <h2 className="lp-h2">기록은 남기지만,<br />다시 꺼내 쓰기는 어렵습니다.</h2>
          <p className="lp-lead" style={{ maxWidth: 640 }}>
            한 사람의 하루는 메모장에, 사진첩에, 카톡에, 문서에 흩어집니다.
            남긴 양은 적지 않은데, 어디에 무엇이 있는지 다시 찾기는 쉽지 않습니다.
          </p>
          <div className="lp-prob-grid">
            {SCATTER.map((t) => (
              <div key={t.name} className="lp-prob-card" style={{ ['--rot' as any]: `${t.rot}deg` }}>
                <div className="lp-prob-card__ico"><Icon name={t.icon} size={26} /></div>
                <p className="lp-prob-card__name">{t.name}</p>
                <p className="lp-prob-card__sub">{t.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Four doors ───── */}
      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <div className="lp-cap">FOUR DOORS · 네 개의 문</div>
          <h2 className="lp-h2">기록하고, 이해하고,<br />도움받고, 발견합니다.</h2>
          <p className="lp-lead" style={{ maxWidth: 660 }}>
            기록은 단순한 추억이 아니라, 나중에 나를 이해하고 돕는 자료가 됩니다.
            HARU는 기록하고, SAYU는 의미를 정리하며, 전문 비서는 필요한 순간에 기록을 꺼내 씁니다.
            사용자는 네 개의 문으로 접근하고, 필요한 비서는 각 문 안에서 만납니다.
          </p>
          <div className="lp-doors">
            {DOORS.map((d) => (
              <article key={d.n} className="lp-pillar">
                <div className="lp-pillar__num">DOOR {d.n}</div>
                <div className="lp-pillar__ico" style={{ background: hueBg[d.hue] }}>
                  <Icon name={d.icon} size={28} color={hueFg[d.hue]} sw={1.6} />
                </div>
                <h3>{d.title}</h3>
                <p>{d.body}</p>
                <span className="lp-pillar__chip" style={{ background: hueBg[d.hue], color: hueFg[d.hue] }}>
                  <Icon name="check" size={14} color={hueFg[d.hue]} sw={2} />{d.chip}
                </span>
                {d.note && <p className="lp-pillar__note">{d.note}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Formats (실제 14) ───── */}
      <section className="lp-section lp-section--soft tight" id="formats">
        <div className="lp-wrap">
          <div className="lp-cap">FORMATS · 11가지로 시작합니다</div>
          <h2 className="lp-h2">한 줄에도 자리가 있습니다.</h2>
          <p className="lp-lead" style={{ maxWidth: 600 }}>
            생활·업무·전문 영역까지, 무엇을 적을지 정하면 어떻게 정리될지가 따라옵니다.
            새로운 분야는 형식이 자라며 계속 더해지고 있습니다.
          </p>
          <div className="lp-formats">
            {FORMATS.map((f) => (
              <div key={f.name} className="lp-fmt">
                {f.badge && <span className="lp-fmt__badge">{f.badge}</span>}
                <div className="lp-fmt__ico" style={{ background: hueBg[f.hue] }}>
                  <Icon name={f.icon} size={24} color={hueFg[f.hue]} sw={1.6} />
                </div>
                <span className="lp-fmt__name">{f.name}</span>
                <span className="lp-fmt__cat">{f.cat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── SAYU principles ───── */}
      <section className="lp-section lp-sayu" id="sayu">
        <div className="lp-wrap">
          <div className="lp-cap">SAYU · 사유, 사용자의 글을 위한 원칙</div>
          <h2 className="lp-h2">내 감정은 그대로,<br />표현만 더 아름답게.</h2>
          <p className="lp-sayu__lead">
            AI가 사용자의 글에 새로운 이야기를 보태거나, 교훈을 덧붙이거나, 감정을 바꾸는 일은
            하지 않습니다. SAYU는 문장만 자연스럽게 다듬어, 사용자 자신의 글로 남깁니다.
          </p>
          <div className="lp-sayu__rules">
            <div className="lp-rule">
              <div className="lp-rule__badge lp-rule__badge--no"><Icon name="x" size={22} sw={2.2} /></div>
              <div className="lp-rule__title">재창작하지 않습니다</div>
              <p className="lp-rule__desc">없던 사건이나 묘사를 만들어 넣지 않습니다. 원문이 짧으면 짧은 채로, 단정하게 정돈할 뿐입니다.</p>
            </div>
            <div className="lp-rule">
              <div className="lp-rule__badge lp-rule__badge--no"><Icon name="x" size={22} sw={2.2} /></div>
              <div className="lp-rule__title">교훈을 덧붙이지 않습니다</div>
              <p className="lp-rule__desc">"오늘 하루도 감사하다" 같은 마무리를 임의로 더하지 않습니다. 의미는 사용자의 것이지, AI가 만들 영역이 아닙니다.</p>
            </div>
            <div className="lp-rule">
              <div className="lp-rule__badge lp-rule__badge--yes"><Icon name="check" size={22} sw={2.4} /></div>
              <div className="lp-rule__title">원문 감정을 보존합니다</div>
              <p className="lp-rule__desc">기쁨은 기쁨대로, 답답함은 답답함대로. 표현이 거칠 때는 다듬지만, 감정의 결은 손대지 않습니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Flow ───── */}
      <section className="lp-section" id="flow">
        <div className="lp-wrap">
          <div className="lp-cap">FLOW · 사용 흐름</div>
          <h2 className="lp-h2">오늘의 한 줄이<br />평생 자료가 되기까지.</h2>
          <p className="lp-lead" style={{ maxWidth: 580 }}>
            입력에서 보관까지 다섯 단계. 사용자는 첫 단계만, 나머지는 HARU가 합니다.
          </p>
          <div className="lp-flow">
            <div className="lp-flow__line" aria-hidden="true" />
            <div className="lp-flow__steps">
              {FLOW.map((s) => (
                <div key={s.n} className="lp-step">
                  <div className="lp-step__num">{s.n}</div>
                  <div className="lp-step__t">{s.t}</div>
                  <div className="lp-step__d">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── Creator note ───── */}
      <section className="lp-section tight">
        <div className="lp-wrap">
          <div className="lp-creator">
            <div className="lp-creator__avatar">許</div>
            <div>
              <div className="lp-cap" style={{ marginBottom: 14 }}>FROM THE FOUNDER</div>
              <p className="lp-creator__body">
                "평생을 가르치는 일에 썼습니다. 돌아보니 가장 아쉬운 것은, 매일 무언가를 적었지만
                다시 꺼내 쓰기 어려운 형태로 남았다는 점이었습니다.
                HARU는 글재주를 다투는 도구가 아니라, 평생 쌓아온 자신의 이야기를
                제 자리에 모아두는 도구입니다."
              </p>
              <div className="lp-creator__sig">— 주식회사 조이엘 (JOYEL Inc.) · 창립자 노트</div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Pricing (flag 숨김, 노출 시 현재 정책만) ───── */}
      {SHOW_PRICING && (
        <section className="lp-section lp-section--soft tight" id="pricing">
          <div className="lp-wrap" style={{ textAlign: 'center' }}>
            <div className="lp-trial-badge">🎁 지금 가입하면 <strong>7일 무료 체험</strong></div>
            <h2 className="lp-h2" style={{ textAlign: 'center' }}>구독 요금 안내</h2>
            <p className="lp-lead" style={{ margin: '0 auto 48px', textAlign: 'center' }}>하루의 기록이 쌓여 인생의 빅데이터가 됩니다.</p>
            <div className="lp-plans">
              {PRICING.map((p) => (
                <div key={p.plan} className={`lp-plan${p.highlight ? ' lp-plan--hl' : ''}`}>
                  {p.badge && <span className="lp-plan__badge">{p.badge}</span>}
                  <div className="lp-plan__name">{p.plan}</div>
                  <div className="lp-plan__price">{p.price}<span>{p.period}</span></div>
                  <p className="lp-plan__note">{p.note}</p>
                  <ul className="lp-plan__list">
                    {p.bullets.map((b) => (
                      <li key={b}><Icon name="check" size={15} color={p.highlight ? C.peach : C.olive} sw={2.2} />{b}</li>
                    ))}
                  </ul>
                  <button className="lp-btn lp-btn--primary" style={{ width: '100%' }} onClick={goToLogin}>7일 무료 체험 시작</button>
                </div>
              ))}
            </div>
            <p className="lp-plan__foot">7일 체험 기간 중 언제든 해지 가능 · 결제는 체험 종료 후 시작됩니다.</p>
          </div>
        </section>
      )}

      {/* ───── Final CTA ───── */}
      <section className="lp-section tight">
        <div className="lp-wrap">
          <div className="lp-final">
            <div className="lp-final__deco lp-final__deco--a" />
            <div className="lp-final__deco lp-final__deco--b" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="lp-cap" style={{ color: 'rgba(245,240,232,0.7)' }}>START TODAY</div>
              <h2>오늘의 기록은,<br />내일의 나를 돕는 자료가 됩니다.</h2>
              <p>한 줄도 좋고, 사진 한 장의 메모도 좋습니다. 쌓이는 일은 HARU가 합니다.</p>
              <div className="lp-final__cta-row">
                <button className="lp-btn lp-btn--primary" onClick={goToLogin}>무료로 시작하기<Icon name="arrowR" size={18} sw={2} /></button>
                <button className="lp-btn lp-btn--ghost" onClick={() => scrollTo(SHOW_PRICING ? 'pricing' : 'how')}>
                  {SHOW_PRICING ? '요금 · 구독 안내' : 'HARU 둘러보기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 전역 Footer(App.tsx)가 법적 정보·약관/개인정보/환불 링크를 담당하므로
          랜딩 자체 footer는 두지 않는다 (footer 중복 방지). */}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   스타일 — .lp-page 스코프로 한정 (전역 html/body 미오염)
   CD haru-tokens.css + landing.css 이식
   ──────────────────────────────────────────────────────────── */
const LP_CSS = `
.lp-page {
  --olive:#7A8B4E; --olive-dark:#4A5A2C;
  --lilac:#C9C0DE; --lilac-dark:#5A4E7A; --lilac-light:#DDD0E8;
  --light-green:#D4DEA0; --green-light:#E0E8B8;
  --terracotta:#B85C2E; --terracotta-light:#F5E5DC; --peach:#E8B894;
  --bg:#F5F0E8; --bg-2:#EDE8DC; --card:#FFFFFF; --border:#E5DFD0;
  --fg:#2C2C2A; --fg-2:#7A6F5A; --fg-muted:#888780;
  --accent-active:#7A8B4E; --accent-active-dark:#4A5A2C;
  --lp-en:'Inter',system-ui,sans-serif;
  --lp-kr:'Pretendard','Pretendard Variable',-apple-system,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  --lp-serif:'Nanum Myeongjo','Apple SD Gothic Neo',serif;
  --lp-hero:clamp(40px,6vw,76px);
  --lp-h2:clamp(28px,3.4vw,44px);
  --lp-h3:clamp(22px,2vw,28px);
  --lp-lead:clamp(16px,1.4vw,20px);
  --lp-content:1200px;
  --lp-pad-x:clamp(20px,4vw,64px);
  --ease:cubic-bezier(0.22,0.61,0.36,1);
  --dur:180ms; --dur-fast:120ms;
  background:var(--bg);
  color:var(--fg);
  font-family:var(--lp-kr);
  font-size:18px;
  line-height:1.7;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
.lp-page *{box-sizing:border-box;}
.lp-page ::selection{background:var(--olive);color:var(--bg);}

.lp-wrap{max-width:var(--lp-content);margin:0 auto;padding-left:var(--lp-pad-x);padding-right:var(--lp-pad-x);}
.lp-section{padding:clamp(64px,9vw,120px) 0;}
.lp-section.tight{padding:clamp(52px,6vw,84px) 0;}
.lp-section--soft{background:var(--bg-2);}

.lp-cap{font-family:var(--lp-en);font-size:12px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;color:var(--fg-muted);margin:0 0 18px;display:inline-flex;align-items:center;gap:10px;}
.lp-cap::before{content:"";width:28px;height:1px;background:currentColor;opacity:0.5;}

.lp-h1{font-family:var(--lp-kr);font-size:var(--lp-hero);font-weight:700;letter-spacing:-0.025em;line-height:1.14;margin:0 0 24px;color:var(--fg);}
.lp-h2{font-size:var(--lp-h2);font-weight:700;letter-spacing:-0.018em;line-height:1.22;margin:0 0 20px;color:var(--fg);}
.lp-lead{font-size:var(--lp-lead);line-height:1.7;color:var(--fg-2);margin:0;}

.lp-btn{font-family:var(--lp-kr);font-size:17px;font-weight:600;letter-spacing:-0.005em;padding:16px 26px;border-radius:14px;border:1px solid transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:background var(--dur) var(--ease),transform var(--dur-fast) var(--ease),border-color var(--dur) var(--ease),color var(--dur) var(--ease);min-height:56px;}
.lp-btn:active{transform:scale(0.985);}
.lp-btn:disabled{opacity:0.55;cursor:default;}
.lp-btn--primary{background:var(--accent-active-dark);color:var(--bg);box-shadow:0 8px 20px -14px rgba(74,90,44,0.55);}
.lp-btn--primary:hover{background:#3F4F26;}
.lp-btn--ghost{background:transparent;color:var(--fg);border-color:var(--border);}
.lp-btn--ghost:hover{background:#FAF6EE;border-color:#D8D1BE;}
.lp-btn--sm{font-size:15px;padding:10px 18px;min-height:44px;border-radius:12px;}

.lp-nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(16px) saturate(140%);-webkit-backdrop-filter:blur(16px) saturate(140%);background:rgba(245,240,232,0.82);border-bottom:1px solid rgba(229,223,208,0.6);}
.lp-nav__inner{display:flex;align-items:center;justify-content:space-between;height:72px;}
.lp-nav__brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;}
.lp-nav__mark{width:38px;height:38px;border-radius:11px;background:var(--accent-active-dark);display:grid;place-items:center;}
.lp-nav__name{font-weight:700;font-size:19px;letter-spacing:-0.01em;line-height:1;}
.lp-nav__by{font-family:var(--lp-en);font-size:10px;letter-spacing:0.18em;color:var(--fg-2);margin-top:4px;}
.lp-nav__links{display:flex;align-items:center;gap:4px;}
.lp-nav__links a{padding:8px 14px;border-radius:10px;color:var(--fg);text-decoration:none;font-size:15px;font-weight:500;transition:background var(--dur) var(--ease);}
.lp-nav__links a:hover{background:rgba(0,0,0,0.04);}
.lp-nav__cta{display:flex;align-items:center;gap:8px;}
@media(max-width:760px){.lp-nav__links{display:none;}}

.lp-onboarding{padding-top:18px;position:relative;z-index:2;}
.lp-onboarding__button{width:100%;border:0;border-radius:18px;background:linear-gradient(135deg,var(--olive-dark),#5C6E36);color:var(--bg);box-shadow:0 16px 36px -24px rgba(74,90,44,.65);padding:14px 16px;display:flex;align-items:center;gap:13px;text-align:left;cursor:pointer;transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease),filter var(--dur) var(--ease);}
.lp-onboarding__button:hover{transform:translateY(-1px);box-shadow:0 20px 42px -24px rgba(74,90,44,.75);filter:saturate(1.04);}
.lp-onboarding__icon{width:40px;height:40px;border-radius:12px;background:rgba(245,240,232,.18);display:grid;place-items:center;flex:0 0 auto;}
.lp-onboarding__copy{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1;}
.lp-onboarding__title{font-size:14px;font-weight:800;line-height:1.35;color:var(--bg);}
.lp-onboarding__desc{font-size:11px;line-height:1.45;color:rgba(245,240,232,.84);}
.lp-onboarding__cta{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:rgba(245,240,232,.2);padding:7px 13px;font-size:13px;font-weight:800;white-space:nowrap;flex:0 0 auto;}
@media(max-width:640px){.lp-onboarding{padding:12px 14px 0;}.lp-onboarding__button{align-items:flex-start;padding:13px 14px;border-radius:16px;}.lp-onboarding__icon{width:36px;height:36px;border-radius:11px;}.lp-onboarding__cta{display:none;}.lp-onboarding__title{font-size:13px;}.lp-onboarding__desc{font-size:10.5px;}}

.lp-hero{padding-top:clamp(48px,8vw,88px);padding-bottom:clamp(56px,8vw,104px);position:relative;}
.lp-hero__grid{display:grid;grid-template-columns:1.05fr 1fr;gap:clamp(40px,6vw,88px);align-items:center;}
@media(max-width:920px){.lp-hero__grid{grid-template-columns:1fr;}.lp-hero__visual{order:-1;min-height:480px;}}
.lp-hero__sub{font-size:var(--lp-lead);color:var(--fg-2);line-height:1.65;margin:0 0 32px;max-width:52ch;}
.lp-hero__cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:22px;}
.lp-hero__login{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:30px;}
.lp-hero__login-title{font-size:14px;color:var(--fg-2);margin-right:4px;font-weight:600;}
.lp-hero__login-btn{background:#fff;border:1px solid var(--border);border-radius:20px;padding:8px 16px;font-size:14px;font-weight:700;color:var(--fg);cursor:pointer;transition:border-color var(--dur) var(--ease),color var(--dur) var(--ease);}
.lp-hero__login-btn:hover{border-color:var(--olive);color:var(--olive-dark);}
.lp-hero__trust{display:flex;flex-wrap:wrap;gap:18px 30px;font-size:14px;color:var(--fg-2);}
.lp-hero__trust>span{display:inline-flex;align-items:center;gap:8px;}
.lp-hero__visual{position:relative;min-height:600px;display:grid;place-items:center;}

.lp-phone{width:320px;height:640px;border-radius:44px;background:var(--card);border:1px solid var(--border);box-shadow:0 40px 80px -50px rgba(74,90,44,0.4),0 12px 24px -16px rgba(0,0,0,0.1);padding:14px;position:relative;z-index:2;overflow:hidden;}
.lp-phone__inner{width:100%;height:100%;border-radius:32px;background:var(--bg);overflow:hidden;position:relative;}
.lp-phone__notch{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:90px;height:22px;background:#1a1a1a;border-radius:999px;z-index:10;}

.lp-float{position:absolute;background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px 16px;box-shadow:0 18px 36px -22px rgba(74,90,44,0.35);z-index:3;animation:lpFloatY 6s ease-in-out infinite;}
.lp-float--a{top:8%;left:-6%;animation-delay:0s;}
.lp-float--c{bottom:6%;left:-2%;animation-delay:-4s;}
@keyframes lpFloatY{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}

.lp-hero__deco{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;}
.lp-hero__deco span{position:absolute;border-radius:50%;filter:blur(40px);}
.lp-hero__deco span:nth-child(1){width:380px;height:380px;background:var(--light-green);top:-120px;right:-60px;opacity:0.45;}
.lp-hero__deco span:nth-child(2){width:280px;height:280px;background:var(--lilac);bottom:-80px;left:35%;opacity:0.35;}

.lp-divider{border-top:1px solid var(--border);padding:26px 0;background:var(--bg-2);}
.lp-divider__inner{display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:wrap;font-size:13px;font-weight:500;letter-spacing:0.06em;color:var(--fg-muted);}
.lp-divider__inner>span{display:inline-flex;align-items:center;gap:9px;}
.lp-divider__inner svg{opacity:0.6;}

.lp-prob-grid{margin-top:52px;display:grid;grid-template-columns:repeat(5,1fr);gap:18px;}
@media(max-width:920px){.lp-prob-grid{grid-template-columns:repeat(2,1fr);}}
.lp-prob-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:22px 18px;text-align:center;transform:rotate(var(--rot,0deg));transition:transform var(--dur) var(--ease);}
.lp-prob-card:hover{transform:rotate(0deg) translateY(-4px);}
.lp-prob-card__ico{width:56px;height:56px;border-radius:14px;background:var(--bg-2);margin:0 auto 14px;display:grid;place-items:center;color:var(--fg-2);}
.lp-prob-card__name{font-size:16px;font-weight:600;color:var(--fg);margin:0 0 4px;}
.lp-prob-card__sub{font-size:13px;color:var(--fg-muted);line-height:1.55;margin:0;}

.lp-pillars{margin-top:52px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
@media(max-width:920px){.lp-pillars{grid-template-columns:1fr;}}
.lp-doors{margin-top:52px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;}
@media(max-width:1100px){.lp-doors{grid-template-columns:repeat(2,1fr);}}
@media(max-width:560px){.lp-doors{grid-template-columns:1fr;}}
.lp-pillar{background:var(--card);border:1px solid var(--border);border-radius:22px;padding:32px 28px;position:relative;overflow:hidden;min-height:300px;display:flex;flex-direction:column;}
.lp-pillar__num{font-family:var(--lp-en);font-size:13px;font-weight:500;letter-spacing:0.2em;color:var(--fg-muted);margin-bottom:18px;}
.lp-pillar__ico{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;margin-bottom:18px;}
.lp-pillar h3{font-size:22px;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em;color:var(--fg);}
.lp-pillar p{font-size:16px;color:var(--fg-2);line-height:1.7;margin:0;flex:1;}
.lp-pillar__chip{margin-top:20px;display:inline-flex;align-self:flex-start;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.04em;}
.lp-pillar__note{margin:14px 0 0;font-size:12.5px;line-height:1.55;color:var(--fg-muted);border-top:1px dashed var(--border);padding-top:12px;flex:none;}

.lp-formats{margin-top:44px;display:grid;grid-template-columns:repeat(7,1fr);gap:12px;}
@media(max-width:1100px){.lp-formats{grid-template-columns:repeat(5,1fr);}}
@media(max-width:760px){.lp-formats{grid-template-columns:repeat(4,1fr);gap:10px;}}
@media(max-width:480px){.lp-formats{grid-template-columns:repeat(3,1fr);}}
.lp-fmt{position:relative;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px 10px 16px;display:flex;flex-direction:column;align-items:center;gap:8px;}
.lp-fmt__ico{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;margin-bottom:2px;}
.lp-fmt__name{font-size:14px;font-weight:600;color:var(--fg);text-align:center;}
.lp-fmt__cat{font-size:11px;font-weight:600;color:var(--fg-muted);}
.lp-fmt__badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:var(--olive);color:#fff;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap;}

.lp-agents{margin-top:44px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
@media(max-width:1100px){.lp-agents{grid-template-columns:repeat(2,1fr);}}
@media(max-width:540px){.lp-agents{grid-template-columns:1fr;}}
.lp-agent{position:relative;border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:12px;min-height:178px;border:1px solid;transition:transform var(--dur) var(--ease);overflow:hidden;}
.lp-agent:hover{transform:translateY(-3px);}
.lp-agent__top{display:flex;align-items:center;gap:12px;}
.lp-agent__ico{width:48px;height:48px;border-radius:13px;background:var(--card);display:grid;place-items:center;flex-shrink:0;}
.lp-agent__name{font-size:17px;font-weight:700;}
.lp-agent__sub{font-family:var(--lp-en);font-size:10px;font-weight:600;letter-spacing:0.12em;opacity:0.8;margin-top:3px;}
.lp-agent__desc{font-size:14px;line-height:1.6;flex:1;margin:0;}
.lp-agent__beta{position:absolute;top:14px;right:14px;background:#1A3C6E;color:#fff;font-size:9px;font-weight:800;letter-spacing:1.2px;padding:3px 8px;border-radius:999px;}

.lp-sayu{background:linear-gradient(180deg,var(--bg) 0%,var(--bg-2) 100%);border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.lp-sayu__lead{max-width:720px;font-size:22px;line-height:1.7;color:var(--fg);font-family:var(--lp-serif);font-weight:400;margin:0 0 52px;}
.lp-sayu__rules{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
@media(max-width:760px){.lp-sayu__rules{grid-template-columns:1fr;}}
.lp-rule{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:26px 24px;display:flex;flex-direction:column;gap:14px;}
.lp-rule__badge{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;}
.lp-rule__badge--no{background:var(--terracotta-light);color:var(--terracotta);}
.lp-rule__badge--yes{background:var(--green-light);color:var(--olive-dark);}
.lp-rule__title{font-size:18px;font-weight:700;color:var(--fg);}
.lp-rule__desc{font-size:15px;color:var(--fg-2);line-height:1.65;margin:0;}

.lp-flow{margin-top:52px;position:relative;}
.lp-flow__line{position:absolute;top:32px;left:6%;right:6%;height:2px;background:repeating-linear-gradient(to right,var(--border) 0 8px,transparent 8px 14px);z-index:0;}
@media(max-width:920px){.lp-flow__line{display:none;}}
.lp-flow__steps{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;position:relative;z-index:1;}
@media(max-width:920px){.lp-flow__steps{grid-template-columns:1fr;gap:18px;}}
.lp-step{display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 6px;}
.lp-step__num{width:64px;height:64px;border-radius:999px;background:var(--card);border:1px solid var(--border);display:grid;place-items:center;font-family:var(--lp-en);font-size:18px;font-weight:600;color:var(--accent-active-dark);margin-bottom:18px;box-shadow:0 1px 3px rgba(74,90,44,0.06);}
.lp-step__t{font-size:17px;font-weight:700;margin:0 0 6px;color:var(--fg);}
.lp-step__d{font-size:14px;color:var(--fg-2);line-height:1.55;max-width:180px;}

.lp-creator{background:var(--card);border:1px solid var(--border);border-radius:22px;padding:clamp(32px,5vw,56px);display:grid;grid-template-columns:80px 1fr;gap:clamp(20px,3vw,36px);align-items:flex-start;}
@media(max-width:760px){.lp-creator{grid-template-columns:1fr;}}
.lp-creator__avatar{width:80px;height:80px;border-radius:24px;background:linear-gradient(135deg,var(--lilac-light),var(--green-light));display:grid;place-items:center;font-family:var(--lp-serif);font-weight:700;font-size:30px;color:var(--olive-dark);}
.lp-creator__body{font-family:var(--lp-serif);font-size:20px;line-height:1.85;color:var(--fg);margin:0;}
.lp-creator__sig{margin-top:22px;font-size:14px;letter-spacing:0.04em;color:var(--fg-2);}

.lp-trial-badge{display:inline-flex;align-items:center;gap:8px;background:var(--olive);color:#fff;border-radius:999px;padding:8px 20px;font-size:14px;font-weight:700;margin-bottom:18px;}
.lp-plans{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;}
.lp-plan{position:relative;flex:1 1 260px;max-width:340px;background:var(--card);border:2px solid var(--border);border-radius:20px;padding:36px 28px;text-align:left;}
.lp-plan--hl{background:var(--olive-dark);border-color:var(--olive-dark);color:var(--bg);}
.lp-plan__badge{position:absolute;top:-12px;right:20px;background:var(--olive);color:#fff;font-size:10px;font-weight:800;letter-spacing:1.5px;padding:4px 10px;border-radius:999px;}
.lp-plan__name{font-size:13px;font-weight:800;letter-spacing:2px;margin-bottom:12px;color:var(--olive-dark);}
.lp-plan--hl .lp-plan__name{color:var(--peach);}
.lp-plan__price{font-size:40px;font-weight:800;color:var(--fg);}
.lp-plan--hl .lp-plan__price{color:var(--bg);}
.lp-plan__price span{font-size:14px;font-weight:500;color:var(--fg-muted);margin-left:4px;}
.lp-plan--hl .lp-plan__price span{color:rgba(245,240,232,0.6);}
.lp-plan__note{font-size:12px;color:var(--fg-muted);margin:6px 0 20px;}
.lp-plan--hl .lp-plan__note{color:rgba(245,240,232,0.6);}
.lp-plan__list{list-style:none;padding:0;margin:0 0 22px;display:flex;flex-direction:column;gap:8px;}
.lp-plan__list li{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--fg-2);}
.lp-plan--hl .lp-plan__list li{color:rgba(245,240,232,0.85);}
.lp-plan--hl .lp-btn--primary{background:var(--olive);color:#fff;}
.lp-plan--hl .lp-btn--primary:hover{background:#6b7a44;}
.lp-plan__foot{color:var(--fg-muted);font-size:12px;margin-top:20px;}

.lp-final{background:var(--accent-active-dark);color:var(--bg);border-radius:28px;padding:clamp(48px,7vw,84px) clamp(28px,5vw,72px);position:relative;overflow:hidden;text-align:center;}
.lp-final h2{font-size:clamp(30px,4vw,50px);font-weight:700;letter-spacing:-0.02em;line-height:1.2;margin:0 0 18px;color:var(--bg);}
.lp-final p{font-size:var(--lp-lead);line-height:1.65;color:rgba(245,240,232,0.78);margin:0 auto 36px;max-width:540px;}
.lp-final__deco{position:absolute;pointer-events:none;}
.lp-final__deco--a{top:-60px;right:-40px;width:220px;height:220px;border-radius:50%;background:rgba(232,184,148,0.15);}
.lp-final__deco--b{bottom:-80px;left:-60px;width:280px;height:280px;border-radius:50%;background:rgba(201,192,222,0.12);}
.lp-final .lp-btn--primary{background:var(--bg);color:var(--accent-active-dark);box-shadow:0 12px 24px -16px rgba(0,0,0,0.4);}
.lp-final .lp-btn--primary:hover{background:#FFFAF0;}
.lp-final .lp-btn--ghost{color:var(--bg);border-color:rgba(245,240,232,0.4);}
.lp-final .lp-btn--ghost:hover{background:rgba(245,240,232,0.08);border-color:rgba(245,240,232,0.6);}
.lp-final__cta-row{display:inline-flex;flex-wrap:wrap;justify-content:center;gap:12px;position:relative;z-index:1;}

.ph-stack{display:flex;flex-direction:column;height:100%;}
.ph-head{display:flex;align-items:center;justify-content:space-between;padding:38px 16px 8px;}
.ph-mark{width:30px;height:30px;border-radius:9px;background:var(--olive-dark);display:grid;place-items:center;}
.ph-titleblock{display:flex;flex-direction:column;gap:2px;}
.ph-title{font-size:13px;font-weight:700;line-height:1;color:var(--fg);}
.ph-by{font-family:var(--lp-en);font-size:8px;letter-spacing:0.16em;color:var(--fg-2);}
.ph-hero{margin:4px 14px 10px;background:#fff;border:1px solid var(--border);border-radius:16px;padding:16px;position:relative;overflow:hidden;}
.ph-hero__decoA{position:absolute;top:-14px;right:20px;width:60px;height:60px;border-radius:50%;background:var(--light-green);opacity:0.45;}
.ph-hero__decoB{position:absolute;top:14px;right:-8px;width:44px;height:44px;border-radius:50%;background:var(--lilac);opacity:0.5;}
.ph-hero__cap{font-family:var(--lp-en);font-size:9px;font-weight:500;letter-spacing:3px;color:var(--fg-muted);text-transform:uppercase;position:relative;}
.ph-hero__date{font-size:26px;font-weight:600;letter-spacing:-0.01em;color:var(--fg);margin-top:2px;}
.ph-hero__pill{margin-top:8px;display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:var(--green-light);color:var(--olive-dark);font-size:9px;font-weight:600;}
.ph-hero__pill::before{content:"";width:5px;height:5px;border-radius:999px;background:var(--olive);}
.ph-section{font-size:11px;font-weight:600;color:var(--fg);margin:6px 16px;}
.ph-grid{margin:0 14px 12px;display:grid;grid-template-columns:repeat(4,1fr);gap:5px;}
.ph-cell{background:#fff;border:1px solid var(--border);border-radius:12px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;}
.ph-cell__ico{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;}
.ph-cell__lbl{font-size:8px;font-weight:500;color:var(--fg);}
.ph-agents{margin:0 14px 12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.ph-agent{border-radius:12px;padding:8px;display:flex;align-items:center;gap:8px;border:1px solid;}
.ph-agent__ico{width:26px;height:26px;border-radius:8px;background:#fff;display:grid;place-items:center;flex-shrink:0;}
.ph-agent__t{font-size:9.5px;font-weight:600;line-height:1.1;}
.ph-agent__s{font-size:8px;opacity:0.7;margin-top:1px;}
.ph-cta{margin:0 14px;background:var(--olive-dark);color:var(--bg);border-radius:14px;padding:11px 12px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;font-weight:600;}
.ph-tab{margin-top:6px;padding:8px 0 10px;border-top:1px solid var(--border);background:#fff;display:grid;grid-template-columns:repeat(3,1fr);}
.ph-tab__item{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:8px;color:var(--fg-muted);}
.ph-tab__item.active{color:var(--olive-dark);font-weight:600;}
`;
