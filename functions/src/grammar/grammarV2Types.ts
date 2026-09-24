export type BibleVersion = 'kjv' | 'bsb';

export interface GrammarV2Input {
  version: BibleVersion;
  book: string;
  chapter: number;
  verse: number;
}

// 파일럿 전용 옵션. 에뮬레이터(파일럿 모드)에서만 허용되고, 운영에서는 요청에 들어오는
// 순간 캐시 읽기 전에 failed-precondition으로 막힌다.
export const GRAMMAR_V2_PILOT_GENERATION_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
] as const;

export type GrammarV2PilotGenerationModel = typeof GRAMMAR_V2_PILOT_GENERATION_MODELS[number];

// 'gemini' 는 축소 검증과 같은 프롬프트·같은 변경분 출력 형식을 Gemini 로 돌리는 것.
// 'all3' 은 같은 생성 초안 하나에 full·lite·gemini 를 각각 돌려 비교한다.
export type GrammarV2VerifyMode = 'full' | 'lite' | 'both' | 'gemini' | 'all3';

export type GrammarV2VerifyRun = 'full' | 'lite' | 'gemini';

export interface GrammarV2PilotOptions {
  generationModel?: GrammarV2PilotGenerationModel;
  verifyMode?: GrammarV2VerifyMode;
  skipCacheRead?: boolean;
}

export interface GrammarV2Request {
  input: GrammarV2Input;
  pilot: GrammarV2PilotOptions | null;
}

export interface GrammarV2PilotStageMetrics {
  stage: 'generate' | 'verify_full' | 'verify_lite' | 'verify_gemini';
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  thoughtsTokens: number | null;
  latencyMs: number;
  attempts: number;
  changes?: string[];
  corrected?: boolean;
  // 검증기에 걸려 버려진 생성 시도. 토큰은 실제로 썼으므로 비용 계산에는 포함된다.
  validationFailed?: boolean;
  validationError?: string;
  // 축소 검증에서 돌려받은 변경분 적용 결과.
  changesApplied?: number;
  changesSkipped?: string[];
  changesRejected?: string;
}

export interface GrammarV2PilotMetrics {
  promptVersion: string;
  verifyMode: GrammarV2VerifyMode;
  generationModel: string;
  cacheRead: boolean;
  generateAttempts: number;
  stages: GrammarV2PilotStageMetrics[];
}

// verifyMode 'both'·'all3'에서 검증 방식별 결과를 나란히 비교하기 위한 묶음.
export interface GrammarV2PilotVariant {
  verifyMode: GrammarV2VerifyRun;
  model: string;
  changes: string[];
  changePaths: string[];
  corrected: boolean;
  semantic: GrammarV2ValidatedSemanticPayload;
}

export interface CanonicalVerse {
  verse: number;
  text: string;
}

export interface CanonicalBibleContext {
  version: BibleVersion;
  book: string;
  chapter: number;
  verse: number;
  bookName: string;
  bookNameKo: string;
  targetVerse: CanonicalVerse;
  contextBefore: CanonicalVerse | null;
  contextAfter: CanonicalVerse | null;
}

export interface GrammarV2SemanticChunk {
  id: string;
  order: number;
  text: string;
  role: string;
  level: number;
  parentId: string | null;
  meaning: string;
  note: string;
  termIds: string[];
}

export interface GrammarV2Chunk extends GrammarV2SemanticChunk {
  start: number;
  end: number;
}

export interface GrammarV2GlossaryItem {
  id: string;
  term: string;
  type: string;
  ipa: string;
  hangul: string;
  syllables: string[];
  hangulSyllables: string[];
  stressIndex: number;
  meaningKo: string;
  note: string;
}

export interface GrammarV2KeyPoint {
  order: number;
  pattern: string;
  meaningKo: string;
  why: string;
  example: {
    en: string;
    ko: string;
  };
  caution: string;
}

export interface GrammarV2SemanticPayload {
  difficulty: string;
  styleNote: string;
  translationNatural: string;
  chunks: GrammarV2SemanticChunk[];
  glossary: GrammarV2GlossaryItem[];
  keyPoints: GrammarV2KeyPoint[];
}

export interface GrammarV2ValidatedSemanticPayload extends Omit<GrammarV2SemanticPayload, 'chunks'> {
  chunks: GrammarV2Chunk[];
}

export interface GrammarV2GenerationMetadata {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface GrammarV2VerificationMetadata {
  model: string;
  status: 'passed';
  changes: string[];
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface GrammarV2CacheDocument {
  schemaVersion: 'grammar-v2';
  promptVersion: string;
  meta: {
    sourceType: 'bible';
    version: BibleVersion;
    book: string;
    chapter: number;
    verse: number;
    sourceRef: string;
    difficulty: string;
    styleNote: string;
  };
  original: {
    text: string;
    translationNatural: string;
  };
  chunks: GrammarV2Chunk[];
  glossary: GrammarV2GlossaryItem[];
  keyPoints: GrammarV2KeyPoint[];
  generation: GrammarV2GenerationMetadata;
  verification: GrammarV2VerificationMetadata;
}

export interface GrammarV2VerifierResponse {
  changes: string[];
  corrected: GrammarV2SemanticPayload | null;
}

// 축소 검증(lite)은 payload 전체를 다시 받지 않고 바뀐 필드만 받는다.
// 전체를 되돌려 받으면 출력 토큰이 3배가 되어 비용 대부분을 차지했다.
export interface GrammarV2LiteChange {
  path: string;
  value: unknown;
  reason?: string;
}

export interface GrammarV2LiteVerifierResponse {
  changes: GrammarV2LiteChange[];
}
