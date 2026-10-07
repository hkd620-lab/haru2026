import { buildFormatKeyMap, getFormatRecommendationPriorities, invertFormatKeyMap } from '../records/formatRegistry';

export type AssistantRecommendation = {
  id: string;
  title: string;
  category:
    | 'health'
    | 'hospital'
    | 'medicine'
    | 'law'
    | 'finance'
    | 'plant'
    | 'childcare'
    | 'travel'
    | 'life'
    | 'pet';
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
    category: 'hospital',
    description: '기록 속 증상과 병원 고민을 바탕으로 진료과와 병원 찾기 방향을 확인할 수 있습니다.',
    actionLabel: '병원찾기 비서와 연결',
    targetPath: '/sayu-health/hospital',
    keywords: ['증상', '병원', '진료', '검사', '통증', '어지러움', '두통'],
  },
  {
    id: 'medicine',
    title: 'HARU 약 정보 비서',
    category: 'medicine',
    description: '약 이름을 기준으로 효능과 주의사항을 간단히 확인할 수 있습니다.',
    actionLabel: '약 정보 비서와 연결',
    targetPath: '/sayu-health/drug',
    keywords: ['혈압약', '당뇨약', '약봉지', '약 복용', '처방', '진통제', '알약', '정제', '캡슐', '연고', '부작용'],
  },
  {
    id: 'law',
    title: '하루LAW',
    category: 'law',
    description: '기록 속 법률 고민을 사실관계 중심으로 정리하고 관련 법률 정보를 확인할 수 있습니다.',
    actionLabel: '하루LAW와 연결',
    targetPath: '/legal-assistant',
    keywords: ['계약', '소송', '임대차', '권리금', '보증금', '내용증명', '고소', '고발', '합의', '손해배상', '채권', '빌려준 돈', '차용증', '법률', '변호사', '행정사'],
  },
  {
    id: 'finance',
    title: 'HARU 재무 비서',
    category: 'finance',
    description: '기록 속 돈, 지출, 세금, 사업 비용 관련 내용을 정리할 수 있습니다.',
    actionLabel: '보조장부로 정리',
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
    keywords: [
      '식물',
      '텃밭',
      '수확',
      '파종',
      '심다',
      '심었다',
      '모종',
      '밭',
      '콩',
      '호랑이콩',
      '강낭콩',
      '옥수수',
      '작물',
      '재배',
      '새싹',
      '발아',
      '거름',
      '잎',
      '줄기',
      '벌레',
      '병충해',
      '농약',
      '물주기',
      '수국',
      '케일',
      '고추',
      '상추',
      '호박',
      '난초',
      '작약',
      '대추',
      '감나무',
      '비파',
    ],
  },
  {
    id: 'pet',
    title: 'HARU 반려동물건강돌봄비서',
    category: 'pet',
    description: '기록 속 반려동물의 먹거리 안전, 아픈 징조, 예방접종 내용을 확인하고 기록할 수 있습니다.',
    actionLabel: '반려동물 건강돌봄비서와 연결',
    targetPath: '/pet-health',
    keywords: ['강아지', '고양이', '반려견', '반려묘', '애완동물', '반려동물', '사료', '배변', '산책', '짖음', '구토', '피부', '동물병원', '예방접종'],
  },
  {
    id: 'childcare',
    title: 'HARU 육아·교육 비서',
    category: 'childcare',
    description: '기록 속 자녀, 교육, 성장, 상담 고민을 정리하는 데 도움을 드립니다.',
    actionLabel: '육아일기로 정리',
    targetPath: '/record',
    keywords: ['아이', '자녀', '육아', '학교', '학생', '상담', '학습', '공부', '성장', '진로', '선생님', '친구', '교육'],
  },
  {
    id: 'travel',
    title: 'HARU 여행 비서',
    category: 'travel',
    description: '기록 속 여행 일정, 장소, 이동, 준비사항을 정리할 수 있습니다.',
    actionLabel: '여행기록으로 정리',
    targetPath: '/record',
    keywords: ['여행', '숙소', '일정', '교통', '맛집', '관광', '주차', '기차', '비행기', '렌터카', '코스', '제주', '일본', '오사카', '설악산'],
  },
  {
    id: 'life',
    title: 'HARU 생활 비서',
    category: 'life',
    description: '기록 속 생활 고민을 정리하고 다음 행동을 제안해드립니다.',
    actionLabel: '생활 고민 기록하기',
    targetPath: '/record',
    keywords: ['걱정', '고민', '불안', '준비', '정리', '계획', '해야 할 일', '문제', '해결', '방법'],
  },
];

export const ASSISTANT_RECOMMENDATION_SAFETY_NOTE =
  'AI 비서는 생활 기록을 바탕으로 정리와 확인을 돕는 기능이며, 의료·법률·재무 전문가의 판단을 대체하지 않습니다.';

const KOREAN_PARTICLES = '(?:은|는|이|가|을|를|에|에서|으로|로|도|만|과|와|의)?';

// 형식별 추천 범주 우선순위는 형식 등록부(recommendationPriority)에 있다. 하루LAW 는 형식이 아닌 비서 라벨이라 여기 둔다.
const FORMAT_PRIORITY: Record<string, AssistantRecommendation['category'][]> = {
  ...getFormatRecommendationPriorities(),
  하루LAW: ['law', 'finance', 'life'],
};

// 접두어로 적힌 형식 이름(예: diary)을 형식 이름으로 바꾼다(값은 형식 등록부 역매핑)
const FORMAT_ALIASES: Record<string, string> = invertFormatKeyMap(buildFormatKeyMap([
  '일기', '에세이', '여행기록', '독서사유', '텃밭일지', '애완동물관찰일지', '육아일기',
  '업무일지', '메모', 'HARU보조장부', '선교보고', '일반보고', 'HARUraw',
]));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(source: string, keyword: string): boolean {
  const normalizedKeyword = keyword.toLowerCase();
  if (normalizedKeyword.length === 1) {
    const boundaryPattern = new RegExp(
      `(^|[^가-힣a-z0-9])${escapeRegExp(normalizedKeyword)}${KOREAN_PARTICLES}(?=$|[^가-힣a-z0-9])`,
      'i',
    );
    return boundaryPattern.test(source);
  }

  return source.includes(normalizedKeyword);
}

function getMatchedKeywordWeight(recommendation: AssistantRecommendation): number {
  return recommendation.matchedKeywords.reduce((total, keyword) => total + keyword.length, 0);
}

function normalizeFormat(format: string): string {
  const trimmed = format.trim();
  return FORMAT_ALIASES[trimmed.toLowerCase()] || trimmed;
}

function getPriorityRank(recommendation: AssistantRecommendation, formats: string[]): number {
  const ranks = formats
    .map(normalizeFormat)
    .map((format) => FORMAT_PRIORITY[format])
    .filter((priorities): priorities is AssistantRecommendation['category'][] => Boolean(priorities))
    .map((priorities) => {
      const exactRank = priorities.indexOf(recommendation.category);
      if (exactRank >= 0) return exactRank;

      if (recommendation.category === 'hospital') {
        return priorities.indexOf('health');
      }

      return -1;
    })
    .filter((rank) => rank >= 0);

  return ranks.length > 0 ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
}

export function getAssistantRecommendations(
  text: string,
  formats: string[] = [],
): AssistantRecommendation[] {
  const source = `${text || ''}`.toLowerCase();
  if (!source.trim()) return [];

  return RECOMMENDATION_RULES.map((rule) => {
    const matchedKeywords = rule.keywords.filter((keyword) => matchesKeyword(source, keyword));
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
  })
    .filter((item): item is AssistantRecommendation => Boolean(item))
    .sort((first, second) => {
      const priorityGap = getPriorityRank(first, formats) - getPriorityRank(second, formats);
      if (priorityGap !== 0) return priorityGap;
      const matchedCountGap = second.matchedKeywords.length - first.matchedKeywords.length;
      if (matchedCountGap !== 0) return matchedCountGap;
      const keywordWeightGap = getMatchedKeywordWeight(second) - getMatchedKeywordWeight(first);
      if (keywordWeightGap !== 0) return keywordWeightGap;
      return 0;
    })
    .slice(0, 3);
}

export function buildRecommendationTextFromFields(fields: Record<string, unknown>): string {
  return Object.values(fields)
    .filter((value) => typeof value === 'string')
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join('\n\n');
}
