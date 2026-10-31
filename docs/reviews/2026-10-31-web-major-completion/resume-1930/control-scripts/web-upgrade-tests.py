"""frontend 시험 파일을 파일 단위로 Node22에서 실행하고 파일별 pass/fail을 JSON·로그로 남긴다.

사용: python3 web-upgrade-tests.py <라벨>   (예: baseline, after)
emulator·브라우저 시험은 별도 서버가 필요해 제외하고 그 사실을 결과에 남긴다.
"""
import json
import pathlib
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
FE = WORK / 'frontend'
EVID = WORK / 'docs/reviews/2026-10-31-web-major-completion/tests'
label = sys.argv[1]
env = dict(PATH='/opt/homebrew/opt/node@22/bin:/usr/bin:/bin', HOME=str(pathlib.Path.home()), NO_COLOR='1', LANG='en_US.UTF-8')

files = sorted(p for p in (FE / 'test').glob('*.test.*') if p.suffix in ('.mjs', '.cjs'))
files += sorted((FE / 'tests').glob('*.test.mjs'))
excluded = [str(p.relative_to(FE)) for p in files if 'emulator' in p.name]
files = [p for p in files if 'emulator' not in p.name]


def run(p):
    rel = str(p.relative_to(FE))
    r = subprocess.run(['node', '--import', 'tsx', '--test', rel], cwd=FE, env=env,
                       capture_output=True, text=True, timeout=400)
    out = r.stdout + r.stderr
    nums = dict((k, int(v)) for k, v in re.findall(r'^[#ℹ] (tests|pass|fail|cancelled|skipped) (\d+)', out, re.M))
    failed = sorted(set(re.findall(r'^\s*✖ (.+?) \(\d', out, re.M)))
    return rel, r.returncode, nums, failed, out


EVID.mkdir(parents=True, exist_ok=True)
with ThreadPoolExecutor(6) as ex:
    results = list(ex.map(run, files))
summary = dict(label=label, excluded=excluded, files=dict())
with (EVID / f'{label}-full.log').open('w', encoding='utf-8') as log:
    for rel, code, nums, failed, out in results:
        summary['files'][rel] = dict(exit=code, **nums, failed=[f for f in failed if not f.endswith('.mjs') and not f.endswith('.cjs')])
        log.write(f'===== {rel} exit={code} {nums}\n')
        if code != 0:
            log.write(out[:6000] + '\n')
(EVID / f'{label}-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding='utf-8')
tot = dict(files=len(results), failing_files=0, tests=0, passed=0, failed=0)
for rel, code, nums, failed, out in results:
    tot['tests'] += nums.get('tests', 0)
    tot['passed'] += nums.get('pass', 0)
    tot['failed'] += nums.get('fail', 0)
    if code != 0:
        tot['failing_files'] += 1
        print('FAIL', rel, code, nums, failed[:6])
print(tot, 'excluded', excluded)
