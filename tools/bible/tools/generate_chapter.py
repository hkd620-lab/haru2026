#!/usr/bin/env python3
"""
Generate ONE chapter file in the strict format and immediately verify it.

Policy (recommended):
- Output: EN (KJV) only for now. KO left empty.
- One chapter at a time.
- Always run verifier right after generation.

Source (canonical):
- tools/source/kjv/kjv_66.txt
  Format per line:
    <bookcode>\t<chapter>:<verse>\t<EN text>
  Example:
    pro\t4:27<TAB>Turn not to the right hand...
"""
import sys
from pathlib import Path
import subprocess
import re

# bookcode -> canonical English book name
BOOK_NAME_MAP = {
  "gen": "Genesis",
  "exo": "Exodus",
  "lev": "Leviticus",
  "num": "Numbers",
  "deu": "Deuteronomy",
  "jos": "Joshua",
  "jdg": "Judges",
  "rut": "Ruth",
  "1sa": "1 Samuel",
  "2sa": "2 Samuel",
  "1ki": "1 Kings",
  "2ki": "2 Kings",
  "1ch": "1 Chronicles",
  "2ch": "2 Chronicles",
  "ezr": "Ezra",
  "neh": "Nehemiah",
  "est": "Esther",
  "job": "Job",
  "psa": "Psalms",
  "pro": "Proverbs",
  "ecc": "Ecclesiastes",
  "sng": "Song of Solomon",
  "isa": "Isaiah",
  "jer": "Jeremiah",
  "lam": "Lamentations",
  "ezk": "Ezekiel",
  "dan": "Daniel",
  "hos": "Hosea",
  "jol": "Joel",
  "amo": "Amos",
  "oba": "Obadiah",
  "jon": "Jonah",
  "mic": "Micah",
  "nah": "Nahum",
  "hab": "Habakkuk",
  "zep": "Zephaniah",
  "hag": "Haggai",
  "zec": "Zechariah",
  "mal": "Malachi",
  "mat": "Matthew",
  "mrk": "Mark",
  "luk": "Luke",
  "jhn": "John",
  "act": "Acts",
  "rom": "Romans",
  "1co": "1 Corinthians",
  "2co": "2 Corinthians",
  "gal": "Galatians",
  "eph": "Ephesians",
  "php": "Philippians",
  "col": "Colossians",
  "1th": "1 Thessalonians",
  "2th": "2 Thessalonians",
  "1ti": "1 Timothy",
  "2ti": "2 Timothy",
  "tit": "Titus",
  "phm": "Philemon",
  "heb": "Hebrews",
  "jas": "James",
  "1pe": "1 Peter",
  "2pe": "2 Peter",
  "1jn": "1 John",
  "2jn": "2 John",
  "3jn": "3 John",
  "jud": "Jude",
  "rev": "Revelation",
}

# kjv_66 format: book \t chap:verse \t text
LINE_RE = re.compile(r"^([a-z0-9]+)\t([0-9]+):([0-9]+)\t(.*)$")

def usage_exit(code: int = 0) -> None:
  print("Usage: python3 tools/generate_chapter.py <bookcode> <chapter_int>")
  print("Example: python3 tools/generate_chapter.py pro 5")
  print("Source : tools/source/kjv/kjv_66.txt  (bookcode<TAB>chap:verse<TAB>EN)")
  sys.exit(code)

def load_chapter_verses(bookcode: str, chapter: int) -> list[tuple[int, str]]:
  src_path = Path("tools/source/kjv/kjv_66.txt")
  if not src_path.exists():
    print(f"FAIL: missing source file: {src_path}")
    sys.exit(1)

  verses: list[tuple[int, str]] = []
  for ln in src_path.read_text(encoding="utf-8").splitlines():
    m = LINE_RE.match(ln)
    if not m:
      continue
    b = m.group(1)
    chap = int(m.group(2))
    vno  = int(m.group(3))
    en   = m.group(4)

    if b == bookcode and chap == chapter:
      verses.append((vno, en))

  verses.sort(key=lambda x: x[0])
  return verses

def ensure_contiguous(verses: list[tuple[int, str]]) -> None:
  if not verses:
    print("FAIL: no verses found for requested chapter in source.")
    sys.exit(1)
  nums = [v for v, _ in verses]
  if nums[0] != 1:
    print(f"FAIL: first verse is {nums[0]} (expected 1)")
    sys.exit(1)
  for i in range(1, len(nums)):
    if nums[i] != nums[i-1] + 1:
      print(f"FAIL: verse gap or disorder at {nums[i-1]} -> {nums[i]}")
      sys.exit(1)

def out_filename(book_name: str, bookcode: str, chapter: int) -> str:
  # Keep previous style for Proverbs (proverbs_004.txt), but ensure uniqueness for all books.
  # e.g. "Genesis" -> "genesis_001.txt"
  safe = book_name.lower().replace(" ", "")
  return f"{safe}_{chapter:03d}.txt"

def main() -> None:
  args = sys.argv[1:]
  if len(args) != 2 or args[0] in ("-h", "--help"):
    usage_exit(0)

  bookcode = args[0].strip().lower()
  try:
    chapter = int(args[1])
  except ValueError:
    print("FAIL: chapter must be an integer")
    sys.exit(1)

  book_name = BOOK_NAME_MAP.get(bookcode)
  if not book_name:
    print(f"FAIL: unknown bookcode: {bookcode}")
    sys.exit(1)

  verses = load_chapter_verses(bookcode, chapter)
  ensure_contiguous(verses)

  out_dir = Path("tools/inbox")
  out_dir.mkdir(parents=True, exist_ok=True)
  out_path = out_dir / out_filename(book_name, bookcode, chapter)

  lines: list[str] = []
  lines.append(f"#BOOK={book_name}|BOOKCODE={bookcode}|CHAPTER={chapter}|VERSION=KJV|LANGPAIR=EN-KO|ARCHAIC=INLINE_PARENS")
  lines.append(f"T|EN={book_name} {chapter}|KO=")

  for vno, en in verses:
    lines.append(f"V|N={vno}|EN={en}|KO=")

  out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
  print(f"OK: wrote {out_path} verses={len(verses)}")

  # verify immediately
  cmd = ["python3", "tools/verify_chapter.py", str(out_path)]
  r = subprocess.run(cmd, text=True)
  sys.exit(r.returncode)

if __name__ == "__main__":
  main()
