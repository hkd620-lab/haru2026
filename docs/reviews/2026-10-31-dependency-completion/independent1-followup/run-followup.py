#!/usr/bin/env python3
"""독립 1회차 추가 검증 실행기. 사용법: 저장소 루트에서 python3 -I <이 파일> run|cleanup

main과 후보를 .audit-baseline 아래 git archive로 풀어 Node 22로 각각 검증한다.
.env를 만들거나 읽지 않고, 비밀값 형태의 환경변수를 지운 뒤 더미 VITE 값만 넘긴다.
"""
import datetime
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tarfile
import io

ROOT = pathlib.Path.cwd()
EVIDENCE = ROOT / "docs/reviews/2026-10-31-dependency-completion/independent1-followup"
LOGS = EVIDENCE / "logs"
WORK = ROOT / ".audit-baseline"
NODE22 = "/opt/homebrew/opt/node@22/bin"
EXPECTED_MAIN = "5972c5cf93381ea48ba8e31381a4ed883fe1f6bc"
REACH_TARGETS = "ip-address socks socks-proxy-agent proxy-agent puppeteer puppeteer-core @puppeteer/browsers brace-expansion minimatch glob rimraf filelist jake ejs google-gax gaxios".split()
VIEW_PACKAGES = [
    ("frontend", "react-router", "7.18.1"),
    ("frontend", "react-router-dom", "7.18.1"),
    ("frontend", "fast-uri", "3.1.5"),
    ("frontend", "postcss", "8.5.26"),
    ("frontend", "nanoid", "3.3.17"),
    ("frontend", "dompurify", "3.4.13"),
    ("functions", "brace-expansion", "2.1.4"),
    ("functions", "brace-expansion", "1.1.18"),
    ("functions", "ip-address", "10.5.0"),
]
DUMMY_ENV = {
    "VITE_FIREBASE_API_KEY": "dummy-audit",
    "VITE_FIREBASE_AUTH_DOMAIN": "dummy-audit.invalid",
    "VITE_FIREBASE_PROJECT_ID": "dummy-audit",
    "VITE_FIREBASE_STORAGE_BUCKET": "dummy-audit.invalid",
    "VITE_FIREBASE_MESSAGING_SENDER_ID": "000000000000",
    "VITE_FIREBASE_APP_ID": "1:000000000000:web:dummy",
}
counter = 0
records = []


def utc():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_env():
    secretish = re.compile(r"TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|_KEY$|AUTH", re.I)
    env = {k: v for k, v in os.environ.items() if not secretish.search(k) and not k.startswith("VITE_")}
    env["PATH"] = NODE22 + os.pathsep + env.get("PATH", "")
    env["npm_config_update_notifier"] = "false"
    env["npm_config_fund"] = "false"
    env.pop("NODE_ENV", None)
    env.update(DUMMY_ENV)
    return env


ENV = build_env()


def run(name, cmd, cwd, sha, stdout_name=None, timeout=1800):
    global counter
    counter += 1
    base = f"{counter:02d}-{name}"
    log = LOGS / f"{base}.log"
    out_path = LOGS / stdout_name if stdout_name else None
    started = utc()
    with log.open("w") as handle:
        handle.write(f"# cmd: {' '.join(cmd)}\n# cwd: {cwd}\n# target_sha: {sha}\n# start_utc: {started}\n\n")
        handle.flush()
        out = out_path.open("w") if out_path else handle
        try:
            proc = subprocess.run(cmd, cwd=ROOT / cwd, env=ENV, stdout=out, stderr=handle, timeout=timeout, stdin=subprocess.DEVNULL)
            code = proc.returncode
        except subprocess.TimeoutExpired:
            code = "timeout"
        finally:
            if out_path:
                out.close()
        ended = utc()
        handle.write(f"\n# end_utc: {ended}\n# exit_code: {code}\n")
    records.append({"step": base, "cmd": " ".join(cmd), "cwd": str(cwd), "target_sha": sha, "start_utc": started,
                    "end_utc": ended, "exit_code": code, "log": log.name, "stdout_file": stdout_name})
    (EVIDENCE / "commands.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
    print(base, code, flush=True)
    return code


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()


def extract(sha, dest):
    data = subprocess.run(["git", "archive", "--format=tar", sha, "frontend", "functions", "firebase.json", "firestore.rules", "storage.rules"],
                          cwd=ROOT, check=True, capture_output=True).stdout
    dest.mkdir(parents=True)
    with tarfile.open(fileobj=io.BytesIO(data)) as tar:
        tar.extractall(dest, filter="data")


def hash_tree(directory, output):
    lines = []
    for path in sorted(p for p in directory.rglob("*") if p.is_file()):
        lines.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(directory)}")
    (LOGS / output).write_text("\n".join(lines) + "\n")
    return dict(reversed(line.split("  ", 1)) for line in lines)


def export_names(index_js):
    source = index_js.read_text()
    names = set(re.findall(r"\bexports\.([A-Za-z_$][\w$]*)\s*=", source))
    names |= set(re.findall(r'Object\.defineProperty\(exports,\s*"([^"]+)"', source))
    names.discard("__esModule")
    return sorted(names)


def diff_maps(before, after):
    return {
        "before_count": len(before),
        "after_count": len(after),
        "added": sorted(set(after) - set(before)),
        "removed": sorted(set(before) - set(after)),
        "changed": sorted(k for k in before if k in after and before[k] != after[k]),
    }


def verify(label, sha):
    tree = pathlib.Path(".audit-baseline") / label
    fn, fe = tree / "functions", tree / "frontend"
    results = {}

    run(f"{label}-functions-npm-ci", ["npm", "ci", "--ignore-scripts"], fn, sha)
    run(f"{label}-functions-build", ["npm", "run", "build"], fn, sha)
    results["lib"] = hash_tree(ROOT / fn / "lib", f"functions-lib-sha256-{label}.txt")
    results["exports"] = export_names(ROOT / fn / "lib/index.js")
    (LOGS / f"exports-{label}.txt").write_text("\n".join(results["exports"]) + "\n")
    run(f"{label}-reachability", ["node", str(EVIDENCE.parent / "reachability.cjs"), "functions", *REACH_TARGETS], tree, sha,
        f"reachability-{label}.json")
    run(f"{label}-reachability-followup", ["node", str(EVIDENCE / "reachability-followup.cjs"), "functions", *REACH_TARGETS], tree, sha,
        f"reachability-followup-{label}.json")
    for script in ["test:epub-content", "test:ai-gateway", "test:convert-heic-behavior"]:
        run(f"{label}-functions-{script.replace(':', '-')}", ["npm", "run", script], fn, sha)
    run(f"{label}-functions-related-tests",
        ["node", "--test", "test/polishContent.test.js", "test/aiUsageLogger.request.test.js", "test/aiGateway.test.js", "test/monthlyAiQuota.policy.test.js"], fn, sha)
    run(f"{label}-functions-audit", ["npm", "audit", "--json"], fn, sha, f"audit-functions-{label}.json")

    run(f"{label}-frontend-npm-ci", ["npm", "ci", "--ignore-scripts"], fe, sha)
    run(f"{label}-frontend-build", ["npm", "run", "build"], fe, sha)
    results["dist"] = hash_tree(ROOT / fe / "dist", f"frontend-dist-sha256-{label}.txt")
    run(f"{label}-frontend-tests",
        ["node", "--import", "tsx", "--test", "test/householdSummary.test.mjs", "test/structuredAssistantRecords.test.mjs",
         "test/originalAssistantRecords.test.mjs", "test/recordStats.test.mjs", "test/readingAi.test.mjs"], fe, sha)
    run(f"{label}-frontend-test-question-enter", ["npm", "run", "test:question-enter"], fe, sha)
    run(f"{label}-frontend-test-question-inputs", ["npm", "run", "test:question-inputs"], fe, sha)
    run(f"{label}-frontend-audit", ["npm", "audit", "--json"], fe, sha, f"audit-frontend-{label}.json")
    return results


def registry_check(sha):
    report = []
    for area, name, version in VIEW_PACKAGES:
        stdout = f"npm-view-{name}-{version}.json"
        code = run(f"npm-view-{name}-{version}", ["npm", "view", f"{name}@{version}", "name", "version", "dist.integrity", "dist.tarball", "dependencies", "--json"],
                   ".", sha, stdout, timeout=120)
        view = json.loads((LOGS / stdout).read_text()) if code == 0 else {}
        lock = json.loads((ROOT / ".audit-baseline/candidate" / area / "package-lock.json").read_text())
        entries = {key: value for key, value in lock["packages"].items()
                   if key.endswith(f"node_modules/{name}") and value.get("version") == version}
        report.append({
            "area": area, "package": name, "version": version,
            "registry_integrity": view.get("dist.integrity"), "registry_tarball": view.get("dist.tarball"),
            "lock_entries": sorted(entries),
            "integrity_match": bool(entries) and all(e.get("integrity") == view.get("dist.integrity") for e in entries.values()),
            "tarball_match": bool(entries) and all(e.get("resolved") == view.get("dist.tarball") for e in entries.values()),
        })
    (LOGS / "registry-lock-comparison.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


def main():
    LOGS.mkdir(parents=True, exist_ok=False)
    if WORK.exists():
        sys.exit(".audit-baseline already exists")
    candidate = git("rev-parse", "HEAD")
    baseline = git("rev-parse", "origin/main")
    if baseline != EXPECTED_MAIN:
        sys.exit(f"unexpected origin/main {baseline}")

    (LOGS / "versions.txt").write_text("")
    with (LOGS / "versions.txt").open("a") as handle:
        handle.write(f"candidate_sha={candidate}\nmain_sha={baseline}\nstart_utc={utc()}\n")
        for label, cmd in [("node", ["node", "--version"]), ("npm", ["npm", "--version"]), ("node_path", ["which", "node"]), ("npm_path", ["which", "npm"])]:
            handle.write(f"{label}={subprocess.run(cmd, env=ENV, capture_output=True, text=True).stdout.strip()}\n")

    extract(baseline, WORK / "main")
    extract(candidate, WORK / "candidate")
    before = verify("main", baseline)
    after = verify("candidate", candidate)
    registry_check(candidate)

    expected_exports = (EVIDENCE.parent / "exports-after.txt").read_text().split()
    (LOGS / "comparison.json").write_text(json.dumps({
        "main_sha": baseline,
        "candidate_sha": candidate,
        "frontend_dist": diff_maps(before["dist"], after["dist"]),
        "functions_lib": diff_maps(before["lib"], after["lib"]),
        "exports": {
            "main": len(before["exports"]), "candidate": len(after["exports"]),
            "added": sorted(set(after["exports"]) - set(before["exports"])),
            "removed": sorted(set(before["exports"]) - set(after["exports"])),
            "added_vs_first_run_exports_after": sorted(set(after["exports"]) - set(expected_exports)),
            "removed_vs_first_run_exports_after": sorted(set(expected_exports) - set(after["exports"])),
        },
    }, ensure_ascii=False, indent=2) + "\n")
    print("done", flush=True)


def cleanup():
    if WORK.resolve().parent != ROOT.resolve() or WORK.name != ".audit-baseline":
        sys.exit("refusing to remove unexpected path")
    shutil.rmtree(WORK)
    print("removed", WORK)


if __name__ == "__main__":
    {"run": main, "cleanup": cleanup}[sys.argv[1]]()
