"""기준 커밋과 현재 lock의 패키지 버전 차이를 분류해 저장한다."""
import json
import pathlib
import subprocess

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
base = json.loads(subprocess.run(['git', 'show', 'a8a8a6b8:frontend/package-lock.json'], cwd=WORK, capture_output=True, text=True, check=True).stdout)['packages']
cur = json.loads((WORK / 'frontend/package-lock.json').read_text(encoding='utf-8'))['packages']
added = sorted(k for k in cur if k not in base)
removed = sorted(k for k in base if k not in cur)
changed = sorted(k for k in cur if k in base and k and cur[k].get('version') != base[k].get('version'))
runtime = [k for k in changed if not cur[k].get('dev')]
lines = ['# frontend lock diff a8a8a6b8..working', f'added {len(added)} removed {len(removed)} changed {len(changed)} (runtime {len(runtime)})', '', '## changed runtime']
lines += [f"{k} {base[k].get('version')} -> {cur[k].get('version')}" for k in runtime]
lines += ['', '## changed dev'] + [f"{k} {base[k].get('version')} -> {cur[k].get('version')}" for k in changed if cur[k].get('dev')]
lines += ['', '## added'] + [f"{k} {cur[k].get('version')}{' dev' if cur[k].get('dev') else ''}{' optional' if cur[k].get('optional') else ''}" for k in added]
lines += ['', '## removed'] + [f"{k} {base[k].get('version')}" for k in removed]
out = WORK / 'docs/reviews/2026-10-31-web-major-completion/lock-diff.txt'
out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(lines[1])
print('runtime changed:', [l for l in lines[lines.index('## changed runtime') + 1:lines.index('## changed dev') - 1]])
print('added non-dev:', [k for k in added if not cur[k].get('dev') and not cur[k].get('optional')])
