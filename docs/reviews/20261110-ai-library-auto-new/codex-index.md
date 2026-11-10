# Codex PR370 원문 색인

[PR370](https://github.com/hkd620-lab/haru2026/pull/370), 검토 결과 원문은 아래 GitHub 링크와 github-*.json에 있다.

|실행|요청·대상HEAD|확인된 시작(UTC)|완료(UTC)|원문결과|
|---|---|---|---|
|1|[요청](https://github.com/hkd620-lab/haru2026/pull/370#issuecomment-6765263947) 2026-11-10T10:42:32Z, 53cd248b|2026-11-10T10:42:50Z(요약 댓글 생성)|2026-11-10T10:46:06Z|[리뷰5840581615](https://github.com/hkd620-lab/haru2026/pull/370#pullrequestreview-5840581615), N1|
|2|[요청](https://github.com/hkd620-lab/haru2026/pull/370#issuecomment-6765344966) 2026-11-10T10:46:45Z, 1b3b3f49。10:46:41Z ready 전환도 있음. 별도 자동실행 증거 없음|2026-11-10T10:46:55.965052Z|2026-11-10T10:49:44Z|[receipt6765401335](https://github.com/hkd620-lab/haru2026/pull/370#issuecomment-6765401335), 주요 지적 없음|
|3|[요청](https://github.com/hkd620-lab/haru2026/pull/370#issuecomment-6765591783) 09b31ddf, 정확한 시각은 github-issue-comments.json created_at|2026-11-10T11:00:05.939779Z|2026-11-10T11:03:14.112775Z|[리뷰5840802005](https://github.com/hkd620-lab/haru2026/pull/370#pullrequestreview-5840802005), unfenced 코드 지적|
|4|[요청](https://github.com/hkd620-lab/haru2026/pull/370#issuecomment-6766253853) 25ba8ab4, 정확한 시각은 github-issue-comments.json created_at|2026-11-10T11:34:58.345807Z|2026-11-10T11:38:05.407620Z|[receipt6766318359](https://github.com/hkd620-lab/haru2026/pull/370#issuecomment-6766318359), 지적 없음|

이 작업에서 Draft 생성 시 자동 리뷰 결과는 없었고 확인된 요청 실행은 위4회다. 결과 없이 대체한 실행 없음. 2시간 미응답 구간 없음.

## 지적과 반영

- [Jev 합성 테스트에서도 자동 분류 목록을 분리하세요](https://github.com/hkd620-lab/haru2026/pull/370#discussion_r4523925665): 09b31ddf에서 fixture를 AUTO_CATEGORIES로 수정. 전체82/82 통과. GitHub 댓글의 commit_id는 뒤 commit으로 재지정될 수 있어 첫 리뷰 HEAD는 reviews JSON commit_id로 확인한다.
- [수집기가 저장한 코드의 들여쓰기를 보존하세요](https://github.com/hkd620-lab/haru2026/pull/370#discussion_r4524081082): 25ba8ab4에서 unfenced 들여쓰기 전체보존, 회귀4시험 통과.

최종 25ba8ab4 요약 status completed, has_any_findings false, has_unresolved_findings false 확인. 독립4회 승인 원문은 claude4.raw.json. 모든 검토 실행 원문과 실패한2회 판정도 보존했다.

현재 원본745건은 원문·제목·출처 hash 보존. 전체 비분류필드 hash744건 일치, 나머지1건은 배포 전 2026-11-10T10:04:52Z 수동분류시각 필드가 추가된 상태며 원문 hash는 일치한다. 해당 수동 상태를 변경하지 않는다.
