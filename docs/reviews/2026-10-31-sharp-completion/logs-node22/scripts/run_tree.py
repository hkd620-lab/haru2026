#!/usr/bin/env python3
"""#114 Node 22 검증: 한 트리에서 같은 절차를 실행하고 명령별 원본 로그를 남긴다."""
import datetime, hashlib, json, os, shutil, subprocess, sys, tarfile
from pathlib import Path

WORK = Path("/private/tmp/haru-completion-control-20261031/sharp114-node22-work")
FINAL_TEST = WORK / "final-sharpImagePipelines.test.js"
EXPORTS = "console.log(Object.keys(require('./lib/index.js')).sort().join('\\n'))"

name = sys.argv[1]
tree = WORK / name
logs = WORK / "logs" / name
logs.mkdir(parents=True, exist_ok=True)
with tarfile.open(WORK / f"{name}.tar") as t:
    t.extractall(tree, filter="data")
fn = tree / "functions"
env = dict(os.environ, PUPPETEER_SKIP_DOWNLOAD="true", CI="true")
# 저장소 밖에서 돌리므로 비밀값·env 파일은 읽지 않는다.

if name == "baseline":
    shutil.copyfile(FINAL_TEST, fn / "test" / "sharpImagePipelines.test.js")

steps = [
    ("env-node", ["node", "-v"]),
    ("env-npm", ["npm", "-v"]),
    ("env-uname", ["uname", "-a"]),
    ("npm-ci", ["npm", "ci", "--no-audit", "--no-fund"]),
    ("npm-ls-sharp", ["npm", "ls", "sharp"]),
    ("sharp-versions", ["node", "-e", "console.log(JSON.stringify(require('sharp').versions))"]),
    ("build", ["npm", "run", "build"]),
    ("test-sharp-pipelines", ["node", "--test", "test/sharpImagePipelines.test.js"]),
    ("test-convert-heic-behavior", ["npm", "run", "test:convert-heic-behavior"]),
    ("test-convert-heic-guard", ["npm", "run", "test:convert-heic-guard"]),
    ("test-sns-thumbnail-privacy", ["npm", "run", "test:sns-thumbnail-privacy"]),
    ("test-sns-thumbnail-cleanup", ["npm", "run", "test:sns-thumbnail-cleanup"]),
    ("test-sns-story", ["npm", "run", "test:sns-story"]),
    ("test-ai-gateway", ["node", "--test", "test/aiGateway.test.js"]),
    ("exports", ["node", "-e", EXPORTS]),
]

summary = []
for label, cmd in steps:
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    r = subprocess.run(cmd, cwd=fn, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    ended = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (logs / f"{label}.txt").write_text(
        f"$ (cwd=functions) {' '.join(cmd)}\n# start {started}\n# end   {ended}\n# exit  {r.returncode}\n\n{r.stdout}"
    )
    summary.append({"step": label, "exit": r.returncode, "start": started, "end": ended})
    print(label, r.returncode, flush=True)

testfile = fn / "test" / "sharpImagePipelines.test.js"
meta = {
    "tree": name,
    "sharpTestSha256": hashlib.sha256(testfile.read_bytes()).hexdigest(),
    "lockSha256": hashlib.sha256((fn / "package-lock.json").read_bytes()).hexdigest(),
    "steps": summary,
}
(logs / "summary.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
