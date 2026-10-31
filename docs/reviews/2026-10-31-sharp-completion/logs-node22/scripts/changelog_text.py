#!/usr/bin/env python3
"""저장한 changelog HTML에서 본문 목록만 평문으로 뽑는다."""
import html, pathlib, re

base = pathlib.Path("/private/tmp/haru-completion-control-20261031/sharp114-node22-work/changelog")
lines = []
for v in ["0.35.0", "0.35.1", "0.35.2", "0.35.3", "0.35.4", "0.35.5"]:
    page = (base / f"v{v}.html").read_text(encoding="utf-8")
    main = re.search(r"<main.*?</main>", page, re.S)
    text = main.group(0) if main else page
    items = re.findall(r"<(?:h1|p|li)[^>]*>(.*?)</(?:h1|p|li)>", text, re.S)
    lines.append(f"## v{v} — https://sharp.pixelplumbing.com/changelog/v{v}/")
    for item in items:
        clean = html.unescape(re.sub(r"<[^>]+>", "", item)).strip()
        clean = re.sub(r"\s+", " ", clean)
        if clean:
            lines.append(f"- {clean}")
    lines.append("")
(base / "changelog-0.35.0-0.35.5.txt").write_text("\n".join(lines), encoding="utf-8")
print("\n".join(lines))
