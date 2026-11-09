// 수정 전(6500eac8) pushDevice.ts에 새 회귀시험과 같은 조건을 적용해 실패가 재현되는지 확인한다(합성 시험).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = '/private/tmp/haru-iphone-push-repair-20261109';
const oldSrc = execFileSync('git', ['-C', repo, 'show', '6500eac8:frontend/src/app/services/pushDevice.ts'], { encoding: 'utf8' });
const oldFile = path.join(here, 'pushDevice.6500eac8.ts');
fs.writeFileSync(oldFile, oldSrc);
const { registerDeviceForPush } = await import(oldFile);

const events = { unhandledRejection: 0, rejectionHandled: 0 };
process.on('unhandledRejection', () => { events.unhandledRejection += 1; });
process.on('rejectionHandled', () => { events.rejectionHandled += 1; });

const base = {
  getPermission: () => 'default',
  isSupported: () => new Promise((r) => setTimeout(() => r(true), 25)),
  getVapidKey: () => 'synthetic-public-key',
  getSwRegistration: async () => undefined,
  getToken: async () => 'synthetic-token',
  saveToken: async () => {},
  cacheToken: () => {},
};
const out = {};
out.asyncReject = await registerDeviceForPush({ ...base, requestPermission: () => Promise.reject(new Error('synthetic')) });
await new Promise((r) => setTimeout(r, 0));
out.asyncRejectEvents = { ...events };
try {
  out.syncThrow = await registerDeviceForPush({ ...base, requestPermission: () => { throw new Error('sync'); } });
} catch (e) {
  out.syncThrow = `threw: ${e.message}`;
}
try {
  out.cacheThrow = await registerDeviceForPush({ ...base, getPermission: () => 'granted', requestPermission: async () => 'granted', cacheToken: () => { throw new Error('QuotaExceededError'); } });
} catch (e) {
  out.cacheThrow = `threw: ${e.message}`;
}
console.log(JSON.stringify({ target: '6500eac8 pushDevice.ts', syntheticOnly: true, ...out }));
