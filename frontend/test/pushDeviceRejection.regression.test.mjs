// 아이폰 알림 복구 후속 — 권한 요청 거부의 처리되지 않은 거부 누수, 서버 저장 뒤 기기 후처리 오류, 설정 화면 등록 버튼 예외 처리 회귀 시험
// 원본 재현: docs/reviews/2026-11-09-iphone-push/followup-1/haru-push-rejection-probe.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describeRegistrationFailure,
  describeRegistrationWarning,
  registerDeviceForPush,
  runDeviceRegistration,
  UNEXPECTED_REGISTRATION_ERROR,
} from '../src/app/services/pushDevice.ts';

function makeDeps(over = {}) {
  const order = [];
  const calls = { saveToken: [], cacheToken: [], onRegistered: 0 };
  const deps = {
    getPermission: () => 'default',
    requestPermission: async () => { order.push('requestPermission'); return 'granted'; },
    isSupported: async () => { order.push('isSupported'); return true; },
    getVapidKey: () => 'vapid',
    getSwRegistration: async () => undefined,
    getToken: async () => 'tok-1',
    saveToken: async (t) => { calls.saveToken.push(t); },
    cacheToken: (t) => { calls.cacheToken.push(t); },
    onRegistered: () => { calls.onRegistered += 1; },
    ...over,
  };
  return { deps, calls, order };
}

// 처리되지 않은 거부와 뒤늦은 처리(PromiseRejectionHandledWarning의 원인)를 함께 수집한다.
async function collectRejections(run) {
  const unhandled = [];
  const lateHandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  const onHandled = (promise) => lateHandled.push(promise);
  process.on('unhandledRejection', onUnhandled);
  process.on('rejectionHandled', onHandled);
  try {
    const value = await run();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setImmediate(r));
    return { value, unhandled, lateHandled };
  } finally {
    process.off('unhandledRejection', onUnhandled);
    process.off('rejectionHandled', onHandled);
  }
}

test('원본 재현: 권한 요청이 즉시 거부되고 지원 확인이 25ms 뒤 true여도 처리되지 않은 거부가 생기지 않는다', async () => {
  const { value, unhandled, lateHandled } = await collectRejections(() => registerDeviceForPush({
    getPermission: () => 'default',
    requestPermission: () => Promise.reject(new Error('synthetic permission request denied')),
    isSupported: () => new Promise((resolve) => setTimeout(() => resolve(true), 25)),
    getVapidKey: () => 'synthetic-public-key',
    getSwRegistration: async () => undefined,
    getToken: async () => 'synthetic-token',
    saveToken: async () => {},
    cacheToken: () => {},
  }));
  assert.deepEqual(value, { ok: false, reason: 'dismissed' });
  assert.equal(unhandled.length, 0, 'unhandledRejection 없음');
  assert.equal(lateHandled.length, 0, 'rejectionHandled(뒤늦은 처리) 없음');
});

test('권한 요청이 동기 예외를 던져도 dismissed로 끝나고, 요청은 지원 확인보다 먼저 동기적으로 시작된다', async () => {
  const { deps, calls, order } = makeDeps({
    requestPermission: () => { order.push('requestPermission'); throw new TypeError('sync throw'); },
    isSupported: () => { order.push('isSupported'); return new Promise((r) => setTimeout(() => r(true), 10)); },
  });
  const { value, unhandled, lateHandled } = await collectRejections(() => {
    const pending = registerDeviceForPush(deps);
    assert.deepEqual(order, ['requestPermission', 'isSupported'], '호출 직후 권한 요청이 먼저 시작돼야 함');
    return pending;
  });
  assert.deepEqual(value, { ok: false, reason: 'dismissed' });
  assert.deepEqual(unhandled, []);
  assert.deepEqual(lateHandled, []);
  assert.deepEqual(calls.saveToken, []);
  assert.deepEqual(calls.cacheToken, []);
});

test('지원 확인이 오래 걸리는 동안 거부된 권한 요청도 동기 시작 순서를 지키고 누수 없이 dismissed', async () => {
  let resolveSupported;
  const { deps, order } = makeDeps({
    requestPermission: () => { order.push('requestPermission'); return Promise.reject(new Error('denied by user agent')); },
    isSupported: () => { order.push('isSupported'); return new Promise((r) => { resolveSupported = r; }); },
  });
  const { value, unhandled, lateHandled } = await collectRejections(async () => {
    const pending = registerDeviceForPush(deps);
    assert.equal(order[0], 'requestPermission');
    await new Promise((r) => setTimeout(r, 20));
    resolveSupported(true);
    return pending;
  });
  assert.deepEqual(value, { ok: false, reason: 'dismissed' });
  assert.deepEqual(unhandled, []);
  assert.deepEqual(lateHandled, []);
});

test('미지원 기기에서 권한 요청이 거부돼도 unsupported로 끝나고 누수 없음', async () => {
  const { deps } = makeDeps({
    requestPermission: () => Promise.reject(new Error('x')),
    isSupported: () => new Promise((r) => setTimeout(() => r(false), 10)),
  });
  const { value, unhandled, lateHandled } = await collectRejections(() => registerDeviceForPush(deps));
  assert.deepEqual(value, { ok: false, reason: 'unsupported' });
  assert.deepEqual(unhandled, []);
  assert.deepEqual(lateHandled, []);
});

test('서버 저장 뒤 localStorage 캐시가 실패하면 서버 등록 성공(ok)과 cache 경고로 구분하고 예외를 내보내지 않는다', async () => {
  const { deps, calls } = makeDeps({
    cacheToken: () => { throw new DOMException('quota', 'QuotaExceededError'); },
  });
  const { value, unhandled } = await collectRejections(() => registerDeviceForPush(deps));
  assert.deepEqual(value, { ok: true, warning: 'cache' });
  assert.deepEqual(calls.saveToken, ['tok-1'], '서버 저장은 실제로 끝남');
  assert.equal(calls.onRegistered, 1, '캐시 실패와 별개로 포그라운드 준비는 시도');
  assert.deepEqual(unhandled, []);
  assert.match(describeRegistrationWarning('cache'), /등록했습니다/);
  assert.match(describeRegistrationWarning('cache'), /지워지지 않을 수 있습니다/);
});

test('서버 저장 뒤 onRegistered가 실패하면 ok와 listener 경고, 둘 다 실패하면 cache 경고를 우선한다', async () => {
  const listener = makeDeps({ onRegistered: () => { throw new Error('listener'); } });
  assert.deepEqual(await registerDeviceForPush(listener.deps), { ok: true, warning: 'listener' });
  assert.deepEqual(listener.calls.cacheToken, ['tok-1']);
  assert.match(describeRegistrationWarning('listener'), /다시 열면/);

  const both = makeDeps({
    cacheToken: () => { throw new Error('cache'); },
    onRegistered: () => { throw new Error('listener'); },
  });
  assert.deepEqual(await registerDeviceForPush(both.deps), { ok: true, warning: 'cache' });

  const clean = makeDeps();
  assert.deepEqual(await registerDeviceForPush(clean.deps), { ok: true }, '정상 등록은 경고 없음');
});

test('서버 저장 실패는 여전히 save 실패이며 캐시·완료 처리를 하지 않는다(경고로 바뀌지 않음)', async () => {
  const { deps, calls } = makeDeps({ saveToken: async () => { throw new Error('permission-denied'); } });
  assert.deepEqual(await registerDeviceForPush(deps), { ok: false, reason: 'save' });
  assert.deepEqual(calls.cacheToken, []);
  assert.equal(calls.onRegistered, 0);
});

function makeUi(over = {}) {
  const log = [];
  const ui = {
    setBusy: (b) => log.push(['busy', b]),
    setRegistered: (r) => log.push(['registered', r]),
    notifySuccess: (m) => log.push(['success', m]),
    notifyWarning: (m) => log.push(['warning', m]),
    notifyError: (m) => log.push(['error', m]),
    refresh: () => log.push(['refresh']),
    ...over,
  };
  return { ui, log };
}

test('설정 화면 등록 처리: register는 첫 await 전에 동기적으로 호출된다(제스처 유지)', async () => {
  const { ui, log } = makeUi();
  let called = 0;
  const pending = runDeviceRegistration(() => { called += 1; return Promise.resolve({ ok: true }); }, ui);
  assert.equal(called, 1, '동기 호출');
  assert.deepEqual(log, [['busy', true]]);
  await pending;
  assert.deepEqual(log, [
    ['busy', true],
    ['registered', true],
    ['success', '이 기기를 알림 받을 기기로 등록했습니다.'],
    ['busy', false],
    ['refresh'],
  ]);
});

test('설정 화면 등록 처리: register가 동기 예외·거부를 내도 로딩이 풀리고 등록 완료로 표시하지 않으며 예외가 새지 않는다', async () => {
  for (const register of [
    () => { throw new Error('sync'); },
    () => Promise.reject(new Error('async')),
  ]) {
    const { ui, log } = makeUi();
    const { unhandled } = await collectRejections(() => runDeviceRegistration(register, ui));
    assert.deepEqual(log, [
      ['busy', true],
      ['registered', false],
      ['error', UNEXPECTED_REGISTRATION_ERROR],
      ['busy', false],
      ['refresh'],
    ]);
    assert.deepEqual(unhandled, []);
  }
});

test('설정 화면 등록 처리: 경고가 있는 성공은 등록 완료+경고 안내, 실패는 등록 완료 아님+실패 사유', async () => {
  const warned = makeUi();
  await runDeviceRegistration(async () => ({ ok: true, warning: 'cache' }), warned.ui);
  assert.deepEqual(warned.log.filter(([k]) => k !== 'busy' && k !== 'refresh'), [
    ['registered', true],
    ['warning', describeRegistrationWarning('cache')],
  ]);

  const failed = makeUi();
  await runDeviceRegistration(async () => ({ ok: false, reason: 'token' }), failed.ui);
  assert.deepEqual(failed.log.filter(([k]) => k !== 'busy' && k !== 'refresh'), [
    ['registered', false],
    ['error', describeRegistrationFailure('token')],
  ]);
});

test('설정 화면 등록 처리: 안내 표시·상태 재확인 자체가 실패해도 로딩은 풀리고 예외가 새지 않는다', async () => {
  const { ui, log } = makeUi({
    notifySuccess: () => { throw new Error('toast'); },
    notifyError: () => { throw new Error('toast'); },
    refresh: () => { throw new Error('refresh'); },
  });
  await runDeviceRegistration(async () => ({ ok: true }), ui);
  assert.deepEqual(log, [['busy', true], ['registered', true], ['registered', false], ['busy', false]]);
});

test('설정 화면 연결: handleRegisterThisDevice는 runDeviceRegistration 안에서 registerThisDevice를 곧바로 호출한다', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app');
  const settings = fs.readFileSync(path.join(root, 'pages/SettingsPage.tsx'), 'utf8');
  const handler = settings.match(/const handleRegisterThisDevice = async \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(handler, '등록 핸들러 존재');
  assert.match(handler[0], /await runDeviceRegistration\(\(\) => registerThisDevice\(uid\), \{/);
  assert.equal((handler[0].match(/await /g) || []).length, 1, 'runDeviceRegistration 앞에 다른 await 없음');
  assert.match(handler[0], /setBusy: setIsRegisteringDevice/);
  assert.match(handler[0], /setRegistered: setDeviceRegisteredNow/);
  assert.match(handler[0], /notifyWarning:/);
});
