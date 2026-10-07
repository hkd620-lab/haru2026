// 실행 결과(out/runs/<실행ID>)를 읽어 사람이 보는 보고서(Markdown)를 만든다.
// 사용: node runner/report.mjs [실행ID] [--name 폴더이름] [--cost "비용 메모"]
//       결과: reports/<폴더이름>/report.md, report.json, img/*.png(발견 증거 캡처만)
import fs from 'node:fs';
import path from 'node:path';
import { outRoot, harnessRoot, ensureDir } from './lib.mjs';
import { SEVERITY } from './driver.mjs';

const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const runId = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) || fs.readFileSync(path.join(outRoot, 'latest-run.txt'), 'utf8').trim();
const name = argVal('--name') || `${runId.slice(0, 10)}-pilot`;
const costFile = argVal('--cost-file');
const costNote = costFile ? fs.readFileSync(costFile, 'utf8') : (argVal('--cost') || '');
const introFile = argVal('--intro-file');
const introNote = introFile ? fs.readFileSync(introFile, 'utf8') : '';
const title = argVal('--title') || `가상사용자 시뮬레이션 결과 보고 — ${name}`;
const runDir = path.join(outRoot, 'runs', runId);
const reportDir = ensureDir(path.join(harnessRoot, 'reports', name));
const imgDir = ensureDir(path.join(reportDir, 'img'));

const results = fs.readdirSync(runDir)
  .filter((d) => fs.existsSync(path.join(runDir, d, 'result.json')))
  .sort()
  .map((d) => JSON.parse(fs.readFileSync(path.join(runDir, d, 'result.json'), 'utf8')));

const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
const sec = (ms) => `${(ms / 1000).toFixed(1)}초`;
const sevRank = (s) => { const i = SEVERITY.indexOf(s); return i < 0 ? 99 : i; };

// ── 발견 종합 ──
// 같은 문제를 여러 인물·단계에서 따로 기록한 경우(점검 이름이 곧 발견 제목이 되는 경우 등)는 하나로 합친다.
const CANONICAL = [
  { re: /모의 AI 표시·통계 저장|AI 다듬기 1회에 서버가 Gemini를 3번/, title: 'AI 다듬기로 저장해도 다듬음 표시(polished)·통계(stats)가 기록에 남지 않는다 — 서버는 한 번에 Gemini를 3번 호출한다 (비용 확인 권장)' },
  { re: /사용자 입력 제목 보존|가계부에서 직접 입력한 제목이 저장되지 않고/, title: '가계부에서 직접 입력한 제목이 저장되지 않고 자동 제목으로 바뀐다' },
];
const canonicalTitle = (t) => CANONICAL.find((c) => c.re.test(t))?.title || t;

const perPersona = [];
for (const r of results) {
  const merged = new Map();
  for (const f of r.findings) {
    const key = canonicalTitle(f.title);
    if (!merged.has(key)) merged.set(key, { ...f, title: key, personaId: r.meta.id, personaName: r.meta.persona.name, format: r.meta.format, steps: [f.step] });
    else {
      const g = merged.get(key);
      g.steps.push(f.step);
      if (sevRank(f.severity) < sevRank(g.severity)) g.severity = f.severity;
      if ((f.detail || '').length > (g.detail || '').length) { g.detail = f.detail; g.shot = f.shot || g.shot; }
    }
  }
  for (const f of merged.values()) {
    if (f.steps.length > 1) f.detail = `${f.detail} (같은 인물에서 ${f.steps.length}회 재현: ${[...new Set(f.steps)].slice(0, 3).join(' / ')}${f.steps.length > 3 ? ' …' : ''})`;
    perPersona.push(f);
  }
}
const byTitle = new Map();
for (const f of perPersona) {
  const g = byTitle.get(f.title);
  if (!g) byTitle.set(f.title, { ...f, who: [{ id: f.personaId, name: f.personaName, format: f.format }] });
  else {
    g.who.push({ id: f.personaId, name: f.personaName, format: f.format });
    if (sevRank(f.severity) < sevRank(g.severity)) g.severity = f.severity;
    if ((f.detail || '').length > (g.detail || '').length) { g.detail = f.detail; g.shot = f.shot; g.personaId = f.personaId; g.step = f.step; }
  }
}
const all = [...byTitle.values()];
all.forEach((f) => { f.personaName = f.who.map((w) => w.name).join('·'); f.format = [...new Set(f.who.map((w) => w.format))].join('·'); });
all.sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || a.personaId.localeCompare(b.personaId));
all.forEach((f, i) => { f.id = `F-${String(i + 1).padStart(2, '0')}`; });

const copied = new Set();
const evidence = (f) => {
  if (!f.shot) return '';
  const src = path.join(runDir, f.personaId, f.shot);
  if (!fs.existsSync(src)) return '';
  const destName = `${f.id}.png`; // 영문 이름으로 복사(한글 파일명은 git 경로가 인용되어 다루기 불편)
  fs.copyFileSync(src, path.join(imgDir, destName)); copied.add(destName);
  return `img/${destName}`;
};
all.forEach((f) => { f.img = evidence(f); });

const countBy = (sev) => all.filter((f) => f.severity === sev).length;
const lines = [];
const push = (...l) => lines.push(...l);

const totalMs = results.reduce((a, r) => a + r.durationMs, 0);
const totalChecks = results.reduce((a, r) => a + r.checks.length, 0);
const failedChecks = results.reduce((a, r) => a + r.checks.filter((c) => !c.ok).length, 0);

push(`# ${title}`, '');
push(`- 실행 ID: \`${runId}\` · 대상: 가상인물 ${results.length}명 · 방식: **A단계(격리 검증)** — 실제 앱 화면을 모바일 브라우저로 조작하고 Firebase·AI만 모의 (운영 DB·AI·서버 접속 0건)`);
push(`- 점검 ${totalChecks}개 중 ${totalChecks - failedChecks}개 충족, ${failedChecks}개 미충족 · 발견 ${all.length}건(치명 ${countBy('치명')} / 중대 ${countBy('중대')} / 경미 ${countBy('경미')} / 제안 ${countBy('제안')} / 참고 ${countBy('참고')}) · 실행 시간 합계 ${sec(totalMs)}`, '');

if (introNote) push('## 작성 경위', '', introNote, '');
const top = all.filter((f) => f.severity === '치명' || f.severity === '중대');
push('## 먼저 볼 것', '');
if (top.length) {
  push('실제 사용자가 마주치면 결과가 틀리게 보이거나 신뢰를 해칠 수 있는 항목입니다(근거 화면·코드 위치는 2절).', '');
  for (const f of top) push(`- **${f.id}** [${f.severity}] ${f.title}`);
} else push('치명·중대 발견 없음.');
push('');
push('## 1. 인물별 요약', '');
push('| 인물 | 형식 | 나이·성별·직업 | 단계(실패) | 점검 충족/전체 | 발견 | 소요 |', '|---|---|---|---|---|---|---|');
for (const r of results) {
  const p = r.meta.persona;
  const okChecks = r.checks.filter((c) => c.ok).length;
  push(`| ${cell(p.name)} | ${cell(r.meta.format)} | ${p.age}세·${p.gender}·${cell(p.job)} | ${r.steps.length}(${r.steps.filter((s) => !s.ok).length}) | ${okChecks}/${r.checks.length} | ${r.findings.length} | ${sec(r.durationMs)} |`);
}
push('');

push('## 2. 발견 사항 종합', '');
push('| ID | 심각도 | 제목 | 형식·인물 |', '|---|---|---|---|');
for (const f of all) push(`| ${f.id} | ${f.severity} | ${cell(f.title)} | ${cell(f.format)} / ${cell(f.personaName)} |`);
push('');
push('> 심각도: **치명**(데이터 손실·저장 실패) / **중대**(결과가 틀리게 보이거나 흐름이 막힘) / **경미**(불편·일관성) / **제안**(개선 아이디어·비용 확인) / **참고**(맥락 정보)', '');
for (const f of all) {
  push(`### ${f.id} [${f.severity}] ${f.title}`, '');
  push(`- 재현 인물: ${f.who.map((w) => `${w.name}(${w.format})`).join(', ')} · 대표 단계: ${f.step}`);
  push(`- 내용: ${f.detail}`);
  if (f.img) push(`- 증거 화면: ![${f.id}](${f.img})`);
  push('');
}

push('## 3. 인물별 상세', '');
for (const r of results) {
  const p = r.meta.persona;
  push(`### ${p.name} — ${r.meta.format}`, '');
  push('| 항목 | 내용 |', '|---|---|');
  push(`| 나이·성별 | ${p.age}세 · ${p.gender} |`, `| 직업 | ${cell(p.job)} |`, `| 기기 | ${cell(p.device)} |`, `| IT 숙련도 | ${cell(p.itLevel)} |`, `| 요금제 | ${cell(p.plan)} |`, `| 사용 목적 | ${cell(p.goal)} |`, '');
  push('**시나리오**', '');
  r.meta.scenario.forEach((s, i) => push(`${i + 1}. ${s}`));
  push('');
  push('**실행 단계**', '', '| # | 단계 | 결과 | 소요 | 화면에 뜬 안내 |', '|---|---|---|---|---|');
  for (const s of r.steps) {
    push(`| ${s.n} | ${cell(s.name)} | ${s.ok ? '완료' : `실패: ${cell(s.error)}`} | ${(s.ms / 1000).toFixed(1)}초 | ${cell((s.toasts || []).join(' / ')).slice(0, 110)} |`);
  }
  push('');
  const unmet = r.checks.filter((c) => !c.ok);
  push(`**점검 결과** — 충족 ${r.checks.length - unmet.length} / 전체 ${r.checks.length}`, '');
  if (unmet.length) {
    push('| 미충족 점검 | 근거 |', '|---|---|');
    for (const c of unmet) push(`| ${cell(c.name)} | ${cell(c.detail).slice(0, 260)} |`);
  } else push('미충족 점검 없음.');
  push('');
  const calls = (r.qa?.calls || []).reduce((a, c) => { a[c.name] = (a[c.name] || 0) + 1; return a; }, {});
  push('**호출·저장 요약**', '');
  push(`- 모의 서버 함수 호출: ${Object.keys(calls).length ? Object.entries(calls).map(([k, v]) => `${k} ${v}회`).join(', ') : '없음'}`);
  push(`- 저장된 기록 문서: ${r.db.filter(([p]) => /\/records\/[^/]+$/.test(p)).length}건 · 사진 업로드 ${r.qa?.uploads?.length ?? 0}건`);
  push(`- 외부 요청 차단 ${r.network.blockedExternalCount}건 · 모의되지 않은 함수 ${r.qa?.unknownCallables?.length ? r.qa.unknownCallables.join(', ') : '없음'} · 콘솔 오류 ${r.console.length}건 · 페이지 오류 ${r.pageErrors.length}건`);
  push('');
}

push('## 4. 격리·안전 확인', '');
const hosts = [...new Set(results.flatMap((r) => r.network.hosts))];
push(`- 운영 Firebase·AI·결제 서버로 나간 요청: **0건** (하네스 서버 밖으로 향한 요청은 모두 차단·집계했고 ${hosts.length ? `차단된 호스트: ${hosts.join(', ')}` : '차단 기록 자체가 없음'})`);
push(`- 저장은 브라우저 메모리(+localStorage)에만 남고 인물마다 별도 저장소를 쓴다. 운영 데이터를 읽거나 쓰지 않는다.`);
push(`- AI 응답(다듬기·제목 등)은 모의값이라 **AI 결과의 품질은 이 보고서에서 평가하지 않았다.**`, '');

push('## 5. 이 시뮬레이션으로 알 수 없는 것', '');
push('- AI 가 만든 글의 품질(원문 보존, 사실 추가, 마크다운 혼입 등) — 운영 서버 대상 C단계가 필요하다.');
push('- 실제 아이폰 Safari 고유 문제 — Chromium 모바일 에뮬레이션(390×844)이며 글꼴도 Noto Sans KR 로 대체되어 줄바꿈 위치가 실기기와 다를 수 있다.');
push('- 사람의 취향·구독 의사 — 가상인물은 실제 사용자보다 협조적이다. 실제 사용자 테스트를 병행해야 한다.');
push('- 소셜 로그인·결제·푸시 알림·외부 조회(법제처·온비드 등) — 이 하네스의 범위가 아니다.', '');

push('## 6. 시간·비용', '');
push('| 인물 | 실행 시간 |', '|---|---|');
for (const r of results) push(`| ${cell(r.meta.persona.name)}(${cell(r.meta.format)}) | ${sec(r.durationMs)} |`);
push(`| 합계 | ${sec(totalMs)} |`, '');
if (costNote) push(costNote, '');

push('## 7. 다음 단계', '');
push('1. 위 발견 사항 중 어떤 것을 수정할지 결정한다(이 보고서는 앱 코드를 바꾸지 않았다).');
push('2. 형식·비서별 가상인물을 같은 방식으로 늘린다(2안 22명 중 나머지).');
push('3. AI 결과 품질·외부 조회가 필요한 항목은 운영 서버 대상 C단계로 따로 진행한다(비용·운영 데이터 사용이라 대표 승인 필요).', '');

push('## 8. 다시 실행하는 방법', '');
push('```bash', 'cd frontend/test/persona-sim', 'npm install            # 최초 1회 (playwright-core, 글꼴)', 'node runner/run.mjs    # 모든 인물 실행 (예: node runner/run.mjs p01 p13)', 'node runner/report.mjs # 최근 실행 결과로 이 보고서 다시 만들기', '```', '');
push('> 실행 결과 원본(스크린샷·result.json)은 `out/runs/<실행ID>/` 에 남고 git 에는 올리지 않는다. 이 보고서에는 발견 증거 캡처만 `img/` 로 복사한다.');

fs.writeFileSync(path.join(reportDir, 'report.md'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify({ runId, findings: all.map(({ id, severity, title, detail, personaId, format, step, img }) => ({ id, severity, title, detail, personaId, format, step, img })) }, null, 1));
console.log(`보고서: ${path.join(reportDir, 'report.md')}`);
console.log(`발견 ${all.length}건 · 증거 이미지 ${copied.size}장`);
