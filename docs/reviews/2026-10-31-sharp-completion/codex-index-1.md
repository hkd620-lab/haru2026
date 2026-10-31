# Codex 검토 색인 — PR #319 (sharp 0.35.5)

원문은 GitHub PR 댓글이다. 시각은 모두 UTC다. 저장 스냅샷은 [codex-manual1-comments-raw.json](codex-manual1-comments-raw.json), [codex-ready2-comments-raw.json](codex-ready2-comments-raw.json)이다.

## 실행 목록

| 항목 | 실행 1 (수동) | 실행 2 (ready 자동) |
|---|---|---|
| 요청 링크 | https://github.com/hkd620-lab/haru2026/pull/319#issuecomment-6541263003 | 없음(자동). 트리거 원문 `Draft marked ready` |
| 요청 시각 | 2026-10-31T08:40:59Z | 없음(자동). ready 전환 08:54:19Z |
| 시작 시각 | 08:41:14.216404Z | 확인 불가 |
| 실행 대상 커밋 | `67386e69c5299eaf46f2a1070a902f8217ab6152` | `871a1f64ff17b968750b32dea3ec22db54ca4cef` |
| 요청 문구가 지목한 HEAD | `67386e69…` (실행 대상과 같음) | 없음 |
| 결과 ID | issue comment 6541272382 (receipt). 별도 review ID 없음 | 요약 댓글 6541265665의 상태값. 별도 receipt·review ID 없음 |
| 결과 링크 | https://github.com/hkd620-lab/haru2026/pull/319#issuecomment-6541272382 | https://github.com/hkd620-lab/haru2026/pull/319#issuecomment-6541265665 |
| 결과 댓글 시각 | 08:42:03Z | 해당 없음 |
| 완료 시각 | 08:42:04.983724Z | 08:55:13.235544Z |
| 결과 원문 | `Codex Review: Didn't find any major issues. Swish!` | `"has_any_findings":false,"has_unresolved_findings":false,"status":"completed"` |
| 지적 | 0건 | 0건 |
| 지적 제목·원문 링크·반영 커밋 | 해당 없음 | 해당 없음 |
| 상태 | 완료 | 완료 |

중단·대체·응답 없음으로 끝난 실행은 저장 원문에 없다. 두 스냅샷에 있는 Codex 실행은 위 2건이다.

## 값의 출처

- **요약 댓글은 덮어써진다.** 6541265665는 실행 1과 실행 2가 같은 댓글을 갱신했다. 지금 GitHub 링크는 실행 2 상태만 보여 준다. 실행 1의 요약 상태(`67386e6`, 완료 08:42:04.983724Z, `Manual request`)는 `codex-manual1-comments-raw.json`에 남아 있다.
- **실행 1 시작 시각과 실행 2의 ready 시각은 두 스냅샷에 없다.** 부모 기록(`control/resume-after-1930.md:16-17`)의 값이다. 두 스냅샷으로는 직접 대조할 수 없다. 스냅샷에서 확인되는 것은 요약 댓글 생성 시각 08:41:18Z다.
- **스냅샷 파일 수정 시각은 수집 시각이 아니다.** 두 파일 모두 18:35:26 KST(09:35:26Z)로 같지만 내용은 서로 다른 시점의 상태다. 수집 시각은 확인 불가이며 추정하지 않는다.
- **독립 질문의 "결과없음(지적0)"은 응답 없음이 아니다.** 지적이 없다는 뜻이라고 독립2 질문이 설명을 추가했다. 위 receipt가 원문이다.

## 옛 PR #114

`control/dependency-pr114.json`에는 Codex 등 실제 리뷰 실행 기록이 없다.

- 스냅샷은 dependabot PR(`d76602ac0783b502c2e4966ea27b3a654e88f756`, 2026-07-22 생성)의 메타데이터와 패치 2개다.
- `comments`는 `null`이고 `reviews` 항목이 없으며 `codex` 문자열은 0회다.
- 이 파일은 리뷰 항목을 담고 있지 않으므로 "리뷰가 없었다"는 증명도 아니다. 옛 #114의 리뷰 실행 수는 확인 불가로 두고 추정해 추가하지 않는다.

## 기록 전용 커밋

이 색인 뒤의 커밋에는 제품 변경이 없으므로 Codex 재요청을 하지 않는다. 근거는 [record-only-exception.md](record-only-exception.md)에 있다.
