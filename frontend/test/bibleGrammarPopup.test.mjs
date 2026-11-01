// BiblePage의 실제 문법·단어·음성 handler를 원문에서 꺼내 모의 callable로 실행해 팝업 상태와 요청 모양을 확인한다.
// 실행: node --test test/bibleGrammarPopup.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { transform } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBibleTtsRequest } from '../src/app/services/bibleTtsRequest.ts';

const source = readFileSync(new URL('../src/app/pages/BiblePage.tsx', import.meta.url), 'utf8');

function slice(startMark, endMark) {
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark, start);
  assert.ok(start >= 0 && end > start, `${startMark} 원문을 찾지 못했습니다.`);
  return source.slice(start, end);
}

const handlers = [
  slice('const toGrammarText =', 'export function BiblePage()'),
  slice('  const stopAllTTS = () => {', '  // 한국어 TTS 듣기'),
  slice('  const handleGrammarClick = useCallback', '  const handleTranslationClick ='),
  slice('  const closeWordPopup = useCallback', '  useEffect(() => {\n    if (!wordPopup) return;'),
  slice('  const handleWordClick = useCallback', '  const renderVerseWithWords ='),
  slice('  const renderGrammarWords =', '  const handleFullChapterTTS ='),
  slice('  const handleFullChapterTTS =', '  const handleFullChapterKoreanTTS ='),
  // 페이지 이탈 cleanup이 없으면 빈 문자열이 되어 cleanup 시험이 실패한다.
  /  useEffect\(\(\) => \(\) => \{\n\s+ttsRequestRef\.current \+= 1;\n\s+\}, \[\]\);\n/.exec(source)?.[0] ?? '',
].join('\n').replaceAll('await import(\'firebase/functions\')', 'firebaseFunctions');

const { code } = await transform(
  `${handlers}\nObject.assign(globalThis, { handleGrammarClick, handleWordClick, closeWordPopup, closeGrammarPopup, handleTTS, handleFullChapterTTS, renderGrammarWords, renderNativeListenButton, stopAllTTS });`,
  { loader: 'tsx', jsx: 'transform', jsxFactory: 'createElement' },
);

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fixture() {
  const calls = [];
  const state = { grammar: null, word: null, ttsLoading: null, ttsPlaying: null, ttsPaused: null, played: [], paused: [], audios: [], alerts: [], playFailures: 0, playGate: null, silentGate: null, cleanups: [] };
  const apply = (value, previous) => (typeof value === 'function' ? value(previous) : value);
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.playing = false;
      this.pauseCount = 0;
      if (!src.startsWith('data:')) state.audios.push(this);
    }
    async play() {
      if (this.src.startsWith('data:')) {
        if (state.silentGate) await state.silentGate;
        return;
      }
      if (state.playFailures > 0) { state.playFailures -= 1; throw new Error('NotAllowedError'); }
      state.played.push(this.src);
      if (state.playGate) await state.playGate;
      this.playing = true;
    }
    pause() {
      this.playing = false;
      this.pauseCount += 1;
      state.paused.push(this.src);
    }
    addEventListener() {}
  }
  const httpsCallable = (_fns, name) => (payload) => {
    const pending = deferred();
    calls.push({ name, payload, ...pending });
    return pending.promise;
  };
  const context = {
    createElement, console: { warn() {}, error() {} }, setTimeout, clearInterval, setInterval, Promise,
    URL, Uint8Array, Blob, atob,
    window: {},
    Audio: FakeAudio,
    alert: (message) => { state.alerts.push(message); },
    useCallback: (fn) => fn,
    useEffect: (effect) => { state.cleanups.push(effect()); },
    grammarRequestRef: { current: 0 }, wordRequestRef: { current: 0 }, ttsRequestRef: { current: 0 },
    highlightTimerRef: { current: null }, audioRef: { current: null }, audioCtxRef: { current: null },
    currentBook: { prefix: 'genesis' }, currentChapter: 1,
    genesisData: { verses: [{ verse: 1, text: 'In the beginning' }] },
    koVoice: 'nova', enVoice: 'onyx', ttsSpeed: 1,
    get ttsPaused() { return state.ttsPaused; },
    get ttsPlaying() { return state.ttsPlaying; },
    get ttsLoading() { return state.ttsLoading; },
    GrapeLoadingMini: () => null,
    setGrammarPopup: (value) => { state.grammar = apply(value, state.grammar); },
    setWordPopup: (value) => { state.word = apply(value, state.word); },
    setVocabMemo() {}, setVocabExample() {}, setVocabSaved() {},
    setTtsLoading: (value) => { state.ttsLoading = value; },
    setTtsPlaying: (value) => { state.ttsPlaying = value; },
    setTtsPaused: (value) => { state.ttsPaused = value; }, setHighlightedWord() {},
    setHighlightedEnWords() {}, setSelectedVerse() {}, setIsFullPlaying() {}, setIsSequentialPlaying() {},
    setIsBookPlaying() {}, setBookPlayingChapter() {},
    saveProgress() {}, buildBibleTtsRequest,
    getFunctions: () => ({}), httpsCallable,
    firebaseFunctions: { getFunctions: () => ({}), httpsCallable },
  };
  vm.runInNewContext(code, context);
  context.unmountPage = () => {
    assert.ok(state.cleanups.some(Boolean), '페이지 이탈 cleanup이 있어야 한다');
    state.cleanups.forEach((cleanup) => cleanup?.());
  };
  return { context, state, calls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const verse = (n, text = `Verse ${n}`) => ({ verse: n, text });
const waitForRetry = () => new Promise((resolve) => setTimeout(resolve, 350));

// 첫 play가 거부된 뒤 300ms 재시도의 두 번째 play가 대기 중인 상태까지 진행한다.
async function enterRetryPlay(key = 'grammar_verse_genesis_1_1') {
  const harness = fixture();
  const { context, calls, state } = harness;
  const gate = deferred();
  state.playFailures = 1;
  state.playGate = gate.promise;
  context.handleTTS('one', key, 'native');
  await flush();
  await flush();
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
  await waitForRetry();
  assert.deepEqual(state.played, ['https://audio.test/one'], '두 번째 play가 대기 중이어야 한다');
  assert.equal(state.ttsLoading, key);
  state.playGate = null;
  return { ...harness, gate, audio: state.audios[0] };
}

// 재생을 시작해 일시정지한 뒤, 이어 듣기의 play가 대기 중인 상태까지 진행한다.
async function enterPausedResume(key = 'grammar_verse_genesis_1_1', quality = key.startsWith('grammar_') ? 'native' : undefined) {
  const harness = fixture();
  const { context, calls, state } = harness;
  context.handleTTS('one', key, quality);
  await flush();
  await flush();
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
  await flush();
  await flush();
  await context.handleTTS('one', key, quality);
  assert.equal(state.ttsPaused, key);
  const gate = deferred();
  state.playGate = gate.promise;
  const resumed = context.handleTTS('one', key, quality);
  await flush();
  state.playGate = null;
  return { ...harness, gate, resumed, key, audio: state.audios[0] };
}

const cancelResponses = {
  closeGrammarPopup: ({ context }) => context.closeGrammarPopup(),
  stopAllTTS: ({ context }) => context.stopAllTTS(),
  unmountPage: ({ context }) => context.unmountPage(),
};

test('늦게 도착한 이전 절 응답과 실패는 새 절 팝업을 덮지 않는다', async () => {
  const { context, state, calls } = fixture();
  context.handleGrammarClick(verse(1));
  await flush();
  context.handleGrammarClick(verse(2));
  await flush();
  assert.deepEqual(calls.map((call) => call.payload.verseKey), ['genesis_1_1', 'genesis_1_2']);

  calls[1].resolve({ data: { verb: 'second' } });
  await flush();
  calls[0].resolve({ data: { verb: 'first' } });
  await flush();
  assert.equal(state.grammar.verseKey, 'genesis_1_2');
  assert.equal(state.grammar.verb, 'second');

  context.handleGrammarClick(verse(3));
  await flush();
  context.handleGrammarClick(verse(4));
  await flush();
  calls[2].reject(new Error('fail'));
  await flush();
  assert.equal(state.grammar.verseKey, 'genesis_1_4');
  assert.equal(state.grammar.loading, true);
});

test('닫은 뒤 도착한 문법 성공·실패 응답은 팝업을 다시 열지 않는다', async () => {
  for (const settle of ['resolve', 'reject']) {
    const { context, state, calls } = fixture();
    context.handleGrammarClick(verse(1));
    await flush();
    context.closeGrammarPopup();
    calls[0][settle](settle === 'resolve' ? { data: { verb: 'late' } } : new Error('fail'));
    await flush();
    assert.equal(state.grammar, null);
  }
});

test('다른 장으로 넘어가도 열린 팝업은 처음 고른 절의 키로 응답을 받는다', async () => {
  const { context, state, calls } = fixture();
  context.handleGrammarClick(verse(5));
  await flush();
  context.currentChapter = 2;
  calls[0].resolve({ data: { verb: 'kept', mysentence: 'I go' } });
  await flush();
  assert.equal(state.grammar.verseKey, 'genesis_1_5');
  assert.equal(state.grammar.verb, 'kept');
});

test('문법 객체 응답은 문자열로 표시한다', async () => {
  const { context, state, calls } = fixture();
  context.handleGrammarClick(verse(1));
  await flush();
  calls[0].resolve({ data: { verb: { said: '말하다', was: '이다' } } });
  await flush();
  assert.equal(state.grammar.verb, '말하다 / 이다');
});

test('팝업 단어는 키보드로 누를 수 있는 버튼이고 현재 서버가 요구하는 verseKey를 보낸다', async () => {
  const { context, state, calls } = fixture();
  const element = context.renderGrammarWords('Let there — be light.', 'genesis_1_3');
  const markup = renderToStaticMarkup(element);
  assert.equal(markup.match(/<button type="button"/g).length, 4);
  assert.match(markup, /aria-label="light\. 단어 뜻 보기"/);
  assert.match(markup, /<span>—<\/span>/);

  const light = element.props.children[4];
  let stopped = false;
  light.props.onClick({ stopPropagation: () => { stopped = true; } });
  await flush();
  assert.equal(stopped, true, '문법 팝업 배경 클릭으로 번지지 않는다');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload)), {
    word: 'light', source: 'bible', verseText: 'Let there — be light.', verseKey: 'genesis_1_3',
  });
  assert.equal(calls[0].name, 'getWordMeaning');
  calls[0].resolve({ data: { contextMeaning: '빛' } });
  await flush();
  assert.equal(state.word.meaning, '빛');
  assert.equal(state.grammar, null, '단어 팝업은 문법 팝업 상태를 바꾸지 않는다');
});

test('단어 뜻도 닫거나 다른 단어를 고른 뒤의 늦은 응답을 반영하지 않는다', async () => {
  const { context, state, calls } = fixture();
  context.handleWordClick('first', 'first second', 'genesis_1_1');
  await flush();
  context.handleWordClick('second', 'first second', 'genesis_1_1');
  await flush();
  calls[1].resolve({ data: { contextMeaning: '둘째' } });
  await flush();
  calls[0].resolve({ data: { contextMeaning: '첫째' } });
  await flush();
  assert.equal(state.word.meaning, '둘째');

  context.handleWordClick('third', 'third', 'genesis_1_1');
  await flush();
  context.closeWordPopup();
  calls[2].reject(new Error('fail'));
  await flush();
  assert.equal(state.word, null);
});

test('단어 뜻 팝업은 문법 팝업보다 위에 표시한다', () => {
  const zIndexOf = (mark) => {
    const start = source.indexOf(mark);
    return Number(/zIndex: (\d+)/.exec(source.slice(start))[1]);
  };
  assert.ok(zIndexOf('{/* 단어 뜻 팝업 */}') > zIndexOf('{/* 문법 해설 팝업 */}'));
});

test('고음질 버튼만 native 요청을 보내고 일반 음성 요청은 기존 모양을 유지한다', async () => {
  const { context, calls, state } = fixture();
  const button = context.renderNativeListenButton('Let there be light', 'grammar_verse_genesis_1_3');
  button.props.onClick();
  await flush();
  await flush();
  assert.equal(calls[0].name, 'generateTTS');
  assert.equal(calls[0].payload.quality, 'native');
  assert.equal(calls[0].payload.voice, 'onyx');
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/native' } });
  await flush();
  await flush();
  assert.deepEqual(state.played.at(-1), 'https://audio.test/native');

  context.handleTTS('In the beginning', 'verse_1');
  await flush();
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].payload)), {
    text: 'In the beginning', cacheKey: 'bible_genesis_1_verse_1_onyx', voice: 'onyx',
  });
});

test('문법 팝업을 닫거나 다른 음성을 누르면 늦은 음성이 재생되지 않는다', async () => {
  const { context, calls, state } = fixture();
  context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
  await flush();
  await flush();
  context.closeGrammarPopup();
  assert.equal(state.ttsLoading, null);
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/late' } });
  await flush();
  await flush();
  assert.ok(!state.played.includes('https://audio.test/late'));

  context.handleTTS('two', 'grammar_verb_genesis_1_1', 'native');
  await flush();
  await flush();
  context.handleTTS('three', 'grammar_mysentence_genesis_1_1', 'native');
  await flush();
  await flush();
  calls[2].resolve({ data: { audioUrl: 'https://audio.test/three' } });
  await flush();
  await flush();
  calls[1].resolve({ data: { audioUrl: 'https://audio.test/two' } });
  await flush();
  await flush();
  assert.equal(state.played.at(-1), 'https://audio.test/three');
  assert.ok(!state.played.includes('https://audio.test/two'));
});

test('고음질 버튼은 보이는 글자와 접근성 이름 모두 AI 음성임을 알린다', () => {
  const { context } = fixture();
  const markup = renderToStaticMarkup(context.renderNativeListenButton('Let there be light', 'grammar_verse_genesis_1_3'));
  assert.match(markup, /type="button"[^>]*aria-label="AI 고음질 듣기"/);
  assert.match(markup, /title="[^"]*AI가 만든 음성/);
  assert.match(markup, />🔊 AI 고음질 듣기<\/button>/);
  assert.equal(source.includes('원어민'), false, '사람 목소리로 오해할 표현을 남기지 않는다');
});

test('불러오는 중 같은 고음질 버튼을 다시 눌러도 요청은 한 번이다', async () => {
  const { context, calls } = fixture();
  const key = 'grammar_verse_genesis_1_3';
  context.handleTTS('one', key, 'native');
  await flush();
  await flush();
  context.handleTTS('one', key, 'native');
  await flush();
  await flush();
  assert.equal(calls.length, 1);
});

test('전체 정지는 불러오는 중인 음성을 취소하고 로딩 표시를 지운다', async () => {
  const { context, calls, state } = fixture();
  context.handleTTS('one', 'verse_1');
  await flush();
  await flush();
  context.stopAllTTS();
  assert.equal(state.ttsLoading, null);
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/late' } });
  await flush();
  await flush();
  assert.deepEqual(state.played, []);
  assert.equal(state.ttsPlaying, null);
});

test('재생을 시작하는 사이 정지하면 이미 시작된 소리도 끈다', async () => {
  const { context, calls, state } = fixture();
  let releasePlay;
  state.playGate = new Promise((resolve) => { releasePlay = resolve; });
  context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
  await flush();
  await flush();
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
  await flush();
  await flush();
  assert.deepEqual(state.played, ['https://audio.test/one']);
  context.closeGrammarPopup();
  releasePlay();
  await flush();
  await flush();
  assert.ok(state.paused.includes('https://audio.test/one'));
  assert.equal(state.ttsPlaying, null);
});

test('자동재생 재시도 전에 팝업을 닫으면 다시 재생하지 않는다', async () => {
  const { context, calls, state } = fixture();
  state.playFailures = 1;
  context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
  await flush();
  await flush();
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
  await flush();
  await flush();
  assert.equal(state.ttsLoading, 'grammar_verse_genesis_1_1', '재시도 전에는 취소할 수 있게 로딩을 유지한다');
  context.closeGrammarPopup();
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.deepEqual(state.played, []);
  assert.equal(state.ttsPlaying, null);
  assert.equal(state.ttsLoading, null);
});

test('재시도의 두 번째 play 대기 중 팝업을 닫거나 정지하면 소리와 재생 표시가 남지 않는다', async () => {
  for (const cancel of ['closeGrammarPopup', 'stopAllTTS']) {
    const { context, state, gate, audio } = await enterRetryPlay();
    context[cancel]();
    gate.resolve();
    await flush();
    await flush();
    assert.equal(audio.playing, false, `${cancel} 뒤 소리가 남으면 안 된다`);
    assert.equal(state.ttsPlaying, null);
    assert.equal(state.ttsLoading, null);
  }
});

test('이전 재시도가 늦게 끝나도 새 요청의 오디오와 표시를 건드리지 않는다', async () => {
  const newKey = 'grammar_verb_genesis_1_1';
  for (const settle of ['resolve', 'reject']) {
    const { context, calls, state, gate, audio } = await enterRetryPlay();
    context.handleTTS('two', newKey, 'native');
    await flush();
    await flush();
    calls[1].resolve({ data: { audioUrl: 'https://audio.test/two' } });
    await flush();
    await flush();
    const newAudio = state.audios[1];
    assert.equal(newAudio.playing, true);

    gate[settle](new Error('AbortError'));
    await flush();
    await flush();
    assert.equal(audio.playing, false);
    assert.equal(newAudio.playing, true, '이전 요청이 새 오디오를 멈추면 안 된다');
    assert.equal(newAudio.pauseCount, 0);
    assert.equal(state.ttsPlaying, newKey);
    assert.equal(state.ttsLoading, null);
  }
});

test('이전 재시도가 끝나도 새 요청의 로딩 표시를 지우지 않는다', async () => {
  const newKey = 'grammar_verb_genesis_1_1';
  for (const settle of ['resolve', 'reject']) {
    const { context, state, gate } = await enterRetryPlay();
    context.handleTTS('two', newKey, 'native');
    await flush();
    await flush();
    gate[settle](new Error('AbortError'));
    await flush();
    await flush();
    assert.equal(state.ttsLoading, newKey);
    assert.equal(state.ttsPlaying, null);
  }
});

test('재시도 대기 중 전체 장 재생이 오디오를 바꾸면 재시도가 끼어들지 않는다', async () => {
  // 전체 장 재생은 요청 번호를 올리지 않고 오디오만 교체한다.
  const fullChapterTakesOver = async ({ context, calls, state }) => {
    context.handleFullChapterTTS();
    await flush();
    calls.at(-1).resolve({ data: { audioUrl: 'https://audio.test/full' } });
    await flush();
    await flush();
    return state.audios.at(-1);
  };

  // 두 번째 play 대기 중
  for (const settle of ['resolve', 'reject']) {
    const harness = await enterRetryPlay();
    const fullAudio = await fullChapterTakesOver(harness);
    harness.gate[settle](new Error('AbortError'));
    await flush();
    await flush();
    assert.equal(harness.audio.playing, false);
    assert.equal(fullAudio.playing, true);
    assert.equal(fullAudio.pauseCount, 0);
    assert.equal(harness.state.ttsPlaying, 'full_chapter');
  }

  // 300ms 대기 중
  const harness = fixture();
  const { context, calls, state } = harness;
  state.playFailures = 1;
  context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
  await flush();
  await flush();
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
  await flush();
  await flush();
  const fullAudio = await fullChapterTakesOver(harness);
  await waitForRetry();
  assert.equal(state.audios[0].playing, false);
  assert.ok(!state.played.includes('https://audio.test/one'), '교체된 오디오를 다시 재생하지 않는다');
  assert.equal(state.played.filter((src) => src === 'https://audio.test/full').length, 1);
  assert.equal(fullAudio.pauseCount, 0);
  assert.equal(state.ttsPlaying, 'full_chapter');
});

test('자동재생 재시도가 성공하거나 끝내 실패해도 로딩이 풀리고 컨트롤이 정리된다', async () => {
  for (const [failures, playing] of [[1, 'grammar_verse_genesis_1_1'], [2, null]]) {
    const { context, calls, state } = fixture();
    state.playFailures = failures;
    context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
    await flush();
    await flush();
    calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(state.ttsLoading, null);
    assert.equal(state.ttsPlaying, playing);
  }
});

test('듣던 문장은 일시정지·재개되고 팝업을 닫으면 함께 끝난다', async () => {
  const { context, calls, state } = fixture();
  const key = 'grammar_verse_genesis_1_1';
  context.handleTTS('one', key, 'native');
  await flush();
  await flush();
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
  await flush();
  await flush();
  assert.equal(state.ttsPlaying, key);

  await context.handleTTS('one', key, 'native');
  assert.equal(state.ttsPaused, key);
  assert.equal(state.ttsPlaying, null);
  await context.handleTTS('one', key, 'native');
  assert.equal(state.ttsPlaying, key);
  assert.equal(calls.length, 1, '일시정지와 재개는 다시 요청하지 않는다');

  const pausedBefore = state.paused.length;
  context.closeGrammarPopup();
  assert.equal(state.paused.length, pausedBefore + 1);
  assert.equal(state.ttsPlaying, null);
  assert.equal(state.ttsPaused, null);
});

test('고음질 실패는 안내 후 버튼을 다시 쓸 수 있게 하고, 늦은 실패와 표준 음성은 알리지 않는다', async () => {
  const { context, calls, state } = fixture();
  const key = 'grammar_verse_genesis_1_1';
  context.handleTTS('one', key, 'native');
  await flush();
  await flush();
  calls[0].reject(new Error('fail'));
  await flush();
  await flush();
  assert.equal(state.ttsLoading, null);
  assert.equal(state.ttsPlaying, null);
  assert.match(state.alerts[0], /AI 고음질 음성을 불러오지 못했습니다/);

  context.handleTTS('one', key, 'native');
  await flush();
  await flush();
  assert.equal(calls.length, 2, '실패 뒤 같은 버튼으로 다시 시도할 수 있다');
  context.closeGrammarPopup();
  calls[1].reject(new Error('fail'));
  await flush();
  await flush();
  assert.equal(state.alerts.length, 1);

  context.handleTTS('two', 'verse_2');
  await flush();
  await flush();
  calls[2].reject(new Error('fail'));
  await flush();
  await flush();
  assert.equal(state.alerts.length, 1, '표준 음성의 기존 실패 표시는 바꾸지 않는다');
});

test('고음질 한도 초과는 한도 안내만 한 번 보여 준다', async () => {
  const { context, calls, state } = fixture();
  context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
  await flush();
  await flush();
  calls[0].reject(Object.assign(new Error('한도'), { code: 'functions/resource-exhausted' }));
  await flush();
  await flush();
  assert.equal(state.alerts.length, 1);
  assert.match(state.alerts[0], /사용 한도/);
});

const NATIVE_FAILURE = 'AI 고음질 음성을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

test('고음질 재시도까지 끝내 재생하지 못하면 안내를 한 번만 보여 주고 표준 음성은 알리지 않는다', async () => {
  for (const [quality, key, alerts] of [['native', 'grammar_verse_genesis_1_1', [NATIVE_FAILURE]], [undefined, 'verse_1', []]]) {
    const { context, calls, state } = fixture();
    state.playFailures = 2;
    context.handleTTS('one', key, quality);
    await flush();
    await flush();
    calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
    await waitForRetry();
    assert.deepEqual(state.alerts, alerts);
    assert.equal(state.ttsLoading, null);
    assert.equal(state.ttsPlaying, null);
  }
});

test('재생할 음성이 없는 응답은 고음질만 안내하고 표준 음성은 기존처럼 조용히 끝난다', async () => {
  for (const [quality, key, alerts] of [['native', 'grammar_verse_genesis_1_1', [NATIVE_FAILURE]], [undefined, 'verse_1', []]]) {
    const { context, calls, state } = fixture();
    context.handleTTS('one', key, quality);
    await flush();
    await flush();
    calls[0].resolve({ data: {} });
    await flush();
    await flush();
    assert.deepEqual(state.alerts, alerts);
    assert.deepEqual(state.audios, []);
    assert.equal(state.ttsLoading, null);
    assert.equal(state.ttsPlaying, null);
  }
});

test('취소한 고음질의 늦은 실패와 빈 응답은 안내하지 않는다', async () => {
  for (const [name, cancel] of Object.entries(cancelResponses)) {
    // 두 번째 play 대기 중 취소
    const retry = await enterRetryPlay();
    cancel(retry);
    retry.gate.reject(new Error('AbortError'));
    await flush();
    await flush();
    assert.deepEqual(retry.state.alerts, [], `${name} 뒤 재시도 실패`);

    // 재시도 타이머 대기 중 취소
    const timer = fixture();
    timer.state.playFailures = 2;
    timer.context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
    await flush();
    await flush();
    timer.calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
    await flush();
    await flush();
    cancel(timer);
    await waitForRetry();
    assert.deepEqual(timer.state.alerts, [], `${name} 뒤 재시도 타이머`);

    // 서버 응답 대기 중 취소
    for (const settle of [(call) => call.resolve({ data: {} }), (call) => call.reject(new Error('fail'))]) {
      const loading = fixture();
      loading.context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
      await flush();
      await flush();
      cancel(loading);
      settle(loading.calls[0]);
      await flush();
      await flush();
      assert.deepEqual(loading.state.alerts, [], `${name} 뒤 늦은 응답`);
    }
  }
});

test('이전 재시도의 늦은 실패는 새 요청을 방해하지 않고 안내하지 않는다', async () => {
  const { context, calls, state, gate } = await enterRetryPlay();
  context.handleTTS('two', 'grammar_verb_genesis_1_1', 'native');
  await flush();
  await flush();
  calls[1].resolve({ data: { audioUrl: 'https://audio.test/two' } });
  await flush();
  await flush();
  gate.reject(new Error('AbortError'));
  await flush();
  await flush();
  assert.deepEqual(state.alerts, []);
  assert.equal(state.audios[1].playing, true);
  assert.equal(state.ttsPlaying, 'grammar_verb_genesis_1_1');
});

test('페이지를 벗어나면 대기 중인 음성은 어느 단계에서도 소리와 안내를 남기지 않는다', async () => {
  // 무음 잠금해제 대기 중: 비용이 드는 서버 호출도 하지 않는다.
  {
    const { context, calls, state } = fixture();
    const silent = deferred();
    state.silentGate = silent.promise;
    context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
    await flush();
    context.unmountPage();
    silent.resolve();
    await flush();
    await flush();
    assert.equal(calls.length, 0);
  }

  // 서버 응답 대기 중
  {
    const { context, calls, state } = fixture();
    context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
    await flush();
    await flush();
    context.unmountPage();
    calls[0].resolve({ data: { audioUrl: 'https://audio.test/late' } });
    await flush();
    await flush();
    assert.deepEqual(state.audios, []);
    assert.deepEqual(state.alerts, []);
  }

  // AudioContext resume 대기 중
  {
    const { context, calls, state } = fixture();
    const resume = deferred();
    context.window.AudioContext = class { state = 'suspended'; resume() { return resume.promise; } };
    context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
    await flush();
    await flush();
    calls[0].resolve({ data: { audioUrl: 'https://audio.test/late' } });
    await flush();
    await flush();
    context.unmountPage();
    resume.resolve();
    await flush();
    await flush();
    assert.deepEqual(state.audios, []);
    assert.deepEqual(state.alerts, []);
  }

  // 첫 play 대기 중
  {
    const { context, calls, state } = fixture();
    const gate = deferred();
    state.playGate = gate.promise;
    context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
    await flush();
    await flush();
    calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
    await flush();
    await flush();
    context.unmountPage();
    gate.resolve();
    await flush();
    await flush();
    assert.equal(state.audios[0].playing, false);
    assert.equal(state.ttsPlaying, null);
    assert.deepEqual(state.alerts, []);
  }

  // 재시도 타이머 대기 중
  {
    const { context, calls, state } = fixture();
    state.playFailures = 1;
    context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
    await flush();
    await flush();
    calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
    await flush();
    await flush();
    context.unmountPage();
    await waitForRetry();
    assert.deepEqual(state.played, []);
    assert.deepEqual(state.alerts, []);
  }

  // 두 번째 play 대기 중
  {
    const { context, state, gate, audio } = await enterRetryPlay();
    context.unmountPage();
    gate.resolve();
    await flush();
    await flush();
    assert.equal(audio.playing, false);
    assert.equal(state.ttsPlaying, null);
    assert.deepEqual(state.alerts, []);
  }
});

test('페이지 이탈은 이미 재생 중인 음성의 기존 동작을 바꾸지 않는다', async () => {
  const { context, calls, state } = fixture();
  context.handleTTS('one', 'verse_1');
  await flush();
  await flush();
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
  await flush();
  await flush();
  context.unmountPage();
  assert.equal(state.audios[0].playing, true);
  assert.equal(state.audios[0].pauseCount, 0);
});

test('이어 듣기의 play 대기 중 취소하면 소리·재생 표시·안내가 남지 않는다', async () => {
  for (const [name, cancel] of Object.entries(cancelResponses)) {
    for (const settle of ['resolve', 'reject']) {
      const harness = await enterPausedResume();
      const { state, gate, resumed, audio } = harness;
      cancel(harness);
      gate[settle](new Error('AbortError'));
      await resumed;
      assert.equal(audio.playing, false, `${name}/${settle} 뒤 소리가 남으면 안 된다`);
      assert.equal(state.ttsPlaying, null, `${name}/${settle} 뒤 재생 표시가 남으면 안 된다`);
      assert.deepEqual(state.alerts, []);
    }
  }
});

test('이전 이어 듣기가 늦게 끝나도 새 요청의 오디오와 표시를 건드리지 않는다', async () => {
  const newKey = 'grammar_verb_genesis_1_1';
  for (const settle of ['resolve', 'reject']) {
    // 새 요청이 재생 중
    const playing = await enterPausedResume();
    playing.context.handleTTS('two', newKey, 'native');
    await flush();
    await flush();
    playing.calls[1].resolve({ data: { audioUrl: 'https://audio.test/two' } });
    await flush();
    await flush();
    const newAudio = playing.state.audios[1];
    playing.gate[settle](new Error('AbortError'));
    await playing.resumed;
    assert.equal(playing.audio.playing, false);
    assert.equal(newAudio.playing, true);
    assert.equal(newAudio.pauseCount, 0);
    assert.equal(playing.state.ttsPlaying, newKey);
    assert.equal(playing.state.ttsPaused, null);
    assert.deepEqual(playing.state.alerts, []);

    // 새 요청이 로딩 중
    const loading = await enterPausedResume();
    loading.context.handleTTS('two', newKey, 'native');
    await flush();
    await flush();
    loading.gate[settle](new Error('AbortError'));
    await loading.resumed;
    assert.equal(loading.state.ttsLoading, newKey);
    assert.equal(loading.state.ttsPlaying, null);
    assert.deepEqual(loading.state.alerts, []);
  }
});

test('이어 듣기 대기 중 전체 장 재생이 오디오를 바꾸면 끼어들지 않는다', async () => {
  for (const settle of ['resolve', 'reject']) {
    const { context, calls, state, gate, resumed, audio } = await enterPausedResume();
    context.handleFullChapterTTS();
    await flush();
    calls.at(-1).resolve({ data: { audioUrl: 'https://audio.test/full' } });
    await flush();
    await flush();
    const fullAudio = state.audios.at(-1);
    gate[settle](new Error('AbortError'));
    await resumed;
    assert.equal(audio.playing, false);
    assert.equal(fullAudio.playing, true);
    assert.equal(fullAudio.pauseCount, 0);
    assert.equal(state.ttsPlaying, 'full_chapter');
    assert.deepEqual(state.alerts, []);
  }
});

test('첫 play 대기 중 전체 장 재생이 오디오를 바꾸면 옛 요청이 표시를 덮지 않는다', async () => {
  const { context, calls, state } = fixture();
  const gate = deferred();
  state.playGate = gate.promise;
  context.handleTTS('one', 'grammar_verse_genesis_1_1', 'native');
  await flush();
  await flush();
  calls[0].resolve({ data: { audioUrl: 'https://audio.test/one' } });
  await flush();
  await flush();
  state.playGate = null;
  context.handleFullChapterTTS();
  await flush();
  calls.at(-1).resolve({ data: { audioUrl: 'https://audio.test/full' } });
  await flush();
  await flush();
  const fullAudio = state.audios.at(-1);
  gate.resolve();
  await flush();
  await flush();
  assert.equal(state.audios[0].playing, false);
  assert.equal(fullAudio.playing, true);
  assert.equal(fullAudio.pauseCount, 0);
  assert.equal(state.ttsPlaying, 'full_chapter');
});

test('취소되지 않은 이어 듣기 성공은 표시를 잇고, 실패는 고음질만 안내하고 다시 누를 수 있다', async () => {
  const success = await enterPausedResume();
  success.gate.resolve();
  await success.resumed;
  assert.equal(success.audio.playing, true);
  assert.equal(success.state.ttsPlaying, success.key);
  assert.equal(success.state.ttsPaused, null);

  for (const [quality, key, alerts] of [['native', 'grammar_verse_genesis_1_1', [NATIVE_FAILURE]], [undefined, 'verse_1', []]]) {
    const { state, gate, resumed } = await enterPausedResume(key, quality);
    gate.reject(new Error('NotAllowedError'));
    await resumed;
    assert.deepEqual(state.alerts, alerts);
    assert.equal(state.ttsPaused, key, '실패하면 일시정지 상태를 유지한다');
    assert.equal(state.ttsPlaying, null);
  }
});

test('장이나 책이 바뀌면 불러오는 중인 음성 요청을 무효로 만든다', () => {
  const effect = (dependency) => {
    const end = source.indexOf(`}, [${dependency}]);`);
    const start = source.lastIndexOf('useEffect(', end);
    return source.slice(start, end);
  };
  for (const dependency of ['currentBook', 'currentChapter']) {
    assert.match(effect(dependency), /ttsRequestRef\.current \+= 1;\n\s+setTtsLoading\(null\);/);
  }
});

test('표준 cacheKey는 기존 규칙과 같고 고음질 표시는 80자에서 잘리지 않는다', () => {
  const longKey = `grammar_exclamation_${'songofsolomon'}_8_14_${'x'.repeat(60)}`;
  const base = { prefix: 'songofsolomon', chapter: 8, key: longKey, voice: 'shimmer', text: 'hi' };
  const standard = buildBibleTtsRequest(base);
  assert.deepEqual(standard, {
    text: 'hi', cacheKey: `bible_songofsolomon_8_${longKey}_shimmer`.slice(0, 80), voice: 'shimmer',
  });
  const native = buildBibleTtsRequest({ ...base, quality: 'native' });
  assert.equal(native.quality, 'native');
  assert.ok(native.cacheKey.length <= 80);
  assert.ok(native.cacheKey.endsWith('_native'));
  assert.notEqual(native.cacheKey, standard.cacheKey);
  assert.equal(buildBibleTtsRequest({ ...base, quality: 'standard' }).cacheKey, standard.cacheKey);
  assert.equal('quality' in buildBibleTtsRequest({ ...base, quality: 'standard' }), false);
});
