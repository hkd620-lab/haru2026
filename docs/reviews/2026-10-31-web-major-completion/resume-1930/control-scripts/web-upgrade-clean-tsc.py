"""main 커밋 a8a8a6b8의 frontend를 control에 풀어 깨끗한 tsc 기준값을 만든다.

worktree의 현재 node_modules(아직 baseline lock 상태)를 심볼릭 링크로 재사용한다.
"""
import io
import json
import pathlib
import re
import subprocess
import tarfile

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
CTRL = pathlib.Path('/private/tmp/haru-completion-control-20261031')
ROOT = CTRL / 'web-upgrade-clean-a8a8a6b8'
raw = subprocess.run(['git', 'archive', 'a8a8a6b8', 'frontend/src', 'frontend/tsconfig.json'], cwd=WORK, capture_output=True, check=True).stdout
ROOT.mkdir(exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(raw)) as t:
    t.extractall(ROOT, filter='data')
FE = ROOT / 'frontend'
link = FE / 'node_modules'
if not link.exists():
    link.symlink_to(WORK / 'frontend/node_modules')
cfg = FE / 'tsconfig.clean.json'
cfg.write_text(json.dumps(dict(extends='./tsconfig.json', exclude=['src/app/components/ExportModal.tsx'])), encoding='utf-8')
env = dict(PATH='/opt/homebrew/opt/node@22/bin:/usr/bin:/bin', HOME=str(pathlib.Path.home()), NO_COLOR='1')
r = subprocess.run(['npx', '--yes', '-p', 'typescript@5.9', 'tsc', '-p', str(cfg), '--noEmit', '--pretty', 'false'],
                   cwd=FE, env=env, capture_output=True, text=True)
out = r.stdout + r.stderr
norm = sorted(re.sub(r'\(\d+,\d+\)', '', line) for line in out.splitlines() if ' error TS' in line)
ev = WORK / 'docs/reviews/2026-10-31-web-major-completion/tsc'
(ev / 'baseline-clean-a8a8a6b8.txt').write_text(f'# clean git archive a8a8a6b8, excludes ExportModal.tsx (unused, syntax errors)\n# exit={r.returncode}\n' + '\n'.join(norm) + '\n', encoding='utf-8')
partial = [l for l in (ev / 'baseline.txt').read_text(encoding='utf-8').splitlines() if ' error TS' in l]
print('clean', len(norm), 'partial-swap', len(partial), 'same set', sorted(norm) == sorted(partial))
print('only clean', sorted(set(norm) - set(partial))[:10])
print('only partial', sorted(set(partial) - set(norm))[:10])
