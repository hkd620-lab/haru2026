/**
 * HARU2026 기록 형식 중앙 정의
 * 
 * 모든 페이지에서 이 파일의 타입과 상수를 사용합니다.
 * Single Source of Truth!
 */

// ===========================================
// 형식 타입 정의
// ===========================================

// 10가지 기록 형식 (+ HARU주식관리, HARUraw, HARU보조장부 보조 형식)
export type RecordFormat =
  | '일기'
  | '에세이'
  | '선교보고'
  | '일반보고'
  | '업무일지'
  | '여행기록'
  | '독서사유'
  | '텃밭일지'
  | '애완동물관찰일지'
  | '육아일기'
  | 'HARU주식관리'
  | '주식거래일지'
  | '메모'
  | '성장타임라인'
  | 'HARUraw'
  | 'HARU보조장부';

// 기존 코드 호환성을 위한 alias
export type RecordFormatKorean = RecordFormat;

// 카테고리
export type Category = '생활' | '업무' | 'AI대화' | 'HARU주식관리' | '나도작가';

// ===========================================
// 형식 상수
// ===========================================

// 카테고리별 형식 분류
export const CATEGORY_FORMATS: Record<Category, RecordFormat[]> = {
  '생활': ['일기', '에세이', '여행기록', '독서사유', '텃밭일지', '애완동물관찰일지', '육아일기'],
  '업무': ['선교보고', '일반보고', '업무일지', '메모', 'HARU보조장부'],
  'AI대화': ['ChatGPT', 'Claude', 'Gemini', '기타'] as any[],
  'HARU주식관리': ['HARU주식관리', '주식거래일지'],
  '나도작가': ['나도작가'] as any[],
};

// 전체 형식 목록 (순서대로)
export const ALL_FORMATS: RecordFormat[] = [
  '일기',
  '에세이',
  '선교보고',
  '일반보고',
  '업무일지',
  '여행기록',
  '독서사유',
  '텃밭일지',
  '애완동물관찰일지',
  '육아일기',
  'HARU주식관리',
  '주식거래일지',
  '메모',
  'HARU보조장부',
  'HARUraw',
];

// 형식별 Firestore prefix 매핑
export const FORMAT_PREFIX: Record<RecordFormat, string> = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission',
  '일반보고': 'report',
  '업무일지': 'work',
  '여행기록': 'travel',
  '독서사유': 'reading',
  '텃밭일지': 'garden',
  '애완동물관찰일지': 'pet',
  '육아일기': 'child',
  'HARU주식관리': 'stock',
  '주식거래일지': 'stock',
  '메모': 'memo',
  '성장타임라인': 'growthTimeline',
  'HARUraw': 'haruraw',
  'HARU보조장부': 'ledger',
};

// prefix에서 형식명 찾기 (역매핑)
export const PREFIX_TO_FORMAT: Record<string, RecordFormat> = {
  'diary': '일기',
  'essay': '에세이',
  'mission': '선교보고',
  'report': '일반보고',
  'work': '업무일지',
  'travel': '여행기록',
  'reading': '독서사유',
  'garden': '텃밭일지',
  'pet': '애완동물관찰일지',
  'child': '육아일기',
  'stock': 'HARU주식관리',
  'memo': '메모',
  'growthTimeline': '성장타임라인',
  'haruraw': 'HARUraw',
  'ledger': 'HARU보조장부',
};

// 형식별 이모지 (선택사항)
export const FORMAT_EMOJI: Record<RecordFormat, string> = {
  '일기': '📔',
  '에세이': '✍️',
  '선교보고': '✝️',
  '일반보고': '📋',
  '업무일지': '💼',
  '여행기록': '✈️',
  '독서사유': '📚',
  '텃밭일지': '🌱',
  '애완동물관찰일지': '🐾',
  '육아일기': '👶',
  'HARU주식관리': '📈',
  '주식거래일지': '📈',
  '메모': '📝',
  '성장타임라인': '🌿',
  'HARUraw': '⚖️',
  'HARU보조장부': '🧾',
};

// ===========================================
// 📚 독서사유 — 책 묶음 메타 유틸
// ===========================================

// 책 제목/저자 normalize — trim + lowercase + 연속 공백 1칸 + NFC. 특수문자 제거는 하지 않음.
export function normalizeBookField(s: string | null | undefined): string {
  return String(s || '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// (normalize(title) + '|' + normalize(author)) → 결정적 hash 16자. djb2 변형.
// 같은 책(title+author)이면 같은 readingBookId. prefix는 reading_ 사용.
export function makeReadingBookId(title: string, author: string): string {
  const t = normalizeBookField(title);
  const a = normalizeBookField(author);
  if (!t && !a) return '';
  const key = `${t}|${a}`;
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = ((h1 << 5) + h1) ^ c;
    h2 = ((h2 << 5) + h2) + c;
    h1 = h1 >>> 0;
    h2 = h2 >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16);
  return `reading_${hex}`;
}

export type ReadingEntryType = 'chapter_note' | 'final_reflection';

// 📚 신규(v2) 표기 — canonical write 기준.
export type ReadingEntryTypeV2 = 'readingNote' | 'finalReflection';
export type ReadingStatus = 'writing' | 'completed';

export const READING_ENTRY_TYPES = {
  NOTE: 'readingNote',
  FINAL: 'finalReflection',
  LEGACY_NOTE: 'chapter_note',
  LEGACY_FINAL: 'final_reflection',
} as const;

export const READING_STATUS = {
  WRITING: 'writing',
  COMPLETED: 'completed',
} as const;

// chapter_note ↔ readingNote, final_reflection ↔ finalReflection 매핑
export function entryTypeOldToNew(t: ReadingEntryType): ReadingEntryTypeV2 {
  return t === READING_ENTRY_TYPES.LEGACY_FINAL ? READING_ENTRY_TYPES.FINAL : READING_ENTRY_TYPES.NOTE;
}

// 📚 독서사유 record 에 inject 할 신/구 메타 필드 묶음 — 모든 reading 저장 경로에서 단일 source.
//   - canonical write: readingId, readingStatus, entryType, bookTitle, author, reading_started_at(선택)
//   - legacy compatibility: readingBookId, readingEntryType, bookTitleNormalized, authorNormalized
// TODO(HARU-v3): legacy compatibility 제거 예정.
// 신규 구조(entryType/readingStatus/readingId) 기준으로 migration 계획.
export function buildReadingMetaCombined(params: {
  bookTitle: string;
  author: string;
  entryType: ReadingEntryType;
  startedAt?: string;
}): Record<string, any> {
  const title = String(params.bookTitle || '').trim();
  const author = String(params.author || '').trim();
  if (!title) return {};
  const id = makeReadingBookId(title, author);
  const entryV2: ReadingEntryTypeV2 = entryTypeOldToNew(params.entryType);
  const status: ReadingStatus = params.entryType === READING_ENTRY_TYPES.LEGACY_FINAL
    ? READING_STATUS.COMPLETED
    : READING_STATUS.WRITING;
  const meta: Record<string, any> = {
    // canonical write(v2 strict)
    readingId: id,
    entryType: entryV2,
    readingStatus: status,
    bookTitle: title,
    author,
    // legacy read compatibility(deprecated 예정)
    readingBookId: id,
    readingEntryType: params.entryType,
    bookTitleNormalized: normalizeBookField(title),
    authorNormalized: normalizeBookField(author),
  };
  if (params.startedAt) meta.reading_started_at = params.startedAt;
  return meta;
}

// ===========================================
// 통계 타입 정의
// ===========================================

// 일기 통계
export interface DiaryStats {
  emotional_flow: number;      // 감정 흐름
  self_awareness: number;       // 자기인식
  daily_stability: number;      // 일상 안정성
}

// 에세이 통계
export interface EssayStats {
  theme_frequency: number;      // 주제 다양성
  emotional_depth: number;      // 감정 깊이
  literary_skill: number;       // 문학적 표현
}

// 선교보고 통계
export interface MissionReportStats {
  grace_awareness: number;      // 은혜 인식
  spiritual_growth: number;     // 영적 성장
  ministry_impact: number;      // 사역 영향력
}

// 일반보고 통계
export interface GeneralReportStats {
  completion_rate: number;      // 완료율
  detail_level: number;         // 상세도
  planning_quality: number;     // 계획 품질
}

// 업무일지 통계
export interface WorkLogStats {
  task_completion: number;      // 업무 완수
  time_management: number;      // 시간 관리
  productivity: number;         // 생산성
}

// 여행기록 통계
export interface TravelRecordStats {
  journey_diversity: number;    // 여정 다양성
  sensory_richness: number;     // 감각적 풍부함
  reflection_depth: number;     // 성찰 깊이
}

// 텃밭일지 통계
export interface GardenLogStats {
  cultivation_care: number;     // 경작 정성
  growth_observation: number;   // 성장 관찰
  ecological_harmony: number;   // 생태 조화
}

// 애완동물관찰일지 통계
export interface PetLogStats {
  observation_detail: number;   // 관찰 세밀함
  behavioral_insight: number;   // 행동 통찰
  bond_expression: number;      // 유대감 표현
}

// 육아일기 통계
export interface GrowthDiaryStats {
  developmental_tracking: number;  // 발달 추적
  parental_reflection: number;     // 양육 성찰
  emotional_connection: number;    // 감정 연결
}

// ===========================================
// 유틸리티 함수
// ===========================================

/**
 * 통계 점수 타입 (1~5점)
 */
export type StatScore = 1 | 2 | 3 | 4 | 5;

/**
 * 비율을 통계 점수(0-100)로 변환
 * @param ratio 0-1 사이의 비율
 * @returns 0-100 사이의 점수
 */
export function ratioToStatScore(ratio: number): number {
  return Math.round(ratio * 100);
}

/**
 * 통계 점수를 텍스트로 변환
 * @param score 1-5 사이의 점수
 * @returns 점수에 해당하는 텍스트
 */
export function statScoreToText(score: StatScore): string {
  const textMap: Record<StatScore, string> = {
    1: '매우 낮음',
    2: '낮음',
    3: '보통',
    4: '높음',
    5: '매우 높음',
  };
  return textMap[score];
}

/**
 * 통계 점수를 색상으로 변환
 * @param score 1-5 사이의 점수
 * @returns 점수에 해당하는 색상 코드
 */
export function statScoreToColor(score: StatScore): string {
  const colorMap: Record<StatScore, string> = {
    1: '#ef4444',  // 빨강 (매우 낮음)
    2: '#f97316',  // 주황 (낮음)
    3: '#eab308',  // 노랑 (보통)
    4: '#84cc16',  // 연두 (높음)
    5: '#10b981',  // 초록 (매우 높음)
  };
  return colorMap[score];
}

// ===========================================
// 🌿 하루식물탐정 v1 — 사용자 입력 기반 식물 자산
// 저장 경로: users/{uid}/plants/{plantId}
// 기존 AI 기반 plants 문서와 같은 컬렉션을 공유하나 스키마는 별도.
// ===========================================
export type PlantAssetSourceType = 'real_photo' | 'book_photo' | 'web_reference';

export interface PlantAsset {
  id: string;

  plantName: string;
  aiGuess: string;
  confidence: number;

  userConfirmed: boolean;

  sourceType: PlantAssetSourceType;

  memo: string;

  imageUrls: string[];

  tags: string[];

  createdAt: string;
  updatedAt: string;
}
