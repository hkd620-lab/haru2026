/* eslint-disable no-console */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src/englishBibleWordMeaning.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
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

  const wrongVerbResult = validate(
    {
      word: 'light',
      verseText: 'They light the lamp before evening.',
      verseKey: 'test_1_1',
    },
    validPayload({
      partOfSpeech: '명사',
      inflection: '원형',
    })
  );
  assert.equal(wrongVerbResult.ok, false);
  assert.match(wrongVerbResult.errors.join('\n'), /partOfSpeech/);
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
    verseKey: 'genesis_1_3',
  }));
  assert.equal(cacheA, 'bible_genesis_1_4_light');
  assert.notEqual(cacheA, cacheB);
}

{
  const sourceHasSingleWordBranch = /if\s*\([^)]*['"`]beaten['"`]/.test(source);
  assert.equal(sourceHasSingleWordBranch, false);
}

console.log('englishBibleWordMeaning tests passed');
