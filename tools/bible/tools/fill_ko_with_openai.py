#!/usr/bin/env python3
# Fill KO= for a final_en_only chapter file using OpenAI API.
# Input:  tools/final_en_only/{bookcode}_{chapter:03d}.txt
# Output: tools/final/{bookcode}_{chapter:03d}.txt
#
# Requires env: OPENAI_API_KEY
# Behavior:
#  - First request KO for all verses
#  - If any verse missing, automatically re-request ONLY missing verses (up to 3 attempts)
#  - Uses higher max_tokens to reduce truncation

import os, sys, json, re
from pathlib import Path
import urllib.request
from typing import Dict, List, Tuple, Optional

HEADER_RE = re.compile(r"^#BOOK=([^|]+)\|BOOKCODE=([a-z0-9_]+)\|CHAPTER=([0-9]+)\|VERSION=KJV\|LANGPAIR=EN-KO\|ARCHAIC=INLINE_PARENS$")
TITLE_RE  = re.compile(r"^T\|EN=(.*)\|KO=(.*)$")
VERSE_RE  = re.compile(r"^V\|N=([0-9]+)\|EN=(.*)\|KO=(.*)$")

def die(msg: str) -> None:
  print(f"FAIL: {msg}")
  sys.exit(1)

def call_openai(prompt: str, model: str = "gpt-4o-mini", max_tokens: int = 6000) -> str:
  api_key = os.environ.get("OPENAI_API_KEY", "").strip()
  if not api_key:
    die("OPENAI_API_KEY is not set in environment.")

  url = "https://api.openai.com/v1/chat/completions"
  payload = {
    "model": model,
    "temperature": 0,
    "max_tokens": max_tokens,
    "messages": [
      {"role": "system", "content": "You are a deterministic EN->KO Bible verse translator. Output must be machine-parseable and COMPLETE."},
      {"role": "user", "content": prompt},
    ],
  }
  data = json.dumps(payload).encode("utf-8")
  req = urllib.request.Request(url, data=data, method="POST")
  req.add_header("Content-Type", "application/json")
  req.add_header("Authorization", f"Bearer {api_key}")

  try:
    with urllib.request.urlopen(req, timeout=180) as resp:
      body = resp.read().decode("utf-8")
  except Exception as e:
    die(f"OpenAI API request failed: {e}")

  j = json.loads(body)
  try:
    return j["choices"][0]["message"]["content"]
  except Exception:
    die(f"Unexpected API response: {body[:800]}")

def build_prompt_all(verses: List[Tuple[int, str]]) -> str:
  max_n = max(n for n, _ in verses)
  lines = []
  lines.append("Return ONLY the following lines. No extra text. No blank lines.")
  lines.append("Format (exact): KO|N={verseInt}|KO={KoreanTranslation}")
  lines.append(f"Required: output EVERY verse from N=1 to N={max_n}, exactly once each, in increasing order.")
  lines.append("- Do NOT skip any N.")
  lines.append("- Do NOT wrap lines.")
  lines.append("- Do NOT include English.")
  lines.append("- Do NOT include quotation marks.")
  lines.append("")
  lines.append("INPUT EN VERSES:")
  for n, en in verses:
    lines.append(f"EN|N={n}|EN={en}")
  return "\n".join(lines)

def build_prompt_missing(missing: List[int], verse_map_en: Dict[int, str], max_n: int) -> str:
  lines = []
  lines.append("Return ONLY the following lines. No extra text. No blank lines.")
  lines.append("Format (exact): KO|N={verseInt}|KO={KoreanTranslation}")
  lines.append(f"Task: ONLY translate the missing verses listed below. Overall chapter range is 1..{max_n}.")
  lines.append(f"Missing Ns: {missing}")
  lines.append("- Output ONLY those missing Ns, each exactly once, in increasing order.")
  lines.append("- Do NOT output any other verse numbers.")
  lines.append("- Do NOT wrap lines.")
  lines.append("- Do NOT include English.")
  lines.append("- Do NOT include quotation marks.")
  lines.append("")
  lines.append("INPUT EN VERSES (MISSING ONLY):")
  for n in missing:
    lines.append(f"EN|N={n}|EN={verse_map_en[n]}")
  return "\n".join(lines)

def parse_input_file(path: Path):
  raw = path.read_text(encoding="utf-8", errors="replace").splitlines()
  if len(raw) < 3:
    die("Input file too short.")
  if not HEADER_RE.match(raw[0]):
    die("Header mismatch.")
  if not TITLE_RE.match(raw[1]):
    die("Title mismatch.")

  verses: List[Tuple[int, str]] = []
  for ln in raw[2:]:
    m = VERSE_RE.match(ln)
    if not m:
      die(f"Bad verse line: {ln[:200]}")
    n = int(m.group(1))
    en = m.group(2)
    verses.append((n, en))
  if not verses:
    die("No verses found in input.")
  verses.sort(key=lambda x: x[0])
  return raw[0], raw[1], verses

def parse_ko_response(text: str) -> Dict[int, str]:
  out: Dict[int, str] = {}
  for ln in text.splitlines():
    ln = ln.strip()
    if not ln:
      continue
    if not ln.startswith("KO|N=") or "|KO=" not in ln:
      # ignore stray junk lines if any (but still risky)
      continue
    try:
      left, ko_part = ln.split("|KO=", 1)
      n_str = left.split("KO|N=", 1)[1]
      n = int(n_str)
      ko = ko_part.strip()
      if ko:
        out[n] = ko
    except Exception:
      continue
  return out

def main():
  if len(sys.argv) < 3:
    print("Usage: python3 tools/fill_ko_with_openai.py <bookcode> <chapterInt> [model]")
    print("Example: python3 tools/fill_ko_with_openai.py gen 24 gpt-4o-mini")
    sys.exit(2)

  bookcode = sys.argv[1].strip().lower()
  chapter = int(sys.argv[2])
  model = sys.argv[3].strip() if len(sys.argv) >= 4 else "gpt-4o-mini"

  in_path = Path(f"tools/final_en_only/{bookcode}_{chapter:03d}.txt")
  if not in_path.exists():
    die(f"Input not found: {in_path}")

  header, title, verses = parse_input_file(in_path)
  max_n = max(n for n, _ in verses)
  verse_map_en = {n: en for n, en in verses}

  ko_map: Dict[int, str] = {}

  # Attempt 1: all verses
  prompt = build_prompt_all(verses)
  ko_text = call_openai(prompt, model=model, max_tokens=6000)
  ko_map.update(parse_ko_response(ko_text))

  # Retry missing verses only
  for attempt in range(2, 5):  # up to 3 retries
    missing = [n for n in range(1, max_n + 1) if n not in ko_map]
    if not missing:
      break
    # only request missing subset (often just the last verse)
    prompt2 = build_prompt_missing(missing, verse_map_en, max_n)
    ko_text2 = call_openai(prompt2, model=model, max_tokens=2000)
    ko_map.update(parse_ko_response(ko_text2))

  missing_final = [n for n in range(1, max_n + 1) if n not in ko_map]
  if missing_final:
    die(f"KO response missing verses: {missing_final}")

  out_dir = Path("tools/final")
  out_dir.mkdir(parents=True, exist_ok=True)
  out_path = out_dir / f"{bookcode}_{chapter:03d}.txt"

  with out_path.open("w", encoding="utf-8") as f:
    f.write(header + "\n")
    f.write(title + "\n")
    for n, en in verses:
      f.write(f"V|N={n}|EN={en}|KO={ko_map[n]}\n")

  print(f"PASS: wrote {out_path}")

if __name__ == "__main__":
  main()
