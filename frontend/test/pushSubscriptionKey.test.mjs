// S21 웹 푸시 403 대비 — 구독 공개키를 설정된 VAPID 키와 맞춘 뒤에만 토큰을 저장하는지 시험(합성 키만 사용)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeVapidPublicKey,
  getTokenWithMatchingSubscription,
  isValidVapidPublicKey,
} from '../src/app/services/pushSubscriptionKey.ts';
import { registerDeviceForPush } from '../src/app/services/pushDevice.ts';

const keyBytes = (fill) => Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 0x04 : (fill + i) & 0xff));
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const CURRENT = keyBytes(1);
const DEFAULT = keyBytes(100);
const CURRENT_KEY = b64url(CURRENT);

let endpointSeq = 0;
function makeSub(bytes, log) {
  const endpoint = `https://push.example/ep-${(endpointSeq += 1)}`;
  return {
    endpoint,
    options: { applicationServerKey: bytes ? new Uint8Array(bytes).slice().buffer : null },
    unsubscribe: async () => { log.push(['unsubscribe', endpoint]); return log.unsubscribeResult ?? true; },
  };
}

// 브라우저 pushManager 흉내. state.sub이 현재 구독.
function makeRegistration(initialBytes, over = {}) {
  const log = [];
  const state = { sub: initialBytes === undefined ? null : makeSub(initialBytes, log) };
  const pushManager = {
    getSubscription: async () => { log.push(['getSubscription']); return state.sub; },
    subscribe: async (opts) => {
      assert.ok(opts.applicationServerKey instanceof ArrayBuffer);
      log.push(['subscribe', opts.userVisibleOnly, b64url(new Uint8Array(opts.applicationServerKey))]);
      if (over.subscribeError) throw new Error('subscribe failed');
      state.sub = makeSub(over.subscribeBytes ?? opts.applicationServerKey, log);
      return state.sub;
    },
  };
  return { registration: { pushManager }, state, log };
}

test('VAPID 키 검사: 65바이트·첫 바이트 0x04만 통과', () => {
  assert.equal(decodeVapidPublicKey(CURRENT_KEY)?.length, 65);
  assert.equal(CURRENT_KEY.length, 87);
  assert.equal(isValidVapidPublicKey(undefined), false);
  assert.equal(isValidVapidPublicKey(''), false);
  assert.equal(isValidVapidPublicKey('abc'), false);
  assert.equal(isValidVapidPublicKey(b64url(CURRENT.slice(0, 64))), false);
  const compressed = CURRENT.slice(); compressed[0] = 0x02;
  assert.equal(isValidVapidPublicKey(b64url(compressed)), false);
  assert.equal(isValidVapidPublicKey('!!' + CURRENT_KEY.slice(2)), false);
});

test('이미 같은 키로 구독돼 있으면 해지·재구독 없이 그대로 토큰을 받는다', async () => {
  const { registration, state, log } = makeRegistration(CURRENT);
  const before = state.sub;
  const token = await getTokenWithMatchingSubscription(CURRENT_KEY, registration, async (k, r) => {
    assert.equal(k, CURRENT_KEY); assert.equal(r, registration); return 'tok';
  });
  assert.equal(token, 'tok');
  assert.equal(state.sub, before);
  assert.equal(log.filter(([n]) => n === 'unsubscribe' || n === 'subscribe').length, 0);
});

test('구독이 없으면 설정 키로 새로 구독한 뒤 토큰을 받는다', async () => {
  const { registration, log } = makeRegistration(undefined);
  const token = await getTokenWithMatchingSubscription(CURRENT_KEY, registration, async () => 'tok');
  assert.equal(token, 'tok');
  assert.deepEqual(log.filter(([n]) => n === 'subscribe'), [['subscribe', true, CURRENT_KEY]]);
  assert.equal(log.filter(([n]) => n === 'unsubscribe').length, 0);
});

test('기본 키로 구독돼 있으면 이 registration 구독만 해지하고 설정 키로 다시 구독한 뒤 토큰을 받는다', async () => {
  const { registration, state, log } = makeRegistration(DEFAULT);
  const old = state.sub;
  let subAtGetToken;
  const token = await getTokenWithMatchingSubscription(CURRENT_KEY, registration, async () => { subAtGetToken = state.sub; return 'tok'; });
  assert.equal(token, 'tok');
  const order = log.filter(([n]) => n !== 'getSubscription');
  assert.deepEqual(order, [['unsubscribe', old.endpoint], ['subscribe', true, CURRENT_KEY]]);
  assert.notEqual(subAtGetToken, old);
  assert.deepEqual(new Uint8Array(subAtGetToken.options.applicationServerKey), CURRENT);
});

test('구독 키를 알 수 없으면(null) 다른 키로 보고 교체한다', async () => {
  const { registration, log } = makeRegistration(null);
  await getTokenWithMatchingSubscription(CURRENT_KEY, registration, async () => 'tok');
  assert.equal(log.filter(([n]) => n === 'unsubscribe').length, 1);
  assert.equal(log.filter(([n]) => n === 'subscribe').length, 1);
});

test('잘못된 VAPID 설정: 구독 조회·변경·getToken 없이 실패', async () => {
  const { registration, log } = makeRegistration(DEFAULT);
  let getTokenCalls = 0;
  await assert.rejects(getTokenWithMatchingSubscription('bad', registration, async () => { getTokenCalls += 1; return 'tok'; }));
  assert.equal(getTokenCalls, 0);
  assert.equal(log.length, 0);
});

test('registration이 없으면 SDK에 undefined를 넘기지 않고 실패', async () => {
  let getTokenCalls = 0;
  await assert.rejects(getTokenWithMatchingSubscription(CURRENT_KEY, undefined, async () => { getTokenCalls += 1; return 'tok'; }));
  await assert.rejects(getTokenWithMatchingSubscription(CURRENT_KEY, {}, async () => { getTokenCalls += 1; return 'tok'; }));
  assert.equal(getTokenCalls, 0);
});

test('해지 실패(false)·해지 예외·구독 예외·새 구독 키 불일치는 getToken 없이 실패', async () => {
  const cases = [
    () => { const r = makeRegistration(DEFAULT); r.log.unsubscribeResult = false; return r; },
    () => { const r = makeRegistration(DEFAULT); r.state.sub.unsubscribe = async () => { throw new Error('x'); }; return r; },
    () => makeRegistration(DEFAULT, { subscribeError: true }),
    () => makeRegistration(undefined, { subscribeError: true }),
    () => makeRegistration(undefined, { subscribeBytes: DEFAULT }),
  ];
  for (const make of cases) {
    const { registration } = make();
    let getTokenCalls = 0;
    await assert.rejects(getTokenWithMatchingSubscription(CURRENT_KEY, registration, async () => { getTokenCalls += 1; return 'tok'; }));
    assert.equal(getTokenCalls, 0);
  }
});

test('getToken 중 구독이 기본 키로 바뀌면 1회만 다시 맞춰 재시도하고 두 번째 토큰을 돌려준다', async () => {
  const { registration, state, log } = makeRegistration(CURRENT);
  let calls = 0;
  const token = await getTokenWithMatchingSubscription(CURRENT_KEY, registration, async () => {
    calls += 1;
    if (calls === 1) state.sub = makeSub(DEFAULT, log); // 경합으로 다른 키 구독이 생김
    return `tok-${calls}`;
  });
  assert.equal(token, 'tok-2');
  assert.equal(calls, 2);
  assert.equal(log.filter(([n]) => n === 'subscribe').length, 1);
});

test('키는 같지만 getToken 중 endpoint가 바뀌면 이전 토큰을 돌려주지 않고 재시도한다', async () => {
  const { registration, state, log } = makeRegistration(CURRENT);
  let calls = 0;
  const token = await getTokenWithMatchingSubscription(CURRENT_KEY, registration, async () => {
    calls += 1;
    if (calls === 1) state.sub = makeSub(CURRENT, log); // 같은 키, 새 endpoint
    return `tok-${calls}`;
  });
  assert.equal(token, 'tok-2');
  assert.equal(log.filter(([n]) => n === 'subscribe' || n === 'unsubscribe').length, 0);
});

test('getToken 뒤 구독이 사라지면 재시도한다', async () => {
  const { registration, state } = makeRegistration(CURRENT);
  let calls = 0;
  const token = await getTokenWithMatchingSubscription(CURRENT_KEY, registration, async () => {
    calls += 1;
    if (calls === 1) state.sub = null;
    return `tok-${calls}`;
  });
  assert.equal(token, 'tok-2');
});

test('경합이 반복되면 2회에서 멈추고 실패한다', async () => {
  const { registration, state, log } = makeRegistration(CURRENT);
  let calls = 0;
  await assert.rejects(getTokenWithMatchingSubscription(CURRENT_KEY, registration, async () => {
    calls += 1;
    state.sub = makeSub(CURRENT, log);
    return `tok-${calls}`;
  }));
  assert.equal(calls, 2);
});

// registerDeviceForPush(기존 흐름)에 notificationService와 같은 방식으로 연결했을 때 저장·캐시·성공 처리가 없는지
function wire(registration, over = {}) {
  const calls = { swRegistration: 0, sdkGetToken: 0, saveToken: [], cacheToken: [], onRegistered: 0 };
  const deps = {
    getPermission: () => 'granted',
    requestPermission: async () => 'granted',
    isSupported: async () => true,
    getVapidKey: () => (isValidVapidPublicKey(over.vapid ?? CURRENT_KEY) ? (over.vapid ?? CURRENT_KEY) : undefined),
    getSwRegistration: async () => { calls.swRegistration += 1; return registration; },
    getToken: (vapidKey, reg) => getTokenWithMatchingSubscription(vapidKey, reg, async () => {
      calls.sdkGetToken += 1; return over.sdkToken ? over.sdkToken(calls.sdkGetToken) : 'tok';
    }),
    saveToken: async (t) => { calls.saveToken.push(t); },
    cacheToken: (t) => { calls.cacheToken.push(t); },
    onRegistered: () => { calls.onRegistered += 1; },
  };
  return { deps, calls };
}

const noSuccess = (calls) => {
  assert.deepEqual(calls.saveToken, []);
  assert.deepEqual(calls.cacheToken, []);
  assert.equal(calls.onRegistered, 0);
};

test('연결: 기본 키 구독을 교체한 뒤에만 토큰을 저장·캐시한다', async () => {
  const { registration, state } = makeRegistration(DEFAULT);
  const { deps, calls } = wire(registration);
  assert.deepEqual(await registerDeviceForPush(deps), { ok: true });
  assert.deepEqual(calls.saveToken, ['tok']);
  assert.deepEqual(calls.cacheToken, ['tok']);
  assert.deepEqual(new Uint8Array(state.sub.options.applicationServerKey), CURRENT);
});

test('연결: 잘못된 VAPID 설정이면 SW 등록·구독·저장 없이 config 실패', async () => {
  const { registration, log } = makeRegistration(DEFAULT);
  const { deps, calls } = wire(registration, { vapid: 'bad' });
  assert.deepEqual(await registerDeviceForPush(deps), { ok: false, reason: 'config' });
  assert.equal(calls.swRegistration, 0);
  assert.equal(calls.sdkGetToken, 0);
  assert.equal(log.length, 0);
  noSuccess(calls);
});

test('연결: registration 없음·구독 실패·반복 경합은 token 실패이고 저장·캐시·성공 처리가 없다', async () => {
  const missing = wire(undefined);
  assert.deepEqual(await registerDeviceForPush(missing.deps), { ok: false, reason: 'token' });
  assert.equal(missing.calls.sdkGetToken, 0);
  noSuccess(missing.calls);

  const subFail = wire(makeRegistration(DEFAULT, { subscribeError: true }).registration);
  assert.deepEqual(await registerDeviceForPush(subFail.deps), { ok: false, reason: 'token' });
  assert.equal(subFail.calls.sdkGetToken, 0);
  noSuccess(subFail.calls);

  const unsubFail = makeRegistration(DEFAULT); unsubFail.log.unsubscribeResult = false;
  const unsub = wire(unsubFail.registration);
  assert.deepEqual(await registerDeviceForPush(unsub.deps), { ok: false, reason: 'token' });
  noSuccess(unsub.calls);

  const racing = makeRegistration(CURRENT);
  const race = wire(racing.registration, { sdkToken: (n) => { racing.state.sub = makeSub(CURRENT, racing.log); return `tok-${n}`; } });
  assert.deepEqual(await registerDeviceForPush(race.deps), { ok: false, reason: 'token' });
  assert.equal(race.calls.sdkGetToken, 2);
  noSuccess(race.calls);
});

test('연결: endpoint가 바뀐 1차 토큰은 저장하지 않고 재시도 토큰만 저장한다', async () => {
  const r = makeRegistration(CURRENT);
  const { deps, calls } = wire(r.registration, { sdkToken: (n) => { if (n === 1) r.state.sub = makeSub(CURRENT, r.log); return `tok-${n}`; } });
  assert.deepEqual(await registerDeviceForPush(deps), { ok: true });
  assert.deepEqual(calls.saveToken, ['tok-2']);
  assert.deepEqual(calls.cacheToken, ['tok-2']);
});
