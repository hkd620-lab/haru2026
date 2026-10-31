#!/usr/bin/env python3
"""첫 실패 로그는 두고, 시험이 읽는 저장소 파일만 더해 test:sns-thumbnail-privacy를 재실행한다."""
import datetime, os, subprocess, tarfile
from pathlib import Path

WORK = Path("/private/tmp/haru-completion-control-20261031/sharp114-node22-work")
for name in ["baseline", "candidate"]:
    with tarfile.open(WORK / f"privacy-{name}.tar") as t:
        t.extractall(WORK / name, filter="data")
    cmd = ["npm", "run", "test:sns-thumbnail-privacy"]
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    r = subprocess.run(cmd, cwd=WORK / name / "functions", env=dict(os.environ, CI="true"),
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    ended = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (WORK / "logs" / name / "test-sns-thumbnail-privacy-rerun.txt").write_text(
        f"$ (cwd=functions) {' '.join(cmd)}\n# start {started}\n# end   {ended}\n# exit  {r.returncode}\n\n{r.stdout}"
    )
    print(name, r.returncode)
