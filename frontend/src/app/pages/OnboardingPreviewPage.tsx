import type { ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Home,
  PenLine,
  PlayCircle,
  Scale,
  Sparkles,
  Sprout,
  Video,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FONT_KR =
  "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";
const FONT_EN = "'Inter', system-ui, sans-serif";
const FONT_SERIF = "'MaruBuri', 'Pretendard', serif";

type Level = '실제 전달' | '느슨한 연결' | '이동 안내' | '향후 연결 예정';

type LinkRow = {
  recordType: string;
  assistant: string;
  level: Level;
  description: string;
};

type AssistantRow = {
  assistant: string;
  records: string;
  level: Level;
  description: string;
};

const summaryCards = [
  {
    title: '평범한 하루',
    body:
      '아침에는 건강을 기록하고, 오후에는 사진과 식물을 남기고, 밤에는 오늘 느낀 일을 적습니다. HARU2026은 이런 하루의 조각들을 건강비서, 식물탐정, SAYU 같은 비서와 이어 활용할 수 있도록 안내합니다.',
    button: '기록하러 가기',
    icon: <PenLine size={22} />,
    tone: 'green' as const,
    action: 'record' as const,
  },
  {
    title: '문제가 생긴 하루',
    body:
      '계약, 민원, 분쟁, 소송처럼 하루 중 갑자기 생긴 사건도 기록할 수 있습니다. HARU2026은 사건기록을 바탕으로 법률 관련 비서나 전자소송연습비서에서 절차, 준비물, 빠진 서류를 점검하는 방향으로 이어갈 수 있습니다.',
    button: '전자소송연습 보기',
    icon: <Scale size={22} />,
    tone: 'terracotta' as const,
    action: 'lawsuit' as const,
  },
  {
    title: '추억이 자산이 되는 하루',
    body:
      '가족사진, 여행사진, 식물 성장사진처럼 흩어진 사진도 하루의 일부입니다. HARU2026은 사용자가 사진을 선택해 성장타임라인이나 기록자산으로 묶고, 나중에 다시 꺼내볼 수 있는 문서로 정리하는 방향을 제안합니다.',
    button: 'HARU타임라인 보기',
    icon: <Camera size={22} />,
    tone: 'lilac' as const,
    action: 'timeline' as const,
  },
];

const recordRows: LinkRow[] = [
  {
    recordType: '일기/에세이',
    assistant: '미래전망',
    level: '실제 전달',
    description:
      '작성한 기록을 바탕으로 미래전망 비서에서 생각을 확장할 수 있습니다.',
  },
  {
    recordType: '독서 관련 기록',
    assistant: '나도작가',
    level: '느슨한 연결',
    description:
      '책과 생각의 재료를 바탕으로 글쓰기 자산으로 활용할 수 있습니다.',
  },
  {
    recordType: '사진 기록',
    assistant: 'HARU타임라인',
    level: '이동 안내',
    description:
      '사용자가 사진을 선택해 시간 흐름 문서로 정리할 수 있습니다.',
  },
  {
    recordType: '식물 사진/텃밭 기록',
    assistant: '식물탐정',
    level: '이동 안내',
    description:
      '식물 사진을 바탕으로 식물 판독과 관리 조언을 받을 수 있습니다. 단, 현재 텃밭일지 저장 후 바로 전달되는 구조는 아닙니다.',
  },
  {
    recordType: '사건 기록',
    assistant: '전자소송연습비서',
    level: '이동 안내',
    description:
      '사건 내용을 정리한 뒤 전자소송연습비서에서 절차와 준비물을 점검하는 방향으로 활용할 수 있습니다.',
  },
];

const assistantRows: AssistantRow[] = [
  {
    assistant: 'SAYU',
    records: '일상, 사진, 가족, 독서, 사건 관련 기록',
    level: '느슨한 연결',
    description: '기록을 다시 읽고 의미와 감정을 정리하는 사유 공간입니다.',
  },
  {
    assistant: '미래전망',
    records: '일기, 에세이 등',
    level: '실제 전달',
    description:
      'incomingRecord 방식으로 기록을 들고 들어가는 현재 확인된 실제 핸드오프입니다.',
  },
  {
    assistant: 'HARU타임라인',
    records: '사진, 성장 과정, 여행, 식물 변화',
    level: '이동 안내',
    description: '사용자가 직접 사진을 선택해 타임라인 문서로 구성합니다.',
  },
  {
    assistant: '식물탐정',
    records: '식물 사진, 텃밭 관련 기록',
    level: '이동 안내',
    description:
      '현재 SAYU에서 식물탐정으로 state를 보내는 활성 송신부는 확인하지 않았으므로 사용자가 식물 사진으로 직접 이어갑니다.',
  },
  {
    assistant: '전자소송연습비서',
    records: '사건, 증거, 서류, 기한 관련 기록',
    level: '이동 안내',
    description:
      '법률 판단 AI가 아니라 나홀로소송 가능한 범위의 절차와 준비물 체크리스트 비서로 안내합니다.',
  },
];

const shorts = [
  '건강기록은 어떻게 건강비서와 이어질까?',
  '사진 여러 장은 어떻게 HARU타임라인이 될까?',
  '사건기록은 전자소송연습비서에서 어떻게 활용할까?',
  '책 한 줄은 어떻게 독서사유가 될까?',
];

const levelStyles: Record<Level, { bg: string; color: string; border: string }> = {
  '실제 전달': { bg: '#E0E8B8', color: '#4A5A2C', border: '#D4DEA0' },
  '느슨한 연결': { bg: '#DDD0E8', color: '#5A4E7A', border: '#C9C0DE' },
  '이동 안내': { bg: '#F5E5DC', color: '#B85C2E', border: '#E8B894' },
  '향후 연결 예정': { bg: '#E5DFD0', color: '#7A6F5A', border: '#D4CDB9' },
};

const toneStyles = {
  green: { bg: '#F8FAEF', iconBg: '#E0E8B8', color: '#4A5A2C', border: '#D4DEA0' },
  lilac: { bg: '#F8F5FA', iconBg: '#DDD0E8', color: '#5A4E7A', border: '#C9C0DE' },
  terracotta: { bg: '#FFF8F4', iconBg: '#F5E5DC', color: '#B85C2E', border: '#E8B894' },
} as const;

export function OnboardingPreviewPage() {
  const navigate = useNavigate();

  const goRecord = () => navigate('/record', { state: { from: '/onboarding-preview' } });
  const goHome = () => navigate('/');
  const goTimeline = () => navigate('/v2', { state: { from: '/onboarding-preview' } });

  const scrollToDetail = () => {
    document.getElementById('onboarding-detail')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const runCardAction = (action: (typeof summaryCards)[number]['action']) => {
    if (action === 'record') {
      goRecord();
      return;
    }
    if (action === 'lawsuit') {
      navigate('/lawsuit-practice', { state: { from: '/onboarding-preview' } });
      return;
    }
    goTimeline();
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
        .onboarding-button:hover { transform: translateY(-1px); box-shadow: 0 12px 26px -20px rgba(74,90,44,0.45); }
        .onboarding-button:active { transform: scale(0.99); }
        .onboarding-card:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -26px rgba(74,90,44,0.38); }
        .onboarding-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .onboarding-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 760px; }
        .onboarding-table th { text-align: left; font-size: 11px; color: #7A6F5A; font-family: ${FONT_EN}; font-weight: 700; letter-spacing: 0; text-transform: uppercase; background: #F8F5ED; border-bottom: 1px solid #E5DFD0; padding: 12px 14px; }
        .onboarding-table td { vertical-align: top; border-bottom: 1px solid #EDE8DC; padding: 14px; color: #2C2C2A; }
        .onboarding-table tr:last-child td { border-bottom: 0; }
        @media (max-width: 760px) {
          [data-onboarding="page"] { padding: 18px 14px 96px !important; }
          [data-onboarding="hero"] { padding: 24px 18px !important; }
          [data-onboarding="hero-title"] { font-size: 27px !important; }
          [data-onboarding="hero-actions"] { flex-direction: column !important; align-items: stretch !important; }
          [data-onboarding="hero-actions"] button { justify-content: center !important; width: 100% !important; }
          [data-onboarding="summary-grid"] { grid-template-columns: 1fr !important; }
          [data-onboarding="shorts-grid"] { grid-template-columns: 1fr !important; }
          [data-onboarding="section-title"] { font-size: 22px !important; }
        }
      `}</style>

      <div
        data-onboarding="page"
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '34px 28px 132px',
        }}
      >
        <section
          data-onboarding="hero"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5DFD0',
            borderRadius: 24,
            padding: '42px 44px',
            boxShadow: '0 16px 40px -34px rgba(74,90,44,0.5)',
          }}
        >
          <div
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
              fontWeight: 700,
              letterSpacing: 0,
              textTransform: 'uppercase',
              background: '#F8F5ED',
            }}
          >
            <Sparkles size={14} />
            ONBOARDING PREVIEW
          </div>

          <h1
            data-onboarding="hero-title"
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 42,
              lineHeight: 1.18,
              fontWeight: 700,
              letterSpacing: 0,
              color: '#4A5A2C',
              margin: '22px 0 16px',
              maxWidth: 840,
            }}
          >
            HARU2026은 하루를 기록하고, 기록을 삶의 자산으로 바꿉니다
          </h1>

          <p
            style={{
              maxWidth: 850,
              margin: 0,
              color: '#5F5D55',
              fontSize: 15,
              lineHeight: 1.8,
            }}
          >
            일기는 한 사람의 하루입니다. 하루에는 건강, 가족, 돈, 사진, 식물,
            독서, 사건, 여행 같은 일이 함께 들어옵니다. HARU2026은 이 기록들을
            여러 비서와 이어 삶을 다시 이해하고 활용할 수 있게 돕습니다.
          </p>

          <div
            data-onboarding="hero-actions"
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}
          >
            <PrimaryButton onClick={goRecord}>
              <PenLine size={17} />
              오늘 기록 시작하기
            </PrimaryButton>
            <SecondaryButton onClick={scrollToDetail}>
              <ArrowDown size={17} />
              상세 활용법 보기
            </SecondaryButton>
          </div>
        </section>

        <section style={{ marginTop: 28 }}>
          <div
            data-onboarding="summary-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            {summaryCards.map((card) => {
              const tone = toneStyles[card.tone];
              return (
                <article
                  key={card.title}
                  className="onboarding-card"
                  style={{
                    background: tone.bg,
                    border: `1px solid ${tone.border}`,
                    borderRadius: 20,
                    padding: 22,
                    minHeight: 292,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 180ms cubic-bezier(0.22,0.61,0.36,1), box-shadow 180ms',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: tone.iconBg,
                      color: tone.color,
                    }}
                  >
                    {card.icon}
                  </div>
                  <h2
                    style={{
                      fontFamily: FONT_SERIF,
                      color: '#2C2C2A',
                      fontSize: 21,
                      fontWeight: 700,
                      margin: '16px 0 8px',
                      letterSpacing: 0,
                    }}
                  >
                    {card.title}
                  </h2>
                  <p style={{ color: '#5F5D55', margin: 0, fontSize: 13, lineHeight: 1.72 }}>
                    {card.body}
                  </p>
                  <button
                    type="button"
                    onClick={() => runCardAction(card.action)}
                    className="onboarding-button"
                    style={{
                      marginTop: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      border: '1px solid rgba(255,255,255,0.7)',
                      background: '#FFFFFF',
                      color: tone.color,
                      borderRadius: 999,
                      padding: '10px 13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'transform 160ms, box-shadow 180ms',
                    }}
                  >
                    <span>{card.button}</span>
                    <ArrowRight size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section id="onboarding-detail" style={{ marginTop: 34, scrollMarginTop: 20 }}>
          <SectionTitle
            icon={<ClipboardCheck size={20} />}
            title="기록형식과 비서는 이렇게 이어집니다"
            body="아래 표는 현재 코드 기준으로 확인된 연결 수준을 구분해 보여줍니다. 일부 기능은 실제 기록을 들고 비서로 이동하는 핸드오프가 아니라, 같은 기록 저장소를 바탕으로 나중에 활용하거나 해당 비서 페이지로 이동하는 구조입니다."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
              margin: '16px 0',
            }}
          >
            {(['실제 전달', '느슨한 연결', '이동 안내', '향후 연결 예정'] as Level[]).map(
              (level) => (
                <LevelGuide key={level} level={level} />
              ),
            )}
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5DFD0',
              borderRadius: 20,
              padding: 20,
              marginTop: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: '#E0E8B8',
                  color: '#4A5A2C',
                }}
              >
                <CheckCircle2 size={18} />
              </span>
              <p style={{ margin: 0, color: '#4C4A43', lineHeight: 1.75 }}>
                현재 HARU2026에서 모든 기록이 모든 비서로 자동 전달되는 것은
                아닙니다. 일부는 실제 기록 전달이 작동하고, 일부는 같은 기록
                저장소를 바탕으로 활용되며, 일부는 비서 페이지로 이동해 사용자가
                직접 이어가는 구조입니다. HARU2026은 이 연결을 단계적으로
                고도화하고 있습니다.
              </p>
            </div>
          </div>

          <TableSection
            title="기록형식에서 비서로 이어지는 예시"
            icon={<FileText size={18} />}
          >
            <table className="onboarding-table">
              <thead>
                <tr>
                  <th>기록형식</th>
                  <th>이어지는 비서</th>
                  <th>현재 연결 수준</th>
                  <th>사용자에게 보여줄 설명</th>
                </tr>
              </thead>
              <tbody>
                {recordRows.map((row) => (
                  <tr key={`${row.recordType}-${row.assistant}`}>
                    <td style={{ fontWeight: 700 }}>{row.recordType}</td>
                    <td>{row.assistant}</td>
                    <td>
                      <LevelBadge level={row.level} />
                    </td>
                    <td>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableSection>

          <TableSection title="비서에서 활용 가능한 기록 예시" icon={<BookOpen size={18} />}>
            <table className="onboarding-table">
              <thead>
                <tr>
                  <th>비서</th>
                  <th>활용 가능한 기록</th>
                  <th>현재 연결 수준</th>
                  <th>설명</th>
                </tr>
              </thead>
              <tbody>
                {assistantRows.map((row) => (
                  <tr key={`${row.assistant}-${row.records}`}>
                    <td style={{ fontWeight: 700 }}>{row.assistant}</td>
                    <td>{row.records}</td>
                    <td>
                      <LevelBadge level={row.level} />
                    </td>
                    <td>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableSection>
        </section>

        <section style={{ marginTop: 34 }}>
          <SectionTitle
            icon={<Video size={20} />}
            title="짧은 영상으로 보는 HARU2026 사용 예시"
            body="현재는 영상 링크 없이 검토용 카드만 준비했습니다."
          />
          <div
            data-onboarding="shorts-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
              marginTop: 16,
            }}
          >
            {shorts.map((title) => (
              <article
                key={title}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5DFD0',
                  borderRadius: 18,
                  padding: 18,
                  minHeight: 144,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <PlayCircle size={24} color="#B85C2E" />
                <div>
                  <h3
                    style={{
                      margin: '14px 0 10px',
                      color: '#2C2C2A',
                      fontSize: 14,
                      lineHeight: 1.45,
                    }}
                  >
                    {title}
                  </h3>
                  <span
                    style={{
                      display: 'inline-flex',
                      borderRadius: 999,
                      padding: '4px 9px',
                      background: '#F5E5DC',
                      color: '#B85C2E',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    준비 중
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 34,
            background: '#4A5A2C',
            color: '#FFFFFF',
            borderRadius: 24,
            padding: '28px 26px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ maxWidth: 620 }}>
            <h2
              style={{
                fontFamily: FONT_SERIF,
                fontSize: 25,
                lineHeight: 1.35,
                margin: 0,
                letterSpacing: 0,
              }}
            >
              오늘 하루 하나만 기록해도 충분합니다.
            </h2>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.78)' }}>
              HARU2026은 그 기록을 다시 꺼내 보고, 묶고, 해석하고, 필요한 순간
              활용할 수 있도록 도와갑니다.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={goRecord}
              className="onboarding-button"
              style={ctaButtonStyle}
            >
              <PenLine size={17} />
              기록 시작하기
            </button>
            <button
              type="button"
              onClick={goHome}
              className="onboarding-button"
              style={{ ...ctaButtonStyle, color: '#4A5A2C' }}
            >
              <Home size={17} />
              홈으로 돌아가기
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="onboarding-button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        border: '1px solid #4A5A2C',
        background: '#4A5A2C',
        color: '#FFFFFF',
        borderRadius: 999,
        padding: '12px 17px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'transform 160ms, box-shadow 180ms',
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="onboarding-button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        border: '1px solid #E5DFD0',
        background: '#FFFFFF',
        color: '#4A5A2C',
        borderRadius: 999,
        padding: '12px 17px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'transform 160ms, box-shadow 180ms',
      }}
    >
      {children}
    </button>
  );
}

function SectionTitle({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div style={{ maxWidth: 820 }}>
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
          }}
        >
          {icon}
        </span>
        <h2
          data-onboarding="section-title"
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 26,
            lineHeight: 1.3,
            margin: 0,
            color: '#2C2C2A',
            letterSpacing: 0,
          }}
        >
          {title}
        </h2>
      </div>
      <p style={{ margin: '12px 0 0', color: '#5F5D55', lineHeight: 1.8 }}>
        {body}
      </p>
    </div>
  );
}

function LevelGuide({ level }: { level: Level }) {
  const descriptions: Record<Level, string> = {
    '실제 전달': '기록을 들고 비서로 들어감',
    '느슨한 연결': '같은 records 저장소를 바탕으로 나중에 활용',
    '이동 안내': '비서 페이지로 이동하지만 기록 데이터 전달은 없음',
    '향후 연결 예정': '현재는 안내만 가능',
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5DFD0',
        borderRadius: 16,
        padding: 14,
      }}
    >
      <LevelBadge level={level} />
      <p style={{ margin: '9px 0 0', color: '#5F5D55', fontSize: 12, lineHeight: 1.55 }}>
        {descriptions[level]}
      </p>
    </div>
  );
}

function LevelBadge({ level }: { level: Level }) {
  const style = levelStyles[level];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '5px 9px',
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {level}
    </span>
  );
}

function TableSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <details
      open
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5DFD0',
        borderRadius: 20,
        marginTop: 16,
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '16px 18px',
          cursor: 'pointer',
          color: '#4A5A2C',
          fontWeight: 800,
          listStyle: 'none',
        }}
      >
        {icon}
        {title}
      </summary>
      <div className="onboarding-table-wrap">{children}</div>
    </details>
  );
}

const ctaButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  border: '1px solid rgba(255,255,255,0.82)',
  background: '#FFFFFF',
  color: '#4A5A2C',
  borderRadius: 999,
  padding: '11px 15px',
  fontWeight: 800,
  cursor: 'pointer',
  transition: 'transform 160ms, box-shadow 180ms',
} as const;

export default OnboardingPreviewPage;
