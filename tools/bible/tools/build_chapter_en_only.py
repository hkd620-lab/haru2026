#!/usr/bin/env python3
# Build final chapter text (EN-only) from tools/out_raw/{bookcode}_{chapter:03d}.txt
# Output format:
#   #BOOK=Genesis|BOOKCODE=gen|CHAPTER=1|VERSION=KJV|LANGPAIR=EN-KO|ARCHAIC=INLINE_PARENS
#   T|EN=Genesis 1|KO=창세기 1장
#   V|N=1|EN=...|KO=
#   ...
#
# KO is left blank for later fill (GPT or manual).
# Then you can run verify_chapter.py to ensure verse continuity.

import sys
from pathlib import Path
import re

LINE_RE = re.compile(r'^(\d+):(\d+)\s+(.*)$')

BOOKNAME_MAP = {
  "gen": ("Genesis", "창세기"),
  "exo": ("Exodus", "출애굽기"),
  "lev": ("Leviticus", "레위기"),
  "num": ("Numbers", "민수기"),
  "deu": ("Deuteronomy", "신명기"),
}

def die(msg: str) -> None:
  print(f"FAIL: {msg}")
  sys.exit(1)

def main():
  if len(sys.argv) < 3:
    print("Usage: python3 tools/build_chapter_en_only.py <bookcode> <chapterInt>")
    print("Example: python3 tools/build_chapter_en_only.py gen 1")
    sys.exit(2)

  bookcode = sys.argv[1].strip().lower()
  chapter = int(sys.argv[2])

  if bookcode not in BOOKNAME_MAP:
    die(f"Unknown bookcode '{bookcode}'. Add to BOOKNAME_MAP in this script.")

  book_en, book_ko = BOOKNAME_MAP[bookcode]

  in_path = Path(f"tools/out_raw/{bookcode}_{chapter:03d}.txt")
  if not in_path.exists():
    die(f"Input not found: {in_path}")

  lines = in_path.read_text(encoding="utf-8", errors="replace").splitlines()
  verses = []
  for ln in lines:
    m = LINE_RE.match(ln)
    if not m:
      die(f"Bad line format: {ln[:80]}")
    chap = int(m.group(1))
    v = int(m.group(2))
    txt = m.group(3).strip()
    if chap != chapter:
      die(f"Chapter mismatch in file: expected {chapter}, got {chap}")
    verses.append((v, txt))

  # Ensure verse list is non-empty and starts at 1
  if not verses:
    die("No verses parsed.")
  verses.sort(key=lambda x: x[0])
  if verses[0][0] != 1:
    die(f"First verse is {verses[0][0]} (expected 1).")

  out_dir = Path("tools/final_en_only")
  out_dir.mkdir(parents=True, exist_ok=True)
  out_file = out_dir / f"{bookcode}_{chapter:03d}.txt"

  header = f"#BOOK={book_en}|BOOKCODE={bookcode}|CHAPTER={chapter}|VERSION=KJV|LANGPAIR=EN-KO|ARCHAIC=INLINE_PARENS"
  title = f"T|EN={book_en} {chapter}|KO={book_ko} {chapter}장"

  with out_file.open("w", encoding="utf-8") as f:
    f.write(header + "\n")
    f.write(title + "\n")
    for v, txt in verses:
      f.write(f"V|N={v}|EN={txt}|KO=\n")

  print(f"PASS: wrote {out_file}")

if __name__ == "__main__":
  main()
