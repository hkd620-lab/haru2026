import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const fakeWindow = new EventTarget();
const display = new EventTarget();
display.matches = false;
fakeWindow.matchMedia = () => display;
globalThis.window = fakeWindow;
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const { startPwaState, usePwaState, installPwa, offerPwaUpdate } = await import('../src/app/utils/pwaState.ts');
function snapshot() {
  let state;
  function Probe() { state = usePwaState(); return null; }
  renderToStaticMarkup(React.createElement(Probe));
  return state;
}
startPwaState();
test('offline and reconnect change status without reloading the editor', () => {
  window.dispatchEvent(new Event('offline'));
  assert.equal(snapshot().online, false);
  window.dispatchEvent(new Event('online'));
  assert.equal(snapshot().online, true);
});
test('install event is consumed once; acceptance alone does not confirm installation', async () => {
  let calls = 0;
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = async () => { calls++; };
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  await installPwa(); await installPwa();
  assert.equal(calls, 1);
  assert.equal(snapshot().installEvent, null);
  assert.equal(snapshot().installed, false);
});
test('dismissal consumes the event; appinstalled confirms installation', async () => {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = async () => {};
  event.userChoice = Promise.resolve({ outcome: 'dismissed' });
  window.dispatchEvent(event); await installPwa();
  assert.equal(snapshot().installEvent, null);
  assert.equal(snapshot().installed, false);
  window.dispatchEvent(new Event('appinstalled'));
  assert.equal(snapshot().installed, true);
});
test('a waiting update is activated only on request', async () => {
  let activated = 0;
  offerPwaUpdate(async () => { activated++; });
  assert.equal(activated, 0);
  await snapshot().update();
  assert.equal(activated, 1);
});
test('standalone display changes are tracked and startup is idempotent', () => {
  startPwaState(); display.matches = false; display.dispatchEvent(new Event('change'));
  assert.equal(snapshot().installed, false);
  display.matches = true; display.dispatchEvent(new Event('change'));
  assert.equal(snapshot().installed, true);
});
