// dist를 Firebase Hosting과 같은 rewrite로 띄우고 headless Chrome(CDP)으로 경로별 부팅 결과를 기록한다.
// 사용: node web-upgrade-smoke.mjs <dist> <라벨> <포트> [--force-legacy]
// --force-legacy: index.html에서 module 스크립트를 빼고 nomodule을 풀어 레거시 번들만 실행한다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const [dist, label, portArg, flag] = process.argv.slice(2);
const port = Number(portArg);
const debugPort = port + 1000;
const forceLegacy = flag === '--force-legacy';
const EVID = '/private/tmp/haru-completion-web-upgrade-20261031/docs/reviews/2026-10-31-web-major-completion/smoke';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.xml': 'application/xml', '.txt': 'text/plain' };
const REWRITES = { '/welcome': '/welcome/index.html', '/welcome/': '/welcome/index.html', '/card': '/card/index.html', '/card/': '/card/index.html' };

function indexHtml() {
  let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  if (forceLegacy) {
    html = html.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<link rel="modulepreload"[^>]*>/g, '')
      .replace(/<script nomodule>[\s\S]*?<\/script>/, '')
      .replace(/<script nomodule /g, '<script ');
  }
  return html;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x').pathname;
  const mapped = REWRITES[url] || url;
  const file = path.join(dist, decodeURIComponent(mapped));
  if (mapped !== '/' && mapped !== '/index.html' && file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': MIME['.html'] });
  res.end(indexHtml());
});
await new Promise((ok) => server.listen(port, '127.0.0.1', ok));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'haru-web-smoke-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
let target;
for (let i = 0; i < 40 && !target; i += 1) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {}
}
if (!target) throw new Error('chrome devtools 연결 실패');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok) => { ws.onopen = ok; });
let seq = 0;
const pending = new Map();
let events = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') events.push({ kind: 'exception', text: d.params.exceptionDetails.exception?.description?.slice(0, 300) || d.params.exceptionDetails.text, url: d.params.exceptionDetails.url });
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) events.push({ kind: d.params.type, text: d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300) });
  if (d.method === 'Network.loadingFailed' && !d.params.canceled) events.push({ kind: 'netfail', text: d.params.errorText, type: d.params.type });
  if (d.method === 'Network.responseReceived' && d.params.response.url.includes('/assets/') && d.params.response.status >= 400) events.push({ kind: 'http', status: d.params.response.status, url: d.params.response.url });
  if (d.method === 'Network.requestWillBeSent' && d.params.request.url.includes('/assets/')) assets.add(path.basename(new URL(d.params.request.url).pathname));
};
let assets = new Set();
const send = (method, params = {}) => new Promise((ok) => { seq += 1; pending.set(seq, ok); ws.send(JSON.stringify({ id: seq, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Log.enable');

const routes = ['/', '/login', '/record', '/settings', '/terms', '/privacy', '/refund', '/business-info', '/vault', '/does-not-exist', '/welcome', '/card'];
const results = [];
fs.mkdirSync(EVID, { recursive: true });
for (const route of routes) {
  events = [];
  assets = new Set();
  await send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` });
  await sleep(6000);
  const state = await evaluate(`({
    href: location.pathname + location.search,
    title: document.title,
    rootChildren: document.getElementById('root')?.childElementCount ?? null,
    text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 160),
    textLength: (document.body.innerText || '').length,
    modernFlag: window.__vite_is_modern_browser === true,
    hasSystem: typeof window.System !== 'undefined',
  })`);
  const local = events.filter((e) => !(e.kind === 'netfail'));
  results.push({ route, ...state, assetRequests: assets.size, legacyAssets: [...assets].filter((a) => a.includes('-legacy')).length, events: local.slice(0, 12), netfail: events.filter((e) => e.kind === 'netfail').length });
  if (['/', '/login'].includes(route)) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(EVID, `${label}${route === '/' ? '-root' : route.replace('/', '-')}.png`), Buffer.from(shot.data, 'base64'));
  }
}
const report = { label, dist, forceLegacy, chrome: (await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json()).Browser, results };
fs.writeFileSync(path.join(EVID, `${label}.json`), JSON.stringify(report, null, 1));
for (const r of results) console.log(r.route, '->', r.href, '| root', r.rootChildren, '| len', r.textLength, '| modern', r.modernFlag, '| System', r.hasSystem, '| legacyAssets', r.legacyAssets, '/', r.assetRequests, '| events', r.events.length, JSON.stringify(r.events.slice(0, 2)));
chrome.kill();
ws.close();
server.close();
process.exit(0);
