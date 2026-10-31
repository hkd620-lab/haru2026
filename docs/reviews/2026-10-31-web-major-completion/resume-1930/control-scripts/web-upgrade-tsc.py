"""미사용 구문오류 파일을 뺀 임시 tsconfig로 의미 검사를 돌려 오류를 정규화해 저장한다.

사용: python3 web-upgrade-tsc.py <라벨>
임시 tsconfig는 control에 두고 frontend는 건드리지 않는다.
"""
import json
import pathlib
import re
import subprocess
import sys

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
FE = WORK / 'frontend'
CTRL = pathlib.Path('/private/tmp/haru-completion-control-20261031')
label = sys.argv[1]
base = (WORK / 'docs/reviews/2026-10-31-web-major-completion/logs/03-baseline-tsc.log').read_text(encoding='utf-8')
broken = sorted(set(re.findall(r'^(src/[^(]+)\(\d+,\d+\): error TS1', base, re.M)))
cfg = CTRL / 'web-upgrade-tsconfig.json'
cfg.write_text(json.dumps(dict(
    extends=str(FE / 'tsconfig.json'),
    compilerOptions=dict(baseUrl=str(FE), paths={'@/*': [str(FE / 'src/*')]}, typeRoots=[str(FE / 'node_modules/@types')]),
    include=[str(FE / 'src')],
    exclude=[str(FE / b) for b in broken],
)), encoding='utf-8')
env = dict(PATH='/opt/homebrew/opt/node@22/bin:/usr/bin:/bin', HOME=str(pathlib.Path.home()), NO_COLOR='1')
r = subprocess.run(['npx', '--yes', '-p', 'typescript@5.9', 'tsc', '-p', str(cfg), '--noEmit', '--pretty', 'false'],
                   cwd=FE, env=env, capture_output=True, text=True)
out = r.stdout + r.stderr
norm = sorted(re.sub(r'\(\d+,\d+\)', '', line) for line in out.splitlines() if ' error TS' in line)
ev = WORK / 'docs/reviews/2026-10-31-web-major-completion/tsc'
ev.mkdir(parents=True, exist_ok=True)
(ev / f'{label}.txt').write_text(f'# excluded syntax-broken unused files: {broken}\n# exit={r.returncode}\n' + '\n'.join(norm) + '\n', encoding='utf-8')
codes = dict()
for line in norm:
    m = re.search(r'error (TS\d+)', line)
    codes[m.group(1)] = codes.get(m.group(1), 0) + 1
print(label, 'exit', r.returncode, 'errors', len(norm), 'excluded', broken)
print(sorted(codes.items(), key=lambda x: -x[1])[:15])
print(out[:400] if not norm else '')
