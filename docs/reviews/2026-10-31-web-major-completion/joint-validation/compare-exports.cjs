// 사용: node <이 파일>
// 24-exports 실제 컴파일 목록을 기존 기준선 3종과 이름 집합으로 비교한다. 소스 정규식은 쓰지 않는다.
const fs = require('node:fs');
const path = require('node:path');

const WORKTREE = '/private/tmp/haru-completion-joint-20261101';
const reviews = path.join(WORKTREE, 'docs/reviews/2026-10-31-sharp-completion/logs-node22');
const names = file => fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(line => /^[A-Za-z_$][\w$]*$/.test(line)).sort();

const current = names(path.join(__dirname, '24-exports.stdout.log'));
const baselines = {
  'sharp-node22-baseline(a8a8a6b8)': names(path.join(reviews, 'baseline/exports.txt')),
  'sharp-node22-candidate': names(path.join(reviews, 'candidate/exports.txt')),
  'reader141-parent-exports-check': JSON.parse(fs.readFileSync(path.join(__dirname, '../reader141-parent-exports-check.json'), 'utf8')).exports.slice().sort(),
};

const result = { actor: 'CC executor (Claude Code)', currentCount: current.length, currentUnique: new Set(current).size, comparisons: {}, exports: current };
for (const [label, list] of Object.entries(baselines)) {
  result.comparisons[label] = {
    baselineCount: list.length,
    added: current.filter(name => !list.includes(name)),
    removed: list.filter(name => !current.includes(name)),
  };
}
fs.writeFileSync(path.join(__dirname, 'exports-diff.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ ...result, exports: undefined }, null, 2));
