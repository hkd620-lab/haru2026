// Run: npm ci --prefix frontend && npm ci --prefix tests
//      node --test tests/auth-user-document-gate.test.cjs
// Uses the esbuild installed by Vite and the existing Playwright test dependency.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const frontendRequire = createRequire(path.resolve(__dirname, '../frontend/package.json'));
const { build } = frontendRequire('esbuild');
const { chromium, expect } = require('@playwright/test');
let browser, server, baseURL;
before(async () => {
  const firebase = path.join(__dirname, 'fixtures/auth-gate/firebase.ts');
  const result = await build({
    entryPoints: [path.join(__dirname, 'fixtures/auth-gate/app.tsx')], bundle: true, write: false,
    jsx: 'automatic', nodePaths: [path.resolve(__dirname, '../frontend/node_modules')],
    define: { 'import.meta.env.DEV': 'true', 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'firebase-test-boundary', setup(builder) {
      builder.onResolve({ filter: /^(firebase\/|.*\/(config\/firebase|services\/notificationService|utils\/(loginPerformance|snsPrivateThumbnailState))$|\.\.\/\.\.\/firebase$)/ }, () => ({ path: firebase }));
    } }],
  });
  server = http.createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/app.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/app.js' ? result.outputFiles[0].text : '<html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/app.js"></script></html>');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); });
async function setup(t, route = '/') {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  t.after(() => page.close());
  await page.route('**/*', route => route.request().url().startsWith(baseURL) ? route.continue() : route.abort());
  await page.goto(baseURL + route);
  await page.waitForFunction(() => window.harness?.observers.size === 1);
  return page;
}
async function auth(page, uid) {
  const count = await page.evaluate(() => window.harness.listeners.length);
  await page.evaluate(uid => window.harness.emitAuth(uid), uid);
  if (uid) await page.waitForFunction(count => window.harness.listeners.length > count, count);
  return page.evaluate(() => window.harness.listeners.length - 1);
}
async function snap(page, index, data, metadata) {
  await page.evaluate(({ index, data, metadata }) => window.harness.snapshot(index, data, metadata), { index, data, metadata });
}
async function blocked(page, neverMounted = true) {
  await expect(page.getByTestId('protected')).toHaveCount(0);
  if (neverMounted) assert.deepEqual(await page.evaluate(() => window.harness.renders), []);
}
const consent = { consents: { terms: true, termsVersion: 'legacy' } };
for (const route of ['/', '/record']) test(`initial auth + delayed document block ${route}`, async t => {
  const page = await setup(t, route);
  await expect(page.getByRole('status')).toBeVisible();
  await blocked(page);
  const index = await auth(page, 'a');
  await blocked(page);
  await snap(page, index, consent, { fromCache: true });
  await blocked(page);
  await snap(page, index, consent, { hasPendingWrites: true });
  await blocked(page);
  await snap(page, index, consent);
  await expect(page.getByTestId('protected')).toHaveText('protected:a');
  assert.equal(await page.evaluate(i => window.harness.listeners[i].options.includeMetadataChanges, index), true);
});
test('signed out auth permits public landing', async t => {
  const page = await setup(t);
  await auth(page, null);
  await expect(page.getByTestId('public')).toBeVisible();
  await blocked(page);
});
test('lookup error stays closed, retry replaces listener, old events cannot unlock', async t => {
  const page = await setup(t);
  const old = await auth(page, 'a');
  await page.evaluate(i => window.harness.error(i), old);
  await expect(page.getByRole('alert')).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  if (process.env.AUTH_GATE_SCREENSHOT) await page.screenshot({ path: process.env.AUTH_GATE_SCREENSHOT });
  await blocked(page);
  assert.equal(await page.evaluate(() => window.harness.traces.includes('T5_user_doc_ready')), false);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.waitForFunction(i => window.harness.listeners.length > i + 1, old);
  assert.equal(await page.evaluate(i => window.harness.listeners[i].stopped, old), true);
  await snap(page, old, consent);
  await page.evaluate(i => window.harness.error(i), old);
  await expect(page.getByRole('status')).toBeVisible();
  await blocked(page);
  await snap(page, old + 1, consent);
  await expect(page.getByTestId('protected')).toHaveText('protected:a');
  await page.evaluate(i => window.harness.error(i), old + 1);
  await expect(page.getByRole('alert')).toBeVisible();
  await blocked(page, false);
});
test('offline/cache-only timeout offers retry and logout', async t => {
  const page = await setup(t);
  await page.clock.install();
  const index = await auth(page, 'a');
  await snap(page, index, consent, { fromCache: true });
  await page.clock.fastForward(15001);
  await expect(page.getByRole('alert')).toBeVisible();
  await blocked(page);
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByTestId('public')).toBeVisible();
});
for (const data of [undefined, {}, { consents: null }]) test(`missing consent (${JSON.stringify(data)}) requires confirmed save`, async t => {
  const page = await setup(t);
  const index = await auth(page, 'a');
  await snap(page, index, data);
  await expect(page.getByRole('heading', { name: '약관 동의가 필요합니다' })).toBeVisible();
  await blocked(page);
  const save = page.getByRole('button', { name: '동의하고 계속하기' });
  await expect(save).toBeDisabled();
  const checks = page.getByRole('checkbox');
  for (const n of [1, 2, 3, 4]) await checks.nth(n).check();
  await save.click();
  const write = await page.evaluate(() => window.harness.writes[0]);
  assert.equal(write.path, 'users/a');
  assert.equal(write.data.consents.marketing, false);
  assert.equal(write.data.consents.termsVersion, '2026-08-20');
  assert.equal(write.data.consents.age19, true);
  assert.deepEqual(write.options, { merge: true });
  await snap(page, index, consent, { hasPendingWrites: true });
  await blocked(page);
  await page.evaluate(() => window.harness.writes[0].resolve());
  await blocked(page);
  await snap(page, index, consent);
  await expect(page.getByTestId('protected')).toBeVisible();
});
test('pending deletion wins over missing consent, recovery waits for server', async t => {
  const page = await setup(t);
  const index = await auth(page, 'a');
  await snap(page, index, { accountStatus: 'pending_deletion' });
  await expect(page.getByRole('heading', { name: '회원탈퇴가 신청되어 있습니다' })).toBeVisible();
  await blocked(page);
  await page.getByRole('button', { name: '계정 복구하기' }).click();
  assert.deepEqual(await page.evaluate(() => ({ name: window.harness.recoveries[0].name, region: window.harness.recoveries[0].functions.region })), { name: 'cancelAccountDeletion', region: 'asia-northeast3' });
  await page.evaluate(() => window.harness.recoveries[0].resolve());
  await blocked(page);
  await snap(page, index, {});
  await expect(page.getByRole('heading', { name: '약관 동의가 필요합니다' })).toBeVisible();
  await snap(page, index, consent);
  await expect(page.getByTestId('protected')).toBeVisible();
});
test('account switch invalidates ready state and all late previous callbacks', async t => {
  const page = await setup(t);
  const a = await auth(page, 'a');
  await snap(page, a, consent);
  await expect(page.getByTestId('protected')).toHaveText('protected:a');
  const b = await auth(page, 'b');
  await blocked(page, false);
  await snap(page, a, consent);
  await page.evaluate(i => window.harness.error(i), a);
  await blocked(page, false);
  assert.equal(await page.evaluate(() => window.harness.renders.includes('b')), false);
  await snap(page, b, {});
  await expect(page.getByRole('heading', { name: '약관 동의가 필요합니다' })).toBeVisible();
  await page.getByRole('checkbox').nth(0).check();
  const c = await auth(page, 'c');
  await snap(page, c, {});
  await expect(page.getByRole('checkbox').nth(0)).not.toBeChecked();
});
test('same UID relogin never reuses an earlier session', async t => {
  const page = await setup(t);
  const old = await auth(page, 'a');
  await snap(page, old, consent);
  await expect(page.getByTestId('protected')).toBeVisible();
  await auth(page, null);
  const next = await auth(page, 'a');
  await snap(page, old, consent);
  await blocked(page, false);
  await snap(page, next, { ...consent, accountStatus: 'pending_deletion' });
  await expect(page.getByRole('heading', { name: '회원탈퇴가 신청되어 있습니다' })).toBeVisible();
});
test('lookup error logout failure keeps gate, later logout succeeds', async t => {
  const page = await setup(t);
  const index = await auth(page, 'a');
  await page.evaluate(i => { window.harness.error(i); window.harness.logoutFails = true; }, index);
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  assert.equal(await page.evaluate(() => window.harness.alerts.length), 1);
  await blocked(page);
  await page.evaluate(() => { window.harness.logoutFails = false; });
  await page.getByRole('button', { name: '로그아웃' }).click();
  await snap(page, index, { accountStatus: 'pending_deletion' });
  await expect(page.getByTestId('public')).toBeVisible();
});
test('late redirect result cannot restore previous account', async t => {
  const page = await setup(t);
  const old = await auth(page, 'a');
  await auth(page, 'b');
  await page.evaluate(() => window.harness.redirect.resolve({ user: { uid: 'a', providerData: [] } }));
  await snap(page, old, consent);
  await blocked(page);
  await snap(page, old + 1, consent);
  await expect(page.getByTestId('protected')).toHaveText('protected:b');
});
test('email signup consent continuation survives page unmount', async t => {
  const page = await setup(t);
  await auth(page, null);
  await expect(page.getByTestId('public')).toBeVisible();
  await page.evaluate(() => { window.signupPromise = window.signup(); });
  await page.waitForFunction(() => window.harness.writes.length === 1);
  await blocked(page);
  assert.equal(await page.evaluate(() => window.harness.writes[0].path), 'users/email');
  await page.evaluate(() => window.harness.writes[0].resolve());
  await snap(page, 0, consent);
  await expect(page.getByTestId('protected')).toHaveText('protected:email');
});
test('failed consent save retains gate and can be retried', async t => {
  const page = await setup(t);
  const index = await auth(page, 'a');
  await snap(page, index, {});
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('button', { name: '동의하고 계속하기' }).click();
  await page.evaluate(() => window.harness.writes[0].reject({ code: 'permission-denied' }));
  await expect(page.getByRole('button', { name: '동의하고 계속하기' })).toBeEnabled();
  await blocked(page);
  assert.equal(await page.evaluate(() => window.harness.alerts.length), 1);
});
test('failed recovery retains pending deletion and can be retried', async t => {
  const page = await setup(t);
  const index = await auth(page, 'a');
  await snap(page, index, { ...consent, accountStatus: 'pending_deletion' });
  await page.getByRole('button', { name: '계정 복구하기' }).click();
  await page.evaluate(() => window.harness.recoveries[0].reject(new Error('offline')));
  await expect(page.getByRole('button', { name: '계정 복구하기' })).toBeEnabled();
  await blocked(page);
  await page.getByRole('button', { name: '계정 복구하기' }).click();
  await page.evaluate(() => window.harness.recoveries[1].resolve());
  await snap(page, index, consent);
  await expect(page.getByTestId('protected')).toBeVisible();
});
test('late save after account switch does not update new account gate', async t => {
  const page = await setup(t);
  const a = await auth(page, 'a');
  await snap(page, a, {});
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('button', { name: '동의하고 계속하기' }).click();
  const b = await auth(page, 'b');
  await snap(page, b, {});
  await page.evaluate(() => window.harness.writes[0].reject({ code: 'permission-denied' }));
  await snap(page, a, consent);
  await expect(page.getByRole('checkbox').nth(0)).toBeEnabled();
  await expect(page.getByRole('checkbox').nth(0)).not.toBeChecked();
  assert.equal(await page.evaluate(() => window.harness.alerts.length), 0);
  await blocked(page);
});
test('retry during a pending save resets busy state and ignores old completion', async t => {
  const page = await setup(t);
  const old = await auth(page, 'a');
  await snap(page, old, {});
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('button', { name: '동의하고 계속하기' }).click();
  await page.evaluate(i => window.harness.error(i), old);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await page.waitForFunction(i => window.harness.listeners.length > i + 1, old);
  await snap(page, old + 1, {});
  await expect(page.getByRole('checkbox').nth(0)).toBeEnabled();
  await page.evaluate(() => window.harness.writes[0].resolve());
  await blocked(page);
});
test('unmount cancels listener and late callbacks', async t => {
  const page = await setup(t);
  const index = await auth(page, 'a');
  await page.evaluate(() => window.unmount());
  assert.equal(await page.evaluate(i => window.harness.listeners[i].stopped, index), true);
  assert.equal(await page.evaluate(() => window.harness.observers.size), 0);
  await snap(page, index, consent);
  await blocked(page);
});
