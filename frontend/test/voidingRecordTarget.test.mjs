import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

// Run the actual handlers with memory records and a fake callable, never Firebase/AI.
const source = readFileSync(new URL('../src/app/pages/SayuHealthVoidingPage.tsx', import.meta.url), 'utf8');
const names = ['handleQuickRecord', 'handleGenerateSayu'];
const functions = names.map(name => source.match(new RegExp(`  const ${name} = [\\s\\S]*?\\n  };`))[0]);
const parser = source.match(/function parseVoidingRecord[\s\S]*?\n}/)[0];
const code = transformSync(`${parser}\n${functions.join('\n')}`, { loader: 'ts' }).code;
const today = '2026-10-06';
const deferred = () => { let resolve; const promise = new Promise(res => { resolve = res; }); return { promise, resolve }; };
function fixture(initial = []) {
  const state = { records: structuredClone(initial), updates: [], creates: [], calls: 0, input: '120', loading: false, errors: [] };
  const busy = { current: false };
  const handlers = () => {
    const todayRecord = state.records.find(r => r.date === today) ?? null;
    const env = {
      user: { uid: 'fixture-user' }, hasConsent: 'hasConsent' in state ? state.hasConsent : true, isCurrentSession: () => state.sessionActive !== false, loading: state.loading, writeRef: busy, amountInput: state.input, todayRecord,
      todayEntries: todayRecord ? JSON.parse(todayRecord.voiding_entries) : [], todayBedtime: '22:30', todayWaketime: '06:30',
      stats: {}, getTodayStr: () => today, isSayuSafe: text => text === '합성 해석',
      setIsSavingEntry() {}, setIsGeneratingSayu() {}, setVoidingSayuText() {},
      setRecords: updater => { state.records = updater(state.records); }, setAmountInput: value => { state.input = value; },
      firestoreService: {
        saveRecord: async (uid, data) => { state.creates.push(structuredClone(data)); if (state.pendingCreate) await state.pendingCreate; if (state.createFailure) throw new Error('fixture'); return `${today}_actual-created-id`; },
        updateRecord: async (uid, id, data) => { state.updates.push({ id, data }); if (state.pending) await state.pending; if (state.writeFailure) throw new Error('fixture'); },
      },
      getFunctions: () => ({}), httpsCallable: () => async () => { state.calls++; if (state.pendingCallable) await state.pendingCallable; return { data: { result: state.result ?? '합성 해석' } }; },
      toast: { success() {}, error: text => state.errors.push(text) }, console: { error() {} },
    };
    return new Function(...Object.keys(env), `${code}\nreturn { ${names.join(',')} };`)(...Object.values(env));
  };
  return { state, busy, handlers };
}
const original = { id: `${today}_existing-suffix`, date: today, formats: ['배뇨일지'], unrelated: 'preserved', voiding_entries: JSON.stringify([{ id: 'first', time: '08:00', type: 'void', amountMl: 50 }]) };

test('quick entry updates the selected suffixed document and preserves unrelated records/fields', async () => {
  const sibling = { ...original, id: 'sibling', date: '2026-10-05' };
  const f = fixture([original, sibling]); await f.handlers().handleQuickRecord();
  assert.equal(f.state.updates[0].id, original.id); assert.equal(f.state.creates.length, 0);
  assert.equal(JSON.parse(f.state.records[0].voiding_entries).length, 2);
  assert.equal(f.state.records[0].unrelated, 'preserved'); assert.deepEqual(f.state.records[1], sibling);
});

test('first creation caches the actual service ID, then later entry and interpretation reuse it', async () => {
  const f = fixture(); await f.handlers().handleQuickRecord(); f.state.input = '90';
  await f.handlers().handleQuickRecord(); await f.handlers().handleGenerateSayu();
  assert.equal(f.state.creates.length, 1);
  assert.deepEqual(f.state.updates.map(update => update.id), [`${today}_actual-created-id`, `${today}_actual-created-id`]);
  assert.equal(JSON.parse(f.state.records[0].voiding_entries).length, 2); assert.equal(f.state.records[0].voiding_sayu, '합성 해석');
});

test('loading blocks writes and analysis; missing today record blocks analysis before callable', async () => {
  const f = fixture(); f.state.loading = true;
  await f.handlers().handleQuickRecord(); await f.handlers().handleGenerateSayu();
  f.state.loading = false; await f.handlers().handleGenerateSayu();
  assert.equal(f.state.calls, 0); assert.equal(f.state.creates.length, 0); assert.equal(f.state.updates.length, 0);
});

test('missing health consent blocks record writes and interpretation calls', async () => {
  const f = fixture([original]); f.state.hasConsent = false;
  await f.handlers().handleQuickRecord(); await f.handlers().handleGenerateSayu();
  assert.equal(f.state.calls, 0); assert.equal(f.state.creates.length, 0); assert.equal(f.state.updates.length, 0);
});

test('synchronous lock blocks double entry and concurrent analysis while persistence is pending', async () => {
  const f = fixture([original]); const pending = deferred(); f.state.pending = pending.promise;
  const first = f.handlers().handleQuickRecord(); await f.handlers().handleQuickRecord(); await f.handlers().handleGenerateSayu();
  assert.equal(f.state.updates.length, 1); assert.equal(f.state.calls, 0);
  pending.resolve(); await first; assert.equal(f.busy.current, false);
});

test('failed update keeps the draft and records, releases the lock and permits retry', async () => {
  const f = fixture([original]); f.state.writeFailure = true; await f.handlers().handleQuickRecord();
  assert.equal(f.state.input, '120'); assert.deepEqual(f.state.records, [original]); assert.equal(f.busy.current, false);
  f.state.writeFailure = false; await f.handlers().handleQuickRecord(); assert.equal(f.state.updates.length, 2);
});

test('failed creation does not add a phantom view target or clear the input', async () => {
  const f = fixture(); f.state.createFailure = true; await f.handlers().handleQuickRecord();
  assert.deepEqual(f.state.records, []); assert.equal(f.state.input, '120'); assert.equal(f.busy.current, false);
});

test('failed interpretation validation does not write or replace the stored interpretation', async () => {
  const f = fixture([{ ...original, voiding_sayu: '기존 해석' }]); f.state.result = 'invalid';
  await f.handlers().handleGenerateSayu(); assert.equal(f.state.updates.length, 0);
  assert.equal(f.state.records[0].voiding_sayu, '기존 해석'); assert.equal(f.busy.current, false);
});

test('pending and nonboolean health consent block both quick writes and interpretation calls', async () => {
  for (const hasConsent of [null, 'true']) {
    const f = fixture([original]); f.state.hasConsent = hasConsent;
    await f.handlers().handleQuickRecord(); await f.handlers().handleGenerateSayu();
    assert.equal(f.state.creates.length, 0); assert.equal(f.state.updates.length, 0); assert.equal(f.state.calls, 0);
  }
});
test('departed account cannot start writes or calls, and a late entry does not update the old UI', async () => {
  const f = fixture([original]), pending = deferred(); f.state.pending = pending.promise;
  const writing = f.handlers().handleQuickRecord(); f.state.sessionActive = false; pending.resolve(); await writing;
  assert.deepEqual(f.state.records, [original]); assert.equal(f.state.input, '120');
  await f.handlers().handleQuickRecord(); await f.handlers().handleGenerateSayu();
  assert.equal(f.state.updates.length, 1); assert.equal(f.state.calls, 0);
});
test('late interpretation from a departed account cannot start a persistence update', async () => {
  const f = fixture([original]), pending = deferred(); f.state.pendingCallable = pending.promise;
  const generating = f.handlers().handleGenerateSayu(); f.state.sessionActive = false; pending.resolve(); await generating;
  assert.equal(f.state.calls, 1); assert.equal(f.state.updates.length, 0); assert.deepEqual(f.state.records, [original]);
});
test('departed account range response cannot replace records or complete a new session loading state', async () => {
  const body = source.slice(source.indexOf('// 레코드 로드 (최근 30일)')).match(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[user\?\.uid, hasConsent\]\);/)[1];
  const pending = deferred(), updates = [], loading = [];
  const env = { user: { uid: 'fixture-user' }, hasConsent: true, isCurrentSession: () => true,
    loadRecords: () => pending.promise, setRecords: value => updates.push(value), setLoading: value => loading.push(value), console: { error() {} } };
  const cleanup = new Function(...Object.keys(env), body)(...Object.values(env));
  cleanup(); pending.resolve([original]); await new Promise(done => setImmediate(done));
  assert.deepEqual(updates, []); assert.deepEqual(loading, [true]);
});
