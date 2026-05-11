export interface Infographic {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  categoryColor: string;
  tags: string[];
  relatedSymptoms: string[];
  createdAt: string;
  curator: string;
  imageUrl: string;
  sources: string[];
  emergencyFlag?: boolean;
  warnings?: string[];
}

export const INFOGRAPHICS: Infographic[] = [
  {
    id: 'angina_2026_05_11',
    title: '협심증 완전 가이드',
    subtitle: '시니어가 꼭 알아야 할 5가지',
    category: '심혈관',
    categoryColor: 'red',
    tags: ['협심증', '심장', '흉통', '심근경색', '관상동맥'],
    relatedSymptoms: ['가슴통증', '흉통', '가슴조임', '호흡곤란', '심혈관'],
    createdAt: '2026-05-11',
    curator: 'HARU2026',
    imageUrl: '/infographics/01_angina.png',
    sources: [
      '건강보험심사평가원',
      '국가건강정보포털 (질병관리청)',
      '서울대학교 국민건강지식센터',
    ],
    emergencyFlag: true,
    warnings: [
      '15분 이상 지속되는 극심한 흉통은 응급실 즉시 방문',
      '불안정형 협심증은 심근경색으로 진행 위험 20~50%',
    ],
  },
  {
    id: 'prostate_2026_05_11',
    title: '전립선 비대증 vs 전립선암',
    subtitle: '증상은 비슷해도, 본질은 다릅니다',
    category: '비뇨기',
    categoryColor: 'blue',
    tags: ['전립선', '비대증', '전립선암', '빈뇨', '야간뇨'],
    relatedSymptoms: ['빈뇨', '야간뇨', '배뇨곤란', '소변', '잔뇨감'],
    createdAt: '2026-05-11',
    curator: 'HARU2026',
    imageUrl: '/infographics/02_prostate.png',
    sources: ['대한비뇨의학회', '국가건강정보포털'],
  },
  {
    id: 'diabetes_2026_05_11',
    title: '당뇨병 완전 가이드',
    subtitle: '시니어가 꼭 알아야 할 5가지',
    category: '내분비',
    categoryColor: 'green',
    tags: ['당뇨', '혈당', '인슐린', '합병증', 'HbA1c'],
    relatedSymptoms: ['다음', '다뇨', '다식', '체중감소', '갈증'],
    createdAt: '2026-05-11',
    curator: 'HARU2026',
    imageUrl: '/infographics/03_diabetes.png',
    sources: [
      '대한당뇨병학회 Diabetes Fact Sheet 2024',
      '질병관리청 국민건강영양조사',
      '국가건강정보포털',
    ],
  },
];

export const CATEGORY_COLOR_CLASSES: Record<string, string> = {
  red: 'bg-red-50 text-red-800 border-red-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  green: 'bg-green-50 text-green-800 border-green-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  pink: 'bg-pink-50 text-pink-800 border-pink-200',
  teal: 'bg-teal-50 text-teal-800 border-teal-200',
};
