// 사용: node <이 파일> <라벨> <worktree 기준 cwd> <명령> [인자...]
// 명령을 재시도 없이 1회 실행하고 stdout/stderr 원문과 메타데이터를 같은 폴더에 남긴다. 기존 파일은 덮어쓰지 않는다.
// 기록하는 환경값은 없다. 명령행에 들어가는 값은 합성 더미뿐이다.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const WORKTREE = '/private/tmp/haru-completion-joint-20261101';
const [label, relativeCwd, command, ...args] = process.argv.slice(2);
const cwd = path.join(WORKTREE, relativeCwd);
const outPath = suffix => path.join(__dirname, `${label}.${suffix}`);
const text = (cmd, cmdArgs) => spawnSync(cmd, cmdArgs, { cwd: WORKTREE, encoding: 'utf8' }).stdout?.trim() ?? null;

const stdout = fs.openSync(outPath('stdout.log'), 'wx');
const stderr = fs.openSync(outPath('stderr.log'), 'wx');
const startedAt = new Date().toISOString();
const run = spawnSync(command, args, { cwd, stdio: ['ignore', stdout, stderr] });
const endedAt = new Date().toISOString();
fs.closeSync(stdout);
fs.closeSync(stderr);

fs.writeFileSync(outPath('meta.json'), `${JSON.stringify({
  actor: 'CC executor (Claude Code)',
  label,
  command: [command, ...args].join(' '),
  cwd,
  head: text('git', ['rev-parse', 'HEAD']),
  startedAt,
  endedAt,
  exitCode: run.status,
  signal: run.signal,
  spawnError: run.error ? String(run.error) : null,
  node: process.version,
  npm: text('npm', ['-v']),
  platform: process.platform,
  arch: process.arch,
  osRelease: text('uname', ['-r']),
}, null, 2)}\n`, { flag: 'wx' });
process.exitCode = run.status ?? 1;
