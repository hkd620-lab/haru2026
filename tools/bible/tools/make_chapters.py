#!/usr/bin/env python3
# kjv_66.txt → assets/chapters/{book}_{chapter:03d}.txt 자동 변환
# 형식: gen\t1:1\t텍스트

from pathlib import Path
from collections import defaultdict

BOOK_INFO = {
    'gen':{'name':'Genesis','ko':'창세기'}, 'exo':{'name':'Exodus','ko':'출애굽기'},
    'lev':{'name':'Leviticus','ko':'레위기'}, 'num':{'name':'Numbers','ko':'민수기'},
    'deu':{'name':'Deuteronomy','ko':'신명기'}, 'jos':{'name':'Joshua','ko':'여호수아'},
    'jdg':{'name':'Judges','ko':'사사기'}, 'rut':{'name':'Ruth','ko':'룻기'},
    '1sa':{'name':'1 Samuel','ko':'사무엘상'}, '2sa':{'name':'2 Samuel','ko':'사무엘하'},
    '1ki':{'name':'1 Kings','ko':'열왕기상'}, '2ki':{'name':'2 Kings','ko':'열왕기하'},
    '1ch':{'name':'1 Chronicles','ko':'역대상'}, '2ch':{'name':'2 Chronicles','ko':'역대하'},
    'ezr':{'name':'Ezra','ko':'에스라'}, 'neh':{'name':'Nehemiah','ko':'느헤미야'},
    'est':{'name':'Esther','ko':'에스더'}, 'job':{'name':'Job','ko':'욥기'},
    'psa':{'name':'Psalms','ko':'시편'}, 'pro':{'name':'Proverbs','ko':'잠언'},
    'ecc':{'name':'Ecclesiastes','ko':'전도서'}, 'sng':{'name':'Song of Solomon','ko':'아가'},
    'isa':{'name':'Isaiah','ko':'이사야'}, 'jer':{'name':'Jeremiah','ko':'예레미야'},
    'lam':{'name':'Lamentations','ko':'예레미야애가'}, 'ezk':{'name':'Ezekiel','ko':'에스겔'},
    'dan':{'name':'Daniel','ko':'다니엘'}, 'hos':{'name':'Hosea','ko':'호세아'},
    'jol':{'name':'Joel','ko':'요엘'}, 'amo':{'name':'Amos','ko':'아모스'},
    'oba':{'name':'Obadiah','ko':'오바댜'}, 'jon':{'name':'Jonah','ko':'요나'},
    'mic':{'name':'Micah','ko':'미가'}, 'nah':{'name':'Nahum','ko':'나훔'},
    'hab':{'name':'Habakkuk','ko':'하박국'}, 'zep':{'name':'Zephaniah','ko':'스바냐'},
    'hag':{'name':'Haggai','ko':'학개'}, 'zec':{'name':'Zechariah','ko':'스가랴'},
    'mal':{'name':'Malachi','ko':'말라기'}, 'mat':{'name':'Matthew','ko':'마태복음'},
    'mrk':{'name':'Mark','ko':'마가복음'}, 'luk':{'name':'Luke','ko':'누가복음'},
    'jhn':{'name':'John','ko':'요한복음'}, 'act':{'name':'Acts','ko':'사도행전'},
    'rom':{'name':'Romans','ko':'로마서'}, '1co':{'name':'1 Corinthians','ko':'고린도전서'},
    '2co':{'name':'2 Corinthians','ko':'고린도후서'}, 'gal':{'name':'Galatians','ko':'갈라디아서'},
    'eph':{'name':'Ephesians','ko':'에베소서'}, 'php':{'name':'Philippians','ko':'빌립보서'},
    'col':{'name':'Colossians','ko':'골로새서'}, '1th':{'name':'1 Thessalonians','ko':'데살로니가전서'},
    '2th':{'name':'2 Thessalonians','ko':'데살로니가후서'}, '1ti':{'name':'1 Timothy','ko':'디모데전서'},
    '2ti':{'name':'2 Timothy','ko':'디모데후서'}, 'tit':{'name':'Titus','ko':'디도서'},
    'phm':{'name':'Philemon','ko':'빌레몬서'}, 'heb':{'name':'Hebrews','ko':'히브리서'},
    'jas':{'name':'James','ko':'야고보서'}, '1pe':{'name':'1 Peter','ko':'베드로전서'},
    '2pe':{'name':'2 Peter','ko':'베드로후서'}, '1jn':{'name':'1 John','ko':'요한일서'},
    '2jn':{'name':'2 John','ko':'요한이서'}, '3jn':{'name':'3 John','ko':'요한삼서'},
    'jud':{'name':'Jude','ko':'유다서'}, 'rev':{'name':'Revelation','ko':'요한계시록'},
}

src = Path('tools/source/kjv/kjv_66.txt')
out = Path('assets/chapters')
out.mkdir(parents=True, exist_ok=True)

# 데이터 로드
data = defaultdict(lambda: defaultdict(dict))
for line in src.read_text(encoding='utf-8').splitlines():
    parts = line.strip().split('\t')
    if len(parts) < 3:
        continue
    book = parts[0].lower()
    cv = parts[1]
    text = parts[2]
    if ':' not in cv:
        continue
    chap, verse = cv.split(':', 1)
    data[book][int(chap)][int(verse)] = text

# 파일 생성
total = 0
for book, chapters in data.items():
    info = BOOK_INFO.get(book)
    if not info:
        print(f'⚠️  알 수 없는 책코드: {book}')
        continue
    for chap_num, verses in sorted(chapters.items()):
        fname = out / f'{book}_{chap_num:03d}.txt'
        with fname.open('w', encoding='utf-8') as f:
            f.write(f'#BOOK={info["name"]}|BOOKCODE={book}|CHAPTER={chap_num}|VERSION=KJV|LANGPAIR=EN-KO|ARCHAIC=INLINE_PARENS\n')
            f.write(f'T|EN={info["name"]} {chap_num}|KO={info["ko"]} {chap_num}장\n')
            for v_num in sorted(verses.keys()):
                en = verses[v_num]
                f.write(f'V|N={v_num}|EN={en}|KO=\n')
        total += 1

print(f'✅ 완료! {total}개 챕터 파일 생성 → assets/chapters/')
