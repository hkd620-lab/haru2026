// ==============================
// HARU Record Type System Final
// ==============================

// ---------- 공통 기본 타입 ----------

export type HaruCategory = 'daily' | 'report' | 'observation';

export type HaruFormat =
  | 'diary'
  | 'essay'
  | 'mission-report'
  | 'general-report'
  | 'work-log'
  | 'travel-record'
  | 'garden-log'
  | 'pet-log'
  | 'growth-diary';

// 한글 형식명 (기존 시스템과 호환)
export type RecordFormatKorean = 
  | '일기' 
  | '에세이' 
  | '선교보고' 
  | '일반보고' 
  | '업무일지' 
  | '여행기록' 
  | '텃밭일지' 
  | '애완동물관찰일지' 
  | '육아일기';

// 한글 <-> 영문 매핑
export const FORMAT_MAP: Record<RecordFormatKorean, HaruFormat> = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission-report',
  '일반보고': 'general-report',
  '업무일지': 'work-log',
  '여행기록': 'travel-record',
  '텃밭일지': 'garden-log',
  '애완동물관찰일지': 'pet-log',
  '육아일기': 'growth-diary',
};

// 영문 -> 한글 역매핑
export const FORMAT_MAP_REVERSE: Record<HaruFormat, RecordFormatKorean> = {
  'diary': '일기',
  'essay': '에세이',
  'mission-report': '선교보고',
  'general-report': '일반보고',
  'work-log': '업무일지',
  'travel-record': '여행기록',
  'garden-log': '텃밭일지',
  'pet-log': '애완동물관찰일지',
  'growth-diary': '육아일기',
};

export type StatScore = 1 | 2 | 3 | 4 | 5;

export interface HaruMeta {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  category: HaruCategory;
  format: HaruFormat;
  title: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// ---------- 공통 Stats ----------

export interface BaseStats {
  positivity_ratio: StatScore;
}

// ---------- 일기 ----------

export interface DiaryFields {
  scene: string;
  mood: string;
  event: string;
  reflection: string;
  tomorrow: string;
}

export interface DiaryStats extends BaseStats {
  emotional_flow: StatScore;       // 감정 흐름 (좋았던 일 -> 갈등 -> 배움의 연결성)
  self_awareness: StatScore;        // 자기인식 (성찰과 배움의 깊이)
  daily_stability: StatScore;       // 일상 안정성 (여백/내일 계획의 규칙성)
}

export interface DiaryRecord {
  meta: HaruMeta & {
    category: 'daily';
    format: 'diary';
  };
  fields: DiaryFields;
  stats: DiaryStats;
}

// ---------- 에세이 ----------

export interface EssayFields {
  theme: string[]; // 1~2
  emotionPrimary: string;
  emotionSecondary: string[]; // 0~2
  people: string[]; // 0~3
  actions: string[]; // 1~3
  lesson: string;
  lifeArea: string;
  tone: string;
}

export interface EssayStats extends BaseStats {
  theme_frequency: StatScore;      // 주제 다양성
  emotional_depth: StatScore;      // 감정 표현의 깊이
  reflection_depth: StatScore;     // 성찰의 깊이
}

export interface EssayRecord {
  meta: HaruMeta & {
    category: 'daily';
    format: 'essay';
  };
  fields: EssayFields;
  stats: EssayStats;
}

// ---------- 선교보고 ----------

export interface MissionReportFields {
  mission_place: string;
  mission_action: string[];
  mission_grace: string[];
  mission_heart: string[];
  mission_prayer: string[];
}

export interface MissionReportStats extends BaseStats {
  grace_awareness: StatScore;      // 은혜 인식 (Grace 필드 작성 빈도)
  spiritual_growth: StatScore;     // 영적 성장 (Heart 필드의 깊이)
  service_impact: StatScore;       // 섬김 영향력 (Action 필드의 구체성)
}

export interface MissionReportRecord {
  meta: HaruMeta & {
    category: 'report';
    format: 'mission-report';
  };
  fields: MissionReportFields;
  stats: MissionReportStats;
}

// ---------- 일반보고 ----------

export interface GeneralReportFields {
  report_activity: string;
  report_progress: string;
  report_achievement: string;
  report_notes: string;
  report_future: string;
}

export interface GeneralReportStats extends BaseStats {
  completion_rate: StatScore;      // 완성도 (모든 필드 작성 비율)
  issue_awareness: StatScore;      // 문제 인식 (특이사항 기록률)
  planning_quality: StatScore;     // 계획 품질 (향후 계획 구체성)
}

export interface GeneralReportRecord {
  meta: HaruMeta & {
    category: 'report';
    format: 'general-report';
  };
  fields: GeneralReportFields;
  stats: GeneralReportStats;
}

// ---------- 업무일지 ----------

// 자유도를 남기되 너무 풀어놓지 않기 위한 기본 구조
export interface WorkMetric {
  meetings?: number;
  calls?: number;
  documents_created?: number;
  documents_updated?: number;
  items_completed?: number;
  items_total?: number;
  hours_worked?: number;
  visits?: number;
  tests_run?: number;
  issues_fixed?: number;

  // 필요 시 확장 가능
  [key: string]: string | number | undefined;
}

export interface WorkLogFields {
  work_schedule: string[];
  work_result: string[];
  work_pending: string[];
  work_metric: WorkMetric;
  work_rating: string;
}

export interface WorkLogStats extends BaseStats {
  task_completion: StatScore;      // 업무 완성도 (Result 작성률)
  productivity_score: StatScore;   // 생산성 점수 (Rating 평균)
  self_evaluation: StatScore;      // 자기 평가 일관성
}

export interface WorkLogRecord {
  meta: HaruMeta & {
    category: 'report';
    format: 'work-log';
  };
  fields: WorkLogFields;
  stats: WorkLogStats;
}

// ---------- 여행기록 ----------

export interface TravelRecordFields {
  travel_journey: string[];
  travel_scenery: string[];
  travel_food: string[];
  travel_thought: string;
  travel_gratitude: string[];
}

export interface TravelRecordStats extends BaseStats {
  experience_richness: StatScore;  // 경험의 풍부함 (모든 필드 작성률)
  gratitude_level: StatScore;      // 감사 수준
  reflection_depth: StatScore;     // 성찰 깊이 (단상의 질)
}

export interface TravelRecord {
  meta: HaruMeta & {
    category: 'daily';
    format: 'travel-record';
  };
  fields: TravelRecordFields;
  stats: TravelRecordStats;
}

// ---------- 텃밭일지 ----------

export interface GardenLogFields {
  garden_crops: string[];
  garden_observation: string[];
  garden_work: string[];
  garden_issue: string[];
  garden_plan: string[];
}

export interface GardenLogStats extends BaseStats {
  crop_diversity: StatScore;       // 작물 다양성
  observation_detail: StatScore;   // 관찰 세밀도
  issue_management: StatScore;     // 문제 대응력
}

export interface GardenLogRecord {
  meta: HaruMeta & {
    category: 'observation';
    format: 'garden-log';
  };
  fields: GardenLogFields;
  stats: GardenLogStats;
}

// ---------- 애완동물 관찰일기 ----------

export interface PetLogFields {
  pet_behavior: string[];
  pet_health: string[];
  pet_play: string[];
  pet_emotion: string[];
  pet_note: string[];
}

export interface PetLogStats extends BaseStats {
  care_attention: StatScore;       // 돌봄 관심도
  emotional_bond: StatScore;       // 정서적 유대감
  health_awareness: StatScore;     // 건강 인식
}

export interface PetLogRecord {
  meta: HaruMeta & {
    category: 'observation';
    format: 'pet-log';
  };
  fields: PetLogFields;
  stats: PetLogStats;
}

// ---------- 육아(성장)일기 ----------

export interface GrowthDiaryFields {
  child_growth: string[];
  child_activity: string[];
  child_emotion: string[];
  child_learning: string[];
  child_plan: string[];
}

export interface GrowthDiaryStats extends BaseStats {
  growth_observation: StatScore;   // 성장 관찰력
  emotional_understanding: StatScore; // 감정 이해도
  learning_support: StatScore;     // 학습 지원도
}

export interface GrowthDiaryRecord {
  meta: HaruMeta & {
    category: 'observation';
    format: 'growth-diary';
  };
  fields: GrowthDiaryFields;
  stats: GrowthDiaryStats;
}

// ---------- 전체 Union ----------

export type HaruRecord =
  | DiaryRecord
  | EssayRecord
  | MissionReportRecord
  | GeneralReportRecord
  | WorkLogRecord
  | TravelRecord
  | GardenLogRecord
  | PetLogRecord
  | GrowthDiaryRecord;

// ---------- 포맷별 매핑 ----------

export interface HaruRecordMap {
  diary: DiaryRecord;
  essay: EssayRecord;
  'mission-report': MissionReportRecord;
  'general-report': GeneralReportRecord;
  'work-log': WorkLogRecord;
  'travel-record': TravelRecord;
  'garden-log': GardenLogRecord;
  'pet-log': PetLogRecord;
  'growth-diary': GrowthDiaryRecord;
}

export type HaruRecordByFormat<F extends HaruFormat> = HaruRecordMap[F];

// ---------- 생성용 입력 타입 ----------

export interface HaruCreateMetaBase {
  userId: string;
  date: string;
  title: string;
}

export interface CreateDiaryRecord {
  meta: HaruCreateMetaBase & {
    category: 'daily';
    format: 'diary';
  };
  fields: DiaryFields;
  stats: DiaryStats;
}

export interface CreateEssayRecord {
  meta: HaruCreateMetaBase & {
    category: 'daily';
    format: 'essay';
  };
  fields: EssayFields;
  stats: EssayStats;
}

export interface CreateMissionReportRecord {
  meta: HaruCreateMetaBase & {
    category: 'report';
    format: 'mission-report';
  };
  fields: MissionReportFields;
  stats: MissionReportStats;
}

export interface CreateGeneralReportRecord {
  meta: HaruCreateMetaBase & {
    category: 'report';
    format: 'general-report';
  };
  fields: GeneralReportFields;
  stats: GeneralReportStats;
}

export interface CreateWorkLogRecord {
  meta: HaruCreateMetaBase & {
    category: 'report';
    format: 'work-log';
  };
  fields: WorkLogFields;
  stats: WorkLogStats;
}

export interface CreateTravelRecord {
  meta: HaruCreateMetaBase & {
    category: 'daily';
    format: 'travel-record';
  };
  fields: TravelRecordFields;
  stats: TravelRecordStats;
}

export interface CreateGardenLogRecord {
  meta: HaruCreateMetaBase & {
    category: 'observation';
    format: 'garden-log';
  };
  fields: GardenLogFields;
  stats: GardenLogStats;
}

export interface CreatePetLogRecord {
  meta: HaruCreateMetaBase & {
    category: 'observation';
    format: 'pet-log';
  };
  fields: PetLogFields;
  stats: PetLogStats;
}

export interface CreateGrowthDiaryRecord {
  meta: HaruCreateMetaBase & {
    category: 'observation';
    format: 'growth-diary';
  };
  fields: GrowthDiaryFields;
  stats: GrowthDiaryStats;
}

export type HaruCreateRecord =
  | CreateDiaryRecord
  | CreateEssayRecord
  | CreateMissionReportRecord
  | CreateGeneralReportRecord
  | CreateWorkLogRecord
  | CreateTravelRecord
  | CreateGardenLogRecord
  | CreatePetLogRecord
  | CreateGrowthDiaryRecord;

// ---------- 유틸 함수용 타입 가드 ----------

export function isDiaryRecord(record: HaruRecord): record is DiaryRecord {
  return record.meta.format === 'diary';
}

export function isEssayRecord(record: HaruRecord): record is EssayRecord {
  return record.meta.format === 'essay';
}

export function isMissionReportRecord(record: HaruRecord): record is MissionReportRecord {
  return record.meta.format === 'mission-report';
}

export function isGeneralReportRecord(record: HaruRecord): record is GeneralReportRecord {
  return record.meta.format === 'general-report';
}

export function isWorkLogRecord(record: HaruRecord): record is WorkLogRecord {
  return record.meta.format === 'work-log';
}

export function isTravelRecord(record: HaruRecord): record is TravelRecord {
  return record.meta.format === 'travel-record';
}

export function isGardenLogRecord(record: HaruRecord): record is GardenLogRecord {
  return record.meta.format === 'garden-log';
}

export function isPetLogRecord(record: HaruRecord): record is PetLogRecord {
  return record.meta.format === 'pet-log';
}

export function isGrowthDiaryRecord(record: HaruRecord): record is GrowthDiaryRecord {
  return record.meta.format === 'growth-diary';
}

// ---------- 통계 점수 변환 헬퍼 함수 ----------

/**
 * 비율(0~1)을 StatScore(1~5)로 변환
 */
export function ratioToStatScore(ratio: number): StatScore {
  if (ratio >= 0.9) return 5;
  if (ratio >= 0.7) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
}

/**
 * StatScore를 텍스트로 변환
 */
export function statScoreToText(score: StatScore): string {
  const texts: Record<StatScore, string> = {
    5: '매우 우수',
    4: '우수',
    3: '보통',
    2: '개선 필요',
    1: '매우 개선 필요',
  };
  return texts[score];
}

/**
 * StatScore를 색상으로 변환
 */
export function statScoreToColor(score: StatScore): string {
  const colors: Record<StatScore, string> = {
    5: '#10b981', // 초록
    4: '#3b82f6', // 파랑
    3: '#f59e0b', // 주황
    2: '#ef4444', // 빨강
    1: '#991b1b', // 어두운 빨강
  };
  return colors[score];
}