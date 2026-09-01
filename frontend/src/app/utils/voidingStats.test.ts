/**
 * calcVoidingStats 단위 테스트
 *
 * 테스트 러너 없이 브라우저 콘솔 또는 Node에서 runVoidingStatsTests()를 호출해 실행.
 * 모든 assert 통과 시 "✅ 전체 테스트 통과" 출력.
 */

import { calcVoidingStats } from './voidingStats';
import type { VoidingEntry } from './voidingStats';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ FAIL: ${message}`);
}

export function runVoidingStatsTests(): void {
  // ── 공식 예시 테스트 케이스 ──────────────────────────────────────────────
  // 취침 22:30 / 기상 06:30
  // 배뇨 8건: 06:30·09:30·13:15·16:00·20:00·22:30 주간 / 02:00·05:15 야간
  // 총음료 550ml, 총배뇨 1530ml, 주간 1040ml(6회), 야간 490ml(2회), 야간뇨비율 32.0%, 야간다뇨 의심

  const entries: VoidingEntry[] = [
    // 음료 3건 합계 550ml
    { id: 'd1', time: '07:30', type: 'drink', amountMl: 200 },
    { id: 'd2', time: '12:00', type: 'drink', amountMl: 250 },
    { id: 'd3', time: '19:00', type: 'drink', amountMl: 100 },
    // 주간 배뇨 6건 합계 1040ml
    { id: 'v1', time: '06:30', type: 'void', amountMl: 150 },
    { id: 'v2', time: '09:30', type: 'void', amountMl: 200 },
    { id: 'v3', time: '13:15', type: 'void', amountMl: 220 },
    { id: 'v4', time: '16:00', type: 'void', amountMl: 180 },
    { id: 'v5', time: '20:00', type: 'void', amountMl: 150 },
    { id: 'v6', time: '22:30', type: 'void', amountMl: 140 },
    // 야간 배뇨 2건 합계 490ml
    { id: 'v7', time: '02:00', type: 'void', amountMl: 260 },
    { id: 'v8', time: '05:15', type: 'void', amountMl: 230 },
  ];

  const stats = calcVoidingStats(entries, '22:30', '06:30');

  assert(stats.totalDrinkMl === 550, `totalDrinkMl: expected 550, got ${stats.totalDrinkMl}`);
  assert(stats.totalVoidMl === 1530, `totalVoidMl: expected 1530, got ${stats.totalVoidMl}`);
  assert(stats.dayVoidMl === 1040, `dayVoidMl: expected 1040, got ${stats.dayVoidMl}`);
  assert(stats.nightVoidMl === 490, `nightVoidMl: expected 490, got ${stats.nightVoidMl}`);
  assert(stats.dayVoidCount === 6, `dayVoidCount: expected 6, got ${stats.dayVoidCount}`);
  assert(stats.nightVoidCount === 2, `nightVoidCount: expected 2, got ${stats.nightVoidCount}`);
  assert(stats.totalVoidCount === 8, `totalVoidCount: expected 8, got ${stats.totalVoidCount}`);
  assert(stats.nightRatioPercent === 32.0, `nightRatioPercent: expected 32.0, got ${stats.nightRatioPercent}`);
  assert(stats.isNocturiaSuspected === true, `isNocturiaSuspected: expected true, got ${stats.isNocturiaSuspected}`);

  // ── 야간다뇨 미해당 (야간뇨비율 < 30%) 케이스 ────────────────────────────
  const entries2: VoidingEntry[] = [
    { id: 'v1', time: '08:00', type: 'void', amountMl: 200 },
    { id: 'v2', time: '12:00', type: 'void', amountMl: 200 },
    { id: 'v3', time: '18:00', type: 'void', amountMl: 200 },
    { id: 'v4', time: '23:30', type: 'void', amountMl: 100 }, // 야간 (23:00 취침 이후)
  ];

  const stats2 = calcVoidingStats(entries2, '23:00', '07:00');
  assert(stats2.nightVoidMl === 100, `stats2.nightVoidMl: expected 100, got ${stats2.nightVoidMl}`);
  assert(stats2.dayVoidMl === 600, `stats2.dayVoidMl: expected 600, got ${stats2.dayVoidMl}`);
  assert(stats2.nightRatioPercent < 30, `stats2.nightRatioPercent: expected <30, got ${stats2.nightRatioPercent}`);
  assert(stats2.isNocturiaSuspected === false, `stats2.isNocturiaSuspected: expected false`);

  // ── 항목 없는 경우 ────────────────────────────────────────────────────────
  const stats3 = calcVoidingStats([], '22:00', '06:00');
  assert(stats3.totalVoidMl === 0, 'empty: totalVoidMl should be 0');
  assert(stats3.nightRatioPercent === 0, 'empty: nightRatioPercent should be 0');
  assert(stats3.isNocturiaSuspected === false, 'empty: isNocturiaSuspected should be false');

  console.log('✅ 전체 테스트 통과 (calcVoidingStats)');
}
