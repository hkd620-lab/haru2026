# 레거시 전체 합계 수정 최종 검증

기준 HEAD 28873c6c8abd2cdbb599084477cbc5a9aed0a913 이후 CC 수정. Codex 실행2의 P2 4411045874를 수용했다. 아직 최신 HEAD 재검토·CI 전이므로 병합하지 않는다.

- 변경: SAYU 상세·전체 합계 공통 읽기, 숫자 레거시 금액/원본문 전달 복구, 기본 닫힌 작성 당시 본문 보기. 원본 칸 편집 값이 읽기 전용 원본보다 우선한다. 저장 경로·원본 수정 없음.
- 단위·SSR: frontend에서 node --import tsx --test --test-reporter=tap 로 이전23 기록의 같은16개 파일 실행, **182/182 통과**. [원문](29-final-unit.txt). 추가3건은 실제 Page 집계/원본 칸 함수와 Modal 렌더 함수를 연결해 3000+5000=8000, [] 단건, 월별 범위, 이체/음수/중복보존, 본문·원본 불변 확인.
- 실제 SDK/기존 Rules: FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test --test-reporter=tap test/householdSave.emulator.test.mjs test/householdEdit.emulator.test.mjs, **36/36 통과**. [원문](29-final-emulator.txt). demo 프로젝트 합성 데이터만 사용.
- npm run build: 6개 VITE_FIREBASE_* 합성 설정으로 prebuild 환경검사+Vite+PWA **통과(exit0)**. 1m11s, 3554 modules, precache791. 기존 청크/Browserslist 경고. 로컬 합성 dist 배포 금지. 실제 설정은 PR CI/Hosting workflow 확인.
- git diff --check **exit0**. source diff는 --unified=0 28873c6c -- frontend/src frontend/test로 만들었다. [수정 diff](29-legacy-totals-source.diff).
- 앞선 검토기록 형식 수정 실측: git diff --name-status 75f2f0ce..28873c6c 결과 M docs/reviews/2026-10-29-household-supplements/23-review-fix-source.diff, A docs/reviews/2026-10-29-household-supplements/23-source-diff-format-note.md. git diff --check 75f2f0ce..28873c6c exit0. 독립26에서 출처 대조 수용. 기존 파일 수정이므로 추가만 예외를 적용하지 않았다.
- 브라우저: 실제 함수 SSR 합성 HTML을 별도 localhost18771에서 열어 지출8000과 최신메모, 기본닫힘 본문을 확인하고 펼쳐 두 줄 그대로 확인. [합성 화면](29-sayu-legacy-totals.png). **전체 SayuPage 앱 E2E는 아니며** 원본함수 조합/표시 검증이다. 운영 거래 저장 없음. 기존 현금/편집 계정전환 검증은23 참조.
- tsc는 기존 ExportModal 구문 오류로 차단된 상태 유지. CC가 추가214개 테스트 통과와 성장6+savedOpen1 기존 isSpecialDayRecord 실패를 보고했으며 원문28 보존. 이번 담당 실행의 확정값은182+36이며 기존 실패 대조는14/23 참조.
- core users/{uid}/records/{date}, Functions asia-northeast3, Rules/인증/결제/AI/환경변수/모바일/라우터 변경 없음. 기존529건은 읽기만 했고 운영 쓰기 없음.
- 전체 장부:1~3 구현·검증,4 카드/이중계산 연결,5 고정/할부,6 배분,7 실제잔액,8 저축/선택가계부 조회공유,9 자동연동 미구현. iPhone PWA 실기기 추가E2E 필요. 최신Codex+독립승인+CI 후 승인 범위의Hosting만 배포.
