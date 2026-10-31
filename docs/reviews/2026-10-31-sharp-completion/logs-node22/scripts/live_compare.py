#!/usr/bin/env python3
"""운영 ZIP의 소스만 읽어 main과 helper 단위로 대조한다. ZIP과 소스 원본은 커밋하지 않는다."""
import difflib, json, re, subprocess, sys, zipfile
from pathlib import Path

CONTROL = Path("/private/tmp/haru-completion-control-20261031")
SRC = CONTROL / "remaining-live-sources"
WORK = CONTROL / "sharp114-node22-work"
MAIN = WORK / "baseline" / "functions"
OUT = WORK / "logs" / "live"
OUT.mkdir(parents=True, exist_ok=True)

FUNCS = ["generateGrowthTimelinePdf", "detectPlantAdvanced", "analyzeFacebookZip"]
HELPERS = {
    "generateGrowthTimelinePdf": ["prepareTimelinePdfImage"],
    "detectPlantAdvanced": [
        "callPlantNetIdentification", "callKindwiseIdentification", "callGeminiCrossVerification",
        "resolveKoreanPlantName",
    ],
    "analyzeFacebookZip": [],
}


def block(text, name):
    """이름을 선언하는 최상위 문장부터 다음 최상위 선언 전까지 잘라낸다."""
    m = re.search(rf"^(?:export )?(?:async )?(?:const|function) {re.escape(name)}\b", text, re.M)
    if not m:
        return None
    z = re.search(r"^(?:export |async function |function |const |class |type |interface |//)", text[m.end():], re.M)
    return text[m.start():m.end() + z.start()] if z else text[m.start():]


report = {}
for fn in FUNCS:
    with zipfile.ZipFile(SRC / f"{fn}.zip") as z:
        names = z.namelist()
        prefix = "" if "src/index.ts" in names else "functions/"
        live = {f: z.read(prefix + f).decode() for f in ["src/index.ts", "src/snsAnalyzer.ts", "package.json"]}
    main = {f: (MAIN / f).read_text() for f in live}
    entry = {"sharpRange": json.loads(live["package.json"])["dependencies"].get("sharp")}
    # 비교 스크립트가 index.ts만 보았으므로 함수가 어느 파일에 있는지 먼저 확인한다.
    entry["declaredIn"] = {f: block(main[f], fn) is not None for f in ["src/index.ts", "src/snsAnalyzer.ts"]}
    entry["liveSharpLines"] = {f: [l.strip() for l in live[f].splitlines() if "sharp" in l] for f in ["src/index.ts", "src/snsAnalyzer.ts"]}
    entry["mainSharpLines"] = {f: [l.strip() for l in main[f].splitlines() if "sharp" in l] for f in ["src/index.ts", "src/snsAnalyzer.ts"]}
    entry["helpers"] = {}
    targets = [(fn, f) for f in ["src/index.ts", "src/snsAnalyzer.ts"] if block(main[f], fn)]
    targets += [(h, "src/index.ts") for h in HELPERS[fn]]
    for name, f in targets:
        old, new = block(live[f], name), block(main[f], name)
        delta = "".join(difflib.unified_diff((old or "").splitlines(True), (new or "").splitlines(True),
                                             f"live-{name}", f"main-{name}"))
        entry["helpers"][name] = {
            "file": f, "liveFound": old is not None, "mainFound": new is not None,
            "identical": old == new, "diffLines": len(delta.splitlines()),
        }
        if delta:
            (OUT / f"{fn}--{name}.diff").write_text(delta)
    for f in ["src/index.ts", "src/snsAnalyzer.ts"]:
        d = list(difflib.unified_diff(live[f].splitlines(), main[f].splitlines(), lineterm="", n=0))
        entry.setdefault("wholeFileDiffLines", {})[f] = len(d)
    report[fn] = entry

(OUT / "helper-comparison.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(json.dumps(report, indent=2, ensure_ascii=False))
