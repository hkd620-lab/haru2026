// 아이폰 알림 원인 분리 — '이 기기 알림 표시 시험'(서버 발송 없음, 기존 서비스워커로 표시만 요청) 동작 시험
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEVICE_DISPLAY_TEST_OPTIONS,
  DEVICE_DISPLAY_TEST_TITLE,
  FOREGROUND_NOTIFICATION_OPTIONS,
  describeDeviceDisplayTestResult,
  requestDeviceDisplayTest,
  runDeviceDisplayTest,
} from '../src/app/services/pushDevice.ts';

function makeDeps(over = {}) {
  const calls = { show: [], find: 0 };
  const deps = {
    hasServiceWorker: () => true,
    getPermission: () => 'granted',
    findRegistration: async () => {
      calls.find += 1;
      return { showNotification: async (title, options) => { calls.show.push({ title, options }); } };
    },
    ...over,
  };
  return { deps, calls };
}

test('권한 허용 + 등록된 서비스워커가 있으면 별도 tag로 표시만 요청하고 requested를 돌려준다', async () => {
  const { deps, calls } = makeDeps();
  assert.equal(await requestDeviceDisplayTest(deps), 'requested');
  assert.equal(calls.show.length, 1);
  assert.equal(calls.show[0].title, 'HARU 기기 표시 시험');
  assert.equal(calls.show[0].title, DEVICE_DISPLAY_TEST_TITLE);
  assert.equal(calls.show[0].options.body, '이 알림은 기기 표시만 확인합니다. 서버 푸시 수신 시험과는 다릅니다.');
  assert.equal(calls.show[0].options.tag, 'haru-device-display-test');
  assert.notEqual(calls.show[0].options.tag, FOREGROUND_NOTIFICATION_OPTIONS.tag, '기존 haru-notification과 분리');
  assert.equal(calls.show[0].options.icon, FOREGROUND_NOTIFICATION_OPTIONS.icon, '기존 공식 아이콘 재사용');
  assert.equal(calls.show[0].options.badge, FOREGROUND_NOTIFICATION_OPTIONS.badge);
  assert.deepEqual(Object.keys(calls.show[0].options).sort(), ['badge', 'body', 'icon', 'tag'], 'data·token·uid 없음');
  assert.deepEqual(Object.keys(DEVICE_DISPLAY_TEST_OPTIONS).sort(), ['badge', 'body', 'icon', 'tag']);
});

test('권한 default·denied면 서비스워커를 찾지도 표시하지도 않고 permission (권한 요청 함수는 deps에 없음)', async () => {
  for (const permission of ['default', 'denied']) {
    const { deps, calls } = makeDeps({ getPermission: () => permission });
    assert.equal(await requestDeviceDisplayTest(deps), 'permission');
    assert.equal(calls.find, 0);
    assert.equal(calls.show.length, 0);
  }
  const { deps } = makeDeps();
  assert.equal('requestPermission' in deps, false);
  assert.equal('getToken' in deps, false);
  assert.equal('saveToken' in deps, false);
});

test('서비스워커 미지원·Notification 미지원·판정 예외는 unsupported', async () => {
  const cases = [
    { hasServiceWorker: () => false },
    { getPermission: () => 'unsupported' },
    { hasServiceWorker: () => { throw new Error('x'); } },
    { getPermission: () => { throw new Error('x'); } },
  ];
  for (const over of cases) {
    const { deps, calls } = makeDeps(over);
    assert.equal(await requestDeviceDisplayTest(deps), 'unsupported');
    assert.equal(calls.find, 0);
  }
});

test('등록된 서비스워커가 없으면 새로 등록하지 않고 no-registration', async () => {
  const { deps } = makeDeps({ findRegistration: async () => undefined });
  assert.equal(await requestDeviceDisplayTest(deps), 'no-registration');
});

test('서비스워커 조회 실패·showNotification 실패는 failed이며 예외가 새지 않는다', async () => {
  const a = makeDeps({ findRegistration: async () => { throw new Error('secret-token-abc'); } });
  assert.equal(await requestDeviceDisplayTest(a.deps), 'failed');
  const b = makeDeps({ findRegistration: async () => ({ showNotification: async () => { throw new TypeError('no permission uid-123'); } }) });
  assert.equal(await requestDeviceDisplayTest(b.deps), 'failed');
});

test('안내 문구: 성공은 표시 요청 완료일 뿐 실제 수신·서버 수신 확인이 아님을 밝히고, 오류는 정적 안내만', () => {
  const ok = describeDeviceDisplayTestResult('requested');
  assert.equal(ok.text, '표시 요청이 완료됐습니다. 실제 알림이 왔는지 확인해 주세요. 서버 푸시 수신 확인은 아닙니다.');
  assert.doesNotMatch(ok.text, /받았|수신했|표시됐|표시되었|성공/);
  for (const r of ['unsupported', 'permission', 'no-registration', 'failed']) {
    const v = describeDeviceDisplayTestResult(r);
    assert.equal(v.tone, 'error');
    assert.ok(v.text.length > 0);
    assert.doesNotMatch(v.text, /Error|token|uid|payload/i);
  }
  const texts = new Set(['unsupported', 'permission', 'no-registration', 'failed'].map((r) => describeDeviceDisplayTestResult(r).text));
  assert.equal(texts.size, 4, '권한 미허용·등록 필요·미지원·표시 실패를 구분');
});

test('runDeviceDisplayTest: busy를 켰다가 항상 풀고, 진행 중 중복 클릭은 무시한다', async () => {
  const busy = [];
  const results = [];
  const guard = { running: false };
  let release;
  let requests = 0;
  const request = () => { requests += 1; return new Promise((r) => { release = r; }); };
  const ui = { setBusy: (b) => busy.push(b), setResult: (v) => results.push(v) };

  const first = runDeviceDisplayTest(request, ui, guard);
  await runDeviceDisplayTest(request, ui, guard); // 진행 중 두 번째 클릭
  assert.equal(requests, 1);
  release('requested');
  await first;
  assert.deepEqual(busy, [true, false]);
  assert.equal(results[0], null);
  assert.equal(results.at(-1).tone, 'success');
  assert.equal(guard.running, false);

  // 끝난 뒤에는 다시 실행할 수 있다
  await runDeviceDisplayTest(async () => 'permission', ui, guard);
  assert.equal(results.at(-1).tone, 'error');
  assert.deepEqual(busy, [true, false, true, false]);
});

test('runDeviceDisplayTest: 요청 예외·거부·화면 갱신 예외에도 busy가 풀리고 예외가 새지 않는다', async () => {
  const guard = { running: false };
  const busy = [];
  const results = [];
  await runDeviceDisplayTest(() => { throw new Error('sync'); }, { setBusy: (b) => busy.push(b), setResult: (v) => results.push(v) }, guard);
  assert.equal(results.at(-1).text, describeDeviceDisplayTestResult('failed').text);
  await runDeviceDisplayTest(() => Promise.reject(new Error('async')), { setBusy: (b) => busy.push(b), setResult: (v) => results.push(v) }, guard);
  assert.equal(results.at(-1).text, describeDeviceDisplayTestResult('failed').text);
  await runDeviceDisplayTest(async () => 'requested', { setBusy: (b) => busy.push(b), setResult: () => { throw new Error('ui'); } }, guard);
  assert.deepEqual(busy, [true, false, true, false, true, false]);
  assert.equal(guard.running, false);
});

// 연결 확인: 서비스 함수는 기존 registration 조회만 하고, 화면은 클릭으로만 실행하며 서버 발송 경로와 섞이지 않는다
test('서비스·설정 화면 연결: 서버 호출·권한 요청·SW 등록·토큰·Firestore 없음, 자동 실행 없음', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app');
  const service = fs.readFileSync(path.join(root, 'services/notificationService.ts'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'pages/SettingsPage.tsx'), 'utf8');
  const helper = fs.readFileSync(path.join(root, 'services/pushDevice.ts'), 'utf8');

  const find = service.match(/async function findActiveFcmSwRegistration\(\)[\s\S]*?\n\}/);
  assert.ok(find, '기존 registration 조회 전용 함수 존재');
  assert.match(find[0], /getRegistrations\(\)/);
  assert.match(find[0], /r\.active\?\.scriptURL/, 'active 워커만');
  assert.doesNotMatch(find[0], /\.register\(|getFcmSwRegistration|unregister|subscribe/);

  const entry = service.match(/export function requestThisDeviceDisplayTest\(\)[\s\S]*?\n\}/);
  assert.ok(entry);
  assert.match(entry[0], /findRegistration: findActiveFcmSwRegistration/);
  assert.doesNotMatch(entry[0], /getFcmSwRegistration|requestDevicePermission|requestPermission|getToken|getMessaging|setDoc|updateDoc|httpsCallable|caches|localStorage|console\./);

  const section = helper.slice(helper.indexOf('// ===== 이 기기 알림 표시 시험'), helper.indexOf('export interface ForegroundListenerDeps'));
  assert.ok(section.length > 0);
  assert.doesNotMatch(section, /console\.|httpsCallable|getToken|requestPermission\(|fetch\(/);

  const handler = settings.match(/const handleDeviceDisplayTest = async \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(handler, '표시 시험 핸들러 존재');
  assert.match(handler[0], /runDeviceDisplayTest\(requestThisDeviceDisplayTest/);
  assert.doesNotMatch(handler[0], /httpsCallable|getFunctions|sendSelfTestNotification|registerThisDevice|sendBroadcastNotification/);
  assert.match(settings, /onClick=\{handleDeviceDisplayTest\}/);
  assert.match(settings, /disabled=\{isRunningDisplayTest\}/);
  assert.equal((settings.match(/handleDeviceDisplayTest/g) || []).length, 2, '정의 1 + onClick 1 (useEffect 자동 실행 없음)');
  assert.equal((settings.match(/requestThisDeviceDisplayTest/g) || []).length, 2, 'import 1 + 핸들러 1');
  // 기존 서버 발송 시험 버튼은 그대로
  assert.match(settings, /onClick=\{handleSendSelfTest\}/);
  assert.match(settings, /onClick=\{handleRegisterThisDevice\}/);
});
