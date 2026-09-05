import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  FileText,
  Home,
  PenLine,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { markAssistantOnboardingSeen } from '../services/assistantOnboardingService';

const FONT_KR = "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";
const NAVY = '#1A3C6E';
const GREEN = '#4A5A2C';
const TERRACOTTA = '#B85C2E';
const BORDER = '#E5DFD0';
const TEXT = '#2C2C2A';
const MUTED = '#7A6F5A';
const SOFT = '#F8F5ED';

type SectionConfig = {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
};

const weeklyRecords = [
  {
    week: '1주차',
    title: '기록을 시작한 흔적',
    body: '산책, 가족 대화, 짧은 감사가 먼저 남습니다.',
    count: 5,
  },
  {
    week: '2주차',
    title: '반복되는 생활이 보임',
    body: '비슷한 시간, 비슷한 감정, 자주 쓰는 말이 쌓입니다.',
    count: 10,
  },
  {
    week: '3주차',
    title: '관심 주제가 선명해짐',
    body: '건강, 가족, 독서, 일의 흐름처럼 자주 돌아오는 주제가 드러납니다.',
    count: 15,
  },
  {
    week: '4주차',
    title: '한 달의 자료가 됨',
    body: '20개의 짧은 기록이 월간 합본과 통계의 재료가 됩니다.',
    count: 20,
  },
];

const exampleRecords = [
  '월요일 저녁, 아내와 강변을 걸었다. 바람이 시원했다.',
  '아침에 책 한 문장이 오래 남았다. 부족함도 배움의 시작일 수 있다.',
  '점심 뒤 20분 걸었다. 무리하지 않아도 움직였다는 점이 좋았다.',
  '딸과 통화했다. 별말은 없었지만 목소리를 들으니 마음이 놓였다.',
  '옥상 화분에 새순이 보였다. 며칠 전보다 잎이 단단해졌다.',
  '오전 회의에서 다음 일정이 정리됐다. 할 일이 분명해졌다.',
  '저녁은 간단히 먹고 일찍 쉬었다. 피로가 줄었다.',
  '비가 와서 산책은 못 했지만 창밖 소리를 오래 들었다.',
  '읽던 책을 세 장 더 읽었다. 천천히 읽어도 계속 가면 된다.',
  '오늘은 기록할 일이 없다고 생각했는데, 조용한 하루도 남길 만했다.',
  '시장에 다녀왔다. 오래된 가게들이 아직 그대로 있어서 반가웠다.',
  '업무 메모를 정리했다. 내일 오전에 먼저 처리할 일이 보인다.',
  '잠깐 짜증이 났지만, 산책하고 나니 마음이 가라앉았다.',
  '호박꽃 사진을 찍었다. 같은 자리인데 매일 조금씩 다르다.',
  '가족 단톡방에 사진을 올렸다. 짧은 답장에도 웃음이 났다.',
  '오늘의 문장은 “꾸준함은 조용히 쌓인다”로 남기고 싶다.',
  '회의록을 다시 보니 빠진 내용이 있었다. 바로 보완했다.',
  '저녁에 물을 충분히 마셨다. 사소하지만 몸이 가벼웠다.',
  '하루가 빨리 지나갔다. 그래도 한 줄 남기니 정리되는 느낌이다.',
  '이번 달은 완벽하지 않았지만, 끊기지 않고 돌아온 시간이 있었다.',
];

const stats = [
  { label: '기록 수', value: '20개' },
  { label: '반복 주제', value: '가족 · 산책 · 독서' },
  { label: '감정 흐름', value: '차분함 증가' },
  { label: '다음 행동', value: '저녁 산책 유지' },
];

const terms = [
  ['기록틀', '막막하지 않게 질문을 나누어 적는 입력 형식입니다.'],
  ['SAYU', '사용자의 뜻은 유지하면서 읽기 좋은 기록으로 다듬는 사유 공간입니다.'],
  ['합본', '여러 날의 기록을 한 달 단위 문서처럼 묶어 보는 기능입니다.'],
  ['통계', '기록 빈도, 반복 주제, 감정 흐름을 숫자와 문장으로 보는 기능입니다.'],
  ['미래보기', '기록에서 보이는 생활 흐름을 참고해 다음 선택을 생각해 보는 기능입니다.'],
  ['비서 연결', '일부 기능은 직접 활용하고, 일부는 사용자가 선택해 이어서 쓰며, 일부는 확장 예정입니다.'],
];

const assistantLinks = [
  {
    name: 'SAYU 사유비서',
    source: '일상, 독서, 가족 대화',
    use: '짧은 기록을 읽기 좋은 사유 기록으로 정리합니다.',
  },
  {
    name: '기록통계 비서',
    source: '기록 빈도, 반복 단어, 감정 흐름',
    use: '한 달 동안 자주 등장한 생활 패턴을 보여줍니다.',
  },
  {
    name: '성장타임라인',
    source: '사진 기록, 식물 변화, 가족 성장 기록',
    use: '날짜순 변화가 있는 기록을 한눈에 볼 수 있게 돕습니다.',
  },
  {
    name: '가족기억 비서',
    source: '가족 대화, 여행 사진, 감사 기록',
    use: '나중에 다시 꺼내 보기 좋은 기억을 정리하는 방향으로 이어집니다.',
  },
];

export function AssistantOnboardingDetailPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState('오늘은 별일 없었지만 저녁에 아내와 산책했다.');

  const refinedEntry = useMemo(() => {
    const trimmed = entry.trim() || '오늘 하루를 한 줄로 남겼다.';
    return `${trimmed} 이 기록은 큰 사건보다 하루를 어떻게 마무리했는지 보여줍니다. HARU2026은 짧은 문장을 읽기 좋은 생활 기록으로 정리하고, 나중에 다시 꺼내 볼 수 있는 자료로 쌓아갑니다.`;
  }, [entry]);

  const finishAndGo = async (path: '/record' | '/v2') => {
    if (loading) return;
    if (!user?.uid) {
      navigate('/login');
      return;
    }

    setSaving(true);
    try {
      await markAssistantOnboardingSeen(user.uid);
      navigate(path, { replace: true, state: path === '/record' ? { from: '/onboarding/detail' } : undefined });
    } catch (error) {
      console.error('온보딩 완료 저장 실패:', error);
      toast.error('온보딩 상태 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const sections: SectionConfig[] = [
    {
      id: 'entry',
      title: '1. 한 줄 기록 체험',
      subtitle: '처음에는 길게 쓰지 않아도 됩니다.',
      icon: <PenLine size={20} />,
      children: (
        <div data-assistant-detail="two-column" style={twoColumnStyle}>
          <div style={sampleCardStyle}>
            <ExampleBadge />
            <label htmlFor="assistant-onboarding-entry" style={labelStyle}>한 줄 기록</label>
            <textarea
              id="assistant-onboarding-entry"
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              rows={4}
              style={textareaStyle}
            />
          </div>
          <div style={sampleCardStyle}>
            <ExampleBadge />
            <div style={labelStyle}>SAYU 정리 예시</div>
            <p style={largeTextStyle}>{refinedEntry}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'pileup',
      title: '2. 4주 동안 20개 기록이 쌓이는 과정',
      subtitle: '작은 기록은 시간이 지나며 생활의 흐름을 보여줍니다.',
      icon: <CalendarDays size={20} />,
      children: (
        <div data-assistant-detail="grid4" style={gridStyle(4)}>
          {weeklyRecords.map((week) => (
            <div key={week.week} style={sampleCardStyle}>
              <ExampleBadge />
              <div style={weekCountStyle}>{week.count}개</div>
              <h3 style={miniTitleStyle}>{week.week} · {week.title}</h3>
              <p style={bodyTextStyle}>{week.body}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'records',
      title: '3. 20개 예시 기록',
      subtitle: '짧고 평범한 문장도 모이면 한 달의 자료가 됩니다.',
      icon: <BookOpen size={20} />,
      children: (
        <div data-assistant-detail="records-grid" style={recordsGridStyle}>
          {exampleRecords.map((record, index) => (
            <div key={`${record}-${index}`} style={recordItemStyle}>
              <span style={recordNumberStyle}>{String(index + 1).padStart(2, '0')}</span>
              <span>{record}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'merge',
      title: '4. 월간 합본 문서 예시',
      subtitle: '흩어진 한 줄이 한 달의 생활문서로 묶입니다.',
      icon: <FileText size={20} />,
      children: (
        <div style={documentStyle}>
          <ExampleBadge />
          <h3 style={{ ...miniTitleStyle, fontSize: 24 }}>김복순의 6월 생활기록</h3>
          <p style={bodyTextStyle}>
            예시 데이터입니다. 김복순의 6월은 거창한 사건보다 산책, 가족 대화, 독서, 식물 돌봄처럼
            반복된 생활의 장면으로 채워졌습니다. 기록은 완벽하지 않았지만, 다시 돌아와 적은 흔적이
            한 달의 리듬을 보여줍니다.
          </p>
        </div>
      ),
    },
    {
      id: 'stats',
      title: '5. 통계 예시',
      subtitle: '기록 수보다 중요한 것은 반복해서 드러나는 생활의 방향입니다.',
      icon: <BarChart3 size={20} />,
      children: (
        <div data-assistant-detail="grid4" style={gridStyle(4)}>
          {stats.map((item) => (
            <div key={item.label} style={statCardStyle}>
              <ExampleBadge />
              <div style={statValueStyle}>{item.value}</div>
              <div style={labelStyle}>{item.label}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'future',
      title: '6. 미래보기 예시',
      subtitle: '생활 기록을 바탕으로 다음 선택을 참고합니다.',
      icon: <Compass size={20} />,
      children: (
        <div style={sampleCardStyle}>
          <ExampleBadge />
          <p style={largeTextStyle}>
            이번 달 예시 기록에서는 저녁 산책, 가족 대화, 독서 문장이 반복됩니다. 이 흐름이 이어진다면
            다음 달에는 “무리하지 않는 꾸준함”을 목표로 삼아도 좋습니다. 미래보기는 정답을 맞히는
            기능이나 전문 판단이 아니라, 기록에서 보이는 생활 흐름을 참고하는 안내입니다.
          </p>
        </div>
      ),
    },
    {
      id: 'assistants',
      title: '7. 관련 비서 연결 예시',
      subtitle: '모든 것이 자동으로 이어진다고 과장하지 않습니다.',
      icon: <Users size={20} />,
      children: (
        <>
          <div style={honestNoticeStyle}>
            일부는 직접 활용하고, 일부는 사용자가 선택해 이어서 사용하며, 일부 연결은 향후 확장 예정입니다.
          </div>
          <div data-assistant-detail="grid2" style={gridStyle(2)}>
            {assistantLinks.map((assistant) => (
              <div key={assistant.name} style={sampleCardStyle}>
                <ExampleBadge />
                <h3 style={miniTitleStyle}>{assistant.name}</h3>
                <p style={bodyTextStyle}><b>연결되는 기록:</b> {assistant.source}</p>
                <p style={bodyTextStyle}><b>도와주는 일:</b> {assistant.use}</p>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      id: 'terms',
      title: '8. 쉬운 용어 설명',
      subtitle: '낯선 단어는 HARU2026 안에서 이렇게 쓰입니다.',
      icon: <Sparkles size={20} />,
      children: (
        <div data-assistant-detail="grid2" style={gridStyle(2)}>
          {terms.map(([term, desc]) => (
            <div key={term} style={termCardStyle}>
              <h3 style={miniTitleStyle}>{term}</h3>
              <p style={bodyTextStyle}>{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'plan',
      title: '9. 구독 플랜',
      subtitle: '무료로 시작하고, 필요한 기능은 베이직으로 확장할 수 있습니다.',
      icon: <FileText size={20} />,
      children: (
        <div data-assistant-detail="grid3" style={gridStyle(3)}>
          <div style={priceCardStyle}>
            <div style={planNameStyle}>무료</div>
            <div style={priceStyle}>₩0 / 월</div>
            <p style={bodyTextStyle}>기본 기록과 일부 AI 기능을 무료 한도 내에서 제한적으로 이용합니다.</p>
            <div style={trialStyle}>결제 없음</div>
          </div>
          <div style={priceCardStyle}>
            <div style={planNameStyle}>베이직</div>
            <div style={priceStyle}>₩4,000 / 월</div>
            <p style={bodyTextStyle}>EPUB 저장, 하루LAW 첨부파일, 더 넉넉한 기존 사용 한도를 제공합니다.</p>
            <div style={trialStyle}>결제 가능</div>
          </div>
          <div style={priceCardStyle}>
            <div style={planNameStyle}>프리미엄</div>
            <div style={priceStyle}>₩6,000 예정 / 월</div>
            <p style={bodyTextStyle}>장기 범위 합본과 통계는 준비 중이며 이번 출시에서는 결제되지 않습니다.</p>
            <div style={trialStyle}>준비 중</div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(900px 420px at 88% -12%, rgba(201,192,222,0.28), transparent 62%),' +
          'linear-gradient(180deg, #FAF8F0 0%, #EDE8DC 100%)',
        color: TEXT,
        fontFamily: FONT_KR,
      }}
    >
      <style>{`
        .assistant-detail-action:hover { transform: translateY(-1px); box-shadow: 0 14px 28px -24px rgba(74,90,44,0.48); }
        .assistant-detail-action:active { transform: scale(0.99); }
        @media (max-width: 860px) {
          [data-assistant-detail="page"] { padding: 20px 14px 112px !important; }
          [data-assistant-detail="hero"] { padding: 28px 20px !important; }
          [data-assistant-detail="title"] { font-size: 30px !important; }
          [data-assistant-detail="actions"] { flex-direction: column !important; align-items: stretch !important; }
          [data-assistant-detail="actions"] button { width: 100% !important; justify-content: center !important; }
          [data-assistant-detail="grid2"], [data-assistant-detail="grid4"], [data-assistant-detail="two-column"] { grid-template-columns: 1fr !important; }
          [data-assistant-detail="records-grid"] { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div data-assistant-detail="page" style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 24px 132px' }}>
        <section data-assistant-detail="hero" style={heroStyle}>
          <div style={eyebrowStyle}>HARU2026 첫 안내</div>
          <h1 data-assistant-detail="title" style={titleStyle}>
            한 줄 기록이 어떻게 생활문서가 되는지 30초만 살펴보세요.
          </h1>
          <p style={leadStyle}>
            모든 내용은 예시 데이터입니다. 내 기록을 쓰기 전, HARU2026이 기록을 정리하고 다시 꺼내 쓰는
            흐름을 먼저 보여드립니다.
          </p>
          <div data-assistant-detail="actions" style={actionRowStyle}>
            <button
              type="button"
              className="assistant-detail-action"
              onClick={() => finishAndGo('/record')}
              disabled={saving || loading}
              style={primaryButtonStyle}
            >
              첫 기록 쓰러가기
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="assistant-detail-action"
              onClick={() => finishAndGo('/v2')}
              disabled={saving || loading}
              style={secondaryButtonStyle}
            >
              <Home size={18} />
              홈으로 가기
            </button>
            <button
              type="button"
              className="assistant-detail-action"
              onClick={() => finishAndGo('/v2')}
              disabled={saving || loading}
              style={ghostButtonStyle}
            >
              나중에 보기
            </button>
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.id} style={sectionStyle}>
            <div style={sectionHeadStyle}>
              <div style={sectionIconStyle}>{section.icon}</div>
              <div>
                <h2 style={sectionTitleStyle}>{section.title}</h2>
                <p style={sectionSubtitleStyle}>{section.subtitle}</p>
              </div>
            </div>
            {section.children}
          </section>
        ))}

        <section style={bottomCtaStyle}>
          <h2 style={{ ...sectionTitleStyle, fontSize: 26 }}>이제 첫 기록을 남겨볼 차례입니다.</h2>
          <p style={sectionSubtitleStyle}>
            한 문장만 적어도 충분합니다. 기록은 오늘의 나에게서 시작해, 나중의 나에게 쓸모 있는 자료가 됩니다.
          </p>
          <div data-assistant-detail="actions" style={{ ...actionRowStyle, marginTop: 18 }}>
            <button
              type="button"
              className="assistant-detail-action"
              onClick={() => finishAndGo('/record')}
              disabled={saving || loading}
              style={primaryButtonStyle}
            >
              첫 기록 쓰러가기
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="assistant-detail-action"
              onClick={() => finishAndGo('/v2')}
              disabled={saving || loading}
              style={ghostButtonStyle}
            >
              나중에 보기
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ExampleBadge() {
  return <span style={exampleBadgeStyle}>예시 데이터</span>;
}

const heroStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  borderRadius: 24,
  padding: '42px 44px',
  boxShadow: '0 18px 42px -36px rgba(26,60,110,0.5)',
};

const eyebrowStyle: CSSProperties = {
  color: TERRACOTTA,
  fontSize: 13,
  fontWeight: 850,
  letterSpacing: 2,
  textTransform: 'uppercase',
};

const titleStyle: CSSProperties = {
  maxWidth: 760,
  margin: '12px 0 14px',
  color: NAVY,
  fontSize: 40,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
};

const leadStyle: CSSProperties = {
  maxWidth: 760,
  margin: 0,
  color: MUTED,
  fontSize: 16,
  lineHeight: 1.75,
};

const sectionStyle: CSSProperties = {
  marginTop: 18,
  background: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  borderRadius: 20,
  padding: 24,
};

const sectionHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 16,
};

const sectionIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 13,
  background: '#E0E8B8',
  color: GREEN,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: NAVY,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: 0,
};

const sectionSubtitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: MUTED,
  fontSize: 14,
  lineHeight: 1.6,
};

const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
};

const gridStyle = (columns: 2 | 3 | 4): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  gap: 14,
});

const sampleCardStyle: CSSProperties = {
  background: '#FFFDF8',
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 18,
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginTop: 12,
  color: MUTED,
  fontSize: 13,
  fontWeight: 850,
};

const textareaStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 116,
  marginTop: 8,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: '12px 14px',
  color: TEXT,
  fontFamily: FONT_KR,
  fontSize: 15,
  lineHeight: 1.65,
  resize: 'vertical',
};

const largeTextStyle: CSSProperties = {
  margin: '10px 0 0',
  color: TEXT,
  fontSize: 16,
  lineHeight: 1.75,
};

const bodyTextStyle: CSSProperties = {
  margin: '8px 0 0',
  color: TEXT,
  fontSize: 14,
  lineHeight: 1.7,
};

const miniTitleStyle: CSSProperties = {
  margin: '10px 0 0',
  color: TEXT,
  fontSize: 17,
  fontWeight: 850,
  letterSpacing: 0,
};

const weekCountStyle: CSSProperties = {
  marginTop: 12,
  color: GREEN,
  fontSize: 28,
  fontWeight: 900,
};

const recordsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const recordItemStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  background: SOFT,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: '10px 12px',
  color: TEXT,
  fontSize: 14,
  lineHeight: 1.55,
};

const recordNumberStyle: CSSProperties = {
  color: TERRACOTTA,
  fontSize: 12,
  fontWeight: 900,
  minWidth: 24,
};

const documentStyle: CSSProperties = {
  background: '#FFFDF8',
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 22,
};

const statCardStyle: CSSProperties = {
  background: '#FFFDF8',
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 18,
  minHeight: 128,
};

const statValueStyle: CSSProperties = {
  marginTop: 12,
  color: NAVY,
  fontSize: 22,
  fontWeight: 900,
};

const honestNoticeStyle: CSSProperties = {
  marginBottom: 14,
  background: '#F1EEE7',
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: '14px 16px',
  color: MUTED,
  fontSize: 14,
  lineHeight: 1.65,
};

const termCardStyle: CSSProperties = {
  background: SOFT,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 18,
};

const priceCardStyle: CSSProperties = {
  background: '#FFFDF8',
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  padding: 22,
};

const planNameStyle: CSSProperties = {
  color: MUTED,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 2,
};

const priceStyle: CSSProperties = {
  marginTop: 10,
  color: NAVY,
  fontSize: 28,
  fontWeight: 900,
};

const trialStyle: CSSProperties = {
  display: 'inline-flex',
  marginTop: 14,
  borderRadius: 999,
  padding: '7px 12px',
  background: '#E0E8B8',
  color: GREEN,
  fontSize: 13,
  fontWeight: 850,
};

const exampleBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  borderRadius: 999,
  padding: '4px 10px',
  background: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  color: MUTED,
  fontSize: 12,
  fontWeight: 850,
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
  padding: '0 19px',
  border: '1px solid transparent',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 850,
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
  background: SOFT,
  borderColor: BORDER,
  color: MUTED,
};

const bottomCtaStyle: CSSProperties = {
  marginTop: 18,
  background: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  borderRadius: 20,
  padding: 24,
};

export default AssistantOnboardingDetailPage;
