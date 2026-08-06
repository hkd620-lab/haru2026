export type ResultChatRiskLevel = 'low' | 'medium' | 'high';
export type ResultChatSafetyMode =
  | 'reflection'
  | 'writing'
  | 'report'
  | 'plant_basic'
  | 'timeline_basic'
  | 'legal_basic'
  | 'medical_basic'
  | 'finance_basic';

export type ExternalDataPolicy =
  | 'record_first'
  | 'conditional_external'
  | 'official_source_first'
  | 'current_data_required';

export type ResultChatConfig = {
  sourceKey: string;
  label: string;
  riskLevel: ResultChatRiskLevel;
  safetyMode: ResultChatSafetyMode;
  externalDataPolicy: ExternalDataPolicy;
  quickQuestions: string[];
  systemGuide: string;
};

export const RESULT_CHAT_CONFIGS: Record<string, ResultChatConfig> = {
  diary_sayu: {
    sourceKey: 'diary_sayu',
    label: '일기',
    riskLevel: 'medium',
    safetyMode: 'reflection',
    externalDataPolicy: 'record_first',
    quickQuestions: ['오늘 감정 흐름은?', '이 기록의 핵심은?', '내일 할 일은?', '반복되는 걱정은?'],
    systemGuide: '사용자의 하루 기록을 바탕으로 감정 흐름과 다음 행동을 차분히 정리한다.',
  },
  essay_sayu: {
    sourceKey: 'essay_sayu',
    label: '에세이',
    riskLevel: 'low',
    safetyMode: 'writing',
    externalDataPolicy: 'record_first',
    quickQuestions: ['주제는 무엇인가?', '핵심 메시지는?', '문장을 더 다듬어줘', '제목을 추천해줘'],
    systemGuide: '글의 주제, 표현, 구조를 원문 의도를 해치지 않는 범위에서 돕는다.',
  },
  mission_sayu: {
    sourceKey: 'mission_sayu',
    label: '선교보고',
    riskLevel: 'medium',
    safetyMode: 'report',
    externalDataPolicy: 'record_first',
    quickQuestions: ['사역 흐름은?', '핵심 감사는?', '후속 확인사항은?', '보고용으로 정리해줘'],
    systemGuide: '선교 현장 기록을 바탕으로 은혜, 사역 흐름, 후속 확인사항을 기록 안에서 정리한다.',
  },
  report_sayu: {
    sourceKey: 'report_sayu',
    label: '일반보고',
    riskLevel: 'low',
    safetyMode: 'report',
    externalDataPolicy: 'record_first',
    quickQuestions: ['진행률은?', '누락된 점은?', '다음 계획은?', '보고서로 요약해줘'],
    systemGuide: '보고 내용의 진행 상황, 성과, 누락 가능성, 다음 계획을 사실 중심으로 정리한다.',
  },
  work_sayu: {
    sourceKey: 'work_sayu',
    label: '업무일지',
    riskLevel: 'medium',
    safetyMode: 'report',
    externalDataPolicy: 'record_first',
    quickQuestions: ['내일 우선순위는?', '미룬 일은?', '리스크는?', '회의 보고로 바꿔줘'],
    systemGuide: '업무 기록을 바탕으로 우선순위, 미결 사항, 리스크를 실무적으로 정리한다.',
  },
  travel_sayu: {
    sourceKey: 'travel_sayu',
    label: '여행기록',
    riskLevel: 'low',
    safetyMode: 'reflection',
    externalDataPolicy: 'conditional_external',
    quickQuestions: ['여행 요약은?', '기억할 장면은?', '좋았던 동선은?', '추억 글로 바꿔줘'],
    systemGuide: '여행 기록의 장면, 감상, 기억할 요소를 정리한다. 운영시간, 날씨, 현재 일정은 외부 최신자료가 필요함을 구분한다.',
  },
  reading_sayu: {
    sourceKey: 'reading_sayu',
    label: '독서사유',
    riskLevel: 'low',
    safetyMode: 'reflection',
    externalDataPolicy: 'record_first',
    quickQuestions: ['핵심 문장은?', '내 삶과 연결점은?', '다음에 읽을 관점은?', '생각 흐름을 요약해줘'],
    systemGuide: '독서 기록에 드러난 생각의 흐름과 삶의 연결점을 원문 중심으로 정리한다.',
  },
  reading_final_sayu: {
    sourceKey: 'reading_final_sayu',
    label: '최종 독서사유',
    riskLevel: 'low',
    safetyMode: 'reflection',
    externalDataPolicy: 'record_first',
    quickQuestions: ['이 책이 남긴 질문은?', '최종 독서평은?', '반복 관심사는?', '삶의 적용은?'],
    systemGuide: '누적 독서사유의 최종 결과를 바탕으로 반복 관심사와 적용점을 정리한다.',
  },
  memo_sayu: {
    sourceKey: 'memo_sayu',
    label: '메모',
    riskLevel: 'low',
    safetyMode: 'report',
    externalDataPolicy: 'record_first',
    quickQuestions: ['할 일로 바꿔줘', '핵심 요약은?', '우선순위는?', '놓친 점은?'],
    systemGuide: '메모를 실행 가능한 항목과 확인할 점으로 간결하게 정리한다.',
  },
  garden_sayu: {
    sourceKey: 'garden_sayu',
    label: '텃밭일지',
    riskLevel: 'medium',
    safetyMode: 'plant_basic',
    externalDataPolicy: 'conditional_external',
    quickQuestions: ['작물 상태는?', '다음 작업은?', '주의할 변화는?', '계절 관리 포인트는?'],
    systemGuide: '텃밭 기록을 바탕으로 관찰된 상태와 다음 관리 행동을 참고용으로 정리한다.',
  },
  pet_sayu: {
    sourceKey: 'pet_sayu',
    label: '애완동물관찰일지',
    riskLevel: 'medium',
    safetyMode: 'medical_basic',
    externalDataPolicy: 'conditional_external',
    quickQuestions: ['관찰 흐름은?', '주의할 변화는?', '병원에 물어볼 점은?', '다음 기록 포인트는?'],
    systemGuide: '반려동물 기록을 바탕으로 관찰 내용을 정리하되 진단, 치료, 약 복용 판단은 하지 않는다.',
  },
  child_sayu: {
    sourceKey: 'child_sayu',
    label: '육아일기',
    riskLevel: 'medium',
    safetyMode: 'medical_basic',
    externalDataPolicy: 'conditional_external',
    quickQuestions: ['오늘 변화는?', '기억할 장면은?', '돌봄 메모는?', '다음 관찰점은?'],
    systemGuide: '아이 기록과 보호자의 관찰을 정리하되 발달, 질병, 치료 판단은 단정하지 않는다.',
  },
  growth_sayu: {
    sourceKey: 'growth_sayu',
    label: '성장기록',
    riskLevel: 'medium',
    safetyMode: 'timeline_basic',
    externalDataPolicy: 'conditional_external',
    quickQuestions: ['변화 흐름은?', '측정 기록 요약은?', '다음 관찰점은?', '상담 때 물어볼 점은?'],
    systemGuide: '성장 측정 기록의 변화 흐름을 설명하되 건강·발달 진단은 하지 않는다.',
  },
  stock_sayu: {
    sourceKey: 'stock_sayu',
    label: 'HARU주식관리',
    riskLevel: 'high',
    safetyMode: 'finance_basic',
    externalDataPolicy: 'current_data_required',
    quickQuestions: ['이 거래 기록을 정리해줘', '내 판단 근거는?', '다음에 점검할 점은?', '매매일지로 요약해줘'],
    systemGuide: '주식 기록을 바탕으로 매매 판단을 정리하되 수익 보장, 매수·매도 단정, 현재 가격·뉴스 추측을 금지한다.',
  },
  ledger_sayu: {
    sourceKey: 'ledger_sayu',
    label: 'HARU보조장부',
    riskLevel: 'medium',
    safetyMode: 'report',
    externalDataPolicy: 'record_first',
    quickQuestions: ['거래 요약은?', '분류 점검은?', '누락 가능성은?', '업무 메모로 정리해줘'],
    systemGuide: '보조장부 기록을 바탕으로 분류, 누락 가능성, 업무 관련 메모를 정리한다. 세무 판단을 확정하지 않는다.',
  },
  household_sayu: {
    sourceKey: 'household_sayu',
    label: 'HARU가계부',
    riskLevel: 'medium',
    safetyMode: 'finance_basic',
    externalDataPolicy: 'record_first',
    quickQuestions: ['지출 흐름은?', '아낄 수 있는 항목은?', '이번 기록의 핵심은?', '다음 점검은?'],
    systemGuide: '가계부 기록을 바탕으로 지출 흐름과 다음 점검 항목을 정리한다. 금융·세무 결정을 단정하지 않는다.',
  },
  plantDetective: {
    sourceKey: 'plantDetective',
    label: '하루식물탐정',
    riskLevel: 'medium',
    safetyMode: 'plant_basic',
    externalDataPolicy: 'conditional_external',
    quickQuestions: ['이 식물 상태는?', '물주기 조언은?', '주의할 신호는?', '다음 관찰점은?'],
    systemGuide: '식물 판독 결과와 사용자 메모를 바탕으로 식물 관리 참고 의견을 제공한다.',
  },
  haruraw_sayu: {
    sourceKey: 'haruraw_sayu',
    label: '하루LAW',
    riskLevel: 'high',
    safetyMode: 'legal_basic',
    externalDataPolicy: 'official_source_first',
    quickQuestions: ['이 조문을 쉽게 풀어줘', '어떤 자료를 챙겨야 하나?', '추가로 확인할 쟁점은?', '어디에 상담하면 되나?'],
    systemGuide: '기록된 질문과 관련 법조문 범위 안에서만 참고 정보를 정리한다. 위법 여부나 승소 가능성을 단정하지 않고, 확인이 필요한 쟁점과 준비할 자료 중심으로 안내하며 전문가 상담 권유를 유지한다.',
  },
  growthTimeline: {
    sourceKey: 'growthTimeline',
    label: 'HARU타임라인',
    riskLevel: 'medium',
    safetyMode: 'timeline_basic',
    externalDataPolicy: 'record_first',
    quickQuestions: ['변화 흐름은?', '사진별 차이는?', '다음 관찰점은?', '요약해줘'],
    systemGuide: '타임라인 결과의 시간 흐름과 관찰 포인트를 기록 안에서만 정리한다.',
  },
};

export function getResultChatConfig(sourceKey: string): ResultChatConfig | null {
  return RESULT_CHAT_CONFIGS[sourceKey] || null;
}

export function getResultChatConfigForFormatKey(formatKey: string, record?: Record<string, unknown>): ResultChatConfig | null {
  if (formatKey === 'growthTimeline') return RESULT_CHAT_CONFIGS.growthTimeline;
  if (formatKey === 'reading' && typeof record?.reading_final_sayu === 'string' && record.reading_final_sayu.trim()) {
    return RESULT_CHAT_CONFIGS.reading_final_sayu;
  }
  return RESULT_CHAT_CONFIGS[`${formatKey}_sayu`] || null;
}
