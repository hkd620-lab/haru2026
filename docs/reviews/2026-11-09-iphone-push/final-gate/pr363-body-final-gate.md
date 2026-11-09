## 목적
아이폰 설치 PWA에서 설정은 "알림 받기 활성화됨"인데 이 기기는 iOS 알림 권한 요청을 받은 적이 없어 알림이 오지 않던 문제를 해결합니다. 계정 알림 스위치를 껐다 켜지 않아도 이 기기를 등록할 수 있게 하고, 일반 사용자도 자기 기기 수신을 확인할 수 있게 합니다.

원인(main `42e3a1dc` 코드 확인): 설정 화면은 계정 `notificationEnabled`만 보고 활성화로 표시했고 이 기기 권한·등록 상태를 구분하지 않았습니다. `AppInitializer`의 자동 권한 요청은 사용자 제스처가 없어 iOS가 권한 창을 띄우지 않고, 캐시 토큰이 있으면 아예 건너뜁니다. 포그라운드 `onMessage`가 두 곳에서 등록되고 iOS 설치 PWA가 지원하지 않는 `new Notification`을 썼습니다. 상세: `docs/reviews/2026-11-09-iphone-push/README.md`

## 변경 (웹 프론트만)
- `frontend/src/app/services/pushDevice.ts` (신규): 의존성을 주입받는 helper — 기기 상태 판정, 등록 흐름(다른 await보다 먼저 권한 요청 시작, 권한·토큰·저장 모두 성공해야 `ok`), 내 기기 테스트(`sendTestNotification`만 호출), 결과 문구, 포그라운드 표시(SW `showNotification` 우선), 1회 설치 리스너
- `frontend/src/app/services/notificationService.ts`: `requestNotificationPermission(userId): Promise<boolean>` 시그니처 유지, `registerThisDevice`·`getThisDevicePushEnvironment`(Firestore 읽기 없음) 추가, 토큰 저장 경로·최대 5개·시간대 보완 규칙 동일, `onMessage` 단일 등록, 토큰·payload 원문 로그 제거
- `frontend/src/app/pages/SettingsPage.tsx`: 계정 알림("✓ 계정 알림 켜짐")과 이 기기 상태를 구분 표시, `이 기기에서 알림 받기`/`이 기기 다시 등록하기`, `내 기기에 테스트 알림 보내기`(등록된 내 기기 전체 대상 안내, 서버 접수와 실제 수신 구분), 기존 디자인 유지
- `frontend/test/pushDevice.test.mjs` (신규): 동작 시험 14건
- `docs/reviews/2026-11-09-iphone-push/README.md`: 요청 원문·원인·검증·제약

### 후속 1 (`c6a753a6`, 코드) — 권한 요청 거부 누수·등록 버튼 예외 처리
- 상위 합성 probe가 재현한 문제: `requestPermission()`이 즉시 거부되고 `isSupported()`가 25ms 뒤 true면 결과는 `dismissed`이지만 그 전에 `unhandledRejection`이 발생(Node 26 `PromiseRejectionHandledWarning`).
- `registerDeviceForPush`: 권한 요청은 지금처럼 **지원 확인보다 먼저 동기적으로 시작**(제스처 유지)하고, 시작 직후 거부 처리를 붙임. `requestPermission` 동기 예외도 `dismissed`로 처리.
- 서버 `fcmTokens` 저장 뒤 localStorage 캐시·포그라운드 준비 실패(독립 검토 권장 1): 서버 등록 성공은 유지하고 `{ ok: true, warning: 'cache' | 'listener' }`로 구분, 예외를 내보내지 않음. 서버 저장 실패는 이전과 같이 `save` 실패.
- `SettingsPage` `handleRegisterThisDevice` → 새 helper `runDeviceRegistration`: 예기치 못한 예외·거부에도 로딩 해제, 등록 완료로 표시하지 않음, 오류 안내. 경고 있는 성공은 등록 완료 + `toast.warning` 안내.
- `frontend/test/pushDeviceRejection.regression.test.mjs` (신규): 회귀시험 12건(원본 probe 조건 포함).
- 원문·근거: `docs/reviews/2026-11-09-iphone-push/followup-1/INDEX.md` (`1588d57a`, 문서). 최종 게이트 원문: `docs/reviews/2026-11-09-iphone-push/final-gate/INDEX.md`.

**Functions·Firestore/Storage Rules·인증·결제·가격·로고·저장 경로 변경 없음. `App.tsx`·홈 변경 없음. lock 변경 없음.** (후속 1도 동일, `notificationService.ts` 변경 없음)

## 검증 (로컬, 2026-11-09)
| 항목 | 결과 |
|---|---|
| `node --test test/pushDeviceRejection.regression.test.mjs test/pushDevice.test.mjs` (tsx loader) | 26/26 통과 (후속 12 + 기존 14) — `c6a753a6`. 독립 재검토자도 재실행해 26/26 |
| 상위 원본 probe 재실행 | 수정 전 `earlyUnhandledRejection: true` → 수정 후 `false`, 경고 없음 |
| 수정 전 코드(`6500eac8`) 합성 대조 | 거부 누수 1건, 동기 예외·캐시 예외가 밖으로 전파 → 새 시험이 잡는 실패를 재현 |
| `node test/notificationTimeZone.policy.test.cjs` | 통과 |
| `npm run build` | 통과 (`✓ built in 2m 11s`) — **gitignore 대상 `frontend/.env.production.local` 합성 자리값 env 빌드이며 운영 배포 확인이 아님** |
| `git diff --check` | 문제 없음 (원문 로그 폴더만 `.gitattributes`로 공백 검사 제외) |
| 타입검사 | 아래 참고. 이번 변경으로 늘어난 진단 0. **저장소 전체 타입검사는 통과하지 않음** |

타입검사: 상위 첫 시도 로그(250줄)는 전부 `ExportModal.tsx` 구문 오류였습니다. tsc는 구문 오류가 있으면 타입 진단을 내지 않으므로 이 로그는 타입 근거가 되지 못합니다(후속1에서 정정). ExportModal만 제외한 임시 설정(저장소 tsconfig extends)으로 현재본과 baseline을 같은 tsc로 다시 돌렸습니다. 양쪽 모두 105건이고, 정규화 multiset이 동일했습니다. `pushDevice.ts`·`SettingsPage.tsx`는 0건입니다. `notificationService.ts`의 `ImportMeta.env` 1건은 baseline에도 있는 기존 진단입니다.

baseline 메모: `92535da2`와 main `42e3a1dc`의 frontend는 `git diff` 상 동일합니다. 다만 실제 baseline worktree는 `1200c082`이고, #336의 frontend 5개 파일이 92535da2와 다릅니다. 이 5개 파일은 알림과 무관하고 진단도 양쪽이 같습니다.

node_modules는 lock·package.json이 `cmp` 동일한 다른 tmp worktree 것을 symlink로 재사용했습니다(커밋 안 함). 원본 `haru2026-source`와의 cmp는 세션 허용 경로 밖이라 권한 거부됐습니다.

## 검토 이력
- 독립 Claude 검토 1차 (`6500eac8`): **승인**(코드 병합 기준, 운영 완료 판정 아님), 필수 수정 없음, 권장 1을 후속 1에서 반영
- Codex 1차 [요청](https://github.com/hkd620-lab/haru2026/pull/363#issuecomment-6731636161) → [결과](https://github.com/hkd620-lab/haru2026/pull/363#issuecomment-6731655864) (`6500eac858`, 지적 없음)
- Codex 2차 [요청](https://github.com/hkd620-lab/haru2026/pull/363#issuecomment-6731864352) (2026-11-09T03:57:04Z, 대상 `1588d57a`) → [결과](https://github.com/hkd620-lab/haru2026/pull/363#issuecomment-6731879185) (03:58:18Z, 검토 커밋 `1588d57a31`, "Didn't find any major issues")
- 독립 Claude 재검토 2차 (HEAD `43ca7ae0`, 코드 `c6a753a6`): "**승인** (코드 병합 기준입니다. 운영 완료 판정은 아닙니다.)", 필수 수정 "없음.", 규모 중규모, 홈·라우터·Functions·Rules·인증·저장 경로 멈춤조건 해당 없음. 원문 `docs/reviews/2026-11-09-iphone-push/final-gate/haru-iphone-push-independent-second.raw.json`
- `1588d57a` 이후 커밋은 `docs/reviews/` 새 파일 추가만(8.1절 검토 기록 전용 커밋 예외, `git diff --name-status` 결과는 Slack 판정 기록에 첨부)
- 독립 재검토 권장(필수 아님, 후속): ① 성공 안내 toast가 예외를 던지면 "등록 안 됨"으로 보임 ② 계정 스위치 경로는 `cache` 경고를 버림 ③ 경고가 겹치면 하나만 남음. 이전 권장 2~4도 범위 밖

## 배포 영향
- main 병합 시 Hosting 자동 배포로 설정 화면·알림 서비스만 바뀝니다. Functions·Rules 배포 불필요(하지 않음).

## 위험·검증 한계
- 시험은 모두 의존성을 가짜로 바꾼 합성 시험입니다. iOS Safari 실제 권한 거부 형태, 실제 localStorage 용량 초과는 확인하지 못했습니다.
- 실기기 E2E 미실시: 아이폰 설치 PWA 권한 창·"등록 완료" 표시, 앱 열림 상태에서 알림 1회 표시, 미설치 Safari 탭의 "홈 화면 앱에서만" 안내, 운영 실수신. **운영 완료 판정은 실기기 확인 후**입니다.
- iOS는 화면 표시 없는 push가 반복되면 구독을 취소할 수 있습니다. 이 정책 저촉 여부는 미확인입니다.
- preview도 운영 Firestore를 씁니다. preview에서 등록하면 토큰 목록(최대 5개)이 늘어 가장 오래된 운영 기기 토큰이 밀려날 수 있습니다.
- 계정을 바꿔도 이전 계정 토큰 목록에서 빠지지 않는 기존 문제가 남아 있어 실기기 시험은 한 기기·한 계정으로 합니다.
- 테스트 알림은 같은 계정의 다른 등록 기기로도 갑니다(기존 서버 동작, UI 안내).
- 권한 default + Messaging 미지원 브라우저에서는 권한 창 뒤 "미지원"으로 끝날 수 있습니다.
- `warning: 'cache'`인 기기는 나중에 알림을 꺼도 이 기기 토큰이 자동 제거되지 않을 수 있습니다(안내 문구로 알림).
- `App.tsx`의 캐시 토큰 `console.log`와 `firebase-messaging-sw.js` payload 로그는 범위 밖이라 남아 있습니다.
- 저장소 전체 타입검사는 통과하지 않습니다(기존 진단). 합성 env 빌드·preview 성공은 운영 확인이 아닙니다.

## 롤백
- 이 PR 커밋 `git revert`. 데이터 구조·저장 경로 변경이 없어 데이터 복구 불필요.

브랜치 이름: 원격에 `codex` 브랜치가 있어 `codex/...` ref 충돌 → `codex-iphone-push-repair-20261109`로 push.

병합은 허대표님 지시("아이폰 알림 안오는 원인부터 해결하고 남은3건 모두완료")에 따른 이 알림 수정 범위의 병합·Hosting 배포 승인 안에서 진행합니다. 실행자 자기 승인 없음.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
