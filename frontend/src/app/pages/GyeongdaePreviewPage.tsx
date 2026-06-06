import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  FileText,
  HeartPulse,
  Layers3,
  Leaf,
  LineChart,
  Map,
  PenLine,
  Sparkles,
} from 'lucide-react';

const FONT_KR =
  "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";
const FONT_EN = "'Inter', system-ui, sans-serif";
const FONT_SERIF = "'MaruBuri', 'Pretendard', serif";

type TabId = 'daily' | 'health' | 'garden' | 'travel' | 'reading';
type LinkLevel = '실제 전달' | '느슨한 연결' | '이동 안내' | '향후 연결 예정';

type PreviewTab = {
  id: TabId;
  label: string;
  icon: ReactNode;
  short: string;
  refined: string;
  useCases: string[];
  merge: string;
  stats: string[];
  future: string;
  assistants: string[];
};

type DiaryExample = {
  week: string;
  day: string;
  short: string;
  refined: string;
  tags: string[];
  mood: string;
};

const glossary = [
  {
    title: '기록형식',
    body: '글을 쉽게 쓰게 해주는 입력틀입니다.',
  },
  {
    title: 'SAYU',
    body: '짧게 쓴 기록을 읽기 좋은 문장으로 다듬고, 그 안의 의미를 찾아주는 사유 공간입니다.',
  },
  {
    title: '합본',
    body: '여러 날의 기록을 하나의 문서처럼 묶어보는 기능입니다.',
  },
  {
    title: '통계',
    body: '내가 얼마나, 어떤 주제로 기록했는지 숫자와 흐름으로 보는 기능입니다.',
  },
  {
    title: '미래보기',
    body: '미래를 맞히는 기능이 아니라, 지금까지의 기록을 바탕으로 앞으로의 생활 흐름과 관리 방향을 살펴보는 기능입니다.',
  },
];

const flowSteps = [
  '짧게 기록',
  'SAYU가 문장 정리',
  '기록이 쌓임',
  '합본으로 문서화',
  '통계로 흐름 확인',
  '미래보기로 방향 살피기',
  '필요한 비서가 다시 활용',
];

const previewTabs: PreviewTab[] = [
  {
    id: 'daily',
    label: '하루기록',
    icon: <PenLine size={18} />,
    short: '오늘은 별일 없었다. 그래도 저녁에 아내와 산책했다.',
    refined:
      '오늘은 특별한 사건은 없었지만, 저녁에 아내와 함께 산책하며 하루를 차분히 마무리했다. 별일 없는 하루도 함께 걷고 대화한 시간이 남으면 의미 있는 기록이 된다.',
    useCases: [
      'SAYU 사유정리',
      '월간 하루기록 합본',
      '감정 흐름 통계',
      '생활 리듬 미래보기',
      '가족·추억 비서 연결',
    ],
    merge:
      '6월의 하루기록을 모아 ‘나의 6월 생활기록’ 문서로 묶어볼 수 있습니다.',
    stats: [
      '이번 달 기록한 날: 18일',
      '자주 나온 단어: 산책, 가족, 피곤함, 감사',
      '감정 흐름: 평온 45%, 피곤 30%, 감사 25%',
    ],
    future:
      '최근 기록에서 산책과 가족 시간이 반복됩니다. 앞으로도 저녁 산책을 유지하면 생활 리듬과 정서 안정에 도움이 되는 방향으로 이어질 수 있습니다.',
    assistants: [
      'SAYU 사유비서: 일상의 의미를 정리',
      '생활통계 비서: 기록 빈도와 감정 흐름 확인',
      '가족·추억 비서: 가족과의 시간을 추억 자료로 정리',
      '미래보기 비서: 반복되는 생활 흐름 살피기',
    ],
  },
  {
    id: 'health',
    label: '건강기록',
    icon: <HeartPulse size={18} />,
    short: '저녁 먹고 20분 걸었다. 단 음료는 안 마셨다.',
    refined:
      '저녁 식사 후 20분 걷기를 실천했다. 식후 혈당 관리를 위해 단 음료를 피하고 물로 대신했다. 작은 실천이지만 건강 습관을 지키기 위한 의미 있는 하루였다.',
    useCases: [
      '건강기록',
      '운동 통계',
      '한 달 건강관리 합본',
      '생활습관 미래보기',
      '건강관리 비서 연결',
    ],
    merge:
      '한 달 동안의 식사, 걷기, 음료 습관을 모아 ‘6월 건강관리 기록’으로 묶어볼 수 있습니다.',
    stats: ['식후 걷기 실천: 14회', '단 음료 피한 날: 20일', '운동 기록이 있는 날: 16일'],
    future:
      '최근 기록에서 식후 걷기와 단 음료 줄이기가 반복됩니다. 이 흐름이 유지되면 건강 관리 습관이 더 안정될 가능성이 있습니다. 단, 의료 판단이나 진단은 병원과 전문가 상담이 필요합니다.',
    assistants: [
      '건강관리 비서: 식사·걷기·수면·음료 습관 참고자료 정리',
      '생활통계 비서: 실천 횟수와 반복 습관 확인',
      '미래보기 비서: 생활습관 흐름 살피기',
      'SAYU 사유비서: 건강을 지키려는 마음 정리',
    ],
  },
  {
    id: 'garden',
    label: '텃밭·식물기록',
    icon: <Leaf size={18} />,
    short: '호박 암꽃이 노랗게 변해서 떨어졌다.',
    refined:
      '옥상 텃밭의 호박 암꽃 일부가 노랗게 변하며 떨어지는 모습을 관찰했다. 수분, 햇빛, 영양, 인공수분 상태를 다시 살펴볼 필요가 있다. 앞으로 며칠간 꽃과 줄기 상태를 계속 기록하기로 했다.',
    useCases: [
      '식물탐정',
      '성장타임라인',
      '텃밭 관찰기 합본',
      '식물기록 통계',
      '관리 방향 미래보기',
    ],
    merge:
      '며칠 동안 찍은 사진과 관찰 내용을 모아 ‘호박 성장 관찰기’로 묶어볼 수 있습니다.',
    stats: ['식물 기록 횟수: 12회', '사진 기록: 8회', '자주 기록한 식물: 호박, 옥수수, 고추'],
    future:
      '호박 암꽃이 반복해서 떨어진다면 물, 햇빛, 영양, 수분 상태를 계속 확인하는 방향을 제안할 수 있습니다. 미래보기는 결과를 단정하지 않고, 기록을 바탕으로 관리 방향을 살펴보는 기능입니다.',
    assistants: [
      '식물탐정: 식물 상태 확인과 관리 참고',
      '성장타임라인 비서: 사진과 날짜를 묶어 변화 과정 문서화',
      '생활통계 비서: 식물 기록 빈도 확인',
      '미래보기 비서: 관리 방향 살피기',
    ],
  },
  {
    id: 'travel',
    label: '여행·사진기록',
    icon: <Map size={18} />,
    short: '강화도에 다녀왔다. 사진을 많이 찍었다.',
    refined:
      '강화도 여행에서 찍은 사진과 짧은 메모를 남겼다. 장소의 분위기, 함께한 사람, 기억에 남은 장면을 기록해두면 나중에 여행기나 가족 추억 문서로 다시 꺼내볼 수 있다.',
    useCases: [
      '사진기록',
      '성장타임라인',
      '여행 합본',
      'PDF 저장',
      '추억자산 보기',
      '가족·추억 비서 연결',
    ],
    merge:
      '여러 장소의 사진과 메모를 모아 ‘강화도 하루 여행기’처럼 정리할 수 있습니다.',
    stats: ['여행 기록: 4회', '사진 포함 기록: 23장', '자주 나온 장소: 강화도, 안양천, 설악산'],
    future:
      '기록을 보면 내가 자주 찾는 장소, 좋아하는 여행 방식, 가족과 함께한 시간이 드러납니다. 앞으로 어떤 여행을 더 소중하게 여길지 살펴볼 수 있습니다.',
    assistants: [
      '성장타임라인 비서: 사진과 날짜를 이야기로 정리',
      '가족·추억 비서: 가족 여행과 추억 정리',
      '생활통계 비서: 자주 찾은 장소와 사진 기록 확인',
      '미래보기 비서: 앞으로 소중히 여길 여행 방식 살피기',
    ],
  },
  {
    id: 'reading',
    label: '독서사유',
    icon: <BookOpen size={18} />,
    short: '부족함이 사람을 더 노력하게 만든다는 말이 좋았다.',
    refined:
      '오늘 읽은 문장 중 ‘부족함이 사람을 더 노력하게 만든다’는 생각이 마음에 남았다. 부족함은 부끄러운 것이 아니라 다시 배우고 움직이게 하는 출발점이 될 수 있다.',
    useCases: ['독서사유', 'SAYU', '사유문집 합본', '관심 주제 통계', '생각의 방향 미래보기'],
    merge:
      '여러 날의 독서사유를 모아 ‘나의 독서노트’ 또는 ‘사유문집’처럼 묶어볼 수 있습니다.',
    stats: ['독서 기록: 9회', '자주 나온 주제: 부족함, 성장, 기도, 노력', '인상 깊은 문장 기록: 7개'],
    future:
      '반복해서 남긴 문장과 생각을 보면 내가 요즘 어떤 주제에 마음을 두고 있는지 알 수 있습니다. 미래보기는 그 관심이 앞으로 어떤 배움과 실천으로 이어질 수 있는지 살펴보는 기능입니다.',
    assistants: [
      '독서사유 비서: 책 문장을 삶의 생각으로 확장',
      'SAYU 사유비서: 내 삶과 연결된 의미 정리',
      '생활통계 비서: 반복되는 관심 주제 확인',
      '미래보기 비서: 생각의 방향 살피기',
    ],
  },
];

const fourWeekDiaryExamples: DiaryExample[] = [
  {
    week: '1주차',
    day: '월',
    short: '아침에 몸이 무거웠지만 계단을 올랐다.',
    refined:
      '아침에 몸이 무거웠지만 계단 오르기를 실천했다. 컨디션이 완벽하지 않아도 움직이려는 태도가 하루의 시작을 바꾸었다.',
    tags: ['운동', '피곤함', '실천'],
    mood: '피곤하지만 뿌듯함',
  },
  {
    week: '1주차',
    day: '화',
    short: '아내와 저녁 산책을 했다.',
    refined:
      '저녁에 아내와 함께 산책하며 하루를 차분히 마무리했다. 특별한 일은 없었지만 함께 걷는 시간이 안정감을 주었다.',
    tags: ['가족', '산책', '평온'],
    mood: '평온',
  },
  {
    week: '1주차',
    day: '수',
    short: '단 음료를 마시고 싶었지만 참았다.',
    refined:
      '단 음료가 생각났지만 마시지 않고 물로 대신했다. 건강을 위해 작은 선택을 지킨 하루였다.',
    tags: ['건강', '절제', '습관'],
    mood: '절제',
  },
  {
    week: '1주차',
    day: '목',
    short: '옥상에 올라가 호박꽃을 봤다.',
    refined:
      '옥상 텃밭에서 호박꽃을 관찰했다. 식물이 자라는 모습을 보며 작은 생명의 변화가 주는 기쁨을 느꼈다.',
    tags: ['텃밭', '관찰', '기쁨'],
    mood: '기쁨',
  },
  {
    week: '1주차',
    day: '금',
    short: '영어 공부를 10분 했다.',
    refined:
      '영어 공부를 10분 동안 실천했다. 짧은 시간이지만 포기하지 않고 이어간다는 점에서 의미가 있었다.',
    tags: ['공부', '영어', '꾸준함'],
    mood: '뿌듯함',
  },
  {
    week: '2주차',
    day: '월',
    short: '비가 와서 산책은 못 했지만 스트레칭을 했다.',
    refined:
      '비가 와서 밖에 나가지는 못했지만 집에서 스트레칭을 했다. 상황에 맞게 대체 실천을 한 하루였다.',
    tags: ['운동', '대체실천', '유연함'],
    mood: '차분함',
  },
  {
    week: '2주차',
    day: '화',
    short: '오랜만에 딸과 통화했다.',
    refined:
      '오랜만에 딸과 통화하며 안부를 나누었다. 짧은 대화였지만 가족과 연결되어 있다는 느낌을 받았다.',
    tags: ['가족', '대화', '감사'],
    mood: '감사',
  },
  {
    week: '2주차',
    day: '수',
    short: '점심을 조금 많이 먹었다.',
    refined:
      '점심을 평소보다 많이 먹었다. 다음 식사에서는 양을 조절해야겠다는 생각을 했다.',
    tags: ['식사', '건강', '조절'],
    mood: '반성',
  },
  {
    week: '2주차',
    day: '목',
    short: '책에서 부족함에 대한 문장이 마음에 남았다.',
    refined:
      '책에서 부족함이 사람을 더 노력하게 만든다는 문장이 마음에 남았다. 부족함을 부끄러움이 아니라 성장의 출발점으로 바라보게 되었다.',
    tags: ['독서', '성장', '사유'],
    mood: '깨달음',
  },
  {
    week: '2주차',
    day: '금',
    short: '별일 없는 하루였지만 마음은 편했다.',
    refined:
      '특별한 사건은 없었지만 마음이 편안한 하루였다. 큰 성취가 없어도 안정된 하루 자체가 소중한 기록이 될 수 있다.',
    tags: ['평온', '일상', '감사'],
    mood: '평온',
  },
  {
    week: '3주차',
    day: '월',
    short: '아침 체중을 기록했다.',
    refined:
      '아침 체중을 기록하며 건강 관리 흐름을 확인했다. 숫자 하나도 꾸준히 남기면 생활 습관을 돌아보는 자료가 된다.',
    tags: ['건강', '체중', '기록'],
    mood: '점검',
  },
  {
    week: '3주차',
    day: '화',
    short: '호박 암꽃이 또 떨어져서 아쉬웠다.',
    refined:
      '호박 암꽃이 다시 떨어지는 모습을 보고 아쉬움을 느꼈다. 물, 햇빛, 영양, 인공수분 상태를 더 살펴보기로 했다.',
    tags: ['텃밭', '호박', '아쉬움'],
    mood: '아쉬움',
  },
  {
    week: '3주차',
    day: '수',
    short: '아내가 챙겨준 음식이 고마웠다.',
    refined:
      '아내가 챙겨준 음식을 먹으며 고마움을 느꼈다. 일상의 돌봄은 익숙해지기 쉽지만 기록해두면 감사의 마음이 선명해진다.',
    tags: ['가족', '감사', '식사'],
    mood: '감사',
  },
  {
    week: '3주차',
    day: '목',
    short: '유튜브를 오래 봐서 조금 후회했다.',
    refined:
      '유튜브를 예상보다 오래 보며 시간을 보냈다. 휴식도 필요하지만 내일은 시간을 조금 더 의식해서 사용하기로 했다.',
    tags: ['생활습관', '반성', '시간관리'],
    mood: '반성',
  },
  {
    week: '3주차',
    day: '금',
    short: '스쿼트를 100개 했다.',
    refined:
      '스쿼트 100개를 실천했다. 꾸준히 몸을 움직이는 습관이 건강을 지키는 중요한 기반이 되고 있다.',
    tags: ['운동', '스쿼트', '꾸준함'],
    mood: '뿌듯함',
  },
  {
    week: '4주차',
    day: '월',
    short: '새벽에 잠이 깼지만 다시 잠들었다.',
    refined:
      '새벽에 잠이 깼지만 마음을 가라앉히고 다시 잠들었다. 수면 흐름을 기록해두면 내 몸의 리듬을 이해하는 데 도움이 된다.',
    tags: ['수면', '건강', '회복'],
    mood: '회복',
  },
  {
    week: '4주차',
    day: '화',
    short: '오랜만에 여행 사진을 정리했다.',
    refined:
      '오랜만에 여행 사진을 정리하며 지난 시간을 떠올렸다. 사진은 단순한 이미지가 아니라 기억을 다시 불러오는 기록 자산이 된다.',
    tags: ['사진', '추억', '정리'],
    mood: '그리움',
  },
  {
    week: '4주차',
    day: '수',
    short: '오늘은 기도가 더 필요하다고 느꼈다.',
    refined:
      '오늘은 마음을 다잡기 위해 기도가 더 필요하다고 느꼈다. 부족함을 느끼는 순간이 오히려 다시 의지하고 회복하는 출발점이 될 수 있다.',
    tags: ['신앙', '기도', '회복'],
    mood: '진지함',
  },
  {
    week: '4주차',
    day: '목',
    short: '저녁에 가족 이야기를 오래 했다.',
    refined:
      '저녁에 가족 이야기를 오래 나누었다. 함께 살아온 시간과 앞으로의 계획을 이야기하며 가족의 의미를 다시 느꼈다.',
    tags: ['가족', '대화', '의미'],
    mood: '따뜻함',
  },
  {
    week: '4주차',
    day: '금',
    short: '이번 달 기록을 보니 내가 꽤 노력했다.',
    refined:
      '이번 달 기록을 돌아보니 운동, 건강관리, 가족과의 시간, 공부를 꾸준히 이어온 흔적이 보였다. 완벽하지는 않았지만 계속하려는 태도 자체가 소중한 성과였다.',
    tags: ['회고', '성장', '꾸준함'],
    mood: '뿌듯함',
  },
];

const weekSummaries = [
  '1주차: 운동, 산책, 건강 절제, 텃밭, 영어 공부가 시작됨',
  '2주차: 가족 대화, 식사 조절, 독서사유, 평온한 일상이 쌓임',
  '3주차: 건강 점검, 텃밭 아쉬움, 감사, 시간관리, 운동 실천이 나타남',
  '4주차: 수면, 사진정리, 기도, 가족 대화, 월간 회고로 마무리됨',
];

const monthlyMerge = [
  '6월 한 달 동안의 기록을 돌아보면, 운동과 건강관리, 가족과의 시간, 텃밭 관찰, 공부와 사유가 반복해서 나타났다.',
  '처음에는 몸이 무겁거나 단 음료를 참는 작은 실천에서 시작되었지만, 시간이 지나면서 산책, 스쿼트, 식후 걷기, 체중 기록처럼 건강을 지키려는 흐름이 이어졌다.',
  '가족과의 시간도 중요한 축이었다. 아내와의 산책, 딸과의 통화, 가족 이야기를 나눈 저녁은 평범한 일상이지만 기록으로 남기면 삶을 지탱하는 따뜻한 장면이 된다.',
  '텃밭 기록에서는 호박꽃과 암꽃이 반복해서 등장했다. 기쁨과 아쉬움이 함께 있었고, 물·햇빛·영양·인공수분 상태를 더 살펴보려는 관리 방향도 생겼다.',
  '독서와 기도, 영어 공부 기록에서는 부족함을 성장의 출발점으로 받아들이려는 태도가 보였다. 완벽하지 않아도 계속 배우고 움직이려는 흐름이 한 달 전체에 담겨 있다.',
  '이 한 달은 대단한 사건보다 작은 실천이 모여 만들어진 시간이었다. HARU2026은 이런 평범한 기록들을 모아 나의 생활문서, 건강관리 자료, 가족의 추억, 사유의 자산으로 다시 꺼내볼 수 있게 한다.',
];

const topicStats = [
  { label: '건강', count: 6 },
  { label: '가족', count: 5 },
  { label: '운동', count: 4 },
  { label: '텃밭·식물', count: 3 },
  { label: '공부·독서', count: 3 },
  { label: '신앙·사유', count: 2 },
  { label: '사진·추억', count: 1 },
  { label: '생활습관 반성', count: 2 },
];

const moodStats = [
  { label: '평온', count: 2 },
  { label: '감사', count: 2 },
  { label: '뿌듯함', count: 3 },
  { label: '반성', count: 2 },
  { label: '기쁨', count: 1 },
  { label: '아쉬움', count: 1 },
  { label: '회복', count: 2 },
  { label: '깨달음', count: 1 },
  { label: '따뜻함', count: 1 },
  { label: '진지함', count: 1 },
  { label: '점검', count: 1 },
  { label: '절제', count: 1 },
  { label: '차분함', count: 1 },
  { label: '그리움', count: 1 },
];

const repeatWords = ['산책', '가족', '건강', '기록', '텃밭', '호박', '운동', '감사', '부족함', '꾸준함'];

const futureCards = [
  {
    title: '1개월 보기',
    body:
      '이번 달에는 건강관리, 가족 대화, 텃밭 관찰이 반복되었습니다. 다음 달에도 식후 걷기와 기록 습관을 이어가면 생활 리듬을 더 안정적으로 볼 수 있습니다.',
  },
  {
    title: '1년 보기',
    body:
      '운동, 식사 조절, 가족과의 대화가 계속 기록되면 1년 뒤에는 나의 건강관리 흐름과 가족 시간의 변화가 더 선명해집니다.',
  },
  {
    title: '5년 보기',
    body:
      '텃밭, 독서, 신앙, 공부 기록이 쌓이면 내가 어떤 배움과 보람을 꾸준히 붙잡고 살아왔는지 볼 수 있습니다.',
  },
  {
    title: '100세 보기',
    body:
      '오래 남긴 기록은 단순한 일기가 아니라 가족에게 남길 수 있는 삶의 이야기, 나의 습관 변화, 감사와 사유의 자산이 됩니다.',
  },
];

const assistantMap: Array<{
  name: string;
  records: string;
  help: string;
  level: LinkLevel;
}> = [
  {
    name: 'SAYU 사유비서',
    records: '아내와 산책, 부족함에 대한 문장, 기도, 가족 대화',
    help: '기록 속에 담긴 마음의 흐름과 삶의 의미를 정리합니다.',
    level: '느슨한 연결',
  },
  {
    name: '건강관리 비서',
    records: '식후 걷기, 단 음료 절제, 체중 기록, 수면 기록',
    help: '건강 습관이 어떻게 이어지고 있는지 참고자료로 정리합니다.',
    level: '느슨한 연결',
  },
  {
    name: '식물탐정 / 텃밭 비서',
    records: '호박꽃 관찰, 암꽃이 떨어진 기록, 옥상 텃밭 변화',
    help: '식물 상태를 살펴보고 관리 방향을 참고할 수 있게 돕습니다.',
    level: '이동 안내',
  },
  {
    name: '성장타임라인 비서',
    records: '호박 사진, 여행 사진, 날짜별 변화 기록',
    help: '여러 장의 사진과 날짜를 묶어 변화 과정을 문서처럼 보여줍니다.',
    level: '이동 안내',
  },
  {
    name: '독서사유 비서',
    records: '부족함, 성장, 독서 문장, 깨달음',
    help: '읽은 문장을 삶의 생각과 연결해 사유 기록으로 확장합니다.',
    level: '느슨한 연결',
  },
  {
    name: '가족·추억 비서',
    records: '아내와 산책, 딸과 통화, 가족 이야기, 여행 사진',
    help: '가족과의 시간, 대화, 사진을 추억 자료로 정리합니다.',
    level: '향후 연결 예정',
  },
  {
    name: '생활통계 비서',
    records: '운동, 감정, 반복 단어, 기록 빈도, 생활습관',
    help: '한 달 생활 흐름을 숫자와 그래프로 확인하게 돕습니다.',
    level: '느슨한 연결',
  },
  {
    name: '미래보기 비서',
    records: '20개 전체 기록, 반복 습관, 감정 흐름, 관심 주제',
    help: '지금까지의 기록을 바탕으로 앞으로의 생활 흐름과 실천 방향을 살펴봅니다.',
    level: '향후 연결 예정',
  },
];

const levelStyles: Record<LinkLevel, { bg: string; border: string; color: string }> = {
  '실제 전달': { bg: '#E0E8B8', border: '#D4DEA0', color: '#4A5A2C' },
  '느슨한 연결': { bg: '#DDD0E8', border: '#C9C0DE', color: '#5A4E7A' },
  '이동 안내': { bg: '#F5E5DC', border: '#E8B894', color: '#B85C2E' },
  '향후 연결 예정': { bg: '#E5DFD0', border: '#D4CDB9', color: '#7A6F5A' },
};

export function GyeongdaePreviewPage() {
  const [activeTabId, setActiveTabId] = useState<TabId>('daily');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const activeTab = useMemo(
    () => previewTabs.find((tab) => tab.id === activeTabId) || previewTabs[0],
    [activeTabId],
  );

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, #F5F0E8 0%, #EDE8DC 100%)',
        color: '#2C2C2A',
        fontFamily: FONT_KR,
        fontSize: 14,
        lineHeight: 1.65,
      }}
    >
      <style>{`
        .g-preview-button:hover { transform: translateY(-1px); box-shadow: 0 12px 26px -20px rgba(74,90,44,0.45); }
        .g-preview-button:active { transform: scale(0.99); }
        .g-preview-card:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -26px rgba(74,90,44,0.34); }
        .g-preview-tab:hover { border-color: #D4DEA0; color: #4A5A2C; }
        @media (max-width: 760px) {
          [data-g-preview="page"] { padding: 18px 14px 96px !important; }
          [data-g-preview="hero"] { padding: 26px 18px !important; }
          [data-g-preview="hero-title"] { font-size: 31px !important; }
          [data-g-preview="hero-actions"] { flex-direction: column !important; align-items: stretch !important; }
          [data-g-preview="hero-actions"] button { width: 100% !important; justify-content: center !important; }
          [data-g-preview="grid-2"], [data-g-preview="grid-3"], [data-g-preview="grid-4"] { grid-template-columns: 1fr !important; }
          [data-g-preview="tab-list"] { grid-template-columns: 1fr !important; }
          [data-g-preview="section-title"] { font-size: 23px !important; }
          [data-g-preview="record-grid"] { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div
        data-g-preview="page"
        style={{ maxWidth: 1180, margin: '0 auto', padding: '34px 28px 132px' }}
      >
        <section
          data-g-preview="hero"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5DFD0',
            borderRadius: 24,
            padding: '44px 46px',
            boxShadow: '0 16px 40px -34px rgba(74,90,44,0.5)',
          }}
        >
          <Badge icon={<Sparkles size={14} />}>GYEONGDAE PREVIEW</Badge>
          <h1
            data-g-preview="hero-title"
            style={{
              fontFamily: FONT_SERIF,
              fontSize: 46,
              lineHeight: 1.15,
              color: '#4A5A2C',
              margin: '20px 0 16px',
              letterSpacing: 0,
              maxWidth: 700,
            }}
          >
            짧게 적은 하루가
            <br />
            내 삶의 자산이 됩니다
          </h1>
          <p style={{ maxWidth: 790, margin: 0, color: '#5F5D55', fontSize: 15, lineHeight: 1.85 }}>
            HARU2026은 일기, 건강, 텃밭, 여행, 독서 같은 기록을 읽기 좋은
            문장으로 정리하고, 나중에 합본·통계·미래보기·비서 활용으로
            이어지게 돕습니다.
          </p>
          <p
            style={{
              maxWidth: 820,
              margin: '18px 0 0',
              color: '#2C2C2A',
              fontFamily: FONT_SERIF,
              fontSize: 20,
              lineHeight: 1.65,
            }}
          >
            한 줄 기록도 쌓이면 월간 생활문서가 되고, 통계가 되고,
            미래보기의 재료가 되고, 관련 비서가 다시 활용할 수 있는 자료가
            됩니다.
          </p>
          <div
            data-g-preview="hero-actions"
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}
          >
            <ScrollButton onClick={() => scrollTo('asset-flow')}>기록이 자산이 되는 과정 보기</ScrollButton>
            <ScrollButton onClick={() => scrollTo('four-week')}>4주 기록 예시 보기</ScrollButton>
            <ScrollButton onClick={() => scrollTo('assistant-map')}>비서 연결 보기</ScrollButton>
          </div>
        </section>

        <Section
          id="plain-words"
          icon={<BookOpen size={20} />}
          title="어려운 말 쉽게 풀기"
          body="HARU2026에서 자주 나오는 말을 처음 보는 사용자도 바로 이해할 수 있게 풀었습니다."
        >
          <div data-g-preview="grid-3" style={gridStyle(5)}>
            {glossary.map((item) => (
              <InfoCard key={item.title}>
                <h3 style={cardTitleStyle}>{item.title}</h3>
                <p style={cardTextStyle}>= {item.body}</p>
              </InfoCard>
            ))}
          </div>
        </Section>

        <Section
          id="asset-flow"
          icon={<Layers3 size={20} />}
          title="기록이 자산이 되는 핵심 흐름"
          body="HARU2026의 핵심은 기능을 많이 보여주는 것이 아니라, 내 기록이 나중에 쓸모 있는 자료가 되게 만드는 것입니다."
        >
          <div data-g-preview="grid-4" style={gridStyle(7)}>
            {flowSteps.map((step, index) => (
              <InfoCard key={step}>
                <span style={{ color: '#B85C2E', fontFamily: FONT_EN, fontWeight: 800 }}>
                  STEP {index + 1}
                </span>
                <h3 style={{ ...cardTitleStyle, marginTop: 8 }}>{step}</h3>
                {index < flowSteps.length - 1 && (
                  <ArrowDown size={18} color="#7A6F5A" style={{ marginTop: 12 }} />
                )}
              </InfoCard>
            ))}
          </div>
        </Section>

        <Section
          id="record-tabs"
          icon={<PenLine size={20} />}
          title="기록 형식 선택 탭"
          body="탭을 바꾸면 짧은 입력이 SAYU 정리, 합본, 통계, 미래보기, 비서 연결로 어떻게 이어지는지 볼 수 있습니다."
        >
          <div data-g-preview="tab-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {previewTabs.map((tab) => {
              const active = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className="g-preview-tab"
                  style={{
                    border: `1px solid ${active ? '#D4DEA0' : '#E5DFD0'}`,
                    background: active ? '#E0E8B8' : '#FFFFFF',
                    color: active ? '#4A5A2C' : '#7A6F5A',
                    borderRadius: 14,
                    padding: '11px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'border-color 160ms, color 160ms, background 160ms',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div data-g-preview="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 14, marginTop: 16 }}>
            <InfoCard>
              <PanelLabel>짧은 입력</PanelLabel>
              <p style={{ ...largeTextStyle, color: '#4A5A2C' }}>{activeTab.short}</p>
            </InfoCard>
            <InfoCard>
              <PanelLabel>SAYU가 정리한 기록</PanelLabel>
              <p style={largeTextStyle}>{activeTab.refined}</p>
            </InfoCard>
          </div>

          <div data-g-preview="grid-4" style={{ ...gridStyle(4), marginTop: 14 }}>
            <MiniPanel title="이어지는 활용" items={activeTab.useCases} />
            <MiniPanel title="합본 예시" items={[activeTab.merge]} />
            <MiniPanel title="통계 예시" items={activeTab.stats} />
            <MiniPanel title="관련 비서 연결 예시" items={activeTab.assistants} />
          </div>
          <InfoCard>
            <PanelLabel>미래보기 예시</PanelLabel>
            <p style={cardTextStyle}>{activeTab.future}</p>
          </InfoCard>
        </Section>

        <Section
          id="four-week"
          icon={<FileText size={20} />}
          title="4주 동안 기록하면 어떻게 바뀔까요?"
          body="매일 한 줄씩만 남겨도 4주가 지나면 약 20개의 생활 기록이 쌓입니다. HARU2026은 이 기록을 한 달 생활문서, 감정 흐름, 반복 주제, 미래보기 자료, 비서 활용 자료로 바꿔줍니다."
        >
          <div data-g-preview="grid-4" style={gridStyle(4)}>
            {weekSummaries.map((summary) => (
              <InfoCard key={summary}>
                <p style={{ ...cardTextStyle, margin: 0 }}>{summary}</p>
              </InfoCard>
            ))}
          </div>
          <button
            type="button"
            className="g-preview-button"
            onClick={() => setShowAllRecords((value) => !value)}
            style={primaryButtonStyle}
          >
            {showAllRecords ? '20개 기록 접기' : '20개 기록 펼쳐보기'}
          </button>
          {showAllRecords && (
            <div
              data-g-preview="record-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 12,
                marginTop: 14,
              }}
            >
              {fourWeekDiaryExamples.map((record) => (
                <InfoCard key={`${record.week}-${record.day}-${record.short}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <PanelLabel>{record.week} · {record.day}</PanelLabel>
                    <span style={{ fontSize: 12, color: '#B85C2E', fontWeight: 800 }}>{record.mood}</span>
                  </div>
                  <p style={{ ...cardTextStyle, color: '#4A5A2C' }}>{record.short}</p>
                  <p style={cardTextStyle}>{record.refined}</p>
                  <TagRow tags={record.tags} />
                </InfoCard>
              ))}
            </div>
          )}
        </Section>

        <Section
          id="monthly-merge"
          icon={<FileText size={20} />}
          title="20개의 기록이 하나의 월간 생활문서가 됩니다"
          body="아래 내용은 예시 데이터로 만든 합본 미리보기입니다. 실제 서비스에서는 사용자의 기록을 바탕으로 생성됩니다."
        >
          <InfoCard>
            {monthlyMerge.map((paragraph) => (
              <p key={paragraph} style={{ ...cardTextStyle, fontSize: 15 }}>
                {paragraph}
              </p>
            ))}
          </InfoCard>
        </Section>

        <Section
          id="stats"
          icon={<BarChart3 size={20} />}
          title="20개의 기록을 통계로 보면 흐름이 보입니다"
          body="정적 예시 데이터를 CSS 막대그래프로 표현했습니다. 새 차트 라이브러리나 실제 통계 기능은 사용하지 않습니다."
        >
          <div data-g-preview="grid-4" style={gridStyle(4)}>
            {['총 기록 수: 20개', '기록 기간: 4주', '기록한 요일: 월~금 중심', '자주 나온 주제: 건강, 가족, 운동, 텃밭, 사유'].map((item) => (
              <InfoCard key={item}>
                <p style={{ ...cardTitleStyle, margin: 0 }}>{item}</p>
              </InfoCard>
            ))}
          </div>
          <div data-g-preview="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <BarPanel title="주제별 통계" rows={topicStats} max={6} />
            <BarPanel title="감정별 통계" rows={moodStats} max={3} />
          </div>
          <InfoCard>
            <PanelLabel>반복 단어 예시</PanelLabel>
            <TagRow tags={repeatWords} />
          </InfoCard>
        </Section>

        <Section
          id="future"
          icon={<LineChart size={20} />}
          title="이 기록들이 쌓이면 미래보기의 재료가 됩니다"
          body="미래보기는 미래를 맞히는 기능이 아닙니다. 20개의 기록에서 반복되는 습관과 관심을 보고, 앞으로 어떤 방향을 더 살펴볼 수 있는지 보여주는 기능입니다."
        >
          <div data-g-preview="grid-4" style={gridStyle(4)}>
            {futureCards.map((card) => (
              <InfoCard key={card.title}>
                <h3 style={cardTitleStyle}>{card.title}</h3>
                <p style={cardTextStyle}>{card.body}</p>
              </InfoCard>
            ))}
          </div>
          <Notice>
            미래보기는 예언, 진단, 투자 예측, 질병 예측이 아닙니다. 건강 관련 내용은 의료 판단이 아니라 생활 흐름 참고로만 봅니다.
          </Notice>
        </Section>

        <Section
          id="assistant-map"
          icon={<Brain size={20} />}
          title="이 기록은 어떤 비서와 연결될까요?"
          body="HARU2026의 기록은 단순히 저장되는 데서 끝나지 않습니다. 기록 안에 담긴 건강, 가족, 식물, 독서, 사진, 생활습관 같은 내용은 관련 비서가 다시 꺼내 쓰는 자료가 됩니다."
        >
          <div data-g-preview="grid-4" style={gridStyle(4)}>
            {assistantMap.map((assistant) => (
              <InfoCard key={assistant.name}>
                <LevelBadge level={assistant.level} />
                <h3 style={{ ...cardTitleStyle, marginTop: 12 }}>{assistant.name}</h3>
                <PanelLabel>연결되는 기록 예시</PanelLabel>
                <p style={cardTextStyle}>{assistant.records}</p>
                <PanelLabel>도와주는 일</PanelLabel>
                <p style={cardTextStyle}>{assistant.help}</p>
              </InfoCard>
            ))}
          </div>
          <Notice>
            현재 모든 비서가 모든 기록을 완전 자동으로 가져가는 것은 아닙니다.
            일부 비서는 기록을 직접 활용하고, 일부는 사용자가 선택해 이어서
            사용할 수 있으며, 일부 연결은 앞으로 확장될 예정입니다.
          </Notice>
        </Section>

        <Section
          id="connection-levels"
          icon={<CheckCircle2 size={20} />}
          title="정직한 연결 수준 안내"
          body="첫 화면에서는 큰 흐름을 먼저 보여주고, 하단에서 현재 연결 수준을 분명히 구분합니다."
        >
          <div data-g-preview="grid-4" style={gridStyle(4)}>
            {(['실제 전달', '느슨한 연결', '이동 안내', '향후 연결 예정'] as LinkLevel[]).map((level) => (
              <InfoCard key={level}>
                <LevelBadge level={level} />
                <p style={{ ...cardTextStyle, marginTop: 12 }}>
                  {connectionDescriptions[level]}
                </p>
              </InfoCard>
            ))}
          </div>
          <Notice>
            현재 모든 기능이 완전 자동으로 연결되는 것은 아닙니다. 일부 기록은
            비서가 직접 활용하고, 일부 기능은 사용자가 선택해서 이어서 사용할 수
            있으며, 일부 연결은 앞으로 확장될 예정입니다.
          </Notice>
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
            한 줄 기록이 쌓이면, 다시 꺼내 쓸 수 있는 삶의 자료가 됩니다.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.78)', margin: '10px 0 0', maxWidth: 780 }}>
            이 페이지는 비교용 정적 프리뷰입니다. 실제 저장, AI 호출, PDF 생성,
            비서 간 핸드오프 기능은 포함하지 않습니다.
          </p>
        </section>
      </div>
    </div>
  );
}

const connectionDescriptions: Record<LinkLevel, string> = {
  '실제 전달': '기록을 들고 비서로 들어가는 연결입니다.',
  '느슨한 연결': '같은 records 저장소를 바탕으로 나중에 활용할 수 있는 연결입니다.',
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
            data-g-preview="section-title"
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
      className="g-preview-card"
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

function MiniPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <InfoCard>
      <PanelLabel>{title}</PanelLabel>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {items.map((item) => (
          <li key={item} style={{ color: '#4C4A43', fontSize: 13, lineHeight: 1.55 }}>
            {item}
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}

function BarPanel({
  title,
  rows,
  max,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  max: number;
}) {
  return (
    <InfoCard>
      <h3 style={cardTitleStyle}>{title}</h3>
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
    </InfoCard>
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
    <button type="button" className="g-preview-button" onClick={onClick} style={secondaryButtonStyle}>
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

function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5DFD0',
        borderRadius: 18,
        padding: 18,
        marginTop: 14,
        color: '#4C4A43',
      }}
    >
      {children}
    </div>
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

export default GyeongdaePreviewPage;
