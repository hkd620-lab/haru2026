const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_NOTIFICATION_TIME,
  getSeoulClock,
  isNotificationDue,
} = require('../src/scheduledNotificationCore.ts');

// 실행 환경 시간대(UTC)와 무관하게 한국 시간 기준 시·날짜를 낸다.
assert.deepEqual(getSeoulClock(new Date('2026-10-07T12:00:00Z')), { hour: 21, minute: 0, dateKey: '2026-10-07' });
// 한국 날짜가 UTC 날짜보다 하루 앞서는 시간대(KST 00~08시)
assert.deepEqual(getSeoulClock(new Date('2026-10-06T15:00:00Z')), { hour: 0, minute: 0, dateKey: '2026-10-07' });
assert.deepEqual(getSeoulClock(new Date('2026-10-06T23:30:00Z')), { hour: 8, minute: 30, dateKey: '2026-10-07' });
// 연말 경계
assert.deepEqual(getSeoulClock(new Date('2026-12-31T15:05:00Z')), { hour: 0, minute: 5, dateKey: '2027-01-01' });

// 알림 시각 판정: 사용자가 고른 시(KST)의 정각에만 보낸다. 기본값 21:00.
const at = (iso) => getSeoulClock(new Date(iso));
assert.equal(DEFAULT_NOTIFICATION_TIME, '21:00');
assert.equal(isNotificationDue('21:00', at('2026-10-07T12:00:00Z')), true);
assert.equal(isNotificationDue(undefined, at('2026-10-07T12:00:00Z')), true);
assert.equal(isNotificationDue('', at('2026-10-07T12:00:00Z')), true);
assert.equal(isNotificationDue('21:30', at('2026-10-07T12:00:00Z')), true); // 분은 보지 않는다(기존 동작)
assert.equal(isNotificationDue('21:00', at('2026-10-07T12:01:00Z')), false); // 정각이 아니면 보내지 않는다
assert.equal(isNotificationDue('09:00', at('2026-10-07T00:00:00Z')), true);
// 회귀 방지: UTC 21시(KST 06시)에는 21:00 사용자에게 보내지 않는다
assert.equal(isNotificationDue('21:00', at('2026-10-07T21:00:00Z')), false);

// 스케줄러가 문서 ID(records/{date})가 아니라 date 필드로 오늘 기록을 찾고, 한국 시간 판정을 쓰는지 고정한다.
const source = fs.readFileSync(path.join(__dirname, '../src/scheduledNotification.ts'), 'utf8');
assert.match(source, /\.collection\('records'\)\s*\.where\('date', '==', clock\.dateKey\)\s*\.limit\(1\)/);
assert.doesNotMatch(source, /\.collection\('records'\)\s*\.doc\(/);
assert.doesNotMatch(source, /getHours\(\)|toISOString\(\)/);
assert.match(source, /region: 'asia-northeast3'/);
assert.match(source, /isNotificationDue\(settings\.notificationTime, clock\)/);

console.log('scheduledNotificationCore tests passed');
