# PR #350 Codex 자동 리뷰 색인

- PR: https://github.com/hkd620-lab/haru2026/pull/350

## 실행 1 — 자동(PR 생성)
- 트리거: PR 생성(2026-11-06T07:31:35Z). 요청 댓글 없음(자동).
- 검토 HEAD: `0c35950a3e32db209ea0a447ba38fc373debc7d0`.
- [요약/결과 원문 ID 6679714930](https://github.com/hkd620-lab/haru2026/pull/350#issuecomment-6679714930). 요약 댓글 최초 생성(UTC) 2026-11-06T07:32:45Z, 당시 상태 `has_any_findings: true`, `has_unresolved_findings: true`, `status: completed`.
- GitHub PR review 객체 [5797082397](https://github.com/hkd620-lab/haru2026/pull/350#pullrequestreview-5797082397) (`COMMENTED`, 2026-11-06T07:32:40Z, 대상 `0c35950a`).
- 지적 1건(P2): **월 키뿐 아니라 날짜 변경 시에도 구독을 다시 열도록 설계하세요**. [원문 댓글 4490077943](https://github.com/hkd620-lab/haru2026/pull/350#discussion_r4490077943). 문서 4.1·4.5 위치. 요지: 같은 달 자정 전후로 홈을 열어 두면 월 키가 바뀌지 않아 구독의 종료일이 전날로 고정된다.
- 반영: 제안한 "일 변경 시 재구독" 대신 서버 상한을 `date < 다음 달 1일`로 넓히고 클라이언트 `todayKey`로 거르는 방식으로 설계를 고쳤다(문서 4.1·4.5, 시험 항목 5절). 반영 커밋 `e71a1a2fa22622d56d7caf846f4d300675ef544f`. CC 답글 [4490134209](https://github.com/hkd620-lab/haru2026/pull/350#discussion_r4490134209)(UTC 2026-11-06T07:41:12Z).

## 실행 2 — 수동 재요청
- 요청 댓글 [6679851935](https://github.com/hkd620-lab/haru2026/pull/350#issuecomment-6679851935) 본문 `@codex review`, 작성자 `hkd620-lab`(CC가 gh로 게시), UTC 2026-11-06 07:41 경. 사유: 지적 반영 커밋 후 재검토.
- 검토 HEAD: `e71a1a2fa22622d56d7caf846f4d300675ef544f`.
- 결과: 같은 요약 댓글 6679714930이 갱신됨. 결과 원문에 적힌 완료(UTC) 2026-11-06T07:42:26.654397Z, `status: completed`, `has_any_findings: false`, `has_unresolved_findings: false`, `commit_sha`는 위 HEAD와 일치.
- 완료 영수증 댓글 [6679870001](https://github.com/hkd620-lab/haru2026/pull/350#issuecomment-6679870001)(UTC 2026-11-06T07:42:25Z).
- 대기 구간: 요청부터 완료까지 약 1분. 2시간 미초과. 중단·대체·무응답 실행 없음.
- 실행 1의 지적 4490077943은 스레드 상태가 아니라 Codex가 같은 HEAD 재검토에서 "미해결 지적 없음"으로 판정함. CC가 스레드를 닫은 것은 해소 근거가 아니다.

## 다른 검증과 적용 범위

- 독립 Claude 설계 검토(대상 `0c35950a`): **수정 후 승인**(지적 14건) → [결과 원문](2026-11-06-pr350-claude-0c35950a-raw.md).
- 독립 Claude 설계 재검토(대상 `e71a1a2f`): **수정 후 승인**(2차, 지적 8건) → [결과 원문](2026-11-06-pr350-claude-e71a1a2f-raw.md). 이 검토는 Codex P2를 설계상 **해소**로 판정했다. 지적을 반영한 개정은 문서 9절.
- 이 색인과 위 기록은 `docs/reviews/` 새 파일 추가이며, 병합 조건이 채워졌다는 판정이 아니다. 세 번째 독립 재검토와 개정 HEAD의 CI·Codex 재검토 전에는 병합 조건 충족으로 기록하지 않는다.
