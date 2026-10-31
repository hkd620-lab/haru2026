#!/usr/bin/env python3
"""세 함수에서 닿는 최상위 선언을 파일 안에서 따라가 운영 소스와 main을 대조한다.

소스 본문은 저장하지 않고 이름·동일 여부·줄 수만 남긴다. 모듈 경계 밖은 import 대상만 적는다.
"""
import difflib, json, re, zipfile
from pathlib import Path

CONTROL = Path("/private/tmp/haru-completion-control-20261031")
SRC = CONTROL / "remaining-live-sources"
WORK = CONTROL / "sharp114-node22-work"
MAIN = WORK / "baseline" / "functions"
OUT = WORK / "logs" / "live"

ENTRY = {
    "generateGrowthTimelinePdf": "src/index.ts",
    "detectPlantAdvanced": "src/index.ts",
    "analyzeFacebookZip": "src/snsAnalyzer.ts",
}
DECL = re.compile(r"^(?:export )?(?:async )?(?:const|let|function|class) ([A-Za-z_$][\w$]*)", re.M)
NEXT = re.compile(r"^(?:export |async function |function |const |let |class |type |interface |import )", re.M)


def declarations(text):
    found = {}
    for m in DECL.finditer(text):
        z = NEXT.search(text, m.end())
        found.setdefault(m.group(1), text[m.start():z.start() if z else len(text)])
    return found


def imports(text):
    out = {}
    for m in re.finditer(r"import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['\"]([^'\"]+)['\"]", text):
        if "import type" in m.group(0):
            continue
        for part in m.group(1).split(","):
            name = part.strip().split(" as ")[-1].strip()
            if name:
                out[name] = m.group(2)
    return out


def reach(decls, start):
    seen, todo = set(), [start]
    while todo:
        name = todo.pop()
        if name in seen or name not in decls:
            continue
        seen.add(name)
        todo.extend(re.findall(r"[A-Za-z_$][\w$]*", decls[name]))
    return seen


report = {}
for fn, file in ENTRY.items():
    with zipfile.ZipFile(SRC / f"{fn}.zip") as z:
        prefix = "" if "src/index.ts" in z.namelist() else "functions/"
        live_text = z.read(prefix + file).decode()
        names = set(z.namelist())
    main_text = (MAIN / file).read_text()
    live, main = declarations(live_text), declarations(main_text)
    both = reach(main, fn) | reach(live, fn)
    changed = {}
    for name in sorted(both):
        a, b = live.get(name), main.get(name)
        if a != b:
            d = list(difflib.unified_diff((a or "").splitlines(), (b or "").splitlines(), lineterm="", n=0))
            changed[name] = {"liveFound": a is not None, "mainFound": b is not None, "diffLines": len(d)}
    used = set()
    for name in both & set(main):
        used.update(re.findall(r"[A-Za-z_$][\w$]*", main[name]))
    imp = imports(main_text)
    modules = sorted({imp[n] for n in used if n in imp and imp[n].startswith(".")})
    module_state = {}
    for mod in modules:
        rel = str((Path(file).parent / mod).as_posix()) + ".ts"
        rel = re.sub(r"[^/]+/\.\./", "", rel).replace("/./", "/")
        mp = MAIN / rel
        lp = prefix + rel
        module_state[rel] = "live에 없음" if lp not in names else (
            "동일" if zipfile.ZipFile(SRC / f"{fn}.zip").read(lp) == mp.read_bytes() else "변경")
    report[fn] = {
        "reachableDeclarations": len(both),
        "changed": changed,
        "unchangedCount": len(both) - len(changed),
        "localModules": module_state,
    }

(OUT / "callgraph-comparison.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(json.dumps(report, indent=2, ensure_ascii=False))
