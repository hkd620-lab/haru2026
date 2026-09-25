import {
  GrammarV2Chunk,
  GrammarV2GlossaryItem,
  GrammarV2KeyPoint,
  GrammarV2SemanticChunk,
  GrammarV2SemanticPayload,
  GrammarV2ValidatedSemanticPayload,
} from './grammarV2Types';

export class GrammarV2ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GrammarV2ValidationError';
  }
}

function fail(message: string): never {
  throw new GrammarV2ValidationError(message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(`${path} must be a string.`);
  if (hasMarkdown(value)) fail(`${path} contains Markdown.`);
  return value;
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path} must be a finite number.`);
  return value;
}

function requireInteger(value: unknown, path: string): number {
  const numberValue = requireNumber(value, path);
  if (!Number.isInteger(numberValue)) fail(`${path} must be an integer.`);
  return numberValue;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(`${path} must be an array.`);
  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

function hasMarkdown(value: string): boolean {
  return /```|`|\*\*|__|^\s*#{1,6}\s|^\s*[-*]\s/m.test(value);
}

function sentenceCount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g);
  return matches ? matches.filter((item) => item.trim()).length : 1;
}

// 기본값 4는 기존 KJV 경로의 동작이다. 파일럿·BSB 요청은 얕은 해설 기준에 맞춰 2를 넘긴다.
export const GRAMMAR_V2_DEFAULT_MAX_NOTE_SENTENCES = 4;
export const GRAMMAR_V2_PILOT_MAX_NOTE_SENTENCES = 2;

// 기존 한국어 성경 문장을 그대로 가져왔는지 가려내는 고어체 어미 표지.
// 현대 한국어 직역이면 이 표현이 나올 일이 없다.
// '하시니' 는 제거했다. "주님은 위대하시니…" 처럼 현대 한국어 연결어미로도 쓰여
// 시편 145:3 을 두 번 거짓 거부했다.
export const GRAMMAR_V2_ARCHAIC_KOREAN_MARKERS = [
  '하사',
  '하리로다',
  '이니라',
  '니라.',
  '느니라',
  '로다',
] as const;

/**
 * 번역 길이 비율 상한. 앞뒤 절 내용이 번역에 끌려 들어오면 번역이 원문보다 길어진다.
 * 파일럿 300절 실측(한글 글자 수 ÷ BSB 원문 글자 수): 중앙값 0.429, 95% 0.554,
 * 99% 0.655, 정상 최대 0.662, 누출 사례 john 10:35 는 0.862.
 * 0.75 는 정상 최대와 누출 사이에 있고, 0.70~0.85 구간에서 걸리는 절이 같다.
 */
export const GRAMMAR_V2_TRANSLATION_RATIO_MAX = 0.75;

/**
 * 원문이 이보다 짧으면 비율 검사를 건너뛴다.
 * "Jesus wept."(11자) → "예수님께서 눈물을 흘리셨습니다."는 비율 1.27 이 정상이다.
 * 파일럿 300절의 최소 원문 길이가 45자였다.
 */
export const GRAMMAR_V2_TRANSLATION_RATIO_MIN_SOURCE_CHARS = 45;

// 단어표에 채워 넣기용 가짜 항목이 들어오는 것을 막는다.
const GLOSSARY_FILLER_MARKERS = ['더미', 'dummy', 'placeholder', '자리표시'];

export interface GrammarV2ValidateOptions {
  maxNoteSentences?: number;
  // 파일럿: 따옴표 종류·연속 공백 차이는 눈감아 주고 비교한다. 통과하면 청크 text 를
  // 원문의 해당 구간 문자 그대로로 바꿔 넣어, 모델이 곧은 따옴표로 바꿔 써도 원문이 보존된다.
  normalizeChunkMatching?: boolean;
  // 파일럿: keyPoint.pattern 이 원문 어구 복사인지 코드로 검사한다(프롬프트에 맡기지 않는다).
  rejectSourcePhrasePattern?: boolean;
  // 파일럿: 단어표 중복·더미 항목, 청크 해설 복사, 번역의 고어체를 코드로 걸러낸다.
  rejectGlossaryDuplicates?: boolean;
  rejectFillerGlossary?: boolean;
  rejectDuplicateChunkNotes?: boolean;
  rejectArchaicKoreanTranslation?: boolean;
  // 파일럿: 번역이 원문보다 지나치게 길면 앞뒤 절 내용이 섞인 것으로 보고 거부한다.
  rejectOverlongTranslation?: boolean;
}

// 곧은·굽은 따옴표와 아포스트로피. BSB 본문은 굽은 문자를 쓰는데 모델이 곧은 문자로
// 바꿔 출력하는 일이 잦아, 비교할 때만 무시한다.
const QUOTE_CHARS = new Set(['"', '“', '”', "'", '‘', '’', '«', '»']);

/**
 * 비교용으로 따옴표를 빼고 연속 공백을 하나로 줄인다.
 * map[i] = 정규화 문자열의 i번째 문자가 원문 몇 번째 문자에서 왔는지.
 */
function normalizeForMatching(text: string): { text: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  let lastWasSpace = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (QUOTE_CHARS.has(ch)) continue;
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      chars.push(' ');
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    chars.push(ch);
    map.push(i);
    lastWasSpace = false;
  }

  return { text: chars.join(''), map };
}

/**
 * pattern 이 문법 구조명이 아니라 원문에서 베낀 어구인지 본다.
 * 한글이 섞인 구조명(예: to부정사(목적), 수동태(be + 과거분사))은 허용한다.
 */
function patternIsSourcePhrase(pattern: string, normalizedSource: string): boolean {
  if (/[가-힣]/.test(pattern)) return false;
  const words = pattern.match(/[A-Za-z]+/g) || [];
  if (words.length < 2) return false;
  const normalized = normalizeForMatching(pattern).text.trim();
  return normalized.length > 0 && normalizedSource.includes(normalized);
}

function parseChunk(value: unknown, index: number, maxNoteSentences: number): GrammarV2SemanticChunk {
  if (!isPlainObject(value)) fail(`chunks[${index}] must be an object.`);
  const parentId = value.parentId;
  if (parentId !== null && typeof parentId !== 'string') fail(`chunks[${index}].parentId must be string or null.`);
  const note = requireString(value.note, `chunks[${index}].note`);
  if (sentenceCount(note) > maxNoteSentences) {
    fail(`chunks[${index}].note must be at most ${maxNoteSentences} sentences.`);
  }

  return {
    id: requireString(value.id, `chunks[${index}].id`),
    order: requireNumber(value.order, `chunks[${index}].order`),
    text: requireString(value.text, `chunks[${index}].text`),
    role: requireString(value.role, `chunks[${index}].role`),
    level: requireNumber(value.level, `chunks[${index}].level`),
    parentId,
    meaning: requireString(value.meaning, `chunks[${index}].meaning`),
    note,
    termIds: requireStringArray(value.termIds, `chunks[${index}].termIds`),
  };
}

function parseGlossaryItem(value: unknown, index: number): GrammarV2GlossaryItem {
  if (!isPlainObject(value)) fail(`glossary[${index}] must be an object.`);
  const syllables = requireStringArray(value.syllables, `glossary[${index}].syllables`);
  if (syllables.length === 0) fail(`glossary[${index}].syllables must be a non-empty array.`);
  const stressIndex = requireInteger(value.stressIndex, `glossary[${index}].stressIndex`);
  if (stressIndex < 0 || stressIndex >= syllables.length) {
    fail(`glossary[${index}].stressIndex must be a 0-based index within syllables.`);
  }

  return {
    id: requireString(value.id, `glossary[${index}].id`),
    term: requireString(value.term, `glossary[${index}].term`),
    type: requireString(value.type, `glossary[${index}].type`),
    ipa: requireString(value.ipa, `glossary[${index}].ipa`),
    hangul: requireString(value.hangul, `glossary[${index}].hangul`),
    syllables,
    hangulSyllables: requireStringArray(value.hangulSyllables, `glossary[${index}].hangulSyllables`),
    stressIndex,
    meaningKo: requireString(value.meaningKo, `glossary[${index}].meaningKo`),
    note: requireString(value.note, `glossary[${index}].note`),
  };
}

function parseKeyPoint(value: unknown, index: number): GrammarV2KeyPoint {
  if (!isPlainObject(value)) fail(`keyPoints[${index}] must be an object.`);
  if (!isPlainObject(value.example)) fail(`keyPoints[${index}].example must be an object.`);
  return {
    order: requireNumber(value.order, `keyPoints[${index}].order`),
    pattern: requireString(value.pattern, `keyPoints[${index}].pattern`),
    meaningKo: requireString(value.meaningKo, `keyPoints[${index}].meaningKo`),
    why: requireString(value.why, `keyPoints[${index}].why`),
    example: {
      en: requireString(value.example.en, `keyPoints[${index}].example.en`),
      ko: requireString(value.example.ko, `keyPoints[${index}].example.ko`),
    },
    caution: requireString(value.caution, `keyPoints[${index}].caution`),
  };
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) fail(`${label} must be unique: ${value}`);
    seen.add(value);
  }
}

function assertNoParentCycles(chunks: GrammarV2SemanticChunk[]): void {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  for (const chunk of chunks) {
    let current: GrammarV2SemanticChunk | undefined = chunk;
    const path = new Set<string>();
    while (current?.parentId) {
      if (current.parentId === current.id) fail(`chunk parentId cannot reference itself: ${current.id}`);
      if (path.has(current.parentId)) fail(`chunk parent cycle detected at: ${current.parentId}`);
      path.add(current.id);
      current = byId.get(current.parentId);
    }
  }
}

function withSourcePositions(
  sourceText: string,
  chunks: GrammarV2SemanticChunk[],
  normalizeMatching: boolean
): GrammarV2Chunk[] {
  const positioned: GrammarV2Chunk[] = [];

  if (normalizeMatching) {
    // 따옴표·공백 차이를 무시한 위치에서 찾고, 찾은 자리의 원문 문자를 그대로 text 로 쓴다.
    const source = normalizeForMatching(sourceText);
    let cursor = 0;

    for (const chunk of chunks) {
      const needle = normalizeForMatching(chunk.text).text.trim();
      if (!needle) fail(`chunk text cannot be empty: ${chunk.id}`);
      const found = source.text.indexOf(needle, cursor);
      if (found === -1) {
        fail(`chunk is not an exact ordered substring of target verse: ${chunk.id}`);
      }
      const start = source.map[found];
      const end = source.map[found + needle.length - 1] + 1;
      positioned.push({ ...chunk, text: sourceText.slice(start, end), start, end });
      cursor = found + needle.length;
    }
  } else {
    let prevEnd = 0;
    for (const chunk of chunks) {
      if (!chunk.text) fail(`chunk text cannot be empty: ${chunk.id}`);
      const start = sourceText.indexOf(chunk.text, prevEnd);
      if (start === -1) {
        fail(`chunk is not an exact ordered substring of target verse: ${chunk.id}`);
      }
      const end = start + chunk.text.length;
      positioned.push({ ...chunk, start, end });
      prevEnd = end;
    }
  }

  let cursor = 0;
  for (const chunk of positioned) {
    const uncovered = sourceText.slice(cursor, chunk.start);
    if (/[A-Za-z0-9]/.test(uncovered)) {
      fail(`source lexical text is not covered before chunk ${chunk.id}: ${uncovered}`);
    }
    cursor = chunk.end;
  }
  const tail = sourceText.slice(cursor);
  if (/[A-Za-z0-9]/.test(tail)) {
    fail(`source lexical text is not covered after final chunk: ${tail}`);
  }

  return positioned;
}

export function validateGrammarV2SemanticPayload(
  sourceText: string,
  payload: unknown,
  options: GrammarV2ValidateOptions = {}
): GrammarV2ValidatedSemanticPayload {
  const maxNoteSentences = options.maxNoteSentences ?? GRAMMAR_V2_DEFAULT_MAX_NOTE_SENTENCES;
  if (!isPlainObject(payload)) fail('semantic payload must be an object.');

  const difficulty = requireString(payload.difficulty, 'difficulty');
  const styleNote = requireString(payload.styleNote, 'styleNote');
  const translationNatural = requireString(payload.translationNatural, 'translationNatural');

  if (!Array.isArray(payload.chunks) || payload.chunks.length === 0) {
    fail('chunks must be a non-empty array.');
  }
  if (!Array.isArray(payload.glossary)) fail('glossary must be an array.');
  if (!Array.isArray(payload.keyPoints)) fail('keyPoints must be an array.');

  if (payload.glossary.length > 8) fail('glossary must contain at most 8 items.');
  if (payload.keyPoints.length !== 3) fail('keyPoints must contain exactly 3 items.');

  const chunks = payload.chunks
    .map((chunk, index) => parseChunk(chunk, index, maxNoteSentences))
    .sort((a, b) => a.order - b.order);
  const glossary = payload.glossary.map(parseGlossaryItem);
  const keyPoints = payload.keyPoints.map(parseKeyPoint).sort((a, b) => a.order - b.order);

  assertUnique(chunks.map((chunk) => chunk.id), 'chunk ids');
  assertUnique(glossary.map((item) => item.id), 'glossary ids');

  chunks.forEach((chunk, index) => {
    if (chunk.order !== index + 1) fail(`chunk order must be contiguous from 1: ${chunk.id}`);
  });

  const chunkIds = new Set(chunks.map((chunk) => chunk.id));
  const glossaryIds = new Set(glossary.map((item) => item.id));
  for (const chunk of chunks) {
    if (chunk.parentId && !chunkIds.has(chunk.parentId)) {
      fail(`chunk parentId does not exist: ${chunk.id} -> ${chunk.parentId}`);
    }
    for (const termId of chunk.termIds) {
      if (!glossaryIds.has(termId)) fail(`chunk termId does not exist: ${chunk.id} -> ${termId}`);
    }
  }
  assertNoParentCycles(chunks);

  keyPoints.forEach((point, index) => {
    if (point.order !== index + 1) fail('keyPoints order must be exactly [1,2,3].');
  });

  if (options.rejectGlossaryDuplicates) {
    const seen = new Map<string, number>();
    glossary.forEach((item, index) => {
      const key = item.term.trim().toLowerCase();
      if (seen.has(key)) {
        fail(`glossary has the same term twice: "${item.term}" (glossary[${seen.get(key)}] and glossary[${index}])`);
      }
      seen.set(key, index);
    });
  }

  if (options.rejectFillerGlossary) {
    glossary.forEach((item, index) => {
      const haystack = `${item.term} ${item.meaningKo} ${item.note}`.toLowerCase();
      const hit = GLOSSARY_FILLER_MARKERS.find((marker) => haystack.includes(marker.toLowerCase()));
      if (hit) fail(`glossary[${index}] looks like a filler entry (contains "${hit}").`);
    });
  }

  if (options.rejectDuplicateChunkNotes) {
    const seen = new Map<string, number>();
    chunks.forEach((chunk, index) => {
      const key = chunk.note.trim();
      if (!key) return;
      if (seen.has(key)) {
        fail(`chunks[${index}].note is identical to chunks[${seen.get(key)}].note.`);
      }
      seen.set(key, index);
    });
  }

  if (options.rejectArchaicKoreanTranslation) {
    const hit = GRAMMAR_V2_ARCHAIC_KOREAN_MARKERS.find((marker) => translationNatural.includes(marker));
    if (hit) {
      fail(
        `translationNatural uses an archaic Korean scriptural ending ("${hit}"). Translate the source text directly in modern Korean.`
      );
    }
  }

  if (options.rejectOverlongTranslation && sourceText.length >= GRAMMAR_V2_TRANSLATION_RATIO_MIN_SOURCE_CHARS) {
    const hangulCount = (translationNatural.match(/[가-힣]/g) || []).length;
    const ratio = hangulCount / sourceText.length;
    if (ratio > GRAMMAR_V2_TRANSLATION_RATIO_MAX) {
      fail(
        `translationNatural is too long for this verse (${hangulCount} Korean syllables for ${sourceText.length} source characters, ratio ${ratio.toFixed(2)} > ${GRAMMAR_V2_TRANSLATION_RATIO_MAX}). Translate only the target verse, not the surrounding ones.`
      );
    }
  }

  if (options.rejectSourcePhrasePattern) {
    const normalizedSource = normalizeForMatching(sourceText).text;
    keyPoints.forEach((point, index) => {
      if (patternIsSourcePhrase(point.pattern, normalizedSource)) {
        fail(
          `keyPoints[${index}].pattern must name a grammatical structure, not copy a phrase from the verse: ${point.pattern}`
        );
      }
    });
  }

  return {
    difficulty,
    styleNote,
    translationNatural,
    chunks: withSourcePositions(sourceText, chunks, Boolean(options.normalizeChunkMatching)),
    glossary,
    keyPoints,
  };
}
