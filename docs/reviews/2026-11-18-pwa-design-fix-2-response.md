# PR #407 두 번째 검토 지적 반영

대상 Codex 원문: `2026-11-18-pwa-design-codex-review-02.md`. 이전 독립 Claude 판정 ‘수정 후 승인’ 1회는 유지하며, 이번은 자동 코드 검토 후 보완이다. 기존 검토 기록은 수정하지 않았다.

- 저장된 하루LAW 답변: `frontend/src/styles/index.css`의 본문·강조·제목·링크·코드·경계를 테마 토큰으로 맞췄다. 인쇄에서는 기존 어두운 글자·밝은 코드 배경을 유지한다. 법률 문구·AI 호출·저장 동작 변경 없음.
- 내 하루비서 관리: `HomePersonalizationModal.tsx` 최상위에 기존 `haru-light-surface` 경계를 적용해 밝은 헤더/카드와 어두운 글씨가 함께 유지된다. 선택·저장 동작 변경 없음.
- 격리 브라우저: 실제 HaruLawAnswer를 표시하는 합성 비법률 문장으로 다크 배경 rgb(43,49,39), 본문/강조 rgb(240,241,233), 제목 rgb(188,212,255)를 확인했다. 실제 개인화 창에서 밝은 배경·어두운 제목/설명/미선택 카드도 화면 확인했다. 저장 사용자 자료·운영 API는 사용하지 않았다.
- 검증: lawEasyExplain policy 통과, homeAssistantSelection/homeRecordComposer 8개 통과. QA Firebase 값으로 제품 빌드 통과, 생성 SW 시험 4개 통과. 기존 큰 청크·동적 import 경고는 유지된다.
- 원본 증거 임시 경로: `/private/tmp/haru-pwa-law-answer-dark-fixed.jpg`, `/private/tmp/haru-pwa-personalization-light-fixed.jpg`, `/private/tmp/haru-pwa-tests-fix2.log`, `/private/tmp/haru-pwa-build-fix2.log`.
- 기존 확장 시험 107개 중 101개 통과/6개 기존 main 동일 실패, 별도 SW 4개 통과 근거는 첫 보완 기록에 보존한다. 기존 6개는 성장 타임라인 하네스의 isSpecialDayRecord ReferenceError이며 이번 UI 변경과 분리한다.

최신 코드의 Codex 재검토 및 이전 판정 원문/모든 반영 내역을 동봉한 독립 Claude 재검토가 남았다. 초안 PR 유지, main 병합·운영 배포 및 실기기 운영 완료는 보류한다.
