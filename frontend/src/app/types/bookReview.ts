import type { Timestamp } from 'firebase/firestore';

export type CriterionKey =
  | 'title_clarity'
  | 'core_message'
  | 'structure_flow'
  | 'depth_sufficiency'
  | 'duplication'
  | 'reader_value'
  | 'sensitive_content';

export type CriterionAiStatus = 'passed' | 'needs_revision' | 'uncertain';
export type CriterionConfidence = 'high' | 'medium' | 'low';

export interface CriterionEvidence {
  chapter: number;
  quote: string;
}

export interface CriterionResult {
  key: CriterionKey;
  status: CriterionAiStatus;
  confidence: CriterionConfidence;
  reason: string;
  suggestion: string | null;
  evidence: CriterionEvidence[];
}

export interface ReviewOverride {
  criterionKey: CriterionKey;
  previousAiStatus: CriterionAiStatus;
  userId: string;
  confirmedAt: Timestamp;
  note?: string;
}

export interface PublishReview {
  criteria: CriterionResult[];
  overall: CriterionAiStatus;
  reviewedAt: Timestamp | null;
  model: string;
  promptVersion: string;
  contentHash: string;
  overrides: ReviewOverride[];
}

export type PublishRevisionTargetType = 'bookTitle' | 'chapterBody' | 'chapterOrder';

export interface PublishRevisionChapterOrder {
  chapterId: string;
  order: number;
}

export interface PublishRevisionItem {
  targetType: PublishRevisionTargetType;
  chapterId?: string;
  chapterTitle?: string;
  originalText: string;
  revisedText: string;
  reason: string;
  requiresSourceCheck: boolean;
  chapterOrder?: PublishRevisionChapterOrder[];
}

export interface PublishRevisionResult {
  criterionKey: CriterionKey;
  contentHash: string;
  promptVersion: string;
  revisions: PublishRevisionItem[];
  // 서버(books/{bookId}.publishRevisionSuggestions)에 저장된 보완안에만 존재
  createdAt?: Timestamp;
}

// UI에서 파생되는 표시 상태 — Firestore에는 저장하지 않는다
export type CriterionDisplayStatus =
  | 'not_reviewed'
  | 'reviewing'
  | 'passed'
  | 'needs_revision'
  | 'uncertain'
  | 'user_confirmed';

export const CRITERIA_ORDER: CriterionKey[] = [
  'title_clarity',
  'core_message',
  'structure_flow',
  'depth_sufficiency',
  'duplication',
  'reader_value',
  'sensitive_content',
];

export const CRITERIA_INFO: Record<CriterionKey, { label: string; description: string }> = {
  title_clarity: {
    label: '제목 명확',
    description: '제목이 본문 핵심 주제와 일치하는가, 과장·클릭베이트가 없는가',
  },
  core_message: {
    label: '핵심 메시지 분명',
    description: '전체 챕터를 관통하는 메시지가 1~2문장으로 요약 가능한가',
  },
  structure_flow: {
    label: '목차 흐름 자연',
    description: '챕터 순서가 논리적인가, 급격한 주제 전환이 없는가',
  },
  depth_sufficiency: {
    label: '분량·깊이 충분',
    description: '챕터별 분량이 지나치게 부족하지 않은가, 피상적 나열에 그치지 않는가',
  },
  duplication: {
    label: '중복 낮음',
    description: '챕터 간 반복 사례·문장·논지가 과도하지 않은가',
  },
  reader_value: {
    label: '읽을 가치 있음',
    description: '독자에게 새로운 정보, 관점, 정리 가치를 제공하는가',
  },
  sensitive_content: {
    label: '민감·부적절 위험 낮음',
    description: '명예훼손, 차별, 허위사실, 저작권 침해 소지가 있는 표현이 발견되는가',
  },
};

export const DISPLAY_STATUS_META: Record<
  CriterionDisplayStatus,
  { label: string; bg: string; fg: string }
> = {
  not_reviewed: { label: '검토 안 함', bg: '#f3f4f6', fg: '#6b7280' },
  reviewing: { label: '검토 중', bg: '#e0e7ff', fg: '#4338ca' },
  passed: { label: '통과', bg: '#d1fae5', fg: '#047857' },
  needs_revision: { label: '보완 필요', bg: '#fee2e2', fg: '#b91c1c' },
  uncertain: { label: '판단 보류', bg: '#fef3c7', fg: '#92400e' },
  user_confirmed: { label: '사용자 확인 완료', bg: '#dbeafe', fg: '#1d4ed8' },
};
