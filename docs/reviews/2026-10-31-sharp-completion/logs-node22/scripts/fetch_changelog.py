#!/usr/bin/env python3
"""공식 sharp 공개 changelog만 내려받아 저장한다."""
import pathlib, urllib.request

out = pathlib.Path("/private/tmp/haru-completion-control-20261031/sharp114-node22-work/changelog")
out.mkdir(exist_ok=True)
for v in ["0.35.0", "0.35.1", "0.35.2", "0.35.3", "0.35.4", "0.35.5"]:
    url = f"https://sharp.pixelplumbing.com/changelog/v{v}/"
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30)
        body = r.read()
        (out / f"v{v}.html").write_bytes(body)
        print(v, r.status, len(body))
    except Exception as e:
        print(v, "ERR", repr(e))
