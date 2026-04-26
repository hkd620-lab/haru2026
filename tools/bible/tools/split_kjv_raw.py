#!/usr/bin/env python3
# Split KJV raw text formatted like "1:21 ..." with wrapped lines and multiple verse markers per line.
# Handles:
#  - wrapped lines (continuations)
#  - multiple verse markers per line (e.g., "2:4 ... 2:5 ...")
#  - markers that may NOT be followed by a space (e.g., "3:5And ...")
#
# Output: tools/out_raw/{bookcode}_{chapter:03d}.txt
# Each output line: "{chapter}:{verse} {text}" (one verse per line, unwrapped)

import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# Detect chapter:verse marker even if no trailing space.
# Use lookahead so we don't match inside larger numbers.
MARK_RE = re.compile(r'(?<!\d)(\d+):(\d+)(?=\D|$)')

def die(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)

def normalize_spaces(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()

def parse_raw(text: str) -> Dict[int, Dict[int, str]]:
    """
    Returns {chapter: {verse: text}}.
    If the same verse appears multiple times (rare), we concatenate with a space.
    """
    chapters: Dict[int, Dict[int, str]] = {}
    cur_key: Tuple[int, int] | None = None
    buf = ""

    def flush():
        nonlocal cur_key, buf
        if cur_key is None:
            return
        chap, ver = cur_key
        chapters.setdefault(chap, {})
        cleaned = normalize_spaces(buf)
        if cleaned:
            if ver in chapters[chap]:
                chapters[chap][ver] = normalize_spaces(chapters[chap][ver] + " " + cleaned)
            else:
                chapters[chap][ver] = cleaned
        cur_key = None
        buf = ""

    for raw_line in text.splitlines():
        line = raw_line.rstrip("\n")
        if line.strip() == "":
            continue

        ms = list(MARK_RE.finditer(line))

        if not ms:
            # continuation line
            if cur_key is not None:
                buf += " " + line.strip()
            # else ignore heading lines like "The First Book of Moses..."
            continue

        # If there's leading text before the first marker and we are already inside a verse, treat as continuation.
        if ms[0].start() > 0 and cur_key is not None:
            lead = line[:ms[0].start()].strip()
            if lead:
                buf += " " + lead

        # Process each marker chunk
        for i, m in enumerate(ms):
            chap = int(m.group(1))
            ver = int(m.group(2))

            start = m.end()
            end = ms[i + 1].start() if i + 1 < len(ms) else len(line)
            chunk = line[start:end].strip()

            flush()
            cur_key = (chap, ver)
            buf = chunk

    flush()
    return chapters

def validate_chapter(chap: int, verse_map: Dict[int, str]) -> None:
    if not verse_map:
        die(f"Chapter {chap}: no verses parsed.")

    nums = sorted(verse_map.keys())
    if nums[0] != 1:
        die(f"Chapter {chap}: first verse is {nums[0]} (expected 1).")

    expected = list(range(1, nums[-1] + 1))
    missing = [n for n in expected if n not in verse_map]
    if missing:
        die(f"Chapter {chap}: missing verses: {missing}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 tools/split_kjv_raw.py <input_raw.txt> <bookcode>")
        print("Example: python3 tools/split_kjv_raw.py tools/inbox/genesis_raw.txt gen")
        sys.exit(2)

    in_path = Path(sys.argv[1])
    bookcode = sys.argv[2].strip().lower()

    if not in_path.exists():
        die(f"Input file not found: {in_path}")

    text = in_path.read_text(encoding="utf-8", errors="replace")
    chapters = parse_raw(text)

    if not chapters:
        die("No chapters parsed. Check input format.")

    out_dir = Path("tools/out_raw")
    out_dir.mkdir(parents=True, exist_ok=True)

    for chap in sorted(chapters.keys()):
        verse_map = chapters[chap]
        validate_chapter(chap, verse_map)

        out_file = out_dir / f"{bookcode}_{chap:03d}.txt"
        with out_file.open("w", encoding="utf-8") as f:
            for v in sorted(verse_map.keys()):
                f.write(f"{chap}:{v} {verse_map[v]}\n")

    print(f"PASS: wrote {len(chapters)} chapters to {out_dir}/ ({bookcode}_###.txt)")

if __name__ == "__main__":
    main()
