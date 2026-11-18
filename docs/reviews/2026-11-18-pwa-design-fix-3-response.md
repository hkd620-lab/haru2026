# PR #407 질문 결과 패널 대비 보완

Codex 실행 3 원문/시각/대상은 `2026-11-18-pwa-design-codex-review-03.md`에 보존했다.

- HaruLawPanel의 기존 밝은 질문·결과 UI 전체에 `haru-light-surface` 및 명시적 밝은 배경을 적용한다. 공유 HaruLawAnswer 본문은 이 경계의 어두운 토큰을 상속한다. 저장된 Sayu 답변은 기존 다크 토큰을 그대로 유지한다. 질문 처리·AI·첨부·저장·정책은 바꾸지 않는다.
- 사용처 전수 확인: 제품의 HaruLawAnswer 사용처는 HaruLawPanel과 SayuPage 두 곳이다. 양쪽 모두 실제 컴포넌트로 합성 비법률 표시 상태를 렌더해 확인했다.
- 격리 브라우저 fixture에서 HaruLawPanel만 실제 컴포넌트로 가져오고, useHaruLaw는 실행하지 않는다. Firebase/AI/첨부 쓰기 함수는 mock에서 명시적으로 오류를 내도록 막아 운영 연결 없이 화면을 검증했다.
- 다크 선호 상태의 질문 결과: 카드 배경 rgb(255,255,255), 본문 rgb(44,44,42). 날짜·질문 라벨도 밝은 표면 위에 어두운 글씨로 확인했다. 저장 답변: 배경 rgb(43,49,39), 본문 rgb(240,241,233) 유지.
- 증거: `/private/tmp/haru-pwa-law-panel-light-fixed.jpg`, `/private/tmp/haru-pwa-law-policy-fix3-final.log`, `/private/tmp/haru-pwa-build-fix3-final.log`. lawEasyExplain 정책 시험 통과. 최종 제품 빌드 통과(QA 값), 생성 SW 시험 4개 통과.
- 검토 중 mock export 미비로 빈 화면이 발생한 첫 시도는 성공 근거로 사용하지 않았다. mock 보완 후 실제 UI와 DOM 색상을 확인했다.

독립 Claude 원문 판정/이전 자동 리뷰를 보존하며 최신 코드의 Codex → 독립 Claude 순서로 재검토한다. 운영 배포와 실기기 E2E는 보류한다.
