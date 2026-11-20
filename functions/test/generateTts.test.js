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
    setImmediate(() => this.script.onSend(this, event));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.socket.readyState = 3;
    setImmediate(() => (this.socketHandlers.close || []).forEach((cb) => cb(1000)));
  }
}

// 기본 성공 시나리오: session.update → session.updated, response.create → 오디오 조각 → response.done(completed)
function speak({ chunks = [pcmOf(6), pcmOf(4, 3)], doneStatus = 'completed', statusDetails, afterAudio } = {}) {
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
        conn.emit({ type: 'response.done', response: { status: doneStatus, status_details: statusDetails } });
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
const wavPathRe = /^ttsCache\/realtime-v1\/(standard|native)\/[0-9a-f]{64}\.wav$/;
const realtimePath = (voice, quality, text) => realtimeTts.buildRealtimeTtsCachePath({ voice, quality, text });

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

test('기존 표준·고음질 MP3 캐시가 있으면 Realtime 을 부르지 않고 그대로 돌려준다(삭제·덮어쓰기 없음)', async () => {
  const legacyStandard = 'ttsCache/bible_genesis_1_verse_1_nova_nova.mp3';
  const legacyNative = ttsQuality.buildTtsCachePath({ cacheKey: 'x', voice: 'nova', quality: 'native', text: standardCall.text });
  assert.match(legacyNative, /^ttsCache\/native\/[0-9a-f]{64}\.mp3$/);
  const f = fixture({ seed: { [legacyStandard]: Buffer.from('mp3-a'), [legacyNative]: Buffer.from('mp3-b') } });

  const standard = await f.call(standardCall);
  const native = await f.call({ ...standardCall, quality: 'native' });
  assert.equal(standard.cached, true);
  assert.equal(standard.audioUrl, `https://signed.test/${legacyStandard}`);
  assert.equal(native.cached, true);
  assert.equal(native.audioUrl, `https://signed.test/${legacyNative}`);
  assert.equal(f.connections.length, 0);
  assert.equal(f.counters.length, 0);
  assert.deepEqual([...f.objects.keys()].sort(), [legacyNative, legacyStandard].sort());
  assert.deepEqual(f.objects.get(legacyStandard), Buffer.from('mp3-a'));
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
  assert.match(keys[0], /^ttsCache\/realtime-v1\/standard\//);
  assert.match(keys[1], /^ttsCache\/realtime-v1\/native\//);

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
});

test('pcm16ToWav 는 표준 44바이트 PCM 헤더를 만든다', () => {
  const wav = parseWav(realtimeTts.pcm16ToWav(pcmOf(4)));
  assert.equal(wav.dataSize, 4);
  assert.equal(wav.sampleRate, 24000);
  assert.deepEqual(wav.data, pcmOf(4));
});
