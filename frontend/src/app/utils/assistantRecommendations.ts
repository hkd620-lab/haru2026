export type AssistantRecommendation = {
  id: string;
  title: string;
  category: 'health' | 'medicine' | 'law' | 'finance' | 'plant' | 'childcare' | 'travel' | 'life';
  description: string;
  matchedKeywords: string[];
  actionLabel: string;
  targetPath?: string;
};

type RecommendationRule = Omit<AssistantRecommendation, 'matchedKeywords'> & {
  keywords: string[];
};

const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    id: 'health',
    title: 'HARU 건강관리 비서',
    category: 'health',
    description: '기록 속 건강 변화, 식단, 운동 내용을 바탕으로 관리 방향을 정리해드립니다.',
    actionLabel: '건강관리 비서와 연결',
    targetPath: '/sayu-health',
    keywords: ['혈당', '당뇨', '혈압', '통증', '허리', '무릎', '수면', '불면', '피로', '운동', '식단', '체중', '건강검진', '소변', '거품뇨'],
  },
  {
    id: 'hospital',
    title: '내 증상 알아보고 병원찾기',
    category: 'health',
    description: '기록 속 증상과 병원 고민을 바탕으로 진료과와 병원 찾기 방향을 확인할 수 있습니다.',
    actionLabel: '병원찾기와 연결',
    targetPath: '/sayu-health/hospital',
    keywords: ['증상', '병원', '진료', '검사', '통증', '어지러움', '두통'],
  },
  {
    id: 'medicine',
    title: 'HARU 약 정보 비서',
    category: 'medicine',
    description: '약 이름을 기준으로 효능과 주의사항을 간단히 확인할 수 있습니다.',
    actionLabel: '약 정보 확인',
    targetPath: '/sayu-health/drug',
    keywords: ['약', '약봉지', '처방', '복용', '부작용', '알약', '정제', '캡슐', '연고', '진통제', '혈압약', '당뇨약'],
  },
  {
    id: 'law',
    title: '하루LAW',
    category: 'law',
    description: '기록 속 법률 고민을 사실관계 중심으로 정리하고 관련 법률 정보를 확인할 수 있습니다.',
    actionLabel: '하루LAW와 연결',
    targetPath: '/lawsuit-practice',
    keywords: ['계약', '소송', '임대차', '권리금', '보증금', '내용증명', '고소', '고발', '합의', '손해배상', '채권', '빌려준 돈', '차용증', '법률', '변호사', '행정사'],
  },
  {
    id: 'finance',
    title: 'HARU 재무 비서',
    category: 'finance',
    description: '기록 속 돈, 지출, 세금, 사업 비용 관련 내용을 정리할 수 있습니다.',
    actionLabel: '재무 비서와 연결',
    targetPath: '/record',
    keywords: ['지출', '수입', '매출', '세금', '카드', '계좌', '국민연금', '건강보험', '사업자', '부가세', '비용', '영수증', '통장', '입금', '출금', '재무', '회계'],
  },
  {
    id: 'plant',
    title: 'HARU 식물탐정',
    category: 'plant',
    description: '기록 속 식물 상태, 병충해, 물주기 고민을 정리하고 관리 방향을 확인할 수 있습니다.',
    actionLabel: '식물탐정과 연결',
    targetPath: '/plant-detective',
    keywords: ['식물', '텃밭', '잎', '벌레', '병충해', '농약', '물주기', '수국', '케일', '고추', '상추', '호박', '난초', '작약', '대추', '감나무', '비파'],
  },
  {
    id: 'childcare',
    title: 'HARU 육아·교육 비서',
    category: 'childcare',
    description: '기록 속 자녀, 교육, 성장, 상담 고민을 정리하는 데 도움을 드립니다.',
    actionLabel: '육아·교육 비서와 연결',
    targetPath: '/record',
    keywords: ['아이', '자녀', '육아', '학교', '학생', '상담', '학습', '공부', '성장', '진로', '선생님', '친구', '교육'],
  },
  {
    id: 'travel',
    title: 'HARU 여행 비서',
    category: 'travel',
    description: '기록 속 여행 일정, 장소, 이동, 준비사항을 정리할 수 있습니다.',
    actionLabel: '여행 비서와 연결',
    targetPath: '/record',
    keywords: ['여행', '숙소', '일정', '교통', '맛집', '관광', '주차', '기차', '비행기', '렌터카', '코스', '제주', '일본', '오사카', '설악산'],
  },
  {
    id: 'life',
    title: 'HARU 생활 비서',
    category: 'life',
    description: '기록 속 생활 고민을 정리하고 다음 행동을 제안해드립니다.',
    actionLabel: '생활 비서와 연결',
    targetPath: '/record',
    keywords: ['걱정', '고민', '불안', '준비', '정리', '계획', '해야 할 일', '문제', '해결', '방법'],
  },
];

export const ASSISTANT_RECOMMENDATION_SAFETY_NOTE =
  'AI 비서는 생활 기록을 바탕으로 정리와 확인을 돕는 기능이며, 의료·법률·재무 전문가의 판단을 대체하지 않습니다.';

export function getAssistantRecommendations(
  text: string,
  formats: string[] = [],
): AssistantRecommendation[] {
  const source = `${text || ''}\n${formats.join('\n')}`.toLowerCase();
  if (!source.trim()) return [];

  return RECOMMENDATION_RULES.map((rule) => {
    const matchedKeywords = rule.keywords.filter((keyword) => source.includes(keyword.toLowerCase()));
    if (matchedKeywords.length === 0) return null;

    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      description: rule.description,
      actionLabel: rule.actionLabel,
      targetPath: rule.targetPath,
      matchedKeywords: Array.from(new Set(matchedKeywords)).slice(0, 5),
    };
  }).filter((item): item is AssistantRecommendation => Boolean(item));
}

export function buildRecommendationTextFromFields(fields: Record<string, unknown>): string {
  return Object.values(fields)
    .filter((value) => typeof value === 'string')
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join('\n\n');
}
