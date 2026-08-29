export type BibleVersion = 'kjv';

export interface GrammarV2Input {
  version: BibleVersion;
  book: string;
  chapter: number;
  verse: number;
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
