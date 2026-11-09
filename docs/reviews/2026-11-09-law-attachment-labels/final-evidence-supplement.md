# PR #364 최종 근거 보완·정정 (2026-11-09)

- 작업자: Claude Code(CC) 실행자. 시작 HEAD `312edde8`(제품 코드는 `9795d3f4`, 기준 main `42e3a1dc`)
- 이 파일은 문서만 추가한다. 제품 코드·시험·설정은 바꾸지 않았다.
- `README.md`·`followup-bracket-escape.md`·`codex-review-requests.md`의 원문(미실행·실패·권한 거부 기록 포함)은 고치지 않는다. 아래 내용은 그 뒤에 확인된 사실의 보완과 정정이다.
- 이 문서는 자기 승인, 병합 판정, 운영 완료 기록이 아니다. ready 전환·병합·운영 배포는 하지 않았다.

## 1. 요청 원문

```text
CC 실행자 PR364 최종근거보존·CI 준비. 코드수정/merge/ready/배포금지. main42기반제품9795d3f4,현재312edde8. rootNode22검증 /private/tmp/haru-law-labels-validation-fixed-summary.json/-fixed-0..3.log (04:07:51Z,HEAD312edde8) build0/tests7of7/runtimeexports100equal0diff, 실제AI요청/운영쓰기false. 현재 /private/tmp/haru-law-labels-validate.py는suffix지원+majorvalidation-combined-6.log export기준을추가한실제fixed실행판. 옛판은기존문서원문그대로유지. 각각출처정확보완.
독립검토 /private/tmp/haru-law-labels-independent-first.raw.json/.prompt.txt/.meta.json 판정승인(312),필수코드수정없음,소규모. raw메타질문원문과첫CC /private/tmp/haru-law-labels-cc-1.*,후속CC /private/tmp/haru-364fix-1.* 모두docs/reviews/2026-11-09-law-attachment-labels 새하위폴더로보존; root최초검증실패와fixed통과로그/summary/runner도실제원본그대로보존SHA확인. 기존README미실행/실패원문고치지않음.
독립검토의 사실오류1개 정정파일추가: '결과없이끝난 haru-law-labels-independent-first raw/err0 metaexit없음'은 바로그검토자가자기자신진행중출력파일을읽은상태. root러너는subprocess완료때raw/metafinal을저장하므로중간0bytes정상. 실제그name독립실행은1개이고최종raw9618bytes/exit0/완료메타실측확인. 없던실패·대체실행을새로만들지말것. 원문은정정하지않고그대로보존후보완.
기타독립권고: '검증된파일명'표현은 trim/180자제한이지진위검증아님으로보완. escape시험이모델promptinjection방지까지보장안함그대로. 라벨로첨부당150~250자/최대5개입력증가(추정1000token안팎), 모델·호출횟수유지명시. User현재'아이폰알림원인해결남은3건모두완료'승인이있지만독립검토자가lawSearch운영배포범위추가확인요구해서root가구체적최종PR근거정리후대표님확인받을예정. 그러므로지금merge/ready/운영배포절대금지,추가승인기존October승인에서추정금지.
Codex실제root수동요청2 https://github.com/hkd620-lab/haru2026/pull/364#issuecomment-6731983192 (2026-11-09T04:07:12Z,target312edde8,요청당시HEAD같음), 결과6732007035 (04:09:07Z,지적없음),summary6731985584 완료04:09:08.551574Z. API원문+새보조색인파일로보존. 기존권한거부미요청행수정금지. 추가커밋A docs/reviewsonly 전체diff 312..HEAD확인,개별stage한국어docs커밋/push,PR본문검증/독립/Codex/실제리스크와rollback·함수lawSearch대상갱신,최신CIpass까지확인후최종SHA/CI/url반환. docs문서추가만이므로재검토예외범위,코드추가변경하면중단. lib2미커밋·node_modules유지stage제외. 다른PR/원본변경금지. Slack은root담당. 모든실행거부·실패보존.
```

## 2. 보존한 실행 원문

`evidence-20261109/`에 원본 27개(root 검증 script·summary·로그, 독립 검토, 첫 CC, 후속 CC, Codex 요청 본문)를 내용 그대로 복사했다. Codex 댓글 3개는 API 응답 원문을 저장했다. 목록·출처·바이트·git blob ID와 이 세션의 권한 거부 원문은 `evidence-20261109/README.md`에 있다.

- 동일성: 27개 모두 `cmp`로 원본과 바이트 단위 같음.
- **SHA-256: 계산하지 못함.** `shasum`·`openssl` 모두 권한 거부. git blob ID(SHA-1)만 적었다. root가 SHA-256을 따로 남겨야 한다.

## 3. root Node 22 최종 검증 (HEAD `312edde8`)

출처: `evidence-20261109/haru-law-labels-validation-fixed-summary.json`, `-fixed-0..3.log`, 실행 script `haru-law-labels-validate.py`(현재판).

| # | 명령 | exit | 결과 |
|---|---|---|---|
| 0 | `node --version` | 0 | `v22.23.2` (PATH 앞 `/opt/homebrew/opt/node@22/bin`) |
| 1 | `npm run build` | 0 | `> tsc && mkdir -p lib/fonts && cp src/fonts/*.ttf lib/fonts/` |
| 2 | `node --test test/haruLawAttachmentLabels.test.js test/haruLawAttachmentPipeline.test.js test/haruLawErrorCore.test.js` | 0 | tests 7, pass 7, fail 0 |
| 3 | `lib/index.js` export 목록 | 0 | 100개. 기준 100개와 같음, 추가·삭제 0 |

- `recordedAt 2026-11-09T04:07:51.172460+00:00`, `actualAIRequests false`, `productionWrites false`.
- 이 결과로 `README.md` 6절의 "미실행" 항목 중 빌드·새 labels 시험·기존 pipeline/errorCore 시험·export diff는 Node 22로 채워졌다. 같은 6절의 `resultChat.integration.js`는 여전히 실행하지 않았다. `followup-bracket-escape.md` 7절의 "Node 22 빌드는 root 재실행 필요"도 이 실행으로 채워졌다.

### 3.1 출처 보완 (script 판과 export 기준)

- `followup-bracket-escape.md` 2.1절에 인용한 script는 **이전판**이다. 접미사 인자와 export 비교가 없고, 첫 실행(HEAD `110c70e2`, `recordedAt 03:59:21Z`, 시험 6/7, export 단계 미실행)은 이 판으로 돌았다. 그 인용은 당시 실제 내용이므로 고치지 않는다.
- 위 최종 실행은 **현재판**(파일 수정 시각 2026-11-09T13:06:39+0900 = 04:06:39Z)으로 돌았다. 현재판은 (1) 첫 인자를 로그·요약 파일 이름 접미사로 쓰고(`-fixed`), (2) 4단계가 모두 exit 0이면 `/private/tmp/haru-pending-major-validation-combined-6.log`의 `EXPORTS_JSON`을 기준으로 현재 목록과 비교해 `exportsComparison`을 요약에 넣는다.
- export 기준 파일이 두 가지였다. CC 후속 세션(`followup-bracket-escape.md` 6절 8번)은 `docs/reviews/2026-11-09-pending-dependencies/run3-exports-pr358.log`를, root 최종 실행은 `haru-pending-major-validation-combined-6.log`를 썼다. 이 세션에서 두 기준 파일과 최종 `fixed-3.log`의 `EXPORTS_JSON` 줄을 `grep -h '^EXPORTS_JSON=' … | sort -u | wc -l`로 비교했고 결과는 `1`이다. 세 목록이 글자 그대로 같다는 뜻이다.

## 4. 독립 검토 결과

출처: `evidence-20261109/haru-law-labels-independent-first.raw.json`(`result` 필드), 질문 `…prompt.txt`, 실행 정보 `…meta.json`, 실행 script `haru-law-labels-review.py`.

- 판정: **승인**. 검토 HEAD `312edde8`. 필수 코드 수정 없음. 규모: 소규모.
- 막지 않는 지적(원문 1절): "검증된 원래 fileName" 표현이 강함, `chatWithResult`의 같은 정보 손실은 범위 밖, 시험 4가 소스 정규식 검사라 깨지기 쉬움, escape 시험은 3문자만 확인, "text/plain로" 표기.
- 멈춤 조건(원문 4절): (1) lawSearch 운영 배포가 사용자 지시 범위에 들어가는지 허대표님 확인 필요, (2) 실기기 4첨부 E2E 결과 확인은 허대표님 확인 사항.

### 4.1 정정: "결과 없이 끝난 독립 검토 실행"은 사실이 아니다

독립 검토 원문 2절·3절 3번은 "결과 없이 끝난 독립 검토 실행 `haru-law-labels-independent-first`… raw·err 둘 다 0바이트이고, meta에 exitCode가 없습니다"라고 적었다. 이는 **검토자 자신이 실행 중일 때 자기 출력 파일을 읽은 상태**다.

- 근거(실행 script `haru-law-labels-review.py` 10~12행): root 러너는 시작할 때 meta(`startedAt`·`cwd`·`head`·`pr`·`command`, exitCode 없음)를 쓰고, raw·err 파일을 쓰기 모드로 연 채 `subprocess.run`이 끝나기를 기다린다. 검토자의 출력(JSON 한 덩어리)은 프로세스가 끝날 때 raw에 기록되고, 그 뒤 meta에 `exitCode`·`finishedAt`이 추가된다. 따라서 실행 도중에는 raw 0바이트·meta exitCode 없음이 정상이다.
- 실측(이 세션):
  - `/private/tmp`에 `haru-law-labels-independent-*`는 `-first` 한 벌뿐이다. 이 이름의 독립 실행은 1개다.
  - 최종 raw 9618바이트(수정 시각 13:18:12+0900), `subtype success`, `is_error false`, `terminal_reason completed`, `permission_denials []`.
  - 최종 meta(13:18:13+0900): `exitCode 0`, `startedAt 04:15:11.525390Z`, `finishedAt 04:18:13.285431Z`.
  - err 0바이트(stderr 출력 없음).
- 그러므로 "결과 없이 끝난 실행"이나 그것을 대신한 다른 실행은 없다. 독립 검토 원문은 고치지 않고 그대로 보존한다.

### 4.2 표현 보완: "검증된 원래 fileName"

`README.md` 1절 요청 원문과 3절 1번에 "검증된 원래 fileName" 취지의 표현이 있다. 실제로 파일 이름에 대해 서버가 하는 일은 `readHaruLawAttachments`의 `clampResultChatText(source?.fileName, 180)`(`functions/src/haruLaw/haruLawAttachments.ts` 165행 → `functions/src/sharedHelpers.ts` 35~36행: `String(value || '').trim().slice(0, max)`)뿐이다.

- 즉 앞뒤 공백 제거와 180자 자르기다. 이름이 진짜 원래 파일 이름인지 확인하는 검증은 아니다. 이름은 클라이언트가 보낸 값이다.
- 서버가 검증하는 것은 형식이다. 표시에 쓰는 형식은 Storage `contentType`과 맞춰 본 `attachmentMeta.mimeType`에서 정하므로 파일 이름으로 형식을 속일 수 없다(독립 검토 원문 1절).
- `README.md` 3절의 "이름을 바꾸거나 자르지 않는다"는 표시 helper(`formatHaruLawAttachmentLabel`)에 대한 말이다. 그 앞 단계(`readHaruLawAttachments`)는 기존대로 trim·180자 자르기를 이미 했다.

### 4.3 그대로 유지하는 한계

- escape 시험(`haruLawAttachmentLabels.test.js` 2번)이 판정하는 것은 형식상의 성질(실제 줄바꿈 없음, `[첨부 ` 표기 1개, `JSON.parse` 복원)뿐이다. 모델이 인용 안의 문장을 지시로 따르지 않는다는 프롬프트 주입 방지는 보장하지 않는다(`followup-bracket-escape.md` 4절 그대로). 전각 괄호 `［］`, U+2060~2064, U+061C, U+180E, 태그 문자처럼 escape하지 않는 문자로 비슷하게 보이게 만드는 것도 막지 않는다(독립 검토 원문 1절).
- 실제 모델이 HWP·HWPX를 알아보는지는 로컬 fake 시험으로 확인되지 않는다. 실기기 E2E가 필요하다.

## 5. 비용·입력 크기

- 모델(`gemini-3.1-pro-preview`)·AI 호출 횟수·Gemini File 업로드 수는 바뀌지 않는다.
- 늘어나는 것은 첨부가 있는 lawSearch 요약 호출 입력뿐이다. 첨부당 표시 text 1개(escape 포함 약 150~250자)이고, 첨부는 최대 5개다. 추가 입력 토큰은 호출당 최대 1천 개 안팎으로 추정한다(독립 검토 원문 4절의 추정, 실측 아님).
- `README.md` 7절의 "첨부당 수십 토큰"은 이 추정보다 작게 적은 것이다. 원문은 두고 이 절의 추정을 기준으로 한다.

## 6. Codex 리뷰

`codex-review-requests-2.md` 참조. root 수동 요청 2번(댓글 6731983192, 04:07:12Z, 대상·요청 당시 HEAD `312edde8`) → 결과 6732007035(04:09:07Z, 지적 없음), 요약 6731985584(완료 04:09:08.551574Z).

## 7. 배포 대상·멈춤·되돌리기

- 배포 대상(병합 후, 승인 시): Functions `lawSearch` 하나. 리전 `asia-northeast3`(기존 그대로). 배포 시 `gcloud functions list`로 실측해 기록한다.
- 현재 상태: draft PR. ready 전환·병합·운영 배포를 하지 않았다. 사용자의 "아이폰 알림 원인 해결과 남은 3건 모두 완료" 지시가 있지만, 독립 검토가 lawSearch 운영 배포 범위 확인을 요구했다. root가 근거를 정리해 허대표님 확인을 받을 예정이다. 2026-10 승인(8.1절)을 이 배포의 승인으로 추정하지 않는다.
- 되돌리기: 제품 커밋 `110c70e2`·`9795d3f4`를 revert한 뒤 lawSearch를 다시 배포한다. 데이터·경로·설정·Rules 변경이 없어 되돌릴 데이터는 없다. 이 문서 커밋들은 되돌릴 필요가 없다.

## 8. 이 세션 명령과 결과

| # | 명령 | 결과 |
|---|---|---|
| 1 | `pwd; git branch --show-current; git status --short; git log --oneline -3; git rev-parse HEAD origin/codex/law-attachment-labels-20261109; …` | 위치·브랜치 확인. status는 `M functions/lib/index.js`, `M functions/lib/snsToDiary.js`, `?? functions/node_modules`(기존 그대로). `origin/codex/…` ref 없음 exit 128(원격 이름은 `codex-law-attachment-labels-20261109`) |
| 2 | `gh pr view 364 --json …` | draft, OPEN, head `312edde8`, CI 2건 SUCCESS |
| 3 | `/private/tmp` 원본 읽기·복사·`cmp` | `evidence-20261109/README.md` 참조. 권한 거부 6건 원문도 그곳 3절 |
| 4 | `gh api repos/hkd620-lab/haru2026/issues/comments/<id>` × 3 | 저장됨 |
| 5 | export 목록 3개 비교 | `1`(같음) |
