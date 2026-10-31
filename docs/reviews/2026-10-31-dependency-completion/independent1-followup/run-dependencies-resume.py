from pathlib import Path
import importlib.util,json
p=Path("docs/reviews/2026-10-31-dependency-completion/independent1-followup/run-followup.py")
spec=importlib.util.spec_from_file_location("checks",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.LOGS=m.EVIDENCE/"logs-resume";m.LOGS.mkdir(exist_ok=False)
# Earlier worker was terminated during npm ci. Preserve its files, run the original checks synchronously.
base=m.git("rev-parse","origin/main");head=m.git("rev-parse","HEAD")
assert base==m.EXPECTED_MAIN
(m.LOGS/"versions.txt").write_text((m.EVIDENCE/"logs/versions.txt").read_text()+"resumed_utc="+m.utc()+"\n")
before=m.verify("main",base);after=m.verify("candidate",head);m.registry_check(head)
(m.LOGS/"comparison.json").write_text(json.dumps({"main_sha":base,"candidate_sha":head,"frontend_dist":m.diff_maps(before["dist"],after["dist"]),"functions_lib":m.diff_maps(before["lib"],after["lib"]),"exports":{"main":len(before["exports"]),"candidate":len(after["exports"]),"added":sorted(set(after["exports"])-set(before["exports"])),"removed":sorted(set(before["exports"])-set(after["exports"]))}},indent=2))
print("DONE",flush=True)
