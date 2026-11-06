# 홈 주식 비서 추천 결정 보완 — 2026-11-06

앞선 `2026-11-06-home-followups-validation.md`의 주식 비서 결정 대기 상태를 보완한다.

- 허대표님은 이 채팅에서 “홈 추천 안내에도 표시하되, 사용자의 내 비서 목록에는 자동 추가하지 않는 안”에 “기장의 추천에 따름”으로 승인했다.
- `HomePageV2.tsx`의 기존 추천 표시 목록에 `HARU주식관리`만 추가했다. 기존 미선택 비서 필터와 미리보기 열기 동작을 그대로 사용한다.
- 저장된 내 비서 선택·기본 선택값·Firestore 쓰기·AI 호출은 바꾸지 않았다. 이미 내 비서에 선택된 주식 비서는 중복 추천하지 않는다.
- 변경 후 검증: `homeRecordComposer.test.mjs`·`devConsoleCleanup.test.mjs` 14/14, `homeAssistantSelection.test.mjs`·`assistantRecommendations.test.mjs` 45/45 통과. 합성 Firebase 환경값을 사용한 `npm run build` 통과. `git diff --check` 통과.
- 이번 후속 PR의 일부이며 병합·운영 배포 승인을 뜻하지 않는다.
