import json
import os

output_dir = os.path.expanduser('~/HARU2026/frontend/src/data')
input_file = os.path.expanduser('~/HARU2026/tools/bible/tools/source/kjv/kjv_66.txt')

chapters = {}
with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        parts = line.strip().split('\t')
        if len(parts) != 3:
            continue
        book, ref, text = parts
        if book != 'gen':
            continue
        chapter, verse = ref.split(':')
        chapter = int(chapter)
        verse = int(verse)
        if chapter not in chapters:
            chapters[chapter] = []
        chapters[chapter].append({'verse': verse, 'text': text})

for chapter, verses in chapters.items():
    if chapter <= 2:
        continue
    data = {
        'book': 'genesis',
        'bookKo': '창세기',
        'chapter': chapter,
        'verses': verses
    }
    output_path = os.path.join(output_dir, f'genesis_{chapter}.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'생성 완료: genesis_{chapter}.json ({len(verses)}절)')

print(f'\n총 {len([c for c in chapters if c > 2])}개 파일 생성 완료!')
