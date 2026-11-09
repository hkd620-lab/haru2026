// 두 tsc 로그의 진단을 "src/ 이후 경로 + 코드 + 메시지"로 정규화(줄·열 번호, 앞쪽 경로 제거)해 multiset으로 비교한다.
import fs from 'node:fs';

const [currentLog, baselineLog] = process.argv.slice(2);
function load(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const diags = [];
  for (const line of lines) {
    const m = line.match(/^(.*?)\((\d+),(\d+)\): (error TS\d+: .*)$/);
    if (!m) continue;
    const rel = m[1].replace(/^.*?frontend\//, '');
    // 메시지 안의 저장소 절대경로(worktree마다 다름)도 같은 자리표시로 바꾼다.
    const msg = m[4].replace(/\/private\/tmp\/(haru-iphone-push-repair-20261109|haru-complete-pending-20261109)\/frontend\//g, '<FRONTEND>/');
    diags.push({ file: rel, key: `${rel}: ${msg}` });
  }
  return diags;
}
function count(diags) {
  const map = new Map();
  for (const d of diags) map.set(d.key, (map.get(d.key) || 0) + 1);
  return map;
}
const cur = load(currentLog);
const base = load(baselineLog);
const cm = count(cur);
const bm = count(base);
const onlyCurrent = [];
const onlyBaseline = [];
for (const [k, n] of cm) { const b = bm.get(k) || 0; if (n > b) onlyCurrent.push(`${n - b}x ${k}`); }
for (const [k, n] of bm) { const c = cm.get(k) || 0; if (n > c) onlyBaseline.push(`${n - c}x ${k}`); }
const watched = [
  'src/app/services/pushDevice.ts',
  'src/app/services/notificationService.ts',
  'src/app/pages/SettingsPage.tsx',
];
const perWatched = Object.fromEntries(watched.map((f) => [f, {
  current: cur.filter((d) => d.file === f).map((d) => d.key),
  baseline: base.filter((d) => d.file === f).map((d) => d.key),
}]));
console.log(JSON.stringify({
  currentTotal: cur.length,
  baselineTotal: base.length,
  multisetEqual: onlyCurrent.length === 0 && onlyBaseline.length === 0,
  onlyCurrent,
  onlyBaseline,
  perWatched,
}, null, 2));
