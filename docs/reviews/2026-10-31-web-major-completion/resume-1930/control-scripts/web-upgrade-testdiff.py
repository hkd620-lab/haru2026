"""시험 요약 JSON 두 개를 파일 단위로 비교한다. 사용: python3 web-upgrade-testdiff.py <기준라벨> <대상라벨>"""
import json
import pathlib
import sys

ev = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/docs/reviews/2026-10-31-web-major-completion/tests')
load = lambda label: json.loads((ev / f'{label}-summary.json').read_text(encoding='utf-8'))['files']
base, cur = load(sys.argv[1]), load(sys.argv[2])
keys = ('exit', 'tests', 'pass', 'fail', 'cancelled', 'skipped')
total = lambda s: {k: sum(v.get(k, 0) for v in s.values()) for k in keys[1:]}
print('base', len(base), total(base))
print('cur ', len(cur), total(cur))
print('only base', sorted(set(base) - set(cur)))
print('only cur', sorted(set(cur) - set(base)))
for name in sorted(set(base) & set(cur)):
    a, b = [{k: x.get(k) for k in keys} for x in (base[name], cur[name])]
    if a != b:
        print('DIFF', name, a, b)
print('failing cur', [k for k, v in cur.items() if v['exit']])
