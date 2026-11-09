# 보완 1 — root 검증 결과·재발 위험·원인 범위·비용·롤백 (독립 검토 1차 필수 수정 반영)

- 작성: CC 실행자 (2026-11-09, 문서 보완 실행). 이 커밋은 `docs/reviews/` 아래 새 파일 추가만 한다. 코드 변경 없음.
- 대상 PR: #365 (draft). 검토 대상 HEAD `89fa9644f75cfaf28667f7ce04229603ea2e781c`, 제품 코드 커밋 `0d1f4315` (`functions/src/index.ts` 1줄).
- 같은 폴더 `README.md`(CC 1차 기록)는 고치지 않는다. README 6.2·8절의 "빌드·export·endpoint 비교 미실행"은 **CC 1차 실행 당시 사실**로 그대로 두고, 그 뒤 root가 실행한 결과를 이 파일에 새로 기록한다.
- 상태: **ready·merge·운영 배포 금지.** 비용 증가(8.1 멈춤 조건)와 단일 함수 운영 배포 범위는 허대표님 최종 확인 전이다.
- 독립 검토 1차 판정과 반영 내역: `INDEPENDENT-REVIEW-1.md`. Codex 색인: `CODEX-INDEX-1.md`. 원문 파일: `raw/`.

## 1. 필수 1 — root 실행 검증 (실패·통과 원문 모두 보존)

CC 1차 실행은 Node 22 PATH 명령이 세션 권한으로 거부되어 빌드·export·endpoint 비교를 하지 못했다(README 6.2, 원문 `raw/haru-memory-cc-1.raw.json`의 `permission_denials`). 이후 root가 아래를 실행했다. CC는 이 결과를 다시 실행하지 않았고, 원문 파일을 복사·대조해 기록만 한다.

### 1.1 1차 runner — `raw/haru-memory-validate.py`

- 실행 환경: Node `v22.23.2` (`/opt/homebrew/opt/node@22/bin`을 PATH 앞에 둠), cwd `/private/tmp/haru-push-memory-20261109/functions`, 대상 HEAD `89fa9644…`. 환경변수는 데모 프로젝트 `demo-haru-push-test`·Firestore 에뮬레이터 주소·`FUNCTIONS_EMULATOR=true`로 둠(운영 자격 증명 사용 안 함).
- 결과 요약 원문: `raw/haru-memory-validation-summary.json` (`recordedAt` `2026-11-09T04:48:30.193300+00:00`)

| # | 명령 | exit | 로그 원문 |
|---|---|---|---|
| 0 | `node --version` | 0 | `raw/haru-memory-validation-0.log` → `v22.23.2` |
| 1 | `npm run build` (`tsc && mkdir -p lib/fonts && cp src/fonts/*.ttf lib/fonts/`) | 0 | `raw/haru-memory-validation-1.log` (오류 출력 없음) |
| 2 | `node test/scheduledNotificationCore.test.js` | 0 | `raw/haru-memory-validation-2.log` → `scheduledNotificationCore tests passed` |
| 3 | `node …/endpoint-compare.js <base lib> <candidate lib>` | **2 (실패)** | `raw/haru-memory-validation-3.log` → `usage: dump <lib/index.js> \| compare <base.json> <next.json>` |

- 3번 실패 원인: runner가 `endpoint-compare.js`의 첫 인자인 모드(`dump`/`compare`)를 빠뜨렸다. 스크립트가 사용법을 출력하고 exit 2로 끝났다(`raw/endpoint-compare.js` 63–64행). 비교 자체가 실행되지 않은 **사용법 실패**이며, 결과가 다르다는 뜻이 아니다. 이 실패는 지우지 않고 원문 그대로 보존한다.
- 1번 빌드는 이 worktree의 `functions/lib/*`를 다시 생성했다. 그래서 `functions/lib/index.js`, `functions/lib/snsToDiary.js`가 미커밋 수정 상태다. 이 두 파일과 `functions/node_modules`(symlink)는 커밋·stage하지 않고 그대로 둔다.
- summary의 `actualAIRequests:false`·`productionWrites:false`·`fcmSent:false`는 runner 스크립트가 적어 넣은 고정값이다(`raw/haru-memory-validate.py` 11행). 별도 계측값이 아니다. 근거는 실행한 명령 목록(버전·빌드·합성 시험·로컬 모듈 로드)과 데모 프로젝트 환경변수다.

### 1.2 재실행 — `raw/haru-memory-endpoints-verify.py`

- 각 `lib/index.js`를 **별도 Node 22 프로세스**에서 `endpoint-compare.js dump` 모드로 불러온다. 표준출력으로 받은 `__endpoint` 메타데이터는 Python 메모리 안에서만 비교한다. metadata 원본 덤프는 **디스크에 저장하지 않았다**(`rawMetadataPersisted:false`, 스크립트에 dump 파일 쓰기 없음).
- 비교 대상:
  - 기준: `/private/tmp/haru-deploy-chatwithresult-20261109/functions/lib/index.js` (`92535da2` 컴파일본, summary `baselineSourceSha`)
  - 후보: 이 worktree `functions/lib/index.js` (HEAD `89fa9644` 빌드)
- 결과 원문: `raw/haru-memory-endpoints-verified-summary.json` (`recordedAt` `2026-11-09T04:48:42.381823+00:00`). 스크립트의 `assert` 3개가 모두 통과한 뒤에만 이 파일이 쓰인다.

| 항목 | 결과 |
|---|---|
| export 수 (기준/후보) | 100 / 100 |
| export 이름 집합 | 같음 (`exportNamesEqual: true`) |
| `sendTestNotification` 외 99개 export의 `__endpoint` 전체 차이 | 0건 (`otherEndpointDifferences: []`) |
| `sendTestNotification.platform` | `gcfv2` → `gcfv2` |
| `sendTestNotification.region` | `["asia-northeast3"]` → `["asia-northeast3"]` |
| `sendTestNotification.availableMemoryMb` | `null` → `512` |
| `sendTestNotification.cpu` / `timeoutSeconds` | `null` → `null` / `null` → `null` |
| `sendTestNotification` 전체 필드 중 바뀐 것 | `["availableMemoryMb"]` 하나 |

- 함수 수 100은 로컬 `lib` export 기준이다. 현재 GCF 실배포 114개와 다른 수치이므로 섞지 않는다.

### 1.3 metadata `null`과 운영 실측의 구분

- 위 `null`은 **소스 코드에서 그 옵션을 지정하지 않았다**는 뜻이다. 배포 시 플랫폼 기본값이 적용된다.
- 운영 실측값(root가 gcloud로 확인, README 2절)은 별개다: memory 256Mi / CPU 1 / timeout 60s / nodejs22 / asia-northeast3 / revision `sendtestnotification-00130-tah` / updateTime `2026-09-12T12:38:45.673214178Z`.
- 이번 변경은 소스에 memory 512MiB만 지정한다. CPU 1·timeout 60은 그대로 유지할 계획이다. 실제로 유지됐는지는 **배포 후 gcloud 실측으로 확인**해야 한다(아직 미확인).

### 1.4 기준선 한계 (정확한 범위)

- 기준 컴파일본 `92535da2`와 현재 base `6723b5d4` 사이에서 `git diff --stat 92535da2 6723b5d4 -- functions/src` 결과는 **0** (출력 없음).
- `functions/` 전체로 보면 `functions/package.json` 1줄(`puppeteer` `^24.40.0` → `^25.16.0`)과 `functions/package-lock.json`(234 추가 / 841 삭제)이 다르다. PR #359 의존성 major 반영분이다.
- 따라서 이 비교가 보여 주는 것은 **소스에 선언된 runtime endpoint 옵션이 `availableMemoryMb` 하나만 바뀌었다**는 것이다. 다음은 이 비교로 보이지 않는다.
  - 의존성 버전 차이가 실행 동작이나 시작 메모리에 주는 영향
  - 기준 lib가 빌드될 때의 `node_modules` 상태가 후보와 같았는지
- endpoint 메타데이터는 `firebase-functions`가 소스 옵션에서 만든다. 두 시점의 `functions/package.json` 차이는 `puppeteer` 한 줄이다.

### 1.5 CC 1차 비교 스크립트

- `raw/endpoint-compare.js`: CC 1차가 `/private/tmp/haru-push-memory-verify-20261109/`에 만든 원본을 그대로 보존했다. root는 이 스크립트의 `dump` 모드만 썼다. README 6.3의 `compare` 모드 명령과 `base.json`/`next.json` 파일 방식은 실행되지 않았다. 대신 1.2의 메모리 내 비교로 같은 항목(export 수·이름, 다른 export 동일성, 이 함수 변경 필드)을 확인했다.

## 2. 필수 2 — 재발 가능성·512MiB 충분성 (추정과 실측 구분)

- **실측(원인 근거):** 운영 로그 1건, `2026-11-09T04:25:27.236234Z` `Memory limit of 256 MiB exceeded with 259 MiB used`. 256MiB 한도에서 259MiB를 써서 실패한 실기기 1회다.
- **추정(실측 아님):** `sendTestNotification` 함수 본문은 작다. 따라서 259MiB의 대부분은 큰 `functions/lib/index.js`가 전역에서 불러오는 모듈 때문으로 보인다. 독립 검토자는 pdfkit·sharp 등의 즉시 로드를 예로 들었다. 이 추정은 시작 시 메모리 측정이나 프로파일링으로 확인하지 않았다.
- **배포하면 함께 올라가는 것:** 함수 하나만 배포해도 그 함수의 패키지에는 현재 main의 전체 `functions` 소스와 의존성이 들어간다. 운영 revision은 2026-09-12에 배포됐고, 그 뒤 main 코드와 major 업그레이드를 포함한 의존성이 반영됐다. 그래서 시작 시 메모리가 지금 운영과 달라질 수 있다.
- **512MiB가 충분한지:** 실측 259MiB의 약 2배 한도지만, **충분한지는 실제 배포 후 확인해야** 한다. 배포 전에 정확한 청구액과 시작 시 최대 메모리(peak)는 측정하지 않았다.
- **CPU·timeout:** CPU 1과 timeout 60s는 유지할 계획이다(소스 미지정, 1.3 참조). 배포 후 gcloud로 memory 512Mi·CPU 1·timeout 60·region `asia-northeast3`·nodejs22·새 revision을 확인한다.

## 3. 필수 3 — 원인 범위 한정

- 이번 근거는 **256MiB 한도에서 실패한 실기기 테스트 1회의 OOM**에 한정된다.
- 과거의 모든 아이폰 알림 미수신이 메모리 때문이라고 **단정하지 않는다.** 같은 문구를 PR 본문에도 유지한다.
- 512MiB 배포 뒤에도 수신되지 않으면, 메모리 외 원인(APNs·토큰 등)을 이 PR과 별도로 조사한다.
- 독립 검토 1차는 "핸들러 본문이 2026-04-27(`171de7e2`) 이후 바뀐 적 없음 → 9월 배포본과 같음"을 근거로 동작·안전성 불변을 판단했다. 이것은 **독립 검토자의 지적 이력**으로 `INDEPENDENT-REVIEW-1.md`에 보존한다. 이 보완 실행에서 CC가 새로 확인한 근거가 아니다. 이 보완의 새 근거는 1절의 root 실행 결과뿐이다.

## 4. 실수신·운영 상태 (미확인)

- 512MiB 운영 배포: **하지 않음.**
- 같은 계정 아이폰 실기기 수신 재시험: **하지 않음 (미확인).** 이 문서 작성 중 실기기·운영 함수 추가 호출도 하지 않았다.
- 따라서 이 PR만으로 "아이폰 알림 미수신 해결"이라고 판정하지 않는다. 9절 증거 사슬 기준으로 현재 위치는 `코드 → 테스트(합성) → 커밋·PR(draft)`까지다.

## 5. 비용

- 배포하면 이 함수의 인스턴스 메모리 할당이 256MiB → 512MiB로 늘어난다. 정확한 청구 증가액은 **미측정**이며 금액을 추정하지 않는다.
- 호출량도 실측하지 않았다. 사용자가 "내 기기 테스트 알림"을 누를 때만 호출되는 함수다.
- 8.1 멈춤 조건("비용이 늘어나는 변경")에 해당한다. 허대표님 확인 전에는 ready·merge·운영 배포를 하지 않는다.

## 6. 바뀌지 않은 것

- 기존 Functions region `asia-northeast3` 유지. endpoint 비교에서 region 동일함을 확인했다.
- Firestore 경로(`users/{uid}/records/{date}` 원칙, 이 함수가 읽는 `users/{uid}/settings/settings`)·Rules·Storage: 변경 없음
- 인증(`request.auth` 확인)·결제·요금 정책: 변경 없음
- AI 호출·모델: 변경 없음
- 다른 99개 export의 endpoint 옵션과 `setGlobalOptions`: 변경 없음(1.2)
- 대상: `sendTestNotification` **하나**의 memory 옵션만

## 7. 배포 범위와 롤백 (모두 별도 승인 필요)

- 배포 범위 계획: `firebase deploy --only functions:sendTestNotification --project haru2026-8abb8` 단일 대상. 이 경우에도 현재 main의 전체 `functions` lib·의존성이 함께 패키징된다(2절). 허대표님 승인 자료에 이 점을 함께 적는다.
- 배포 직후 기록할 것: 새 revision 이름, 그리고 gcloud 실측(memory 512Mi / CPU 1 / timeout 60 / asia-northeast3 / nodejs22).
- 롤백
  - 코드: 미병합 유지 또는 병합 후 revert
  - 운영 (a): 256MiB 코드(memory 옵션 없음)로 같은 함수만 재배포
  - 운영 (b): 직전 revision `sendtestnotification-00130-tah`로 트래픽 100% 전환
- 데이터 롤백 대상: 없음 (설정만 변경)

## 8. 이 보완 실행에서 한 일·하지 않은 일

- 한 일
  - 원문 21개 파일을 `raw/`에 보존했다.
    - `/private/tmp` 원본 18개는 `cp`로 복사한 뒤 `cmp` 바이트 대조와 SHA-256 대조를 했다.
    - GitHub API 응답 3개는 `gh api` 출력을 그대로 저장했다.
  - 이 문서와 색인 2개를 새 파일로 추가했다.
  - PR 본문을 갱신했다.
- 하지 않은 일
  - 코드 변경
  - README 수정
  - `functions/lib/*` 생성물과 `functions/node_modules` stage
  - ready 전환·merge·배포
  - Slack 게시
  - 실기기·운영 함수 호출
  - 자기 승인
- 독립 재검토는 다른 세션에서 진행한다. 그때 1차 판정 원문과 이 반영 내역을 함께 넘긴다(8.1).

## 9. 원문 파일 SHA-256 (원본 = 사본 확인)

`/private/tmp` 원본과 `raw/` 사본의 SHA-256·크기가 모두 같았다. 해시는 Node `crypto` sha256으로 계산했다. 바이트 대조(`cmp`)도 모두 일치했다.

| 파일 (`raw/`) | bytes | SHA-256 | 원본 위치 |
|---|---|---|---|
| haru-memory-independent-first.prompt.txt | 2718 | `0f8d21f891f750d7bddf6560439b9da9ba150f7d0a9e6d283581564ce96c5203` | /private/tmp/ |
| haru-memory-independent-first.raw.json | 12031 | `d8700a9a7d6f235f69fd9e50ec9b6f5ffdd1b4a1af129e3ee488548da3404ffa` | /private/tmp/ |
| haru-memory-independent-first.meta.json | 872 | `47cdaba6ffd09ca47b88c33160a92304da8679c88858bac960cb527afa6d9709` | /private/tmp/ |
| haru-memory-independent-first.err.log | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | /private/tmp/ |
| haru-memory-cc-1.prompt.txt | 3437 | `370f7d87df61b3a45bf1fc7459511388b55bf15af4f08ddfdff6fccf589dfe76` | /private/tmp/ |
| haru-memory-cc-1.raw.json | 8313 | `5901e89fdcf14f15adfd7a0bedf388e787552552ce6d236b8734ff78afb7a130` | /private/tmp/ |
| haru-memory-cc-1.meta.json | 805 | `3729ecf3e2630a365b486e5cdbfc37dfd45b0f814e36451ace5f14c31708dd0b` | /private/tmp/ |
| haru-memory-cc-1.err.log | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | /private/tmp/ |
| haru-memory-validate.py | 1517 | `a75798360eb05a018dafcd1401bf1b6543d8a5885e8bfa82f1bbbafa1eb5b570` | /private/tmp/ |
| haru-memory-validation-summary.json | 1299 | `2fe8bea6785fa4c2c96a6e1e0d5dad6248a486e033dd4cd294a650f2a7071461` | /private/tmp/ |
| haru-memory-validation-0.log | 9 | `c42fcf0db5a550bda2f566fcdc21955df3e5a8ec3aeb90ac533f3776e7fce32a` | /private/tmp/ |
| haru-memory-validation-1.log | 71 | `215964dbb31e83056d5893b637e73cdb4f573f4ee89eae767c16119a7f6c61b6` | /private/tmp/ |
| haru-memory-validation-2.log | 39 | `beebb203472e4de104488d463bd5088b937b03cb87f62e0e79951728664b7202` | /private/tmp/ |
| haru-memory-validation-3.log | 61 | `0a359d32952448bf5592d2655f42eceb587b3030b0ff6dec1964c995db6b1ab8` | /private/tmp/ |
| haru-memory-endpoints-verify.py | 2050 | `34cf86bec2d06c6c48649b87b9378a0a3d019762996d041929142a7e21cd155b` | /private/tmp/ |
| haru-memory-endpoints-verified-summary.json | 742 | `afa5cf86226d6d7eaefa1ba449b3dffc38e2ac99ea07b95c4e5401ab23a66a0f` | /private/tmp/ |
| haru-memory-codex-request.json | 802 | `4553b17f9fe43f3d981ed365b6487b133530aedf59c48fa88021f614cdc7da99` | /private/tmp/ (root Codex 요청 본문) |
| endpoint-compare.js | 2847 | `7b7a3596d71efabd9de8139562c9d63e3433265c11292bb7e7a1d7d5b57d4da2` | /private/tmp/haru-push-memory-verify-20261109/ |
| codex-api-issuecomment-6732506701-request.json | 2420 | `479f277216d8cf6e2af69d12391f99199f0294eb8aa65b4f4a972c081bcfa025` | `gh api repos/hkd620-lab/haru2026/issues/comments/6732506701` |
| codex-api-issuecomment-6732509134-summary.json | 4856 | `96b31cac2f0a5dbe011c827752e4e32cd89aba1132203ff6077e6784367615cc` | `gh api …/issues/comments/6732509134` |
| codex-api-issuecomment-6732523114-result.json | 4232 | `8c760df307fab40ff803d329185f18baf61c6643997d907974d1b4989ceeeb42` | `gh api …/issues/comments/6732523114` |

- `.err.log` 0바이트 두 개는 해당 실행의 stderr가 비어 있었다는 원본 그대로다.
- 문서 필수 검증 `git diff --cached --check` 결과: `raw/haru-memory-validation-1.log:4: new blank line at EOF.` 1건만 나오고 exit 2로 끝났다. 이것은 npm 빌드 출력 원본 끝의 빈 줄이다. 원문을 보존하려고 고치지 않았다. 이 파일 외의 새 문서·원문에서는 지적이 없었다.
- 이 보완 실행 자체의 runner 기록(`/private/tmp/haru-memory-prepare-1.*`)은 작성 시점에 실행 중이라 raw가 0바이트다. 이것은 실패한 실행이 아니고, 최종 저장 전 상태라 이 커밋에 넣지 않았다. 종료 후 원문 보존은 root 담당이다.
