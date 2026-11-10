// S21 웹 푸시 — 명시적 등록 경로의 FCM SW update()·활성화 대기 시험(가짜 worker·가짜 시계, 브라우저·서버 호출 없음)
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateFcmRegistrationAndWaitActive } from '../src/app/services/fcmRegistrationUpdate.ts';
import { getTokenWithMatchingSubscription, isValidVapidPublicKey } from '../src/app/services/pushSubscriptionKey.ts';
import { registerDeviceForPush } from '../src/app/services/pushDevice.ts';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function makeWorker(state) {
  const listeners = new Set();
  return {
    state,
    addEventListener(type, fn) { assert.equal(type, 'statechange'); listeners.add(fn); },
    removeEventListener(type, fn) { assert.equal(type, 'statechange'); listeners.delete(fn); },
    to(next) { this.state = next; for (const fn of [...listeners]) fn(); },
    listenerCount: () => listeners.size,
  };
}

// 가짜 시계: 예약만 기록하고 fire()로 직접 시간 초과를 일으킨다.
function makeTimer() {
  const entries = [];
  const timer = (fn, ms) => {
    const entry = { fn, ms, cancelled: false };
    entries.push(entry);
    return () => { entry.cancelled = true; };
  };
  return {
    timer,
    entries,
    fire: () => { for (const e of entries) if (!e.cancelled) e.fn(); },
    pending: () => entries.filter((e) => !e.cancelled).length,
  };
}

// update()가 불리면 onUpdate(reg)로 상태를 바꾼다.
function makeReg({ active = makeWorker('activated'), installing = null, waiting = null, onUpdate } = {}) {
  const reg = {
    active,
    installing,
    waiting,
    updateCalls: 0,
    update: async () => { reg.updateCalls += 1; if (onUpdate) await onUpdate(reg); },
  };
  return reg;
}

async function settleState(promise) {
  const box = { state: 'pending' };
  promise.then((v) => { box.state = 'fulfilled'; box.value = v; }, (e) => { box.state = 'rejected'; box.error = e; });
  await flush();
  return box;
}

test('새 update 없음: active가 activated면 update 1회 뒤 바로 통과하고 시계를 정리한다', async () => {
  const clock = makeTimer();
  const reg = makeReg();
  assert.equal(await updateFcmRegistrationAndWaitActive(reg, { timer: clock.timer, timeoutMs: 50 }), reg);
  assert.equal(reg.updateCalls, 1);
  assert.equal(clock.entries[0].ms, 50);
  assert.equal(clock.pending(), 0);
});

test('기본 제한시간은 10초', async () => {
  const clock = makeTimer();
  await updateFcmRegistrationAndWaitActive(makeReg(), { timer: clock.timer });
  assert.equal(clock.entries[0].ms, 10_000);
});

test('이전 active + 새 installing: 이전 active가 아니라 새 worker가 activated일 때까지 기다린다', async () => {
  const clock = makeTimer();
  const oldActive = makeWorker('activated');
  const fresh = makeWorker('installing');
  const reg = makeReg({ active: oldActive, onUpdate: (r) => { r.installing = fresh; } });
  const box = await settleState(updateFcmRegistrationAndWaitActive(reg, { timer: clock.timer }));
  assert.equal(box.state, 'pending'); // 이전 active가 activated여도 통과시키지 않음
  assert.equal(fresh.listenerCount(), 1);
  fresh.to('installed');
  fresh.to('activating');
  await flush();
  assert.equal(box.state, 'pending');
  fresh.to('activated');
  await flush();
  assert.equal(box.state, 'fulfilled');
  assert.equal(fresh.listenerCount(), 0);
  assert.equal(clock.pending(), 0);
});

test('새 waiting worker도 activated까지 기다린다', async () => {
  const clock = makeTimer();
  const fresh = makeWorker('installed');
  const reg = makeReg({ onUpdate: (r) => { r.waiting = fresh; } });
  const box = await settleState(updateFcmRegistrationAndWaitActive(reg, { timer: clock.timer }));
  assert.equal(box.state, 'pending');
  fresh.to('activated');
  await flush();
  assert.equal(box.state, 'fulfilled');
  assert.equal(fresh.listenerCount(), 0);
});

test('installing이 waiting보다 우선한다', async () => {
  const clock = makeTimer();
  const installing = makeWorker('installing');
  const waiting = makeWorker('installed');
  const reg = makeReg({ onUpdate: (r) => { r.installing = installing; r.waiting = waiting; } });
  const box = await settleState(updateFcmRegistrationAndWaitActive(reg, { timer: clock.timer }));
  assert.equal(installing.listenerCount(), 1);
  assert.equal(waiting.listenerCount(), 0);
  waiting.to('activated');
  await flush();
  assert.equal(box.state, 'pending');
  installing.to('activated');
  await flush();
  assert.equal(box.state, 'fulfilled');
});

test('활성화가 이미 끝남: 잡은 후보가 이미 activated이거나, 후보가 비고 active가 새 worker면 통과', async () => {
  const clock = makeTimer();
  const already = makeWorker('activated');
  const reg1 = makeReg({ active: makeWorker('activated'), onUpdate: (r) => { r.waiting = already; } });
  await updateFcmRegistrationAndWaitActive(reg1, { timer: clock.timer });
  assert.equal(already.listenerCount(), 0);

  const fresh = makeWorker('activated');
  const reg2 = makeReg({ active: makeWorker('activated'), onUpdate: (r) => { r.active = fresh; r.installing = null; } });
  assert.equal(await updateFcmRegistrationAndWaitActive(reg2, { timer: clock.timer }), reg2);
  assert.equal(clock.pending(), 0);
});

test('후보 없이 active가 activating이면 activated까지 기다린다', async () => {
  const clock = makeTimer();
  const active = makeWorker('activating');
  const box = await settleState(updateFcmRegistrationAndWaitActive(makeReg({ active }), { timer: clock.timer }));
  assert.equal(box.state, 'pending');
  active.to('activated');
  await flush();
  assert.equal(box.state, 'fulfilled');
});

test('update() 실패(거부·동기 예외)는 실패이고 후보를 기다리지 않으며 시계를 정리한다', async () => {
  for (const update of [async () => { throw new Error('network'); }, () => { throw new Error('sync'); }]) {
    const clock = makeTimer();
    const reg = makeReg();
    reg.update = update;
    await assert.rejects(updateFcmRegistrationAndWaitActive(reg, { timer: clock.timer }), /network|sync/);
    assert.equal(clock.pending(), 0);
  }
});

test('후보가 이미 redundant이거나 대기 중 redundant가 되면 실패하고 리스너를 뗀다', async () => {
  const clock = makeTimer();
  const dead = makeWorker('redundant');
  await assert.rejects(
    updateFcmRegistrationAndWaitActive(makeReg({ onUpdate: (r) => { r.installing = dead; } }), { timer: clock.timer }),
    /fcm-sw-redundant/,
  );

  const fresh = makeWorker('installing');
  const p = updateFcmRegistrationAndWaitActive(makeReg({ onUpdate: (r) => { r.installing = fresh; } }), { timer: clock.timer });
  await flush();
  fresh.to('redundant');
  await assert.rejects(p, /fcm-sw-redundant/);
  assert.equal(fresh.listenerCount(), 0);
  assert.equal(clock.pending(), 0);
});

test('update()가 끝나지 않으면 시간 초과로 실패한다', async () => {
  const clock = makeTimer();
  const reg = makeReg();
  reg.update = () => new Promise(() => {});
  const p = updateFcmRegistrationAndWaitActive(reg, { timer: clock.timer });
  await flush();
  clock.fire();
  await assert.rejects(p, /fcm-sw-update-timeout/);
  assert.equal(clock.pending(), 0);
});

test('새 worker가 activated에 이르지 않으면 시간 초과로 실패하고 리스너를 뗀다', async () => {
  const clock = makeTimer();
  const fresh = makeWorker('installed');
  const p = updateFcmRegistrationAndWaitActive(makeReg({ onUpdate: (r) => { r.waiting = fresh; } }), { timer: clock.timer });
  await flush();
  assert.equal(fresh.listenerCount(), 1);
  clock.fire();
  await assert.rejects(p, /fcm-sw-update-timeout/);
  assert.equal(fresh.listenerCount(), 0);
  assert.equal(clock.pending(), 0);
});

test('registration 없음·update 뒤 worker가 하나도 없으면 실패', async () => {
  const clock = makeTimer();
  await assert.rejects(updateFcmRegistrationAndWaitActive(undefined, { timer: clock.timer }), /fcm-sw-registration-missing/);
  assert.equal(clock.entries.length, 0);
  await assert.rejects(updateFcmRegistrationAndWaitActive(makeReg({ active: null }), { timer: clock.timer }), /fcm-sw-active-missing/);
  assert.equal(clock.pending(), 0);
});

// registerDeviceForPush(기존 흐름)에 notificationService와 같은 방식으로 연결: getSwRegistration만 update 보호를 거친다.
const keyBytes = (fill) => Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 0x04 : (fill + i) & 0xff));
const CURRENT = keyBytes(1);
const CURRENT_KEY = Buffer.from(CURRENT).toString('base64url');

function withPushManager(reg) {
  const sub = {
    endpoint: 'https://push.example/ep-1',
    options: { applicationServerKey: CURRENT.slice().buffer },
    unsubscribe: async () => true,
  };
  reg.pushCalls = 0;
  reg.pushManager = {
    getSubscription: async () => { reg.pushCalls += 1; return sub; },
    subscribe: async () => { reg.pushCalls += 1; return sub; },
  };
  return reg;
}

function wire(reg, clock, over = {}) {
  const calls = { sdkGetToken: 0, saveToken: [], cacheToken: [], onRegistered: 0 };
  const vapid = over.vapid ?? CURRENT_KEY;
  const deps = {
    getPermission: () => 'granted',
    requestPermission: async () => 'granted',
    isSupported: async () => true,
    getVapidKey: () => (isValidVapidPublicKey(vapid) ? vapid : undefined),
    getSwRegistration: async () => updateFcmRegistrationAndWaitActive(reg, { timer: clock.timer }),
    getToken: (vapidKey, r) => getTokenWithMatchingSubscription(vapidKey, r, async () => { calls.sdkGetToken += 1; return 'tok'; }),
    saveToken: async (t) => { calls.saveToken.push(t); },
    cacheToken: (t) => { calls.cacheToken.push(t); },
    onRegistered: () => { calls.onRegistered += 1; },
  };
  return { deps, calls };
}

const noSuccess = (calls) => {
  assert.equal(calls.sdkGetToken, 0);
  assert.deepEqual(calls.saveToken, []);
  assert.deepEqual(calls.cacheToken, []);
  assert.equal(calls.onRegistered, 0);
};

test('연결: 새 worker가 activated된 뒤에만 구독 확인·getToken·저장이 진행된다', async () => {
  const clock = makeTimer();
  const fresh = makeWorker('installing');
  const reg = withPushManager(makeReg({ onUpdate: (r) => { r.installing = fresh; } }));
  const { deps, calls } = wire(reg, clock);
  const box = await settleState(registerDeviceForPush(deps));
  assert.equal(box.state, 'pending');
  assert.equal(reg.pushCalls, 0);
  assert.equal(calls.sdkGetToken, 0);
  fresh.to('activated');
  await flush();
  assert.deepEqual(box.value, { ok: true });
  assert.deepEqual(calls.saveToken, ['tok']);
  assert.deepEqual(calls.cacheToken, ['tok']);
});

test('연결: update 실패·redundant·시간 초과·active 없음은 token 실패이고 구독·getToken·저장·캐시·성공 처리가 없다', async () => {
  const scenarios = [
    ['update 실패', () => { const r = makeReg(); r.update = async () => { throw new Error('network'); }; return r; }, false],
    ['redundant', () => makeReg({ onUpdate: (r) => { r.installing = makeWorker('redundant'); } }), false],
    ['활성화 시간 초과', () => makeReg({ onUpdate: (r) => { r.waiting = makeWorker('installed'); } }), true],
    ['update 시간 초과', () => { const r = makeReg(); r.update = () => new Promise(() => {}); return r; }, true],
    ['active 없음', () => makeReg({ active: null }), false],
  ];
  for (const [name, make, needsTimeout] of scenarios) {
    const clock = makeTimer();
    const reg = withPushManager(make());
    const { deps, calls } = wire(reg, clock);
    const p = registerDeviceForPush(deps);
    if (needsTimeout) { await flush(); clock.fire(); }
    assert.deepEqual(await p, { ok: false, reason: 'token' }, name);
    assert.equal(reg.pushCalls, 0, name);
    noSuccess(calls);
    assert.equal(clock.pending(), 0, name);
  }
});

test('연결: 잘못된 VAPID 설정이면 SW update 전에 config 실패', async () => {
  const clock = makeTimer();
  const reg = withPushManager(makeReg());
  const { deps, calls } = wire(reg, clock, { vapid: 'bad' });
  assert.deepEqual(await registerDeviceForPush(deps), { ok: false, reason: 'config' });
  assert.equal(reg.updateCalls, 0);
  assert.equal(clock.entries.length, 0);
  noSuccess(calls);
});
