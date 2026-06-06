import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  BarChart3,
  BookMarked,
  CalendarDays,
  ChevronDown,
  FileHeart,
  HeartHandshake,
  Leaf,
  PenLine,
  Search,
  Sparkles,
  Sprout,
} from 'lucide-react';

const FONT_KR =
  "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";
const FONT_EN = "'Inter', system-ui, sans-serif";
const FONT_SERIF = "'MaruBuri', 'Pretendard', serif";

type SceneId = 'first' | 'month' | 'assistant';
type LinkLevel = '실제 전달' | '느슨한 연결' | '이동 안내' | '향후 연결 예정';

type Scene = {
  id: SceneId;
  label: string;
  title: string;
  short: string;
  refined: string;
  outcome: string[];
};

const scenes: Scene[] = [
  {
    id: 'first',
    label: '첫 기록',
    title: '처음 쓰는 사람도 한 줄이면 충분합니다',
    short: '오늘은 별일 없었다. 그래도 저녁 공기가 좋았다.',
    refined:
      '오늘은 특별한 사건은 없었지만, 저녁 공기를 느끼며 하루를 조용히 마무리했다. 별일 없는 하루도 기록해두면 나중에 내 생활의 온도를 보여주는 자료가 된다.',
    outcome: ['SAYU 문장 정리', '감정 태그 생성 예시', '하루기록으로 축적', '나중에 월간 회고 재료'],
  },
  {
    id: 'month',
    label: '한 달 후',
    title: '짧은 기록이 모이면 생활의 모양이 보입니다',
    short: '산책, 식사, 가족 대화, 텃밭 관찰을 조금씩 남겼다.',
    refined:
      '한 달 동안 남긴 짧은 기록에는 산책, 식사 조절, 가족과의 대화, 텃밭 관찰이 반복해서 나타났다. 작게 적은 문장들이 모여 생활 습관과 마음의 흐름을 보여준다.',
    outcome: ['월간 생활문서 예시', '반복 주제 통계', '감정 흐름 보기', '미래보기 참고자료'],
  },
  {
    id: 'assistant',
    label: '비서 활용',
    title: '필요한 순간에 관련 비서가 다시 꺼내 씁니다',
    short: '건강, 가족, 식물, 독서 기록을 목적별로 다시 보고 싶다.',
    refined:
      '쌓인 기록은 단순 보관으로 끝나지 않고, 건강관리·가족 추억·식물 관찰·독서사유처럼 목적에 맞는 비서에서 다시 활용할 수 있는 자료가 된다.',
    outcome: ['건강관리 비서 참고', '가족·추억 정리 예시', '식물탐정 이동 안내', '독서사유 확장'],
  },
];

const gentleFlow = [
  {
    icon: <PenLine size={20} />,
    title: '한 줄로 시작',
    body: '길게 쓰지 않아도 됩니다. 오늘 기억나는 한 장면만 남깁니다.',
  },
  {
    icon: <Sparkles size={20} />,
    title: '읽기 좋게 정리',
    body: 'SAYU가 짧은 문장을 부드러운 기록 문장으로 바꿔보는 예시를 보여줍니다.',
  },
  {
    icon: <CalendarDays size={20} />,
    title: '시간이 쌓임',
    body: '며칠, 몇 주가 지나면 기록 사이의 반복과 변화가 보이기 시작합니다.',
  },
  {
    icon: <BookMarked size={20} />,
    title: '문서로 묶임',
    body: '한 달의 기록은 생활문서, 사유문집, 관찰기 같은 형태로 다시 읽을 수 있습니다.',
  },
  {
    icon: <BarChart3 size={20} />,
    title: '흐름으로 보임',
    body: '자주 나온 주제, 감정, 습관을 숫자와 간단한 막대그래프로 확인합니다.',
  },
  {
    icon: <HeartHandshake size={20} />,
    title: '비서와 이어짐',
    body: '필요한 비서에서 기록을 참고하거나 사용자가 직접 이어서 활용하는 구조를 안내합니다.',
  },
];

const monthlyNotes = [
  {
    day: '1주차',
    text: '산책과 수면 기록이 시작되었다.',
    tags: ['산책', '수면', '시작'],
  },
  {
    day: '2주차',
    text: '식사 조절과 가족 대화가 반복되었다.',
    tags: ['건강', '가족', '대화'],
  },
  {
    day: '3주차',
    text: '텃밭 관찰과 독서 문장이 함께 남았다.',
    tags: ['텃밭', '독서', '사유'],
  },
  {
    day: '4주차',
    text: '이번 달을 돌아보며 꾸준함을 확인했다.',
    tags: ['회고', '꾸준함', '감사'],
  },
];

const topicBars = [
  { label: '건강', count: 7 },
  { label: '가족', count: 5 },
  { label: '산책', count: 5 },
  { label: '텃밭', count: 4 },
  { label: '독서·사유', count: 3 },
];

const assistantCards: Array<{
  name: string;
  icon: ReactNode;
  records: string;
  help: string;
  level: LinkLevel;
}> = [
  {
    name: 'SAYU 사유비서',
    icon: <Sparkles size={20} />,
    records: '일상, 감정, 가족 대화, 독서 문장',
    help: '짧은 기록을 읽기 좋은 문장과 사유로 정리합니다.',
    level: '느슨한 연결',
  },
  {
    name: '건강관리 비서',
    icon: <HeartHandshake size={20} />,
    records: '산책, 식사, 수면, 체중, 단 음료 절제',
    help: '생활습관 흐름을 참고자료로 정리합니다. 의료 판단은 하지 않습니다.',
    level: '느슨한 연결',
  },
  {
    name: '식물탐정',
    icon: <Leaf size={20} />,
    records: '텃밭 사진, 호박꽃 관찰, 식물 변화',
    help: '식물 상태 확인과 관리 방향 참고로 이어질 수 있습니다.',
    level: '이동 안내',
  },
  {
    name: '기록통계 비서',
    icon: <BarChart3 size={20} />,
    records: '기록 빈도, 반복 단어, 감정 흐름',
    help: '한 달 기록의 패턴을 숫자와 흐름으로 보여줍니다.',
    level: '느슨한 연결',
  },
  {
    name: '미래보기 비서',
    icon: <Sprout size={20} />,
    records: '반복 습관, 관심 주제, 생활 흐름',
    help: '미래를 맞히지 않고 앞으로 살펴볼 방향을 제안합니다.',
    level: '향후 연결 예정',
  },
  {
    name: '가족·추억 비서',
    icon: <FileHeart size={20} />,
    records: '가족 대화, 여행 사진, 감사 기록',
    help: '가족과 추억을 나중에 다시 꺼내볼 자료로 정리합니다.',
    level: '향후 연결 예정',
  },
];

const levelStyles: Record<LinkLevel, { bg: string; border: string; color: string }> = {
  '실제 전달': { bg: '#E0E8B8', border: '#D4DEA0', color: '#4A5A2C' },
  '느슨한 연결': { bg: '#DDD0E8', border: '#C9C0DE', color: '#5A4E7A' },
  '이동 안내': { bg: '#F5E5DC', border: '#E8B894', color: '#B85C2E' },
  '향후 연결 예정': { bg: '#E5DFD0', border: '#D4CDB9', color: '#7A6F5A' },
};

export function OnyuPreviewPage() {
  const [activeSceneId, setActiveSceneId] = useState<SceneId>('first');
  const [showMonthlyNotes, setShowMonthlyNotes] = useState(false);
  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeSceneId) || scenes[0],
    [activeSceneId],
  );

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #F5F0E8 0%, #EDE8DC 100%)',
        color: '#2C2C2A',
        fontFamily: FONT_KR,
        fontSize: 14,
        lineHeight: 1.65,
      }}
    >
      <style>{`
        .onyu-button:hover { transform: translateY(-1px); box-shadow: 0 12px 26px -20px rgba(74,90,44,0.45); }
        .onyu-button:active { transform: scale(0.99); }
        .onyu-card:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -26px rgba(74,90,44,0.34); }
        .onyu-tab:hover { border-color: #D4DEA0; color: #4A5A2C; }
        @media (max-width: 760px) {
          [data-onyu="page"] { padding: 18px 14px 96px !important; }
          [data-onyu="hero"] { padding: 26px 18px !important; }
          [data-onyu="hero-title"] { font-size: 31px !important; }
          [data-onyu="hero-actions"] { flex-direction: column !important; align-items: stretch !important; }
          [data-onyu="hero-actions"] button { width: 100% !important; justify-content: center !important; }
          [data-onyu="grid-2"], [data-onyu="grid-3"] { grid-template-columns: 1fr !important; }
          [data-onyu="scene-tabs"] { grid-template-columns: 1fr !important; }
          [data-onyu="section-title"] { font-size: 23px !important; }
        }
      `}</style>

      <div
        data-onyu="page"
        style={{ maxWidth: 1120, margin: '0 auto', padding: '34px 28px 132px' }}
      >
        <section
          data-onyu="hero"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5DFD0',
            borderRadius: 24,
            padding: '44px 46px',
            boxShadow: '0 16px 40px -34px rgba(74,90,44,0.5)',
          }}
        >
          <Badge icon={<Sparkles size={14} />}>ONYU PREVIEW</Badge>
          <h1
            data-onyu="hero-title"
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 45,
              lineHeight: 1.16,
              color: '#4A5A2C',
              margin: '20px 0 16px',
              letterSpacing: 0,
              maxWidth: 760,
            }}
          >
            처음 쓰는 사람도
            <br />
            편안하게 이해하는 HARU2026
          </h1>
          <p style={{ maxWidth: 820, margin: 0, color: '#5F5D55', fontSize: 15, lineHeight: 1.85 }}>
            온유preview는 HARU2026을 처음 만나는 사용자가 부담 없이 이해하도록
            만든 비교용 정적 페이지입니다. 한 줄 기록이 정리되고, 쌓이고,
            다시 활용되는 과정을 부드럽게 보여줍니다.
          </p>
          <div
            data-onyu="hero-actions"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 26 }}
          >
            <ScrollButton onClick={() => scrollTo('onyu-scenes')}>한 줄 기록 체험 보기</ScrollButton>
            <ScrollButton onClick={() => scrollTo('onyu-month')}>한 달 흐름 보기</ScrollButton>
            <ScrollButton onClick={() => scrollTo('onyu-assistants')}>비서 연결 보기</ScrollButton>
          </div>
        </section>

        <Section
          id="onyu-promise"
          icon={<HeartHandshake size={20} />}
          title="온유preview의 설명 방식"
          body="기능을 많이 나열하기보다, 사용자가 ‘아, 이렇게 쓰는구나’를 느끼도록 쉬운 장면 중심으로 설명합니다."
        >
          <div data-onyu="grid-3" style={gridStyle(3)}>
            <InfoCard>
              <h3 style={cardTitleStyle}>겁내지 않아도 되는 기록</h3>
              <p style={cardTextStyle}>긴 글이 아니어도 됩니다. 하루의 작은 장면 하나면 시작할 수 있습니다.</p>
            </InfoCard>
            <InfoCard>
              <h3 style={cardTitleStyle}>나중에 다시 읽히는 기록</h3>
              <p style={cardTextStyle}>짧은 문장은 SAYU 정리, 합본, 통계 예시를 통해 다시 읽을 수 있는 자료가 됩니다.</p>
            </InfoCard>
            <InfoCard>
              <h3 style={cardTitleStyle}>과장하지 않는 연결</h3>
              <p style={cardTextStyle}>모든 비서가 자동 처리한다는 표현 없이, 현재 연결 수준을 정직하게 안내합니다.</p>
            </InfoCard>
          </div>
        </Section>

        <Section
          id="onyu-flow"
          icon={<Sprout size={20} />}
          title="기록이 자라는 순서"
          body="한 줄 기록에서 시작해 월간 자료와 비서 활용 예시로 이어지는 흐름을 정적 UI로 보여줍니다."
        >
          <div data-onyu="grid-3" style={gridStyle(6)}>
            {gentleFlow.map((step, index) => (
              <InfoCard key={step.title}>
                <div style={{ color: '#4A5A2C' }}>{step.icon}</div>
                <span style={{ color: '#B85C2E', fontFamily: FONT_EN, fontSize: 11, fontWeight: 800 }}>
                  STEP {index + 1}
                </span>
                <h3 style={cardTitleStyle}>{step.title}</h3>
                <p style={cardTextStyle}>{step.body}</p>
              </InfoCard>
            ))}
          </div>
        </Section>

        <Section
          id="onyu-scenes"
          icon={<PenLine size={20} />}
          title="한 줄 기록 체험"
          body="실제 저장이나 AI 호출 없이, 정적 예시로 한 줄 기록이 어떻게 정리되는지 보여줍니다."
        >
          <div
            data-onyu="scene-tabs"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}
          >
            {scenes.map((scene) => {
              const active = activeScene.id === scene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => setActiveSceneId(scene.id)}
                  className="onyu-tab"
                  style={{
                    border: `1px solid ${active ? '#D4DEA0' : '#E5DFD0'}`,
                    background: active ? '#E0E8B8' : '#FFFFFF',
                    color: active ? '#4A5A2C' : '#7A6F5A',
                    borderRadius: 14,
                    padding: '11px 12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'border-color 160ms, color 160ms, background 160ms',
                  }}
                >
                  {scene.label}
                </button>
              );
            })}
          </div>
          <div data-onyu="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 14, marginTop: 16 }}>
            <InfoCard>
              <PanelLabel>{activeScene.title}</PanelLabel>
              <h3 style={{ ...cardTitleStyle, color: '#4A5A2C' }}>짧은 입력</h3>
              <p style={largeTextStyle}>{activeScene.short}</p>
            </InfoCard>
            <InfoCard>
              <PanelLabel>SAYU 정리 예시</PanelLabel>
              <p style={largeTextStyle}>{activeScene.refined}</p>
            </InfoCard>
          </div>
          <InfoCard>
            <PanelLabel>이어지는 활용 예시</PanelLabel>
            <TagRow tags={activeScene.outcome} />
          </InfoCard>
        </Section>

        <Section
          id="onyu-month"
          icon={<CalendarDays size={20} />}
          title="한 달이 지나면 이런 자료가 됩니다"
          body="정적 예시 기록을 바탕으로 월간 합본, 통계, 반복 단어를 부드럽게 보여줍니다."
        >
          <div data-onyu="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <InfoCard>
              <h3 style={cardTitleStyle}>월간 생활문서 미리보기</h3>
              <p style={cardTextStyle}>
                이번 달 기록에는 산책, 가족 대화, 수면, 식사 조절, 텃밭 관찰이
                반복해서 나타났다. 큰 사건보다 작은 실천이 쌓였고, 그 기록은
                내 생활의 리듬을 다시 보는 자료가 되었다.
              </p>
              <p style={cardTextStyle}>
                아래 내용은 정적 예시 데이터로 만든 미리보기입니다. 실제
                서비스에서는 사용자의 기록을 바탕으로 생성됩니다.
              </p>
            </InfoCard>
            <InfoCard>
              <h3 style={cardTitleStyle}>반복 주제 통계</h3>
              <BarRows rows={topicBars} max={7} />
            </InfoCard>
          </div>

          <button
            type="button"
            className="onyu-button"
            onClick={() => setShowMonthlyNotes((value) => !value)}
            style={primaryButtonStyle}
          >
            <ChevronDown size={17} />
            {showMonthlyNotes ? '4주 예시 접기' : '4주 예시 펼쳐보기'}
          </button>

          {showMonthlyNotes && (
            <div data-onyu="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 14 }}>
              {monthlyNotes.map((note) => (
                <InfoCard key={note.day}>
                  <PanelLabel>{note.day}</PanelLabel>
                  <p style={cardTextStyle}>{note.text}</p>
                  <TagRow tags={note.tags} />
                </InfoCard>
              ))}
            </div>
          )}
        </Section>

        <Section
          id="onyu-search"
          icon={<Search size={20} />}
          title="나중에 다시 찾을 수 있는 자료"
          body="기록은 적는 순간보다, 나중에 다시 필요해지는 순간에 더 큰 힘을 가질 수 있습니다."
        >
          <div data-onyu="grid-3" style={gridStyle(3)}>
            <InfoCard>
              <h3 style={cardTitleStyle}>회고할 때</h3>
              <p style={cardTextStyle}>한 달 동안 무엇을 반복했고 어떤 감정이 많았는지 살펴봅니다.</p>
            </InfoCard>
            <InfoCard>
              <h3 style={cardTitleStyle}>정리할 때</h3>
              <p style={cardTextStyle}>가족, 건강, 식물, 독서 같은 주제를 따로 모아 문서처럼 읽습니다.</p>
            </InfoCard>
            <InfoCard>
              <h3 style={cardTitleStyle}>도움이 필요할 때</h3>
              <p style={cardTextStyle}>관련 비서에서 참고하거나 사용자가 선택해 이어서 활용합니다.</p>
            </InfoCard>
          </div>
        </Section>

        <Section
          id="onyu-assistants"
          icon={<HeartHandshake size={20} />}
          title="비서 연결은 이렇게 안내합니다"
          body="온유preview는 연결을 과장하지 않고, 어떤 기록이 어떤 비서와 이어질 수 있는지 카드로 설명합니다."
        >
          <div data-onyu="grid-3" style={gridStyle(3)}>
            {assistantCards.map((assistant) => (
              <InfoCard key={assistant.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: '#4A5A2C' }}>{assistant.icon}</span>
                  <LevelBadge level={assistant.level} />
                </div>
                <h3 style={{ ...cardTitleStyle, marginTop: 12 }}>{assistant.name}</h3>
                <PanelLabel>연결되는 기록</PanelLabel>
                <p style={cardTextStyle}>{assistant.records}</p>
                <PanelLabel>도와주는 일</PanelLabel>
                <p style={cardTextStyle}>{assistant.help}</p>
              </InfoCard>
            ))}
          </div>
        </Section>

        <Section
          id="onyu-safety"
          icon={<FileHeart size={20} />}
          title="정직한 안내"
          body="이번 페이지는 비교용 정적 프리뷰입니다. 실제 기능 연결은 최종 통합 단계에서 따로 검토합니다."
        >
          <InfoCard>
            <p style={largeTextStyle}>
              현재 모든 비서가 모든 기록을 완전 자동으로 가져가는 것은 아닙니다.
              일부는 기록을 참고하거나, 일부는 사용자가 선택해 이어서 사용할 수
              있으며, 일부 연결은 앞으로 확장될 예정입니다.
            </p>
          </InfoCard>
          <div data-onyu="grid-3" style={{ ...gridStyle(4), marginTop: 14 }}>
            {(['실제 전달', '느슨한 연결', '이동 안내', '향후 연결 예정'] as LinkLevel[]).map((level) => (
              <InfoCard key={level}>
                <LevelBadge level={level} />
                <p style={{ ...cardTextStyle, marginTop: 12 }}>{connectionDescriptions[level]}</p>
              </InfoCard>
            ))}
          </div>
        </Section>

        <section
          style={{
            marginTop: 34,
            background: '#4A5A2C',
            color: '#FFFFFF',
            borderRadius: 24,
            padding: '28px 26px',
          }}
        >
          <h2 style={{ fontFamily: FONT_SERIF, fontSize: 26, margin: 0, letterSpacing: 0 }}>
            HARU2026은 천천히 쌓이는 기록을 다시 쓸 수 있게 돕습니다.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.78)', margin: '10px 0 0', maxWidth: 820 }}>
            이 페이지에는 Firestore 저장, Functions 호출, AI API 호출, 실제
            핸드오프, 실제 PDF 생성 기능이 없습니다. 비교 검토를 위한 정적 UI만
            포함합니다.
          </p>
        </section>
      </div>
    </div>
  );
}

const connectionDescriptions: Record<LinkLevel, string> = {
  '실제 전달': '기록을 들고 비서로 들어가는 연결입니다.',
  '느슨한 연결': '같은 기록 저장소나 정리 결과를 바탕으로 나중에 활용할 수 있는 연결입니다.',
  '이동 안내': '비서 페이지로 이동하지만 기록 데이터 전달은 없는 안내입니다.',
  '향후 연결 예정': '현재는 프리뷰 안내만 가능하고, 추후 확장될 연결입니다.',
};

function Section({
  id,
  icon,
  title,
  body,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section id={id} style={{ marginTop: 34, scrollMarginTop: 20 }}>
      <div style={{ maxWidth: 850, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4A5A2C' }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#E0E8B8',
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
          <h2
            data-onyu="section-title"
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 27,
              lineHeight: 1.3,
              color: '#2C2C2A',
              margin: 0,
              letterSpacing: 0,
            }}
          >
            {title}
          </h2>
        </div>
        <p style={{ color: '#5F5D55', lineHeight: 1.8, margin: '12px 0 0' }}>{body}</p>
      </div>
      {children}
    </section>
  );
}

function InfoCard({ children }: { children: ReactNode }) {
  return (
    <article
      className="onyu-card"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5DFD0',
        borderRadius: 18,
        padding: 18,
        transition: 'transform 180ms cubic-bezier(0.22,0.61,0.36,1), box-shadow 180ms',
      }}
    >
      {children}
    </article>
  );
}

function Badge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid #E5DFD0',
        borderRadius: 999,
        padding: '6px 12px',
        color: '#7A6F5A',
        fontFamily: FONT_EN,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0,
        background: '#F8F5ED',
      }}
    >
      {icon}
      {children}
    </span>
  );
}

function ScrollButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="onyu-button" onClick={onClick} style={secondaryButtonStyle}>
      {children}
    </button>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        color: '#B85C2E',
        fontFamily: FONT_EN,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            background: '#F8F5ED',
            border: '1px solid #E5DFD0',
            color: '#7A6F5A',
            borderRadius: 999,
            padding: '4px 9px',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function BarRows({ rows, max }: { rows: Array<{ label: string; count: number }>; max: number }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((row) => (
        <div key={row.label}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              color: '#4C4A43',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span>{row.label}</span>
            <span>{row.count}회</span>
          </div>
          <div
            style={{
              height: 9,
              background: '#F5F0E8',
              borderRadius: 999,
              overflow: 'hidden',
              marginTop: 5,
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                width: `${Math.max(8, Math.round((row.count / max) * 100))}%`,
                background: 'linear-gradient(90deg, #7A8B4E 0%, #D4DEA0 100%)',
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LevelBadge({ level }: { level: LinkLevel }) {
  const style = levelStyles[level];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '5px 9px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {level}
    </span>
  );
}

const cardTitleStyle = {
  fontFamily: FONT_SERIF,
  color: '#2C2C2A',
  fontSize: 18,
  lineHeight: 1.35,
  margin: '0 0 8px',
  letterSpacing: 0,
} as const;

const cardTextStyle = {
  color: '#5F5D55',
  fontSize: 13,
  lineHeight: 1.7,
  margin: '0 0 10px',
} as const;

const largeTextStyle = {
  color: '#4C4A43',
  fontSize: 15,
  lineHeight: 1.8,
  margin: 0,
} as const;

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: '1px solid #4A5A2C',
  background: '#4A5A2C',
  color: '#FFFFFF',
  borderRadius: 999,
  padding: '11px 15px',
  fontWeight: 800,
  cursor: 'pointer',
  transition: 'transform 160ms, box-shadow 180ms',
  marginTop: 14,
} as const;

const secondaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #E5DFD0',
  background: '#FFFFFF',
  color: '#4A5A2C',
  borderRadius: 999,
  padding: '11px 15px',
  fontWeight: 800,
  cursor: 'pointer',
  transition: 'transform 160ms, box-shadow 180ms',
} as const;

function gridStyle(columns: number) {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: 14,
  };
}

export default OnyuPreviewPage;
