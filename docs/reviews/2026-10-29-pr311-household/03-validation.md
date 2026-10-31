# PR #311 필수 검증과 배포 승인 범위

- 코드 HEAD: `fc925f38aa4bb1bb0054e3bc86ab4304bd3293ed`.
- 허대표님 현재 대화 지시: “좋아. PR #311 검토 결과를 확인하고 문제가 없으면 main에 병합·배포한 뒤 운영에서도 합계와 잔액 카드 숨김이 제대로 반영됐는지 확인해줘.”
- 대상: `haru2026-8abb8` 웹 Hosting만. Functions·Rules·저장 경로·환경변수·결제·인증 변경 없음. 중복 처리·운영 데이터 변경 제외.
- 검증 명령: `cd frontend && node --import tsx --test test/householdAmount.test.mjs test/householdSummary.test.mjs test/householdExport.test.mjs`. exit 0, 22/22 통과. 원문은 04-test-output.txt.
- 최초 `npm run build`: 필수 Firebase 환경변수 미설정으로 prebuild 실패. 실패를 숨기지 않는다.
- PR CI의 시험용 Firebase 값과 동일하게 VITE_FIREBASE_API_KEY=dummy, AUTH_DOMAIN=dummy.firebaseapp.com, PROJECT_ID=dummy, STORAGE_BUCKET=dummy.firebasestorage.app, MESSAGING_SENDER_ID=000000000000, APP_ID=1:000000000000:web:dummy 를 VITE_FIREBASE_ 접두사와 함께 제공한 `npm run build`: exit 0. `built in 37.84s`, PWA generateSW 성공. 운영 설정 검증으로 주장하지 않는다.
- 코드 HEAD CI 및 Preview 성공: https://github.com/hkd620-lab/haru2026/actions/runs/40777571831 .
- `git diff --check` 통과. 파일 변경은 웹 집계·표시·엑셀 및 관련 테스트 8개.
- 390px 합성 데이터에서 가계부·상세 정적 렌더링의 합계·잔액 카드 숨김 확인. 운영 데이터 E2E와 구분한다.
- 독립 검토 판정 원문: **승인**. Codex 최신 코드 HEAD completed, 지적 0건. 비차단 권고는 01 원문에 보존했다. 원형 차트 음수 처리·엑셀 월 선택 기준·안내 행 위치·테스트 의존성은 후속 검토사항이다.
- 이 문서는 배포 전 기록이다. 최종 HEAD CI 및 docs/reviews 추가 전용 diff 확인 후 승인된 main 병합·Hosting 배포를 진행한다.
- 실제 운영 접근과 기존 가계부 기록을 읽기 전용으로 확인했으나 아직 배포 전이다. 거래 세부·금액·명의·계좌 정보는 이 문서와 Slack/PR에 기록하지 않는다.
- 배포 후 코드/서비스 반영과 실제 기록 계산을 구분해 검증한다. 실기기 검증 완료로 주장하지 않는다.
