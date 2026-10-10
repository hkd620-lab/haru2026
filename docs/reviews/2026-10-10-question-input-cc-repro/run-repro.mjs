import { chromium } from '/home/user/haru2026/frontend/test/persona-sim/node_modules/playwright-core/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const DIST = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad/cc274tools/repro-dist';
const SHOTS = '/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad/cc274tools/shots';
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 18917; // 하네스 포트(18762)와 분리
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
const CASES = ['haruLaw', 'fmReadingBook', 'fmSimple', 'fmDiary', 'fmLedgerBiz', 'fmLedgerMemo', 'fmFieldJournal', 'fmFieldGeneric', 'readingAi', 'diaryLearn', 'novelMotive', 'resultChat'];
const VIEWPORTS = [{ name: '390', width: 390, height: 844 }, { name: '1280', width: 1280, height: 800 }];
const results = []; const fails = [];
const check = (cond, label, extra = '') => { results.push({ ok: !!cond, label, extra }); if (!cond) fails.push(label + (extra ? ' :: ' + extra : '')); };
const MEASURE = () => {
  const el = document.querySelector('textarea'); const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight); const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const bor = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth); const r = el.getBoundingClientRect();
  return { lh, pad, bor, rectH: +r.height.toFixed(2), clientH: el.clientHeight, scrollH: el.scrollHeight, lines: +((el.clientHeight - pad) / lh).toFixed(3), overflowY: cs.overflowY, resize: cs.resize, rows: el.rows, w: +r.width.toFixed(1), boxSizing: cs.boxSizing, minH: cs.minHeight, scrollW: el.scrollWidth, clientW: el.clientWidth, pageOverflowX: document.documentElement.scrollWidth > window.innerWidth };
};
for (const vp of VIEWPORTS) {
  for (const id of CASES) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, locale: 'ko-KR' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e))); 
    await page.goto(`http://127.0.0.1:${PORT}/index.html?case=${id}`); await page.waitForSelector('textarea');
    const tag = `[${vp.name}px ${id}]`;
    const m0 = await page.evaluate(MEASURE);
    check(Math.abs(m0.lines - 3) < 0.05, `${tag} 빈 칸 높이 = 3줄`, `lines=${m0.lines} lh=${m0.lh} pad=${m0.pad} h=${m0.rectH} rows=${m0.rows} bs=${m0.boxSizing}`);
    check(m0.resize === 'none', `${tag} resize:none`, m0.resize);
    const ta = page.locator('textarea').first();
    await ta.fill('가\n나\n다'); const m3 = await page.evaluate(MEASURE);
    check(m3.scrollH - m3.clientH <= 1, `${tag} 3줄 입력 시 클리핑·스크롤 없음`, `scrollH=${m3.scrollH} clientH=${m3.clientH}`);
    await ta.fill(Array.from({ length: 15 }, (_, i) => `줄${i + 1}`).join('\n')); const m15 = await page.evaluate(MEASURE);
    check(m15.scrollH > m15.clientH + 10, `${tag} 15줄 입력 시 칸 안에서 스크롤 가능`, `scrollH=${m15.scrollH} clientH=${m15.clientH} overflowY=${m15.overflowY}`);
    const st = await page.evaluate(() => { const el = document.querySelector('textarea'); el.scrollTop = 99999; return el.scrollTop; });
    check(st > 0, `${tag} scrollTop 이동 가능`, `scrollTop=${st}`);
    check(['auto', 'scroll'].includes(m15.overflowY), `${tag} overflow-y 스크롤 허용`, m15.overflowY);
    await ta.fill('가나다라마바사아자차카타파하'.repeat(40)); const mL = await page.evaluate(MEASURE);
    check(mL.scrollH > mL.clientH, `${tag} 긴 한 문단도 내부 스크롤`, `scrollH=${mL.scrollH} clientH=${mL.clientH}`);
    check(m0.rectH === m15.rectH && m0.rectH === mL.rectH, `${tag} 입력량과 무관하게 높이 고정(자동 확장 없음)`, `${m0.rectH}/${m15.rectH}/${mL.rectH}`);
    check(!mL.pageOverflowX && mL.scrollW <= mL.clientW + 1, `${tag} 가로 넘침 없음`, `scrollW=${mL.scrollW} clientW=${mL.clientW} pageOverflowX=${mL.pageOverflowX}`);
    // 값 보존: 한글 입력 → 상태 반영
    await ta.fill(''); await ta.click(); await page.keyboard.type('입력 보존 확인'); check((await ta.inputValue()) === '입력 보존 확인', `${tag} 타이핑 값 보존(controlled)`);
    if (['haruLaw', 'readingAi', 'resultChat', 'fmSimple', 'fmFieldJournal'].includes(id)) { await ta.fill('가\n나\n다\n라\n마\n바\n사\n아\n자\n차'); await page.screenshot({ path: `${SHOTS}/${vp.name}-${id}.png`, fullPage: false, clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 420) } }); }
    check(errs.length === 0, `${tag} 페이지 오류 없음`, errs.join(' | '));
    await ctx.close();
  }
}
// ── ResultChat 키 처리 / IME ──
const kctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
const kp = await kctx.newPage(); const kerrs = []; kp.on('pageerror', e => kerrs.push(String(e)));
await kp.goto(`http://127.0.0.1:${PORT}/index.html?case=resultChat`); await kp.waitForSelector('textarea');
const ta = kp.locator('textarea'); const log = () => kp.evaluate(() => window.__log.slice()); const clearLog = () => kp.evaluate(() => { window.__log.length = 0; });
await kp.evaluate(() => { window.__keys = []; document.addEventListener('keydown', e => window.__keys.push({ key: e.key, keyCode: e.keyCode, isComposing: e.isComposing, shift: e.shiftKey }), true); document.addEventListener('compositionstart', () => window.__keys.push({ ev: 'compositionstart' }), true); document.addEventListener('compositionend', () => window.__keys.push({ ev: 'compositionend' }), true); });
await ta.click(); await kp.keyboard.type('안녕하세요'); await kp.keyboard.press('Enter');
check(JSON.stringify(await log()) === JSON.stringify(['send:"안녕하세요"']) && (await ta.inputValue()) === '', 'Enter = 전송(1회)·입력칸 비움', JSON.stringify(await log())); await clearLog();
await kp.keyboard.type('첫줄'); await kp.keyboard.press('Shift+Enter'); await kp.keyboard.type('둘째줄');
check((await ta.inputValue()) === '첫줄\n둘째줄' && (await log()).length === 0, 'Shift+Enter = 줄바꿈(전송 없음)', JSON.stringify(await ta.inputValue()));
await kp.keyboard.press('Enter'); check(JSON.stringify(await log()) === JSON.stringify(['send:"첫줄\\n둘째줄"']), '여러 줄 질문이 줄바꿈 포함 그대로 전송됨', JSON.stringify(await log())); await clearLog();
await kp.keyboard.press('Enter'); check(JSON.stringify(await log()) === JSON.stringify(['guard-blocked:""']), '빈 입력 Enter: requestSubmit은 실행되나 sendQuestion 가드가 막음(전송 0)', JSON.stringify(await log())); await clearLog();
const sendsBefore = await kp.evaluate(() => window.__sendCalls.length); await kp.keyboard.type('   '); await kp.keyboard.press('Enter'); check((await log()).length === 1 && (await log())[0].startsWith('guard-blocked') && (await kp.evaluate(() => window.__sendCalls.length)) === sendsBefore, '공백만 입력 Enter: 전송 0(가드)', JSON.stringify(await log())); await clearLog(); await ta.fill('');
// 전송 버튼
await kp.keyboard.type('버튼 전송'); const btn = kp.locator('button[type=submit]'); check(await btn.isEnabled(), '내용이 있으면 전송 버튼 활성'); await btn.click(); check((await log()).includes('send:"버튼 전송"'), '전송 버튼 클릭 전송 보존', JSON.stringify(await log())); await clearLog();
check(await btn.isDisabled(), '입력 비면 전송 버튼 비활성');
// IME 1: 합성 이벤트(Chrome 순서 keydown→compositionend 모사: isComposing=true, keyCode 229)
const synth = (init, pre = []) => kp.evaluate(({ init, pre }) => { const el = document.querySelector('textarea'); el.focus(); for (const p of pre) el.dispatchEvent(new CompositionEvent(p, { bubbles: true, data: 'ㅎ' })); const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }); const notPrevented = el.dispatchEvent(ev); return { notPrevented }; }, { init, pre });
await ta.fill('한'); await clearLog();
let r1 = await synth({ isComposing: true, keyCode: 229 }, ['compositionstart']); check((await log()).length === 0 && r1.notPrevented, 'IME(Chrome 순서 모사): 조합 중 Enter는 전송·기본동작 차단 없음', JSON.stringify({ log: await log(), r1 }));
await kp.evaluate(() => document.querySelector('textarea').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' })));
// IME 2: Safari 순서 모사 — compositionend가 먼저 끝난 뒤 keydown(isComposing=false, keyCode 229)
await clearLog(); await kp.evaluate(() => { const el = document.querySelector('textarea'); el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' })); });
let r2 = await synth({ isComposing: false, keyCode: 229 }); check((await log()).length === 0 && r2.notPrevented, 'IME(Safari 순서 모사): 조합 확정 Enter(isComposing=false, keyCode 229)는 전송하지 않음', JSON.stringify({ log: await log(), r2 }));
// 일반 Enter(keyCode 13) 즉시 후속 → 전송
await clearLog(); let r3 = await synth({ isComposing: false, keyCode: 13 }); check((await log()).length === 1 && (await log())[0] === 'send:"한"' && !r3.notPrevented, '조합이 끝난 뒤 일반 Enter(keyCode 13)는 전송', JSON.stringify({ log: await log(), r3 })); await clearLog();
// IME 3: CDP 실제 IME 경로(Chromium) — 조합 중 Enter 키 입력
await ta.fill(''); await ta.click(); const cdp = await kctx.newCDPSession(kp);
await kp.evaluate(() => { window.__keys.length = 0; });
await cdp.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
const keys = await kp.evaluate(() => window.__keys.slice()); const logAfter = await log();
console.log('CDP IME events:', JSON.stringify(keys), 'log:', JSON.stringify(logAfter), 'value:', JSON.stringify(await ta.inputValue()));
const sawCompositionKeydown = keys.some(k => k.key === 'Enter' && (k.isComposing || k.keyCode === 229));
check(!logAfter.some(x => x.startsWith('send:')), 'CDP 실제 IME 조합 중 Enter: 전송되지 않음(Chromium)', JSON.stringify({ keys, logAfter, sawCompositionKeydown }));
await ctx_close();
async function ctx_close() { await kctx.close(); await browser.close(); server.close(); }
const pass = results.filter(r => r.ok).length;
console.log(`\n== 재현 결과: ${pass}/${results.length} 통과, 실패 ${fails.length} ==`);
for (const f of fails) console.log('FAIL', f);
fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify(results, null, 1));
