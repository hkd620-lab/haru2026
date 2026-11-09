// 아이폰 알림 복구 — 이 기기 권한·등록 상태, 사용자 제스처 권한 요청, 내 기기 테스트 알림, 포그라운드 표시 동작 시험
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createForegroundListenerInstaller,
  describeDevicePushStatus,
  describeRegistrationFailure,
  describeSelfTestError,
  describeSelfTestResult,
  registerDeviceForPush,
  resolveDevicePushStatus,
  sendSelfTestNotification,
  showForegroundNotification,
} from '../src/app/services/pushDevice.ts';

const env = (over = {}) => ({ supported: true, permission: 'granted', isIOS: true, standalone: true, ...over });

function makeDeps(over = {}) {
  const calls = { requestPermission: 0, isSupported: 0, getToken: 0, saveToken: [], cacheToken: [], onRegistered: 0 };
  const deps = {
    getPermission: () => 'default',
    requestPermission: async () => { calls.requestPermission += 1; return 'granted'; },
    isSupported: async () => { calls.isSupported += 1; return true; },
    getVapidKey: () => 'vapid',
    getSwRegistration: async () => ({ id: 'sw' }),
    getToken: async () => { calls.getToken += 1; return 'tok-1'; },
    saveToken: async (t) => { calls.saveToken.push(t); },
    cacheToken: (t) => { calls.cacheToken.push(t); },
    onRegistered: () => { calls.onRegistered += 1; },
    ...over,
  };
  return { deps, calls };
}

test('계정 알림이 켜져 있어도 이 기기 권한이 default면 등록 필요로 판정하고 등록 버튼을 보인다', () => {
  const status = resolveDevicePushStatus(env({ permission: 'default' }), false);
  assert.equal(status, 'needs-permission');
  const view = describeDevicePushStatus(status);
  assert.equal(view.canRegister, true);
  assert.equal(view.buttonLabel, '이 기기에서 알림 받기');
});

test('권한 허용·토큰 캐시만으로 등록 완료로 단정하지 않는다', () => {
  assert.equal(resolveDevicePushStatus(env(), false), 'granted-unverified');
  assert.equal(resolveDevicePushStatus(env(), true), 'registered');
  assert.equal(describeDevicePushStatus('granted-unverified').canRegister, true);
});

test('denied·미지원·아이폰 미설치 PWA는 등록 버튼 없이 안내만 한다', () => {
  assert.equal(resolveDevicePushStatus(env({ permission: 'denied' }), true), 'denied');
  assert.equal(resolveDevicePushStatus(env({ supported: false, permission: 'unsupported', standalone: false }), false), 'needs-install');
  assert.equal(resolveDevicePushStatus(env({ supported: false, isIOS: false, standalone: false }), false), 'unsupported');
  assert.equal(resolveDevicePushStatus(null, false), 'checking');
  for (const s of ['denied', 'needs-install', 'unsupported', 'checking']) {
    assert.equal(describeDevicePushStatus(s).canRegister, false, s);
  }
  assert.match(describeDevicePushStatus('needs-install').hint, /홈 화면에 추가/);
  assert.match(describeDevicePushStatus('denied').hint, /설정/);
});

test('사용자 제스처 경로: 다른 await보다 먼저(동기적으로) 권한 요청을 시작한다', async () => {
  let resolveSupported;
  const { deps, calls } = makeDeps({
    isSupported: () => new Promise((r) => { resolveSupported = r; }),
  });
  const pending = registerDeviceForPush(deps);
  assert.equal(calls.requestPermission, 1, '호출 직후 동기적으로 requestPermission이 시작돼야 함');
  resolveSupported(true);
  assert.deepEqual(await pending, { ok: true });
  assert.deepEqual(calls.saveToken, ['tok-1']);
  assert.deepEqual(calls.cacheToken, ['tok-1']);
  assert.equal(calls.onRegistered, 1);
});

test('이미 granted면 권한 창 없이 재등록하고, denied면 권한 요청을 다시 띄우지 않는다', async () => {
  const granted = makeDeps({ getPermission: () => 'granted' });
  assert.deepEqual(await registerDeviceForPush(granted.deps), { ok: true });
  assert.equal(granted.calls.requestPermission, 0);

  const denied = makeDeps({ getPermission: () => 'denied' });
  assert.deepEqual(await registerDeviceForPush(denied.deps), { ok: false, reason: 'denied' });
  assert.equal(denied.calls.requestPermission, 0);
  assert.equal(denied.calls.getToken, 0);
});

test('권한 창을 닫거나 거부하면 성공으로 표시하지 않는다', async () => {
  const dismissed = makeDeps({ requestPermission: async () => 'default' });
  assert.deepEqual(await registerDeviceForPush(dismissed.deps), { ok: false, reason: 'dismissed' });
  const rejected = makeDeps({ requestPermission: async () => 'denied' });
  assert.deepEqual(await registerDeviceForPush(rejected.deps), { ok: false, reason: 'denied' });
  const thrown = makeDeps({ requestPermission: async () => { throw new Error('x'); } });
  assert.deepEqual(await registerDeviceForPush(thrown.deps), { ok: false, reason: 'dismissed' });
});

test('미지원·설정 누락·토큰 실패·저장 실패는 모두 실패이며 캐시·완료 처리를 하지 않는다', async () => {
  const cases = [
    [{ getPermission: () => 'unsupported' }, 'unsupported'],
    [{ isSupported: async () => false }, 'unsupported'],
    [{ isSupported: async () => { throw new Error('idb'); } }, 'unsupported'],
    [{ getVapidKey: () => undefined }, 'config'],
    [{ getToken: async () => '' }, 'token'],
    [{ getToken: async () => { throw new Error('push service'); } }, 'token'],
    [{ getSwRegistration: async () => { throw new Error('sw'); } }, 'token'],
    [{ saveToken: async () => { throw new Error('permission-denied'); } }, 'save'],
  ];
  for (const [over, reason] of cases) {
    const { deps, calls } = makeDeps(over);
    assert.deepEqual(await registerDeviceForPush(deps), { ok: false, reason }, reason);
    assert.deepEqual(calls.cacheToken, [], `${reason}: 캐시하지 않음`);
    assert.equal(calls.onRegistered, 0, `${reason}: 완료 처리 안 함`);
    assert.ok(describeRegistrationFailure(reason).length > 0);
  }
  // 등록 실패 후 화면 상태도 '등록 완료'가 되지 않는다(SettingsPage는 result.ok로만 표시)
  assert.notEqual(resolveDevicePushStatus(env(), false), 'registered');
});

test('내 기기 테스트 알림은 기존 sendTestNotification만 호출하고 uid·토큰·대상 지정 값을 보내지 않는다', async () => {
  const calls = [];
  const result = await sendSelfTestNotification(async (name, data) => {
    calls.push({ name, data });
    return { data: { success: true, total: 2, succeeded: 1, failed: 1 } };
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'sendTestNotification');
  assert.deepEqual(Object.keys(calls[0].data).sort(), ['body', 'title']);
  assert.equal(result.data.total, 2);
});

test('서버 성공과 실제 수신을 구분해 안내하고, 전부 실패·응답 이상·오류는 실패로 보인다', () => {
  const partial = describeSelfTestResult({ success: true, total: 3, succeeded: 1, failed: 2 });
  assert.equal(partial.tone, 'success');
  assert.match(partial.text, /3개 중 1개 성공, 2개 실패/);
  assert.match(partial.text, /직접 확인/);

  assert.equal(describeSelfTestResult({ success: true, total: 2, succeeded: 0, failed: 2 }).tone, 'error');
  assert.equal(describeSelfTestResult(null).tone, 'error');
  assert.equal(describeSelfTestResult({ success: true }).tone, 'error');

  assert.match(describeSelfTestError({ code: 'functions/not-found', message: 'raw' }).text, /등록된 기기가 없습니다/);
  assert.match(describeSelfTestError({ code: 'functions/unauthenticated' }).text, /로그인/);
  const generic = describeSelfTestError(new Error('internal stack detail'));
  assert.equal(generic.tone, 'error');
  assert.doesNotMatch(generic.text, /internal stack detail/);
});

test('포그라운드 알림은 서비스워커 showNotification을 우선 사용한다(iOS)', async () => {
  const shown = [];
  let windowCalls = 0;
  const result = await showForegroundNotification(
    { notification: { title: '기록 알림', body: '오늘 기록을 남겨 주세요' } },
    {
      getPermission: () => 'granted',
      getRegistration: async () => ({ showNotification: async (t, o) => { shown.push([t, o]); } }),
      createWindowNotification: () => { windowCalls += 1; },
    },
  );
  assert.equal(result, 'shown-sw');
  assert.equal(windowCalls, 0);
  assert.equal(shown[0][0], '기록 알림');
  assert.equal(shown[0][1].body, '오늘 기록을 남겨 주세요');
  assert.equal(shown[0][1].tag, 'haru-notification');
  assert.equal(shown[0][1].icon, '/icons/icon-grape-v1-192.png');
});

test('포그라운드: 서비스워커가 없거나 실패하면 창 알림으로, 그것도 실패하면 예외 없이 failed', async () => {
  let windowCalls = 0;
  const noSw = await showForegroundNotification({ notification: { title: 't' } }, {
    getPermission: () => 'granted',
    getRegistration: async () => undefined,
    createWindowNotification: () => { windowCalls += 1; },
  });
  assert.equal(noSw, 'shown-window');
  assert.equal(windowCalls, 1);

  const allFail = await showForegroundNotification({ notification: { title: 't' } }, {
    getPermission: () => 'granted',
    getRegistration: async () => ({ showNotification: async () => { throw new Error('x'); } }),
    createWindowNotification: () => { throw new TypeError('Illegal constructor'); },
  });
  assert.equal(allFail, 'failed');

  const noPerm = await showForegroundNotification({ notification: { title: 't' } }, {
    getPermission: () => 'default',
    getRegistration: async () => { throw new Error('should not be called'); },
  });
  assert.equal(noPerm, 'skipped-permission');
  assert.equal(await showForegroundNotification({}, { getPermission: () => 'granted', getRegistration: async () => undefined }), 'skipped-empty');
});

test('포그라운드 리스너는 여러 번 설치를 요청해도 onMessage를 한 번만 등록한다', async () => {
  let subscribed = 0;
  let handler;
  const shown = [];
  const install = createForegroundListenerInstaller({
    isSupported: async () => true,
    subscribe: (h) => { subscribed += 1; handler = h; },
    show: async (p) => { shown.push(p); },
  });
  const [a, b] = await Promise.all([install(), install()]);
  await install();
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(subscribed, 1);
  handler({ notification: { title: 'x' } });
  await new Promise((r) => setImmediate(r));
  assert.equal(shown.length, 1);
});

test('포그라운드 리스너: 표시 실패가 처리되지 않은 거부로 새지 않고, 지원 확인 오류 뒤에는 재시도할 수 있다', async () => {
  let handler;
  let attempts = 0;
  let subscribed = 0;
  const install = createForegroundListenerInstaller({
    isSupported: async () => { attempts += 1; if (attempts === 1) throw new Error('idb'); return true; },
    subscribe: (h) => { subscribed += 1; handler = h; },
    show: async () => { throw new Error('show failed'); },
  });
  assert.equal(await install(), false);
  assert.equal(await install(), true);
  assert.equal(subscribed, 1);
  const unhandled = [];
  const onUnhandled = (e) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  handler({ notification: { title: 'x' } });
  await new Promise((r) => setImmediate(r));
  process.off('unhandledRejection', onUnhandled);
  assert.deepEqual(unhandled, []);

  const unsupported = createForegroundListenerInstaller({
    isSupported: async () => false,
    subscribe: () => { throw new Error('should not subscribe'); },
    show: async () => undefined,
  });
  assert.equal(await unsupported(), false);
});

// 연결 확인: 실제 서비스·화면이 위 helper를 쓰고, 중복 onMessage·토큰/payload 로그·관리자 broadcast 호출이 없다
test('서비스·설정 화면 연결', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app');
  const service = fs.readFileSync(path.join(root, 'services/notificationService.ts'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'pages/SettingsPage.tsx'), 'utf8');

  assert.equal((service.match(/onMessage\(/g) || []).length, 1, 'onMessage 등록 지점은 한 곳');
  assert.doesNotMatch(service, /new Notification\(title, \{/, '포그라운드는 helper(showNotification 우선)로만 표시');
  assert.doesNotMatch(service, /console\.log\(token\)/);
  assert.doesNotMatch(service, /console\.log\([^)]*payload/);
  assert.match(service, /export async function requestNotificationPermission\(userId: string\): Promise<boolean>/);

  const handler = settings.match(/const handleSendSelfTest = async \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(handler, '내 기기 테스트 핸들러 존재');
  assert.match(handler[0], /sendSelfTestNotification\(/);
  assert.match(handler[0], /getFunctions\(undefined, 'asia-northeast3'\)/);
  assert.doesNotMatch(handler[0], /sendBroadcastNotification/);
  assert.match(settings, /onClick=\{handleRegisterThisDevice\}/);
  assert.match(settings, /onClick=\{handleSendSelfTest\}/);
});
