# PR #271 P2 날짜 출력 반영 검증

기능 HEAD `e0a66f5c93b157e2a91a78230a16d094c2cd7f42`, 이전 `90b7c1ba`.

Codex 원문: https://github.com/hkd620-lab/haru2026/pull/271#discussion_r4227985621 . 날짜 필터만 입력일로 대체하고 출력 날짜가 빈 값/잘못된 값으로 남는 P2를 출력용 복사본에 입력일을 넣어 반영했다. 유효 거래 날짜/시간과 저장 원문 유지. 회귀 테스트에서 빈 날짜·2026-02-30 거래의 XLSX 날짜 셀이 2026-10-03으로 나오는 것을 추가 확인했다.

- `node --import tsx --test test/ledgerExportConsistency.test.mjs test/ledgerAmount.test.mjs`: 11/11.
- QA 가상 Firebase 환경변수로 npm run build 성공, git diff --check 통과.
- 격리 모바일 p14 `2026-10-09T08-29-44`: 19단계·32/32, 실패/중단/발견/외부요청/미모의 함수/페이지오류0, 종료0.

실제 AI·운영 데이터·실기기 검증 없음. 독립 Claude 검토 미실행. 재검토 요청 https://github.com/hkd620-lab/haru2026/pull/271#issuecomment-6077352601 . 열린 리뷰 임의 resolve 없음. 병합·운영배포 없음. 이전 증거와 기대값 보정 이력은 원본 보고서에 보존한다.
