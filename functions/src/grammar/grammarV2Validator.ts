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

function parseChunk(value: unknown, index: number): GrammarV2SemanticChunk {
  if (!isPlainObject(value)) fail(`chunks[${index}] must be an object.`);
  const parentId = value.parentId;
  if (parentId !== null && typeof parentId !== 'string') fail(`chunks[${index}].parentId must be string or null.`);
  const note = requireString(value.note, `chunks[${index}].note`);
  if (sentenceCount(note) > 4) fail(`chunks[${index}].note must be at most 4 sentences.`);

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
  return {
    id: requireString(value.id, `glossary[${index}].id`),
    term: requireString(value.term, `glossary[${index}].term`),
    type: requireString(value.type, `glossary[${index}].type`),
    ipa: requireString(value.ipa, `glossary[${index}].ipa`),
    hangul: requireString(value.hangul, `glossary[${index}].hangul`),
    syllables: requireStringArray(value.syllables, `glossary[${index}].syllables`),
    hangulSyllables: requireStringArray(value.hangulSyllables, `glossary[${index}].hangulSyllables`),
    stressIndex: requireNumber(value.stressIndex, `glossary[${index}].stressIndex`),
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

function withSourcePositions(sourceText: string, chunks: GrammarV2SemanticChunk[]): GrammarV2Chunk[] {
  let prevEnd = 0;
  const positioned: GrammarV2Chunk[] = [];

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
  payload: unknown
): GrammarV2ValidatedSemanticPayload {
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

  const chunks = payload.chunks.map(parseChunk).sort((a, b) => a.order - b.order);
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

  return {
    difficulty,
    styleNote,
    translationNatural,
    chunks: withSourcePositions(sourceText, chunks),
    glossary,
    keyPoints,
  };
}
