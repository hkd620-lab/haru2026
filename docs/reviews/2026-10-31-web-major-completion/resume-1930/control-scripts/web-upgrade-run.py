#!/usr/bin/env python3
"""web-upgrade 전용 실행기: Node22 PATH·최소 env·cwd를 자식에 주고 명령/결과 원문을 로그로 남긴다.

사용: python3 web-upgrade-run.py <로그이름> [--cwd frontend] [--env-build] -- 명령...
"""
import datetime
import os
import pathlib
import subprocess
import sys

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
LOGS = WORK / 'docs/reviews/2026-10-31-web-major-completion/logs'
NODE22 = '/opt/homebrew/opt/node@22/bin'
# 저장소 CI의 PR 더미값과 같은 형식의 더미 6값(.env는 읽지 않는다)
DUMMY = {
    'VITE_FIREBASE_API_KEY': 'haru-completion-dummy',
    'VITE_FIREBASE_AUTH_DOMAIN': 'dummy.firebaseapp.com',
    'VITE_FIREBASE_PROJECT_ID': 'dummy',
    'VITE_FIREBASE_STORAGE_BUCKET': 'dummy.firebasestorage.app',
    'VITE_FIREBASE_MESSAGING_SENDER_ID': '000000000000',
    'VITE_FIREBASE_APP_ID': '1:000000000000:web:dummy',
}
DUMMY_LIBRARY = {k.replace('VITE_FIREBASE', 'VITE_AI_LIBRARY_FIREBASE'): v for k, v in DUMMY.items()}

args = sys.argv[1:]
name = args.pop(0)
cwd = WORK
env = {
    'PATH': f'{NODE22}:/usr/bin:/bin',
    'HOME': os.environ['HOME'],
    'LANG': 'en_US.UTF-8',
    'NO_COLOR': '1',
    'CI': '1',
}
tail = 40
while args and args[0] != '--':
    flag = args.pop(0)
    if flag == '--cwd':
        cwd = WORK / args.pop(0)
    elif flag == '--env-build':
        env.update(DUMMY)
        env.update(DUMMY_LIBRARY)
    elif flag == '--tail':
        tail = int(args.pop(0))
    elif flag == '--setenv':
        key, value = args.pop(0).split('=', 1)
        env[key] = value
    else:
        raise SystemExit(f'unknown flag {flag}')
args.pop(0)

LOGS.mkdir(parents=True, exist_ok=True)
log = LOGS / f'{name}.log'
start = datetime.datetime.now().astimezone().isoformat(timespec='seconds')
with log.open('a', encoding='utf-8') as f:
    f.write(f'$ (cwd={cwd.relative_to(WORK) or "."}) {" ".join(args)}\n# start {start}\n')
    f.flush()
    r = subprocess.run(args, cwd=cwd, env=env, stdout=f, stderr=subprocess.STDOUT, text=True)
    end = datetime.datetime.now().astimezone().isoformat(timespec='seconds')
    f.write(f'\n# end {end} exit={r.returncode}\n\n')
lines = log.read_text(encoding='utf-8', errors='replace').splitlines()
print('\n'.join(lines[-tail:]))
print(f'[{name}] exit={r.returncode} log={log.relative_to(WORK)}')
sys.exit(r.returncode)
