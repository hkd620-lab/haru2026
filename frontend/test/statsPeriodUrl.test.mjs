import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStatsPeriod } from '../src/app/components/StatsPeriodPicker.tsx';

const today = new Date(2026, 9, 23, 12);

test('예전 시작·종료일 링크의 기간은 기본 이번 달로 바뀌지 않는다', () => {
  const params = new URLSearchParams('start=2025-10-23&end=2026-10-23');
  for (const tier of ['free', 'basic', 'premium']) {
    const result = resolveStatsPeriod(params, tier, today);
    assert.equal(result.period, 'custom');
    assert.equal(result.range.start, '2025-10-23');
    assert.equal(result.range.end, '2026-10-23');
    assert.equal(result.locked, tier !== 'premium');
  }
});

test('기본 기간과 같은 옛 링크는 해당 기간의 등급을 적용한다', () => {
  const params = new URLSearchParams('start=2026-10-01&end=2026-10-23');
  const result = resolveStatsPeriod(params, 'free', today);
  assert.equal(result.period, 'month');
  assert.equal(result.locked, false);
});

test('명시한 새 period가 있으면 옛 날짜 매개변수보다 우선한다', () => {
  const result = resolveStatsPeriod(new URLSearchParams('period=year&start=2025-10-23&end=2026-10-23'), 'basic', today);
  assert.equal(result.period, 'year');
  assert.equal(result.range.start, '2026-01-01');
  assert.equal(result.locked, false);
  assert.equal(resolveStatsPeriod(new URLSearchParams(), 'free', today).period, 'month');
});
