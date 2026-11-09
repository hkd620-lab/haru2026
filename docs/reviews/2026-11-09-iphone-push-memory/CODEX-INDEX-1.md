# PR #365 Codex 리뷰 색인 1

- 작성: CC 실행자 (2026-11-09). 새 색인 파일이다. 빠진 항목이 생기면 이 파일을 고치지 않고 보조 색인을 새로 추가한다(8.1).
- 원문 출처: GitHub PR #365 댓글. API 응답 원문은 `raw/codex-api-issuecomment-*.json`에 그대로 저장했다(SHA-256은 `SUPPLEMENT-1.md` 9절).
- 2026-11-09 이 색인 작성 시점에 PR #365에는 다음이 있다.
  - PR 리뷰 객체: 0개 (`gh api …/pulls/365/reviews` 길이 0)
  - 리뷰 줄 댓글: 0개 (`…/pulls/365/comments` 길이 0)
  - issue 댓글: 4개. github-actions preview 1개, root 요청 1개, Codex 2개

## 실행 목록

| 실행 | 요청 | 요청 시각 | 실행 대상 커밋(요청 시점 PR HEAD) | 요청 문구가 지목한 검토 대상 HEAD | 시작·완료 | 결과 | 결과 ID |
|---|---|---|---|---|---|---|---|
| 1 | root 수동 요청 `@codex review` — [issuecomment-6732506701](https://github.com/hkd620-lab/haru2026/pull/365#issuecomment-6732506701) (작성자 `hkd620-lab`) | `2026-11-09T04:49:28Z` | `89fa9644f75cfaf28667f7ce04229603ea2e781c` | `89fa9644f75cfaf28667f7ce04229603ea2e781c` (같음, 제품 코드 `0d1f4315`) | 요약 댓글 생성 `04:49:40Z`, 완료 `2026-11-09T04:50:49.694630Z` (Review trigger: Manual request) | **지적 없음** — "Codex Review: Didn't find any major issues. Another round soon, please!" / Reviewed commit `89fa9644f7` / `has_any_findings:false`, `status:"completed"` | 결과 댓글 [issuecomment-6732523114](https://github.com/hkd620-lab/haru2026/pull/365#issuecomment-6732523114) (`04:50:48Z`), 요약 댓글 [issuecomment-6732509134](https://github.com/hkd620-lab/haru2026/pull/365#issuecomment-6732509134) (갱신 `04:50:50Z`). PR 리뷰 객체 ID 없음 |

- 지적 목록: 없음 (반영 커밋 해당 없음)
- 요약 댓글 원문의 `security_review`는 모두 `null`이다. 보안 리뷰는 요청·실행되지 않았다.
- 요청 문구는 "runtime export100 동일, 다른 endpoint 설정 차이0 … 별도 검증했습니다"라고 적었다. 그 근거인 root 재실행 summary(`04:48:42Z`)는 요청(`04:49:28Z`) 전에 기록됐다. 요청 문구의 "후속 실행 근거는 기록 보완 예정"이 이번 `SUPPLEMENT-1.md`다.

## Codex 실행이 아닌 기록 (원문 그대로 보존)

- CC 1차 실행은 `gh pr comment 365 --body "@codex review (검토 대상 HEAD 89fa9644)"`를 시도했다. 이 명령은 세션 권한으로 **거부되어 게시되지 않았다.** 원문은 `raw/haru-memory-cc-1.raw.json`의 `permission_denials` 마지막 항목과 `result`의 "Codex review request: posting `@codex review` with `gh pr comment` was denied"다. 요청 댓글이 생기지 않았으므로 Codex 실행 번호를 매기지 않는다.
- PR #365는 draft로 생성됐다. 요약 댓글에는 Manual request 1건만 있고, PR 생성 시 자동 실행 기록은 없다. 확인되지 않은 자동 실행을 추정해 적지 않는다.

## 이 색인 이후

- 이 색인을 추가하는 커밋은 `docs/reviews/` 아래 새 파일 추가만 한다(검토 기록 전용 커밋 예외). 검토 대상 HEAD는 `89fa9644`로 유지된다. 판정 시에는 `git diff --name-status 89fa9644..<최종 HEAD>`의 모든 항목이 `A docs/reviews/…`인지 그대로 붙인다.
- CI는 최종 HEAD에서 통과해야 한다.
