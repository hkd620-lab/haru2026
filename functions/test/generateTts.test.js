// generateTTS 실제 handler를 원문에서 꺼내 모의 OpenAI·Storage·Firestore로 실행해 음질별 요청과 캐시 분리를 확인한다.
// 실행: npm run build && node --test test/generateTts.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ttsQuality = require('../lib/ttsQuality.js');

const source = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
const start = source.indexOf('export const generateTTS = onCall(');
const end = source.indexOf('// ===== ttsUsage 30일', start);
assert.ok(start > 0 && end > start, 'generateTTS 원문을 찾지 못했습니다.');
const { outputText } = ts.transpileModule(
  source.slice(start, end).replace('export const generateTTS = ', 'globalThis.generateTTS = '),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
);

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fixture({ usageCount = 0, post } = {}) {
  const objects = new Map();
  const requests = [];
  const counters = [];
  const bucket = () => ({
    file: (name) => ({
      exists: async () => [objects.has(name)],
      save: async (buffer) => { objects.set(name, buffer); },
      getSignedUrl: async () => [`https://signed.test/${name}`],
    }),
  });
  const db = {
    doc: () => ({
      get: async () => ({ exists: true, data: () => ({ count: usageCount }) }),
      set: async (value) => { counters.push(value); },
    }),
  };
  const context = {
    onCall: (_options, handler) => handler,
    HttpsError,
    bucket,
    db,
    admin: { firestore: { FieldValue: { increment: (n) => n, serverTimestamp: () => 'now' } } },
    axios: {
      post: async (url, body, options) => {
        requests.push({ url, body, options });
        if (post) return post(requests.length);
        return { data: Buffer.from('mp3') };
      },
    },
    logger: { warn() {}, error() {} },
    setTimeout: (fn) => setTimeout(fn, 0),
    Buffer,
    Date,
    Math,
    OPENAI_API_KEY_SECRET: { value: () => 'k-openai' },
    GEMINI_API_KEY_SECRET: {},
    GOOGLE_CLOUD_API_KEY_SECRET: {},
    normalizeTtsQuality: ttsQuality.normalizeTtsQuality,
    TTS_QUALITY_SETTINGS: ttsQuality.TTS_QUALITY_SETTINGS,
    buildTtsCachePath: ttsQuality.buildTtsCachePath,
  };
  vm.runInNewContext(outputText, context);
  return {
    objects,
    requests,
    counters,
    call: (data, auth = { uid: 'user-1' }) => context.generateTTS({ auth, data }),
  };
}

const standardCall = { text: 'In the beginning', cacheKey: 'bible_genesis_1_verse_1_nova', voice: 'nova' };

test('quality가 없는 기존 호출은 표준 모델·속도와 기존 캐시 경로를 그대로 쓴다', async () => {
  const f = fixture();
  const result = await f.call(standardCall);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, 'https://api.openai.com/v1/audio/speech');
  assert.equal(f.requests[0].body.model, 'tts-1');
  assert.equal(f.requests[0].body.speed, 0.95);
  assert.deepEqual([...f.objects.keys()], ['ttsCache/bible_genesis_1_verse_1_nova_nova.mp3']);
  assert.equal(result.cached, false);
  assert.deepEqual(f.counters.map((value) => value.count), [1]);
});

test('native만 tts-1-hd와 0.92 속도를 쓰고, 알 수 없는 값은 표준으로 처리한다', async () => {
  const f = fixture();
  await f.call({ ...standardCall, quality: 'native' });
  assert.equal(f.requests[0].body.model, 'tts-1-hd');
  assert.equal(f.requests[0].body.speed, 0.92);

  for (const quality of ['standard', 'NATIVE', 'hd', 1, null]) {
    const other = fixture();
    await other.call({ ...standardCall, quality });
    assert.equal(other.requests[0].body.model, 'tts-1');
    assert.equal(other.requests[0].body.speed, 0.95);
    assert.deepEqual([...other.objects.keys()], ['ttsCache/bible_genesis_1_verse_1_nova_nova.mp3']);
  }
});

test('같은 cacheKey여도 표준과 고음질 캐시는 서로의 음성을 돌려주지 않는다', async () => {
  const f = fixture();
  await f.call(standardCall);
  const native = await f.call({ ...standardCall, quality: 'native' });
  assert.equal(native.cached, false);
  assert.equal(f.requests.length, 2);
  assert.equal(f.objects.size, 2);

  const standardAgain = await f.call(standardCall);
  const nativeAgain = await f.call({ ...standardCall, quality: 'native' });
  assert.equal(standardAgain.cached, true);
  assert.equal(nativeAgain.cached, true);
  assert.equal(f.requests.length, 2);
  assert.notEqual(standardAgain.audioUrl, nativeAgain.audioUrl);
  assert.deepEqual(f.counters.map((value) => value.count), [1, 1], '캐시 적중은 사용량을 차감하지 않는다');
});

test('고음질 캐시는 잘린 cacheKey가 같아도 본문·음성이 다르면 새로 만든다', async () => {
  const f = fixture();
  const cacheKey = `bible_genesis_1_grammar_${'x'.repeat(80)}`.slice(0, 80);
  await f.call({ text: 'first sentence', cacheKey, voice: 'nova', quality: 'native' });
  await f.call({ text: 'second sentence', cacheKey, voice: 'nova', quality: 'native' });
  await f.call({ text: 'first sentence', cacheKey, voice: 'onyx', quality: 'native' });
  assert.equal(f.requests.length, 3);
  assert.equal(f.objects.size, 3);

  const sameContent = await f.call({ text: 'first sentence', cacheKey: 'other', voice: 'nova', quality: 'native' });
  assert.equal(sameContent.cached, true);
});

test('표준 호출의 cacheKey로 고음질 객체 경로를 지정할 수 없다', () => {
  const nativePath = ttsQuality.buildTtsCachePath({ cacheKey: 'a', voice: 'nova', quality: 'native', text: 'hello' });
  const hash = nativePath.replace('ttsCache/native/', '').replace('.mp3', '');
  assert.match(hash, /^[0-9a-f]{64}$/);
  for (const voice of ['nova', 'onyx', 'alloy', 'echo', 'fable', 'shimmer']) {
    assert.notEqual(
      ttsQuality.buildTtsCachePath({ cacheKey: `native/${hash}`, voice, quality: 'standard', text: 'hello' }),
      nativePath,
    );
  }
});

test('고음질도 로그인·입력 검증과 하루 사용 한도를 통과해야 공급자를 부른다', async () => {
  const f = fixture();
  await assert.rejects(f.call({ ...standardCall, quality: 'native' }, null), { code: 'unauthenticated' });
  await assert.rejects(f.call({ cacheKey: 'x', quality: 'native' }), { code: 'invalid-argument' });
  await assert.rejects(f.call({ text: 'x', quality: 'native' }), { code: 'invalid-argument' });
  assert.equal(f.requests.length, 0);

  const limited = fixture({ usageCount: 500 });
  await assert.rejects(limited.call({ ...standardCall, quality: 'native' }));
  assert.equal(limited.requests.length, 0);
  assert.equal(limited.objects.size, 0);
});

test('고음질 공급자 실패는 캐시·사용량을 남기지 않고 같은 오류로 끝나며 비밀값을 노출하지 않는다', async () => {
  const f = fixture({
    post: () => {
      const err = new Error('boom');
      err.response = { status: 500 };
      err.config = { headers: { Authorization: 'Bearer k-openai' } };
      throw err;
    },
  });
  await assert.rejects(f.call({ ...standardCall, quality: 'native' }), (error) => {
    assert.equal(error.code, 'internal');
    assert.equal(error.message, 'TTS 생성에 실패했습니다.');
    assert.ok(!String(error.message).includes('k-openai'));
    return true;
  });
  assert.equal(f.requests.length, 1);
  assert.equal(f.objects.size, 0);
  assert.equal(f.counters.length, 0);
});

test('고음질 429는 기존 재시도 후 성공하면 저장한다', async () => {
  const f = fixture({
    post: (attempt) => {
      if (attempt === 1) {
        const err = new Error('rate');
        err.response = { status: 429, headers: { 'retry-after': '0' } };
        throw err;
      }
      return { data: Buffer.from('mp3') };
    },
  });
  const result = await f.call({ ...standardCall, quality: 'native' });
  assert.equal(result.cached, false);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].body.model, 'tts-1-hd');
  assert.equal(f.objects.size, 1);
});
