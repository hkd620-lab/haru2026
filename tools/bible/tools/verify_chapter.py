#!/usr/bin/env python3
import sys, re, os
from dataclasses import dataclass
from typing import List, Optional, Tuple

HEADER_RE = re.compile(r"^#BOOK=([^|]+)\|BOOKCODE=([a-z0-9_]+)\|CHAPTER=([0-9]+)\|VERSION=KJV\|LANGPAIR=EN-KO\|ARCHAIC=INLINE_PARENS$")
TITLE_RE  = re.compile(r"^T\|EN=(.*)\|KO=(.*)$")
VERSE_RE  = re.compile(r"^V\|N=([0-9]+)\|EN=(.*)\|KO=(.*)$")

USAGE = """Usage:
  python3 tools/verify_chapter.py <chapter_file_path>
  cat <chapter_file_path> | python3 tools/verify_chapter.py -
Options:
  -h, --help    Show this help
Notes:
  - Input must contain NO blank lines.
  - Header line must match exact required format.
  - Policy: EN is required; KO may be empty at this stage.
"""

@dataclass
class Verse:
  n: int
  en: str
  ko: str
  line_no: int

def fail(msg: str) -> None:
  print(f"FAIL: {msg}")
  sys.exit(1)

def warn(msg: str) -> None:
  print(f"WARN: {msg}")

def ok(msg: str) -> None:
  print(f"OK: {msg}")

def usage_exit(code: int = 0) -> None:
  print(USAGE.rstrip("\n"))
  sys.exit(code)

def read_text(path: Optional[str]) -> str:
  if path is None or path == "-":
    return sys.stdin.read()
  if not os.path.exists(path):
    fail(f"file not found: {path}")
  with open(path, "r", encoding="utf-8") as f:
    return f.read()

def split_lines_strict(text: str) -> List[str]:
  lines = text.splitlines()
  for i, ln in enumerate(lines, start=1):
    if ln.strip() == "":
      raise ValueError(f"Blank line detected at line {i}. No blank lines allowed.")
  return lines

def validate_header(line: str) -> Tuple[str, str, int]:
  if " " in line or "\t" in line:
    fail("Header contains whitespace. Header must have no spaces/tabs.")
  m = HEADER_RE.match(line)
  if not m:
    fail("Header format mismatch. Must match exact required header keys/order.")
  return m.group(1), m.group(2), int(m.group(3))

def validate_title(line: str) -> Tuple[str, str]:
  m = TITLE_RE.match(line)
  if not m:
    fail("Title line format mismatch. Must be: T|EN=...|KO=...")
  return m.group(1), m.group(2)

def validate_verse(line: str, line_no: int) -> Verse:
  m = VERSE_RE.match(line)
  if not m:
    fail(f"Verse line format mismatch at line {line_no}. Must be: V|N=..|EN=..|KO=..")

  n = int(m.group(1))
  en = m.group(2)
  ko = m.group(3)

  pipe_count = line.count("|")
  if pipe_count != 3:
    fail(f"Verse line {line_no} has pipe count {pipe_count} (expected 3).")

  if not line.startswith("V|N=") or "|EN=" not in line or "|KO=" not in line:
    fail(f"Verse keys/order invalid at line {line_no}.")
  if line.find("|EN=") > line.find("|KO="):
    fail(f"Verse key order invalid at line {line_no}: EN must come before KO.")

  return Verse(n=n, en=en, ko=ko, line_no=line_no)

def main() -> None:
  args = sys.argv[1:]

  if len(args) == 0:
    path = "-"
  elif len(args) == 1:
    if args[0] in ("-h", "--help"):
      usage_exit(0)
    path = args[0]
  else:
    usage_exit(2)

  text = read_text(path).strip("\n")
  if text.strip() == "":
    fail("Empty input.")

  try:
    lines = split_lines_strict(text)
  except ValueError as e:
    fail(str(e))

  if len(lines) < 3:
    fail("Input too short. Must have header + title + at least one verse line.")

  book, bookcode, chap = validate_header(lines[0])
  ok(f"Header parsed: BOOK={book}, BOOKCODE={bookcode}, CHAPTER={chap}")

  title_en, title_ko = validate_title(lines[1])
  ok(f"Title parsed: EN='{title_en[:40]}' KO='{title_ko[:40]}'")

  verses: List[Verse] = []
  for idx in range(2, len(lines)):
    verses.append(validate_verse(lines[idx], idx + 1))

  nums = [v.n for v in verses]
  if nums[0] != 1:
    fail(f"First verse N is {nums[0]} (expected 1).")

  dup = sorted({n for n in nums if nums.count(n) > 1})
  if dup:
    fail(f"Duplicate verse numbers found: {dup}")

  expected = list(range(1, max(nums) + 1))
  missing = sorted(set(expected) - set(nums))
  if missing:
    fail(f"Missing verse numbers: {missing}")

  for i in range(1, len(nums)):
    if nums[i] != nums[i-1] + 1:
      fail(f"Verse order break between lines {verses[i-1].line_no} (N={nums[i-1]}) and {verses[i].line_no} (N={nums[i]}).")

  ok(f"Verses OK: count={len(verses)}, range=1..{max(nums)}")

  # Policy: EN must not be empty. KO may be empty for now.
  if any(v.en.strip() == "" for v in verses):
    warn("Some verses have empty EN text.")

  print("PASS")

if __name__ == "__main__":
  main()
