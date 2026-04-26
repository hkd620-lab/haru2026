#!/usr/bin/env python3
# Batch build a whole book by chapters:
# out_raw -> final_en_only -> final (KO filled) -> verify
#
# Usage:
#   python3 tools/batch_build_book.py gen 1 50 gpt-4o-mini

import sys
import subprocess
from pathlib import Path

def die(msg: str) -> None:
  print(f"FAIL: {msg}")
  sys.exit(1)

def run(cmd: list[str]) -> None:
  p = subprocess.run(cmd, text=True)
  if p.returncode != 0:
    die(f"Command failed: {' '.join(cmd)}")

def main():
  if len(sys.argv) < 4:
    print("Usage: python3 tools/batch_build_book.py <bookcode> <startChapter> <endChapter> [model]")
    sys.exit(2)

  bookcode = sys.argv[1].strip().lower()
  start = int(sys.argv[2])
  end = int(sys.argv[3])
  model = sys.argv[4].strip() if len(sys.argv) >= 5 else "gpt-4o-mini"

  out_raw_dir = Path("tools/out_raw")
  if not out_raw_dir.exists():
    die("tools/out_raw not found. Run split first.")

  for chap in range(start, end + 1):
    raw = out_raw_dir / f"{bookcode}_{chap:03d}.txt"
    if not raw.exists():
      die(f"Missing out_raw file: {raw}")

  print(f"INFO: building {bookcode} chapters {start}..{end} using model={model}")

  for chap in range(start, end + 1):
    print(f"\n=== {bookcode.upper()} {chap} ===")

    # 1) build EN-only final format
    run(["python3", "tools/build_chapter_en_only.py", bookcode, str(chap)])

    # 2) fill KO via OpenAI
    run(["python3", "tools/fill_ko_with_openai.py", bookcode, str(chap), model])

    # 3) verify final
    final_path = f"tools/final/{bookcode}_{chap:03d}.txt"
    run(["python3", "tools/verify_chapter.py", final_path])

  print(f"\nPASS: completed {bookcode} chapters {start}..{end}")

if __name__ == "__main__":
  main()
