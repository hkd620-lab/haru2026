# 최종 검토 색인 — 개인용 학습함 폴더·보류 배포

최신 코드 검토 대상: `7bcd56024352a7559efaff0b794a5ca079e87257`.
독립 Claude 3회차 원문 `claude-3-raw.json` 판정: **승인**. 이전 두 회차는 각각 수정 후 승인/수정 후 승인(조건부)였고, 원문 및 반영 내역을 모두 보존했다. 검토자는 코드 수정·운영 데이터 조회·유료 호출·게시를 하지 않았다.

Codex 1회:
- 요청 https://github.com/hkd620-lab/haru2026/pull/367#issuecomment-6761948946
- 대상 baeb0375c3441768820ad0fc77f2a90664109792
- 시작 2026-11-10T07:47:34.469607Z, 완료 2026-11-10T07:49:28Z
- 리뷰 ID 5838360914, P2 원문 https://github.com/hkd620-lab/haru2026/pull/367#discussion_r4522324143
- 반영 커밋 111cc9566f8fa8587d721f846f0c7aa839b67e44 (미분류/같은 추천 폴더 수동 확정)

Codex 2회:
- 요청 https://github.com/hkd620-lab/haru2026/pull/367#issuecomment-6762255283
- 대상 111cc9566f8fa8587d721f846f0c7aa839b67e44
- 시작 2026-11-10T08:05:07.908618Z, 완료 2026-11-10T08:08:05Z
- 리뷰 ID 5838564724, P2 원문 https://github.com/hkd620-lab/haru2026/pull/367#discussion_r4522458879
- 반영 커밋 7bcd56024352a7559efaff0b794a5ca079e87257 (Firestore 키 순서에 독립적인 계획 해시)

Codex 3회:
- 요청 https://github.com/hkd620-lab/haru2026/pull/367#issuecomment-6762418080
- 대상 7bcd56024352a7559efaff0b794a5ca079e87257
- 시작 2026-11-10T08:13:55.205951Z
- 완료 상태 원문 https://github.com/hkd620-lab/haru2026/pull/367#issuecomment-6761953159
- 구조화된 결과는 `codex-3-status.json`: completed, has_any_findings=false, has_unresolved_findings=false.
- 지적 없는 회차는 요약 댓글/완료 상태를 원문 근거로 사용한다. 새 리뷰 ID·완료 시각은 아래 보조 색인에서 확인 가능한 값을 추가하며 추정하지 않는다.
- 세 실행 모두 결과를 받은 뒤 다음 실행을 요청했으며, 대체·무응답 실행은 없다.

최신 코드 CI:
- Functions https://github.com/hkd620-lab/haru2026/actions/runs/42780875698 (success)
- Hosting https://github.com/hkd620-lab/haru2026/actions/runs/42780875606 (success)

필수 검증: Functions 빌드, 분류81개 및 폴더/보류/메타데이터연결16개, frontend import/분류32개+모달2개, 실제 React 합성 화면24개. 독립 검토자가 분류81개·폴더/보류16개·tsc도 별도로 확인했다.

배포 범위: Functions `listAiLibraryLogs,saveAiLibraryImport,moveAiLibraryLog,listAiLibraryReviews` → Hosting. 리전 asia-northeast3, Node22. 사용자 승인 원문과 525건 메타데이터 대조는 approval-and-verification-evidence.md 참조.
현재 기록 전용 커밋은 docs/reviews 아래 새 파일 추가만 허용한다. 최종 HEAD CI는 따로 확인한다. 배포/운영 E2E는 아직 실행 전이며 성공으로 기록하지 않는다.
