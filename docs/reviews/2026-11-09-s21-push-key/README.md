# 2026-11-09 S21 HARU PWA 웹 푸시 403 — 구독 공개키 정합 수정 준비

- 작업 브랜치: `codex/s21-push-subscription-key-20261109` (기준 `f38e0ddc`)
- 작업 성격: **수정 준비(FIX PREPARATION)**. 배포·main 병합·실기기 조작·알림 발송·Firebase/Firestore 쓰기 없음.
- 상태: 구현·로컬 시험 완료, **8.1절 독립 검토·Codex 검토 대기**, **Hosting 배포 승인 대기**.
- 이 문서는 수정이 배포됐다거나 S21이 실제로 알림을 받았다고 주장하지 않는다.
- 갱신(CC 2차): 4절 SW update 보호는 Astra 권고·root 결정에 따라 fail closed 방식으로 구현했다. 내용·검증 상태는 [`SUPPLEMENT-sw-update-guard.md`](SUPPLEMENT-sw-update-guard.md). 아래 1차 기록은 원문 그대로 둔다.

## 1. 사실 (근거 파일)

| 사실 | 근거 |
|---|---|
| S21 설치 PWA(visible·standalone)가 실제로 불러온 번들은 `/assets/index-DowmElnr.js`. FCM SW(`/firebase-messaging-sw.js`, scope `/firebase-cloud-messaging-push-scope`) 구독의 공개키(65바이트)는 SDK DEFAULT 키와 같고, 현재 VAPID·이전 VAPID와 다름 | `/private/tmp/haru-s21-astra-key-context-result.json` (Astra, 문자열·바이트 비교, 합성 자기검사 통과) |
| 사이트 권한·시스템 권한 허용, 새 등록 성공, 그러나 WebPush 403 | 위 Astra 기록 및 root 전달 사실 |
| 허대표님 승인으로 HARU 구독 1회 초기화(removed=true, absent=true) 후 기존 UI로 재등록했더니 다시 SDK DEFAULT 키로 구독이 생김 → 미해결 | root 전달 사실 |
| 운영 `getVapidKey` 값(87자)은 Firebase 현재 키와 같음 | root 전달 사실 |
| 운영 페이지 번들의 공개 Firebase web config와 `frontend/public/firebase-messaging-sw.js`의 **appId·apiKey가 서로 다름**(같은 프로젝트·sender). authDomain·projectId·storageBucket·messagingSenderId는 같음 | CC가 2026-11-09 운영 `https://haru2026.com/` 번들(`index-DowmElnr.js`)을 node fetch로 읽어 boolean·해시만 비교. 결과는 아래 3절 |
| 아이폰은 실제 수신 확인됨 — 이번 변경이 이 성공을 깨면 안 됨 | root 전달 사실 |

이전 독립 Claude 읽기 전용 진단(`/private/tmp/haru-s21-independent-diagnosis-1.raw.json`)은 "오래된(stale) 키"를 권했으나, 초기화 뒤에도 DEFAULT 키로 재생성된 사실은 stale만으로는 설명되지 않는다. 그 원문·판정은 고치지 않고 그대로 보존한다.

## 2. 가설 (실행 기록 없음 — 과장 금지)

- Firebase SDK는 토큰 정보(IndexedDB)를 **appId**를 키로 저장한다. SW의 appId가 페이지와 다르면 SW 쪽 `pushsubscriptionchange` 처리에서 페이지가 저장한 VAPID 키를 찾지 못하고 DEFAULT 키로 다시 구독할 수 있다(Astra가 공개 운영 소스로 확인한 경로).
- SDK `getToken`은 이미 있는 구독의 공개키가 요청한 VAPID와 다른지 확인하지 않고 그 구독을 쓸 수 있다. 그러면 토큰은 발급되지만 발송은 403이 된다.
- **실제로 S21에서 `pushsubscriptionchange`가 실행됐다는 기록은 없다.** 위는 원인 후보 경로이며 확정이 아니다.

## 3. 변경 내용 (범위)

### 3.1 `frontend/public/firebase-messaging-sw.js` — 공개 Firebase config 정합
- `appId`, `apiKey` 두 값만 운영 페이지 config와 같게 맞췄다. 둘 다 이미 공개 배포된 **Firebase 공개 web config**이며 서버 자격 증명이 아니다. **인증 정책은 바뀌지 않는다.**
- appId 끝자리: `24f2f7c5d04b4e62dd9652` → `7009366654c6ecea828549`.
- apiKey는 값 대신 SHA-256 앞 12자로만 기록: SW 이전 `38b7f07dd91f` → 이후 `9c40b1da1f83` (운영 페이지 `9c40b1da1f83`과 같음).
- 맞춤 뒤 재비교: `appIdEqual=true`, `apiKeyEqual=true`, authDomain·storageBucket·sender 모두 `true`.
- 바꾸지 않음: `measurementId`, SDK 10.8.0 importScripts, 백그라운드 표시·알림 클릭 로직, config 생성/빌드 구조.
- 추출·적용 도구: `/private/tmp/haru-s21-key-cc-tools/extract-prod-config.mjs` (저장소 밖, 값 출력 없음).

### 3.2 `frontend/src/app/services/pushSubscriptionKey.ts` (신규 순수 helper)
- `decodeVapidPublicKey` / `isValidVapidPublicKey`: base64url → 65바이트, 첫 바이트 `0x04`(비압축 점)만 통과.
- `ensurePushSubscriptionKey`: 이 registration의 구독 공개키가 설정 키와 바이트 단위로 같으면 그대로 둔다. 다르거나 알 수 없으면(`null`) **이 registration의 구독만** `unsubscribe()` 후 `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: 현재 키 바이트 })`. 해지 실패·구독 오류·새 구독 키 불일치는 예외.
- `getTokenWithMatchingSubscription`: 키 검증 → registration 확인(없으면 예외, SDK에 `undefined`를 넘기지 않음) → 구독 정합 → SDK `getToken` → 다시 구독을 읽어 **같은 키·같은 endpoint**일 때만 토큰 반환. 바뀌었으면 1회만 재시도, 또 바뀌면 예외. endpoint는 메모리에서 비교만 하고 기록하지 않는다.
- SDK 내부 변수 접근, `pushsubscriptionchange` 재정의, IndexedDB·localStorage 전체 삭제, 전체 토큰 삭제 없음.

### 3.3 `frontend/src/app/services/notificationService.ts` (`registerThisDevice` 어댑터만)
- `getVapidKey`: 65바이트 공개키가 아니면 `undefined` → 기존 `registerDeviceForPush`가 SW 등록·구독 변경 전에 `config` 실패로 멈춤.
- `getToken`: 위 helper를 거쳐 SDK `getToken`을 부른다. helper 예외는 기존 흐름대로 `token` 실패 → `saveToken`·`cacheToken`·`onRegistered`·성공 표시 없음.
- `registerDeviceForPush`·저장(`saveDeviceToken`)·캐시 API, `getFcmSwRegistration`, 포그라운드 표시는 바꾸지 않았다.

### 3.4 바꾸지 않은 것
- `App.tsx`·routes·UI·Settings 화면, Functions(리전·경로·모델·호출·결제), Rules, Flutter, 의존성·SDK 버전, 로고.
- Firestore 경로(`users/{uid}/settings/settings`의 `fcmTokens` 저장 방식 포함) 변경 없음. Functions region `asia-northeast3` 영향 없음.

## 4. SW 업데이트·활성화 (미변경 — 결정 대기)

- FCM SW scope(`/firebase-cloud-messaging-push-scope`)에는 페이지 이동이 없어서, 기존 기기는 `register()`·`update()` 호출이나 브라우저 자체 점검(기능 이벤트 시 24시간 경과 등) 전까지 **이전 SW 스크립트(이전 appId)를 계속 쓸 수 있다.** `getFcmSwRegistration`은 기존 registration을 찾으면 그대로 반환한다.
- 이번 클라이언트 수정은 SW가 갱신되지 않아도 **명시적 등록 시점**에 구독 키를 맞추고 토큰을 받는다. 다만 이전 SW가 남아 있는 동안 `pushsubscriptionchange`가 생기면 DEFAULT 키로 바뀔 가능성은 남는다(다음 등록 때 다시 맞춰짐).
- CC 의견: 필요하면 **명시적 등록 경로에서만** `registration.update()`를 1회 시도하고 실패해도 등록을 계속하는 제한된 보호를 추가할 수 있다. 푸시·포그라운드 알림마다 update하지 않는다. **root가 Astra 최종 의견을 기다리는 중이므로 이번에는 구현하지 않았다.**

## 5. 검증 기록 (명령·결과, 실패 포함)

실행 환경: Node `v22.23.2` (`/opt/homebrew/opt/node@22/bin/node`), `frontend/node_modules`는 동일 package·lock 확인된 `/private/tmp/haru-iphone-push-repair-20261109/frontend/node_modules` 심볼릭 링크(수정 없음).

| 명령 | 결과 |
|---|---|
| `node --import tsx --test test/pushSubscriptionKey.test.mjs test/pushDevice.test.mjs test/pushDeviceRejection.regression.test.mjs` (frontend) | **42/42 통과** (기존 26 + 신규 16). helper 인자 형식 수정 후 재실행도 42/42 |
| `zsh /private/tmp/haru-s21-key-cc-tools/verify.sh` (테스트·빌드·tsc 묶음 runner) | **CC 세션 권한 거부로 실행 안 됨** |
| `npm run build` (자리값 env `VITE_FIREBASE_API_KEY=x … PROJECT_ID=haru2026-8abb8 …`, 로그 `/private/tmp/haru-s21-key-cc-build.log`) | **CC 세션 권한 거부로 실행 안 됨 — 빌드 통과 주장 없음.** root 실행 필요 |
| `tsc` (helper 단독 strict / 프로젝트 변경 파일 오류 추출) | **실행 불가**: 이 worktree의 `frontend`·`functions` 어디에도 `typescript` 설치 없음. 의존성 수정 금지라 설치하지 않음. 전체 tsc 통과 주장 없음(ExportModal 기존 구문 오류 기준선). TS 5.7+ typed array 제네릭 차이를 피하려고 `subscribe`에는 새 `ArrayBuffer`를 넘김 |
| `git diff --check` | 출력 없음(공백 오류 없음) |

신규 시험 항목: 같은 키 유지(해지·재구독 없음), 구독 없음 → 생성, DEFAULT 키 → 이 registration만 해지 후 현재 키로 재구독, 키 `null` → 교체, 잘못된 VAPID → 구독 조회·변경·getToken·저장 없음(연결 시험에서 SW 등록 0회), registration 없음 → SDK 미호출, 해지 실패/예외·구독 오류·새 구독 키 불일치 → 저장 없음, getToken 중 키 변경 → 1회 재시도, 같은 키·endpoint 교체 → 이전 토큰 저장 안 하고 재시도 토큰만 저장, 구독 소멸 → 재시도, 반복 경합 → 2회에서 실패·저장/캐시/성공 없음.

## 6. 남은 질문·대기 항목

1. 8.1절 독립 Claude 검토(root가 새로 실행), Codex PR 검토 — 대기.
2. Hosting 배포 — 허대표님 승인 대기. 로컬 dist는 배포하지 않는다.
3. 4절 SW update 보호를 넣을지 — Astra 최종 의견·root 결정 대기. → (CC 2차) 결정·구현됨, 보충 문서 참조. CC 1차의 "실패해도 계속" 안은 채택되지 않음.
4. 실제 S21 수신 — 배포 뒤 허대표님 실기기 확인 필요(AI가 대신 확인할 수 없음). 아이폰 수신 회귀 여부도 함께 확인 필요.
5. `npm run build`·tsc 결과 — root 실행 필요.
