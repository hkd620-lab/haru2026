# 보충 — FCM SW update·활성화 대기 보호 (2026-11-09, CC 2차)

- 같은 worktree·브랜치 `codex/s21-push-subscription-key-20261109`, 기준 `f38e0ddc`. 작업 성격은 README와 같은 **수정 준비**다. 배포·main 병합·실기기 조작·알림 발송·Firebase/Firestore 쓰기·토큰 조회·Git 쓰기 없음.
- README와 이전 검토 기록(CC 1차 raw `/private/tmp/haru-s21-key-cc-1.raw.json`, 독립 진단 raw 등)의 원문·판정은 고치지 않는다. 이 문서는 그 뒤의 결정과 구현만 덧붙인다.

## 1. 결정 경과

| 순서 | 내용 | 근거 |
|---|---|---|
| CC 1차 의견 | 등록 경로에서 `registration.update()`를 1회 시도하되 **실패해도 등록을 계속**하자는 제안(README 4절, 원문 보존) | CC 1차 raw |
| Astra 권고 | 명시적 재등록 경로에만 `update()` + 제한시간 있는 활성화 대기. 새 installing/waiting worker의 activated까지 기다리고, update 실패·시간 초과·redundant는 등록 실패. `skipWaiting` 필수 아님, `clients.claim` 추가 안 함. 포그라운드 표시·Workbox SW는 건드리지 않음. **설계 조언이며 독립 Claude 정책 승인·배포 승인이 아님** | `/private/tmp/haru-s21-key-astra-activation-opinion.txt` |
| root 결정 | Astra 방식으로 구현. CC 1차의 "update 오류 시 계속" 안은 **채택하지 않음**(이전 SW가 잘못된 키로 구독을 다시 만들 수 있으므로 fail closed) | 이번 root 지시 |

## 2. 구현

### 2.1 `frontend/src/app/services/fcmRegistrationUpdate.ts` (신규 순수 helper)
- `updateFcmRegistrationAndWaitActive(registration, { timeoutMs = 10_000, timer })`
  1. registration 없음 → `fcm-sw-registration-missing`.
  2. `registration.update()`(동기 예외 포함) — 거부되면 그대로 실패.
  3. update 뒤 `installing ?? waiting`을 후보로 잡고 **그 worker가 `activated`**가 될 때까지 기다린다. 후보가 없으면 `active`가 `activated`여야 한다(`activating`이면 기다림). 이미 activated된 후보, 또는 새 worker가 이미 활성화돼 후보가 비고 active가 새 worker인 경우는 바로 통과.
  4. 후보가 이미/대기 중 `redundant` → `fcm-sw-redundant`. worker가 하나도 없음 → `fcm-sw-active-missing`.
  5. update와 활성화 대기를 **합친 전체 제한시간** 10초(시험에서는 가짜 시계 주입) → `fcm-sw-update-timeout`.
  6. 성공·실패와 관계없이 `finally`에서 타이머 취소와 `statechange` 리스너 해제.
- 하지 않는 것: `skipWaiting`, `clients.claim`, Workbox/루트 SW update, SDK 내부 변수·이벤트 재정의, SW 스크립트 변경.

### 2.2 `frontend/src/app/services/notificationService.ts`
- `registerThisDevice`의 `getSwRegistration`만 `updateFcmRegistrationAndWaitActive(await getFcmSwRegistration())`로 바꿨다(import 1줄 추가).
- `getFcmSwRegistration` 자체와 포그라운드 표시(`showForegroundNotification`의 `getRegistration`)는 기존 단순 조회 그대로다.
- 순서: 기존 `registerDeviceForPush`가 `getVapidKey`(65바이트 decode 검사)를 먼저 하므로 **잘못된 키 설정은 SW update 전에 `config` 실패**로 멈춘다.
- helper 예외는 기존 흐름대로 `token` 실패 → 구독 조회·SDK `getToken`·`saveToken`·`cacheToken`·`onRegistered`·성공 표시 없음. 제한시간이 있으므로 등록 버튼이 무한 대기(busy)로 남지 않는다.

### 2.3 시험 `frontend/test/fcmRegistrationUpdate.test.mjs` (신규 15개)
새 update 없음·기본 제한시간 10초·이전 active+새 installing(이전 active가 activated여도 새 worker activated 전 통과 안 함)·새 waiting·installing 우선·이미 활성화 완료(2경우)·active activating 대기·update 실패(거부/동기 예외)·redundant(이미/대기 중)·update 시간 초과·활성화 시간 초과·registration/worker 없음, 그리고 `registerDeviceForPush` 연결 3개(새 worker 활성화 전에는 구독·getToken 없음, 실패 5종은 `token` 실패이고 구독·getToken·저장·캐시·성공 없음, 잘못된 VAPID는 update 전 `config` 실패). 모든 경우 타이머·리스너 정리 확인.

기존 42개(pushSubscriptionKey 16 + pushDevice/regression 26)와 CC 1차 helper `pushSubscriptionKey.ts`는 그대로다.

## 3. 검증 상태 (과장 금지)

- **이 CC 2차 세션은 Bash를 쓰지 않았다**(root 지시: Read/Write/Edit/Glob/Grep만). 따라서 새 시험·빌드·tsc는 **이 세션에서 실행되지 않았고 통과를 주장하지 않는다.**
- root가 실행할 runner: `zsh /private/tmp/haru-s21-key-cc-tools/verify-final.sh`
  - Node 22 PATH, 시험 4개 파일(신규 15 + 기존 42 = 57개 예상), 자리값 env `npm run build`(dist는 배포 안 함), `dist`와 `public`의 SW 동일성 `cmp`.
  - tsc: `/private/tmp/haru-approved-two-functions-deploy-20261109/functions/node_modules/typescript/bin/tsc`(TypeScript 5.9.3 package.json 확인), 없으면 `/private/tmp/haru-device-display-check-20261109/...`, 둘 다 없으면 생략(설치 안 함). helper 2개 + 실제 lib.dom `ServiceWorkerRegistration` 대입 fixture(`/private/tmp/haru-s21-key-cc-tools/typecheck-browser-fixture.ts`) strict 검사, 프로젝트 tsconfig 전체는 변경 파일 오류만 추출(ExportModal 기준선 때문에 전체 통과 주장 안 함).
  - `git diff --check`(tracked) + 새 untracked 파일은 `git diff --no-index --check`로 읽기 전용 검사. staging 기반 전체 검사는 root가 따로 한다.
  - 로그: `/private/tmp/haru-s21-key-cc-verify-final-<시각>.log`(기존 파일 덮어쓰지 않음).
- 직전 root 실측: 기존 42/42 통과, 빌드는 권한 때문에 미실행(root 전달).

### 3.1 CC 1차 세션 Bash 권한 거부 6건 (숨기지 않음, 다른 경로로 재시도하지 않음)

| # | 거부된 명령(요지) | 목적 |
|---|---|---|
| 1 | `cat -n frontend/public/firebase-messaging-sw.js \| sed …apiKey 가림…; cat -n …/notificationService.ts` | SW·notificationService 읽기 |
| 2 | `node …/extract-prod-config.mjs …/firebase-messaging-sw.js --apply \| tee /private/tmp/haru-s21-key-cc-config-align.json; cd … && git diff --stat` | 운영 공개 config를 SW에 적용, diff stat |
| 3 | `node …/extract-prod-config.mjs … --apply > /private/tmp/haru-s21-key-cc-config-align.json; echo exit=$?; grep …` | 같은 적용(형식 바꿔 1회) |
| 4 | `zsh /private/tmp/haru-s21-key-cc-tools/verify.sh` | 시험·빌드·tsc 묶음 |
| 5 | `cd …/frontend && node --import tsx --test …3개 시험 \| tee /private/tmp/haru-s21-key-cc-tests.log \| tail -40` | 시험 로그 저장 |
| 6 | `PATH=…node@22… VITE_FIREBASE_*=x … npm run build > /private/tmp/haru-s21-key-cc-build.log 2>&1` | 자리값 env 빌드 |

원문은 CC 1차 raw의 `permission_denials`에 그대로 있다. root가 docs/reviews 아래에 원본 raw 로그를 보존한다.

## 4. 남은 질문·위험

1. **실제 브라우저 동작은 시험으로 증명되지 않았다.** 가짜 worker로 상태 전이만 검증했다. 특히 처음 등록 직후(`register()` 직후 installing만 있는 registration)에 `update()`를 부르는 경우는 명세상 허용(newest worker 존재)이지만 Chrome/Safari 실기기에서 거부되면 **첫 클릭이 token 실패로 끝나고 다음 클릭에서 성공**할 수 있다. fail closed 지시에 따라 예외를 두지 않았다. 문제가 보이면 "active가 없을 때는 update 생략, 후보 활성화만 대기" 같은 좁은 예외를 root/허대표님 결정 후 검토.
2. 아이폰(현재 수신 정상)도 등록 버튼을 누르면 이 경로를 탄다. update가 네트워크로 SW 스크립트를 다시 받으므로 오프라인·느린 망에서는 최대 10초 뒤 token 실패가 날 수 있다. 실기기 회귀 확인 필요.
3. 8.1절 독립 Claude 검토·Codex 검토·Hosting 배포 승인 — 대기. 이 보충은 승인·배포가 아니다.
4. S21 실제 수신 확인은 배포 뒤 허대표님 실기기에서만 가능.
