// 기록 알림 시간대 저장 — 알림을 켜거나 시각을 바꿀 때 기기 시간대(IANA)를 함께 저장해야
// Functions 기록 알림(scheduledNotificationCore)이 사용자 현지 시각·날짜로 판정할 수 있다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '../src/app', p), 'utf8');
const service = read('services/notificationService.ts');
const settings = read('pages/SettingsPage.tsx');

assert.match(service, /export function getDeviceTimeZone\(\): string \| undefined/);
assert.match(service, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
assert.match(service, /notificationTimeZone\?: string;/);

// 알림 켜기·시각 변경 두 곳 모두 시간대를 함께 저장한다(값이 없으면 필드를 쓰지 않는다)
const calls = settings.match(/updateNotificationSettings\(user\.uid, \{[\s\S]*?\}\);/g) || [];
const withTimeZone = calls.filter((c) => /\.\.\.\(notificationTimeZone \? \{ notificationTimeZone \} : \{\}\)/.test(c));
assert.equal(calls.length, 3, 'updateNotificationSettings 호출 3곳(켜기·끄기·시각 변경)');
assert.equal(withTimeZone.length, 2, '켜기·시각 변경 2곳이 시간대를 저장');
assert.ok(withTimeZone.some((c) => /notificationEnabled: true/.test(c)));
assert.ok(withTimeZone.some((c) => /notificationTime: newTime/.test(c)));
assert.equal((settings.match(/const notificationTimeZone = getDeviceTimeZone\(\);/g) || []).length, 2);

console.log('notificationTimeZone policy test passed');
