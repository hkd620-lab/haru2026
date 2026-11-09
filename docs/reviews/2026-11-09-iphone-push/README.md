# 2026-11-09 아이폰 알림 미수신 복구 (웹 알림 설정/서비스)

- 실행: Claude Code(CC) 실행자
- 기준: `main` `42e3a1dc` 기반 새 worktree, 로컬 브랜치 `codex/iphone-push-repair-20261109`
- 원격 브랜치: `codex-iphone-push-repair-20261109`
  - 사유: 원격에 `refs/heads/codex` 브랜치(`e807c178`)가 있어 `codex/...` 이름은 ref 경로 충돌로 push할 수 없다(`git ls-remote --heads origin codex` 실측). 지시대로 슬래시 대신 하이픈 이름을 썼다.
- 상태: 초안 PR. 독립 검토·Codex 검토·실기기 E2E·병합·운영 배포는 상위 작업자가 후속 진행한다. 이 실행자는 자기 승인·병합·배포·Slack 게시를 하지 않았다.

## 1. 요청 원문

> CC 실행자로 아래 승인된 범위의 최소 수정을 구현·검증하고 초안 PR까지 만드세요. 사용자의 현재 지시는 "아이폰 알림이 안 오는 원인부터 해결하고, 남은 3건도 모두 완료하자." 입니다. 구현 범위는 웹 알림 설정/서비스만. AGENTS.md·CLAUDE.md·Slack 정책8.1/9.1을 먼저 읽으세요. 원본 작업본/다른 worktree 변경·삭제 금지. 현재 cwd 새 worktree codex/iphone-push-repair-20261109, main42e3a1dc 기반.
> 실측 근거: 아이폰 설치 PWA5nav 계정에서 설정이 '알림 받기 활성화됨'인데 iOS 권한 요청을 안 한 상태였습니다. UI 스위치를 OFF→ON하니 iOS 최초 'HARU에서 알림을 보내고자 합니다' 프롬프트가 실제 나타났고 허용 후 on 복구. 이전 desktop developer계정 self-test3기기1성공2실패는 사용자확인 다른 기기에서만 수신. 아이폰계정 기록19 vs desktop396이라 계정 동일 가정 금지. 현재 실기기는 등록 후 self-test 버튼이 개발자에게만 노출되어 자기 계정 수신을 확인할 방법이 부족.
> 원인코드: SettingsPage는 계정 notificationEnabled(누락시 true)만 보고 활성화라고 표시, 이 기기의 Notification.permission/등록 상태를 구분 안 함. AppInitializer 자동 permission 요청은 iOS 사용자제스처 요구를 충족 못함. cached token 존재하면 초기화 건너뜀. requestNotificationPermission과 setupForegroundMessageListener가 onMessage를 각각 등록하고 new Notification을 사용(iOS foreground는 serviceWorker.showNotification 필요).
> 최소 구현: (1) SettingsPage 알림 영역에 계정 알림 여부와 별도로 이 기기의 권한/등록 상태를 정확히 표시. 알림 켜져 있어도 '이 기기에서 알림 받기' 명시적 버튼으로 권한 요청/기기 재등록할 수 있게 함. 계정 알림 스위치를 껐다 켤 필요 없게. 사용자가 버튼을 누른 제스처에서 권한 요청해야 함. denied/unsupported/미설치PWA 경우 적절한 안내, 권한차단 우회 안 함. 토큰만 있다는 이유로 등록 성공/계정일치를 단정하지 말 것. 과도한 자동 Firestore 읽기나 마이그레이션 금지. (2) 같은 알림영역에서 '내 기기에 테스트 알림 보내기' 버튼을 일반 로그인 사용자도 사용 가능하게 하되 기존 sendTestNotification(요청 auth.uid의 토큰만 보내는 existing callable) 그대로 사용. 등록된 본인 기기 전체 대상임을 UI로 정확히 안내, 실제수신과 서버성공을 구분. 관리자broadcast 변경/호출 금지. (3) foreground 수신을 iOS에서도 serviceWorker registration.showNotification으로 처리하고 중복 listener 등록을 방지. 불필요 토큰/payload 원문 console 로그는 해당 경로에서 제거. 안정적 오류 처리. 라우터 App.tsx/home 수정 없이 이 두 파일 및 작은 helper 필요시 가능. backend/Rules/인증/결제/가격/로고/저장경로는 변경 금지. 기존 디자인 유지.
> 의미 있는 회귀시험: permission default인데 account on일 때 등록 필요, denied/unsupported, gesture 경로, 등록 실패가 성공 표시 안 됨, self-test 오직 기존본인callable, foreground showNotification 및 중복방지 관련 테스트. 기존 test방식에 맞춰 dependency injection/isolated helpers로 구현과 똑같은 문자열테스트보다 동작시험. 웹 build+관련 테스트, gitdiffcheck. lock 변경/전체 npm install 금지. 원본 frontend/node_modules와 lock cmp동일 확인 후 symlink로 재사용 가능. 합성env build는 운영배포확인으로 표현하지 말 것. 새일반최종자료 LaCie는 상위가보관, 임시로그/tmp가능.
> docs/reviews/2026-11-09-iphone-push/에 이 요청원문·원인·검증결과·제약 기록. 한국어 커밋과 PR본문(목적/변경/검증/배포영향/위험/롤백, Functions/Rules/인증/결제변경없음)으로 초안PR생성·push. remote에 codex브랜치가있어 slash충돌하면 codex-iphone-push-repair-20261109로push하고사유기록. 독립검토/실기기/운영배포는 상위가 후속진행하므로 자기승인·병합·배포·Slack·다른메시지 금지. 모든 권한거부는 우회하지말고 반환. 고위험동작/의미변경필요면 중단보고. 저장데이터삭제·임의cleanup·restore/stash/reset금지.

## 2. 원인 (코드 확인)

| 위치 (main `42e3a1dc`) | 문제 |
|---|---|
| `SettingsPage.tsx` 알림 영역 | 계정 `notificationEnabled`(문서에 없으면 `true`)만 보고 "✓ 활성화됨"으로 표시. 이 기기의 `Notification.permission`·등록 여부를 구분하지 않음. 계정이 켜져 있으면 권한 요청 경로가 스위치 OFF→ON 뿐이었음 |
| `App.tsx` `AppInitializer` | 로그인 직후 사용자 제스처 없이 `requestNotificationPermission` 호출 → iOS는 제스처 없는 권한 요청에 창을 띄우지 않음. 또 `localStorage`에 캐시 토큰이 있으면 초기화를 건너뜀 |
| `notificationService.ts` `requestNotificationPermission` | `await isSupported()` 뒤에 권한 요청(제스처 연결이 약해짐). 등록 성공 때마다 `onMessage`를 새로 등록하고 `new Notification` 사용, 토큰 원문·payload를 `console.log` |
| `notificationService.ts` `setupForegroundMessageListener` | `onMessage`를 별도로 또 등록(중복 표시 가능), `new Notification` 사용(iOS 설치 PWA 미지원), payload `console.log` |
| 개발자 도구 영역 | 테스트 알림 버튼이 개발자 이메일에만 노출 → 일반 사용자는 자기 계정 수신을 확인할 방법이 없음 |

## 3. 변경 (웹 프론트만)

| 파일 | 내용 |
|---|---|
| `frontend/src/app/services/pushDevice.ts` (신규) | 브라우저·Firebase를 주입받는 순수 helper. 기기 상태 판정(`resolveDevicePushStatus`/`describeDevicePushStatus`), 등록 흐름(`registerDeviceForPush` — 권한 요청을 다른 await보다 먼저 동기 시작, 권한·토큰·저장 모두 성공해야 `ok`), 실패 사유 문구, 내 기기 테스트(`sendSelfTestNotification` — `sendTestNotification`만 호출), 결과·오류 문구, 포그라운드 표시(`showForegroundNotification` — SW `showNotification` 우선, 실패 시 창 알림, 그것도 실패하면 `failed`), 1회 설치 리스너(`createForegroundListenerInstaller`) |
| `frontend/src/app/services/notificationService.ts` | `requestNotificationPermission(userId): Promise<boolean>` 시그니처 유지(App.tsx·스위치 경로 그대로 동작), 내부는 `registerThisDevice` 결과의 `ok`. 상세 결과 `registerThisDevice`, 기기 상태 `getThisDevicePushEnvironment`(Firestore 읽기 없음) 추가. 토큰 저장 로직은 `saveDeviceToken`으로 옮기되 경로 `users/{uid}/settings/settings`·`fcmTokens` 최대 5개·시간대 보완 규칙 동일. `onMessage`는 모듈 단일 설치 지점 1곳. 토큰·payload 원문 로그 제거 |
| `frontend/src/app/pages/SettingsPage.tsx` | 계정 표시 문구를 "✓ 계정 알림 켜짐"으로 구분. 계정 알림이 켜져 있을 때 이 기기 상태(확인 중/홈 화면 앱 필요/미지원/차단/허용 필요/권한 허용됨(등록 확인 전)/등록 완료) 표시, `이 기기에서 알림 받기`·`이 기기 다시 등록하기` 버튼(클릭 핸들러에서 곧바로 권한 요청), `내 기기에 테스트 알림 보내기` 버튼과 "이 계정에 등록된 내 기기 전체로 보내집니다" 안내, 서버 접수와 실제 수신 구분 문구. 화면 복귀(visibilitychange) 때 기기 권한만 다시 확인 |
| `frontend/test/pushDevice.test.mjs` (신규) | 동작 시험 14건 (아래) |

"등록 완료"는 이번 화면에서 권한·토큰 발급·`fcmTokens` 저장이 모두 성공한 경우에만 표시한다. 권한 허용·캐시 토큰만 있으면 "권한 허용됨 (등록 확인 전)"으로 두고 재등록 버튼을 보인다. 계정 일치 여부는 클라이언트에서 단정하지 않는다(서버 테스트 결과로 확인).

## 4. 변경하지 않은 것

- Functions(`sendTestNotification`·`sendBroadcastNotification` 포함), Firestore/Storage Rules, 인증, 결제, 가격, 로고·아이콘, 저장 경로, 데이터 마이그레이션 — 변경 없음.
- `App.tsx`(라우터·`AppInitializer`), 홈 화면 — 변경 없음. 따라서 `AppInitializer`의 제스처 없는 자동 권한 요청과 캐시 토큰 로그(`console.log(existingToken)`)는 그대로 남는다. 제스처 문제는 설정 화면 명시 버튼으로 해결하고, 남은 로그 제거는 범위 밖이라 후속 결정 사항으로 둔다.
- `public/firebase-messaging-sw.js`(백그라운드 수신·payload 로그) — 범위 밖이라 변경 없음.
- 개발자 도구 영역의 기존 테스트 발송·관리자 전체 알림 — 변경 없음.
- `package.json`·lock — 변경 없음, `npm install` 실행 안 함.

## 5. 검증 결과 (2026-11-09, 로컬)

| 항목 | 명령 | 결과 |
|---|---|---|
| node_modules 재사용 근거 | `cmp` 로 `/private/tmp/haru-complete-pending-20261109/frontend/{package-lock.json,package.json}` 와 이 worktree 비교 | 둘 다 동일 → 해당 `node_modules`를 symlink로 재사용(커밋 대상 아님). 원본 `haru2026-source/frontend` 와의 `cmp`는 세션 허용 디렉터리 밖이라 권한 거부되어 수행하지 못함 |
| 새 동작 시험 | `node --import tsx --test test/pushDevice.test.mjs` | 14/14 통과 |
| 기존 알림 시간대 시험 | `node test/notificationTimeZone.policy.test.cjs` | 통과 |
| 웹 빌드 | `npm run build` (gitignore 대상 `frontend/.env.production.local`에 합성 자리값) | prebuild env 검증 통과, `✓ built in 1m 42s`. **합성 env 빌드이며 운영 배포 확인이 아니다** |
| 공백 검사 | `git diff --check` | 문제 없음 |
| 타입검사 | `tsc --noEmit` (다른 worktree의 tsc 실행) | 세션 권한 거부로 미실행. Vite 빌드는 타입검사를 하지 않으므로 CI·검토자가 확인 필요 |

시험 14건 요지: 계정 on + 권한 default → 등록 필요·버튼 표시 / 권한 허용·캐시만으로 등록 완료 단정 안 함 / denied·미지원·아이폰 미설치 PWA는 버튼 없이 안내 / 호출 직후 동기적으로 권한 요청 시작(제스처 경로) / granted면 창 없이 재등록, denied면 권한 재요청 안 함 / 권한 창 닫기·거부·예외는 실패 / 미지원·VAPID 누락·토큰 실패·SW 실패·저장 실패는 모두 실패이고 캐시·완료 처리 안 함 / 내 기기 테스트는 `sendTestNotification`만, `title`·`body` 외 값 전송 안 함 / 부분 성공·전체 실패·응답 이상·`not-found`·`unauthenticated`·일반 오류 문구(원문 오류 미노출) / 포그라운드 SW `showNotification` 우선·포도 아이콘·tag / SW 없음→창 알림, 둘 다 실패→`failed`(예외 없음), 권한 없음·빈 payload 건너뜀 / 여러 번 설치해도 `onMessage` 1회 / 표시 실패가 unhandled rejection으로 새지 않음·지원 확인 오류 뒤 재시도 / 서비스·화면 연결(단일 `onMessage`, 토큰·payload 로그 없음, 테스트 핸들러에 broadcast 없음, 리전 `asia-northeast3`).

## 6. 남은 위험·후속 확인 (상위 작업자)

- 실기기 E2E 필요(AI가 대신 확인 불가): 아이폰 설치 PWA에서 ① 권한 default 상태로 설정 화면 진입 시 "이 기기: 알림 허용 필요" 표시 ② 버튼 탭 → iOS 권한 창 → 허용 → "등록 완료" ③ "내 기기에 테스트 알림 보내기" → 서버 결과 문구와 실제 알림 표시 ④ 앱을 연 상태(포그라운드)에서 알림이 1번만 표시 ⑤ Safari 탭(미설치)에서 "홈 화면 앱에서만" 안내.
- 같은 계정의 다른 기기에도 테스트 알림이 간다(서버가 계정 등록 기기 전체로 발송). UI에 안내함.
- 서버 `sendTestNotification`은 `NotRegistered` 토큰을 자동 삭제한다(기존 동작, 변경 없음).
- 권한이 `default`인데 Messaging 미지원인 브라우저에서는 권한 창이 먼저 뜬 뒤 "미지원"으로 끝날 수 있다(제스처 안 권한 요청을 위해 순서를 앞당긴 결과).
- 포그라운드 알림 클릭은 FCM 서비스워커의 기존 `notificationclick`(기록 화면 열기)을 따른다.

## 7. 롤백

- 이 PR의 커밋을 `git revert` 하면 이전 동작으로 돌아간다. 데이터 구조·저장 경로 변경이 없어 데이터 복구 작업은 필요 없다.
