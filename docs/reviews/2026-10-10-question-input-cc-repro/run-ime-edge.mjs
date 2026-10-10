import { chromium } from '/home/user/haru2026/frontend/test/persona-sim/node_modules/playwright-core/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const DIST = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad/cc274tools/repro-dist'; const PORT = 18918;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); const f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname); if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(PORT, '127.0.0.1');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?case=resultChat`); await page.waitForSelector('textarea');
  await page.evaluate(() => { window.__ev = []; for (const t of ['compositionstart', 'compositionupdate', 'compositionend', 'blur', 'focus']) document.addEventListener(t, e => window.__ev.push(t), true); document.addEventListener('keydown', e => window.__ev.push(`keydown:${e.key}:${e.keyCode}:${e.isComposing}`), true); });
  return { ctx, page, errs, ta: page.locator('textarea'), cdp: await ctx.newCDPSession(page) };
}
const log = (p) => p.evaluate(() => window.__log.slice());
const ev = (p) => p.evaluate(() => window.__ev.slice());
// A. 정상 조합 → 확정(Input.insertText) → compositionend 발생, 이후 Enter 전송 동작
{ const { ctx, page, ta, cdp } = await fresh(); await ta.click();
  await cdp.send('Input.imeSetComposition', { text: '하', selectionStart: 1, selectionEnd: 1 }); await cdp.send('Input.insertText', { text: '하' });
  await page.keyboard.press('Enter'); console.log('A 정상 확정 후 Enter →', JSON.stringify({ ev: await ev(page), log: await log(page), value: await ta.inputValue() })); await ctx.close(); }
// B. 조합 중 포커스 이탈(blur) → compositionend 발생 여부, 재포커스 후 Enter 전송 가능 여부
{ const { ctx, page, ta, cdp } = await fresh(); await ta.click();
  await cdp.send('Input.imeSetComposition', { text: '하', selectionStart: 1, selectionEnd: 1 });
  await page.evaluate(() => document.querySelector('textarea').blur()); await page.waitForTimeout(50);
  const evAfterBlur = await ev(page); await ta.click(); await page.keyboard.type('질문'); await page.keyboard.press('Enter');
  console.log('B blur 후 재포커스 Enter →', JSON.stringify({ evAfterBlur, ev: await ev(page), log: await log(page), value: JSON.stringify(await ta.inputValue()) })); await ctx.close(); }
// C. 조합 중 프로그램이 값을 바꿈(state reset 모사: setQuestion('')) → compositionend 발생 여부
{ const { ctx, page, ta, cdp } = await fresh(); await ta.click();
  await cdp.send('Input.imeSetComposition', { text: '하', selectionStart: 1, selectionEnd: 1 });
  await ta.fill('다른 값'); await page.waitForTimeout(50);
  await page.keyboard.press('Enter');
  console.log('C 조합 중 fill() 후 Enter →', JSON.stringify({ ev: await ev(page), log: await log(page), value: JSON.stringify(await ta.inputValue()) })); await ctx.close(); }
// D. requestSubmit 미지원 브라우저(iOS<16 등) 모사 — 새 페이지, 조합 상태 오염 없음
{ const { ctx, page, ta, errs } = await fresh(); await page.evaluate(() => { delete HTMLFormElement.prototype.requestSubmit; });
  await ta.click(); await page.keyboard.type('구형 브라우저'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  console.log('D requestSubmit 없음 + Enter →', JSON.stringify({ typeofRequestSubmit: await page.evaluate(() => typeof HTMLFormElement.prototype.requestSubmit), log: await log(page), errs, value: JSON.stringify(await ta.inputValue()) }));
  const btn = page.locator('button[type=submit]'); await btn.click(); console.log('D2 전송 버튼은 계속 동작 →', JSON.stringify(await log(page))); await ctx.close(); }
// E. CDP 합성 Enter(keyCode 13)를 조합 중에 넣은 뒤 compositionend가 끝내 안 오는 경우의 상태
{ const { ctx, page, ta, cdp } = await fresh(); await ta.click();
  await cdp.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  const e1 = await ev(page); await ta.fill(''); await page.waitForTimeout(30); await page.keyboard.type('질문'); await page.keyboard.press('Enter');
  console.log('E CDP 합성 Enter 뒤 상태 →', JSON.stringify({ e1, ev: await ev(page), log: await log(page), value: JSON.stringify(await ta.inputValue()) }));
  await ctx.close(); }
await browser.close(); server.close();
