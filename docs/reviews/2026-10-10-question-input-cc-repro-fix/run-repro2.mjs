// 보완 후 재현: PR #274 보완 커밋의 실제 JSX를 앱의 실제 React·Tailwind·전역 CSS로 렌더해 Chromium에서 시험한다.
// 사용: node run-repro2.mjs <dist 폴더> <결과 JSON 경로>
import { chromium } from '/home/user/haru2026/frontend/test/persona-sim/node_modules/playwright-core/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const DIST = process.argv[2]; const OUT = process.argv[3];
const PORT = 18931; // 하네스 포트(18762)와 분리
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const f = path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
// 질문칸은 resize:none, 장문 작성칸은 resize:vertical (일기 상세는 변경 전부터 none)
const CASES = {
  haruLaw: 'none', readingAi: 'none', resultChat: 'none', novelMotive: 'none',
  fmReadingBook: 'vertical', fmSimple: 'vertical', fmLedgerBiz: 'vertical', fmLedgerMemo: 'vertical',
  fmFieldJournal: 'vertical', fmFieldGeneric: 'vertical', diaryLearn: 'vertical', plantMemo: 'vertical',
  fmDiary: 'none',
};
const VIEWPORTS = [{ name: '390', width: 390, height: 844 }, { name: '1280', width: 1280, height: 800 }];
const results = []; const fails = [];
const check = (cond, label, extra = '') => { results.push({ ok: !!cond, label, extra }); if (!cond) fails.push(label + (extra ? ' :: ' + extra : '')); };
const MEASURE = () => {
  const el = document.querySelector('textarea'); const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight); const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom); const r = el.getBoundingClientRect();
  return { lh, pad, rectH: +r.height.toFixed(2), clientH: el.clientHeight, scrollH: el.scrollHeight, lines: +((el.clientHeight - pad) / lh).toFixed(3), overflowY: cs.overflowY, resize: cs.resize, rows: el.rows, scrollW: el.scrollWidth, clientW: el.clientWidth, pageOverflowX: document.documentElement.scrollWidth > window.innerWidth };
};
for (const vp of VIEWPORTS) {
  for (const [id, expResize] of Object.entries(CASES)) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, locale: 'ko-KR' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/index.html?case=${id}`); await page.waitForSelector('textarea');
    const tag = `[${vp.name}px ${id}]`; const ta = page.locator('textarea').first();
    const m0 = await page.evaluate(MEASURE);
    check(Math.abs(m0.lines - 3) < 0.05, `${tag} 초기 높이 = 3줄`, `lines=${m0.lines} lh=${m0.lh} rows=${m0.rows}`);
    check(m0.resize === expResize, `${tag} resize:${expResize}`, m0.resize);
    await ta.fill('가\n나\n다'); const m3 = await page.evaluate(MEASURE);
    check(m3.scrollH - m3.clientH <= 1, `${tag} 3줄 입력 시 클리핑 없음`, `scrollH=${m3.scrollH} clientH=${m3.clientH}`);
    await ta.fill(Array.from({ length: 15 }, (_, i) => `줄${i + 1}`).join('\n')); const m15 = await page.evaluate(MEASURE);
    check(m15.scrollH > m15.clientH + 10 && ['auto', 'scroll'].includes(m15.overflowY), `${tag} 15줄 입력 시 내부 스크롤`, `scrollH=${m15.scrollH} clientH=${m15.clientH} overflowY=${m15.overflowY}`);
    await ta.fill('가나다라마바사아자차카타파하'.repeat(40)); const mL = await page.evaluate(MEASURE);
    check(mL.scrollH > mL.clientH, `${tag} 긴 한 문단도 내부 스크롤`, `scrollH=${mL.scrollH} clientH=${mL.clientH}`);
    check(m0.rectH === m15.rectH && m0.rectH === mL.rectH, `${tag} 입력량과 무관하게 높이 고정`, `${m0.rectH}/${m15.rectH}/${mL.rectH}`);
    check(!mL.pageOverflowX && mL.scrollW <= mL.clientW + 1, `${tag} 가로 넘침 없음`, `scrollW=${mL.scrollW} clientW=${mL.clientW}`);
    await ta.fill(''); await ta.click(); await page.keyboard.type('입력 보존 확인'); check((await ta.inputValue()) === '입력 보존 확인', `${tag} 타이핑 값 보존`);
    if (expResize === 'vertical') {
      // 세로 크기 조절 핸들: 사용자가 키우면 높이가 늘고 내용이 보인다(프로그램적으로 height 지정으로 모사)
      const grown = await page.evaluate(() => { const el = document.querySelector('textarea'); const before = el.getBoundingClientRect().height; el.style.height = (before + 120) + 'px'; return [before, el.getBoundingClientRect().height]; });
      check(grown[1] > grown[0] + 100, `${tag} 세로 확장 가능(resize:vertical 상태에서 height 조정 반영)`, JSON.stringify(grown));
    }
    check(errs.length === 0, `${tag} 페이지 오류 없음`, errs.join(' | '));
    await ctx.close();
  }
}
// ── ResultChat 키 처리 / IME (새 보호 로직) ──
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?case=resultChat`); await page.waitForSelector('textarea');
  return { ctx, page, errs, ta: page.locator('textarea'), log: () => page.evaluate(() => window.__log.slice()), clear: () => page.evaluate(() => { window.__log.length = 0; }) };
}
const ev = (page, init, pre = [], post = []) => page.evaluate(({ init, pre, post }) => {
  const el = document.querySelector('textarea'); el.focus();
  for (const p of pre) el.dispatchEvent(new CompositionEvent(p, { bubbles: true, data: 'ㅎ' }));
  const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
  const notPrevented = el.dispatchEvent(e);
  for (const p of post) el.dispatchEvent(new CompositionEvent(p, { bubbles: true, data: 'ㅎ' }));
  return { notPrevented, value: el.value };
}, { init, pre, post });
{ // 기본 동작 보존
  const { ctx, page, ta, log, clear } = await fresh(); await ta.click();
  await page.keyboard.type('안녕하세요'); await page.keyboard.press('Enter');
  check(JSON.stringify(await log()) === JSON.stringify(['send:"안녕하세요"']) && (await ta.inputValue()) === '', 'Enter = 전송 1회·입력칸 비움', JSON.stringify(await log())); await clear();
  await page.keyboard.type('첫줄'); await page.keyboard.press('Shift+Enter'); await page.keyboard.type('둘째줄');
  check((await ta.inputValue()) === '첫줄\n둘째줄' && (await log()).length === 0, 'Shift+Enter = 줄바꿈(전송 없음)');
  await page.keyboard.press('Enter'); check(JSON.stringify(await log()) === JSON.stringify(['send:"첫줄\\n둘째줄"']), '여러 줄 질문이 줄바꿈 포함 그대로 전송', JSON.stringify(await log())); await clear();
  await page.keyboard.press('Enter'); check(JSON.stringify(await log()) === JSON.stringify(['guard-blocked:""']), '빈 입력 Enter: sendQuestion 가드가 막음(전송 0)', JSON.stringify(await log())); await clear();
  const sendsBefore = await page.evaluate(() => window.__sendCalls.length); await page.keyboard.type('   '); await page.keyboard.press('Enter');
  check((await log()).length === 1 && (await log())[0].startsWith('guard-blocked') && (await page.evaluate(() => window.__sendCalls.length)) === sendsBefore, '공백만 입력 Enter: 전송 0(가드)', JSON.stringify(await log())); await clear(); await ta.fill('');
  await page.keyboard.type('버튼 전송'); const btn = page.locator('button[type=submit]'); check(await btn.isEnabled(), '내용이 있으면 전송 버튼 활성'); await btn.click(); check((await log()).includes('send:"버튼 전송"'), '전송 버튼 클릭 전송 보존', JSON.stringify(await log())); check(await btn.isDisabled(), '입력 비면 전송 버튼 비활성'); await ctx.close();
}
{ // F1: requestSubmit 미지원 브라우저에서도 Enter 전송
  const { ctx, page, ta, log, errs } = await fresh(); await page.evaluate(() => { delete HTMLFormElement.prototype.requestSubmit; });
  await ta.click(); await page.keyboard.type('구형 브라우저'); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  check(JSON.stringify(await log()) === JSON.stringify(['send:"구형 브라우저"']) && errs.length === 0, 'F1 requestSubmit 없는 브라우저에서도 Enter 전송·오류 없음', JSON.stringify({ log: await log(), errs, typeofRS: await page.evaluate(() => typeof HTMLFormElement.prototype.requestSubmit) })); await ctx.close();
}
{ // F2-a Chrome 순서
  const { ctx, page, ta, log } = await fresh(); await ta.fill('한');
  const r = await ev(page, { isComposing: true, keyCode: 229 }, ['compositionstart']);
  check((await log()).length === 0 && r.notPrevented, 'F2 Chrome 순서(조합 중 keydown 229·isComposing): 전송 없음·기본 동작 유지', JSON.stringify({ log: await log(), r })); await ctx.close();
}
{ // F2-b Safari 순서(229 제공)
  const { ctx, page, ta, log } = await fresh(); await ta.fill('한');
  await page.evaluate(() => { const el = document.querySelector('textarea'); el.focus(); el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' })); });
  const r = await ev(page, { isComposing: false, keyCode: 229 });
  check((await log()).length === 0 && r.notPrevented, 'F2 Safari 순서 + keyCode 229: 전송 없음·기본 동작 유지', JSON.stringify({ log: await log(), r })); await ctx.close();
}
{ // F2-c Safari 순서(229 미제공) — 확정 직후 Enter(keyCode 13)
  const { ctx, page, ta, log } = await fresh(); await ta.fill('한');
  await page.evaluate(() => { const el = document.querySelector('textarea'); el.focus(); el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' })); });
  const r = await ev(page, { isComposing: false, keyCode: 13 });
  check((await log()).length === 0 && !r.notPrevented && r.value === '한', 'F2 compositionend 직후 keyCode 13 Enter: 전송 없음·줄바꿈 없음(기본 동작 차단)', JSON.stringify({ log: await log(), r }));
  await page.waitForTimeout(120); const r2 = await ev(page, { isComposing: false, keyCode: 13 });
  check((await log()).length === 1 && (await log())[0] === 'send:"한"' && !r2.notPrevented, 'F2 보호 시간(50ms) 이후 Enter는 전송', JSON.stringify({ log: await log(), r2 })); await ctx.close();
}
{ // F2-d 조합 표시 고착 → blur로 해제
  const { ctx, page, ta, log } = await fresh(); await ta.fill('질문');
  await page.evaluate(() => { const el = document.querySelector('textarea'); el.focus(); el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); });
  const r = await ev(page, { isComposing: false, keyCode: 13 });
  check((await log()).length === 0 && r.notPrevented, 'F2 compositionend가 오지 않은 고착 상태: Enter가 전송되지 않음(재현)', JSON.stringify({ log: await log(), r }));
  await page.evaluate(() => { document.querySelector('textarea').blur(); }); await page.waitForTimeout(80);
  const r3 = await ev(page, { isComposing: false, keyCode: 13 });
  check((await log()).length === 1 && (await log())[0] === 'send:"질문"' && !r3.notPrevented, 'F2 blur 후 고착 해제: Enter 전송', JSON.stringify({ log: await log(), r3 })); await ctx.close();
}
{ // F2-e 실제 Chromium 조합(CDP): 조합 중 Enter → 전송 없음, 확정 후 보호 시간 지나면 전송
  const { ctx, page, ta, log, clear } = await fresh(); await ta.click(); const cdp = await ctx.newCDPSession(page);
  await page.evaluate(() => { window.__keys = []; document.addEventListener('keydown', e => window.__keys.push(`keydown:${e.key}:${e.keyCode}:${e.isComposing}`), true); document.addEventListener('compositionend', () => window.__keys.push('compositionend'), true); });
  await cdp.send('Input.imeSetComposition', { text: '하', selectionStart: 1, selectionEnd: 1 });
  await page.keyboard.press('Enter');
  check((await log()).length === 0, 'F2 CDP 실제 조합 중 Enter: 전송 없음', JSON.stringify({ log: await log(), keys: await page.evaluate(() => window.__keys) }));
  await page.evaluate(() => { document.querySelector('textarea').blur(); }); await page.waitForTimeout(80); await ta.click(); await clear();
  await cdp.send('Input.imeSetComposition', { text: '하', selectionStart: 1, selectionEnd: 1 }); await cdp.send('Input.insertText', { text: '하' }); await page.waitForTimeout(120);
  await page.keyboard.press('Enter');
  check((await log()).includes('send:"하"') || (await log()).some(x => x.startsWith('send:')), 'F2 CDP 정상 확정 후 보호 시간이 지난 Enter: 전송', JSON.stringify({ log: await log(), keys: await page.evaluate(() => window.__keys) })); await ctx.close();
}
await browser.close(); server.close();
const pass = results.filter(r => r.ok).length;
console.log(`\n== 보완 후 재현 결과: ${pass}/${results.length} 통과, 실패 ${fails.length} ==`);
for (const f of fails) console.log('FAIL', f);
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
