"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIBLE_EXAMPLE_NOT_FOUND_MESSAGE = void 0;
exports.normalizeBibleWord = normalizeBibleWord;
exports.normalizeBibleVerseText = normalizeBibleVerseText;
exports.hashBibleVerseText = hashBibleVerseText;
exports.buildBibleWordMeaningContext = buildBibleWordMeaningContext;
exports.buildBibleWordMeaningCacheKey = buildBibleWordMeaningCacheKey;
exports.isValidBibleVerseKey = isValidBibleVerseKey;
exports.cachedBibleWordMeaningMatchesContext = cachedBibleWordMeaningMatchesContext;
exports.tokenizeEnglishText = tokenizeEnglishText;
exports.verseContainsTargetWord = verseContainsTargetWord;
exports.buildBibleWordMeaningPrompt = buildBibleWordMeaningPrompt;
exports.parseJsonObject = parseJsonObject;
exports.validateBibleWordMeaningPayload = validateBibleWordMeaningPayload;
exports.buildSafeBibleWordMeaningFallback = buildSafeBibleWordMeaningFallback;
const crypto = __importStar(require("crypto"));
exports.BIBLE_EXAMPLE_NOT_FOUND_MESSAGE = '이 단어가 직접 사용된 성경 예문을 찾지 못했습니다.';
const WORD_TOKEN_REGEX = /[A-Za-z]+(?:[’'][A-Za-z]+)?/g;
const VERSE_KEY_REGEX = /^[a-z]+_\d+_\d+$/;
const BE_FORMS = new Set([
    'am',
    'are',
    'art',
    'be',
    'been',
    'being',
    'is',
    'wast',
    'was',
    'were',
    'wert',
]);
const HAVE_FORMS = new Set([
    'had',
    'hast',
    'hath',
    'have',
    'having',
    'has',
]);
const IRREGULAR_VERBS = [
    { lemma: 'be', past: ['was', 'were', 'wast', 'wert'], participle: ['been'], pattern: 'be - was/were - been' },
    { lemma: 'beat', past: ['beat'], participle: ['beaten'], pattern: 'beat - beat - beaten' },
    { lemma: 'become', past: ['became'], participle: ['become'], pattern: 'become - became - become' },
    { lemma: 'begin', past: ['began'], participle: ['begun'], pattern: 'begin - began - begun' },
    { lemma: 'bring', past: ['brought'], participle: ['brought'], pattern: 'bring - brought - brought' },
    { lemma: 'come', past: ['came'], participle: ['come'], pattern: 'come - came - come' },
    { lemma: 'do', past: ['did', 'didst'], participle: ['done'], pattern: 'do - did - done' },
    { lemma: 'eat', past: ['ate'], participle: ['eaten'], pattern: 'eat - ate - eaten' },
    { lemma: 'fall', past: ['fell'], participle: ['fallen'], pattern: 'fall - fell - fallen' },
    { lemma: 'give', past: ['gave', 'gavest'], participle: ['given'], pattern: 'give - gave - given' },
    { lemma: 'go', past: ['went'], participle: ['gone'], pattern: 'go - went - gone' },
    { lemma: 'have', past: ['had', 'hadst'], participle: ['had'], pattern: 'have - had - had' },
    { lemma: 'know', past: ['knew', 'knewest'], participle: ['known'], pattern: 'know - knew - known' },
    { lemma: 'make', past: ['made', 'madest'], participle: ['made'], pattern: 'make - made - made' },
    { lemma: 'run', past: ['ran'], participle: ['run'], pattern: 'run - ran - run' },
    { lemma: 'say', past: ['said', 'saidst'], participle: ['said'], pattern: 'say - said - said' },
    { lemma: 'see', past: ['saw', 'sawest'], participle: ['seen'], pattern: 'see - saw - seen' },
    { lemma: 'speak', past: ['spake', 'spoke'], participle: ['spoken'], pattern: 'speak - spoke - spoken' },
    { lemma: 'take', past: ['took', 'tookest'], participle: ['taken'], pattern: 'take - took - taken' },
    { lemma: 'write', past: ['wrote'], participle: ['written'], pattern: 'write - wrote - written' },
];
const ARCHAIC_VERB_FORMS = new Map([
    ['art', { lemma: 'be', pattern: 'be - was/were - been' }],
    ['dost', { lemma: 'do', pattern: 'do - did - done' }],
    ['doth', { lemma: 'do', pattern: 'do - did - done' }],
    ['hast', { lemma: 'have', pattern: 'have - had - had' }],
    ['hath', { lemma: 'have', pattern: 'have - had - had' }],
    ['saith', { lemma: 'say', pattern: 'say - said - said' }],
    ['shalt', { lemma: 'shall', pattern: 'shall - should - should' }],
    ['wilt', { lemma: 'will', pattern: 'will - would - would' }],
]);
const IRREGULAR_FORM_LOOKUP = buildIrregularFormLookup();
function buildIrregularFormLookup() {
    const lookup = new Map();
    for (const item of IRREGULAR_VERBS) {
        addIrregularVerbForm(lookup, item.lemma, item.lemma, 'present', item.pattern);
        for (const past of item.past)
            addIrregularVerbForm(lookup, past, item.lemma, 'past', item.pattern);
        for (const participle of item.participle) {
            addIrregularVerbForm(lookup, participle, item.lemma, 'participle', item.pattern);
        }
    }
    for (const [form, entry] of ARCHAIC_VERB_FORMS) {
        addIrregularVerbForm(lookup, form, entry.lemma, 'present', entry.pattern);
    }
    return lookup;
}
function addIrregularVerbForm(lookup, form, lemma, role, pattern) {
    const normalized = normalizeBibleWord(form);
    const existing = lookup.get(normalized);
    if (existing && existing.lemma === lemma) {
        existing.roles.add(role);
        return;
    }
    lookup.set(normalized, { lemma, roles: new Set([role]), pattern });
}
function normalizeBibleWord(value) {
    return String(value || '').replace(/[^A-Za-z]/g, '').toLowerCase();
}
function normalizeBibleVerseText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}
function hashBibleVerseText(value) {
    return crypto.createHash('sha1').update(normalizeBibleVerseText(value)).digest('hex').slice(0, 16);
}
function buildBibleWordMeaningContext(input) {
    const word = String(input.word || '').replace(/[^A-Za-z]/g, '').trim();
    const verseText = normalizeBibleVerseText(input.verseText);
    const verseKey = typeof input.verseKey === 'string' ? input.verseKey.trim().toLowerCase() : '';
    return {
        word,
        normalizedWord: normalizeBibleWord(word),
        verseText,
        normalizedVerseText: verseText,
        verseKey,
    };
}
function buildBibleWordMeaningCacheKey(context) {
    return `bible_${context.verseKey}_${hashBibleVerseText(context.verseText)}_${context.normalizedWord}`;
}
function isValidBibleVerseKey(value) {
    return typeof value === 'string' && VERSE_KEY_REGEX.test(value.trim().toLowerCase());
}
function cachedBibleWordMeaningMatchesContext(rawPayload, context) {
    if (!isPlainObject(rawPayload))
        return false;
    return getString(rawPayload.verseKey).toLowerCase() === context.verseKey
        && getString(rawPayload.normalizedVerseText) === context.normalizedVerseText
        && getString(rawPayload.verseTextHash) === hashBibleVerseText(context.verseText);
}
function tokenizeEnglishText(text) {
    const tokens = [];
    const matcher = new RegExp(WORD_TOKEN_REGEX);
    let match;
    while ((match = matcher.exec(text)) !== null) {
        const normalized = normalizeBibleWord(match[0]);
        if (!normalized)
            continue;
        tokens.push({ raw: match[0], normalized, index: tokens.length });
    }
    return tokens;
}
function verseContainsTargetWord(context) {
    return findTargetToken(context) !== null;
}
function buildBibleWordMeaningPrompt(context, previousErrors = []) {
    const retryInstruction = previousErrors.length
        ? `\n이전 응답은 아래 검증 오류로 거부되었습니다. 같은 오류를 반복하지 마세요:\n- ${previousErrors.join('\n- ')}\n`
        : '';
    return `KJV 영어성경 단어학습용 JSON을 생성하세요.

선택 단어: "${context.word}"
현재 구절 키: "${context.verseKey || 'unknown'}"
현재 KJV 구절: "${context.verseText}"
${retryInstruction}
규칙:
- 선택 단어를 현재 구절 안에서 쓰인 품사와 뜻으로만 분석하세요.
- 일반 사전의 첫 번째 뜻을 기계적으로 고르지 말고, 현재 구절의 문장 구조와 활용형을 기준으로 고르세요.
- 활용형이면 lemma에는 원형/표제어를 쓰고, inflection에는 현재 형태를 설명하세요.
- 불규칙동사는 필요할 때 inflectionPattern에 "base - past - past participle" 형식으로 적으세요.
- phrase/phrasalVerb는 현재 구절에 실제로 연속 등장하고 선택 단어를 포함할 때만 적으세요. 없으면 빈 문자열입니다.
- 성경 예문이나 장절을 새로 만들지 마세요. bibleExample, bibleExampleKo, bibleReference는 빈 문자열로 두세요.
- 생활 예문도 만들지 마세요. example, exampleKo는 빈 문자열로 두세요.
- KJV 고어를 괄호 안 현대어로 자동 치환하지 마세요.
- 마크다운 없이 순수 JSON 객체 하나만 응답하세요.

응답 JSON 형식:
{
  "selectedWord": "선택 단어 원문",
  "meaning": "현재 구절 문맥의 한국어 뜻 1~3개",
  "contextMeaning": "현재 구절에서 가장 자연스러운 한국어 뜻",
  "referenceMeanings": ["필요할 때만 참고 뜻 0~3개"],
  "partOfSpeech": "현재 구절 기준 품사",
  "lemma": "원형 또는 표제어",
  "inflection": "현재 활용형 설명",
  "inflectionPattern": "필요할 때만 변화 관계",
  "phonetic": "미국식 발음기호",
  "koreanPronunciation": "한국어 발음",
  "phrase": "현재 구절에 실제 있는 구동사/숙어",
  "phraseMeaning": "구동사/숙어의 한국어 뜻",
  "phrasalVerb": "phrase와 같게, 없으면 빈 문자열",
  "phrasalVerbMeaning": "phraseMeaning과 같게, 없으면 빈 문자열",
  "phrasalVerbExample": "",
  "phrasalVerbExampleKo": "",
  "example": "",
  "exampleKo": "",
  "bibleExample": "",
  "bibleExampleKo": "",
  "bibleReference": ""
}`;
}
function parseJsonObject(raw) {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!isPlainObject(parsed)) {
        throw new Error('AI response must be a JSON object.');
    }
    return parsed;
}
function validateBibleWordMeaningPayload(rawPayload, context) {
    const errors = [];
    const warnings = [];
    if (!context.normalizedWord)
        errors.push('target word is empty.');
    if (!context.verseText)
        errors.push('verseText is required for Bible word meaning.');
    if (!isPlainObject(rawPayload))
        errors.push('AI response must be a JSON object.');
    const targetToken = findTargetToken(context);
    if (!targetToken)
        errors.push('target word is not present in the current verse.');
    if (errors.length > 0 || !isPlainObject(rawPayload)) {
        return { ok: false, errors, warnings };
    }
    const payload = rawPayload;
    const selectedWord = getString(payload.selectedWord) || getString(payload.word);
    const selectedNormalized = normalizeBibleWord(selectedWord);
    if (!selectedWord)
        errors.push('selectedWord is required.');
    if (selectedNormalized && selectedNormalized !== context.normalizedWord) {
        errors.push('selectedWord does not match the requested word.');
    }
    const meaning = getString(payload.contextMeaning) || getString(payload.meaning);
    const partOfSpeech = getString(payload.partOfSpeech);
    const lemma = getString(payload.lemma) || getString(payload.baseForm);
    const inflection = getString(payload.inflection);
    const inflectionPattern = getString(payload.inflectionPattern);
    const phonetic = getString(payload.phonetic);
    const koreanPronunciation = getString(payload.koreanPronunciation);
    if (!meaning)
        errors.push('meaning/contextMeaning is required.');
    if (!partOfSpeech)
        errors.push('partOfSpeech is required.');
    if (!lemma)
        errors.push('lemma is required.');
    if (!inflection)
        errors.push('inflection is required.');
    const hint = inferContextPartOfSpeechHint(context);
    if (hint && partOfSpeech && !partOfSpeechMatchesHint(partOfSpeech, hint)) {
        errors.push(`partOfSpeech does not match the current verse context (${hint}).`);
    }
    if (lemma &&
        !isCompatibleLemma(context.normalizedWord, normalizeBibleWord(lemma)) &&
        !patternIncludesWordFamily(inflectionPattern, context.normalizedWord, normalizeBibleWord(lemma))) {
        errors.push('lemma and selected word do not look like the same word family.');
    }
    if (errors.length > 0) {
        return { ok: false, errors, warnings };
    }
    const referenceMeanings = getStringArray(payload.referenceMeanings).slice(0, 3);
    const phrase = getString(payload.phrase) || getString(payload.phrasalVerb);
    const phraseMeaning = getString(payload.phraseMeaning) || getString(payload.phrasalVerbMeaning);
    const validPhrase = phrase && phraseOccursInVerse(phrase, context);
    if (phrase && !validPhrase) {
        warnings.push('phrase/phrasalVerb was removed because it is not present in the current verse.');
    }
    const bibleExample = getString(payload.bibleExample);
    const bibleExampleKo = getString(payload.bibleExampleKo);
    const bibleReference = getString(payload.bibleReference);
    const validBibleExample = bibleExample && textContainsNormalizedWord(bibleExample, context.normalizedWord);
    if (bibleExample && !validBibleExample) {
        warnings.push('bibleExample was removed because it does not contain the selected word.');
    }
    if (bibleReference && !validBibleExample) {
        warnings.push('bibleReference was removed because no verifiable Bible example was accepted.');
    }
    const removedInvalidBibleExample = Boolean(bibleExample && !validBibleExample);
    const normalizedPayload = {
        selectedWord: selectedWord || context.word,
        word: context.word,
        meaning,
        contextMeaning: meaning,
        referenceMeanings,
        partOfSpeech,
        lemma,
        baseForm: lemma,
        inflection,
        inflectionPattern,
        phonetic,
        koreanPronunciation,
        phrase: validPhrase ? phrase : '',
        phraseMeaning: validPhrase ? phraseMeaning : '',
        phrasalVerb: validPhrase ? phrase : '',
        phrasalVerbMeaning: validPhrase ? phraseMeaning : '',
        phrasalVerbExample: '',
        phrasalVerbExampleKo: '',
        example: '',
        exampleKo: '',
        bibleExample: validBibleExample ? bibleExample : '',
        bibleExampleKo: validBibleExample ? bibleExampleKo : '',
        bibleReference: validBibleExample ? bibleReference : '',
        exampleNotice: removedInvalidBibleExample ? exports.BIBLE_EXAMPLE_NOT_FOUND_MESSAGE : '',
        validationStatus: 'verified',
        validationWarnings: warnings,
    };
    const inferredPattern = inferIrregularPattern(context.normalizedWord, normalizeBibleWord(lemma));
    if (!normalizedPayload.inflectionPattern && inferredPattern) {
        normalizedPayload.inflectionPattern = inferredPattern;
    }
    return { ok: true, payload: normalizedPayload, errors, warnings };
}
function buildSafeBibleWordMeaningFallback(context, reason) {
    const wordMissing = !verseContainsTargetWord(context);
    return {
        selectedWord: context.word,
        word: context.word,
        meaning: wordMissing
            ? '이 구절에서 선택한 단어를 확인하지 못했습니다.'
            : '검증된 단어 뜻을 만들지 못했습니다.',
        contextMeaning: '',
        referenceMeanings: [],
        partOfSpeech: '',
        lemma: '',
        baseForm: '',
        inflection: '',
        inflectionPattern: '',
        phonetic: '',
        koreanPronunciation: '',
        phrase: '',
        phraseMeaning: '',
        phrasalVerb: '',
        phrasalVerbMeaning: '',
        phrasalVerbExample: '',
        phrasalVerbExampleKo: '',
        example: '',
        exampleKo: '',
        bibleExample: '',
        bibleExampleKo: '',
        bibleReference: '',
        exampleNotice: exports.BIBLE_EXAMPLE_NOT_FOUND_MESSAGE,
        validationStatus: 'safe_fallback',
        validationWarnings: reason ? ['word meaning validation failed'] : [],
    };
}
function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function getString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function getStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((item) => getString(item)).filter(Boolean);
}
function findTargetToken(context) {
    const tokens = tokenizeEnglishText(context.verseText);
    return tokens.find((token) => token.normalized === context.normalizedWord) || null;
}
function textContainsNormalizedWord(text, normalizedWord) {
    return tokenizeEnglishText(text).some((token) => token.normalized === normalizedWord);
}
function phraseOccursInVerse(phrase, context) {
    const phraseTokens = tokenizeEnglishText(phrase).map((token) => token.normalized);
    if (phraseTokens.length < 2)
        return false;
    if (!phraseTokens.includes(context.normalizedWord))
        return false;
    const verseTokens = tokenizeEnglishText(context.verseText).map((token) => token.normalized);
    for (let start = 0; start <= verseTokens.length - phraseTokens.length; start += 1) {
        const slice = verseTokens.slice(start, start + phraseTokens.length);
        if (slice.every((token, index) => token === phraseTokens[index]))
            return true;
    }
    return false;
}
function inferContextPartOfSpeechHint(context) {
    const tokens = tokenizeEnglishText(context.verseText);
    const tokenIndex = tokens.findIndex((token) => token.normalized === context.normalizedWord);
    if (tokenIndex === -1)
        return null;
    const token = tokens[tokenIndex];
    const previous = tokenIndex > 0 ? tokens[tokenIndex - 1].normalized : '';
    const next = tokenIndex < tokens.length - 1 ? tokens[tokenIndex + 1].normalized : '';
    const irregular = IRREGULAR_FORM_LOOKUP.get(token.normalized);
    if ((irregular === null || irregular === void 0 ? void 0 : irregular.roles.has('participle')) && (BE_FORMS.has(previous) || HAVE_FORMS.has(previous))) {
        return 'pastParticiple';
    }
    void next;
    return null;
}
function partOfSpeechMatchesHint(partOfSpeech, hint) {
    const pos = partOfSpeech.toLowerCase();
    switch (hint) {
        case 'pastParticiple':
            return includesAny(pos, ['동사', '분사', '형용사', 'participle', 'adjective'])
                && includesAny(pos, ['분사', '수동', '과거', '형용사', 'participle', 'adjective']);
        default:
            return true;
    }
}
function includesAny(value, needles) {
    return needles.some((needle) => value.includes(needle));
}
function isCompatibleLemma(normalizedWord, normalizedLemma) {
    if (!normalizedWord || !normalizedLemma)
        return false;
    if (normalizedWord === normalizedLemma)
        return true;
    const irregular = IRREGULAR_FORM_LOOKUP.get(normalizedWord);
    if (irregular && irregular.lemma === normalizedLemma)
        return true;
    if (isRegularInflectionOf(normalizedWord, normalizedLemma))
        return true;
    if (isIrregularPluralOf(normalizedWord, normalizedLemma))
        return true;
    return false;
}
function patternIncludesWordFamily(pattern, word, lemma) {
    if (!pattern || !word || !lemma)
        return false;
    const patternWords = new Set(tokenizeEnglishText(pattern).map((token) => token.normalized));
    return patternWords.has(word) && patternWords.has(lemma);
}
function isRegularInflectionOf(word, lemma) {
    const forms = new Set([
        `${lemma}s`,
        `${lemma}es`,
        `${lemma}ed`,
        `${lemma}ing`,
        `${lemma}er`,
        `${lemma}est`,
    ]);
    if (lemma.endsWith('e')) {
        const stem = lemma.slice(0, -1);
        forms.add(`${lemma}d`);
        forms.add(`${stem}ing`);
        forms.add(`${lemma}r`);
        forms.add(`${lemma}st`);
    }
    if (lemma.endsWith('y') && lemma.length > 1) {
        const stem = lemma.slice(0, -1);
        forms.add(`${stem}ies`);
        forms.add(`${stem}ied`);
        forms.add(`${stem}ier`);
        forms.add(`${stem}iest`);
    }
    if (lemma.length >= 3) {
        const doubled = `${lemma}${lemma[lemma.length - 1]}`;
        forms.add(`${doubled}ed`);
        forms.add(`${doubled}ing`);
    }
    return forms.has(word);
}
function isIrregularPluralOf(word, lemma) {
    const plurals = new Map([
        ['men', 'man'],
        ['women', 'woman'],
        ['children', 'child'],
        ['brethren', 'brother'],
        ['feet', 'foot'],
        ['teeth', 'tooth'],
        ['oxen', 'ox'],
    ]);
    return plurals.get(word) === lemma;
}
function inferIrregularPattern(word, lemma) {
    const irregular = IRREGULAR_FORM_LOOKUP.get(word);
    return irregular && irregular.lemma === lemma ? irregular.pattern : '';
}
