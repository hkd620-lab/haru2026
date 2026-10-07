// 임시 탐색 도구 — 하네스를 띄우고 지정 경로를 열어 스크린샷·DOM 요약을 남긴다.
// 사용: node runner/explore.mjs [경로] [스크린샷 파일명]
import path from 'node:path';
import { startServer, launchBrowser, newPersonaSession, ensureDir, outRoot, BASE_URL, readQa } from './lib.mjs';

const route = process.argv[2] || '/';
const shot = process.argv[3] || 'explore.png';
const server = await startServer();
const browser = await launchBrowser();
try {
  const { page, blocked, events } = await newPersonaSession(browser, { uid: 'qa-explore', displayName: '탐색 사용자', email: 'explore@example.invalid', plan: 'free' });
  await page.goto(BASE_URL + route, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  ensureDir(outRoot);
  await page.screenshot({ path: path.join(outRoot, shot), fullPage: false });
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  console.log('BODY TEXT (first 900):\n' + (await page.evaluate(() => document.body.innerText)).slice(0, 900));
  console.log('CONSOLE:', JSON.stringify(events.console.slice(0, 12), null, 1));
  console.log('PAGE ERRORS:', JSON.stringify(events.pageErrors.slice(0, 8), null, 1));
  console.log('BLOCKED EXTERNAL:', blocked.length, JSON.stringify([...new Set(blocked.map((b) => new URL(b.url).hostname))]));
  console.log('QA:', JSON.stringify(await readQa(page)).slice(0, 600));
} finally {
  await browser.close();
  await server.close();
}
