"""origin/main a8a8a6b8의 frontend를 control 전용 폴더에 풀고 기준 lock으로 설치·빌드해 비교용 dist를 만든다.

worktree의 node_modules·dist는 건드리지 않는다. 더미 env만 쓰며 .env는 읽지 않는다.
"""
import io
import os
import pathlib
import subprocess
import tarfile

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
ROOT = pathlib.Path('/private/tmp/haru-completion-control-20261031/web-upgrade-baseline-build-a8a8a6b8')
LOG = WORK / 'docs/reviews/2026-10-31-web-major-completion/logs/52-baseline-dist-build.log'
DUMMY = {
    'VITE_FIREBASE_API_KEY': 'haru-completion-dummy',
    'VITE_FIREBASE_AUTH_DOMAIN': 'dummy.firebaseapp.com',
    'VITE_FIREBASE_PROJECT_ID': 'dummy',
    'VITE_FIREBASE_STORAGE_BUCKET': 'dummy.firebasestorage.app',
    'VITE_FIREBASE_MESSAGING_SENDER_ID': '000000000000',
    'VITE_FIREBASE_APP_ID': '1:000000000000:web:dummy',
}
DUMMY.update({k.replace('VITE_FIREBASE', 'VITE_AI_LIBRARY_FIREBASE'): v for k, v in list(DUMMY.items())})
env = dict(PATH='/opt/homebrew/opt/node@22/bin:/usr/bin:/bin', HOME=os.environ['HOME'], LANG='en_US.UTF-8', NO_COLOR='1', CI='1', **DUMMY)

raw = subprocess.run(['git', 'archive', 'a8a8a6b8', 'frontend'], cwd=WORK, capture_output=True, check=True).stdout
ROOT.mkdir(exist_ok=False)
with tarfile.open(fileobj=io.BytesIO(raw)) as t:
    t.extractall(ROOT, filter='data')
fe = ROOT / 'frontend'
with LOG.open('a', encoding='utf-8') as f:
    for cmd in (['node', '-v'], ['npm', 'ci', '--no-audit', '--no-fund'], ['npm', 'run', 'build']):
        f.write(f'$ (cwd=control/web-upgrade-baseline-build-a8a8a6b8/frontend) {" ".join(cmd)}\n')
        f.flush()
        r = subprocess.run(cmd, cwd=fe, env=env, stdout=f, stderr=subprocess.STDOUT, text=True)
        f.write(f'\n# exit={r.returncode}\n\n')
        f.flush()
        print(cmd, r.returncode)
        if r.returncode:
            raise SystemExit(r.returncode)
