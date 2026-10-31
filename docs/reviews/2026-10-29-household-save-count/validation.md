# 가계부 저장 예정 건수 수정 검증

- 기준 main: bc639b5d29bf577c33885caf451377f785b8c002.
- 범위: 파일 가져오기 활성 시 하단 버튼도 파일 저장 핸들러를 사용. 추가 예정/중복 제외/선택 대기/중복 확인 필요/미선택을 구분. 최신 비교와 입력이 다른 경우 이전 제외 선택을 숫자에 반영하지 않음.
- 단위·SSR·기존 회귀 62개: frontend에서 node --import tsx --test test/householdAmount.test.mjs test/householdSummary.test.mjs test/householdExport.test.mjs test/householdDuplicates.test.mjs test/householdPdf.test.mjs test/householdSavePreview.test.mjs test/writeBeforeFormat.test.mjs test/writingDraftLifecycle.test.mjs test/originalSaveAutoTitle.test.mjs.
- 실제 SDK/기존 Rules 로컬 에뮬레이터 19개 통과. FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs. 추가/제외 표시와 실제 트랜잭션 결과 비교 포함.
- npm run build 통과: 실제 인증정보 대신 demo 프로젝트 더미 빌드 환경변수 사용. 최초 실행은 필수 환경변수 누락으로 종료되었으며 더미 설정 후 성공. 기존 청크 크기 경고 있음.
- git diff --check 통과. Functions/Rules/환경변수 설정/결제/인증/모바일/Firestore 경로 변경 없음.
- 운영 배포 전 실기기 운영 검증으로 간주하지 않음. 합성 자료와 로컬 에뮬레이터만 사용하며 금융 원본은 포함하지 않음.
- 사용자 승인: 검증·코드 검토 후 이상 없으면 PR 생성, main 병합, Hosting 운영 배포까지 명시 승인.
