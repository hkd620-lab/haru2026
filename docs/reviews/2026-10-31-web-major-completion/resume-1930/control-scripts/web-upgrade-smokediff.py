"""스모크 JSON을 기준선과 경로별로 비교한다. 사용: python3 web-upgrade-smokediff.py <기준라벨> <대상라벨>"""
import json
import pathlib
import sys

ev = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/docs/reviews/2026-10-31-web-major-completion/smoke')
load = lambda n: {r['route']: r for r in json.loads((ev / f'{n}.json').read_text(encoding='utf-8'))['results']}
base, cur = load(sys.argv[1]), load(sys.argv[2])
same = 0
for route, a in base.items():
    b = cur[route]
    diff = {k: (a[k], b[k]) for k in ('href', 'title', 'rootChildren', 'text', 'textLength') if a[k] != b[k]}
    if diff:
        print('DIFF', route, diff)
    else:
        same += 1
print(f'{sys.argv[1]} vs {sys.argv[2]}: same {same}/{len(base)}')
print('base events', {r: v['events'] for r, v in base.items() if v['events']})
print('cur events', {r: v['events'] for r, v in cur.items() if v['events']})
