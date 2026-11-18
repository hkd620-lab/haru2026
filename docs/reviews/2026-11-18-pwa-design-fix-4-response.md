# PR #407 홈 선택 버튼 대비 보완

Codex 실행 4의 질문/결과 원문 링크와 대상·시각은 `2026-11-18-pwa-design-codex-review-04.md`에 보존했다.

- `HomePageV2.tsx`의 공유 HomeModeButton 선택 배경을 글자용 `--haru-accent-ink`에서 배경용 `--haru-accent`로 변경한다. 라이트 색상은 기존과 동일하며 다크에서만 적절한 어두운 배경을 사용한다. 선택 글자는 기존 밝은 색을 유지한다.
- 글자용 accent-ink가 background로 단독 쓰이는 제품 위치를 검색해 해당 선택 버튼 한 곳임을 확인했다. 다른 위치는 글자/경계용으로 사용한다.
- 격리 실제 홈의 ‘내 하루기록’과 ‘내 하루비서’ 선택 버튼 모두 다크 배경 rgb(82,103,53)·글자 rgb(245,240,232) 확인, 대비 계산 5.53:1. 전체 보기 선택 후 선택 상태/동일 대비와 비서 목록 전환도 확인했다. API·개인 기록 연결 없음.
- 증거: `/private/tmp/haru-pwa-home-tabs-dark-fixed.jpg`. 추가 시험·제품 빌드 로그: `/private/tmp/haru-pwa-tests-fix4.log`, `/private/tmp/haru-pwa-build-fix4.log`. 제품 빌드 성공(QA 값), 홈 관련 8개와 생성 SW 4개 모두 통과.

최신 코드 Codex 및 이전 원문 전체를 포함한 독립 Claude 재검토가 남았다. draft PR 유지, main 병합·운영 배포 및 운영 완료 판정은 보류한다.
