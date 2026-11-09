import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { transformSync } from 'esbuild';

// 페이지의 실제 단건 fallback을 실행한다. 전체 화면의 Firebase/AI 부작용은 연결하지 않는다.
const source = fs.readFileSync(new URL('../src/app/pages/SayuPage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('    const currentRecord = records.find((record) => record.id === openRecordId);');
const end = source.indexOf('    const recordDate = ', start);
assert.ok(start >= 0 && end > start);
const js = transformSync(`function run(){${source.slice(start, end)}}`, { loader: 'ts' }).code;
function harness() {
  const reads = [], errors = [], navigations = [];
  let records = [{ id: 'keep', date: '2026-11-01' }];
  let resolve, reject;
  const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
  const owner = { current: 'owner' };
  const params = {
    records, openRecordId: 'target', routeKey: '일기|target', user: { uid: 'owner' }, db: {},
    sayuRouteStateLoadingRef: { current: '' }, currentRecordsUidRef: owner,
    getDoc: ref => { reads.push(ref); return pending; }, doc: (...args) => args.slice(1),
    setRecords: fn => { records = fn(records); }, toast: { error: msg => errors.push(msg) },
    navigate: (...args) => navigations.push(args), console: { error: () => {} },
  };
  const cleanup = new Function(...Object.keys(params), `${js}; return run();`)(...Object.values(params));
  return { reads, errors, navigations, owner, cleanup, resolve, reject, records: () => records };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('선택한 문서만 읽고 다른 목록은 유지한다', async () => {
  const h = harness();
  assert.deepEqual(h.reads, [['users', 'owner', 'records', 'target']]);
  h.resolve({ exists: () => true, id: 'target', data: () => ({ id: 'forged', formats: ['일기'] }) });
  await flush();
  assert.deepEqual(h.records().map(r => r.id), ['keep', 'target']);
  assert.equal(h.errors.length, 0);
});
test('삭제된 문서는 메모로 오인하지 않는 안내 후 상태를 해제한다', async () => {
  const h = harness(); h.resolve({ exists: () => false }); await flush();
  assert.deepEqual(h.errors, ['선택한 기록을 찾지 못했습니다.']);
  assert.deepEqual(h.navigations, [['/sayu', { replace: true, state: null }]]);
});
test('화면 이동 또는 계정 변경 뒤 도착한 결과는 무시한다', async () => {
  for (const cancel of [h => h.cleanup(), h => { h.owner.current = 'other'; }]) {
    const h = harness(); cancel(h);
    h.resolve({ exists: () => true, id: 'target', data: () => ({}) }); await flush();
    assert.deepEqual(h.records().map(r => r.id), ['keep']);
    assert.equal(h.navigations.length, 0);
  }
});
test('화면 이동 후 늦은 읽기 실패도 토스트나 이동을 만들지 않는다', async () => {
  const h = harness(); h.cleanup(); h.reject(new Error('network')); await flush();
  assert.equal(h.errors.length, 0); assert.equal(h.navigations.length, 0);
});
