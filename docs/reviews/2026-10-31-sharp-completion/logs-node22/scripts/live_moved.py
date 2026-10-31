#!/usr/bin/env python3
"""파일을 옮긴 선언(getUserPlan, AI_USAGE_PLAN)과 snsAnalyzer 모듈 초기화 차이를 본다."""
import difflib, re, zipfile
from pathlib import Path

CONTROL = Path("/private/tmp/haru-completion-control-20261031")
SRC = CONTROL / "remaining-live-sources"
MAIN = CONTROL / "sharp114-node22-work" / "baseline" / "functions"
OUT = CONTROL / "sharp114-node22-work" / "logs" / "live"
NEXT = re.compile(r"^(?:export |async function |function |const |let |class |type |interface |import )", re.M)


def block(text, name):
    m = re.search(rf"^(?:export )?(?:async )?(?:const|let|function|class) {re.escape(name)}\b", text, re.M)
    if not m:
        return ""
    z = NEXT.search(text, m.end())
    return text[m.start():z.start() if z else len(text)]


def read_live(zip_name, rel):
    with zipfile.ZipFile(SRC / zip_name) as z:
        prefix = "" if "src/index.ts" in z.namelist() else "functions/"
        return z.read(prefix + rel).decode()


pairs = [
    ("getUserPlan", "generateGrowthTimelinePdf.zip", "src/index.ts", "src/sharedHelpers.ts"),
    ("AI_USAGE_PLAN", "detectPlantAdvanced.zip", "src/index.ts", "src/sharedHelpers.ts"),
]
for name, zname, live_file, main_file in pairs:
    a = block(read_live(zname, live_file), name)
    b = block((MAIN / main_file).read_text(), name)
    delta = "".join(difflib.unified_diff(a.splitlines(True), b.splitlines(True), f"live-{name}", f"main-{name}"))
    (OUT / f"moved--{name}.diff").write_text(delta)
    print(f"=== {name}: {len(delta.splitlines())} diff lines\n{delta}")

head = 74  # analyzeFacebookZip 선언 전 구간만 본다
a = read_live("analyzeFacebookZip.zip", "src/snsAnalyzer.ts")
b = (MAIN / "src/snsAnalyzer.ts").read_text()
cut = lambda t: t[:t.index("export const analyzeFacebookZip")]
delta = "".join(difflib.unified_diff(cut(a).splitlines(True), cut(b).splitlines(True), "live-snsAnalyzer-head", "main-snsAnalyzer-head"))
(OUT / "analyzeFacebookZip--module-head.diff").write_text(delta)
print("=== snsAnalyzer head\n" + delta)
