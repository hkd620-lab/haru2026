// 사용: node <이 파일> <라벨> <명령> [인자...]
// 명령을 재시도 없이 1회 실행하고 stdout/stderr 원문과 종료코드를 같은 폴더에 남긴다.
// 환경변수는 그대로 상속하며 기록에는 값을 남기지 않는다.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [label, command, ...args] = process.argv.slice(2);
const outPath = suffix => path.join(__dirname, `${label}.${suffix}`);
const text = (cmd, cmdArgs) => spawnSync(cmd, cmdArgs, { encoding: 'utf8' }).stdout?.trim() ?? null;

const stdout = fs.openSync(outPath('stdout.log'), 'wx');
const stderr = fs.openSync(outPath('stderr.log'), 'wx');
const startedAt = new Date().toISOString();
const run = spawnSync(command, args, { stdio: ['ignore', stdout, stderr] });
const endedAt = new Date().toISOString();
fs.closeSync(stdout);
fs.closeSync(stderr);

fs.writeFileSync(outPath('meta.json'), `${JSON.stringify({
  command: [command, ...args].join(' '),
  cwd: process.cwd(),
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
