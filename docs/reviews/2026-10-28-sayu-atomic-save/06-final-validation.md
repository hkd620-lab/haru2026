# SAYU 원자 저장 검증 요약

- 검토 대상 HEAD: 91bc4dfd700be7dd231c96c75f1afab9a4014464.
- 코드: SayuModal, SayuPage. 테스트: sayuEditedTitle.test.mjs, statsStorage.policy.test.cjs. 다른 제품 코드 변경 없음.
- CC 보완 검증: frontend에서 `node --test test/sayuEditedTitle.test.mjs`: 13/13 통과. `node --test test/statsStorage.policy.test.cjs test/sayuMobileReadingUx.policy.test.cjs test/snsStoryCreator.policy.test.cjs`: 3/3 통과.
- 최종 웹 빌드: frontend에서 `npm run build`, exit0. VITE_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID에 합성 검증값 사용. 빌드 결과 `✓ built in 1m 6s`, PWA 생성 완료. 로그 `/private/tmp/haru-atomic-build-final.log`. 실제 운영 환경값·연결을 검증한 빌드가 아니다.
- 최초 빌드는 같은 합성 환경으로 exit0. 기본 환경으로 실행한 CC 빌드는 필수 환경값 누락으로 prebuild 실패했고, 이후 위 빌드로 보완했다.
- 별도 테스트 7건의 기존 실패와 최초 근거 정정은 03 기록 참조. 해당 오류를 수정했다고 주장하지 않는다.
- tsc 실행파일 미설치로 독립 타입검사 미실행. Vite 빌드를 타입검사로 주장하지 않는다.
- 최신 검토 대상 CI/Preview: SUCCESS, https://github.com/hkd620-lab/haru2026/actions/runs/40553685769 . Codex completed·지적0은 04, 독립 승인 원문은 05.
- 이후 검토 기록만 추가하는 커밋은 모든 항목이 A이며 docs/reviews/ 아래인지 전체 `git diff --name-status 91bc4dfd..HEAD`로 확인해야 한다. 최종 CI도 별도로 확인한다.
- Functions·Rules·환경변수 정의·모바일·AI 호출·결제/인증 정책 변경 없음. Firestore users/{uid}/records/{id}, 리전 asia-northeast3 유지. 운영 데이터 변경 없음.
- PR #305는 초안, main 병합·운영 배포 미실시. Preview만 CI로 배포됐다. 운영 화면 E2E 미실시. 승인 후 운영 검증 시 제목·본문 동시 변경 저장, 목록·검색·재열기, 공개본 반영을 확인해야 한다.
