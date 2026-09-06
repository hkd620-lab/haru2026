/* eslint-disable no-console */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src/englishBibleWordMeaning.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'src/index.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
  },
  fileName: sourcePath,
}).outputText;

const testModule = new Module(sourcePath, module);
testModule.filename = sourcePath;
testModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
testModule._compile(compiled, sourcePath);

const {
  BIBLE_EXAMPLE_NOT_FOUND_MESSAGE,
  buildBibleWordMeaningCacheKey,
  buildBibleWordMeaningContext,
  buildSafeBibleWordMeaningFallback,
  cachedBibleWordMeaningMatchesContext,
  hashBibleVerseText,
  isValidBibleVerseKey,
  normalizeBibleVerseText,
  validateBibleWordMeaningPayload,
} = testModule.exports;

function validate(input, payload) {
  const context = buildBibleWordMeaningContext(input);
  return validateBibleWordMeaningPayload(payload, context);
}

function validPayload(overrides = {}) {
  return {
    selectedWord: 'light',
    meaning: '빛',
    contextMeaning: '빛',
    referenceMeanings: ['밝음'],
    partOfSpeech: '명사',
    lemma: 'light',
    inflection: '원형',
    inflectionPattern: '',
    phonetic: '/laɪt/',
    koreanPronunciation: '라이트',
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
    ...overrides,
  };
}

{
  const cases = [
    {
      word: 'water',
      verseText: 'Jesus answered and said unto her, If thou knewest the gift of God, thou wouldest have asked of him, and he would have given thee living water.',
      payload: {
        selectedWord: 'water',
        meaning: '물',
        contextMeaning: '물',
        partOfSpeech: '명사',
        lemma: 'water',
        inflection: '원형',
      },
    },
    {
      word: 'after',
      verseText: 'And the tree yielding fruit after his kind.',
      payload: {
        selectedWord: 'after',
        meaning: '~에 따라',
        contextMeaning: '~에 따라',
        partOfSpeech: '전치사',
        lemma: 'after',
        inflection: '원형',
      },
    },
    {
      word: 'priest',
      verseText: 'And the priest shall burn the memorial of it.',
      payload: {
        selectedWord: 'priest',
        meaning: '제사장',
        contextMeaning: '제사장',
        partOfSpeech: '명사',
        lemma: 'priest',
        inflection: '원형',
      },
    },
    {
      word: 'Let',
      verseText: 'And God said, Let there be light.',
      payload: {
        selectedWord: 'Let',
        meaning: '~하게 하라',
        contextMeaning: '~하게 하라',
        partOfSpeech: '동사',
        lemma: 'let',
        inflection: '명령형',
      },
    },
    {
      word: 'that',
      verseText: 'And he that knew not did commit things worthy of stripes.',
      payload: {
        selectedWord: 'that',
        meaning: '~하는 사람',
        contextMeaning: '~하는 사람',
        partOfSpeech: '관계대명사',
        lemma: 'that',
        inflection: '원형',
      },
    },
    {
      word: 'that',
      verseText: 'And God saw the light, that it was good.',
      payload: {
        selectedWord: 'that',
        meaning: '~라는 것을',
        contextMeaning: '~라는 것을',
        partOfSpeech: '접속사',
        lemma: 'that',
        inflection: '원형',
      },
    },
    {
      word: 'good',
      verseText: 'And God saw the light, that it was good.',
      payload: {
        selectedWord: 'good',
        meaning: '좋은',
        contextMeaning: '좋은',
        partOfSpeech: '형용사',
        lemma: 'good',
        inflection: '원형',
      },
    },
  ];

  for (const item of cases) {
    const result = validate(
      { word: item.word, verseText: item.verseText, verseKey: 'genesis_1_4' },
      validPayload(item.payload)
    );
    assert.equal(result.ok, true, `${item.word} should pass: ${result.errors.join(', ')}`);
  }
}

{
  const result = validate(
    {
      word: 'beaten',
      verseText: 'And that servant shall be beaten with many stripes.',
      verseKey: 'luke_12_47',
    },
    validPayload({
      selectedWord: 'beaten',
      meaning: '매를 맞은',
      contextMeaning: '매를 맞은',
      partOfSpeech: '동사의 과거분사',
      lemma: 'beat',
      inflection: '과거분사',
      inflectionPattern: 'beat - beat - beaten',
      phonetic: '/ˈbiːtn/',
      koreanPronunciation: '비튼',
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.payload.lemma, 'beat');
  assert.equal(result.payload.inflectionPattern, 'beat - beat - beaten');

  const wrongPartOfSpeech = validate(
    {
      word: 'beaten',
      verseText: 'And that servant shall be beaten with many stripes.',
      verseKey: 'luke_12_47',
    },
    validPayload({
      selectedWord: 'beaten',
      meaning: '매를 맞은',
      contextMeaning: '매를 맞은',
      partOfSpeech: '명사',
      lemma: 'beat',
      inflection: '과거분사',
      inflectionPattern: 'beat - beat - beaten',
    })
  );
  assert.equal(wrongPartOfSpeech.ok, false);
  assert.match(wrongPartOfSpeech.errors.join('\n'), /partOfSpeech/);
}

{
  const result = validate(
    {
      word: 'given',
      verseText: 'For unto whomsoever much is given, of him shall be much required.',
      verseKey: 'luke_12_48',
    },
    validPayload({
      selectedWord: 'given',
      meaning: '주어진',
      contextMeaning: '주어진',
      partOfSpeech: '동사의 과거분사',
      lemma: 'give',
      inflection: '과거분사',
      inflectionPattern: '',
      phonetic: '/ˈɡɪvən/',
      koreanPronunciation: '기븐',
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.payload.inflectionPattern, 'give - gave - given');
}

{
  const nounResult = validate(
    {
      word: 'light',
      verseText: 'And God saw the light, that it was good.',
      verseKey: 'genesis_1_4',
    },
    validPayload()
  );
  assert.equal(nounResult.ok, true);

  const verbResult = validate(
    {
      word: 'light',
      verseText: 'They light the lamp before evening.',
      verseKey: 'test_1_1',
    },
    validPayload({
      partOfSpeech: '동사',
      inflection: '현재형',
    })
  );
  assert.equal(verbResult.ok, true);

}

{
  const result = validate(
    {
      word: 'bring',
      verseText: 'And God said, Let the earth bring forth grass.',
      verseKey: 'genesis_1_11',
    },
    validPayload({
      selectedWord: 'bring',
      meaning: '내다',
      contextMeaning: '내다',
      partOfSpeech: '동사',
      lemma: 'bring',
      inflection: '원형',
      phrase: 'bring forth',
      phraseMeaning: '생겨나게 하다',
      phrasalVerb: 'bring forth',
      phrasalVerbMeaning: '생겨나게 하다',
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.payload.phrasalVerb, 'bring forth');
}

{
  const result = validate(
    {
      word: 'bring',
      verseText: 'And God said, Let the earth bring forth grass.',
      verseKey: 'genesis_1_11',
    },
    validPayload({
      selectedWord: 'bring',
      meaning: '내다',
      contextMeaning: '내다',
      partOfSpeech: '동사',
      lemma: 'bring',
      inflection: '원형',
      phrase: 'bring up',
      phraseMeaning: '기르다',
      phrasalVerb: 'bring up',
      phrasalVerbMeaning: '기르다',
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.payload.phrasalVerb, '');
  assert.match(result.warnings.join('\n'), /not present/);
}

{
  const result = validate(
    {
      word: 'light',
      verseText: 'And God saw the light, that it was good.',
      verseKey: 'genesis_1_4',
    },
    validPayload({
      bibleExample: 'And God called the dry land Earth.',
      bibleExampleKo: '하나님이 마른 땅을 땅이라 부르셨습니다.',
      bibleReference: 'Genesis 1:10',
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.payload.bibleExample, '');
  assert.equal(result.payload.bibleReference, '');
  assert.equal(result.payload.exampleNotice, BIBLE_EXAMPLE_NOT_FOUND_MESSAGE);
}

{
  const result = validate(
    {
      word: 'light',
      verseText: 'And God saw the light, that it was good.',
      verseKey: 'genesis_1_4',
    },
    validPayload({
      partOfSpeech: '',
    })
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /partOfSpeech is required/);
}

{
  const result = validate(
    {
      word: 'light',
      verseText: 'And God saw the earth, that it was good.',
      verseKey: 'genesis_1_10',
    },
    validPayload()
  );
  assert.equal(result.ok, false);

  const fallback = buildSafeBibleWordMeaningFallback(
    buildBibleWordMeaningContext({
      word: 'light',
      verseText: 'And God saw the earth, that it was good.',
      verseKey: 'genesis_1_10',
    }),
    'missing target'
  );
  assert.equal(fallback.validationStatus, 'safe_fallback');
  assert.equal(fallback.exampleNotice, BIBLE_EXAMPLE_NOT_FOUND_MESSAGE);
}

{
  const cacheA = buildBibleWordMeaningCacheKey(buildBibleWordMeaningContext({
    word: 'light',
    verseText: 'And God saw the light, that it was good.',
    verseKey: 'genesis_1_4',
  }));
  const cacheB = buildBibleWordMeaningCacheKey(buildBibleWordMeaningContext({
    word: 'light',
    verseText: 'And God said, Let there be light.',
    verseKey: 'genesis_1_4',
  }));
  assert.match(cacheA, /^bible_genesis_1_4_[0-9a-f]{16}_light$/);
  assert.notEqual(cacheA, cacheB);
}

{
  const context = buildBibleWordMeaningContext({
    word: 'light',
    verseText: 'And God saw the light, that it was good.',
    verseKey: 'genesis_1_4',
  });
  const cached = {
    ...validPayload(),
    selectedWord: 'light',
    verseKey: 'genesis_1_4',
    verseText: 'And God saw the light, that it was good.',
    normalizedVerseText: normalizeBibleVerseText('And God saw the light, that it was good.'),
    verseTextHash: hashBibleVerseText('And God saw the light, that it was good.'),
  };
  assert.equal(cachedBibleWordMeaningMatchesContext(cached, context), true);

  const manipulated = {
    ...cached,
    verseText: 'And God said, Let there be light.',
    normalizedVerseText: normalizeBibleVerseText('And God said, Let there be light.'),
    verseTextHash: hashBibleVerseText('And God said, Let there be light.'),
  };
  assert.equal(cachedBibleWordMeaningMatchesContext(manipulated, context), false);

  const validation = validateBibleWordMeaningPayload(manipulated, context);
  assert.equal(validation.ok, true);
  assert.equal(cachedBibleWordMeaningMatchesContext(manipulated, context), false);
}

{
  assert.equal(isValidBibleVerseKey('genesis_1_4'), true);
  assert.equal(isValidBibleVerseKey('Genesis 1:4'), false);
  assert.equal(isValidBibleVerseKey('diary_user_1'), false);
}

{
  assert.match(indexSource, /source !== 'bible' && hasBibleContextFields/);
  assert.match(indexSource, /requestedWord\.length > 64/);
  assert.match(indexSource, /context\.verseText\.length > 1200/);
  assert.match(indexSource, /isValidBibleVerseKey\(verseKey\)/);
  assert.match(indexSource, /cachedBibleWordMeaningMatchesContext\(cachedData, context\)/);
}

{
  const sourceHasSingleWordBranch = /if\s*\([^)]*['"`]beaten['"`]/.test(source);
  assert.equal(sourceHasSingleWordBranch, false);
}

console.log('englishBibleWordMeaning tests passed');
