import { CanonicalBibleContext, GrammarV2SemanticPayload } from './grammarV2Types';

export const GRAMMAR_V2_SCHEMA_VERSION = 'grammar-v2';
export const GRAMMAR_V2_PROMPT_VERSION = 'v2.1.0';
export const GRAMMAR_V2_GENERATE_MODEL = 'gemini-3.1-flash-lite';
export const GRAMMAR_V2_VERIFY_MODEL = 'gpt-4o';

export function buildGeminiSemanticPrompt(context: CanonicalBibleContext): string {
  const before = context.contextBefore
    ? `${context.bookName} ${context.chapter}:${context.contextBefore.verse} ${context.contextBefore.text}`
    : '(none)';
  const after = context.contextAfter
    ? `${context.bookName} ${context.chapter}:${context.contextAfter.verse} ${context.contextAfter.text}`
    : '(none)';

  return `You are creating an English-learning grammar analysis for a Korean beginner.

Analyze ONLY the TARGET verse. The context verses are only for understanding.

Bible version: ${context.version.toUpperCase()}
Context before: ${before}
TARGET ${context.bookName} ${context.chapter}:${context.verse}: ${context.targetVerse.text}
Context after: ${after}

Rules:
- Do not change, modernize, or paraphrase the KJV source text.
- Do not confuse KJV archaic style with modern English.
- chunks must contain exact consecutive substrings copied from the TARGET verse only.
- Do not add words that are not in the TARGET verse to chunks.
- chunk order must follow the TARGET verse order.
- Every lexical source word in the TARGET verse must appear exactly once across chunks.
- The verse is the learning unit; do not assume one verse equals one sentence.
- chunk.note should be 2-3 sentences when useful, maximum 4 sentences.
- glossary must contain at most 8 items.
- keyPoints must contain exactly 3 items with order 1, 2, 3.
- Use natural Korean for translationNatural and explanations.
- No Markdown.
- Return JSON only.
- Do not include schemaVersion, promptVersion, source identity, start, or end.

Return this exact semantic JSON shape:
{
  "difficulty": "short Korean difficulty label",
  "styleNote": "short Korean KJV style note",
  "translationNatural": "natural Korean translation of the TARGET verse",
  "chunks": [
    {
      "id": "c1",
      "order": 1,
      "text": "exact consecutive substring from the TARGET verse",
      "role": "short Korean role label",
      "level": 0,
      "parentId": null,
      "meaning": "Korean meaning",
      "note": "Korean learning note",
      "termIds": ["w1"]
    }
  ],
  "glossary": [
    {
      "id": "w1",
      "term": "source term",
      "type": "word",
      "ipa": "IPA pronunciation",
      "hangul": "Korean pronunciation",
      "syllables": ["syllable"],
      "hangulSyllables": ["Korean syllable"],
      "stressIndex": 0,
      "meaningKo": "Korean meaning",
      "note": "Korean note"
    }
  ],
  "keyPoints": [
    {
      "order": 1,
      "pattern": "English pattern",
      "meaningKo": "Korean meaning",
      "why": "why it matters in this verse",
      "example": {
        "en": "simple English example",
        "ko": "Korean translation"
      },
      "caution": "Korean caution"
    }
  ]
}`;
}

export function buildGptVerifierPrompt(
  context: CanonicalBibleContext,
  semantic: GrammarV2SemanticPayload
): string {
  return `You are verifying a KJV Bible grammar-learning semantic payload.

You may correct grammar-learning analysis, but you must not change source identity or invent source text.

Canonical target verse:
${context.bookName} ${context.chapter}:${context.verse} ${context.targetVerse.text}

Context before:
${context.contextBefore ? `${context.bookName} ${context.chapter}:${context.contextBefore.verse} ${context.contextBefore.text}` : '(none)'}

Context after:
${context.contextAfter ? `${context.bookName} ${context.chapter}:${context.contextAfter.verse} ${context.contextAfter.text}` : '(none)'}

Semantic payload to verify:
${JSON.stringify(semantic, null, 2)}

Verifier rules:
- corrected.chunks[].text must remain exact consecutive substrings from the target verse only.
- Do not add context verse text to chunks.
- Preserve all lexical words from the target verse exactly once across chunks.
- Keep glossary length <= 8.
- Keep exactly 3 keyPoints with order 1, 2, 3.
- No Markdown.

Return JSON only in this shape:
{
  "changes": [],
  "corrected": null
}

If corrections are needed, corrected must be the full semantic payload shape only:
{
  "changes": ["short Korean or English change note"],
  "corrected": { ...full semantic payload... }
}`;
}
