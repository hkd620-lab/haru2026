// generateTTS 실제 handler를 원문에서 꺼내 모의 Realtime 연결·Storage·Firestore로 실행해
// Realtime 이벤트 순서, PCM→WAV 저장, 기존 MP3 캐시 재사용, 음질별 캐시 분리, 인증·한도를 확인한다.
// 실행: npm run build && node --test test/generateTts.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ttsQuality = require('../lib/ttsQuality.js');
const realtimeTts = require('../lib/realtimeTts.js');

const source = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
const start = source.indexOf('export const generateTTS = onCall(');
const end = source.indexOf('// ===== ttsUsage 30일', start);
assert.ok(start > 0 && end > start, 'generateTTS 원문을 찾지 못했습니다.');
const handlerSource = source.slice(start, end);
const { outputText } = ts.transpileModule(
  handlerSource.replace('export const generateTTS = ', 'globalThis.generateTTS = '),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
);

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const pcmOf = (n, seed = 1) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff));

// OpenAIRealtimeWS 와 같은 모양의 대역: 서버 이벤트는 type 이름과 'event', 서버 error 이벤트·소켓 오류는 'error'.
class FakeRealtime {
  constructor(script) {
    this.script = script;
    this.handlers = {};
    this.socketHandlers = {};
    this.sent = [];
    this.closed = false;
    this.sessionUpdatedEmitted = false;
    this.socket = {
      readyState: 0,
      on: (type, cb) => { (this.socketHandlers[type] ||= []).push(cb); },
    };
    setImmediate(() => {
      if (this.closed) return;
      if (script.handshakeError) {
        this.emitError(script.handshakeError);
        return;
      }
      this.socket.readyState = 1;
      (this.socketHandlers.open || []).forEach((cb) => cb());
    });
  }
  on(type, cb) { (this.handlers[type] ||= []).push(cb); }
  emit(event) {
    if (event.type === 'session.updated') this.sessionUpdatedEmitted = true;
    (this.handlers.event || []).forEach((cb) => cb(event));
    (this.handlers[event.type] || []).forEach((cb) => cb(event));
  }
  emitError(err) { (this.handlers.error || []).forEach((cb) => cb(err)); }
  serverClose(code) {
    this.socket.readyState = 3;
    (this.socketHandlers.close || []).forEach((cb) => cb(code));
  }
  send(event) {
    this.sent.push({ ...event, _afterSessionUpdated: this.sessionUpdatedEmitted });
    if (event.type === 'conversation.item.create') this.inputText = event.item?.content?.[0]?.text;
    setImmediate(() => this.script.onSend(this, event));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.socket.readyState = 3;
    setImmediate(() => (this.socketHandlers.close || []).forEach((cb) => cb(1000)));
  }
}

// 기본 성공 시나리오: session.update → session.updated, response.create → 오디오 조각 → 전사 → response.done(completed)
// transcript: 문자열 또는 (보낸 본문) => 문자열. 기본은 보낸 본문을 그대로 읽은 전사.
// transcriptVia: 'event'(output_audio_transcript.done) | 'response'(response.done 출력 파트) | 'none'
function speak({
  chunks = [pcmOf(6), pcmOf(4, 3)], doneStatus = 'completed', statusDetails, afterAudio,
  transcript = (text) => text, transcriptVia = 'event',
} = {}) {
  return {
    onSend(conn, event) {
      if (event.type === 'session.update') conn.emit({ type: 'session.updated', session: event.session });
      if (event.type === 'response.create') {
        conn.emit({ type: 'response.created', response: { id: 'resp_1' } });
        for (const chunk of chunks) {
          conn.emit({ type: 'response.output_audio.delta', delta: chunk.toString('base64') });
        }
        if (afterAudio) { afterAudio(conn); return; }
        conn.emit({ type: 'response.output_audio.done' });
        const spoken = typeof transcript === 'function' ? transcript(conn.inputText) : transcript;
        if (transcriptVia === 'event') {
          conn.emit({ type: 'response.output_audio_transcript.done', transcript: spoken });
        }
        const output = transcriptVia === 'response'
          ? [{ type: 'message', role: 'assistant', content: [{ type: 'output_audio', transcript: spoken }] }]
          : [];
        conn.emit({ type: 'response.done', response: { status: doneStatus, status_details: statusDetails, output } });
      }
    },
  };
}

const rateLimitError = () => ({
  message: 'rate limited',
  error: { type: 'rate_limit_exceeded', code: 'rate_limit_exceeded', message: 'Please try again in 1ms' },
});

function fixture({ usageCount = 0, scripts = [], realtimeOverrides = {}, seed = {} } = {}) {
  const objects = new Map(Object.entries(seed));
  const metadata = new Map();
  const connections = [];
  const connectCalls = [];
  const counters = [];
  const warnings = [];
  const errors = [];
  const bucket = () => ({
    file: (name) => ({
      exists: async () => [objects.has(name)],
      save: async (buffer, options) => { objects.set(name, buffer); metadata.set(name, options?.metadata); },
      getSignedUrl: async () => [`https://signed.test/${name}`],
    }),
  });
  const db = {
    doc: () => ({
      get: async () => ({ exists: true, data: () => ({ count: usageCount }) }),
      set: async (value) => { counters.push(value); },
    }),
  };
  const connect = (params) => {
    connectCalls.push(params);
    const script = scripts[connections.length] ?? scripts[scripts.length - 1] ?? speak();
    const conn = new FakeRealtime(script);
    connections.push(conn);
    return conn;
  };
  const context = {
    onCall: (_options, handler) => handler,
    HttpsError,
    bucket,
    db,
    admin: { firestore: { FieldValue: { increment: (n) => n, serverTimestamp: () => 'now' } } },
    axios: { post: async () => { throw new Error('legacy /audio/speech must not be called'); } },
    logger: { warn: (...args) => warnings.push(args), error: (...args) => errors.push(args) },
    setTimeout: (fn) => setTimeout(fn, 0),
    Buffer,
    Date,
    Math,
    OPENAI_API_KEY_SECRET: { value: () => 'k-openai' },
    GEMINI_API_KEY_SECRET: {},
    GOOGLE_CLOUD_API_KEY_SECRET: {},
    normalizeTtsQuality: ttsQuality.normalizeTtsQuality,
    buildTtsCachePath: ttsQuality.buildTtsCachePath,
    REALTIME_TTS_SETTINGS: realtimeTts.REALTIME_TTS_SETTINGS,
    RealtimeTtsError: realtimeTts.RealtimeTtsError,
    buildRealtimeTtsCachePath: realtimeTts.buildRealtimeTtsCachePath,
    cleanTtsText: realtimeTts.cleanTtsText,
    pcm16ToWav: realtimeTts.pcm16ToWav,
    toRealtimeVoice: realtimeTts.toRealtimeVoice,
    synthesizeRealtimeSpeech: (params) => realtimeTts.synthesizeRealtimeSpeech({
      ...params,
      connect,
      sleep: async () => {},
      ...realtimeOverrides,
    }),
  };
  vm.runInNewContext(outputText, context);
  return {
    objects,
    metadata,
    connections,
    connectCalls,
    counters,
    warnings,
    errors,
    call: (data, auth = { uid: 'user-1' }) => context.generateTTS({ auth, data }),
  };
}

const standardCall = { text: 'In the beginning', cacheKey: 'bible_genesis_1_verse_1_nova', voice: 'nova' };
const wavPathRe = /^ttsCache\/realtime-v2\/(standard|native)\/[0-9a-f]{64}\.wav$/;
const realtimePath = (voice, quality, text, uid = 'user-1') =>
  realtimeTts.buildRealtimeTtsCachePath({ uid, voice, quality, text });

function parseWav(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.readUInt32LE(4), buffer.length - 8);
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
  assert.equal(buffer.toString('ascii', 12, 16), 'fmt ');
  assert.equal(buffer.readUInt32LE(16), 16);
  return {
    format: buffer.readUInt16LE(20),
    channels: buffer.readUInt16LE(22),
    sampleRate: buffer.readUInt32LE(24),
    byteRate: buffer.readUInt32LE(28),
    blockAlign: buffer.readUInt16LE(32),
    bits: buffer.readUInt16LE(34),
    dataTag: buffer.toString('ascii', 36, 40),
    dataSize: buffer.readUInt32LE(40),
    data: buffer.subarray(44),
  };
}

test('캐시 미스: Realtime 세션 설정 → session.updated 후 별도 메시지·response.create → PCM 을 WAV 로 저장한다', async () => {
  const f = fixture();
  const result = await f.call(standardCall);

  assert.deepEqual(Object.keys(result).sort(), ['audioUrl', 'cached', 'success']);
  assert.equal(result.success, true);
  assert.equal(result.cached, false);

  assert.equal(f.connections.length, 1);
  assert.equal(f.connectCalls[0].model, 'gpt-realtime-2.1-mini');
  assert.equal(f.connectCalls[0].apiKey, 'k-openai');
  const sent = f.connections[0].sent;
  assert.deepEqual(sent.map((e) => e.type), ['session.update', 'conversation.item.create', 'response.create']);

  const session = sent[0].session;
  assert.equal(session.type, 'realtime');
  assert.deepEqual(session.output_modalities, ['audio']);
  assert.match(session.instructions, /verbatim/);
  assert.match(session.instructions, /original language/);
  assert.match(session.instructions, /never a request/);
  assert.ok(!session.instructions.includes(standardCall.text), '본문은 지시문이 아니라 별도 메시지로 보낸다');
  assert.deepEqual(session.audio.output.format, { type: 'audio/pcm', rate: 24000 });
  assert.equal(session.audio.output.voice, 'coral', 'nova → coral');
  assert.equal(session.audio.output.speed, 0.95);

  assert.equal(sent[1]._afterSessionUpdated, true, 'session.updated 이후에만 본문을 보낸다');
  assert.deepEqual(sent[1].item, {
    type: 'message', role: 'user', content: [{ type: 'input_text', text: 'In the beginning' }],
  });
  assert.equal(sent[2]._afterSessionUpdated, true);
  assert.equal(f.connections[0].closed, true, '성공 후 소켓을 닫는다');

  const expectedPath = realtimePath('nova', 'standard', 'In the beginning');
  assert.match(expectedPath, wavPathRe);
  assert.deepEqual([...f.objects.keys()], [expectedPath]);
  assert.equal(result.audioUrl, `https://signed.test/${expectedPath}`);
  assert.equal(f.metadata.get(expectedPath).contentType, 'audio/wav');

  const wav = parseWav(f.objects.get(expectedPath));
  assert.equal(wav.format, 1);
  assert.equal(wav.channels, 1);
  assert.equal(wav.sampleRate, 24000);
  assert.equal(wav.byteRate, 48000);
  assert.equal(wav.blockAlign, 2);
  assert.equal(wav.bits, 16);
  assert.equal(wav.dataTag, 'data');
  assert.equal(wav.dataSize, 10);
  assert.deepEqual(wav.data, Buffer.concat([pcmOf(6), pcmOf(4, 3)]));

  assert.deepEqual(f.counters.map((value) => value.count), [1]);
});

test('캐시 미스 뒤 같은 요청은 새 WAV 캐시를 재사용하고 사용량을 차감하지 않는다', async () => {
  const f = fixture();
  const first = await f.call(standardCall);
  const second = await f.call({ ...standardCall, cacheKey: 'different_key' });
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.audioUrl, first.audioUrl);
  assert.equal(f.connections.length, 1);
  assert.deepEqual(f.counters.map((value) => value.count), [1]);
});

test('기존 표준 MP3 는 소유자·본문을 확인할 수 없어 내주지 않고(객체는 그대로), 고음질 MP3 는 계속 재사용한다', async () => {
  const legacyStandard = 'ttsCache/bible_genesis_1_verse_1_nova_nova.mp3';
  const legacyNative = ttsQuality.buildTtsCachePath({ cacheKey: 'x', voice: 'nova', quality: 'native', text: standardCall.text });
  assert.match(legacyNative, /^ttsCache\/native\/[0-9a-f]{64}\.mp3$/);
  const f = fixture({ seed: { [legacyStandard]: Buffer.from('mp3-a'), [legacyNative]: Buffer.from('mp3-b') } });

  const standard = await f.call(standardCall);
  assert.equal(standard.cached, false, '표준 MP3 가 있어도 새로 생성한다');
  assert.notEqual(standard.audioUrl, `https://signed.test/${legacyStandard}`);
  assert.equal(standard.audioUrl, `https://signed.test/${realtimePath('nova', 'standard', standardCall.text)}`);
  assert.equal(f.connections.length, 1);

  const native = await f.call({ ...standardCall, quality: 'native' });
  assert.equal(native.cached, true);
  assert.equal(native.audioUrl, `https://signed.test/${legacyNative}`);
  assert.equal(f.connections.length, 1, '고음질 MP3 적중은 Realtime 을 부르지 않는다');
  assert.deepEqual(f.counters.map((value) => value.count), [1]);

  // 기존 객체는 지우거나 덮어쓰지 않는다.
  assert.deepEqual(f.objects.get(legacyStandard), Buffer.from('mp3-a'));
  assert.deepEqual(f.objects.get(legacyNative), Buffer.from('mp3-b'));
  assert.equal(f.objects.size, 3);

  // 다른 사용자도 같은 고음질 MP3(전체 본문 해시)는 그대로 받는다.
  const other = await f.call({ ...standardCall, quality: 'native' }, { uid: 'user-2' });
  assert.equal(other.audioUrl, `https://signed.test/${legacyNative}`);
});

test('같은 불투명 cacheKey 라도 본문이 다르면 서로 다른 WAV 를 만든다', async () => {
  const f = fixture();
  const sharedKey = 'diary_s_0_오늘은 비가 와서 집에';
  const first = await f.call({ text: '오늘은 비가 와서 집에 있었다.', cacheKey: sharedKey });
  const second = await f.call({ text: '오늘은 비가 와서 집에 있었지만 저녁에 나갔다.', cacheKey: sharedKey });
  assert.equal(first.cached, false);
  assert.equal(second.cached, false);
  assert.notEqual(first.audioUrl, second.audioUrl);
  assert.equal(f.connections.length, 2);
  assert.equal(f.objects.size, 2);
  assert.equal(f.connections[1].sent[1].item.content[0].text, '오늘은 비가 와서 집에 있었지만 저녁에 나갔다.');
});

test('같은 본문이라도 다른 사용자와는 WAV 캐시를 나눠 쓰지 않는다', async () => {
  const f = fixture();
  const mine = await f.call(standardCall, { uid: 'user-1' });
  const again = await f.call(standardCall, { uid: 'user-1' });
  const theirs = await f.call(standardCall, { uid: 'user-2' });
  assert.equal(mine.cached, false);
  assert.equal(again.cached, true, '같은 사용자·같은 본문은 적중');
  assert.equal(theirs.cached, false, '다른 사용자는 적중하지 않음');
  assert.notEqual(theirs.audioUrl, mine.audioUrl);
  assert.equal(f.connections.length, 2);
  assert.deepEqual([...f.objects.keys()].sort(), [
    realtimePath('nova', 'standard', standardCall.text, 'user-1'),
    realtimePath('nova', 'standard', standardCall.text, 'user-2'),
  ].sort());
  assert.throws(() => realtimeTts.buildRealtimeTtsCachePath({ uid: '', voice: 'nova', quality: 'standard', text: 'x' }));
});

test('기존 MP3 경로 규칙과 고음질 해시·속도는 그대로다', () => {
  assert.deepEqual(ttsQuality.TTS_QUALITY_SETTINGS, {
    standard: { model: 'tts-1', speed: 0.95 },
    native: { model: 'tts-1-hd', speed: 0.92 },
  });
  assert.equal(
    ttsQuality.buildTtsCachePath({ cacheKey: 'k', voice: 'nova', quality: 'standard', text: 't' }),
    'ttsCache/k_nova.mp3',
  );
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

test('표준·고음질은 서로 다른 WAV 캐시와 속도를 쓰고, 알 수 없는 quality 는 표준으로 처리한다', async () => {
  const f = fixture();
  await f.call(standardCall);
  const native = await f.call({ ...standardCall, quality: 'native' });
  assert.equal(native.cached, false);
  assert.equal(f.connections.length, 2);
  assert.equal(f.connections[0].sent[0].session.audio.output.speed, 0.95);
  assert.equal(f.connections[1].sent[0].session.audio.output.speed, 0.92);
  const keys = [...f.objects.keys()];
  assert.equal(keys.length, 2);
  assert.match(keys[0], /^ttsCache\/realtime-v2\/standard\//);
  assert.match(keys[1], /^ttsCache\/realtime-v2\/native\//);

  const standardAgain = await f.call(standardCall);
  const nativeAgain = await f.call({ ...standardCall, quality: 'native' });
  assert.equal(standardAgain.cached, true);
  assert.equal(nativeAgain.cached, true);
  assert.notEqual(standardAgain.audioUrl, nativeAgain.audioUrl);
  assert.equal(f.connections.length, 2);
  assert.deepEqual(f.counters.map((value) => value.count), [1, 1]);

  for (const quality of ['standard', 'NATIVE', 'hd', 1, null]) {
    const other = fixture();
    await other.call({ ...standardCall, quality });
    assert.equal(other.connections[0].sent[0].session.audio.output.speed, 0.95);
    assert.deepEqual([...other.objects.keys()], [realtimePath('nova', 'standard', 'In the beginning')]);
  }
});

test('기존 음성 ID 는 캐시에 남기고 생성 음성만 Realtime 음성으로 바꾼다', async () => {
  const expected = { nova: 'coral', onyx: 'cedar', fable: 'ballad', alloy: 'alloy', echo: 'echo', shimmer: 'shimmer' };
  const paths = new Set();
  for (const [voice, realtimeVoice] of Object.entries(expected)) {
    const f = fixture();
    await f.call({ ...standardCall, voice });
    assert.equal(f.connections[0].sent[0].session.audio.output.voice, realtimeVoice);
    paths.add([...f.objects.keys()][0]);
  }
  assert.equal(paths.size, 6, '음성마다 캐시가 분리된다');

  const unknown = fixture();
  await unknown.call({ ...standardCall, voice: 'marin' });
  assert.equal(unknown.connections[0].sent[0].session.audio.output.voice, 'coral', '목록 밖 음성은 기존처럼 nova 로');
});

test('새 WAV 캐시 경로는 클라이언트 값과 무관하게 해시만 쓰고 범위를 벗어나지 않는다', async () => {
  for (const [voice, quality, text] of [
    ['../../etc', '../../x', '../../../secret'],
    ['nova/../..', 'native', 'a/b\\c\u0000'],
    ['nova', 'standard', ''],
  ]) {
    assert.match(realtimePath(voice, quality, text), wavPathRe);
    assert.match(realtimePath(voice, quality, text, '../../other-user'), wavPathRe);
  }
  assert.equal(realtimePath('nova', 'standard', 'x'), realtimePath('nova', 'standard', 'x'), '결정적');
  assert.notEqual(realtimePath('nova', 'standard', 'x'), realtimePath('nova', 'standard', 'y'));

  const f = fixture();
  await f.call({ text: 'hello', cacheKey: '../../users/other/private', voice: 'nova' });
  const keys = [...f.objects.keys()];
  assert.equal(keys.length, 1);
  assert.match(keys[0], wavPathRe);
  assert.ok(!keys[0].includes('..'));
});

test('기존 텍스트 정제·4000자 제한을 유지하고 정제된 본문을 보낸다', async () => {
  assert.equal(realtimeTts.cleanTtsText('## **안녕** https://x.y/z 1. 하루 `code` ①'), '안녕 하루 code');
  assert.equal(realtimeTts.cleanTtsText('가'.repeat(5000)).length, 4000);

  const f = fixture();
  await f.call({ text: '# 제목 **굵게** 본문', cacheKey: 'k' });
  assert.equal(f.connections[0].sent[1].item.content[0].text, '제목 굵게 본문');
});

test('긴 도서는 문장 경계에서 나눠 모든 음성을 원문 순서대로 하나의 WAV에 저장한다', async () => {
  const sentence = 'The tide carried the paper boats around the bend and out of sight.';
  const text = Array(18).fill(sentence).join(' ');
  const firstAudio = pcmOf(4, 2);
  const secondAudio = pcmOf(6, 7);
  const f = fixture({ scripts: [speak({ chunks: [firstAudio] }), speak({ chunks: [secondAudio] })] });

  const result = await f.call({ ...standardCall, text });
  assert.equal(result.cached, false);
  assert.equal(f.connections.length, 2);
  assert.equal(f.connections.map(conn => conn.inputText).join(' '), text);
  assert.ok(f.connections.every(conn => conn.inputText.endsWith('.') && conn.inputText.length <= 700));
  const wav = parseWav([...f.objects.values()][0]);
  assert.deepEqual(wav.data, Buffer.concat([firstAudio, secondAudio]));
  assert.equal(f.counters.length, 1);
});

test('긴 글의 일부가 낭독 검증에 실패하면 전체 음성과 사용량을 저장하지 않는다', async () => {
  const text = Array(18).fill('The tide carried the paper boats around the bend and out of sight.').join(' ');
  const incorrect = speak({ transcript: 'This is a summary.' });
  const f = fixture({ scripts: [speak(), incorrect] });

  await assert.rejects(f.call({ ...standardCall, text }), { code: 'internal' });
  assert.equal(f.objects.size, 0);
  assert.equal(f.counters.length, 0);
  assert.ok(f.connections.every(conn => conn.closed));
});

test('미완료 response.done·빈 오디오·홀수 바이트·도중 종료는 실패하고 캐시·사용량을 남기지 않는다', async () => {
  const cases = [
    speak({ doneStatus: 'incomplete', statusDetails: { type: 'incomplete', reason: 'max_output_tokens' } }),
    speak({ doneStatus: 'cancelled' }),
    speak({ doneStatus: 'failed', statusDetails: { error: { type: 'server_error', code: 'server_error' } } }),
    speak({ chunks: [] }),
    speak({ chunks: [pcmOf(3)] }),
    speak({ afterAudio: (conn) => conn.serverClose(1006) }),
    speak({ afterAudio: (conn) => conn.emitError({ message: 'socket hang up' }) }),
  ];
  for (const script of cases) {
    const f = fixture({ scripts: [script] });
    await assert.rejects(f.call(standardCall), (error) => {
      assert.equal(error.code, 'internal');
      assert.equal(error.message, 'TTS 생성에 실패했습니다.');
      return true;
    });
    assert.equal(f.connections.length, 1, '실패는 재시도하지 않는다');
    assert.equal(f.connections[0].closed, true, '실패 후에도 소켓을 닫는다');
    assert.equal(f.objects.size, 0);
    assert.equal(f.counters.length, 0);
  }
});

test('응답이 오지 않으면 시도 제한 시간에 끝나고 소켓을 닫는다', async () => {
  const silent = { onSend(conn, event) { if (event.type === 'session.update') conn.emit({ type: 'session.updated' }); } };
  const f = fixture({ scripts: [silent], realtimeOverrides: { attemptTimeoutMs: 30, totalTimeoutMs: 1000 } });
  const startedAt = Date.now();
  await assert.rejects(f.call(standardCall), { code: 'internal' });
  assert.ok(Date.now() - startedAt < 900);
  assert.equal(f.connections[0].closed, true);
  assert.equal(f.objects.size, 0);
  assert.equal(f.counters.length, 0);
  assert.equal(f.errors[0][1].kind, 'timeout');

  const noSessionUpdated = fixture({
    scripts: [{ onSend() {} }],
    realtimeOverrides: { attemptTimeoutMs: 30, totalTimeoutMs: 1000 },
  });
  await assert.rejects(noSessionUpdated.call(standardCall), { code: 'internal' });
  assert.deepEqual(noSessionUpdated.connections[0].sent.map((e) => e.type), ['session.update'],
    'session.updated 없이는 본문·response.create 를 보내지 않는다');
});

test('오디오 크기 상한을 넘으면 즉시 끊고 저장하지 않는다', async () => {
  const f = fixture({
    scripts: [speak({ chunks: [pcmOf(8), pcmOf(8), pcmOf(8)] })],
    realtimeOverrides: { maxPcmBytes: 16 },
  });
  await assert.rejects(f.call(standardCall), { code: 'internal' });
  assert.equal(f.errors[0][1].kind, 'too_large');
  assert.equal(f.objects.size, 0);
  assert.equal(f.counters.length, 0);
});

test('오디오 전 rate limit 은 기존 횟수 안에서 재시도하고, 오디오 이후·한도 소진·insufficient_quota 는 재시도하지 않는다', async () => {
  const rateOnSession = { onSend(conn, event) { if (event.type === 'session.update') conn.emitError(rateLimitError()); } };
  const handshake429 = { handshakeError: { message: 'Unexpected server response: 429' }, onSend() {} };

  const retried = fixture({ scripts: [rateOnSession, handshake429, speak()] });
  const result = await retried.call({ ...standardCall, quality: 'native' });
  assert.equal(result.cached, false);
  assert.equal(retried.connections.length, 3);
  assert.equal(retried.warnings.length, 2);
  assert.ok(retried.connections.every((conn) => conn.closed));
  assert.equal(retried.objects.size, 1);
  assert.deepEqual(retried.counters.map((value) => value.count), [1]);

  const exhausted = fixture({ scripts: [rateOnSession, rateOnSession, rateOnSession, speak()] });
  await assert.rejects(exhausted.call(standardCall), { code: 'internal' });
  assert.equal(exhausted.connections.length, 3, '총 3회까지만 시도한다');

  const doneRateLimited = speak({ doneStatus: 'failed', statusDetails: { error: { type: 'rate_limit_exceeded', code: 'rate_limit_exceeded' } } });
  const afterAudio = fixture({ scripts: [doneRateLimited, speak()] });
  await assert.rejects(afterAudio.call(standardCall), { code: 'internal' });
  assert.equal(afterAudio.connections.length, 1, '오디오를 받은 뒤의 rate limit 은 재시도하지 않는다');

  const quota = fixture({
    scripts: [{ onSend(conn, event) {
      if (event.type === 'session.update') conn.emitError({ error: { type: 'insufficient_quota', code: 'insufficient_quota' } });
    } }, speak()],
  });
  await assert.rejects(quota.call(standardCall), { code: 'internal' });
  assert.equal(quota.connections.length, 1);
});

test('공급자 오류는 고정 메시지로 끝나고 로그에도 키·원문 메시지를 남기지 않는다', async () => {
  const f = fixture({
    scripts: [{ onSend(conn, event) {
      if (event.type === 'session.update') {
        conn.emitError({
          message: 'Bearer k-openai leaked text: In the beginning',
          error: { type: 'invalid_request_error', code: 'bad <script>', message: 'Bearer k-openai In the beginning' },
          headers: { Authorization: 'Bearer k-openai' },
        });
      }
    } }],
  });
  const privateCacheKey = 'diary_s_0_private fixture text';
  await assert.rejects(f.call({ ...standardCall, cacheKey: privateCacheKey }), (error) => {
    assert.equal(error.code, 'internal');
    assert.equal(error.message, 'TTS 생성에 실패했습니다.');
    return true;
  });
  const logged = JSON.stringify(f.errors);
  assert.ok(!logged.includes('k-openai'));
  assert.ok(!logged.includes('leaked'));
  assert.ok(!logged.includes(privateCacheKey));
  assert.ok(!logged.includes('<script>'));
  assert.equal(f.errors[0][1].kind, 'server_error');
  assert.equal(f.errors[0][1].providerType, 'invalid_request_error');
  assert.equal(f.connections[0].closed, true);
});

test('로그인·입력 검증과 하루 사용 한도를 통과해야 Realtime 을 부른다', async () => {
  const f = fixture();
  await assert.rejects(f.call(standardCall, null), { code: 'unauthenticated' });
  await assert.rejects(f.call({ ...standardCall, quality: 'native' }, null), { code: 'unauthenticated' });
  await assert.rejects(f.call({ cacheKey: 'x' }), { code: 'invalid-argument' });
  await assert.rejects(f.call({ text: 'x' }), { code: 'invalid-argument' });
  await assert.rejects(f.call({ text: 123, cacheKey: 'x' }), { code: 'invalid-argument' });
  await assert.rejects(f.call({ text: '😀 🎉', cacheKey: 'x' }), { code: 'invalid-argument' });
  assert.equal(f.connections.length, 0);

  for (const quality of [undefined, 'native']) {
    const limited = fixture({ usageCount: 500 });
    await assert.rejects(limited.call({ ...standardCall, quality }));
    assert.equal(limited.connections.length, 0);
    assert.equal(limited.objects.size, 0);
    assert.equal(limited.counters.length, 0);
  }

  // 한도에 도달해도 캐시 적중은 계속 재생할 수 있다(기존 동작).
  const cachedPath = realtimePath('nova', 'standard', 'In the beginning');
  const limitedCached = fixture({ usageCount: 500, seed: { [cachedPath]: Buffer.from('wav') } });
  const hit = await limitedCached.call(standardCall);
  assert.equal(hit.cached, true);
  assert.equal(limitedCached.connections.length, 0);
});

test('handler 는 콜러블 이름·리전·인증 비밀값 설정을 유지하고 기존 /audio/speech 를 더 이상 부르지 않는다', () => {
  assert.match(handlerSource, /^export const generateTTS = onCall\(/);
  assert.match(handlerSource, /region: 'asia-northeast3'/);
  assert.match(handlerSource, /OPENAI_API_KEY_SECRET/);
  assert.ok(!handlerSource.includes('/v1/audio/speech'));
  assert.ok(!/sleep\(/.test(handlerSource), '합성 뒤 고정 대기를 두지 않는다');
});

test('합성 전체 제한은 재시도 포함 60초이고 한 시도도 그 안에 머문다', () => {
  assert.equal(realtimeTts.REALTIME_TTS_TOTAL_TIMEOUT_MS, 60_000);
  assert.ok(realtimeTts.REALTIME_TTS_ATTEMPT_TIMEOUT_MS <= realtimeTts.REALTIME_TTS_TOTAL_TIMEOUT_MS);
});

// ===== 전사 검증 =====
const match = realtimeTts.transcriptMatchesText;
const longEn = 'Today I walked along the river with my sister. We talked about the summer trip and the old house. '
  + 'The wind was cold but the sun felt warm on our faces. In the evening we cooked soup and read quietly until late.';
const longKo = '오늘은 아침부터 비가 내려서 하루 종일 집에 있었다. 오후에는 창가에 앉아 오래된 편지를 다시 읽었다. '
  + '저녁에는 동생과 함께 따뜻한 국을 끓여 먹고 일찍 잠자리에 들었다.';

test('전사 검증: 문장부호·대소문자·띄어쓰기·NFC 차이는 같은 것으로 본다', () => {
  assert.equal(match('In the beginning', 'in the beginning'), true);
  assert.equal(match('In the beginning', 'IN THE BEGINNING!'), true);
  assert.equal(
    match('In the beginning, God created the heaven and the earth.', 'in the beginning God created the heaven and the earth'),
    true,
  );
  assert.equal(match('오늘은 비가 왔다. 그래서, 집에 있었다!', '오늘은 비가 왔다 그래서 집에 있었다.'), true);
  assert.equal(match('오늘은 비가 왔다.', '오늘은 비가 왔다'.normalize('NFD')), true, 'NFD 한글도 NFC 로 맞춘다');
  assert.equal(match(longEn, longEn.toUpperCase().replace(/[.,]/g, ' ')), true);
  assert.equal(match(longKo, longKo.replace(/\s+/g, '').replace(/\./g, '')), true, '띄어쓰기 차이');
});

test('전사 검증: 짧은 본문은 정확히 같아야 하고, 질문에 답하거나 다른 말을 하면 거절한다', () => {
  assert.equal(match('In the beginning', 'In the beginnings'), false);
  assert.equal(match('What time is it now?', 'It is three in the afternoon.'), false, '질문에 답함');
  assert.equal(match('지금 몇 시야?', '지금은 오후 세 시입니다.'), false, '질문에 답함');
  assert.equal(match('Translate this into Korean.', '이것을 한국어로 번역하세요.'), false, '번역함');
  assert.equal(match('In the beginning', 'Sure! In the beginning'), false, '앞말');
  assert.equal(match('In the beginning', 'In the beginning. Let me know if you need anything else.'), false, '맺음말');
});

test('전사 검증: 전사가 없거나 비었거나 문자열이 아니면 거절한다', () => {
  for (const transcript of [undefined, null, '', '   ', '...!?', 42, {}]) {
    assert.equal(match('In the beginning', transcript), false);
  }
  assert.equal(match('', 'anything'), false);
  assert.equal(match('In the beginning', 'x'.repeat(20_000)), false);
});

test('전사 검증: 긴 본문은 흩어진 전사 잡음만 조금 허용하고, 문장 누락·추가·앞말·맺음말은 거절한다', () => {
  // 흩어진 잡음 3개(sister→sistr, quietly→quitely) — 허용
  const noisy = longEn.replace('sister', 'sistr').replace('quietly', 'quitely');
  assert.equal(match(longEn, noisy), true);
  const koNoisy = longKo.replace('읽었다', '읽엇다').replace('잠자리에', '잠짜리에');
  assert.equal(match(longKo, koNoisy), true);

  // 문장 누락
  assert.equal(match(longEn, longEn.replace('We talked about the summer trip and the old house. ', '')), false);
  assert.equal(match(longKo, longKo.replace('오후에는 창가에 앉아 오래된 편지를 다시 읽었다. ', '')), false);
  // 문장 추가
  assert.equal(match(longEn, longEn.replace('sister. ', 'sister. It was a lovely day. ')), false);
  assert.equal(match(longKo, `${longKo} 정말 좋은 하루였다.`), false);
  // 짧은 앞말·맺음말도 거절(앞·뒤 3자는 편집 0)
  assert.equal(match(longEn, `Ok. ${longEn}`), false);
  assert.equal(match(longEn, `${longEn} OK.`), false);
  assert.equal(match(longKo, `네. ${longKo}`), false);
  // 한곳에 몰린 오류(짧은 단어 누락보다 긴 구간 변경)는 거절
  assert.equal(match(longEn, longEn.replace('the summer trip', 'the winter')), false);
  // 전혀 다른 말
  assert.equal(match(longEn, longKo), false);
});

test('전사 검증: 숫자는 같은 숫자 또는 읽은 형태로 맞추고, 다른 숫자·숫자 누락은 거절한다', () => {
  assert.equal(match('3월 2일에 친구를 만났다', '삼월 이일에 친구를 만났다.'), true);
  assert.equal(match('3월 2일에 친구를 만났다', '3월 2일에 친구를 만났다'), true);
  assert.equal(match('I bought 3 apples in 2026', 'I bought three apples in two thousand twenty six'), true);
  assert.equal(match('I bought 3 apples', 'I bought 4 apples'), false, '다른 숫자');
  assert.equal(match('I bought 3 apples', 'I bought apples'), false, '숫자 누락');
  assert.equal(match('I bought 3 apples', 'I bought 33 apples'), false);
  assert.equal(match('3월 2일에 친구를 만났다', '삼월 이일에 동생을 만났다'), false, '숫자 밖 내용은 그대로 엄격');
});

test('전사 불일치는 저장하지 않고 고정 분류로만 기록하며, 새 세션으로 한 번만 다시 시도한다', async () => {
  const answered = speak({ transcript: 'It is three in the afternoon.' });
  const f = fixture({ scripts: [answered] });
  await assert.rejects(f.call({ text: 'What time is it now?', cacheKey: 'k' }), (error) => {
    assert.equal(error.code, 'internal');
    assert.equal(error.message, 'TTS 생성에 실패했습니다.');
    return true;
  });
  assert.equal(f.connections.length, 2, '불일치는 한 번만 재시도');
  assert.ok(f.connections.every((conn) => conn.closed));
  assert.notEqual(f.connections[0], f.connections[1], '새 세션');
  assert.equal(f.objects.size, 0, '실패한 음성은 저장하지 않는다');
  assert.equal(f.counters.length, 0);
  assert.equal(f.errors[0][1].kind, 'transcript_mismatch');
  const logged = JSON.stringify([f.errors, f.warnings]);
  assert.ok(!logged.includes('afternoon'), '전사를 로그에 남기지 않는다');
  assert.ok(!logged.includes('What time'), '본문을 로그에 남기지 않는다');
  assert.equal(f.warnings.length, 1);
  assert.match(String(f.warnings[0][0]), /transcript_mismatch/);
});

test('전사가 없거나 비면 실패하고 저장하지 않는다', async () => {
  for (const script of [speak({ transcriptVia: 'none' }), speak({ transcript: '' }), speak({ transcript: ' . ' })]) {
    const f = fixture({ scripts: [script] });
    await assert.rejects(f.call(standardCall), { code: 'internal' });
    assert.equal(f.errors[0][1].kind, 'transcript_mismatch');
    assert.equal(f.objects.size, 0);
    assert.equal(f.counters.length, 0);
  }
});

test('첫 시도 전사가 틀리고 다시 시도한 전사가 맞으면 두 번째 음성만 저장한다', async () => {
  const leadIn = speak({ chunks: [pcmOf(4, 9)], transcript: 'Sure! In the beginning' });
  const f = fixture({ scripts: [leadIn, speak()] });
  const result = await f.call(standardCall);
  assert.equal(result.cached, false);
  assert.equal(f.connections.length, 2);
  const saved = parseWav(f.objects.get(realtimePath('nova', 'standard', standardCall.text)));
  assert.deepEqual(saved.data, Buffer.concat([pcmOf(6), pcmOf(4, 3)]), '첫 시도 음성은 섞이지 않는다');
  assert.deepEqual(f.counters.map((value) => value.count), [1]);
});

test('response.done 출력 음성 파트의 전사로도 검증한다', async () => {
  const f = fixture({ scripts: [speak({ transcriptVia: 'response' })] });
  const result = await f.call(standardCall);
  assert.equal(result.cached, false);
  assert.equal(f.objects.size, 1);

  const wrong = fixture({ scripts: [speak({ transcriptVia: 'response', transcript: 'Hello there' })] });
  await assert.rejects(wrong.call(standardCall), { code: 'internal' });
  assert.equal(wrong.objects.size, 0);
});

test('남은 시간이 부족하면 전사 불일치를 다시 시도하지 않는다', async () => {
  let t = 0;
  const now = () => { const value = t; t += 20_000; return value; };
  const f = fixture({ scripts: [speak({ transcript: 'Something else entirely' }), speak()], realtimeOverrides: { now } });
  await assert.rejects(f.call(standardCall), { code: 'internal' });
  assert.equal(f.connections.length, 1);
  assert.equal(f.objects.size, 0);
  assert.equal(f.errors[0][1].kind, 'transcript_mismatch');
});

test('pcm16ToWav 는 표준 44바이트 PCM 헤더를 만든다', () => {
  const wav = parseWav(realtimeTts.pcm16ToWav(pcmOf(4)));
  assert.equal(wav.dataSize, 4);
  assert.equal(wav.sampleRate, 24000);
  assert.deepEqual(wav.data, pcmOf(4));
});
