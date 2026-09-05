import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  Layers3,
  Leaf,
  LineChart,
  Map,
  PenLine,
  Sparkles,
  Sprout,
  Users,
} from 'lucide-react';

const FONT_KR = "'Pretendard', 'Pretendard Variable', system-ui, sans-serif";
const FONT_EN = "'Inter', system-ui, sans-serif";
const FONT_SERIF = "'MaruBuri', 'Pretendard', serif";

type RecordType =
  | 'daily'
  | 'health'
  | 'garden'
  | 'travel'
  | 'reading'
  | 'family'
  | 'prayer';
type WeekId = 'week1' | 'week2' | 'week3' | 'week4';
type FutureId = 'month' | 'year' | 'fiveYears' | 'hundred';
type LinkLevel = '실제 전달' | '느슨한 연결' | '이동 안내' | '향후 연결 예정';

type ExperienceTab = {
  id: RecordType;
  label: string;
  icon: ReactNode;
  short: string;
  refined: string;
  useCases: string[];
  merge: string;
  stats: string[];
  future: string;
  assistants: string;
  meaning: string;
  category: string;
  mood: string;
  themes: string;
};

type WeekSimulation = {
  id: WeekId;
  label: string;
  records: string[];
  insight: string;
};

type DiaryRecord = {
  index: number;
  short: string;
  refined: string;
};

type StatRow = {
  label: string;
  value: number;
  suffix: string;
};

type AssistantCard = {
  name: string;
  records: string;
  help: string;
  level: LinkLevel;
};

const defaultInput = '오늘은 별일 없었지만 저녁에 아내와 산책했다.';

const experienceTabs: ExperienceTab[] = [
  {
    id: 'daily',
    label: '하루기록',
    icon: <PenLine size={17} />,
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
    merge: '6월의 하루기록을 모아 ‘나의 6월 생활기록’ 문서로 묶어볼 수 있습니다.',
    stats: [
      '이번 달 기록한 날: 18일',
      '자주 나온 단어: 산책, 가족, 피곤함, 감사',
      '감정 흐름: 평온 45%, 피곤 30%, 감사 25%',
    ],
    future:
      '최근 기록에서 산책과 가족 시간이 반복됩니다. 앞으로도 저녁 산책을 유지하면 생활 리듬과 정서 안정에 도움이 되는 방향으로 이어질 수 있습니다.',
    assistants: 'SAYU 사유비서, 생활통계 비서, 가족·추억 비서, 미래보기 비서',
    meaning: '가족, 평온, 생활 리듬이라는 흐름이 담겨 있습니다.',
    category: '가족 / 일상',
    mood: '평온',
    themes: '산책, 부부 대화, 저녁 루틴',
  },
  {
    id: 'health',
    label: '건강',
    icon: <HeartPulse size={17} />,
    short: '저녁 식사 후 20분 걸었고 단 음료는 마시지 않았다.',
    refined:
      '오늘은 식후 걷기를 실천하고 단 음료를 참으며 건강을 위한 작은 선택을 했다. 큰 변화는 아니지만 이런 선택이 반복되면 생활 리듬을 안정시키는 기록이 된다.',
    useCases: [
      '건강 습관 기록',
      '식사·운동 흐름 합본',
      '건강 주제 통계',
      '생활 리듬 미래보기',
      '건강관리 비서 연결',
    ],
    merge: '한 달 동안의 걷기, 수면, 식사 조절 기록을 묶어 건강관리 생활문서로 볼 수 있습니다.',
    stats: ['식후 걷기 기록: 8회', '단 음료 절제 기록: 4회', '수면 관련 기록: 3회'],
    future:
      '걷기와 식사 조절 기록이 반복되면 앞으로 어떤 생활 습관이 안정적으로 이어지는지 참고할 수 있습니다.',
    assistants: '건강관리 비서, 생활통계 비서, 미래보기 비서',
    meaning: '건강관리, 절제, 생활 습관이라는 흐름이 담겨 있습니다.',
    category: '건강 / 습관',
    mood: '실천',
    themes: '식후 걷기, 단 음료 절제, 생활 리듬',
  },
  {
    id: 'garden',
    label: '텃밭',
    icon: <Leaf size={17} />,
    short: '호박 암꽃이 피었는데 오후에 떨어져서 아쉬웠다.',
    refined:
      '오늘은 텃밭에서 호박 암꽃이 피었다가 떨어진 모습을 보며 아쉬움을 느꼈다. 이 기록은 단순한 실패가 아니라 물, 햇빛, 영양, 수분 상태를 다시 살펴보게 하는 관찰 자료가 된다.',
    useCases: [
      '텃밭 관찰 기록',
      '식물 변화 합본',
      '반복 문제 통계',
      '관리 방향 미래보기',
      '식물탐정 / 텃밭 비서 연결',
    ],
    merge: '호박꽃, 암꽃, 열매, 물주기 기록을 날짜별로 묶어 식물 성장 기록으로 볼 수 있습니다.',
    stats: ['호박 관련 기록: 6회', '꽃 관련 기록: 4회', '물주기 관련 기록: 3회'],
    future:
      '암꽃이 반복해서 떨어지는 기록이 쌓이면 앞으로 물, 햇빛, 영양, 인공수분 상태를 더 살펴볼 수 있습니다.',
    assistants: '식물탐정 / 텃밭 비서, 성장타임라인 비서',
    meaning: '관찰, 아쉬움, 관리 방향이라는 흐름이 담겨 있습니다.',
    category: '텃밭 / 식물',
    mood: '아쉬움',
    themes: '호박꽃, 암꽃, 물주기, 인공수분',
  },
  {
    id: 'travel',
    label: '여행',
    icon: <Map size={17} />,
    short: '여행 사진을 정리하다가 바닷가에서 찍은 사진이 가장 기억에 남았다.',
    refined:
      '오늘은 여행 사진을 정리하며 바닷가에서 보낸 시간을 다시 떠올렸다. 사진 한 장은 단순한 이미지가 아니라 그날의 공기, 동행, 마음을 다시 꺼내보게 하는 추억 기록이 된다.',
    useCases: [
      '여행기록 정리',
      '사진 기반 합본',
      '장소·동행 통계',
      '추억 흐름 미래보기',
      '가족·추억 비서 연결',
    ],
    merge: '여행 날짜와 사진, 짧은 기록을 묶어 여행문서처럼 볼 수 있습니다.',
    stats: ['여행 기록 수: 5개', '자주 나온 단어: 바다, 가족, 사진, 산책, 기억'],
    future:
      '여행과 사진 기록이 쌓이면 내가 어떤 장소와 누구와의 시간을 오래 기억하는지 볼 수 있습니다.',
    assistants: '가족·추억 비서, 성장타임라인 비서',
    meaning: '장소, 사진, 추억이라는 흐름이 담겨 있습니다.',
    category: '여행 / 사진',
    mood: '그리움',
    themes: '바다, 사진, 동행, 기억',
  },
  {
    id: 'reading',
    label: '독서',
    icon: <BookOpen size={17} />,
    short: '책을 읽다가 부족함도 성장의 시작이라는 문장이 마음에 남았다.',
    refined:
      '오늘은 책 속 문장을 통해 부족함을 부끄러움이 아니라 성장의 출발점으로 바라보게 되었다. 읽은 문장이 삶의 태도와 연결될 때 독서는 기록을 넘어 사유가 된다.',
    useCases: [
      '독서사유 정리',
      '월간 독서기록 합본',
      '반복 주제 통계',
      '성장 방향 미래보기',
      '독서사유 비서 연결',
    ],
    merge: '한 달 동안 읽은 문장과 생각을 묶어 독서사유 문서로 만들 수 있습니다.',
    stats: ['독서 기록 수: 4개', '자주 나온 단어: 부족함, 성장, 배움, 태도, 계속'],
    future:
      '성장과 배움에 대한 기록이 반복되면 내가 어떤 생각을 붙잡고 살아가는지 볼 수 있습니다.',
    assistants: '독서사유 비서, SAYU 사유비서',
    meaning: '배움, 부족함, 성장이라는 흐름이 담겨 있습니다.',
    category: '독서 / 사유',
    mood: '깨달음',
    themes: '부족함, 성장, 배움, 태도',
  },
  {
    id: 'family',
    label: '가족/추억',
    icon: <Users size={17} />,
    short: '딸과 통화했는데 별 얘기는 없었지만 마음이 편했다.',
    refined:
      '오늘은 딸과 짧게 통화하며 특별한 이야기가 없어도 마음이 편안해지는 시간을 가졌다. 가족과의 평범한 대화는 기록으로 남길 때 오래 꺼내볼 수 있는 추억이 된다.',
    useCases: [
      '가족 대화 기록',
      '가족 추억 합본',
      '가족 관련 반복 단어 통계',
      '관계 흐름 미래보기',
      '가족·추억 비서 연결',
    ],
    merge: '아내와 산책, 딸과 통화, 가족 식사 기록을 묶어 가족 생활문서로 볼 수 있습니다.',
    stats: ['가족 관련 기록: 7회', '자주 나온 단어: 아내, 딸, 통화, 산책, 저녁'],
    future:
      '가족 대화와 함께한 시간이 반복해서 기록되면 내가 어떤 관계에서 힘을 얻는지 볼 수 있습니다.',
    assistants: '가족·추억 비서, SAYU 사유비서',
    meaning: '관계, 안도감, 추억이라는 흐름이 담겨 있습니다.',
    category: '가족 / 추억',
    mood: '편안함',
    themes: '딸, 통화, 가족 대화, 안도감',
  },
  {
    id: 'prayer',
    label: '기도/사유',
    icon: <Sprout size={17} />,
    short: '오늘은 부족했지만 기도하면서 마음을 다시 잡았다.',
    refined:
      '오늘은 부족함을 느꼈지만 기도하며 마음을 다시 정돈했다. 완벽하지 않은 하루도 돌아보고 다시 시작하려는 마음이 담기면 중요한 사유 기록이 된다.',
    useCases: [
      '기도와 사유 정리',
      '월간 사유 합본',
      '감정 흐름 통계',
      '마음 방향 미래보기',
      'SAYU 사유비서 연결',
    ],
    merge: '기도, 감사, 부족함, 다시 시작에 대한 기록을 묶어 월간 사유문서로 볼 수 있습니다.',
    stats: ['기도 관련 기록: 3회', '감사 관련 기록: 5회', '부족함 관련 기록: 4회'],
    future:
      '감사와 다시 시작에 대한 기록이 반복되면 내가 어떤 태도로 하루를 회복하는지 볼 수 있습니다.',
    assistants: 'SAYU 사유비서, 독서사유 비서, 미래보기 비서',
    meaning: '부족함, 회복, 다시 시작이라는 흐름이 담겨 있습니다.',
    category: '기도 / 사유',
    mood: '회복',
    themes: '기도, 감사, 부족함, 다시 시작',
  },
];

const flowCards = [
  {
    title: 'SAYU 사유정리',
    body: '짧은 기록을 읽기 좋은 문장으로 정리하고, 그 안의 의미를 찾아줍니다.',
  },
  {
    title: '월간 합본',
    body: '여러 날의 기록을 하나의 생활문서처럼 묶어볼 수 있습니다.',
  },
  {
    title: '생활통계',
    body: '내가 얼마나, 어떤 주제로 기록했는지 숫자와 흐름으로 볼 수 있습니다.',
  },
  {
    title: '미래보기',
    body: '미래를 맞히는 것이 아니라, 지금까지의 기록을 바탕으로 앞으로의 생활 방향을 살펴봅니다.',
  },
  {
    title: '관련 비서 연결',
    body: '건강, 가족, 텃밭, 독서, 여행 기록을 관련 비서가 다시 활용할 수 있는 자료로 남깁니다.',
  },
];

const weekSimulations: WeekSimulation[] = [
  {
    id: 'week1',
    label: '1주차',
    records: [
      '저녁에 20분 걸었다.',
      '단 음료를 참았다.',
      '호박꽃이 피었다.',
      '영어 공부를 조금 했다.',
      '몸은 무거웠지만 기록은 남겼다.',
    ],
    insight:
      '건강관리와 작은 실천이 시작되었습니다. 완벽한 변화보다 ‘시작한 흔적’이 쌓이고 있습니다.',
  },
  {
    id: 'week2',
    label: '2주차',
    records: [
      '아내와 산책했다.',
      '딸과 통화했다.',
      '식사량을 조절했다.',
      '책을 읽고 생각을 적었다.',
      '평온한 저녁을 보냈다.',
    ],
    insight:
      '가족 대화, 식사 조절, 독서 사유가 함께 나타납니다. 일상이 단순한 반복이 아니라 생활 패턴으로 보이기 시작합니다.',
  },
  {
    id: 'week3',
    label: '3주차',
    records: [
      '체중을 기록했다.',
      '텃밭 상태를 살폈다.',
      '오늘은 피곤했지만 감사한 일이 있었다.',
      '시간을 더 잘 쓰고 싶었다.',
      '스쿼트를 했다.',
    ],
    insight:
      '건강 점검, 텃밭 관찰, 감사, 시간관리가 반복됩니다. 기록이 생활 관리의 참고자료가 되기 시작합니다.',
  },
  {
    id: 'week4',
    label: '4주차',
    records: [
      '잠을 조금 부족하게 잤다.',
      '사진을 정리했다.',
      '기도하며 하루를 마무리했다.',
      '가족 이야기를 나눴다.',
      '한 달을 돌아보았다.',
    ],
    insight:
      '수면, 사진, 신앙, 가족 대화가 한 달의 마무리 기록으로 남습니다. 한 줄들이 모여 월간 생활문서의 재료가 됩니다.',
  },
];

const diaryRecords: DiaryRecord[] = [
  {
    index: 1,
    short: '저녁에 20분 걸었다.',
    refined:
      '오늘은 저녁에 20분을 걸으며 건강을 위한 작은 실천을 남겼다. 짧은 걷기도 반복되면 생활 리듬을 만드는 중요한 기록이 된다.',
  },
  {
    index: 2,
    short: '단 음료를 마시고 싶었지만 참았다.',
    refined:
      '오늘은 단 음료를 마시고 싶은 마음을 조절했다. 작은 절제가 쌓이면 건강을 지키는 선택의 흐름이 된다.',
  },
  {
    index: 3,
    short: '호박꽃이 피어서 기분이 좋았다.',
    refined:
      '텃밭에서 호박꽃이 핀 모습을 보며 기쁨을 느꼈다. 식물의 작은 변화도 기록으로 남기면 성장의 과정이 된다.',
  },
  {
    index: 4,
    short: '영어 공부를 조금 했다.',
    refined:
      '오늘은 많은 양은 아니지만 영어 공부를 이어갔다. 조금이라도 계속하는 태도가 배움의 흐름을 만든다.',
  },
  {
    index: 5,
    short: '몸이 무거웠지만 기록은 남겼다.',
    refined:
      '몸이 무거운 하루였지만 기록을 남기며 하루를 놓치지 않았다. 완벽하지 않은 날에도 기록은 나를 다시 정돈하게 한다.',
  },
  {
    index: 6,
    short: '아내와 산책했다.',
    refined:
      '오늘은 아내와 함께 산책하며 하루를 차분하게 마무리했다. 평범한 산책도 함께한 시간으로 남으면 소중한 가족 기록이 된다.',
  },
  {
    index: 7,
    short: '딸과 통화하니 마음이 편했다.',
    refined:
      '딸과의 통화는 특별한 이야기가 없어도 마음을 편안하게 해주었다. 가족과의 짧은 대화도 삶을 지탱하는 기억이 된다.',
  },
  {
    index: 8,
    short: '저녁 식사량을 조금 줄였다.',
    refined:
      '오늘은 저녁 식사량을 조절하며 건강을 생각하는 선택을 했다. 작은 조절이 반복되면 식습관의 흐름을 확인할 수 있다.',
  },
  {
    index: 9,
    short: '책을 읽다가 부족함도 성장이라는 생각을 했다.',
    refined:
      '책을 읽으며 부족함을 성장의 출발점으로 받아들이는 생각을 했다. 독서는 삶의 태도를 다시 바라보게 하는 사유의 계기가 된다.',
  },
  {
    index: 10,
    short: '별일 없는 평온한 하루였다.',
    refined:
      '오늘은 특별한 사건은 없었지만 평온하게 지나간 하루였다. 별일 없는 날도 기록으로 남기면 생활의 안정감을 확인할 수 있다.',
  },
  {
    index: 11,
    short: '체중을 기록했다.',
    refined:
      '오늘은 체중을 기록하며 내 몸의 상태를 확인했다. 숫자를 남기는 일은 판단보다 관찰에 가깝고, 건강 흐름을 보는 자료가 된다.',
  },
  {
    index: 12,
    short: '호박 암꽃이 떨어져서 아쉬웠다.',
    refined:
      '호박 암꽃이 떨어진 모습을 보며 아쉬움을 느꼈다. 이 기록은 물, 햇빛, 영양, 수분 상태를 다시 살펴보게 하는 관찰 자료가 된다.',
  },
  {
    index: 13,
    short: '피곤했지만 감사한 일이 있었다.',
    refined:
      '피곤함이 있었지만 감사한 일을 떠올리며 하루를 마무리했다. 어려운 날에도 감사가 함께 기록되면 마음의 균형을 볼 수 있다.',
  },
  {
    index: 14,
    short: '시간을 더 잘 쓰고 싶었다.',
    refined:
      '오늘은 시간을 더 잘 쓰고 싶다는 생각을 했다. 이런 기록은 단순한 반성이 아니라 앞으로의 생활 방향을 정하는 출발점이 된다.',
  },
  {
    index: 15,
    short: '스쿼트를 했다.',
    refined:
      '오늘은 스쿼트를 하며 몸을 움직였다. 짧은 운동 기록도 반복되면 건강관리의 흐름을 보여주는 자료가 된다.',
  },
  {
    index: 16,
    short: '잠을 조금 부족하게 잤다.',
    refined:
      '오늘은 수면이 부족해 몸의 상태를 느꼈다. 수면 기록이 쌓이면 피곤함과 생활 리듬의 관계를 돌아볼 수 있다.',
  },
  {
    index: 17,
    short: '여행 사진을 정리했다.',
    refined:
      '여행 사진을 정리하며 지난 시간을 다시 떠올렸다. 사진과 짧은 기록이 함께 남으면 추억을 문서처럼 꺼내볼 수 있다.',
  },
  {
    index: 18,
    short: '기도하면서 마음을 다시 잡았다.',
    refined:
      '기도하며 흐트러진 마음을 다시 정돈했다. 하루의 부족함을 돌아보고 다시 시작하려는 마음은 중요한 사유 기록이 된다.',
  },
  {
    index: 19,
    short: '가족 이야기를 나누며 저녁을 보냈다.',
    refined:
      '가족과 이야기를 나누며 저녁 시간을 보냈다. 평범한 대화도 기록으로 남기면 가족의 생활과 관계를 보여주는 자료가 된다.',
  },
  {
    index: 20,
    short: '한 달을 돌아보니 그래도 꾸준히 해온 것이 있었다.',
    refined:
      '한 달을 돌아보며 작지만 꾸준히 이어온 것들을 확인했다. 기록은 내가 놓치고 지나간 실천과 변화를 다시 보게 해준다.',
  },
];

const monthlyDocument = [
  '6월 한 달 동안의 기록을 돌아보면, 운동과 건강관리, 가족과의 시간, 텃밭 관찰, 공부와 사유가 반복해서 나타났다.',
  '처음에는 몸이 무겁거나 단 음료를 참는 작은 실천에서 시작되었지만, 시간이 지나면서 산책, 스쿼트, 식후 걷기, 체중 기록처럼 건강을 지키려는 흐름이 이어졌다.',
  '가족과의 시간도 중요한 축이었다. 아내와의 산책, 딸과의 통화, 가족 이야기를 나눈 저녁은 평범한 일상이지만 기록으로 남기면 삶을 지탱하는 따뜻한 장면이 된다.',
  '텃밭 기록에서는 호박꽃과 암꽃이 반복해서 등장했다. 기쁨과 아쉬움이 함께 있었고, 물·햇빛·영양·인공수분 상태를 더 살펴보려는 관리 방향도 생겼다.',
  '독서와 기도, 영어 공부 기록에서는 부족함을 성장의 출발점으로 받아들이려는 태도가 보였다. 완벽하지 않아도 계속 배우고 움직이려는 흐름이 한 달 전체에 담겨 있다.',
  '이 한 달은 대단한 사건보다 작은 실천이 모여 만들어진 시간이었다. HARU2026은 이런 평범한 기록들을 모아 나의 생활문서, 건강관리 자료, 가족의 추억, 사유의 자산으로 다시 꺼내볼 수 있게 한다.',
];

const topicStats: StatRow[] = [
  { label: '건강관리', value: 6, suffix: '회' },
  { label: '가족', value: 5, suffix: '회' },
  { label: '운동/산책', value: 5, suffix: '회' },
  { label: '텃밭', value: 3, suffix: '회' },
  { label: '독서/사유', value: 3, suffix: '회' },
  { label: '기도/신앙', value: 2, suffix: '회' },
  { label: '사진/추억', value: 2, suffix: '회' },
];

const moodStats: StatRow[] = [
  { label: '평온', value: 45, suffix: '%' },
  { label: '피곤', value: 30, suffix: '%' },
  { label: '감사', value: 25, suffix: '%' },
];

const repeatWords = [
  '산책',
  '가족',
  '건강',
  '기록',
  '텃밭',
  '호박',
  '운동',
  '감사',
  '부족함',
  '꾸준함',
];

const futureTabs = [
  {
    id: 'month' as FutureId,
    label: '1개월 보기',
    body: '이번 달 기록에서는 건강관리, 가족 대화, 텃밭 관찰이 반복되었습니다. 다음 달에도 식후 걷기와 기록 습관을 이어가면 생활 리듬을 더 안정적으로 볼 수 있습니다.',
  },
  {
    id: 'year' as FutureId,
    label: '1년 보기',
    body: '운동, 식사 조절, 가족과의 대화가 계속 기록되면 1년 뒤에는 나의 건강관리 흐름과 가족 시간의 변화가 더 선명해집니다.',
  },
  {
    id: 'fiveYears' as FutureId,
    label: '5년 보기',
    body: '텃밭, 독서, 신앙, 공부 기록이 쌓이면 내가 어떤 배움과 보람을 꾸준히 붙잡고 살아왔는지 볼 수 있습니다.',
  },
  {
    id: 'hundred' as FutureId,
    label: '100세 보기',
    body: '오래 남긴 기록은 단순한 일기가 아니라 가족에게 남길 수 있는 삶의 이야기, 습관 변화, 감사와 사유의 자산이 됩니다.',
  },
];

const primaryAssistants: AssistantCard[] = [
  {
    name: 'SAYU 사유비서',
    records: '아내와 산책, 부족함에 대한 문장, 기도, 가족 대화',
    help: '기록 속 마음의 흐름과 삶의 의미를 정리합니다.',
    level: '느슨한 연결',
  },
  {
    name: '생활통계 비서',
    records: '운동, 감정, 반복 단어, 기록 빈도, 생활습관',
    help: '한 달 생활 흐름을 숫자와 그래프로 확인하게 돕습니다.',
    level: '느슨한 연결',
  },
  {
    name: '건강관리 비서',
    records: '식후 걷기, 단 음료 절제, 체중 기록, 수면 기록',
    help: '건강 습관이 어떻게 이어지고 있는지 참고자료로 정리합니다.',
    level: '느슨한 연결',
  },
  {
    name: '가족·추억 비서',
    records: '아내와 산책, 딸과 통화, 가족 이야기, 여행 사진',
    help: '가족과의 시간, 대화, 사진을 추억 자료로 정리합니다.',
    level: '향후 연결 예정',
  },
];

const extraAssistants: AssistantCard[] = [
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
    name: '미래보기 비서',
    records: '20개 전체 기록, 반복 습관, 감정 흐름, 관심 주제',
    help: '지금까지의 기록을 바탕으로 앞으로의 생활 흐름과 실천 방향을 살펴봅니다.',
    level: '향후 연결 예정',
  },
];

const glossary = [
  ['기록형식', '글을 쉽게 쓰게 해주는 입력틀입니다.'],
  ['SAYU', '짧게 쓴 기록을 읽기 좋은 문장으로 다듬고, 그 안의 의미를 찾아주는 사유 공간입니다.'],
  ['합본', '여러 날의 기록을 하나의 문서처럼 묶어보는 기능입니다.'],
  ['통계', '내가 얼마나, 어떤 주제로 기록했는지 숫자와 흐름으로 보는 기능입니다.'],
  ['미래보기', '미래를 맞히는 기능이 아니라, 지금까지의 기록을 바탕으로 앞으로의 생활 흐름과 관리 방향을 살펴보는 기능입니다.'],
  ['비서 연결', '기록 속 주제에 따라 관련 비서가 다시 참고하거나, 사용자가 선택해 이어서 활용할 수 있게 돕는 연결입니다.'],
  ['핸드오프', '한 기능에서 만든 자료를 다른 비서나 기능에서 이어서 활용할 수 있게 넘기는 방식입니다.'],
];

const connectionDescriptions: Record<LinkLevel, string> = {
  '실제 전달': '기록을 들고 비서로 들어가는 연결입니다.',
  '느슨한 연결': '같은 records 저장소를 바탕으로 나중에 활용할 수 있는 연결입니다.',
  '이동 안내': '비서 페이지로 이동하지만 기록 데이터 전달은 없는 안내입니다.',
  '향후 연결 예정': '현재는 프리뷰 안내만 가능하고, 추후 확장될 연결입니다.',
};

const levelStyles: Record<LinkLevel, { bg: string; border: string; color: string }> = {
  '실제 전달': { bg: '#E0E8B8', border: '#D4DEA0', color: '#4A5A2C' },
  '느슨한 연결': { bg: '#DDD0E8', border: '#C9C0DE', color: '#5A4E7A' },
  '이동 안내': { bg: '#F5E5DC', border: '#E8B894', color: '#B85C2E' },
  '향후 연결 예정': { bg: '#E5DFD0', border: '#D4CDB9', color: '#7A6F5A' },
};

export function GyeongdaePreviewPage() {
  const navigate = useNavigate();
  const [entry, setEntry] = useState(defaultInput);
  const [activeType, setActiveType] = useState<RecordType>('daily');
  const [activeWeek, setActiveWeek] = useState<WeekId>('week1');
  const [activeFuture, setActiveFuture] = useState<FutureId>('month');
  const [hasTried, setHasTried] = useState(false);

  const activeTab = useMemo(
    () => experienceTabs.find((tab) => tab.id === activeType) || experienceTabs[0],
    [activeType],
  );
  const activeWeekData = useMemo(
    () => weekSimulations.find((week) => week.id === activeWeek) || weekSimulations[0],
    [activeWeek],
  );
  const activeFutureData = useMemo(
    () => futureTabs.find((future) => future.id === activeFuture) || futureTabs[0],
    [activeFuture],
  );

  const trimmedEntry = entry.trim();
  const displayInput = trimmedEntry || activeTab.short;
  const isDefaultDaily = activeType === 'daily' && displayInput === defaultInput;
  const sayuResult =
    hasTried && !isDefaultDaily
      ? `${displayInput} 이 한 줄에는 ${activeTab.meaning.replace('이라는 흐름이 담겨 있습니다.', '')}의 흐름이 담겨 있습니다. HARU2026은 이런 짧은 기록을 읽기 좋은 문장으로 정리하고, 나중에 합본·통계·미래보기·비서 활용 자료로 이어지게 합니다.`
      : activeTab.refined;

  const startExperience = () => {
    setHasTried(true);
    scrollTo('sayu-result');
  };

  const useExample = () => {
    setEntry(defaultInput);
    setActiveType('daily');
    setHasTried(true);
    scrollTo('sayu-result');
  };

  const goLogin = () => {
    navigate('/login', { state: { from: '/gyeongdae-preview' } });
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #F7F3EA 0%, #EDE7DA 58%, #F8F5EF 100%)',
        color: '#2C2C2A',
        fontFamily: FONT_KR,
      }}
    >
      <style>{`
        .g-page-button:hover { transform: translateY(-1px); box-shadow: 0 16px 28px -24px rgba(74,90,44,0.55); }
        .g-page-button:active { transform: scale(0.99); }
        .g-tab:hover { border-color: #D4DEA0; color: #4A5A2C; }
        .g-card:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -28px rgba(74,90,44,0.38); }
        .g-textarea:focus { outline: 2px solid rgba(122,139,78,0.24); border-color: #7A8B4E; }
        @media (max-width: 780px) {
          [data-g-page] { padding: 18px 14px 96px !important; }
          [data-g-hero] { padding: 24px 18px !important; }
          [data-g-hero-title] { font-size: 33px !important; }
          [data-g-hero-layout] { grid-template-columns: 1fr !important; }
          [data-g-grid-2], [data-g-grid-3], [data-g-grid-4], [data-g-grid-5] { grid-template-columns: 1fr !important; }
          [data-g-format-list] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          [data-g-actions] { flex-direction: column !important; align-items: stretch !important; }
          [data-g-actions] button { width: 100% !important; }
          [data-g-section-title] { font-size: 24px !important; }
          [data-g-stat-summary] { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div data-g-page style={{ maxWidth: 1180, margin: '0 auto', padding: '34px 28px 132px' }}>
        <section data-g-hero style={heroStyle}>
          <div
            data-g-hero-layout
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 0.92fr) minmax(320px, 1fr)',
              gap: 22,
            }}
          >
            <div>
              <Badge icon={<Sparkles size={14} />}>GYEONGDAE EXPERIENCE PREVIEW</Badge>
              <h1 data-g-hero-title style={heroTitleStyle}>
                오늘 한 줄만 적어보세요.
                <br />
                HARU2026이 당신의 하루를 생활문서로 바꿔드립니다.
              </h1>
              <p style={heroTextStyle}>
                일기, 건강, 텃밭, 여행, 독서, 가족 기록이 쌓이면 월간 합본,
                감정 흐름, 반복 주제, 미래보기, 관련 비서 활용 자료가 됩니다.
              </p>
              <FlowStrip />
            </div>

            <div style={heroInputPanelStyle}>
              <PanelLabel>한 줄 기록 체험</PanelLabel>
              <textarea
                className="g-textarea"
                value={entry}
                onChange={(event) => setEntry(event.target.value)}
                placeholder="오늘은 별일 없었지만 저녁에 아내와 산책했다."
                rows={4}
                style={textareaStyle}
              />
              <p style={{ ...cardTextStyle, marginTop: 10 }}>
                이 입력은 저장되지 않습니다. 화면 안에서만 예시 결과를 보여주는 체험입니다.
              </p>
              <div data-g-format-list style={formatListStyle}>
                {experienceTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className="g-tab"
                    onClick={() => setActiveType(tab.id)}
                    style={tabButtonStyle(tab.id === activeType)}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
              <div data-g-actions style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <Button variant="primary" onClick={startExperience}>
                  내 기록으로 30초 체험하기
                </Button>
                <Button variant="secondary" onClick={useExample}>
                  예시 기록으로 보기
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Section
          id="sayu-result"
          icon={<Sparkles size={20} />}
          title="당신의 한 줄이 이렇게 정리됩니다"
          body="입력한 문장은 저장하지 않고, 화면 안에서만 SAYU 정리 예시로 보여줍니다."
        >
          <div data-g-grid-2 style={gridStyle(2)}>
            <Card>
              <PanelLabel>짧은 입력</PanelLabel>
              <p style={{ ...largeTextStyle, color: '#4A5A2C' }}>{displayInput}</p>
            </Card>
            <Card>
              <PanelLabel>SAYU가 정리한 기록</PanelLabel>
              <p style={largeTextStyle}>{sayuResult}</p>
            </Card>
          </div>
          <div data-g-grid-3 style={{ ...gridStyle(3), marginTop: 14 }}>
            <Card>
              <PanelLabel>오늘 기록의 의미</PanelLabel>
              <p style={cardTextStyle}>오늘의 기록에는 {activeTab.meaning}</p>
            </Card>
            <Card>
              <PanelLabel>자동 분류 미리보기</PanelLabel>
              <MetaList
                rows={[
                  ['기록 형식', activeTab.category],
                  ['감정 흐름', activeTab.mood],
                  ['반복 가능 주제', activeTab.themes],
                  ['나중에 연결될 기능', '월간 합본, 감정 통계, 가족·추억 비서, 미래보기'],
                ]}
              />
            </Card>
            <Card>
              <PanelLabel>이어 쓰기 질문</PanelLabel>
              <ul style={plainListStyle}>
                <li>오늘 산책하면서 기억에 남은 대화가 있었나요?</li>
                <li>이 시간이 왜 편안하게 느껴졌나요?</li>
                <li>내일도 이어가고 싶은 작은 습관이 있나요?</li>
              </ul>
            </Card>
          </div>
        </Section>

        <Section
          id="flow"
          icon={<Layers3 size={20} />}
          title="이 한 줄은 여기서 끝나지 않습니다"
          body="한 줄 기록은 SAYU 정리에서 멈추지 않고, 합본·통계·미래보기·비서 연결로 이어질 수 있는 자료가 됩니다."
        >
          <div data-g-grid-5 style={gridStyle(5)}>
            {flowCards.map((card, index) => (
              <Card key={card.title}>
                <span style={stepNumberStyle}>0{index + 1}</span>
                <h3 style={cardTitleStyle}>{card.title}</h3>
                <p style={cardTextStyle}>{card.body}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          id="record-tabs"
          icon={<PenLine size={20} />}
          title="어떤 기록이든 한 줄에서 시작할 수 있습니다"
          body="기록형식을 바꿔보면 같은 한 줄 기록이 합본, 통계, 미래보기, 관련 비서 연결로 어떻게 이어지는지 볼 수 있습니다."
        >
          <div data-g-format-list style={tabListStyle}>
            {experienceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="g-tab"
                onClick={() => setActiveType(tab.id)}
                style={tabButtonStyle(tab.id === activeType)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div data-g-grid-2 style={{ ...gridStyle(2), marginTop: 16 }}>
            <Card>
              <PanelLabel>짧은 입력</PanelLabel>
              <p style={{ ...largeTextStyle, color: '#4A5A2C' }}>{activeTab.short}</p>
            </Card>
            <Card>
              <PanelLabel>SAYU가 정리한 기록</PanelLabel>
              <p style={largeTextStyle}>{activeTab.refined}</p>
            </Card>
          </div>
          <div data-g-grid-3 style={{ ...gridStyle(3), marginTop: 14 }}>
            <MiniPanel title="이어지는 활용" items={activeTab.useCases} />
            <MiniPanel title="합본 예시" items={[activeTab.merge]} />
            <MiniPanel title="통계 예시" items={activeTab.stats} />
          </div>
          <div data-g-grid-2 style={{ ...gridStyle(2), marginTop: 14 }}>
            <Card>
              <PanelLabel>미래보기 예시</PanelLabel>
              <p style={cardTextStyle}>{activeTab.future}</p>
            </Card>
            <Card>
              <PanelLabel>관련 비서 연결 예시</PanelLabel>
              <p style={cardTextStyle}>{activeTab.assistants}</p>
            </Card>
          </div>
        </Section>

        <Section
          id="four-weeks"
          icon={<Clock3 size={20} />}
          title="4주 동안 한 줄씩 쓰면 이렇게 바뀝니다"
          body="매일 길게 쓰지 않아도 됩니다. 평일에 한 줄씩만 남겨도 한 달 뒤에는 약 20개의 생활 기록이 쌓입니다."
        >
          <p style={{ ...cardTextStyle, fontSize: 15, marginBottom: 16 }}>
            HARU2026은 이 기록을 월간 생활문서, 감정 흐름, 반복 주제,
            미래보기 자료, 비서 활용 자료로 바꿔줍니다.
          </p>
          <div data-g-actions style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {weekSimulations.map((week) => (
              <button
                key={week.id}
                type="button"
                className="g-tab"
                onClick={() => setActiveWeek(week.id)}
                style={pillButtonStyle(week.id === activeWeek)}
              >
                {week.label}
              </button>
            ))}
          </div>
          <div data-g-grid-2 style={{ ...gridStyle(2), marginTop: 16 }}>
            <Card>
              <PanelLabel>{activeWeekData.label} 기록 예시</PanelLabel>
              <ul style={plainListStyle}>
                {activeWeekData.records.map((record) => (
                  <li key={record}>{record}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <PanelLabel>HARU2026이 보는 흐름</PanelLabel>
              <p style={largeTextStyle}>{activeWeekData.insight}</p>
            </Card>
          </div>
        </Section>

        <Section
          id="twenty-records"
          icon={<FileText size={20} />}
          title="20개의 한 줄이 한 달의 자료가 됩니다"
          body="각 항목은 짧은 입력과 SAYU 정리를 함께 보여줍니다."
        >
          <div data-g-grid-2 style={gridStyle(2)}>
            {diaryRecords.map((record) => (
              <Card key={record.index}>
                <PanelLabel>{String(record.index).padStart(2, '0')}</PanelLabel>
                <p style={{ ...cardTextStyle, color: '#4A5A2C', fontWeight: 800 }}>
                  짧은 입력: {record.short}
                </p>
                <p style={cardTextStyle}>SAYU 정리: {record.refined}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          id="monthly-document"
          icon={<FileText size={20} />}
          title="20개의 기록이 하나의 월간 생활문서가 됩니다"
          body="한 달 동안 남긴 짧은 기록은 다시 읽을 수 있는 생활문서 형태로 모입니다."
        >
          <Card style={{ padding: 24 }}>
            <div style={documentHeaderStyle}>
              <div>
                <PanelLabel>월간 합본 문서 미리보기</PanelLabel>
                <h3 style={{ ...cardTitleStyle, fontSize: 24 }}>나의 6월 생활기록</h3>
              </div>
              <FileText size={34} color="#7A8B4E" />
            </div>
            {monthlyDocument.map((paragraph) => (
              <p key={paragraph} style={{ ...largeTextStyle, marginTop: 14 }}>
                {paragraph}
              </p>
            ))}
            <div data-g-actions style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
              <Button variant="secondary" onClick={goLogin}>
                내 기록도 이렇게 모아보기
              </Button>
              <Button variant="primary" onClick={goLogin}>
                무료로 시작하기
              </Button>
            </div>
          </Card>
        </Section>

        <Section
          id="stats"
          icon={<BarChart3 size={20} />}
          title="20개의 기록을 통계로 보면 흐름이 보입니다"
          body="기록은 문장으로도 남지만, 숫자로 보면 생활의 흐름이 더 선명해집니다."
        >
          <div data-g-stat-summary style={statSummaryStyle}>
            {[
              ['총 기록 수', '20개'],
              ['기록 기간', '4주'],
              ['기록한 요일', '월~금 중심'],
              ['자주 나온 주제', '건강, 가족, 운동, 텃밭, 사유'],
            ].map(([label, value]) => (
              <Card key={label}>
                <PanelLabel>{label}</PanelLabel>
                <p style={{ ...cardTitleStyle, marginBottom: 0 }}>{value}</p>
              </Card>
            ))}
          </div>
          <div data-g-grid-2 style={{ ...gridStyle(2), marginTop: 14 }}>
            <BarPanel title="주제별 빈도" rows={topicStats} max={6} />
            <BarPanel title="감정 흐름" rows={moodStats} max={100} />
          </div>
          <Card style={{ marginTop: 14 }}>
            <PanelLabel>반복 단어</PanelLabel>
            <TagRow tags={repeatWords} />
          </Card>
          <Card style={{ marginTop: 14 }}>
            <PanelLabel>문장형 해석</PanelLabel>
            <p style={largeTextStyle}>
              이번 달 기록에서는 건강관리와 가족 시간이 가장 자주 나타났습니다.
              피곤함도 있었지만, 산책과 대화, 감사 기록이 함께 남아 정서적으로
              균형을 잡아가는 흐름이 보입니다.
            </p>
          </Card>
        </Section>

        <Section
          id="future"
          icon={<LineChart size={20} />}
          title="미래를 맞히는 것이 아니라, 생활 방향을 살펴봅니다"
          body="미래보기는 지금까지의 기록을 바탕으로 생활 습관, 감정 흐름, 관심 주제, 실천 방향을 살펴보는 기능입니다."
        >
          <Notice>
            미래보기는 예언, 진단, 투자 예측, 질병 예측이 아닙니다. 건강 관련
            내용은 의료 판단이 아니라 생활 흐름 참고로만 봅니다.
          </Notice>
          <div data-g-actions style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {futureTabs.map((future) => (
              <button
                key={future.id}
                type="button"
                className="g-tab"
                onClick={() => setActiveFuture(future.id)}
                style={pillButtonStyle(future.id === activeFuture)}
              >
                {future.label}
              </button>
            ))}
          </div>
          <Card style={{ marginTop: 14 }}>
            <PanelLabel>{activeFutureData.label}</PanelLabel>
            <p style={largeTextStyle}>{activeFutureData.body}</p>
          </Card>
        </Section>

        <Section
          id="assistants"
          icon={<Brain size={20} />}
          title="내 기록은 필요한 비서가 다시 꺼내 쓸 수 있습니다"
          body="HARU2026의 기록은 저장에서 끝나지 않습니다. 기록 안에 담긴 건강, 가족, 식물, 독서, 사진, 생활습관 같은 내용은 관련 비서가 다시 활용할 수 있는 자료가 됩니다."
        >
          <Notice>
            현재 모든 비서가 모든 기록을 완전 자동으로 가져가는 것은 아닙니다.
            일부 비서는 기록을 직접 활용하고, 일부는 사용자가 선택해 이어서 사용할 수
            있으며, 일부 연결은 앞으로 확장될 예정입니다.
          </Notice>
          <div data-g-grid-4 style={{ ...gridStyle(4), marginTop: 14 }}>
            {primaryAssistants.map((assistant) => (
              <AssistantCardView key={assistant.name} assistant={assistant} />
            ))}
          </div>
          <details style={detailsStyle}>
            <summary style={summaryStyle}>추가 비서 더보기</summary>
            <div data-g-grid-4 style={{ ...gridStyle(4), marginTop: 14 }}>
              {extraAssistants.map((assistant) => (
                <AssistantCardView key={assistant.name} assistant={assistant} />
              ))}
            </div>
          </details>
        </Section>

        <Section
          id="glossary"
          icon={<BookOpen size={20} />}
          title="처음 보는 말도 쉽게 이해할 수 있습니다"
          body="체험과 가치 흐름을 본 뒤, HARU2026에서 자주 쓰는 말을 쉽게 정리했습니다."
        >
          <div data-g-grid-3 style={gridStyle(3)}>
            {glossary.map(([term, description]) => (
              <Card key={term}>
                <h3 style={cardTitleStyle}>{term}</h3>
                <p style={cardTextStyle}>= {description}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          id="connection-levels"
          icon={<CheckCircle2 size={20} />}
          title="현재 연결 수준은 정직하게 구분합니다"
          body="하단에서 지금 가능한 연결과 앞으로 확장될 연결을 분명하게 나눕니다."
        >
          <div data-g-grid-4 style={gridStyle(4)}>
            {(Object.keys(connectionDescriptions) as LinkLevel[]).map((level) => (
              <Card key={level}>
                <LevelBadge level={level} />
                <p style={{ ...cardTextStyle, marginTop: 12 }}>
                  {connectionDescriptions[level]}
                </p>
              </Card>
            ))}
          </div>
          <Notice>
            현재 모든 기능이 완전 자동으로 연결되는 것은 아닙니다. 일부 기록은
            비서가 직접 활용하고, 일부 기능은 사용자가 선택해서 이어서 사용할 수
            있으며, 일부 연결은 앞으로 확장될 예정입니다.
          </Notice>
        </Section>

        <Section
          id="subscribe"
          icon={<Sparkles size={20} />}
          title="무료로 시작하고 필요한 만큼 확장하세요"
          body="HARU2026은 하루 한 줄을 쌓아 나의 생활문서, 감정 흐름, 반복 주제, 미래보기 자료로 바꿔줍니다."
        >
          <p style={{ ...largeTextStyle, maxWidth: 760 }}>
            처음에는 길게 쓰지 않아도 됩니다. 한 줄만 남겨도 한 달 뒤에는 다시
            꺼내볼 수 있는 삶의 자료가 됩니다.
          </p>
          <div data-g-grid-2 style={{ ...gridStyle(2), marginTop: 16 }}>
            <PriceCard
              name="베이직"
              price="₩4,000 / 월"
              points={[
                '하루 기록을 가볍게 시작하고 싶은 분',
                'EPUB 저장과 하루LAW 첨부파일을 쓰고 싶은 분',
                '더 넉넉한 기존 사용 한도가 필요한 분',
              ]}
              button="베이직 구독하기"
              featured
              onClick={goLogin}
            />
            <PriceCard
              name="프리미엄"
              price="₩6,000 예정 / 월"
              points={[
                '장기 범위 합본과 통계를 기다리는 분',
                '건강, 가족, 텃밭, 독서 등 여러 기록을 관리하고 싶은 분',
                '프리미엄 공개 후 확장 기능을 확인할 분',
              ]}
              button="준비 중"
              featured={false}
              disabled
              onClick={() => undefined}
            />
          </div>
        </Section>

        <section style={finalCtaStyle}>
          <h2 style={finalTitleStyle}>한 줄 기록이 쌓이면, 다시 꺼내 쓸 수 있는 삶의 자료가 됩니다.</h2>
          <p style={finalTextStyle}>
            오늘의 한 줄은 작지만, 한 달 뒤에는 생활문서가 되고, 1년 뒤에는
            나의 흐름이 되고, 오래 쌓이면 가족과 나에게 남는 삶의 자료가 됩니다.
          </p>
          <div data-g-actions style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <Button variant="light" onClick={() => scrollTo('sayu-result')}>
              지금 한 줄부터 시작하기
            </Button>
            <Button variant="outlineLight" onClick={goLogin}>
              무료로 시작하기
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function FlowStrip() {
  const steps = ['한 줄 기록', 'SAYU 정리', '20개 기록', '월간 합본', '통계', '미래보기', '비서 활용'];

  return (
    <div style={flowStripStyle}>
      {steps.map((step, index) => (
        <div key={step} style={flowItemStyle}>
          <span>{step}</span>
          {index < steps.length - 1 && <ArrowRight size={14} color="#A46A42" />}
        </div>
      ))}
    </div>
  );
}

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
    <section id={id} style={{ marginTop: 34, scrollMarginTop: 24 }}>
      <div style={{ maxWidth: 850, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4A5A2C' }}>
          <span style={sectionIconStyle}>{icon}</span>
          <h2 data-g-section-title style={sectionTitleStyle}>
            {title}
          </h2>
        </div>
        <p style={sectionBodyStyle}>{body}</p>
      </div>
      {children}
    </section>
  );
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <article className="g-card" style={{ ...cardStyle, ...style }}>
      {children}
    </article>
  );
}

function MiniPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <PanelLabel>{title}</PanelLabel>
      <ul style={plainListStyle}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}

function BarPanel({ title, rows, max }: { title: string; rows: StatRow[]; max: number }) {
  return (
    <Card>
      <h3 style={cardTitleStyle}>{title}</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((row) => (
          <div key={row.label}>
            <div style={barLabelStyle}>
              <span>{row.label}</span>
              <span>
                {row.value}
                {row.suffix}
              </span>
            </div>
            <div style={barTrackStyle}>
              <span
                style={{
                  ...barFillStyle,
                  width: `${Math.max(8, Math.round((row.value / max) * 100))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AssistantCardView({ assistant }: { assistant: AssistantCard }) {
  return (
    <Card>
      <LevelBadge level={assistant.level} />
      <h3 style={{ ...cardTitleStyle, marginTop: 12 }}>{assistant.name}</h3>
      <PanelLabel>연결되는 기록</PanelLabel>
      <p style={cardTextStyle}>{assistant.records}</p>
      <PanelLabel>도와주는 일</PanelLabel>
      <p style={cardTextStyle}>{assistant.help}</p>
    </Card>
  );
}

function PriceCard({
  name,
  price,
  points,
  button,
  featured,
  onClick,
  disabled = false,
}: {
  name: string;
  price: string;
  points: string[];
  button: string;
  featured: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      style={{
        borderColor: featured ? '#7A8B4E' : '#E5DFD0',
        boxShadow: featured ? '0 20px 44px -34px rgba(74,90,44,0.56)' : undefined,
      }}
    >
      <PanelLabel>{disabled ? '준비 중' : featured ? '추천 플랜' : '가벼운 시작'}</PanelLabel>
      <h3 style={{ ...cardTitleStyle, fontFamily: FONT_EN, fontSize: 22 }}>{name}</h3>
      <p style={{ ...cardTitleStyle, color: '#4A5A2C', fontSize: 28 }}>{price}</p>
      <PanelLabel>추천 대상</PanelLabel>
      <ul style={plainListStyle}>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <Button variant={featured ? 'primary' : 'secondary'} onClick={onClick} disabled={disabled}>
        {button}
      </Button>
    </Card>
  );
}

function Button({
  variant,
  onClick,
  children,
  disabled = false,
}: {
  variant: 'primary' | 'secondary' | 'light' | 'outlineLight';
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const styleByVariant: Record<typeof variant, CSSProperties> = {
    primary: {
      background: '#4A5A2C',
      borderColor: '#4A5A2C',
      color: '#FFFFFF',
    },
    secondary: {
      background: '#FFFFFF',
      borderColor: '#E5DFD0',
      color: '#4A5A2C',
    },
    light: {
      background: '#FFFFFF',
      borderColor: '#FFFFFF',
      color: '#4A5A2C',
    },
    outlineLight: {
      background: 'transparent',
      borderColor: 'rgba(255,255,255,0.48)',
      color: '#FFFFFF',
    },
  };

  return (
    <button
      type="button"
      className="g-page-button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...buttonBaseStyle,
        ...styleByVariant[variant],
        ...(disabled ? { opacity: 0.55, cursor: 'default' } : {}),
      }}
    >
      {children}
    </button>
  );
}

function Badge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span style={badgeStyle}>
      {icon}
      {children}
    </span>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return <div style={panelLabelStyle}>{children}</div>;
}

function MetaList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl style={{ display: 'grid', gap: 9, margin: 0 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={metaRowStyle}>
          <dt style={metaLabelStyle}>{label}</dt>
          <dd style={metaValueStyle}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {tags.map((tag) => (
        <span key={tag} style={tagStyle}>
          {tag}
        </span>
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

function Notice({ children }: { children: ReactNode }) {
  return <div style={noticeStyle}>{children}</div>;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function gridStyle(columns: number): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: 14,
  };
}

function tabButtonStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? '#7A8B4E' : '#E5DFD0'}`,
    background: active ? '#E0E8B8' : '#FFFFFF',
    color: active ? '#4A5A2C' : '#5F5D55',
    borderRadius: 14,
    padding: '11px 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'border-color 160ms, color 160ms, background 160ms',
  };
}

function pillButtonStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? '#7A8B4E' : '#E5DFD0'}`,
    background: active ? '#4A5A2C' : '#FFFFFF',
    color: active ? '#FFFFFF' : '#4A5A2C',
    borderRadius: 999,
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  };
}

const heroStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5DFD0',
  borderRadius: 24,
  padding: '38px 40px',
  boxShadow: '0 22px 46px -38px rgba(74,90,44,0.56)',
};

const heroTitleStyle: CSSProperties = {
  fontFamily: FONT_SERIF,
  fontSize: 43,
  lineHeight: 1.14,
  color: '#4A5A2C',
  margin: '18px 0 14px',
  letterSpacing: 0,
};

const heroTextStyle: CSSProperties = {
  color: '#5F5D55',
  fontSize: 15,
  lineHeight: 1.82,
  margin: 0,
  maxWidth: 700,
};

const heroInputPanelStyle: CSSProperties = {
  background: '#F8F5ED',
  border: '1px solid #E5DFD0',
  borderRadius: 20,
  padding: 18,
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 114,
  resize: 'vertical',
  border: '1px solid #D4CDB9',
  borderRadius: 16,
  padding: 14,
  color: '#2C2C2A',
  background: '#FFFFFF',
  fontFamily: FONT_KR,
  fontSize: 15,
  lineHeight: 1.6,
  boxSizing: 'border-box',
};

const formatListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
  marginTop: 14,
};

const tabListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 8,
};

const flowStripStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 24,
};

const flowItemStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #E5DFD0',
  background: '#F8F5ED',
  color: '#4A5A2C',
  borderRadius: 999,
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 800,
};

const badgeStyle: CSSProperties = {
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
};

const sectionIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#E0E8B8',
  flexShrink: 0,
};

const sectionTitleStyle: CSSProperties = {
  fontFamily: FONT_SERIF,
  fontSize: 27,
  lineHeight: 1.3,
  color: '#2C2C2A',
  margin: 0,
  letterSpacing: 0,
};

const sectionBodyStyle: CSSProperties = {
  color: '#5F5D55',
  lineHeight: 1.8,
  margin: '12px 0 0',
};

const cardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5DFD0',
  borderRadius: 18,
  padding: 18,
  transition: 'transform 180ms cubic-bezier(0.22,0.61,0.36,1), box-shadow 180ms',
};

const cardTitleStyle: CSSProperties = {
  fontFamily: FONT_SERIF,
  color: '#2C2C2A',
  fontSize: 18,
  lineHeight: 1.35,
  margin: '0 0 8px',
  letterSpacing: 0,
};

const cardTextStyle: CSSProperties = {
  color: '#5F5D55',
  fontSize: 13,
  lineHeight: 1.7,
  margin: '0 0 10px',
};

const largeTextStyle: CSSProperties = {
  color: '#4C4A43',
  fontSize: 15,
  lineHeight: 1.8,
  margin: 0,
};

const panelLabelStyle: CSSProperties = {
  color: '#B85C2E',
  fontFamily: FONT_EN,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  marginBottom: 8,
};

const buttonBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid',
  borderRadius: 999,
  padding: '11px 15px',
  fontFamily: FONT_KR,
  fontWeight: 800,
  cursor: 'pointer',
  transition: 'transform 160ms, box-shadow 180ms',
};

const plainListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 8,
  color: '#4C4A43',
  fontSize: 13,
  lineHeight: 1.65,
};

const stepNumberStyle: CSSProperties = {
  color: '#B85C2E',
  fontFamily: FONT_EN,
  fontSize: 12,
  fontWeight: 900,
};

const metaRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '118px minmax(0, 1fr)',
  gap: 10,
};

const metaLabelStyle: CSSProperties = {
  color: '#7A6F5A',
  fontSize: 12,
  fontWeight: 800,
};

const metaValueStyle: CSSProperties = {
  color: '#2C2C2A',
  fontSize: 13,
  margin: 0,
  lineHeight: 1.6,
};

const documentHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  borderBottom: '1px solid #E5DFD0',
  paddingBottom: 14,
  marginBottom: 4,
};

const statSummaryStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 14,
};

const barLabelStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  color: '#4C4A43',
  fontSize: 13,
  fontWeight: 800,
};

const barTrackStyle: CSSProperties = {
  height: 10,
  background: '#F5F0E8',
  borderRadius: 999,
  overflow: 'hidden',
  marginTop: 5,
};

const barFillStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  background: 'linear-gradient(90deg, #7A8B4E 0%, #D4DEA0 100%)',
  borderRadius: 999,
};

const tagStyle: CSSProperties = {
  background: '#F8F5ED',
  border: '1px solid #E5DFD0',
  color: '#7A6F5A',
  borderRadius: 999,
  padding: '5px 9px',
  fontSize: 12,
  fontWeight: 800,
};

const noticeStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5DFD0',
  borderRadius: 18,
  padding: 18,
  color: '#4C4A43',
  lineHeight: 1.75,
};

const detailsStyle: CSSProperties = {
  marginTop: 16,
  background: '#FFFFFF',
  border: '1px solid #E5DFD0',
  borderRadius: 18,
  padding: 18,
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  color: '#4A5A2C',
  fontWeight: 900,
};

const finalCtaStyle: CSSProperties = {
  marginTop: 34,
  background: '#4A5A2C',
  color: '#FFFFFF',
  borderRadius: 24,
  padding: '30px 28px',
};

const finalTitleStyle: CSSProperties = {
  fontFamily: FONT_SERIF,
  fontSize: 28,
  lineHeight: 1.35,
  margin: 0,
  letterSpacing: 0,
};

const finalTextStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.8)',
  fontSize: 15,
  lineHeight: 1.8,
  margin: '12px 0 0',
  maxWidth: 780,
};

export default GyeongdaePreviewPage;
