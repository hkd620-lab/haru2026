// 가상사용자 시뮬레이션 실행기
// 사용: node runner/run.mjs [페르소나 접두어 ...]   예) node runner/run.mjs p01 p08
// 결과: out/runs/<실행ID>/<페르소나>/{result.json, 스크린샷} 와 out/runs/<실행ID>/summary.json
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { startServer, launchBrowser, newPersonaSession, ensureDir, outRoot, harnessRoot } from './lib.mjs';
import { createContext } from './driver.mjs';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const personaDir = path.join(harnessRoot, 'personas');

let files = fs.readdirSync(personaDir).filter((f) => /^p\d+.*\.mjs$/.test(f)).sort();
if (only.length) files = files.filter((f) => only.some((o) => f.startsWith(o)));
if (!files.length) { console.error('실행할 페르소나가 없습니다.'); process.exit(1); }

const runDir = ensureDir(path.join(outRoot, 'runs', runId));
const server = await startServer();
const browser = await launchBrowser();
const results = [];

try {
  for (const f of files) {
    const { meta, run } = await import(pathToFileURL(path.join(personaDir, f)).href);
    const outDir = ensureDir(path.join(runDir, meta.id));
    console.log(`\n▶ ${meta.id} — ${meta.persona.name}(${meta.persona.age}·${meta.persona.gender}·${meta.persona.job}) / ${meta.format}`);
    const session = await newPersonaSession(browser, meta.identity);
    const ctx = createContext({ page: session.page, events: session.events, blocked: session.blocked, outDir, meta });
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    let crashed;
    try { await run(ctx); } catch (e) {
      crashed = String(e?.stack || e).split('\n').slice(0, 3).join(' | ');
      ctx.finding({ severity: '참고', title: '시나리오가 중간에 중단됨(하네스/스크립트 문제 가능)', detail: crashed });
    }
    const qa = await ctx.qa().catch(() => null);
    const db = await ctx.db().catch(() => []);
    const result = {
      runId, meta, startedAt, durationMs: Date.now() - t0, crashed,
      steps: ctx.steps, checks: ctx.checks, findings: ctx.findings,
      network: {
        blockedExternalCount: session.blocked.length,
        hosts: [...new Set(session.blocked.map((b) => { try { return new URL(b.url).hostname; } catch { return b.url; } }))],
      },
      console: session.events.console, pageErrors: session.events.pageErrors, dialogs: session.events.dialogs,
      qa: qa ? {
        calls: qa.calls.map((c) => ({ name: c.name, ok: c.ok, error: c.error })),
        unknownCallables: qa.unknownCallables, uploads: qa.uploads, writeCount: qa.writes.length,
      } : null,
      db,
    };
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 1));
    results.push(result);
    const failed = result.checks.filter((c) => !c.ok).length;
    console.log(`  단계 ${result.steps.length}개(실패 ${result.steps.filter((s) => !s.ok).length}) · 점검 ${result.checks.length}개(미충족 ${failed}) · 발견 ${result.findings.length}건 · ${(result.durationMs / 1000).toFixed(1)}초${crashed ? ' · 중단: ' + crashed : ''}`);
    await session.context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(results.map((r) => ({ id: r.meta.id, durationMs: r.durationMs, steps: r.steps.length, checks: r.checks.length, failedChecks: r.checks.filter((c) => !c.ok).length, findings: r.findings.length })), null, 1));
fs.writeFileSync(path.join(outRoot, 'latest-run.txt'), runId);
console.log(`\n결과 폴더: ${runDir}`);
