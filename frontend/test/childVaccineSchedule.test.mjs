import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transformWithEsbuild } from 'vite';

// CI uses Node 20, which cannot import TypeScript files directly.
const source = await readFile(new URL('../src/app/pages/childVaccineSchedule.ts', import.meta.url), 'utf8');
const { code } = await transformWithEsbuild(source, 'childVaccineSchedule.ts', { loader: 'ts', format: 'esm' });
const { getBirthdateState, getScheduleStatus, getSeoulToday, isNearSchedule, parseCalendarDate } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const age = (birthdate, today = '2026-09-22') => getBirthdateState(birthdate, today);

test('생년월일은 실제 달력 날짜로 엄격히 검증한다', () => {
  assert.equal(parseCalendarDate('2026-02-30'), null);
  assert.equal(parseCalendarDate('2026-02-29'), null);
  assert.deepEqual(parseCalendarDate('2024-02-29'), { year: 2024, month: 2, day: 29 });
  assert.equal(parseCalendarDate('2026-2-02'), null);
  assert.equal(parseCalendarDate('0000-01-01'), null);
  assert.deepEqual(age(''), { kind: 'empty' });
  assert.deepEqual(age('2026-02-30'), { kind: 'invalid' });
  assert.deepEqual(age('2026-09-23'), { kind: 'future' });
  assert.deepEqual(age('2026-09-22'), { kind: 'valid', ageMonths: 0 });
  assert.deepEqual(age('서버의 잘못된 날짜'), { kind: 'invalid' });
});

test('월령은 월 기념일과 월말 보정에 따라 계산한다', () => {
  assert.deepEqual(age('2026-07-31'), { kind: 'valid', ageMonths: 1 });
  assert.deepEqual(age('2026-07-22'), { kind: 'valid', ageMonths: 2 });
  assert.deepEqual(age('2026-07-23'), { kind: 'valid', ageMonths: 1 });
  assert.deepEqual(age('2025-01-31', '2025-02-27'), { kind: 'valid', ageMonths: 0 });
  assert.deepEqual(age('2025-01-31', '2025-02-28'), { kind: 'valid', ageMonths: 1 });
  assert.deepEqual(age('2024-01-31', '2024-02-29'), { kind: 'valid', ageMonths: 1 });
  assert.deepEqual(age('2024-02-29', '2025-02-28'), { kind: 'valid', ageMonths: 12 });
});

test('서울 날짜는 단말 시간대와 무관하게 한 기준을 쓴다', () => {
  assert.equal(getSeoulToday(new Date('2026-09-21T14:59:59Z')), '2026-09-21');
  assert.equal(getSeoulToday(new Date('2026-09-21T15:00:00Z')), '2026-09-22');
  assert.equal(getSeoulToday(new Date('2026-09-22T14:59:59Z')), '2026-09-22');
  assert.equal(getSeoulToday(new Date('2026-09-22T15:00:00Z')), '2026-09-23');
});

test('달력 상태는 접종 완료나 미접종을 추론하지 않는다', () => {
  const schedule = { minMonth: 2, maxMonth: 3 };
  assert.equal(getScheduleStatus(schedule, 1), 'before');
  assert.equal(getScheduleStatus(schedule, 2), 'current');
  assert.equal(getScheduleStatus(schedule, 3), 'current');
  assert.equal(getScheduleStatus(schedule, 4), 'elapsed');
  assert.equal(isNearSchedule(schedule, 0), true);
  assert.equal(isNearSchedule(schedule, -1), false);
  assert.equal(isNearSchedule(schedule, 2), false);
  assert.equal(isNearSchedule({ minMonth: 3 }, 0), false);
});
