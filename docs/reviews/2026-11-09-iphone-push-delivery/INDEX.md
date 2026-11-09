# 2026-11-09 아이폰 알림 실수신 미완료 — 독립 진단 1 색인

- 작성: CC 실행자 (기록 전용). 제품 파일·기존 문서·Git·PR·배포·Slack·실제 push 호출은 하지 않았다.
- 성격: **읽기 전용 독립 진단 기록**이다. 원인은 **미확정**이다. 이 문서와 진단은 **새 제품 변경의 승인이 아니다**.
- 배경: PR #364·#365 병합 및 함수 2개(`lawSearch`·`sendTestNotification`, `haru2026-8abb8`·`asia-northeast3`) 배포가 끝난 뒤에 한 추가 진단 기록이다. 새 product PR은 만들지 않는다.

## 1. 진단 대상

| 항목 | 값 |
|---|---|
| 대상 exact source | `main` `f38e0ddcad2c130e92333b0c5dd735972e09e5e8` (진단 시 cwd: `/private/tmp/haru-approved-two-functions-deploy-20261109`, 읽기 전용) |
| 진단 시작 (meta `startedAt`) | `2026-11-09T07:35:20.421624+00:00` |
| 진단 종료 (meta `finishedAt`) | `2026-11-09T07:38:29.098573+00:00` |
| 실행 방식 (meta `command`) | `claude -p --permission-mode plan`, 도구 `Read,Glob,Grep,Bash`(읽기 계열 허용 목록), `--no-session-persistence` |
| 종료 상태 | meta `exitCode` 0, raw `is_error: false`, `subtype: "success"`, `terminal_reason: "completed"`, `permission_denials: []`, err.log 0바이트 |

이 진단 실행에는 실패나 권한 거부 기록이 없다. raw 결과 본문에 "계획 파일 작성과 계획 승인 요청 기능은 이 세션에서 쓸 수 없어 결과를 여기에 적습니다"라는 문장이 있다. 이것은 plan 모드에서 결과를 전달한 방식에 대한 진단자의 설명이다. 실행 실패를 뜻하지 않는다.

## 2. 원문 (수정 없이 보존)

| 파일 | 원본 위치 |
|---|---|
| [raw/haru-push-delivery-independent-diagnose-1.prompt.txt](raw/haru-push-delivery-independent-diagnose-1.prompt.txt) | `/private/tmp/haru-push-delivery-independent-diagnose-1.prompt.txt` |
| [raw/haru-push-delivery-independent-diagnose-1.raw.json](raw/haru-push-delivery-independent-diagnose-1.raw.json) | `/private/tmp/haru-push-delivery-independent-diagnose-1.raw.json` |
| [raw/haru-push-delivery-independent-diagnose-1.meta.json](raw/haru-push-delivery-independent-diagnose-1.meta.json) | `/private/tmp/haru-push-delivery-independent-diagnose-1.meta.json` |
| [raw/haru-push-delivery-independent-diagnose-1.err.log](raw/haru-push-delivery-independent-diagnose-1.err.log) | `/private/tmp/haru-push-delivery-independent-diagnose-1.err.log` (0바이트) |

보존 검증(2026-11-09, CC 실행):
- `cmp`로 원본 4개와 복사본 4개를 비교했다. 모두 동일하다.
- 읽기 전용 Node(`crypto.createHash('sha256')`)로 원본과 복사본의 SHA-256을 비교했다. 4개 모두 `EQUAL`이다. 값은 [SHA256SUMS.txt](SHA256SUMS.txt)에 있다.
- 복사 과정에서 `cp -n` 명령은 세션 권한에서 거부됐다(원문: "cp with flags requires manual approval to ensure path safety"). 그래서 대상 폴더가 새로 만든 빈 폴더임을 `ls`로 확인한 뒤 옵션 없는 `cp`로 복사했다. 기존 파일을 덮어쓴 것은 없다.
- 첫 시도에서는 셸 변수를 쓴 명령도 거부됐다(원문: "A variable in this command can't be checked before it runs"). 그 명령은 실행되지 않았고, 이후 경로를 그대로 적어 다시 실행했다.

## 3. 시험 범위 (Scope)

- 진단 입력(prompt) 기준 실제 시험: `2026-11-09T07:27:15Z`에 설정 화면에서 본인 기기 테스트 알림을 1회 보냈다. 서버 결과는 HTTP 200, 1.63초였다. 등록된 토큰 4개 중 2개 성공, 2개 실패였다. 같은 시간대 OOM은 없었다.
- 사용자 확인: **이번 실제 시험에서 앞쪽 화면(FG) 수신 없음, 백그라운드(BG) 수신 없음.** 두 가지 모두 사용자가 확인했다. 사용자 답은 "어느 기기에서도 못 받았습니다"였다.
- 서버 HTTP 200은 FCM이 접수했다는 뜻이다. 기기 실수신 근거가 아니다.

## 4. 진단 내용 구분 — 코드 흐름 확인 vs iOS 실측 원인 가설

| 구분 | 내용 | 근거 수준 |
|---|---|---|
| 코드 흐름 확인 | `firebase-messaging-sw.js`가 10.8.0 compat SDK를 쓴다. SDK `onPush`는 `getClientList`(`includeUncontrolled: true`)에서 visible client가 있으면 `postMessage`만 하고 `showNotification` 없이 push 이벤트를 끝낸다(결함 A). | 소스 코드로 확인 |
| 코드 흐름 확인 | PR #363의 `showForegroundNotification`은 push 이벤트 밖에서 `registration.showNotification`을 부른다. | 소스 코드로 확인 |
| 코드 흐름 확인 | 백그라운드에서는 SDK 표시 뒤 `onBackgroundMessage`가 같은 tag로 다시 표시한다(결함 B, 수신 여부와 무관). | 소스 코드로 확인 |
| iOS 원인 가설 | 결함 A 때문에 iOS WebKit이 silent push로 처리해 표시가 안 되거나 구독이 끊길 수 있다. | **추정. 실기기 실측 아님** |
| iOS 원인 가설 | 아이폰 PWA가 백그라운드·잠금 상태에서도 visible로 보고되는지. | **미실측** |
| 미확인 | 성공 2건이 어느 기기인지, 실패 2건의 오류 코드(로그 요약의 `messagingErrorCodes` 비어 있음). | 자료 없음 |

진단은 BG 수신도 없었던 이유를 결함 A만으로 설명하지 않는다. 따라서 원인은 미확정으로 둔다.

## 5. 제안 상태

- 진단이 제안한 **SW push 선처리**(SDK `importScripts`보다 먼저 `push` 리스너를 두고 notification payload를 `event.waitUntil(showNotification)`으로 즉시 표시)는 **아직 구현하지 않았고 배포하지 않았다.**
- 이 수정은 Hosting 변경이다. 승인받은 PR #363~#365와 함수 2개 배포 범위 밖이다. 진단 권고는 Web Inspector 확인과 FG/BG A/B 시험 결과가 결함 A를 가리킬 때만 draft PR을 준비하는 것이다. 그 뒤 preview, 8.1 판정① 독립 검토, 허대표님 승인을 거친다.

## 6. 집중 모드(Focus) 상태

- 사용자 보고: 아이폰 집중 모드가 **켜져 있음을 확인했고, 끔**.
- 집중 모드를 끈 뒤 재시험 결과는 **대기 중**이다. 집중 모드가 원인이었는지는 이 결과가 나오기 전에는 판단하지 않는다.

## 7. 이전 검토 원문 연결 (누락 없이 보존, 이번에 수정하지 않음)

- PR #363 (기기 권한·등록 표시, 내 기기 테스트): [../2026-11-09-iphone-push/README.md](../2026-11-09-iphone-push/README.md), [followup-1/INDEX.md](../2026-11-09-iphone-push/followup-1/INDEX.md), [final-gate/INDEX.md](../2026-11-09-iphone-push/final-gate/INDEX.md), [final-gate/INDEX-codex-3-and-finish-1.md](../2026-11-09-iphone-push/final-gate/INDEX-codex-3-and-finish-1.md)
- PR #365 (`sendTestNotification` 512MiB): [../2026-11-09-iphone-push-memory/README.md](../2026-11-09-iphone-push-memory/README.md) 및 같은 폴더의 `INDEPENDENT-REVIEW-*`, `CODEX-INDEX-*`, `SUPPLEMENT-1.md`, `raw/`
- PR #364 (법령검색 첨부 표시): [../2026-11-09-law-attachment-labels/README.md](../2026-11-09-law-attachment-labels/README.md)

final 원문 보존을 위해 위 기존 문서와 요약은 고치지 않았다. 이번 내용은 이 새 폴더에만 추가했다.

## 8. 기록 제외

- API 키, 토큰, UID, 개인정보, 원본 서버 로그는 이 문서에 넣지 않았다. 서버 결과는 진단 입력에 적힌 집계 수치만 옮겼다.
- 코드 변경이 아니므로 빌드는 하지 않았다.
- stage·commit·push는 root가 정식 도구로 권한을 받아 진행할 예정이다. 이 실행자는 Git 쓰기와 GitHub API 사용을 하지 않았다.
