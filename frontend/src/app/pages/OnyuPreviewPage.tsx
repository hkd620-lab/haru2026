import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, Home } from 'lucide-react';

/* =========================================================================
 * OnyuPreviewPage — 온유 preview (시박사 6탭 설계, 정적 체험용 UI)
 * - 외부 API / Functions 무관, 순수 정적 컴포넌트 (실제 저장·AI 호출 없음)
 * - 스토리 흐름: 단문 하나(②) → 20개로 쌓임(③) → 한 권의 책+통계(④)
 *                → 미래 흐름(⑤) → 비서 연결 정직한 안내(⑥)
 * - 스타일: 기존 preview 패턴(인라인 style + 인라인 <style>) + HARU 브랜드 컬러
 * - 탭⑥ 연결수준 구분은 기장본(ea3b5858) "정직한 안내" 섹션에서 흡수
 * ========================================================================= */

const NAVY = '#1A3C6E';
const OFFWHITE = '#FAF9F6';
const GREEN = '#10b981';
const EMO_GOOD = '#10b981';
const EMO_OK = '#EF9F27';
const EMO_BAD = '#E24B4A';
const BORDER = '#E5DFD0';
const FG = '#2C2C2A';
const FG2 = '#6B6458';

const FONT_KR = "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";

/* ---------------------------------------------------------------- 데이터 */

type MainTabKey = 'terms' | 'examples' | 'pileup' | 'mergeStats' | 'future' | 'assistants';

const MAIN_TABS: { key: MainTabKey; label: string }[] = [
  { key: 'terms', label: '① 쉬운 용어 풀이' },
  { key: 'examples', label: '② 예시문 체험' },
  { key: 'pileup', label: '③ 20개가 쌓이면' },
  { key: 'mergeStats', label: '④ 합본·통계' },
  { key: 'future', label: '⑤ 미래보기' },
  { key: 'assistants', label: '⑥ 비서 연결' },
];

// 탭 ① 용어 대응표
const TERMS: { term: string; desc: string }[] = [
  {
    term: '기록틀',
    desc: '막막하지 않게 미리 준비된 입력 양식. "오늘 먹은 것·찍은 사진·느낀 생각"을 따로 물어봐 줍니다.',
  },
  {
    term: '합본',
    desc: '여러 날의 기록을 한 문서로 묶어보는 기능. 흩어진 기록이 한 권의 책이 됩니다.',
  },
  {
    term: '통계',
    desc: '내가 얼마나, 어떤 주제로 기록했는지 숫자와 그래프로 보는 기능.',
  },
  {
    term: '비서',
    desc: '내 기록을 읽고 정리·분석·활용을 도와주는 기능.',
  },
  {
    term: 'SAYU(사유)',
    desc: '내 기록을 다시 읽고 의미를 찾아주는 사유 공간. 내용은 바꾸지 않고 표현만 다듬습니다.',
  },
  {
    term: '미래보기',
    desc: '지금까지의 기록을 바탕으로 앞으로의 변화 가능성을 살펴보는 기능.',
  },
];

// 탭 ② 예시문 4개 (STEP1 → SAYU 다듬음 → STEP2 → 이어짐 → STEP3)
type Example = {
  key: string;
  label: string;
  step1: string;
  step2: string;
  step3: { name: string; use: string }[];
};

const EXAMPLES: Example[] = [
  {
    key: 'daily',
    label: '하루기록',
    step1: '오늘 옥상에 올라가 호박꽃을 봤다. 수꽃은 많이 피었는데 암꽃은 몇 개 떨어졌다.',
    step2:
      '오늘 옥상 텃밭에서 호박꽃을 관찰했다. 수꽃은 많이 피었지만 암꽃은 노랗게 변하며 떨어지는 것이 보여 아쉬움이 있었다. 앞으로는 아침 시간에 꽃 상태를 확인하고, 필요하면 인공수분을 시도해 보기로 했다.',
    step3: [
      { name: '식물탐정', use: '호박 성장 상태와 병해충을 사진으로 확인' },
      { name: '성장타임라인', use: '사진과 날짜를 묶어 변화 과정 보기' },
      { name: 'SAYU', use: '식물을 돌보며 느낀 마음 정리' },
      { name: '통계', use: '이번 달 식물 기록 횟수 확인' },
      { name: '합본', use: '옥상텃밭 관찰기 문서로 묶기' },
      { name: '미래보기', use: '앞으로 열매 맺힐 가능성과 관리 방향' },
    ],
  },
  {
    key: 'health',
    label: '건강기록',
    step1: '저녁 먹고 20분 걸었다. 단 음료는 안 마셨다.',
    step2:
      '오늘 저녁 식사 후 20분 걷기를 실천했다. 식후 혈당 관리를 위해 단 음료를 마시지 않았고, 물로 대신했다. 작은 실천이지만 당화혈색소를 낮추기 위한 생활 습관 관리로 의미가 있다.',
    step3: [
      { name: '건강기록', use: '식사·운동·음료 습관 저장' },
      { name: '통계', use: '운동 횟수, 걷기 기록, 식후 관리 흐름' },
      { name: '합본', use: '한 달 건강관리 기록으로 묶기' },
      { name: 'SAYU', use: '건강을 지키려는 마음과 실천 이유 정리' },
      { name: '미래보기', use: '현재 습관이 계속될 때의 변화 가능성' },
    ],
  },
  {
    key: 'reading',
    label: '독서사유',
    step1: '오늘 책에서 부족함이 사람을 더 노력하게 만든다는 문장이 인상 깊었다.',
    step2:
      "오늘 읽은 책에서 '부족함이 사람을 더 노력하게 만든다'는 내용이 마음에 남았다. 완전함보다 부족함이 오히려 성장의 출발점이 될 수 있다는 생각을 하게 되었다. 내 삶에서도 부족함을 부끄러워하기보다, 다시 배우고 움직이게 하는 힘으로 받아들이고 싶다.",
    step3: [
      { name: '독서사유', use: '책에서 얻은 생각 저장' },
      { name: 'SAYU', use: '내 삶과 연결된 의미 정리' },
      { name: '합본', use: '독서노트 또는 사유문집으로 묶기' },
      { name: '통계', use: '한 달 독서 기록 횟수 확인' },
      { name: '미래보기', use: '반복되는 생각의 방향과 관심 주제' },
    ],
  },
  {
    key: 'timeline',
    label: '성장타임라인',
    step1: '호박이 자라는 사진을 며칠 동안 찍었다.',
    step2:
      '며칠 동안 옥상 텃밭의 호박 성장 과정을 사진으로 남겼다. 처음에는 꽃과 작은 씨방만 보였지만, 시간이 지나면서 잎과 줄기, 열매의 변화가 조금씩 드러났다. 사진을 날짜순으로 보면 식물이 자라는 과정이 하나의 이야기처럼 이어진다.',
    step3: [
      { name: '성장타임라인', use: '여러 장의 사진을 날짜순 이야기로 정리' },
      { name: '합본', use: '호박 성장기 문서로 묶기' },
      { name: 'PDF', use: '가족·지인에게 보여줄 문서로 저장' },
      { name: 'SAYU', use: '식물을 키우며 느낀 보람 정리' },
      { name: '통계', use: '식물 사진 기록 횟수 확인' },
      { name: '미래보기', use: '앞으로 어떤 관리가 필요한지' },
    ],
  },
];

// 탭 ③ / ④ 공용 — 20개 일기 [날짜, 요일, 본문, 감정]
type Emotion = 'good' | 'ok' | 'bad';
const DIARIES: [string, string, string, Emotion][] = [
  ['6/2', '월', '오늘 강변 산책을 했다. 아침 공기가 맑아 걷기에 좋았다.', 'good'],
  ['6/3', '화', '무릎이 좀 쑤셨지만 천천히 동네 한 바퀴를 돌았다.', 'ok'],
  ['6/4', '수', '손자 재민이가 영상통화를 걸어와 한참 웃었다.', 'good'],
  ['6/5', '목', '텃밭 상추가 제법 자랐다. 저녁 반찬으로 뜯어 먹었다.', 'good'],
  ['6/6', '금', '비가 와서 집에서 성경을 읽으며 하루를 보냈다.', 'ok'],
  ['6/9', '월', '새 한 주의 시작. 다시 걷기 운동을 시작했다.', 'good'],
  ['6/10', '화', '아내와 시장에 다녀왔다. 오랜만의 외출이 즐거웠다.', 'good'],
  ['6/11', '수', '허리가 결려 하루 종일 누워 쉬었다. 조금 답답했다.', 'bad'],
  ['6/12', '목', '몸이 한결 나아져 다시 산책을 나갔다.', 'ok'],
  ['6/13', '금', '교회 구역예배에서 오랜 벗들을 만나 반가웠다.', 'good'],
  ['6/16', '월', '텃밭 호박꽃이 피기 시작했다. 수꽃이 많다.', 'good'],
  ['6/17', '화', '단 음료를 끊고 물을 마시기로 마음먹었다.', 'ok'],
  ['6/18', '수', '저녁 먹고 20분 걸었다. 꾸준히 해보려 한다.', 'good'],
  ['6/19', '목', '딸이 김치를 가져다주러 왔다. 얼굴 보니 좋았다.', 'good'],
  ['6/20', '금', '무릎이 또 아팠다. 무리하지 않고 스트레칭만 했다.', 'bad'],
  ['6/23', '월', '호박 암꽃이 떨어져 인공수분을 시도해 보았다.', 'ok'],
  ['6/24', '화', '아침 기도 후 마음이 차분해졌다. 걷기도 빠짐없이.', 'good'],
  ['6/25', '수', '오랜 친구에게서 전화가 왔다. 추억을 나눴다.', 'good'],
  ['6/26', '목', '텃밭에서 고추 두 개를 처음 수확했다. 뿌듯했다.', 'good'],
  ['6/27', '금', '한 달을 돌아보니 꾸준히 기록한 내가 대견하다.', 'good'],
];

// 탭 ④ 통계
const STAT_CARDS: { label: string; value: number }[] = [
  { label: '이번 달 일기 편수', value: 20 },
  { label: '기록한 날', value: 20 },
  { label: '걷기 운동 언급', value: 14 },
  { label: '가족 만남·통화', value: 8 },
];
const WEEKLY: { label: string; value: number }[] = [
  { label: '1주차', value: 5 },
  { label: '2주차', value: 5 },
  { label: '3주차', value: 5 },
  { label: '4주차', value: 5 },
];
const TOPICS: { label: string; value: number }[] = [
  { label: '건강·운동', value: 14 },
  { label: '가족', value: 8 },
  { label: '텃밭·식물', value: 7 },
  { label: '신앙·기도', value: 5 },
];

// 탭 ⑤ 미래보기
const FUTURE_ITEMS: { cond: string; result: string }[] = [
  {
    cond: '운동 기록이 꾸준히 늘고 있다면',
    result: '앞으로 건강 관리가 더 안정될 가능성을 보여줍니다.',
  },
  {
    cond: '식물 기록에서 암꽃이 자주 떨어진다면',
    result: '물·햇빛·수분 상태를 더 살펴보자는 관리 방향을 제안할 수 있습니다.',
  },
  {
    cond: '독서사유에서 반복되는 단어가 있다면',
    result: '요즘 내가 어떤 주제에 관심을 두고 있는지 보여줍니다.',
  },
];

/* 탭 ⑥ 비서 연결 — 정직한 안내 (기장본 ea3b5858 흡수)
 * 연결 수준 4단계를 배지로 정직하게 구분. 과장 금지. */
type LinkLevel = '실제 연결' | '느슨한 연결' | '이동 안내' | '향후 연결 예정';

const LEVEL_STYLES: Record<LinkLevel, { bg: string; border: string; color: string }> = {
  '실제 연결': { bg: '#E5F4EC', border: '#B7E2CC', color: '#0B7A57' },
  '느슨한 연결': { bg: '#EAF0F9', border: '#CFE0F2', color: NAVY },
  '이동 안내': { bg: '#FCEFE4', border: '#F0D2B6', color: '#B85C2E' },
  '향후 연결 예정': { bg: '#F1EEE7', border: '#DED7C6', color: '#7A6F5A' },
};

const LEVEL_DESCRIPTIONS: Record<LinkLevel, string> = {
  '실제 연결': '기록을 들고 해당 비서로 바로 이어지는 연결입니다.',
  '느슨한 연결': '같은 기록 저장소나 정리 결과를 바탕으로 나중에 활용할 수 있는 연결입니다.',
  '이동 안내': '비서 페이지로 이동하지만 기록 데이터 자동 전달은 아직 없는 안내입니다.',
  '향후 연결 예정': '현재는 미리보기 안내만 가능하고, 앞으로 확장될 연결입니다.',
};

const ASSISTANT_CARDS: { name: string; records: string; help: string; level: LinkLevel }[] = [
  {
    name: 'SAYU 사유비서',
    records: '일상, 감정, 가족 대화, 독서 문장',
    help: '짧은 기록을 읽기 좋은 문장과 사유로 정리합니다. 내용은 바꾸지 않습니다.',
    level: '느슨한 연결',
  },
  {
    name: '건강관리 비서',
    records: '산책, 식사, 수면, 체중, 단 음료 절제',
    help: '생활습관 흐름을 참고자료로 정리합니다. 의료 판단은 하지 않습니다.',
    level: '느슨한 연결',
  },
  {
    name: '식물탐정',
    records: '텃밭 사진, 호박꽃 관찰, 식물 변화',
    help: '식물 상태 확인과 관리 방향 참고로 이어질 수 있습니다.',
    level: '이동 안내',
  },
  {
    name: '기록통계 비서',
    records: '기록 빈도, 반복 단어, 감정 흐름',
    help: '한 달 기록의 패턴을 숫자와 흐름으로 보여줍니다.',
    level: '느슨한 연결',
  },
  {
    name: '미래보기 비서',
    records: '반복 습관, 관심 주제, 생활 흐름',
    help: '미래를 맞히지 않고 앞으로 살펴볼 방향을 제안합니다.',
    level: '향후 연결 예정',
  },
  {
    name: '가족·추억 비서',
    records: '가족 대화, 여행 사진, 감사 기록',
    help: '가족과 추억을 나중에 다시 꺼내볼 자료로 정리합니다.',
    level: '향후 연결 예정',
  },
];

// 탭 ⑥ 하단 — 다른 기록틀
const FORMATS: { name: string; input: string; uses: string[] }[] = [
  { name: '반려동물 관찰', input: '코코 밥 반 공기. 좀 처져 보임.', uses: ['약사도우미', '통계', '합본'] },
  { name: '여행기록', input: '경주 갔다옴. 석굴암 좋았음.', uses: ['성장타임라인', 'PDF', '합본'] },
  { name: '메모', input: '노후 준비. 연금. 건강보험.', uses: ['AI 자동 제목', 'SAYU', '검색'] },
  { name: '업무일지', input: '오전 회의. 납기 협의함.', uses: ['통계', '합본', '월간 보고서'] },
];

/* ------------------------------------------------------------ 스타일 헬퍼 */

const emoColor = (e: Emotion) => (e === 'good' ? EMO_GOOD : e === 'ok' ? EMO_OK : EMO_BAD);
const emoLabel = (e: Emotion) => (e === 'good' ? '좋음' : e === 'ok' ? '보통' : '나쁨');

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  padding: '22px 24px',
  boxShadow: '0 14px 34px -30px rgba(26,60,110,0.45)',
};

const noteBoxStyle: React.CSSProperties = {
  background: '#F3F6FB',
  border: `1px solid #D7E1F0`,
  borderRadius: 14,
  padding: '16px 18px',
  color: NAVY,
  fontSize: 16,
  lineHeight: 1.7,
};

/* ------------------------------------------------------- 작은 렌더 헬퍼들 */

function DiaryRow({ row }: { row: [string, string, string, Emotion] }) {
  const [date, day, text, emo] = row;
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        padding: '14px 16px',
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ flex: '0 0 64px', fontWeight: 700, color: NAVY, fontSize: 16 }}>
        {date}
        <span style={{ color: FG2, fontWeight: 600, marginLeft: 4 }}>({day})</span>
      </div>
      <div style={{ flex: 1, fontSize: 17, lineHeight: 1.6, color: FG }}>{text}</div>
      <span
        style={{
          flex: '0 0 auto',
          alignSelf: 'center',
          background: emoColor(emo),
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          borderRadius: 999,
          padding: '3px 12px',
        }}
      >
        {emoLabel(emo)}
      </span>
    </div>
  );
}

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '0 0 90px', fontSize: 15, color: FG, fontWeight: 600 }}>{d.label}</div>
          <div
            style={{
              flex: 1,
              background: '#EEF1F5',
              borderRadius: 999,
              height: 22,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                height: '100%',
                background: color,
                borderRadius: 999,
              }}
            />
          </div>
          <div style={{ flex: '0 0 46px', textAlign: 'right', fontWeight: 700, color }}>
            {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function LevelBadge({ level }: { level: LinkLevel }) {
  const s = LEVEL_STYLES[level];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '4px 11px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {level}
    </span>
  );
}

/* 화살표 커넥터 (STEP 사이) */
function ArrowConnector({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '14px 0',
      }}
    >
      <ArrowDown size={22} color={GREEN} />
      <span style={{ fontSize: 14, color: GREEN, fontWeight: 700 }}>{text}</span>
    </div>
  );
}

/* ============================================================ 메인 컴포넌트 */

export function OnyuPreviewPage() {
  const navigate = useNavigate();
  const goBack = () => navigate(-1);
  const goHome = () => navigate('/');

  const [mainTab, setMainTab] = useState<MainTabKey>('terms');
  const [exampleTab, setExampleTab] = useState<string>(EXAMPLES[0].key);
  const [mergeStatsTab, setMergeStatsTab] = useState<'merge' | 'stats'>('merge');

  const activeExample = EXAMPLES.find((e) => e.key === exampleTab) ?? EXAMPLES[0];

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, ${OFFWHITE} 0%, #F1EFE9 100%)`,
        color: FG,
        fontFamily: FONT_KR,
        fontSize: 16,
        lineHeight: 1.7,
      }}
    >
      <style>{`
        .onyu-btn { transition: transform .15s ease, box-shadow .15s ease, background .15s ease; }
        .onyu-btn:hover { transform: translateY(-1px); }
        .onyu-btn:active { transform: scale(0.99); }
        .onyu-card:hover { transform: translateY(-2px); box-shadow: 0 18px 38px -28px rgba(26,60,110,0.4); }
        @media (max-width: 760px) {
          [data-onyu="page"] { padding: 18px 14px 110px !important; }
          [data-onyu="hero"] { padding: 24px 18px !important; }
          [data-onyu="hero-title"] { font-size: 26px !important; }
          [data-onyu="grid2"] { grid-template-columns: 1fr !important; }
          [data-onyu="grid4"] { grid-template-columns: 1fr 1fr !important; }
          [data-onyu="section-title"] { font-size: 22px !important; }
          [data-onyu="step3-grid"] { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div data-onyu="page" style={{ maxWidth: 920, margin: '0 auto', padding: '28px 24px 120px' }}>
        {/* 상단 바 (뒤로가기 / 홈) */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <button
            type="button"
            className="onyu-btn"
            onClick={goBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFFFFF',
              border: `1px solid ${BORDER}`,
              borderRadius: 999,
              padding: '9px 16px',
              fontSize: 15,
              fontWeight: 700,
              color: NAVY,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} /> 뒤로가기
          </button>
          <button
            type="button"
            className="onyu-btn"
            onClick={goHome}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFFFFF',
              border: `1px solid ${BORDER}`,
              borderRadius: 999,
              padding: '9px 16px',
              fontSize: 15,
              fontWeight: 700,
              color: NAVY,
              cursor: 'pointer',
            }}
          >
            <Home size={18} /> 홈
          </button>
        </div>

        {/* 히어로 */}
        <section
          data-onyu="hero"
          style={{
            background: '#FFFFFF',
            border: `1px solid ${BORDER}`,
            borderRadius: 22,
            padding: '34px 36px',
            marginBottom: 22,
            boxShadow: '0 16px 40px -34px rgba(26,60,110,0.5)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: GREEN, letterSpacing: 1 }}>
            HARU2026 미리보기
          </div>
          <h1
            data-onyu="hero-title"
            style={{ fontSize: 32, fontWeight: 900, color: NAVY, margin: '8px 0 10px' }}
          >
            짧게 적어도, 한 권의 책이 됩니다
          </h1>
          <p style={{ fontSize: 17, color: FG2, margin: 0 }}>
            단문 하나가 → 20개로 쌓이고 → 한 권의 책과 통계가 되고 → 앞으로의 흐름과 비서 연결까지
            보여줍니다.
          </p>
        </section>

        {/* 메인 탭 바 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
          {MAIN_TABS.map((t) => {
            const on = mainTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                className="onyu-btn"
                onClick={() => setMainTab(t.key)}
                style={{
                  background: on ? NAVY : '#FFFFFF',
                  color: on ? '#FFFFFF' : NAVY,
                  border: `1px solid ${on ? NAVY : BORDER}`,
                  borderRadius: 999,
                  padding: '10px 16px',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ---------------------------------------------- 탭 ① 쉬운 용어 풀이 */}
        {mainTab === 'terms' && (
          <section>
            <div style={{ ...noteBoxStyle, marginBottom: 18 }}>
              HARU2026은 그냥 일기장이 아닙니다. 조금만 적어도 나중에 꺼내 쓸 수 있는 내 자료가 됩니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TERMS.map((t) => (
                <div key={t.term} className="onyu-card" style={cardStyle}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: NAVY, marginBottom: 6 }}>
                    {t.term}
                  </div>
                  <div style={{ fontSize: 16, color: FG, lineHeight: 1.7 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---------------------------------------------- 탭 ② 예시문 체험 */}
        {mainTab === 'examples' && (
          <section>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {EXAMPLES.map((e) => {
                const on = exampleTab === e.key;
                return (
                  <button
                    key={e.key}
                    type="button"
                    className="onyu-btn"
                    onClick={() => setExampleTab(e.key)}
                    style={{
                      background: on ? GREEN : '#FFFFFF',
                      color: on ? '#FFFFFF' : FG,
                      border: `1px solid ${on ? GREEN : BORDER}`,
                      borderRadius: 999,
                      padding: '9px 16px',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>

            <div className="onyu-card" style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 800, color: FG2, marginBottom: 6 }}>
                STEP 1 · 짧게 쓴 것
              </div>
              <div style={{ fontSize: 18, color: FG, lineHeight: 1.7 }}>{activeExample.step1}</div>
            </div>

            <ArrowConnector text="SAYU가 표현을 다듬습니다 · 내용은 그대로" />

            <div className="onyu-card" style={{ ...cardStyle, borderColor: '#CFE6DB' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: GREEN, marginBottom: 6 }}>
                STEP 2 · HARU가 정리
              </div>
              <div style={{ fontSize: 18, color: FG, lineHeight: 1.8 }}>{activeExample.step2}</div>
            </div>

            <ArrowConnector text="이 기록이 이렇게 이어집니다" />

            <div className="onyu-card" style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 800, color: FG2, marginBottom: 12 }}>
                STEP 3 · 이어지는 활용
              </div>
              <div
                data-onyu="step3-grid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
              >
                {activeExample.step3.map((s) => (
                  <div
                    key={s.name}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      background: OFFWHITE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 12,
                      padding: '12px 14px',
                    }}
                  >
                    <span
                      style={{
                        flex: '0 0 auto',
                        background: NAVY,
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 8,
                        padding: '4px 10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.name}
                    </span>
                    <span style={{ fontSize: 15, color: FG, lineHeight: 1.6 }}>{s.use}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------------------------------------- 탭 ③ 20개가 쌓이면 */}
        {mainTab === 'pileup' && (
          <section>
            <div style={{ ...noteBoxStyle, marginBottom: 18 }}>
              매일 짧게 쓴 일기 한 줄이 4주 동안 20개 쌓였습니다. 이 20개가 어떻게 한 권의 책(합본)이
              되고, 어떤 흐름(통계)을 보여주는지 보세요.
            </div>
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              {DIARIES.map((row) => (
                <DiaryRow key={row[0]} row={row} />
              ))}
            </div>
            <div style={{ ...noteBoxStyle, marginTop: 18 }}>
              이렇게 흩어진 20개가 다음 탭에서 한 권의 책과 통계가 됩니다.
            </div>
          </section>
        )}

        {/* ---------------------------------------------- 탭 ④ 합본·통계 */}
        {mainTab === 'mergeStats' && (
          <section>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {(['merge', 'stats'] as const).map((k) => {
                const on = mergeStatsTab === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className="onyu-btn"
                    onClick={() => setMergeStatsTab(k)}
                    style={{
                      background: on ? NAVY : '#FFFFFF',
                      color: on ? '#FFFFFF' : NAVY,
                      border: `1px solid ${on ? NAVY : BORDER}`,
                      borderRadius: 999,
                      padding: '10px 22px',
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {k === 'merge' ? '합본' : '통계'}
                  </button>
                );
              })}
            </div>

            {/* 합본 */}
            {mergeStatsTab === 'merge' && (
              <div className="onyu-card" style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ background: NAVY, color: '#fff', padding: '30px 28px' }}>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>김복순의 6월 일기</div>
                  <div style={{ fontSize: 15, opacity: 0.85, marginTop: 8 }}>
                    2025.06.02 ~ 06.27 · 총 20편 · 작성일 20일
                  </div>
                </div>
                <div>
                  {DIARIES.map((row) => (
                    <DiaryRow key={row[0]} row={row} />
                  ))}
                </div>
                <div style={{ padding: '18px 20px' }}>
                  <div style={noteBoxStyle}>
                    흩어져 있던 20개의 짧은 기록이 한 권의 책으로 묶입니다. PDF로 저장해 가족과 나누거나,
                    연말에 1년치를 모아 '2025년 나의 일기'로 만들 수 있습니다.
                  </div>
                </div>
              </div>
            )}

            {/* 통계 */}
            {mergeStatsTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div
                  data-onyu="grid4"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
                >
                  {STAT_CARDS.map((c) => (
                    <div key={c.label} style={{ ...cardStyle, padding: '18px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: NAVY }}>{c.value}</div>
                      <div style={{ fontSize: 14, color: FG2, marginTop: 6 }}>{c.label}</div>
                    </div>
                  ))}
                </div>

                <div className="onyu-card" style={cardStyle}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 14 }}>
                    주차별 기록 편수
                  </div>
                  <BarChart data={WEEKLY} color={NAVY} />
                </div>

                <div className="onyu-card" style={cardStyle}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 4 }}>
                    자주 등장한 주제
                  </div>
                  <div style={{ fontSize: 13, color: FG2, marginBottom: 14 }}>AI 자동 분석</div>
                  <BarChart data={TOPICS} color={GREEN} />
                </div>

                <div className="onyu-card" style={cardStyle}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 14 }}>
                    하루 감정 흐름
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {DIARIES.map((row) => (
                      <div
                        key={row[0]}
                        title={`${row[0]} (${row[1]}) · ${emoLabel(row[3])}`}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: emoColor(row[3]) }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    {(['good', 'ok', 'bad'] as Emotion[]).map((e) => (
                      <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: emoColor(e),
                            display: 'inline-block',
                          }}
                        />
                        <span style={{ fontSize: 14, color: FG2 }}>{emoLabel(e)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={noteBoxStyle}>
                  숫자와 그래프로 보니 6월의 나가 한눈에 보입니다. 건강을 가장 많이 신경 썼고, 가족과
                  자주 교류했으며, 감정은 대체로 안정적이었습니다. 이 흐름이 다음 탭 미래보기의 재료가
                  됩니다.
                </div>
              </div>
            )}
          </section>
        )}

        {/* ---------------------------------------------- 탭 ⑤ 미래보기 */}
        {mainTab === 'future' && (
          <section>
            <div
              style={{
                background: '#FCF4E6',
                border: '1px solid #F0D9A8',
                borderRadius: 14,
                padding: '18px 20px',
                color: '#8A5A12',
                fontSize: 16,
                lineHeight: 1.7,
                marginBottom: 20,
                fontWeight: 600,
              }}
            >
              ⚠️ 미래보기는 미래를 맞히는 기능이 아닙니다. 지금까지의 기록을 바탕으로 내 생활·건강·관심사가
              앞으로 어떤 방향으로 이어질 수 있는지 살펴보는 기능입니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {FUTURE_ITEMS.map((f) => (
                <div key={f.cond} className="onyu-card" style={cardStyle}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>
                    {f.cond}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 16, color: FG }}>
                    <ArrowRight size={20} color={GREEN} style={{ flex: '0 0 auto', marginTop: 2 }} />
                    <span>{f.result}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---------------------------------------------- 탭 ⑥ 비서 연결 (정직한 안내) */}
        {mainTab === 'assistants' && (
          <section>
            <div style={{ ...noteBoxStyle, marginBottom: 8 }}>
              온유preview는 비서 연결을 과장하지 않습니다. 어떤 기록이 어떤 비서와 이어지는지, 그리고 그
              연결이 지금 실제로 작동하는지 / 앞으로 확장될 예정인지 배지로 솔직하게 구분해 보여줍니다.
            </div>

            {/* 연결 수준 범례 */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                margin: '14px 0 18px',
              }}
            >
              {(['실제 연결', '느슨한 연결', '이동 안내', '향후 연결 예정'] as LinkLevel[]).map((lv) => (
                <div
                  key={lv}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: FG2 }}
                >
                  <LevelBadge level={lv} />
                  <span>{LEVEL_DESCRIPTIONS[lv]}</span>
                </div>
              ))}
            </div>

            {/* 비서 카드 */}
            <div
              data-onyu="grid2"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
            >
              {ASSISTANT_CARDS.map((a) => (
                <div key={a.name} className="onyu-card" style={cardStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{a.name}</span>
                    <LevelBadge level={a.level} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 4 }}>
                    연결되는 기록
                  </div>
                  <div style={{ fontSize: 15, color: FG, marginBottom: 10, lineHeight: 1.6 }}>
                    {a.records}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 4 }}>
                    도와주는 일
                  </div>
                  <div style={{ fontSize: 15, color: FG, lineHeight: 1.6 }}>{a.help}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 20,
                background: '#F1EEE7',
                border: `1px solid ${BORDER}`,
                borderRadius: 14,
                padding: '16px 18px',
                fontSize: 15,
                color: FG2,
                lineHeight: 1.7,
              }}
            >
              현재 모든 비서가 모든 기록을 완전 자동으로 가져가는 것은 아닙니다. 일부는 기록을 참고하고,
              일부는 사용자가 선택해 이어서 사용하며, 일부 연결은 앞으로 확장될 예정입니다. 이 페이지는
              실제 저장·AI 호출 없는 비교용 정적 미리보기입니다.
            </div>

            {/* 다른 기록틀 (탭 ⑥ 하단 작은 섹션) */}
            <h2
              data-onyu="section-title"
              style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: '30px 0 14px' }}
            >
              이런 기록틀도 있습니다
            </h2>
            <div data-onyu="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {FORMATS.map((f) => (
                <div key={f.name} className="onyu-card" style={cardStyle}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 10 }}>
                    {f.name}
                  </div>
                  <div
                    style={{
                      background: OFFWHITE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 15,
                      color: FG,
                      marginBottom: 12,
                    }}
                  >
                    “{f.input}”
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {f.uses.map((u) => (
                      <span
                        key={u}
                        style={{
                          background: '#EAF6F0',
                          color: '#0B7A57',
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: 999,
                          padding: '4px 12px',
                        }}
                      >
                        {u}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default OnyuPreviewPage;
