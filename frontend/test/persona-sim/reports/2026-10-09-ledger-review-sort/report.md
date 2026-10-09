# PR #271 혼합 날짜 정렬 P2 반영 최종 검증

기능 HEAD `3799cdc6`. 검토 원문 https://github.com/hkd620-lab/haru2026/pull/271#discussion_r4228210633 . VAT·소득세 보고서에서 혼합 날짜를 허용하고도 원문 문자열로 정렬하던 문제를 정규화한 날짜·시간 기준으로 수정했다. 같은 날 시간 순서도 유지한다. 출력 날짜와 저장 원문 불변.

- `node --import tsx --test test/ledgerExportConsistency.test.mjs test/ledgerAmount.test.mjs`: 12/12 (혼합 날짜·같은날 시간 순서 회귀 추가).
- QA 가상 Firebase 값으로 npm run build 성공. 앱 코드 git diff --check 성공.
- p14 `2026-10-09T08-57-14`: 19단계·32/32, 실패/중단/발견/외부요청/미모의 함수/페이지오류0, 종료0.
- 기존 날짜대체 P2는 e0a66f5c 반영. 원문·증거는 이전 보고서에 유지. 리뷰 스레드 임의 resolve 없음.

운영 Firebase·실제AI·실기기 검증 없음, 병합·운영배포 없음. 독립 Claude 검토 미실행. 원 실행 로그는 변형하지 않고 보존하므로 Vite 원 로그의 trailing whitespace를 그대로 포함한다.
