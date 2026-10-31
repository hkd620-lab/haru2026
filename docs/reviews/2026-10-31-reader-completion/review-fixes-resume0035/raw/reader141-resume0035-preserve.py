#!/usr/bin/env python3
"""control 원문을 새 기록 폴더로 복사하고 해시 대조·비밀값 패턴 검사 결과를 남긴다. 기존 파일은 덮어쓰지 않는다."""
import datetime
import hashlib
import json
import os
import re
import shutil

CONTROL = '/private/tmp/haru-completion-control-20261031'
TARGET = '/private/tmp/haru-completion-reader141-20261031/docs/reviews/2026-10-31-reader-completion/review-fixes-resume0035/raw'
FILES = [
    'reader141-review-fixes-resume0035-prompt.txt',
    'reader141-review-fixes-prompt.txt',
    'reader141-review-fixes-result.json',
    'reader141-review-fixes-stderr.txt',
    'reader141-independent1-prompt.txt',
    'reader141-independent1-result.json',
    'reader141-independent1-stderr.txt',
    'reader141-retry-fix-prompt.txt',
    'reader141-retry-fix-result.json',
    'reader141-retry-fix-stderr.txt',
    'reader141-codex-review3-comments.json',
    'reader141-ci-fb710-details.json',
    'reader141-resume0035-run-logged.py',
    'reader141-resume0035-mutation-check.py',
    'reader141-resume0035-tsc-compare.py',
    'reader141-resume0035-tsconfig.json',
    'reader141-resume0035-preserve.py',
]
SECRET = re.compile(r'AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|users/[A-Za-z0-9]{20,}')


def digest(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


report = {'checked_at': datetime.datetime.now().astimezone().isoformat(), 'recorder': 'Claude Code (CC)', 'files': {}}
for name in FILES:
    source, copy = f'{CONTROL}/{name}', f'{TARGET}/{name}'
    if not os.path.exists(copy):
        shutil.copyfile(source, copy)
    matches = sorted(set(SECRET.findall(open(copy, encoding='utf-8', errors='replace').read())))
    report['files'][name] = {
        'sha256': digest(copy),
        'same_as_control': digest(source) == digest(copy),
        'bytes': os.path.getsize(copy),
        'secret_pattern_matches': matches,
    }
with open(f'{TARGET}/../source-hashes.json', 'w', encoding='utf-8') as out:
    json.dump(report, out, ensure_ascii=False, indent=2)
    out.write('\n')
print(all(v['same_as_control'] for v in report['files'].values()))
print({k: v['secret_pattern_matches'] for k, v in report['files'].items() if v['secret_pattern_matches']})
