import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { transform } from 'esbuild';
import { canUseStatsPeriod } from '../src/app/records/recordStats.ts';

const source = readFileSync(new URL('../src/app/pages/MergePage.tsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const handleRunMerge ='), source.indexOf('\n  return (', source.indexOf('  const handleRunMerge =')));
const { code } = await transform(`${handler}\nglobalThis.runMerge = handleRunMerge;`, { loader: 'ts' });

for (const [tier, selectedPeriod] of [['free', 'yearly'], ['basic', 'custom'], ['free', 'custom']]) {
  test(`${tier}: 선택 후 등급이 바뀌어도 ${selectedPeriod} 기록을 조회하거나 합본으로 넘기지 않는다`, async () => {
    let reads = 0;
    const warnings = [];
    const context = {
      user: { uid: 'synthetic-user' }, selectedFormat: '일기', selectedPeriod,
      startDate: '2026-01-01', endDate: '2026-10-23',
      canUsePeriod: period => canUseStatsPeriod(({yearly:'year',custom:'custom'})[period], tier),
      toast: { warning: message => warnings.push(message) },
      firestoreService: { getRecords: async () => { reads++; return []; } },
      setIsRunning: () => assert.fail('권한 없는 기간은 실행 상태로 들어가면 안 된다'),
      navigate: () => assert.fail('권한 없는 기간은 뷰어로 이동하면 안 된다'),
    };
    vm.runInNewContext(code, context);
    await context.runMerge();
    assert.equal(reads, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /기간을 이용할 수 없습니다/);
  });
}

test('무료 이번 달은 조회 후 날짜순 SAYU 결과로 이동한다', async () => {
  let destination;
  const context = {
    user: { uid: 'synthetic-user' }, selectedFormat: '일기', selectedPeriod: 'monthly',
    startDate: '2026-10-01', endDate: '2026-10-23', mergeFilter: 'all',
    canUsePeriod: () => canUseStatsPeriod('month', 'free'),
    toast: { warning: message => assert.fail(message), error: message => assert.fail(message) },
    firestoreService: { getRecords: async () => [
      { id: 'second', date: '2026-10-22', diary_sayu: '두 번째' },
      { id: 'outside', date: '2026-09-30', diary_sayu: '지난달' },
      { id: 'first', date: '2026-10-01', diary_sayu: '첫 번째' },
    ] },
    setIsRunning: () => {}, getFormatKey: () => 'diary', isAssistantRecord: () => false,
    hasSayu: record => !!record.diary_sayu, console: {log() {},error() {}},
    navigate: (path, options) => { destination = {path,...options.state}; },
  };
  vm.runInNewContext(code, context);
  await context.runMerge();
  assert.equal(destination.path, '/merge-viewer');
  assert.deepEqual(Array.from(destination.records, record => record.id), ['first', 'second']);
  assert.equal(destination.startDate, '2026-10-01');
  assert.equal(destination.endDate, '2026-10-23');
});
