# PR #357 보완 후 브라우저 확인

- 대상 미리보기 배포: 코드/기록 HEAD `737be740c25f392d488a758c46c7450c472f5492`.
- CI build_and_preview / Deploy Preview SUCCESS: https://github.com/hkd620-lab/haru2026/actions/runs/42376159693
- 미리보기: https://haru2026-8abb8--pr357-codex-ccr-followups-3cespho2.web.app
- `/gyeongdae-preview`: 기본 문장을 수정하지 않고 건강 탭 선택 → 건강 예시 원문/정리 결과가 함께 나오고 `SAYU 정리 예시`로 표시. `오늘은 속상했다.` 직접 입력 → 원문과 직접 입력한 문장 동일, section 제목은 `직접 입력한 문장을 확인해 보세요`. 고정 분류/질문은 각각 `예시 기록의 분류`, `이어 쓰기 질문 예시`로 표시되고 상단 안내에도 포함. AI 실행/저장 없음.
- 체험 390px DOM width/scrollWidth 375/375, 320px 305/305로 넘침 없음.
- `/onboarding`: `한 줄 기록을 정리하고, 기간별로 다시 살펴보세요`, 원문 사실·감정 유지/표현 다듬기 및 모아보기/작성 현황 설명 표시. 320px 305/305로 넘침 없음. 완료/건너뛰기/실제 기록 쓰기 버튼은 누르지 않음.
- 임시 viewport override reset 호출. 실기기 운영 E2E 또는 AI 결과 품질 시험으로 확대하지 않음.

외장 보관: `/Volumes/LaCie/Mac_작업/완료자료/HARU2026/20261107_214953_CCR_후속_검증/haru-pr357-preview-qa.jpg`. 같은 폴더에 보완 후 테스트 3종·빌드 로그 포함 총 5파일을 새 파일로 복사. LaCie UUID 대조 및 파일별 SHA-256 원본/복사본 일치 확인. 검증 목록은 `pr357-revision-validation-sha256.json`.
