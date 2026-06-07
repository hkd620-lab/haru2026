import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, FileText, PenLine, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { markAssistantOnboardingSeen } from '../services/assistantOnboardingService';

const FONT_KR = "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";
const NAVY = '#1A3C6E';
const GREEN = '#4A5A2C';
const TERRACOTTA = '#B85C2E';
const BG = '#F5F0E8';
const BORDER = '#E5DFD0';
const TEXT = '#2C2C2A';
const MUTED = '#7A6F5A';

type Card = {
  title: string;
  label: string;
  body: string;
  icon: ReactNode;
  tone: 'green' | 'navy' | 'warm';
};

const cards: Card[] = [
  {
    title: '한 줄 기록',
    label: '예시 데이터',
    body: '오늘은 별일 없었지만 저녁에 아내와 산책했다.',
    tone: 'green',
    icon: <PenLine size={22} />,
  },
  {
    title: 'SAYU 정리',
    label: '예시 데이터',
    body:
      '특별한 사건은 없었지만, 아내와 함께 산책하며 하루를 차분히 마무리했다. 별일 없는 하루도 함께 걷고 대화한 시간이 남으면 의미 있는 기록이 된다.',
    tone: 'navy',
    icon: <Sparkles size={22} />,
  },
  {
    title: '한 달 뒤 활용',
    label: '예시 데이터',
    body: '20개의 기록이 쌓이면 월간 생활문서, 감정 흐름, 반복 주제, 미래보기 자료가 됩니다.',
    tone: 'warm',
    icon: <FileText size={22} />,
  },
];

export function AssistantOnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [saving, setSaving] = useState(false);

  const finishAndGo = async (path: '/record' | '/v2') => {
    if (loading) return;
    if (!user?.uid) {
      navigate('/login');
      return;
    }

    setSaving(true);
    try {
      await markAssistantOnboardingSeen(user.uid);
      navigate(path, { replace: true, state: path === '/record' ? { from: '/onboarding' } : undefined });
    } catch (error) {
      console.error('온보딩 완료 저장 실패:', error);
      toast.error('온보딩 상태 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(900px 420px at 90% -10%, rgba(212,222,160,0.28), transparent 60%),' +
          'linear-gradient(180deg, #FAF8F0 0%, #EDE8DC 100%)',
        color: TEXT,
        fontFamily: FONT_KR,
      }}
    >
      <style>{`
        .assistant-onboarding-action:hover { transform: translateY(-1px); box-shadow: 0 14px 28px -24px rgba(74,90,44,0.48); }
        .assistant-onboarding-action:active { transform: scale(0.99); }
        @media (max-width: 760px) {
          [data-assistant-onboarding="page"] { padding: 22px 16px 112px !important; }
          [data-assistant-onboarding="hero"] { padding: 28px 20px !important; }
          [data-assistant-onboarding="title"] { font-size: 30px !important; }
          [data-assistant-onboarding="grid"] { grid-template-columns: 1fr !important; }
          [data-assistant-onboarding="actions"] { flex-direction: column !important; align-items: stretch !important; }
          [data-assistant-onboarding="actions"] button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>

      <div data-assistant-onboarding="page" style={{ maxWidth: 980, margin: '0 auto', padding: '42px 24px 132px' }}>
        <section data-assistant-onboarding="hero" style={heroStyle}>
          <div style={eyebrowStyle}>HARU2026 첫 안내</div>
          <h1 data-assistant-onboarding="title" style={titleStyle}>
            처음 오셨나요?
            <br />
            한 줄 기록이 한 달 뒤에는 생활문서와 통계가 됩니다.
          </h1>
          <p style={leadStyle}>
            HARU2026은 짧게 쓴 하루를 읽기 좋은 기록으로 정리하고, 기록이 쌓이면 월간 합본,
            감정 흐름, 반복 주제, 미래보기 자료로 바꿔줍니다.
          </p>
        </section>

        <div data-assistant-onboarding="grid" style={gridStyle}>
          {cards.map((card) => (
            <article key={card.title} style={cardStyle}>
              <div style={iconWrapStyle(card.tone)}>{card.icon}</div>
              <div style={exampleBadgeStyle}>{card.label}</div>
              <h2 style={cardTitleStyle}>{card.title}</h2>
              <p style={cardBodyStyle}>{card.body}</p>
            </article>
          ))}
        </div>

        <section style={noteStyle}>
          <BookOpen size={20} />
          <span>위 내용은 내 기록을 쓰기 전, HARU2026이 어떤 식으로 정리하는지 보여주는 예시입니다.</span>
        </section>

        <div data-assistant-onboarding="actions" style={actionRowStyle}>
          <button
            type="button"
            className="assistant-onboarding-action"
            onClick={() => navigate('/onboarding/detail', { state: { from: '/onboarding' } })}
            style={primaryButtonStyle}
          >
            30초 자세히 보기
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            className="assistant-onboarding-action"
            onClick={() => finishAndGo('/record')}
            disabled={saving || loading}
            style={secondaryButtonStyle}
          >
            바로 첫 기록 쓰기
          </button>
          <button
            type="button"
            className="assistant-onboarding-action"
            onClick={() => finishAndGo('/v2')}
            disabled={saving || loading}
            style={ghostButtonStyle}
          >
            오늘은 건너뛰기
          </button>
        </div>
      </div>
    </main>
  );
}

const heroStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  borderRadius: 24,
  padding: '44px 46px',
  boxShadow: '0 18px 42px -36px rgba(26,60,110,0.5)',
};

const eyebrowStyle: CSSProperties = {
  color: TERRACOTTA,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 2,
  textTransform: 'uppercase',
};

const titleStyle: CSSProperties = {
  margin: '12px 0 16px',
  color: NAVY,
  fontSize: 42,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
};

const leadStyle: CSSProperties = {
  maxWidth: 720,
  margin: 0,
  color: MUTED,
  fontSize: 17,
  lineHeight: 1.75,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  marginTop: 18,
};

const cardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  padding: 22,
  minHeight: 230,
};

const cardTitleStyle: CSSProperties = {
  margin: '12px 0 8px',
  color: TEXT,
  fontSize: 20,
  fontWeight: 850,
};

const cardBodyStyle: CSSProperties = {
  margin: 0,
  color: TEXT,
  fontSize: 15,
  lineHeight: 1.7,
};

const exampleBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  marginTop: 14,
  borderRadius: 999,
  padding: '4px 10px',
  background: '#F8F5ED',
  border: `1px solid ${BORDER}`,
  color: MUTED,
  fontSize: 12,
  fontWeight: 800,
};

const iconWrapStyle = (tone: Card['tone']): CSSProperties => ({
  width: 48,
  height: 48,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: tone === 'navy' ? NAVY : tone === 'warm' ? TERRACOTTA : GREEN,
  background: tone === 'navy' ? '#EAF0F9' : tone === 'warm' ? '#F5E5DC' : '#E0E8B8',
});

const noteStyle: CSSProperties = {
  marginTop: 18,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: '#FFFDF8',
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: '16px 18px',
  color: MUTED,
  fontSize: 14,
  lineHeight: 1.6,
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 22,
};

const buttonBaseStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 999,
  padding: '0 20px',
  border: '1px solid transparent',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 800,
  transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: GREEN,
  color: '#FFFFFF',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#FFFFFF',
  borderColor: '#D4DEA0',
  color: GREEN,
};

const ghostButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: BG,
  borderColor: BORDER,
  color: MUTED,
};

export default AssistantOnboardingPage;
