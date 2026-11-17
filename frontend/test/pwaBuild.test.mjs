import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
// Exercise the generated worker's actual routing configuration, not a duplicate regex.
let shell, manifest;
const routes = [];
const listeners = {};
let activated = 0;
const worker = { addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting: () => { activated++; } };
const workbox = {
  precacheAndRoute(entries) { manifest = entries; }, cleanupOutdatedCaches() {},
  createHandlerBoundToURL(url) { return url; },
  NavigationRoute: class { constructor(url, options) { shell = { url, ...options }; } },
  registerRoute(...args) { routes.push(args); },
  StaleWhileRevalidate: class {}, NetworkOnly: class {},
};
const define = (_deps, factory) => factory(workbox);
worker.define = define;
runInNewContext(readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8'), { self: worker, define });

test('cached shell supports application deep links and excludes auth/payment/static entry points', () => {
  assert.equal(shell.url, '/index.html');
  const excluded = path => shell.denylist.some(regex => regex.test(path));
  for (const path of ['/', '/sayu', '/settings', '/record']) assert.equal(excluded(path), false, path);
  for (const path of ['/auth/callback', '/payment/single', '/single-payment', '/subscription/inicis', '/welcome/', '/card/', '/firebase-messaging-sw.js']) assert.equal(excluded(path), true, path);
});
test('only public shell assets are precached; private JSON, account data and OAuth URLs are absent', () => {
  assert.ok(manifest.some(entry => entry.url === 'index.html'));
  assert.ok(manifest.some(entry => entry.url === 'icons/icon-grape-v1-512.png'));
  for (const entry of manifest) assert.match(entry.url, /^(index\.html|manifest\.webmanifest|assets\/|icons\/|brand\/)/);
  assert.equal(routes.length, 3);
  assert.equal(routes[2][1] instanceof workbox.NetworkOnly, true);
});
test('new worker does not force activation; only an explicit update message activates it', () => {
  assert.equal(activated, 0);
  listeners.message({ data: { type: 'UNRELATED' } });
  assert.equal(activated, 0);
  listeners.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(activated, 1);
});
