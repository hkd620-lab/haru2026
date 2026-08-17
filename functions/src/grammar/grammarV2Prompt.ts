import { CanonicalBibleContext, GrammarV2SemanticPayload } from './grammarV2Types';

export const GRAMMAR_V2_SCHEMA_VERSION = 'grammar-v2';
export const GRAMMAR_V2_PROMPT_VERSION = 'v2.2.1';
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
- One verse is exactly one analysis unit. Produce exactly one analysis for the TARGET verse.
- This does not mean one verse is one grammatical sentence. A verse may contain several clauses or sentence-like structures separated by semicolons, colons, or periods; analyze them together as a single verse-level unit.
- Never split the TARGET verse into sub-units or sub-references such as "14-a" or "14-b", and never output more than one analysis object for a verse.
- chunk.note should be 2-3 sentences when useful, maximum 4 sentences.
- chunk.note must explain something useful about how this exact chunk works in the TARGET verse, not merely state a generic grammar rule.
- When a chunk contains an archaic, idiomatic, existential, unusual, or easily confused construction, chunk.note should explicitly explain that verse-specific feature in beginner-friendly Korean.
- Do not repeat chunk.meaning in chunk.note. Use note for grammar, structure, reference, or a likely learner misunderstanding.
- glossary must contain at most 8 items.
- glossary ids must be contiguous from w1, for example w1, w2, w3.
- chunks[].termIds must only contain ids that exist in glossary.
- If a chunk has no matching glossary item, use an empty termIds array.
- Do not reference missing glossary ids in termIds.
- keyPoints must contain exactly 3 items with order 1, 2, 3.
- Each caution must address a concrete misunderstanding a beginner could have when reading this specific TARGET verse.
- Anchor each caution to an actual word, phrase, or grammatical structure appearing in the TARGET verse. Avoid generic grammar advice that could be reused unchanged for many unrelated verses.
- Prefer explaining how a learner might misread the expression and how to understand it correctly in this verse.
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
- Beyond structural validity, verify that the grammar explanation is educationally and grammatically correct for the target verse.
- Each keyPoint must describe a grammatical structure that actually occurs in the target verse. Reject or correct a keyPoint that describes a pattern not present in the verse.
- Reject over-generalization. Do not present a verse-specific construction as a universal modern English grammar formula.
- When genuinely present in the target verse, existential, subjunctive, jussive, idiomatic, or archaic constructions must be identified accurately and must not be reduced to a superficially similar modern English template.
- chunk.role, chunk.meaning, and chunk.note must be consistent with the actual syntactic function of that chunk in the target verse.
- Verify that each chunk.note adds verse-specific learning value beyond chunk.meaning.
- A chunk.note is insufficient if it merely states a broad grammar rule while failing to explain an unusual, archaic, idiomatic, existential, referential, or easily confused structure present in that chunk.
- For learner-sensitive constructions, require chunk.note to explain how the construction functions in this verse and, when useful, how it differs from a superficially similar ordinary modern-English pattern.
- Correct generic or misleading chunk.note content when a more verse-specific explanation is needed, and record that correction in changes.
- glossary meanings must match how each word is used in this verse, not merely its general dictionary meaning.
- caution must describe a real misunderstanding that a Korean learner could reasonably have with the grammar or wording of this verse, not a generic warning.
- Verify each caution for verse-specific educational usefulness, not only grammatical truth.
- A caution is insufficient if it is generic advice that could apply unchanged to many unrelated verses while missing a more important misunderstanding caused by an actual expression in the target verse.
- Each caution should be anchored to a real word, phrase, or construction in the target verse and should help a beginner distinguish a likely wrong reading from the correct reading in this verse.
- If a caution is technically true but educationally generic or misses a more important verse-specific misunderstanding, correct it and record the correction in changes.
- If an educational or grammatical error is corrected, record a concise explanation of that correction in changes.

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
