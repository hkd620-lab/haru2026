# 개발자 영상 질문 권한 독립 검토

- 기준은 `b83ead77` 이후 `codex-video-finder-developer-20261121`의 구현·시험 diff다. 검토 후 연결부 주석을 실동작에 맞게 정리했다.
- 2026-11-21 KST에 별도 Astra 6.2 검토를 진행했다. Claude Code 주간 사용 한도로 해당 채널은 실행되지 않았다.
- 검토 범위는 Draft PR이다.

## 질문 원문

Independent read-only review of the working-tree diff at /private/tmp/haru-video-premium-20261121, branch codex-video-finder-developer-20261121 based on b83ead77. User wants existing registered HARU developer (same owner account) to be able to ask video questions without Premium. Non-developers must still require active Premium; developer role must come from authenticated UID and existing server allow-list, all AI/general consent, feature switch, abuse cap, completion, daily 10 and 120 minutes per Korea calendar month remain; no payment or deployment changes. Evaluate code, two app entry points and tests for authorization/cost lifecycle, and report concrete blockers or Draft PR approval. No editing, external API calls, paid requests, or deployment; use local diff/source. Original Claude review unavailable because weekly quota. Reply concise in Korean.

## 결과 원문

허대표님, **Draft PR 진행에 동의합니다.** HARU 본앱은 Firebase 인증 UID를, 독립 주소는 서버가 검증한 전용 세션의 UID를 사용합니다. 두 경로 모두 기존 서버 개발자 명단을 확인하며, 일반 계정에는 기존 프리미엄 구독 판정이 적용됩니다.

개발자도 기능 스위치와 두 동의를 통과해야 합니다. 사전 확인부터 비용 예약, 답변 저장까지 같은 권한 판정을 사용하며, 한국 시간 하루 10회·달력 월 120분 한도와 실패 호출을 포함하는 공급자 비용 상한이 유지됩니다.

가짜 YouTube·모델을 사용한 로컬 테스트 77개가 모두 통과했습니다. 결제·배포 변경은 없으며 운영 계정에서의 실제 질문은 미검증입니다.
