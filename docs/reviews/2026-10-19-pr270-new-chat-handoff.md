# 새 대화용 인수인계 — PR #270 완료와 후속 이슈

허대표님, 새 대화로 넘어가는 게 좋겠습니다.

## 현재 판정과 완료 상태

**PR #270은 ✅ 완료다.** 사용자 승인에 따른 main 병합·Hosting 자동배포·배포 후 최소 운영E2E까지 마쳤다. 남은 항목은 별도 후속이며 PR #270을 다시 미완료로 돌리지 않는다.

- PR https://github.com/hkd620-lab/haru2026/pull/270
- 기능 검토 HEAD `7f659deeee55df4d2dd8462e20ffc7deb18e298c`
- main merge SHA `a4d55436fee851f2b66f1ae86a62dcdeb21dcadf`
- 검증/병합 tree `f74a4adc0d24a31850324e85f881ef32afcaa0a5`
- Hosting workflow https://github.com/hkd620-lab/haru2026/actions/runs/39137715184 — SUCCESS
- 프로젝트/site haru2026-8abb8, channel live, version `5714b3a92faff384`, release2026-10-18 23:51:20.310 KST
- 운영 https://haru2026.com 의Chrome에서기존법률메모열기→하루LAW1장만→연결안내정상3항목통과, HTTP200·새번들일치.
- 시험43/43·합격14/14·프론트빌드성공. 전체53파일중51통과·기존실패2건은아래이슈로분리.
- 독립전체 “승인”, 보충 “기존 전체 기술 승인 유지”; 수정후승인 누적1회 이력 보존. Codex 최신HEAD검토완료·지적없음, 스레드미해결0.

배포/E2E 증거: https://github.com/hkd620-lab/haru2026/blob/3ae362fd/docs/reviews/2026-10-18-pr270-approved-merge-and-hosting-deploy-result.md
완료 정리: 같은 폴더 `2026-10-19-pr270-completion-and-followups.md`

## 미착수 후속

1. **#279 기존 P3 백로그** https://github.com/hkd620-lab/haru2026/issues/279
   성능·가중치시험·잔존다의어/오탐·약한단어/합성어정책·자모경계·오래된PR본문·시험제목정합성 등. 선택/유보 대상이며 임의 확대 수정 금지.
2. **#280 haruLawSave.test.cjs 기존 실패** https://github.com/hkd620-lab/haru2026/issues/280
   당시 main a2b7c78d에서도2통과/8실패/1skip. lawSaveRef 미정의 등. 시험 하네스와 실제 동작 계약을 구분해야 하며 운영 저장 장애로 확정하지 않는다.
3. **#281 loginProviderStorage.policy.test.cjs 기존 실패** https://github.com/hkd620-lab/haru2026/issues/281
   같은 main에서소스문자열 단언 실패. 시험 노후화/실제 인증 동작 회귀는 미확정. 인증 정책을 임의 변경하지 않는다.

이슈 등록과 인수인계는 후속 구현·추가배포 승인이 아니다. 현main에서실패를새로재현한것은아니므로다음세션은이전증거와새재현을구분한다.

## 작업 위치·보존 및 금지

- 작업 전 `/Users/heogyeongdae/Developer/HARU_작업위치.md`, 실제 pwd·브랜치·git status·최신 원격main을 확인한다.
- 기준 `/Users/heogyeongdae/Developer/HARU2026`는 기존 codex-question-input-three-lines / 9fa88ead 작업본을 보존했다. 무단 전환·restore·stash·덮어쓰기 금지.
- `/private/tmp/haru-pr270-records-20261018`의 codex-pr270-completion-review-20261018은 증거브랜치이며 **오래된 앱코드를 포함하므로 main 병합 금지**. 현재소스개발기준으로쓰지말것.
- `/private/tmp/haru-pr270-completion-20261018`은 PR #270 당시 격리통합 검증본이다. 미커밋통합상태가남아있으므로새후속작업의깨끗한기준폴더로오인하지말것.
- 이번PR의병합/Hosting승인은집행완료한일회범위다. 후속에승계하지말것. 추가코드수정·병합·배포·Functions/Rules배포·AI호출·운영데이터저장/삭제 금지 유지. 이후사용자직접승인은그범위에서우선한다.
- Firestore users/{uid}/records/{date}, Functions asia-northeast3, 금지파일·숨김LibraryPage·로고·가격·기존검토원문 보존 원칙 유지.
- 실제 기록본문·개인정보·인증정보를 PR/이슈/Slack/로그에 기록하지 않는다.

## 다음 첫 행동

새 대화에서 작업위치와 최신main 상태를 확인하고, #280·#281의이전실패로그/이슈와 #279의선택후속을읽어 **이번에다룰이슈와허용범위**를 정한다. 우선순위 제안은시험안전망확인을위한 #280 원인 점검부터이며, 이는즉시코드수정지시가아니다. 이후허용된범위라면격리된최신main에서해당시험을로컬재현해새기준을남긴다. 선택되지않은P3나운영AI/저장시험으로확대하지않는다.

새 대화에 넘길 짧은 요청문:

> PR #270은 완료 상태로 유지한다. main a4d55436, Hosting live5714b3a92faff384, 배포후최소E2E3항목통과. 후속은 #279(P3), #280(haruLawSave 기존시험실패), #281(loginProviderStorage 기존시험실패)로 분리됐다. 먼저 위치·브랜치·status·최신main과 이슈근거를 확인하고, #280의 시험하네스/실제동작 계약을 읽기 중심으로 점검하라. 추가코드수정·병합·배포·Functions/Rules배포·운영AI호출/데이터변경은 하지 말라. 새 재현이 필요하면 격리 로컬 환경에서만 수행하고 이전 결과와 구분하라.
