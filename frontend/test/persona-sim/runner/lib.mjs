// 러너 공용 도구 — Vite 하네스 서버 기동, 모바일 브라우저 컨텍스트, 외부 요청 차단·집계
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

export const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const outRoot = path.join(harnessRoot, 'out');
export const CHROMIUM_PATH = process.env.PERSONA_SIM_CHROMIUM || '/opt/pw-browsers/chromium';
export const PORT = 18762;
export const BASE_URL = `http://127.0.0.1:${PORT}`;

// iPhone(Safari) 흉내 — 실제 WebKit이 아니라 Chromium 모바일 에뮬레이션이다.
export const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
};

// 1x1 투명 PNG — 모의 Storage 이미지 URL 응답용
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// 이미 떠 있는 하네스 서버가 있으면 재사용하고(close 는 no-op), 없으면 새로 띄운다.
export async function startServer() {
  try {
    const res = await fetch(BASE_URL + '/', { signal: AbortSignal.timeout(1500) });
    if (res.ok) return { close: async () => {}, reused: true };
  } catch { /* 서버 없음 → 새로 기동 */ }
  const server = await createServer({
    configFile: path.join(harnessRoot, 'vite.config.mjs'),
    logLevel: 'warn',
    clearScreen: false,
  });
  await server.listen();
  return server;
}

export async function launchBrowser() {
  return chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
}

/**
 * 가상사용자 1명용 브라우저 컨텍스트.
 * - 로컬 하네스 서버 외의 모든 요청은 차단하고 목록으로 남긴다(운영 Firebase·AI 접촉 0건의 증거).
 * - 콘솔 오류·페이지 오류·대화상자를 수집한다.
 */
export async function newPersonaSession(browser, identity, { device = IPHONE, fixedNow } = {}) {
  const context = await browser.newContext({
    ...device,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',
  });
  const blocked = [];
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (new URL(url).origin === BASE_URL || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    if (new URL(url).hostname === 'qa-storage.invalid') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG });
    }
    blocked.push({ url: url.length > 160 ? `${url.slice(0, 160)}…` : url, type: route.request().resourceType() });
    return route.abort('blockedbyclient');
  });
  await context.addInitScript((id) => { window.__QA_PERSONA__ = id; }, identity);
  // Date만 이동한다. Playwright 전체 clock은 Motion의 Web Animations 시간과
  // 어긋나 종료된 로딩 오버레이를 남길 수 있으므로 RAF·performance·타이머는 원본 유지.
  await context.addInitScript(() => {
    const NativeDate = window.Date;
    let offset = Number(document.cookie.split('; ').find(x => x.startsWith('persona-sim-offset='))?.split('=')[1] || 0);
    window.__qaSetOffset = value => { offset = value; };
    const SimDate = new Proxy(NativeDate, {
      get(target, prop, receiver) {
        if (prop === 'now') return () => NativeDate.now() + offset;
        return Reflect.get(target, prop, receiver);
      },
      construct(target, args, newTarget) {
        return Reflect.construct(target, args.length ? args : [NativeDate.now() + offset], newTarget === SimDate ? target : newTarget);
      },
      apply() { return new NativeDate(NativeDate.now() + offset).toString(); },
    });
    window.Date = SimDate;
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  if (fixedNow) await setSimulatedTime(page, fixedNow);

  const events = { console: [], pageErrors: [], dialogs: [] };
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (/Failed to load resource: net::ERR_BLOCKED_BY_CLIENT/.test(text)) return; // 우리가 차단한 외부 요청
    events.console.push({ type, text: text.length > 500 ? `${text.slice(0, 500)}…` : text });
  });
  page.on('pageerror', (err) => events.pageErrors.push(String(err?.message || err)));
  page.on('dialog', async (dialog) => {
    events.dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss().catch(() => {});
  });
  return { context, page, blocked, events };
}

export function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }

export async function readQa(page) {
  return page.evaluate(() => {
    const qa = window.__qa;
    return qa ? JSON.parse(JSON.stringify({ calls: qa.calls, writes: qa.writes, uploads: qa.uploads, unknownCallables: qa.unknownCallables })) : null;
  });
}

export async function setSimulatedTime(page, time) {
  const offset = new Date(time).getTime() - Date.now();
  await page.context().addCookies([{ name: 'persona-sim-offset', value: String(offset), url: BASE_URL }]);
  await page.evaluate(value => window.__qaSetOffset?.(value), offset);
}

// 사용자가 이미 기록해 둔 상태에서 시작하고 싶을 때 가상 DB에 문서를 미리 넣는다.
export async function seedDb(context, uid, docs /* [[경로, 데이터], ...] */) {
  await context.addInitScript(([key, entries]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(entries));
  }, [`persona-sim-db:${uid}`, docs]);
}
