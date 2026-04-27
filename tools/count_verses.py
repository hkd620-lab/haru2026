import json, os

total = 0
for i in range(1, 51):
    path = os.path.expanduser(f'~/HARU2026/frontend/src/data/genesis_{i}.json')
    with open(path) as f:
        d = json.load(f)
        count = len(d['verses'])
        total += count
        print(f'{i}장: {count}절')

print(f'\n총 합계: {total}절')
