"""파일을 명시 나열해 stage하고 cached 목록을 확인한 뒤 커밋한다. add -A는 쓰지 않는다.

사용: python3 web-upgrade-commit.py <메시지파일> <파일목록파일>  (목록이 'TRACKED:frontend' 면 추적중 변경 파일을 개별 나열)
"""
import pathlib
import subprocess
import sys

WORK = '/private/tmp/haru-completion-web-upgrade-20261031'
msg, listing = sys.argv[1], sys.argv[2]


def git(*args, check=True):
    return subprocess.run(['git', *args], cwd=WORK, check=check, capture_output=True, text=True, encoding='utf-8').stdout


if listing.startswith('TRACKED:'):
    files = git('-c', 'core.quotepath=false', 'diff', '--name-only', '--', listing.split(':', 1)[1]).split('\n')
else:
    files = pathlib.Path(listing).read_text(encoding='utf-8').split('\n')
files = [f for f in files if f.strip()]
banned = ('routes.tsx', 'HaruRawPage.tsx', 'AGENTS.md', 'CLAUDE.md', 'firestore.rules', 'storage.rules', 'docs/HARU2026_Slack_운영정책.md')
bad = [f for f in files if f.endswith(banned) or f.startswith('mobile/') or '.zombie' in f or f.endswith('.env')]
if bad:
    raise SystemExit(f'banned path staged: {bad}')
git('add', '--', *files)
cached = git('-c', 'core.quotepath=false', 'diff', '--cached', '--name-only').split()
print('cached', len(cached))
print('\n'.join(cached[:12]), '...' if len(cached) > 12 else '')
print(git('diff', '--cached', '--check', check=False)[:800])
r = subprocess.run(['git', 'commit', '-F', msg], cwd=WORK, capture_output=True, text=True)
print(r.stdout[-400:], r.stderr[-400:])
sys.exit(r.returncode)
