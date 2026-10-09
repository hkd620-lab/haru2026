# ② 보조장부 엑셀·집계 정합 PR 인수인계

정본 `2026-10-08-codex.md`와 허대표님 최신 지시가 우선한다.

## 현재 확인된 상태

- ① A단계 22/22칸 완료 상태 유지. 신규 F-26~F-32 수정·C단계 금지. ③ 미허용. 이번 ②는 기장이 실행, CC는 검토만.
- ②의 중대 F-13~F-16 구현·로컬 검증 완료. 초안 PR <https://github.com/hkd620-lab/haru2026/pull/271>, main 기준 `4db3ce79`, 기능 HEAD `90b7c1ba3f67da3c38f0392d14b0313e4eca100d`, 작업 브랜치 `codex-ledger-export-consistency`, push 원격 일치 확인.
- 작업본 `/private/tmp/haru-ledger-export-consistency`. 앱 변경은 `frontend/src/app/services/ledgerExportService.ts`와 `frontend/test/ledgerExportConsistency.test.mjs` 2개. `frontend/node_modules` symlink·`frontend/test/persona-sim/`은 검증용 미추적 파일로 앱 PR에 포함하지 않았다. 임의 삭제하지 않는다.
- 단위 회귀 7+기존 금액 4=11 통과. QA 가상 Firebase 값으로 최종 `npm run build` 성공. `git diff --check` 통과. 기능 커밋 전에 대상 2파일 확인.
- 최종 p14 `2026-10-09T07-45-28`: 19단계 실패/중단 0, 32/32 충족, 발견·외부 요청·미모의 함수·페이지/브라우저 오류 0. 종료코드 0.
- 첫 실행 30/32·종료코드1도 보존. 미충족2는 종결 F-20과 F-16 수정 전 대조 기대값. 보정 후 점 날짜5+하이픈 날짜1의 실제 합계와 정확한 지출합계 확인. 기대값 수정 diff·원본 대응 결과 보존, UID는 게시용 결과에서 합성 식별자로 치환.
- 증거 커밋 `8612e7ca771899d1f50bd97eebe58eaabb3879a9`, 개발 브랜치 `claude/elegant-noether-z5zy29`에 push·원격 일치. `reports/2026-10-09-ledger-consistency/report.md`, 결과2개, 로그2개, 보정diff, 화면5장, SHA256. 개발 브랜치의 오래된 앱 코드는 main 병합 금지.
- 기준 `/Users/heogyeongdae/Developer/HARU2026`는 `codex-harulaw-question-input-size`/`e406c19a` 깨끗한 상태 보존. 서버18762 종료 확인.
- PR #271 CI·프리뷰와 Codex 리뷰는 최신 GitHub에서 재확인한다. 현재 독립 Claude 검토 미실행. main 병합·운영 배포·실제 AI·운영 E2E 없음. 판정①·운영 완료로 기록하지 않는다.

## 다음 첫 행동

1. 작업위치.md, 실제 pwd/branch/status 및 Slack 대표 스레드 최신 지시 확인. PR #271 CI/프리뷰·Codex 리뷰 최신 상태 확인. 리뷰 실행이 실제로 없으면 무응답/대체됨으로 꾸미지 않는다. 실제 검토 요청을 한 경우 요청시각·대상 HEAD·링크를 정책대로 새 색인에 기록한다.
2. CC 검토 요청은 대표님 전달 기본. Codex subagent로 독립 Claude 검토를 대체하지 않는다. 전달문: "PR #271, HEAD 90b7c1ba3f67da3c38f0392d14b0313e4eca100d 및 회귀 보고서를 검토해주세요. 거래별 월 필터·빈/잘못된 날짜 대체·지출만 집계·vatDeduction 우선·점/슬래시/년월일 집계, 원문 불변·저장경로/리전/비용 불변, 작업규모/멈춤조건을 확인하고 승인/수정 후 승인/재설계로 회신해주세요. 파일 수정 금지, 본 건 이전 독립 Claude 검토 없음."
3. F-17~F-19는 별도 소규모 PR로 구현할 남은 ② 작업. 최신 origin/main에서 별도 worktree와 목적 브랜치를 사용한다. F-17은 이번 p14에서 집계가 정상화돼 빈 조건이 발생하지 않은 것이며 아직 0건 다운로드 코드가 남아 있어 해결 아님. 정확한 빈 기간 회귀 테스트를 추가한다. F-18 초과 사진 안내, F-19 invalid-argument 글자수 안내. p15/p16 격리 회귀로 확인하고 하네스를 앱 PR에 섞지 않는다.
4. PR #270 독립 Claude 검토 상태도 최신 조회가 필요하다. 이전 HEAD `1dacf47c`, 대표 화면 하루LAW1장 확인 완료. 임의 병합·배포 금지.

금지: routes.tsx/HaruRawPage.tsx/.zombie/숨김 LibraryPage, 홈·라우터, 저장 경로·리전·Rules·결제·인증·새 AI 호출 변경. 열린 리뷰 resolve 금지. 운영 Firebase 연결 프리뷰에서 새 테스트 기록 저장 금지. 병합·운영 배포는 PR마다 허대표님 확인.

난이도 **5.5 중간**. 소비량 실측 **미확인**.
