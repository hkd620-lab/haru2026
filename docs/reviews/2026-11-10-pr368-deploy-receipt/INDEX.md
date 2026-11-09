# 2026-11-10 PR #368 병합·Hosting 배포·실기기 수신 완료 기록 (색인)

- 기록 worktree: `/private/tmp/haru-pr368-delivery-evidence-20261110`, 브랜치 `codex/pr368-delivery-evidence-20261110`, 기준 `4e7e871e8f91d06408151fc18b774f5f9146d372` (= PR #368 병합 커밋).
- 이 파일은 **새로 추가한 문서**다. 이 폴더와 이전 폴더 [`../2026-11-09-s21-push-key/`](../2026-11-09-s21-push-key/)의 기존 기록·원문은 고치지 않았다.
- 이 기록 브랜치는 문서만 담는다. **추가 main 병합·추가 배포는 필요 없다.**
- 상태: **✅ 승인 범위 완료** — PR #368 병합 + 자동 Hosting 배포 + S21·아이폰 16e 본인 계정 실제 수신(사람 확인).

## 1. 승인 범위

| 항목 | 내용 | 근거 |
|---|---|---|
| 허대표님 지시 원문 | "승인. PR #368 병합하고 Hosting에 배포한 뒤 S21과 16e에서 실제 알림 수신까지 확인하자." | [`AUTHORIZED-SCOPE.json`](AUTHORIZED-SCOPE.json) |
| 허용 | PR #368 squash 병합, 자동 Hosting 배포, 본인 계정 기기 시험과 수신 확인 | 같은 파일 `allowed` |
| 제외 | 추가 Functions/Rules 배포, 전체 사용자 발송, 데이터·인증·저장 정책 변경 | 같은 파일 `excluded` |

`AUTHORIZED-SCOPE.json`의 `current` 필드("16e not yet received")는 20:32:11Z 시점 기록이다. 이후 상태는 §5와 [`FINAL-DEVICE-RECEIPT.json`](FINAL-DEVICE-RECEIPT.json)을 따른다.

## 2. 원인과 수정 내용 (이전 폴더 요약)

- **관찰 사실:** S21 설치 PWA의 FCM 구독 공개키가 SDK DEFAULT 키와 같았다. 현재·이전 VAPID 키와는 달랐고, 발송하면 WebPush 403이 났다. 구독을 한 번 초기화하고 다시 등록해도 DEFAULT 키로 다시 생겼다. 운영 페이지 번들과 `firebase-messaging-sw.js`의 공개 Firebase web config에서 **appId·apiKey가 서로 달랐다.** 근거: [`../2026-11-09-s21-push-key/README.md`](../2026-11-09-s21-push-key/README.md) §1.
- **원인 후보 경로 (확정 아님):** SW의 appId가 페이지와 다르면, SW의 `pushsubscriptionchange` 처리에서 페이지가 저장한 VAPID 키를 찾지 못하고 DEFAULT 키로 다시 구독할 수 있다. 또 SDK `getToken`은 기존 구독의 키가 다른지 확인하지 않는다. **S21에서 `pushsubscriptionchange`가 실제로 실행됐다는 이벤트 기록은 잡히지 않았다.** 그래서 원인은 후보 경로로만 적는다. 근거: 같은 README §2.
- **PR #368 구현:**
  - `frontend/public/firebase-messaging-sw.js`: 공개 web config의 `appId`·`apiKey`를 운영 페이지 값과 맞췄다. 이는 공개 설정 정합이며 인증 정책 변경이 아니다.
  - `pushSubscriptionKey.ts`: 구독 키를 바이트 단위로 검사한다. 키가 다르면 해당 registration만 다시 구독한다. `getToken` 전후로 키와 endpoint가 같은지 확인하고, 다르면 저장하지 않는다.
  - `fcmRegistrationUpdate.ts`: 명시적 등록 경로에서 SW update를 하고 새 worker가 활성화될 때까지 기다린다. 실패하면 등록하지 않는다(fail closed).
  - `notificationService.ts`: `registerThisDevice` 어댑터만 바꿨다.
  - 근거: README §3, [`../2026-11-09-s21-push-key/SUPPLEMENT-sw-update-guard.md`](../2026-11-09-s21-push-key/SUPPLEMENT-sw-update-guard.md).

## 3. 병합 전 검증·검토

| 항목 | 결과 | 근거 |
|---|---|---|
| 시험 | 4개 파일 **57/57 통과** | [`../2026-11-09-s21-push-key/STATUS-ADDENDUM.md`](../2026-11-09-s21-push-key/STATUS-ADDENDUM.md) §2, [`FINAL-LOCAL-VERIFICATION.json`](../2026-11-09-s21-push-key/FINAL-LOCAL-VERIFICATION.json) |
| 빌드 | Node 22.23.2, 자리값 env `npm run build` exit 0. dist SW와 public SW 동일 | 같음 |
| strict | helper·browser fixture·어댑터 strict exit 0. **전체 앱 tsc는 기존 ExportModal 구문 오류 때문에 통과하지 않음**(통과 근거로 쓰지 않음) | 같음 |
| 검증 소스 = HEAD `0688d8da` | 6/6 blob 동일. 이 비교는 빌드 뒤에 기록한 것 | [`VERIFICATION-SOURCE-EQUIVALENCE.json`](../2026-11-09-s21-push-key/VERIFICATION-SOURCE-EQUIVALENCE.json) |
| 8.1절 독립 Claude | 원문 판정 **`승인`**. 범위는 코드 병합 준비 상태만 | [`FINAL-REVIEW-STATUS.json`](../2026-11-09-s21-push-key/FINAL-REVIEW-STATUS.json), STATUS-ADDENDUM §4 |
| Codex 1차 | 대상 `0688d8da`. 요청 `6749939932`. 19:57:43.769057Z 완료, 지적 없음. 결과(receipt) `6749974464`, 요약 `6749947914` | [`CODEX-INDEX-1.json`](../2026-11-09-s21-push-key/CODEX-INDEX-1.json) |
| `0688d8da → c9577d1f` 차이 | `docs/reviews/**` **추가(A) 15개뿐**. root가 병합 전에 직접 확인함 | root 확인 사실 (아래 §4의 Bash 거부 항목 참조) |
| 최신 head CI·preview | run `42688938379` SUCCESS (`c9577d1`, `build_and_preview` 20:02:31Z, `Deploy Preview` 20:02:28Z) | [`raw/haru-pr368-ready-codex-20261109T2012Z.json`](raw/haru-pr368-ready-codex-20261109T2012Z.json) |
| Codex 2차 | 아래 §4 | [`CODEX-INDEX-2-READY.json`](CODEX-INDEX-2-READY.json) |

이전 Codex 검토 원문은 이전 폴더에 그대로 보존되어 있다.

## 4. Ready·Codex 2차·병합·Hosting

### 4.1 병합 CC 세션 (원문 보존)

- 프롬프트: [`raw/haru-pr368-approved-merge-1.prompt.txt`](raw/haru-pr368-approved-merge-1.prompt.txt)
- 결과: [`raw/haru-pr368-approved-merge-1.raw.json`](raw/haru-pr368-approved-merge-1.raw.json) (`is_error: false`, `num_turns: 24`)
- 실행 정보: [`raw/haru-pr368-approved-merge-1.meta.json`](raw/haru-pr368-approved-merge-1.meta.json) (20:10:35Z~20:15:39Z, exit 0, cwd `/private/tmp/haru-s21-push-key-fix-20261109`)
- stderr: [`raw/haru-pr368-approved-merge-1.err.log`](raw/haru-pr368-approved-merge-1.err.log) (비어 있음)
- **Bash 권한 거부 2건, 원문 보존:**
  1. 여러 명령을 묶은 확인: `0688d8da→c9577d1f` diff, merge-base, `git fetch origin main`, 상태 파일 읽기.
  2. 단일 `git diff --name-status 0688d8da c9577d1f`.
  - CC는 두 명령을 재시도하지 않았고, API나 다른 경로로 우회하지도 않았다. 이 세션은 15A 문서 차이를 직접 다시 확인하지 못했다. 대신 PR head가 정확히 `c9577d1f…`인지 확인했다. 15A 문서 차이와 head 일치는 **root가 병합 전에 이미 확인**했다.

### 4.2 Ready와 Codex 2차

| 항목 | 값 |
|---|---|
| `gh pr ready 368` | 1회, 약 20:12Z |
| 트리거 | Draft marked ready (자동). 별도 요청 댓글 없음 |
| 대상 | `c9577d1fd2f52feeac0f2f195ac6fed907e16995` |
| 실제 시작·완료 | `2026-11-09T20:11:56.393873Z` → `2026-11-09T20:13:03.792239Z` |
| 결과 | completed, `has_any_findings: false`, `has_unresolved_findings: false`, PR review·inline 댓글 없음 |
| 기록 위치 | 기존 요약 댓글 `6749947914`가 **수정됨**(updated 20:13:04Z) |
| 결과(receipt) 댓글 | **2차 실행에는 새 receipt가 없음.** `6749974464`는 **1차(`0688d8da`) 것**이다 |
| 재검토 요청·reroll | 없음 |

- 색인: [`CODEX-INDEX-2-READY.json`](CODEX-INDEX-2-READY.json)
- 원문: Ready 직후 [`raw/haru-pr368-ready-codex-20261109T2012Z.json`](raw/haru-pr368-ready-codex-20261109T2012Z.json), 병합 직전 [`raw/haru-pr368-codex2-completed-20261109.json`](raw/haru-pr368-codex2-completed-20261109.json). 병합 직전 상태는 `OPEN`, `CLEAN`, `MERGEABLE`, head `c9577d1f`, base `f38e0ddc`였다.

### 4.3 병합

- `gh pr merge 368 --squash --match-head-commit c9577d1fd2f52feeac0f2f195ac6fed907e16995`. auto·admin을 쓰지 않았고 브랜치도 삭제하지 않았다.
- 병합 커밋: **`4e7e871e8f91d06408151fc18b774f5f9146d372`**
- 병합 시각: **`2026-11-09T20:13:41Z` = 2026-11-10 05:13:41 KST**

### 4.4 자동 Hosting

- run **`42690923623`**, push 이벤트, `main`, headSha `4e7e871e…`가 병합 커밋과 같다.
- 생성 20:13:44Z → job `build_and_deploy` 20:13:48Z~20:14:58Z → **success**, 갱신 **`20:14:59Z` = 05:14:59 KST**.
- 경고는 Node 20 사용 중단과 러너 이미지 변경 안내뿐이며 실패가 아니다.
- 원문: [`raw/haru-pr368-hosting-run-42690923623.json`](raw/haru-pr368-hosting-run-42690923623.json)

### 4.5 운영 반영 확인 (20:19:44Z = 05:19:44 KST)

| 대상 | 상태 | 결과 |
|---|---|---|
| HTML | 200 | — |
| `/assets/index-DxKFbrtf.js` (modern) | 200 | 구독 키 보호·worker update 보호 **둘 다 포함**. sha256 `cee1929d…38ebb7` |
| `/assets/index-legacy-CLS0Skfk.js` (legacy) | 200 | **둘 다 포함**. sha256 `52a04c64…408c913` |
| `/firebase-messaging-sw.js` | 200 | sha256 `147b46cd74d9c8dd8bdc4a06d6eefb7f434ff4b7e2584b4c5abd80a1064c762b`, **승인된 소스와 정확히 같음** |
| Functions/Rules | — | 추가 배포 없음 |

- 원문: [`raw/haru-pr368-production-verification.json`](raw/haru-pr368-production-verification.json)

## 5. 실기기 시간표 (UTC / KST)

| UTC | KST (11/10) | 사건 | 근거 |
|---|---|---|---|
| 20:24:02Z | 05:24:02 | S21 HARU PWA(visible·standalone)가 `index-DxKFbrtf.js`를 불러옴. FCM SW 구독 키가 **현재 키와 같고 DEFAULT 키와 다름** | [`raw/haru-pr368-s21-postregister-key-result.json`](raw/haru-pr368-s21-postregister-key-result.json) |
| 20:27:29Z | 05:27:29 | 1차 본인 계정 시험 발송 시작. 발송 전 미러링 프로세스가 실행 중이지 않음을 확인 | [`raw/haru-pr368-s21-live-test-start.json`](raw/haru-pr368-s21-live-test-start.json) |
| 20:27:34Z | 05:27:34 | `sendtestnotification` **HTTP 200**(rev `00131-baq`). 20:27:30Z에 204 항목도 있음 | [`raw/haru-pr368-live-push-server-results.json`](raw/haru-pr368-live-push-server-results.json) |
| 20:27:35Z | 05:27:35 | 완료 집계 **성공 2·실패 3**. 이 값은 예전 등록을 포함한 계정 전체 합계다. 메모리 한도 오류와 messaging 오류 코드는 없음 | 같음 |
| 20:27:35~36Z | 05:27:35~36 | S21 시스템 알림 중 HARU WebAPK 시험 알림이 **2건 일치**(제목·본문 일치) | [`raw/S21-ACTUAL-POSTDEPLOY-NOTIFICATIONS.json`](raw/S21-ACTUAL-POSTDEPLOY-NOTIFICATIONS.json) |
| (20:31:31Z 기록) | 05:31 | **사람 확인 ①: "S21만 받음"**. 16e는 1차 시험에서 받지 못함 | [`raw/haru-pr368-first-live-device-outcome.json`](raw/haru-pr368-first-live-device-outcome.json) |
| 그 뒤 | — | 허대표님이 16e에서 HARU를 닫았다 다시 열고, 본인 기기 재등록을 마침. 본인 기기 시험 직후 바로 홈 화면으로 나가 잠금함. 미러링 꺼짐 | [`FINAL-DEVICE-RECEIPT.json`](FINAL-DEVICE-RECEIPT.json) `iphone16e` |
| 20:32:38Z | 05:32:38 | `sendtestnotification` **HTTP 200**. 204 항목도 있음 | [`raw/haru-pr368-16e-own-test-server-results.json`](raw/haru-pr368-16e-own-test-server-results.json) |
| 20:32:39Z | 05:32:39 | 완료 집계 **성공 3·실패 1**. 오류 코드 없음 | 같음 |
| 20:33:14Z | 05:33:14 | S21 구독 키가 계속 현재 키(`true`)이고 DEFAULT 키가 아님(`false`) | [`raw/haru-pr368-s21-persisted-key-result.json`](raw/haru-pr368-s21-persisted-key-result.json) |
| (20:34:22Z 기록) | 05:34 | **사람 확인 ②: "16e에서도 받음"** → 두 기기 모두 본인 계정 실제 수신 완료 | [`FINAL-DEVICE-RECEIPT.json`](FINAL-DEVICE-RECEIPT.json) |

## 6. 완료 판정과 한계

**완료:** 승인 범위의 네 가지를 모두 마쳤다.

- PR #368 병합
- 자동 Hosting 배포 성공과 운영 반영 확인
- S21 본인 계정 실제 수신: 사람 확인과 시스템 알림 기록, 키 정합 확인 2회
- 아이폰 16e 본인 계정 실제 수신: 사람 확인

**한계 (과장 금지):**

- 원인은 §2의 후보 경로다. `pushsubscriptionchange` 실행 이벤트는 기록되지 않았다.
- 실제 끝단 수신(E2E)은 **허대표님의 두 사람 확인**에 근거한다.
  - S21은 시스템 알림 기록과 키 비교가 추가로 있다. 다만 활성 알림 기록일 뿐 알림 이력은 아니다.
  - 16e는 사람 확인만 있다. iPhone의 인증·토큰·기록·구독 키는 프로그램으로 읽지 않았다.
- 서버 성공 수는 기기를 구분하지 못한다. 2차 시험의 **실패 1건은 예전 등록이 남아 계정 합계에 포함된 것**이다. 실패 0이라고 하지 않으며, 그 실패를 특정 기기 탓으로 돌리지 않는다.
- 시험은 **본인 계정 자기 시험 알림뿐**이다. 전체 사용자 개발자 발송과 예약(정시) 알림은 시험하지 않았다.
- 토큰·UID·인증 정보·기록·endpoint는 읽거나 출력하거나 저장하지 않았다(각 원문 `scope`·`privateFieldsSaved: false`).

## 7. 바뀌지 않은 것·보존

- Functions(region `asia-northeast3`), Firestore 경로, 인증, 결제, AI 호출은 바뀌지 않았다. 추가 Functions/Rules 배포는 없었다. `sendTestNotification`·`lawSearch`는 이전에 승인된 배포의 revision 그대로다(시험 중 rev `sendtestnotification-00131-baq`).
- 이전 성공 기록(파일 4종 AI·저장 후 다시 열기·카카오, 이전 아이폰 수신)은 그대로 유효하며 다시 판정하지 않았다.
- 원래 사용자 worktree의 변경은 손대지 않고 보존했다. 병합 작업 worktree에는 추적되지 않는 `frontend/node_modules` 링크만 있다.
- 이 기록 작성 세션(CC)은 Read/Write/Edit/Glob/Grep만 썼다. 명령·시험·빌드·Git·CLI·API·기기 조작·메시지 발송은 하지 않았다.

## 8. 다음 (root 담당, 이 문서는 완료를 주장하지 않음)

- 이 기록 브랜치를 commit·push. 문서뿐이므로 main 병합·배포는 필요 없다.
- LaCie(`/Volumes/LaCie/Mac_작업/완료자료/…`)에 보관본을 복사하고 SHA-256으로 검증. 내부 원본은 보존한다.
- Slack `#haru2026-감사` 게시 문안: `/private/tmp/haru-pr368-final-confirmed-slack.txt`. 게시 여부는 root가 정한다.
