# PR #336 병합 직전 보충 기록 (2026-11-09)

- PR: https://github.com/hkd620-lab/haru2026/pull/336
- 이 파일은 새로 추가한 보충 기록이다. 기존 [gate-20261109-premerge.md](gate-20261109-premerge.md)와 다른 검토 원문·실패 원문은 고치지 않았다.
- 이번 범위 근거: 사용자 지시 "모두 완료하자"와 상위 실행자의 이번 실행 승인(잔여 기록 확정 → 최종 CI → main 병합 → Hosting과 `functions:chatWithResult` 단일 함수 배포).
- 작업 위치 `/Users/heogyeongdae/.codex/worktrees/answer-evidence/HARU2026`, 브랜치 `codex-answer-evidence-20261104`. 시작 HEAD `a5b49707dadd063741f4d609051ca792459c20c6`. 시작 시 미커밋은 `functions/lib/index.js`, `functions/lib/snsToDiary.js` 두 개이며 build 부산물이다(기존 gate 문서 "작업본에 남은 미커밋 변경" 참조). 이번에도 커밋·삭제하지 않았다.

## 기존 gate의 미실행 항목 보충 (상위 실행자 실행, 원문 경로)

| 항목 | 결과 | 원문 |
| --- | --- | --- |
| 로컬 Firestore `test:result-chat` | HEAD `a5b49707`, Node22, 프로젝트 `demo-haru-result-chat`, 에뮬레이터 `127.0.0.1:8399`. 2026-11-09T02:05:26Z~02:05:50Z, exit 0. `mode: instrumented-fake-gemini`, `genaiCallCount 44`, `legacyGenaiCallCount 11`, `webSearchCallCount 28`, `checkedPlans` basic·developer·free·premium 4종. `actualGemini:false`, `productionData:false` | `/private/tmp/haru-pending-336-integration-summary.json`, `/private/tmp/haru-pending-336-integration.log`, 실행 스크립트 `/private/tmp/haru-pending-336-integration.py` |
| 런타임 export 키 비교 | 이 worktree `functions/lib/index.js`와 PR358 작업본(`/private/tmp/haru-complete-pending-20261109/functions`)을 Node22로 `require`해 `Object.keys` 정렬 비교. 둘 다 exit 0, 각 100개, 목록 동일(`same: true`). 에뮬레이터용 환경값(`demo-haru-validation`)으로 모듈 초기화만 했고 함수는 호출하지 않았다 | `/private/tmp/haru-pending-exports-summary.json`, `-pr336.log`, `-pr358.log`, 스크립트 `/private/tmp/haru-pending-exports.py` |

- 로그에 보이는 `web_search_not_grounded`, `ATTACHMENT_CONTENT_UNREADABLE`, Gemini 임시 File 업로드·삭제 실패 경고는 시험이 일부러 만든 실패 경로의 출력이다. 최종 exit 0이다.
- 기존 gate의 정적 export 비교(77줄 대 77줄)는 `^export ` 줄만 센 것이다. 런타임 키 100개는 다른 모듈의 재export를 포함한 값이라 숫자가 다르다.
- 기존 build·단위 16·frontend 25·첨부 6 성공 로그는 `/private/tmp/haru-pr336-validation-20261109/`에 그대로 있다.
- 실제 Gemini 호출·운영 데이터 쓰기는 없었다.

## Codex 최신 검토 (a5b49707)

- 요청 원문: https://github.com/hkd620-lab/haru2026/pull/336#issuecomment-6730475433 (댓글 ID `6730475433`, 2026-11-09T02:02:52Z, 작성 `hkd620-lab`, 본문에 "검토 대상 HEAD: a5b49707dadd063741f4d609051ca792459c20c6").
- 결과 원문: https://github.com/hkd620-lab/haru2026/pull/336#issuecomment-6730503318 (댓글 ID `6730503318`, 2026-11-09T02:05:15Z, 작성 `chatgpt-codex-connector[bot]`).
- 원문 문구: `Codex Review: Didn't find any major issues. :tada:` / `**Reviewed commit:** \`a5b49707da\``
- 위 두 댓글은 GitHub API(`gh api repos/hkd620-lab/haru2026/issues/comments/{id}`)로 본문·시각·작성자를 대조했다.
- 이 파일을 담는 커밋 이후의 diff는 `docs/reviews/2026-11-04-answer-evidence/` 아래 새 파일 추가(`A`)만이어야 한다. push 뒤 `git diff --name-status a5b49707..HEAD`로 확인한다.

## 최신 main과의 차이

- 확인 시점 `origin/main` = `783560bc01551896fb578ad5c42782922bf917dc`(PR343 "아이폰 SAYU 검색 후 화면 확대 방지"). `a5b49707`와의 공통 조상은 `5f41cd7e`.
- PR343의 제품 코드 변경은 `frontend/src/app/pages/SayuPage.tsx` 1줄 교체뿐이다(나머지는 `docs/reviews/`). PR336의 ResultChat 관련 파일과 겹치지 않는다.
- `git merge-tree --write-tree origin/main a5b49707` → 충돌 없음, 트리 `62bac5e5`.
- `git diff --name-status origin/main 62bac5e5 -- . ':!docs'` 결과는 PR336의 9개 파일뿐이다: `ResultChatModal.tsx`(M), `ResultChatSources.tsx`(A), `resultChatService.ts`(M), `frontend/src/app/utils/resultChatEvidence.ts`(A), `frontend/test/resultChatEvidence.test.mjs`(A), `functions/src/index.ts`(M), `functions/src/resultChatEvidence.ts`(A), `functions/test/resultChat.integration.js`(M), `functions/test/resultChatEvidence.test.js`(A). 즉 최신 main과의 제품 코드 차이는 승인된 PR336 변경뿐이다.
- **PR358(의존성 lock 최소 반영)은 확인 시점에 OPEN이며 main에 병합되지 않았다.** 따라서 이번 병합·배포 소스에는 PR358의 lock 패치가 포함되지 않는다. 위 런타임 export 비교에서 PR358 작업본도 100개 동일했다는 것은 참고 사항이다.

## 운영 chatWithResult 현재 상태 (상위 실행자 실측, 배포 전)

- `chatWithResult`, `asia-northeast3`, `nodejs22`, ACTIVE, revision `chatwithresult-00039-rom`, updateTime `2026-11-05T03:44:11.486142402Z`, traffic latest 100%.
- 기존 [PR339 운영 첫 확인 기록](../2026-11-05-pr339-production-first-check.md)의 revision·시각과 같다. 즉 PR339 이후 다른 배포로 바뀌지 않았다.
- Slack 기록: https://harulab-hq.slack.com/archives/C0C11P98MHV/p1793848128790069 (상위 실행자 확인, PR339 기록과 동일). 하루LAW 한글·HWPX 첨부 코드는 이미 운영에 배포되어 있으므로, 이번 `chatWithResult` 배포에서 새로 나가는 동작 변경은 PR336뿐이다.
- 이 세션(CC)은 Slack을 직접 조회·게시하지 않았다.

## 판정 메모

- 독립 Claude 03 승인(`637d6d3f` 기준), Codex 최신 `a5b49707` 지적 없음. `637d6d3f..a5b49707`의 PR 고유 변경은 `docs/reviews/` 추가뿐이고 나머지는 main merge(`598a1660`)로 들어온 main 코드다.
- 남은 병합 조건: 이 커밋의 최종 HEAD CI 성공. Ready 전환 뒤 자동 Codex 실행이 시작된 증거가 없으면 없는 실행을 기다리지 않고, 위 확인된 결과와 "검토 기록 전용 커밋" 예외로 판정한다.
- 병합 방식: `gh pr merge 336 --squash --match-head-commit <최종 HEAD>`. admin·auto·force는 쓰지 않는다.
- 배포 범위: Hosting(main 자동배포)과 `functions:chatWithResult`(asia-northeast3)만. Rules·다른 Functions·grammarCache 삭제는 대상이 아니다.
- 운영 E2E 5항목과 "운영 완료" 판정은 상위 실행자·허대표님 몫이다. 출처 연결은 사실검증이 아니다. HEL·EEB 전파 보류는 유지한다.
