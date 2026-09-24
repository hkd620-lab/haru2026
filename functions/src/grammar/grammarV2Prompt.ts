import { CanonicalBibleContext, GrammarV2SemanticPayload } from './grammarV2Types';

export const GRAMMAR_V2_SCHEMA_VERSION = 'grammar-v2';
export const GRAMMAR_V2_PROMPT_VERSION = 'v2.2.3';
// 파일럿(얕은 해설 기준)은 별도 프롬프트 버전을 쓴다. 운영 캐시(v2.2.3)와 섞이지 않는다.
export const GRAMMAR_V2_PILOT_PROMPT_VERSION = 'v2.3.1-pilot';
export const GRAMMAR_V2_GENERATE_MODEL = 'gemini-3.1-flash-lite';
export const GRAMMAR_V2_VERIFY_MODEL = 'gpt-4o';

export type GrammarV2PromptDepth = 'standard' | 'shallow';

function contextLines(context: CanonicalBibleContext): { before: string; after: string } {
  return {
    before: context.contextBefore
      ? `${context.bookName} ${context.chapter}:${context.contextBefore.verse} ${context.contextBefore.text}`
      : '(none)',
    after: context.contextAfter
      ? `${context.bookName} ${context.chapter}:${context.contextAfter.verse} ${context.contextAfter.text}`
      : '(none)',
  };
}

export function buildGeminiSemanticPrompt(
  context: CanonicalBibleContext,
  options: { depth?: GrammarV2PromptDepth } = {}
): string {
  if (options.depth === 'shallow') {
    return buildShallowSemanticPrompt(context);
  }

  const { before, after } = contextLines(context);
  const versionLabel = context.version.toUpperCase();

  return `You are creating an English-learning grammar analysis for a Korean beginner.

Analyze ONLY the TARGET verse. The context verses are only for understanding.

Bible version: ${versionLabel}
Context before: ${before}
TARGET ${context.bookName} ${context.chapter}:${context.verse}: ${context.targetVerse.text}
Context after: ${after}

Rules:
- Do not change, modernize, or paraphrase the ${versionLabel} source text.
- Do not confuse ${versionLabel} archaic style with modern English.
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
- For pronouns that are important to understanding the TARGET verse, explain what the pronoun refers to and, when needed, identify its antecedent — the noun or noun phrase it refers to. Do not mechanically explain obvious pronouns when doing so would not help interpretation.
- If the same word or form appears more than once within the same TARGET verse and is used in different grammatical structures or functions, and that difference matters for interpretation, explaining each occurrence separately is not enough. Explicitly compare how the occurrences differ in structure or function, using chunk.note, caution, or keyPoint as appropriate. Also explain when a familiar word is being used with a grammatical or contextual function different from its common dictionary meaning, but do not treat simple lexical repetition as something to explain.
- glossary must contain at most 8 items.
- glossary ids must be contiguous from w1, for example w1, w2, w3.
- chunks[].termIds must only contain ids that exist in glossary.
- If a chunk has no matching glossary item, use an empty termIds array.
- Do not reference missing glossary ids in termIds.
- keyPoints must contain exactly 3 items with order 1, 2, 3.
- The 3 keyPoints should prioritize the core grammatical structures a beginner needs to understand the whole verse: the main sentence frame, major clause or phrase structures, core verb patterns, important modification relationships, and grammar relationships that control interpretation. Do not let detailed lexical collocations or individual word pairings take too many keyPoint slots; move such details to chunk.note when possible.
- Each keyPoint.pattern must accurately represent a grammatical structure that actually appears in the TARGET verse. Do not make the explanation easier by mislabeling or changing the actual subject, object, complement, verb, infinitive, clause, phrase, modifier, existential structure, passive or active relation, or parallel structure.
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
  "styleNote": "short Korean ${versionLabel} style note",
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

// 허 대표님 해설 깊이 기준(2026-09-24): 청크당 핵심 문법 1가지·1~2문장, 전수 품사 분석 금지,
// 문법 용어 최소화, 심화 내용은 별도 심화 버튼. 화면 호환을 위해 keyPoints 3개와 필드 구조는 유지한다.
function buildShallowSemanticPrompt(context: CanonicalBibleContext): string {
  const { before, after } = contextLines(context);
  const versionLabel = context.version.toUpperCase();

  return `You are writing a short, easy English-learning grammar note for a Korean middle-school reader.

Analyze ONLY the TARGET verse. The context verses are only for understanding.

Bible version: ${versionLabel}
Context before: ${before}
TARGET ${context.bookName} ${context.chapter}:${context.verse}: ${context.targetVerse.text}
Context after: ${after}

Source rules:
- Do not change, modernize, or paraphrase the ${versionLabel} source text.
- chunks must contain exact consecutive substrings copied from the TARGET verse only.
- Copy chunk.text character by character from the TARGET verse. Change nothing: keep the original capitalization, punctuation, commas, periods, colons, semicolons, apostrophes and quotation marks exactly as they appear, including any quotation mark that falls inside your chunk.
- Do not normalize, trim, re-spell, or tidy up chunk.text in any way. Concatenating all chunk.text values in order must reproduce the TARGET verse.
- Do not add words that are not in the TARGET verse to chunks.
- chunk order must follow the TARGET verse order.
- Every lexical source word in the TARGET verse must appear exactly once across chunks.
- One verse is exactly one analysis unit. Produce exactly one analysis for the TARGET verse.
- A verse may contain several clauses or sentence-like structures; analyze them together as a single verse-level unit.
- Never split the TARGET verse into sub-units or sub-references such as "14-a" or "14-b", and never output more than one analysis object for a verse.
- glossary must contain at most 8 items, with ids contiguous from w1.
- chunks[].termIds must only contain ids that exist in glossary. Use an empty array when there is no matching item.
- keyPoints must contain exactly 3 items with order 1, 2, 3.
- No Markdown.
- Return JSON only.
- Do not include schemaVersion, promptVersion, source identity, start, or end.

Depth rules (most important — stay short and easy):
- Write for a Korean middle-school student. All Korean must be plain, everyday Korean.
- Split the verse into meaningful phrase units, not word by word. Prefer fewer and larger chunks.
- Do not label the part of speech or sentence role of every single word.
- chunk.note must explain exactly ONE core grammar point of that chunk, in 1-2 short Korean sentences. Never more than 2 sentences.
- If a chunk needs no grammar explanation, write one short sentence about the single thing that matters most for reading it.
- Do not repeat chunk.meaning in chunk.note.
- Use a grammar term only when it is necessary, and when you use one, explain it in easy Korean in the same sentence.
- Do not add pronoun-antecedent analysis, comparisons of repeated words, or extra warnings unless the verse cannot be read without them. Deeper material belongs to a separate advanced view, not here.
- glossary: include only the words a Korean middle-school reader would actually need. Fewer is better than eight.
- keyPoints: each of pattern, meaningKo, why, example.en, example.ko, and caution must be exactly one short sentence.
- keyPoint.pattern must be the NAME OF A GRAMMATICAL STRUCTURE in Korean, not a quotation from the verse.
- Never copy a phrase from the TARGET verse into keyPoint.pattern. If your pattern text appears inside the verse, it is wrong — replace it with the structure's name.
- Good keyPoint.pattern values: "주어 + 동사 + 목적어", "전치사구(시간)", "to부정사(목적)", "관계대명사 who절", "수동태(be + 과거분사)", "명령문", "비교급 + than", "분사구문", "there + be 존재구문".
- Bad keyPoint.pattern values (these are verse phrases, not structures): "to my feet", "under heaven", "as a ransom", "who believes in Him", "In the beginning".
- Each keyPoint.pattern must name a structure that actually appears in the TARGET verse. Do not mislabel or simplify away the real subject, object, verb, clause, phrase, or passive relation just to make it sound easier.
- keyPoint.caution must name, in one sentence, something a Korean learner would actually get wrong WHEN READING THIS VERSE.
- A caution that would fit almost any English sentence is not acceptable. Do not write generic advice such as "전치사 in이 쓰였음을 주의하세요" or "and는 대등하게 연결합니다". Point at the specific word, word order, or form in this verse that causes the confusion, and say what the wrong reading would be.

Return this exact semantic JSON shape:
{
  "difficulty": "short Korean difficulty label",
  "styleNote": "short Korean ${versionLabel} style note",
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
      "note": "one core grammar point, 1-2 short Korean sentences",
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
      "pattern": "Korean name of the grammatical structure, never a phrase from the verse",
      "meaningKo": "Korean meaning in one sentence",
      "why": "why it matters in this verse, one sentence",
      "example": {
        "en": "simple English example",
        "ko": "Korean translation"
      },
      "caution": "one sentence naming a mistake a Korean learner would make in THIS verse"
    }
  ]
}`;
}

export function buildGptVerifierPrompt(
  context: CanonicalBibleContext,
  semantic: GrammarV2SemanticPayload,
  options: { mode?: 'full' | 'lite' } = {}
): string {
  if (options.mode === 'lite') {
    return buildLiteVerifierPrompt(context, semantic);
  }

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
- For pronouns that are important to understanding the target verse, verify that the explanation identifies what the pronoun refers to and, when needed, identifies its antecedent — the noun or noun phrase it refers to. Do not require mechanical explanation of obvious pronouns when it would not help interpretation.
- If the same word or form appears more than once within the same TARGET verse and is used in different grammatical structures or functions, and that difference matters for interpretation, do not accept the payload as sufficient merely because each occurrence is explained separately. Verify that the occurrences are explicitly compared, and if the comparison is missing, add or revise the comparison in chunk.note, caution, or keyPoint and record the correction in changes. Also verify explanations for familiar words used with grammatical or contextual functions different from their common dictionary meanings, while rejecting explanations that treat simple lexical repetition as important by itself.
- glossary meanings must match how each word is used in this verse, not merely its general dictionary meaning.
- The 3 keyPoints must prioritize the core grammatical structures needed for a beginner to understand the whole verse, such as the main sentence frame, major clause or phrase structures, core verb patterns, important modification relationships, and grammar relationships that control interpretation. If detailed lexical collocations or individual word pairings occupy too many keyPoint slots, move them to chunk.note when possible and record the correction in changes.
- Verify every keyPoint.pattern against the exact grammar of the target verse. Check that the pattern exists in the verse, accurately labels sentence parts such as subject, object, complement, verb, infinitive, clause, phrase, modifier, existential structure, passive or active relation, and parallel structure, and is not an over-simplified formula that changes the actual structure. Also verify that meaningKo, why, example, and caution do not contradict the pattern.
- If a keyPoint.pattern is structurally wrong, do not treat it as acceptable and do not return corrected as null while that error remains. Correct the pattern and any inconsistent meaningKo, why, example, or caution, then record the correction in changes; if the original pattern cannot be corrected with confidence, replace that keyPoint with a structurally accurate keyPoint that is clearly present in the target verse.
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

// 축소 검증(lite): 틀린 것만 고친다. 설명을 더 붙이거나 깊게 만드는 일은 하지 않는다.
// 비용의 대부분이 이 단계라서, full 검증과 나란히 돌려 놓친 오류가 있는지 비교하는 것이 목적이다.
function buildLiteVerifierPrompt(
  context: CanonicalBibleContext,
  semantic: GrammarV2SemanticPayload
): string {
  const versionLabel = context.version.toUpperCase();

  return `You are checking a ${versionLabel} Bible grammar-learning semantic payload for errors only.

Canonical target verse:
${context.bookName} ${context.chapter}:${context.verse} ${context.targetVerse.text}

Semantic payload to check:
${JSON.stringify(semantic, null, 2)}

Check ONLY these two kinds of error:
1. Grammar-explanation errors — a stated grammatical fact about the target verse is wrong, a keyPoint.pattern names a structure that does not actually occur in the target verse, or chunk.role / chunk.note contradicts the real syntactic function of that chunk.
2. Translation errors — translationNatural, chunk.meaning, or glossary[].meaningKo misrepresents the target verse, or a glossary meaning does not match how the word is used here.

Structural checks (chunk text, chunk coverage, glossary size and ids, keyPoint count, whether a pattern merely copies a phrase from the verse) are already handled by code. Do not spend output on them.

Correction rules (strict):
- Report ONLY what is actually wrong, and change as little text as possible.
- Do NOT add explanation. Do NOT expand, enrich, or deepen any note, why, or caution.
- Do NOT rewrite correct text merely to improve style, tone, or completeness.
- Keep every chunk.note at 2 sentences or fewer, and keep each keyPoint field at one sentence.
- Short and simple is intended here. Brevity is not an error, and a missing deeper explanation is not an error.
- If both checks pass, return an empty changes array even if you could imagine a richer explanation.
- No Markdown.

Output ONLY the fields you are changing — never the whole payload.

Return JSON only in this shape:
{
  "changes": []
}

If real errors were found, list one entry per changed field:
{
  "changes": [
    { "path": "chunks[2].note", "value": "corrected Korean text", "reason": "짧은 이유" }
  ]
}

Path rules:
- Use exactly these forms: "difficulty", "styleNote", "translationNatural", "chunks[i].role", "chunks[i].meaning", "chunks[i].note", "glossary[i].term", "glossary[i].type", "glossary[i].ipa", "glossary[i].hangul", "glossary[i].meaningKo", "glossary[i].note", "keyPoints[i].pattern", "keyPoints[i].meaningKo", "keyPoints[i].why", "keyPoints[i].caution", "keyPoints[i].example.en", "keyPoints[i].example.ko".
- i is a 0-based index into the array as given above.
- value must be the full replacement string for that one field.
- Never use a path for chunks[i].text, ids, orders, levels, parentId, termIds, syllables, or stressIndex. Those are fixed by code.
- Never add or remove array items.`;
}
