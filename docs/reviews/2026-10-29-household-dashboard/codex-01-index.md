# Codex 실행 1 — PR #315

- 대상/요청 시 PR HEAD: 43f68f7713dbe6a960404973cf922ae9dde54f93.
- 요청: 없음(초안 ready 전환에 따른 자동 실행). ready 전환 2026-10-29T06:14:47Z, 요약 댓글의 시작 2026-10-29T06:14:47.077600Z.
- 질문 원문: 자동 실행. [요약 댓글](https://github.com/hkd620-lab/haru2026/pull/315#issuecomment-6489447061).
- 완료: 2026-10-29T06:16:21Z. [리뷰 ID 5693618175](https://github.com/hkd620-lab/haru2026/pull/315#pullrequestreview-5693618175).
- 지적: P2 “Include unformatted numeric amounts in the search index”. [원문](https://github.com/hkd620-lab/haru2026/pull/315#discussion_r4409267280). 쉼표/한글 단위 금액을 숫자만 입력해 검색할 수 없음.
- 조치: 수용. 파싱한 숫자의 구분자 없는 문자열을 검색 인덱스에 추가하고 12,000원→12000, 1만원→10000, 음수 -5천원→-5000 회귀 검증을 추가. 반영 커밋은 다음 보조 색인에 기록. 최신 HEAD 재검토 필수.
