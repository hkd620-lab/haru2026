# PR #295 독립 검토 1 — 질문 원문

- 대상 HEAD: `1a174372086f46202250cd4b705a72fb739f295a`

````text
당신은 HARU2026 저장소의 독립 설계·완료 검토자입니다. 파일을 절대 수정하지 말고(읽기·git·gh 조회만), 결과만 한국어로 회신하세요. 로컬 브랜치를 바꾸지 말고, 실행이 필요하면 git archive로 scratchpad에 풀어서 하세요(저장소 안에서 functions npm run build 금지).

대상: /Users/heogyeongdae/Developer/HARU2026 (GitHub hkd620-lab/haru2026), PR https://github.com/hkd620-lab/haru2026/pull/295 (base main, head cc/stats-merge-followups). 변경은 `gh pr diff 295`. 요구사항은 PR 본문과, PR #291 본문의 '후속 과제' 절(https://github.com/hkd620-lab/haru2026/pull/291), 그리고 결정 ② "텃밭은 기록마다 고른 작물만 저장" (Slack https://harulab-hq.slack.com/archives/C0C11P98MHV/p1792733293429289). 규칙: CLAUDE.md, docs/HARU2026_Slack_운영정책.md 8.1절.

확인할 것
1. 정확성: SayuModal 작물 채우기 제거로 생기는 회귀(텃밭 원본 보기·다시 다듬기·원본 저장), getRecordsInRange throwOnError 추가가 다른 호출부에 영향 없는지, 통계 두 화면의 실패 안내 경로, EPUB 이스케이프로 기존 표시가 깨지는지(이미 이스케이프된 값 이중 처리 등), photoOnly 안내 조건.
2. 요구사항 충족·누락.
3. 규모(소/중/대)와 8.1 멈춤 조건 해당 여부.
실제 실패 시나리오가 있는 것만 차단 지적으로, 나머지는 비차단 메모로.

회신 형식: 첫 줄 '판정: 승인 / 수정 후 승인 / 재설계' 중 하나, 지적(심각도·파일:줄·실패 시나리오·제안), 규모·멈춤 조건, 검토 대상 HEAD SHA.
````
