const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_NOTIFICATION_TIME,
  DEFAULT_NOTIFICATION_TIME_ZONE,
  getNotificationClocks,
  getZonedClock,
  isNotificationDue,
  resolveNotificationTimeZone,
} = require('../src/scheduledNotificationCore.ts');

// 시간대 결정: 저장된 IANA 시간대를 쓰고, 없거나 잘못되면 한국 시간(기존 사용자)
assert.equal(DEFAULT_NOTIFICATION_TIME_ZONE, 'Asia/Seoul');
assert.equal(resolveNotificationTimeZone(undefined), 'Asia/Seoul');
assert.equal(resolveNotificationTimeZone(''), 'Asia/Seoul');
assert.equal(resolveNotificationTimeZone(42), 'Asia/Seoul');
assert.equal(resolveNotificationTimeZone('Not/AZone'), 'Asia/Seoul');
assert.equal(resolveNotificationTimeZone('America/Los_Angeles'), 'America/Los_Angeles');
assert.equal(resolveNotificationTimeZone(' Europe/London '), 'Europe/London');

// 실행 환경 시간대(UTC)와 무관하게 사용자 시간대 기준 시·날짜를 낸다.
const clock = (iso, tz = 'Asia/Seoul') => getZonedClock(new Date(iso), tz);
assert.deepEqual(clock('2026-10-07T12:00:00Z'), { timeZone: 'Asia/Seoul', hour: 21, minute: 0, dateKey: '2026-10-07' });
// 한국 날짜가 UTC 날짜보다 하루 앞서는 시간대(KST 00~08시)
assert.deepEqual(clock('2026-10-06T15:00:00Z'), { timeZone: 'Asia/Seoul', hour: 0, minute: 0, dateKey: '2026-10-07' });
// 연말 경계
assert.deepEqual(clock('2026-12-31T15:05:00Z'), { timeZone: 'Asia/Seoul', hour: 0, minute: 5, dateKey: '2027-01-01' });
// 해외 사용자: 같은 순간이라도 현지 시·날짜로 판정(UTC보다 하루 늦은 날짜)
assert.deepEqual(clock('2026-10-07T04:00:00Z', 'America/Los_Angeles'), { timeZone: 'America/Los_Angeles', hour: 21, minute: 0, dateKey: '2026-10-06' });
// 30분 시차 지역: 매시 정각(UTC) 실행 시점이 현지 HH:30
assert.deepEqual(clock('2026-10-07T15:00:00Z', 'Asia/Kolkata'), { timeZone: 'Asia/Kolkata', hour: 20, minute: 30, dateKey: '2026-10-07' });

// 알림 시각 판정: 실행 시점의 현지 '시'가 설정한 시와 같으면 보낸다. 기본값 21:00, 분은 보지 않는다.
assert.equal(DEFAULT_NOTIFICATION_TIME, '21:00');
assert.equal(isNotificationDue('21:00', clock('2026-10-07T12:00:00Z')), true);
assert.equal(isNotificationDue(undefined, clock('2026-10-07T12:00:00Z')), true);
assert.equal(isNotificationDue('', clock('2026-10-07T12:00:00Z')), true);
assert.equal(isNotificationDue(7, clock('2026-10-07T12:00:00Z')), true); // 문자열이 아니면 기본값
assert.equal(isNotificationDue('21:30', clock('2026-10-07T12:00:00Z')), true);
assert.equal(isNotificationDue('09:00', clock('2026-10-07T00:00:00Z')), true);
assert.equal(isNotificationDue('20:00', clock('2026-10-07T12:00:00Z')), false);
// 실행이 1분 늦어도 같은 시면 보낸다(정각만 보던 기존 판정은 그 시간대 알림을 통째로 놓쳤다)
assert.equal(isNotificationDue('21:00', clock('2026-10-07T12:01:00Z')), true);
// 30분 시차 지역도 해당 시에 받는다
assert.equal(isNotificationDue('20:00', clock('2026-10-07T15:00:00Z', 'Asia/Kolkata')), true);
assert.equal(isNotificationDue('21:00', clock('2026-10-07T04:00:00Z', 'America/Los_Angeles')), true);
// 회귀 방지: UTC 21시(KST 06시)에는 한국 21:00 사용자에게 보내지 않는다
assert.equal(isNotificationDue('21:00', clock('2026-10-07T21:00:00Z')), false);

// 서머타임 종료일 반복 시각: 뉴욕 2026-11-01 01:00 은 05:00Z·06:00Z 두 번 온다 → 한 번만 보낸다
const due = (time, iso, tz) => {
  const { clock: c, hourBefore } = getNotificationClocks(new Date(iso), tz);
  return isNotificationDue(time, c, hourBefore);
};
assert.deepEqual(clock('2026-11-01T05:00:00Z', 'America/New_York'), { timeZone: 'America/New_York', hour: 1, minute: 0, dateKey: '2026-11-01' });
assert.deepEqual(clock('2026-11-01T06:00:00Z', 'America/New_York'), { timeZone: 'America/New_York', hour: 1, minute: 0, dateKey: '2026-11-01' });
assert.equal(due('01:00', '2026-11-01T05:00:00Z', 'America/New_York'), true);
assert.equal(due('01:00', '2026-11-01T06:00:00Z', 'America/New_York'), false);
// 반복이 아닌 날·시각은 그대로 보낸다
assert.equal(due('01:00', '2026-10-31T05:00:00Z', 'America/New_York'), true);
assert.equal(due('02:00', '2026-11-01T07:00:00Z', 'America/New_York'), true);
assert.equal(due('21:00', '2026-10-07T12:00:00Z', 'Asia/Seoul'), true);
// 자정 직후(날짜가 바뀐 같은 시는 반복이 아님)
assert.equal(due('00:00', '2026-10-06T15:00:00Z', 'Asia/Seoul'), true);

// 스케줄러가 문서 ID(records/{date})가 아니라 사용자 시간대 날짜의 date 필드로 오늘 기록을 찾는지 고정한다.
const source = fs.readFileSync(path.join(__dirname, '../src/scheduledNotification.ts'), 'utf8');
assert.match(source, /\.collection\('records'\)\s*\.where\('date', '==', clock\.dateKey\)\s*\.limit\(1\)/);
assert.doesNotMatch(source, /\.collection\('records'\)\s*\.doc\(/);
assert.doesNotMatch(source, /\.getHours\(\)|\.toISOString\(\)\.split\('T'\)/);
assert.match(source, /const \{ clock, hourBefore \} = getNotificationClocks\(now, resolveNotificationTimeZone\(settings\.notificationTimeZone\)\);/);
assert.match(source, /isNotificationDue\(settings\.notificationTime, clock, hourBefore\)/);
// 오늘 기록이 있으면 건너뛴다(조건이 뒤집히면 기록한 사용자에게만 알림이 간다)
assert.match(source, /if \(!todayRecords\.empty\) \{\s*skippedCount\+\+;\s*continue;\s*\}/);
assert.match(source, /region: 'asia-northeast3'/);

console.log('scheduledNotificationCore tests passed');
