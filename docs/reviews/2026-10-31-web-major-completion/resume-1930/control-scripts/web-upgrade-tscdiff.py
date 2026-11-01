"""tsc 정규화 결과를 깨끗한 기준값과 비교한다(경로 접두사 제거). 사용: python3 web-upgrade-tscdiff.py <라벨>"""
import pathlib
import re
import sys

ev = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/docs/reviews/2026-10-31-web-major-completion/tsc')


def load(name):
    lines = [l for l in (ev / f'{name}.txt').read_text(encoding='utf-8').splitlines() if ' error TS' in l]
    return sorted(re.sub(r'/private/tmp/[^"\']*?/frontend/', 'frontend/', l) for l in lines)


base, cur = load('baseline-clean-a8a8a6b8'), load(sys.argv[1])
print(sys.argv[1], len(cur), 'baseline', len(base), 'identical', base == cur)
print('new:', [l for l in cur if l not in base][:12])
print('gone:', [l for l in base if l not in cur][:12])
