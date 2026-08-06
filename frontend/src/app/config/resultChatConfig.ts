export type ResultChatRiskLevel = 'low' | 'medium' | 'high';
export type ResultChatSafetyMode =
  | 'reflection'
  | 'writing'
  | 'report'
  | 'plant_basic'
  | 'timeline_basic'
  | 'legal_basic';

export type ResultChatConfig = {
  sourceKey: string;
  label: string;
  riskLevel: ResultChatRiskLevel;
  safetyMode: ResultChatSafetyMode;
  quickQuestions: string[];
  systemGuide: string;
};

export const RESULT_CHAT_CONFIGS: Record<string, ResultChatConfig> = {
  diary_sayu: {
    sourceKey: 'diary_sayu',
    label: '일기',
    riskLevel: 'medium',
    safetyMode: 'reflection',
    quickQuestions: ['오늘 감정 흐름은?', '이 기록의 핵심은?', '내일 할 일은?', '반복되는 걱정은?'],
    systemGuide: '사용자의 하루 기록을 바탕으로 감정 흐름과 다음 행동을 차분히 정리한다.',
  },
  essay_sayu: {
    sourceKey: 'essay_sayu',
    label: '에세이',
    riskLevel: 'low',
    safetyMode: 'writing',
    quickQuestions: ['주제는 무엇인가?', '핵심 메시지는?', '문장을 더 다듬어줘', '제목을 추천해줘'],
    systemGuide: '글의 주제, 표현, 구조를 원문 의도를 해치지 않는 범위에서 돕는다.',
  },
  report_sayu: {
    sourceKey: 'report_sayu',
    label: '일반보고',
    riskLevel: 'low',
    safetyMode: 'report',
    quickQuestions: ['진행률은?', '누락된 점은?', '다음 계획은?', '보고서로 요약해줘'],
    systemGuide: '보고 내용의 진행 상황, 성과, 누락 가능성, 다음 계획을 사실 중심으로 정리한다.',
  },
  work_sayu: {
    sourceKey: 'work_sayu',
    label: '업무일지',
    riskLevel: 'medium',
    safetyMode: 'report',
    quickQuestions: ['내일 우선순위는?', '미룬 일은?', '리스크는?', '회의 보고로 바꿔줘'],
    systemGuide: '업무 기록을 바탕으로 우선순위, 미결 사항, 리스크를 실무적으로 정리한다.',
  },
  travel_sayu: {
    sourceKey: 'travel_sayu',
    label: '여행기록',
    riskLevel: 'low',
    safetyMode: 'reflection',
    quickQuestions: ['여행 요약은?', '기억할 장면은?', '다음 코스 아이디어는?', '추억 글로 바꿔줘'],
    systemGuide: '여행 기록의 장면, 감상, 기억할 요소를 기록 안에서만 정리한다.',
  },
  reading_sayu: {
    sourceKey: 'reading_sayu',
    label: '독서사유',
    riskLevel: 'low',
    safetyMode: 'reflection',
    quickQuestions: ['핵심 문장은?', '내 삶과 연결점은?', '다음에 읽을 관점은?', '생각 흐름을 요약해줘'],
    systemGuide: '독서 기록에 드러난 생각의 흐름과 삶의 연결점을 원문 중심으로 정리한다.',
  },
  reading_final_sayu: {
    sourceKey: 'reading_final_sayu',
    label: '최종 독서사유',
    riskLevel: 'low',
    safetyMode: 'reflection',
    quickQuestions: ['이 책이 남긴 질문은?', '최종 독서평은?', '반복 관심사는?', '삶의 적용은?'],
    systemGuide: '누적 독서사유의 최종 결과를 바탕으로 반복 관심사와 적용점을 정리한다.',
  },
  memo_sayu: {
    sourceKey: 'memo_sayu',
    label: '메모',
    riskLevel: 'low',
    safetyMode: 'report',
    quickQuestions: ['할 일로 바꿔줘', '핵심 요약은?', '우선순위는?', '놓친 점은?'],
    systemGuide: '메모를 실행 가능한 항목과 확인할 점으로 간결하게 정리한다.',
  },
  garden_sayu: {
    sourceKey: 'garden_sayu',
    label: '텃밭일지',
    riskLevel: 'medium',
    safetyMode: 'plant_basic',
    quickQuestions: ['작물 상태는?', '다음 작업은?', '주의할 변화는?', '계절 관리 포인트는?'],
    systemGuide: '텃밭 기록을 바탕으로 관찰된 상태와 다음 관리 행동을 참고용으로 정리한다.',
  },
  plantDetective: {
    sourceKey: 'plantDetective',
    label: '하루식물탐정',
    riskLevel: 'medium',
    safetyMode: 'plant_basic',
    quickQuestions: ['이 식물 상태는?', '물주기 조언은?', '주의할 신호는?', '다음 관찰점은?'],
    systemGuide: '식물 판독 결과와 사용자 메모를 바탕으로 식물 관리 참고 의견을 제공한다.',
  },
  haruraw_sayu: {
    sourceKey: 'haruraw_sayu',
    label: '하루LAW',
    riskLevel: 'high',
    safetyMode: 'legal_basic',
    quickQuestions: ['이 조문을 쉽게 풀어줘', '어떤 자료를 챙겨야 하나?', '추가로 확인할 쟁점은?', '어디에 상담하면 되나?'],
    systemGuide: '기록된 질문과 관련 법조문 범위 안에서만 참고 정보를 정리한다. 위법 여부나 승소 가능성을 단정하지 않고, 확인이 필요한 쟁점과 준비할 자료 중심으로 안내하며 전문가 상담 권유를 유지한다.',
  },
  growthTimeline: {
    sourceKey: 'growthTimeline',
    label: 'HARU타임라인',
    riskLevel: 'medium',
    safetyMode: 'timeline_basic',
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
