# PR #270 CC 검증 스크립트·결과 (대상 HEAD 1dacf47c, 최신 main 69c371cc)

CC가 PR #270(AI 비서 추천 정확도)을 검증하려고 쓴 스크립트와 실행 결과다. 앱 코드가 아니며 PR #270에 포함되지 않는다. 해석과 판정은 `../2026-10-15-pr270-cc-verification.md`, `../2026-10-15-pr270-cc-opinion.md`에 있다. 경로 상수(`/tmp/claude-0/...`, `/home/user/haru2026/...`)는 CC 세션의 임시 경로다. 다시 돌리려면 작업 폴더에 맞게 바꾼다. 모든 실행은 격리 worktree(`cc-270` PR HEAD, `cc-270-main` 최신 main, `cc-270-merge` main+PR 병합 검증본, `cc-270-mut` 변이·시제품 복사본)에서 했고 원본 브랜치는 수정하지 않았다.

| 파일 | 역할 |
|---|---|
| `run-all-tests.sh` | `frontend/test`의 에뮬레이터 불필요 시험을 파일별로 실행해 결과를 기록(main, 병합 검증본 각각). 결과 `results/alltests-main-69c371cc.txt`, `results/alltests-merge-pr270.txt` |
| `run-builds.sh` | 더미 `VITE_FIREBASE_*`·`VITE_AI_LIBRARY_FIREBASE_*` 값으로 PR HEAD와 병합 검증본을 빌드. 결과 `results/build-summary.txt`. 운영 환경 변수 빌드가 아니다 |
| `run-tsc.sh` | main·PR HEAD·병합 검증본의 `tsc --noEmit`. 결과 `results/tsc-summary.txt` |
| `acceptance13.mjs` | 근거 문서 2-1절 합격 기준 13행(14검사)을 수정 후 함수로 실행하고 수정 전 결과를 곁들임. 결과 `results/acceptance13.txt` |
| `pr-table-check.mjs` | PR 본문 "동일 함수 실행 비교" 8사례 표를 수정 전·후 함수로 각각 실행해 표기와 대조. 결과 `results/pr-table-check.txt` |
| `stress-set.json`, `compare.mjs` | CC가 쓴 현실적 일기 문장 75개(주 분야 라벨은 CC 판단)와 가상사용자 문자열을 수정 전·후로 비교. 결과 `results/compare-summary.txt`, `results/compare-results.json` |
| `extract-corpus.mjs` | `frontend/test/persona-sim/personas/*.mjs`에서 한국어 문자열 656개를 추출(하네스 점검 문구가 섞여 있어 참고용). 추출본은 저장소 파일에서 다시 만들 수 있어 보존하지 않음 |
| `particles.mjs` | `강아지` 뒤에 조사·어미 94개를 붙여 인식 여부 점검. 결과 `results/particles.txt` |
| `run-mutants.py` | 복사본에서 변이 25개를 하나씩 적용해 새 단위 시험이 잡는지 확인하고 원문을 복원. 결과 `results/mutants-pr270.txt` |
| `weights-find.mjs` | 가중치(강 3·약 1)를 바꿔도 통과하는 시험 공백을 메울 최소 입력 탐색(변이 M01·M03 복사본 필요). 결과 `results/weights-find.txt` |
| `odd-inputs.mjs` | null·숫자·객체·짝 없는 서로게이트·NFD·ZWSP·이모지 경계와 `formats` 이상값을 넣어 예외 없이 동작하는지 점검. 결과 `results/odd-inputs.txt`(예외 0건) |
| `indep-repro.mjs` | 독립 검토자 보고의 대표 사례(구어 조사·정중체 감정 활용형·법률/건강/재무 활용형·합성어·잔존 오탐)와 경계 시험 4쌍을 CC 환경에서 다시 실행(변이 M01·M03 복사본 필요). 결과 `results/indep-repro.txt` |
| `perf.mjs` | 수정 전·후 실행 시간과 최악 입력 점검. 결과 `results/perf.txt` |
| `proto-vs-pr.mjs` | 참고용 시제품과 PR 원본이 달라지는 입력 목록(새 오탐 점검). 결과 요약은 `results/prototype-attribution.txt` |
| `results/prototype-recall-fix.diff` | 참고용 시제품(조사 허용 확장 + 합성어 목록) diff. **적용 대상이 아니며 PR에 반영하지 않았다.** 기장이 확정할 수정의 출발점 예시 |

## 한계

- 스트레스 세트와 라벨은 CC가 만들었고 독립 검증된 정답이 아니다. 가상사용자 문자열은 하네스 문구가 섞여 있다.
- 실제 브라우저 화면(SAYU 상세·저장 직후 카드)은 렌더하지 않았다. 함수 단위 실행과 빌드·타입·전체 오프라인 시험 기반이다.
- 성능 수치는 이 컨테이너(4 vCPU) 측정이며 모바일 기기에서는 더 느릴 수 있다.
