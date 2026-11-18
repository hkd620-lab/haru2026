import test from 'node:test';
import assert from 'node:assert/strict';
import { createPwaUpdateController } from '../src/app/utils/pwaUpdateController.ts';
function tab(activate = async () => {}) {
  const timers = new Map();
  const state = { reloads: 0, offers: [] };
  const controller = createPwaUpdateController({ activate, reload() { state.reloads++; }, offer(...args) { state.offers.push(args); }, schedule(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, cancel(id) { timers.delete(id); } });
  return { ...controller, state, timeout() { [...timers.values()].forEach(fn => fn()); } };
}
test('an update in tab A reloads only A; tab B keeps its draft until B consents', async () => {
  const a = tab(), b = tab();
  const pending = a.requestUpdate();
  a.onNeedReload(); b.onNeedReload();
  await pending;
  assert.equal(a.state.reloads, 1);
  assert.equal(b.state.reloads, 0);
  assert.match(b.state.offers.at(-1)[2], /이 창의 내용을 저장/);
  await b.state.offers.at(-1)[0]();
  assert.equal(b.state.reloads, 1);
});
test('a controller change with no local consent never reloads the page', () => {
  const a = tab(); a.onNeedReload(); a.onNeedReload();
  assert.equal(a.state.reloads, 0);
});
test('a missing controlling event releases the busy state and offers explicit reload', async () => {
  const a = tab(); const pending = a.requestUpdate();
  a.timeout(); await pending;
  assert.equal(a.state.reloads, 0);
  assert.equal(a.state.offers.at(-1)[1], '화면 다시 열기');
  a.onNeedReload();
  assert.equal(a.state.reloads, 0, 'a late event must not reuse expired consent');
  await a.state.offers.at(-1)[0]();
  assert.equal(a.state.reloads, 1);
});
test('activation failure offers retry and does not reload', async () => {
  const a = tab(async () => { throw new Error('offline'); });
  await a.requestUpdate();
  assert.equal(a.state.reloads, 0);
  assert.equal(a.state.offers.at(-1)[1], '다시 시도');
});
test('repeated clicks during activation share the pending request', async () => {
  let calls = 0;
  const a = tab(async () => { calls++; });
  const first = a.requestUpdate(); const second = a.requestUpdate();
  assert.equal(first, second);
  a.onNeedReload(); await first;
  assert.equal(calls, 1);
});

test('a newer waiting worker is activated even after this tab observed an earlier update', async () => {
  let activations = 0;
  const a = tab(async () => { activations++; });
  a.onNeedReload(); a.onNeedRefresh();
  const pending = a.requestUpdate();
  assert.equal(activations, 1);
  assert.equal(a.state.reloads, 0);
  a.onNeedReload(); await pending;
  assert.equal(a.state.reloads, 1);
});
test('a late rejection from a timed-out attempt cannot cancel the next consent', async () => {
  const rejects = [];
  const a = tab(() => new Promise((_resolve, reject) => rejects.push(reject)));
  const first = a.requestUpdate(); a.timeout(); await first;
  const second = a.requestUpdate();
  rejects[0](new Error('late network failure')); await Promise.resolve();
  assert.equal(a.state.offers.length, 1);
  a.onNeedReload(); await second;
  assert.equal(a.state.reloads, 1);
});
