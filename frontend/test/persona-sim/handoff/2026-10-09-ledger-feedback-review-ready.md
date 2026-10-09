# ② F-13~F-19 구현·Codex 검토 인수인계 및 CC 전달문

판정: **⚠️ 부분완료**. 구현·로컬/격리 검증·작업브랜치 push·Codex 검토 완료. 독립 Claude 검토·대표 PR별 확인·main 병합·운영 배포·실기기 E2E 없음. 자동판정① 아님.

## 현재 기준

- PR #271 https://github.com/hkd620-lab/haru2026/pull/271 — codex-ledger-export-consistency. 기능 `b1fe10848c8fc9e360b476896505ef11f79f6efb`, 최종 색인 포함 `a4c8d034883a8645ebdc929c64e8734c9e6a0b32`, 원격 일치. 최신 a4c8d034 CI/프리뷰 SUCCESS 실측(2026-10-09T09:52:42Z). 근거 https://github.com/hkd620-lab/haru2026/actions/runs/37913839736 . 다음 작업 시작 시 변경됐는지 재확인한다.
- PR #272 https://github.com/hkd620-lab/haru2026/pull/272 — codex-record-feedback-guards. 기능 `5ab44d90356c36c74183be4cdaf319eb9c58aeac`, 최종 `0500bf3ed935fcdcacbd9f4586fc49627ce15cdb`, 원격 일치·최종CI/프리뷰 성공. 원격 codex 이름 충돌 때문에 브랜치 이름은 하이픈 사용.
- 두 PR은 draft/open, base main `4db3ce79`에서 시작. 앱2+회귀1 파일 범위, 뒤의 검토 기록은 docs/reviews 신규 파일뿐이다. 필터 없는 `git diff --name-status b1fe1084..a4c8d034`은 A docs/reviews 3파일, `git diff --name-status 5ab44d90..0500bf3e`는 A docs/reviews 2파일. 재검토 대상은 위 기능HEAD, CI는 최종HEAD 기준. 두 PR 최종CI/프리뷰 성공. #272 CI 근거 https://github.com/hkd620-lab/haru2026/actions/runs/37908180269 .
- #271 F-13~F-16: 거래일 필터·빈/잘못된 날짜 입력일 대체(출력행 포함)·지출만 계정집계·저장 공제값 우선·다양한 날짜 읽기·신고자료 날짜/시각 순서. 원문 저장 불변.
- #272 F-17~F-19: 사업용VAT0건/소득세지출0건은 다운로드/객체URL0, 초과사진 선택·완료에 제외장수 안내(3장/10장 유지), 글자수 invalid-argument는 안내문 포함5000자 제한 안내. 기존 AI 호출·월한도·다른오류 분기 유지.
- 단위 #271 12/12, #272 13/13, 두 PR 동시 적용 격리 21/21·패치충돌 없음. 각 QA가상Firebase 빌드·앱diffcheck 성공. p14 최신19단계/32점검 통과·발견0·외부요청0. 빈기간전용p17 3단계/4점검 통과. p15/p16 목표 F18/F19 확인, 전체는 기존 범위밖 F21~F25 때문에 미충족4/발견5/종료1. 전체통과로 바꾸지 않는다.
- 원문 증거: https://github.com/hkd620-lab/haru2026/blob/53bcb2cf/frontend/test/persona-sim/reports/2026-10-09-ledger-review-time-final/report.md 및 https://github.com/hkd620-lab/haru2026/blob/ddde894b/frontend/test/persona-sim/reports/2026-10-09-record-feedback-final/report.md . 증거브랜치 오래된 앱 main 병합 금지. 첫 글꼴 오류 로그·토스트 가림 보완 전후 결과·기대값 보정 이력도 원본 보존.

## Codex 실행 기록

- #271 실행1(90b7c1ba): P2 날짜대체 출력 누락 → e0a66f5c 반영.
- #271 실행2(e0a66f5c): P2 혼합날짜 문자열 정렬 → 3799cdc6 반영.
- #271 실행3(3799cdc6): P2 한 자리 시각 정렬 → b1fe1084 반영.
- #271 실행4(b1fe1084): https://github.com/hkd620-lab/haru2026/pull/271#issuecomment-6077999286 원문 “Codex Review: Didn't find any major issues. Nice work!” 완료2026-10-09T09:14:20.919012Z.
- #272 실행1(5ab44d90): https://github.com/hkd620-lab/haru2026/pull/272#issuecomment-6077399620 원문 “Codex Review: Didn't find any major issues. More of your lovely PRs please.” 완료2026-10-09T08:33:34.829612Z.
- 요청/시각/대상/지적/반영/결과 색인은 각 PR docs/reviews 신규파일에 보존. 리뷰스레드 임의resolve 없음. 이전 실행 숨김 없음.

## 허대표님이 CC에 전달할 검토 요청

PR #271 기능 b1fe10848c8fc9e360b476896505ef11f79f6efb 및 최종 a4c8d034, PR #272 기능5ab44d90356c36c74183be4cdaf319eb9c58aeac 및 최종0500bf3e를 독립 검토해 주세요. 파일 수정 금지. 본 건 이전 독립 Claude 검토는 0회(미실행)입니다. 모든 이전 Codex 지적 원문은 아래에 그대로 포함합니다. 범위는② F-13~F-19이며 작업③ 노출정책·F26~32·C단계는 미허용입니다.

거래별월/기간·빈/잘못된날짜의 분류/출력 대체·원문불변·지출집계·공제값·혼합날짜/한자리시각 순서, 빈기간 실제 다운로드0와 유효파일유지, 3/10장 및 남은칸 안내/원본보존, 글자수오류와 월한도/연결오류 분기, p15/p16 범위밖 기존미해결과 새회귀 구분, 두PR 동시적용, 작업규모(소/중/대)·멈춤조건 해당여부를 확인해 “승인 / 수정 후 승인 / 재설계”와 근거로 회신해 주세요. 저장경로 users/{uid}/records/{date}·Functions asia-northeast3·Rules·결제/인증·권한·AI호출/모델/비용은 변경하지 않았습니다. 독립 검토 결과원문은 docs/reviews 새 파일로 저장하고 정책8.1 색인/Slack을 따릅니다. Codex 무지적 결과를 독립 Claude 승인으로 대체하지 마세요.

### 이전 Codex 지적 원문(누락 없음)

https://github.com/hkd620-lab/haru2026/pull/271#discussion_r4227985621

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Propagate the fallback date into the exported row**

When a `ledger_entries` date is blank or invalid, `filterDate` correctly falls back to the record date, but this final mapping discards that fallback and returns the unchanged entry. The XLSX writer subsequently reads `e.date`, so an October workbook can include a row whose displayed date is blank or impossible (for example, `2026-02-30`) rather than the record date used to classify it as October; the new regression test only verifies counts and vendors, so it misses the incorrect date cell. Preserve the original storage value while copying the fallback into the exported entry’s date.

AGENTS.md reference: [AGENTS.md:L65-L70](https://github.com/hkd620-lab/haru2026/blob/90b7c1ba3f67da3c38f0392d14b0313e4eca100d/AGENTS.md#L65-L70)

Useful? React with 👍 / 👎.

https://github.com/hkd620-lab/haru2026/pull/271#discussion_r4228210633

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Sort tax report rows by normalized dates**

When a report contains multiple accepted date formats, the new normalization admits them into the same period but both `buildLedgerVatReport` and `buildLedgerIncomeTaxReport` still sort the retained raw `entry.date` strings. For example, September's `2026년 9월 1일` is placed after October's `2026-10-01`, so the generated VAT and income-tax workbooks are no longer chronological. Preserve the raw value for output if required, but sort with the normalized date used for filtering.

Useful? React with 👍 / 👎.

https://github.com/hkd620-lab/haru2026/pull/271#discussion_r4228429303

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Normalize time widths before sorting report rows**

When a same-day transaction uses an unpadded time accepted by the free-text 거래일시 field (for example, `2026-09-28 9:00`), `normalizeLedgerDate` pads only the date and preserves the time suffix, so this string comparison places `14:00` before `9:00`. The same comparator is used by the income-tax report, making both generated reports nonchronological for these inputs. Fresh evidence beyond the prior finding is that the new regression covers only already-padded `09:00`; sorting entries containing `08:30`, `9:00`, and `14:00` currently produces `08:30`, `14:00`, `9:00`.

Useful? React with 👍 / 👎.

## 다음 첫 행동·금지

1. 작업위치.md, 실제pwd/branch/status, 대표Slack스레드 최신지시 확인.
2. PR271/272 최신HEAD·CI·코드 이후 docs/reviews 추가만 여부·Codex 원문·독립CC 회신 재확인. CC 요청은 대표전달 기본이며 Codex subagent로 대체 금지.
3. CC 회신 후 대표님 PR별 병합/운영배포 확인. 임의병합·배포 금지. 승인되더라도 1PR병합→Hosting job단계 성공→다음PR 순서, 최신main 동시적용 재확인.
4. 운영E2E는 병합/배포 후 대표님 실동작 확인을 구체적으로 요청. 완료로 단정하지 않는다.

기준 /Users/heogyeongdae/Developer/HARU2026 codex-harulaw-question-input-size/e406c19a는 깨끗하게 보존. 작업본 /private/tmp/haru-ledger-export-consistency, /private/tmp/haru-record-feedback-guards. node_modules·test/persona-sim은 검증용 미추적 파일이며 임의삭제 금지. /private/tmp/haru-ledger-combined-qa는 두PR동시적용 detached 검증본, push/배포 금지.

routes.tsx/HaruRawPage.tsx/.zombie/숨김LibraryPage, 홈·라우터, 저장경로·리전·Rules·결제/인증·새AI호출 변경 금지. 운영Firebase 연결 PR프리뷰에서 테스트기록 저장 금지. 작업①22/22 유지, C단계·F26~32수정·③ 미허용. PR270은 이번후속에서 변경하지 않음.

난이도 **5.5 중간**. Slack확정결과는 기존대표스레드에 기록하고 링크를 최종보고한다.
