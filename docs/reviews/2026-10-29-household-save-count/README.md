# 가계부 추가·중복 제외 건수 표시

- PR https://github.com/hkd620-lab/haru2026/pull/313
- 브랜치 codex-household-save-count. 기능 검토 HEAD d365b21f045e9216e219672f0022a1f49b4dde2a.
- 사용자 승인: 검증·코드 검토 후 이상 없으면 PR·main 병합·Hosting 운영 배포 진행.
- 기능: 파일 미리보기·하단 버튼의 저장 대상 통일, 추가 예정/중복 제외/선택 대기/재확인/미선택 구분. 재확인 결과 병합과 JSON 왕복 시 비교 보존. 완료 알림도 추가/제외로 통일.
- 검증: 단위·SSR·회귀 64/64, 실제 SDK·기존 Rules 로컬 에뮬레이터 19/19, 더미 설정 빌드 성공. [최종 검증](validation-03.md), [명령 출력 요약](command-results.txt).
- [Codex 1차](codex-01-index.md) P2는 d365b21f에 반영. [2차](codex-02-index.md) completed/지적 없음. [독립 검토 모든 실행](claude-index.md): 최종 원문 **판정: 승인.** 규모 중, 멈춤 조건 해당 없음.
- 이 기록 이후에는 docs/reviews/ 아래 새 검토 기록만 추가하는 예외 적용 여부를 필터 없는 git diff --name-status d365b21f..HEAD로 확인. 최종 PR HEAD CI도 별도 확인.
- 비차단 한계: 이미 저장된 행 수정 후 재선택 UX, 모두 자동 제외 시 비활성 버튼 문구, 일부 선택 에뮬레이터 추가 사례, 가져오기 활성 시 수동 입력 저장 안내 및 미선택 겹침 화면 이동 권고. 범위 밖 후속 기능으로 남김.
- 배포 범위 Hosting만. Functions/Rules/환경변수/결제/인증/모바일/Firestore 경로 변경 없음.
- 롤백: PR 병합 커밋 revert 후 Hosting 배포. 데이터 삭제·이동 불필요.
- 운영 결과는 배포 후 Slack 확정 기록과 배포 Actions에 기록한다. 실기기 금융 파일 운영 E2E는 별도 확인.
- 작업 난이도: 5.5 중간.
