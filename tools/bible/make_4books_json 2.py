import json
import os

output_dir = os.path.expanduser('~/HARU2026/frontend/src/data')
input_file = os.path.expanduser('~/HARU2026/tools/bible/tools/source/kjv/kjv_66.txt')

books = {
    'num': ('numbers', '민수기'),
    'deu': ('deuteronomy', '신명기'),
    'luk': ('luke', '누가복음'),
    'jhn': ('john', '요한복음'),
}

data = {code: {} for code in books}

with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        parts = line.strip().split('\t')
        if len(parts) != 3:
            continue
        book, ref, text = parts
        if book not in books:
            continue
        chapter, verse = ref.split(':')
        chapter = int(chapter)
        verse = int(verse)
        if chapter not in data[book]:
            data[book][chapter] = []
        data[book][chapter].append({'verse': verse, 'text': text})

for code, chapters in data.items():
    book_en, book_ko = books[code]
    for chapter, verses in chapters.items():
        output = {
            'book': book_en,
            'bookKo': book_ko,
            'chapter': chapter,
            'verses': verses
        }
        filename = f'{book_en}_{chapter}.json'
        path = os.path.join(output_dir, filename)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f'생성: {filename} ({len(verses)}절)')
    print(f'→ {book_ko} 완료 ({len(chapters)}장)\n')
