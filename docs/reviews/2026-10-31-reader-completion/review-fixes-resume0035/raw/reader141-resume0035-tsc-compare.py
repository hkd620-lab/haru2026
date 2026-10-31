#!/usr/bin/env python3
"""tsc 로그에서 수정 전 사본과 수정본의 BiblePage 오류를 위치를 뺀 내용 기준으로 비교한다."""
import collections
import re
import sys

pattern = re.compile(r'pages/BiblePage(\.baseline-9b15)?\.tsx\((\d+),\d+\): (error TS\d+: .*)')
before, after = collections.Counter(), collections.Counter()
lines = {}
total = 0
for line in open(sys.argv[1], encoding='utf-8'):
    total += 'error TS' in line
    match = pattern.search(line)
    if match:
        (before if match.group(1) else after)[match.group(3)] += 1
        if not match.group(1):
            lines.setdefault(match.group(3), []).append(int(match.group(2)))
print(f'전체 오류 {total}, 수정 전 사본 {sum(before.values())}, 수정본 {sum(after.values())}')
print('수정본에만 있는 오류:')
for message, count in (after - before).items():
    print(f'  {count} {lines[message]} {message}')
print('수정 전에만 있는 오류:')
for message, count in (before - after).items():
    print(f'  {count} {message}')
print('수정본 오류 줄:', sorted(n for values in lines.values() for n in values))
