# 2026-11-09 아이폰 알림 복구 — 후속 1 (CC 실행자 2차) 색인

이 폴더는 기존 `../README.md`를 고치지 않고 덧붙이는 보완 기록이다. 기존 README와 그 안의 기록은 그대로 둔다.

- 실행: Claude Code(CC) 실행자 2차 실행(`haru-iphone-push-cc-2.*`). PR #363, 같은 worktree `/private/tmp/haru-iphone-push-repair-20261109`
- 로컬 브랜치 `codex/iphone-push-repair-20261109` → 원격 `codex-iphone-push-repair-20261109`(이름을 바꾼 이유는 `../README.md` 참고)
- 이 실행 시작: 2026-11-09T03:41:31Z(`haru-iphone-push-cc-2.meta.json`). 시작 HEAD `6500eac8584fec63a600f3579d01c6bb0511643d`
- 코드 수정 커밋: `c6a753a6a85fc16aa28d92428989a315b2491ed9`(2026-11-09T12:53:43+09:00)
- 이 실행에서 하지 않은 것: 병합, 배포, PR ready 전환, Slack 게시, 자기 승인. 독립 재검토는 상위 작업자가 별도 세션에서 진행한다.

## 1. 앞 단계 원문 (복사본, SHA-256 대조 일치)

| 파일 | 내용 | 시각 / 대상 HEAD |
|---|---|---|
| `haru-iphone-push-cc-1.prompt.txt` · `.meta.json` · `.raw.json` · `.err.log` | CC 실행자 1차 요청·실행 메타·결과 원문(권한 거부 목록 포함) | 03:25:37Z~03:36:36Z, 결과 커밋 `6500eac8` |
| `haru-iphone-push-cc.py` | 1차 실행에 쓴 상위 실행 스크립트 | — |
| `haru-iphone-push-independent-first.prompt.txt` · `.meta.json` · `.raw.json` · `.err.log` | 독립 Claude 검토 1차 요청·메타·결과 원문. 판정 **승인**(코드 병합 기준, 운영 완료 판정 아님). 필수 수정 없음, 권장 4건 | 03:37:25Z~03:40:22Z, 검토 HEAD `6500eac8` |
| `haru-iphone-push-review.py` | 독립 검토 실행 스크립트(이 실행이 복사한 시점 2,699바이트) | — |
| `haru-iphone-push-review.later-version.py` | 같은 스크립트를 SHA 대조 시점에 다시 복사한 것(3,438바이트, 12:51 수정). 복사 뒤 상위가 원본을 고친 것으로 보여 두 판을 모두 보존 | — |
| `haru-iphone-push-codex-request-1.json` | Codex 1차 요청 본문 원문 | — |
| `codex-request-6731636161.comment.json` | Codex 1차 요청 댓글 GitHub API 원문. <https://github.com/hkd620-lab/haru2026/pull/363#issuecomment-6731636161> | 2026-11-09T03:37:44Z, 대상 `6500eac8` |
| `codex-result-6731655864.comment.json` | Codex 1차 결과 댓글 원문: "Didn't find any major issues", Reviewed commit `6500eac858`. <https://github.com/hkd620-lab/haru2026/pull/363#issuecomment-6731655864> | 2026-11-09T03:39:19Z |
| `haru-iphone-push-cc-2.prompt.txt` · `.meta.json` · `haru-iphone-push-fix2.py` | 이 실행(2차)의 요청 원문·시작 메타·실행 스크립트. 결과 원문(`.raw.json`)은 이 실행이 끝난 뒤 상위가 채우므로 여기에는 없다 | 시작 03:41:31Z |
| `haru-iphone-push-build-20261109.log` | 1차 실행의 웹 빌드 로그 | 6500eac8 |
| `haru-push-rejection-probe.mjs` | 상위가 만든 합성 재현 시험 원문(수정하지 않음) | — |
| `haru-iphone-push-tsc-first.log` · `-second.log` · `-baseline.log` | 상위 타입검사 시도 원문 3건(아래 3절) | — |

`SHA256SUMS.txt`에 이 폴더 모든 파일의 SHA-256을 적었다. 원래 위치 파일과 복사본의 SHA-256은 `haru-iphone-push-review.py`(위 설명)를 빼고 모두 일치했다.

## 2. 상위 probe가 재현한 문제와 수정

### 재현 (수정 전 `6500eac8`)

`probe-original-before-fix.log`: `requestPermission()`이 즉시 거부되고 `isSupported()`가 25ms 뒤 true를 돌려주면 결과는 `dismissed`인데, 그 전에 `unhandledRejection`이 먼저 발생한다. Node v26.8.2에서 `PromiseRejectionHandledWarning`, `earlyUnhandledRejection: true`.

원인: `registerDeviceForPush`가 권한 요청 Promise를 만든 뒤 `await deps.isSupported()`를 먼저 기다리고, 그다음에야 권한 Promise를 `await`(거부 처리)했다. 그 사이에 거부가 일어나면 처리기가 없는 상태로 보고된다.

`old-check-6500eac8.log`(`run-old-check.mjs`, 수정 전 파일을 `git show`로 꺼내 실행한 합성 시험): 같은 조건에서 `unhandledRejection 1`, `rejectionHandled 1`. 또 `requestPermission` 동기 예외는 함수 전체가 예외로 끝났고(`threw: sync`), 서버 저장 뒤 `cacheToken` 예외도 그대로 밖으로 나갔다(`threw: QuotaExceededError`).

### 수정 (`c6a753a6`, 웹 프론트 2개 파일 + 시험 1개)

- `frontend/src/app/services/pushDevice.ts` `registerDeviceForPush`
  - 권한 요청은 지금처럼 함수 첫머리에서 **동기적으로** 시작한다(사용자 제스처 유지, `isSupported`보다 먼저).
  - 시작한 그 자리에서 `.catch(() => 'default')`를 붙여, 지원 확인을 기다리는 동안 거부가 나도 처리되지 않은 거부가 생기지 않는다. `requestPermission`이 동기 예외를 던지면 같은 `default`(→ `dismissed`)로 처리한다. 결과 판정(미지원 → unsupported, denied → denied, 그 밖 → dismissed)은 그대로다.
- 서버 저장 뒤 기기 후처리 오류(독립 검토 권장 1)
  - 설계: `saveToken`(계정 `users/{uid}/settings/settings`의 `fcmTokens` 저장)이 성공하면 서버 등록은 끝난 것이다. 그 뒤 `cacheToken`(localStorage)이나 `onRegistered`(포그라운드 수신 준비)가 실패해도 **실패로 되돌리지 않는다**. 대신 결과를 `{ ok: true, warning: 'cache' | 'listener' }`로 구분한다. 둘 다 실패하면 `cache`를 우선한다(알림을 꺼도 이 기기 토큰이 자동 제거되지 않는 영향이 더 크다). 정상이면 기존과 같은 `{ ok: true }`.
  - `saveToken` 실패는 이전과 같이 `{ ok: false, reason: 'save' }`이며 캐시·완료 처리를 하지 않는다. 경고로 바뀌지 않는다.
  - `requestNotificationPermission(userId): Promise<boolean>`은 `result.ok`를 그대로 돌려주므로 계정 스위치·`App.tsx` 경로는 서버 등록 성공을 성공으로 본다(호출부 변경 없음).
- `frontend/src/app/pages/SettingsPage.tsx` `handleRegisterThisDevice`
  - 새 helper `runDeviceRegistration(register, ui)`로 처리한다. `register()`는 첫 `await` 전에 동기적으로 호출된다(제스처 유지).
  - 예기치 못한 동기 예외·거부: 로딩 해제, `deviceRegisteredNow=false`(등록 완료로 표시 안 함), "이 기기 등록 중 예기치 못한 오류가 발생했습니다…" 안내, 기기 상태 재확인. 예외는 밖으로 나가지 않는다.
  - `warning`이 있는 성공: "등록 완료"로 표시하고 `toast.warning`으로 등록은 됐지만 기기 후처리가 실패했다는 안내를 보인다(성공 toast 대신).
  - 안내 표시·상태 재확인 자체가 실패해도 로딩은 해제된다.
- 변경 없음: `App.tsx`, 라우터·홈, Functions, Rules, 인증, 결제, 로고, 저장 경로, `notificationService.ts`, lock·package.

### 회귀시험 `frontend/test/pushDeviceRejection.regression.test.mjs` (12건)

1. 원본 probe 조건 그대로(즉시 거부 + 25ms 지원 확인) → `dismissed`, `unhandledRejection` 0, `rejectionHandled` 0
2. 동기 예외 → `dismissed`, 누수 없음, 호출 순서 `requestPermission` → `isSupported`
3. 지원 확인이 오래 걸리는 동안 거부 → 순서 유지, 누수 없음
4. 미지원 + 거부 → `unsupported`, 누수 없음
5. 캐시 실패 → `{ ok: true, warning: 'cache' }`, 서버 저장 실행됨, 예외 없음, 안내 문구
6. `onRegistered` 실패 → `listener` 경고, 둘 다 실패 → `cache`, 정상 → 경고 없음
7. 서버 저장 실패는 여전히 `save` 실패
8. 설정 화면 처리: `register` 동기 호출, 성공 흐름 순서
9. `register` 동기 예외·거부 → 로딩 해제·등록 완료 아님·오류 안내·누수 없음
10. 경고 있는 성공 / 실패 사유 표시
11. 안내 표시·재확인 실패에도 로딩 해제
12. 화면 연결: `handleRegisterThisDevice`가 다른 await 없이 `runDeviceRegistration(() => registerThisDevice(uid), …)`

## 3. 타입검사 근거 재확인

### 상위 시도 원문

- `haru-iphone-push-tsc-first.log`: worktree `frontend/node_modules`에 typescript가 없어 `MODULE_NOT_FOUND`로 실패(실행 안 됨).
- `haru-iphone-push-tsc-second.log`: 다른 작업본의 `functions/node_modules/typescript`로 실행, exit 2, 250줄.
- `haru-iphone-push-tsc-baseline.log`: baseline `/private/tmp/haru-complete-pending-20261109/frontend`에서 같은 방식 실행, exit 2, 250줄.
- 두 로그는 바이트까지 같다(SHA-256 `20ed17a4…`, `SHA256SUMS.txt`).
- 이 1차 CC 실행에서 같은 tsc 실행은 권한 거부로 하지 못했다(`haru-iphone-push-cc-1.raw.json`의 `permission_denials`).

### 이 실행에서 확인한 사실

- **250줄은 모두 `src/app/components/ExportModal.tsx`의 구문(파싱) 오류다.** 다른 파일의 진단은 0줄이다(`rg -v "^src/app/components/ExportModal\.tsx\("` 결과 0). tsc는 구문 오류가 하나라도 있으면 의미(타입) 진단을 내지 않는다. 그래서 상위 로그의 "알림 3개 파일 진단 0"은 **타입검사 통과의 근거가 되지 못한다.**
- 그래서 ExportModal(사용하지 않는 파일, 구문 오류)만 뺀 임시 설정으로 다시 실행했다.
  - 설정: `tsconfig.current.json`, `tsconfig.baseline.json`. 저장소 `frontend/tsconfig.json`을 extends하고 `exclude`만 추가했다. 저장소 설정 파일은 바꾸지 않았다.
  - 명령: `node /private/tmp/haru-complete-pending-20261109/functions/node_modules/typescript/bin/tsc --noEmit -p <임시 설정>`
- 결과(`tsc-current-excl-exportmodal.log`, `tsc-baseline-excl-exportmodal.log`, 비교 `tsc-compare-excl-exportmodal.json`, 비교 스크립트 `compare-diagnostics.mjs`)
  - 두 쪽 모두 exit 2, 진단 105건.
  - 줄·열 번호와 앞쪽 경로, 메시지 안의 worktree 절대경로를 정규화했다. 그 뒤 multiset이 **동일**하다.
  - `pushDevice.ts` 0건, `SettingsPage.tsx` 0건이다.
  - `notificationService.ts`는 양쪽 모두 `Property 'env' does not exist on type 'ImportMeta'` 1건이다. tsconfig에 Vite 타입이 없어 생기는 기존 진단이고, baseline에도 같은 진단이 있다.
- **결론**: 이번 변경이 늘린 타입 진단은 없다. **저장소 전체 타입검사는 통과하지 않는다**(기존 105건 + ExportModal 구문 오류). "전체 타입 통과"로 표현하지 않는다.

### baseline 동일성 확인 (git diff)

- `git diff --stat 92535da2 42e3a1dc -- frontend/src frontend/tsconfig.json frontend/package.json frontend/package-lock.json` → 차이 없음. 92535da2와 main 42e3a1dc의 frontend는 같다.
- 실제 baseline worktree `/private/tmp/haru-complete-pending-20261109`의 HEAD는 `1200c082e4d8838e98d393de6767b2da933f55b0`("docs: PR #358 판정① 기록 추가")이다. frontend 미커밋 변경은 없다.
  - `git -C <baseline> diff --stat 92535da2 -- frontend/src frontend/tsconfig.json`을 보면 **5개 파일이 다르다**: `ResultChatModal.tsx`, `ResultChatSources.tsx`, `SayuPage.tsx`, `resultChatService.ts`, `resultChatEvidence.ts`. #336 변경이 baseline에는 없다.
  - 따라서 "baseline frontend src = 92535da2"는 **정확하지 않다**.
- 이 5개 파일의 진단은 양쪽 모두 `SayuPage.tsx` 1건(같은 위치·같은 메시지)뿐이고, 알림 3개 파일과 관련이 없다. 그래서 위 비교 결론에는 영향이 없다. 다만 baseline 설명은 이 사실로 바로잡아 기록한다.

## 4. 검증 결과 (2026-11-09, 로컬, 코드 `c6a753a6`)

| 항목 | 명령 | 결과 / 원문 |
|---|---|---|
| 새 회귀시험 + 기존 알림 시험 | `node --import <frontend>/node_modules/tsx/dist/loader.mjs --test frontend/test/pushDeviceRejection.regression.test.mjs frontend/test/pushDevice.test.mjs` | 26/26 통과(새 12 + 기존 14). `test-pushDevice-after-fix.log` |
| 원본 probe 재실행 | 위 loader로 `/private/tmp/haru-push-rejection-probe.mjs` | `earlyUnhandledRejection: false`, 경고 없음, 결과 `dismissed`. `probe-original-after-fix.log` |
| 알림 시간대 시험 | `node frontend/test/notificationTimeZone.policy.test.cjs` | 통과. `test-notificationTimeZone-after-fix.log` |
| 웹 빌드 | `npm run build --prefix frontend` | prebuild env 검증 통과, `✓ built in 2m 11s`. `build-after-fix.log`. **합성 env 빌드이며 운영 배포 확인이 아니다** |
| 공백 검사 | `git diff --check` | 문제 없음 |
| 타입검사 | 3절 | 신규 진단 0(정규화 multiset 동일), 저장소 전체는 미통과 |

### 빌드 합성 env 방법

- 명령 앞에 환경변수를 붙이는 방식은 1차 실행에서 권한 거부됐다. 그래서 gitignore 대상(`.gitignore:9:.env.*.local`, `git check-ignore`로 확인)인 `frontend/.env.production.local`에 합성 자리값을 써서 빌드했다.
- 자리값 7개: `VITE_FIREBASE_API_KEY=synthetic-api-key`, `AUTH_DOMAIN=synthetic.example.invalid`, `PROJECT_ID=synthetic-project`, `STORAGE_BUCKET=synthetic-bucket`, `MESSAGING_SENDER_ID=000000000000`, `APP_ID=synthetic-app-id`, `VAPID_KEY=synthetic-public-key`.
- 운영 값이 아니며 커밋되지 않는다.
- `npm run build`는 `--prefix frontend`로 실행했다. `validate-build-env.mjs`가 `process.cwd()` 기준으로 env를 읽기 때문이다.
- tsx는 `frontend/node_modules`(1차에서 cmp 동일 확인 후 연결한 baseline node_modules, 커밋 대상 아님)의 `tsx/dist/loader.mjs`를 절대경로로 지정했다.

## 5. 이 실행의 권한 거부·실패 시도 (우회하지 않음)

- `python3 -c …`로 독립 검토 raw JSON의 result를 뽑으려던 명령 → 권한 거부. 대신 Read 도구로 원문을 읽었다.
- `node … ; echo "exit=$?" >> …`(여러 명령 연결) → 권한 거부. 대신 단일 `node` 명령으로 실행하고 출력을 그대로 옮겨 적었다(`probe-original-before-fix.log`).
- `git show 6500eac8:… --output=<파일>` → 0바이트 파일이 생기고 내용은 화면으로만 나왔다(의도대로 동작하지 않음). 대신 `run-old-check.mjs`가 `git show`를 직접 실행해 수정 전 파일을 꺼냈다.
- `cp -n …`(플래그 사용) → 권한 거부. 대상이 새 빈 폴더라 덮어쓸 파일이 없음을 확인하고 플래그 없는 `cp`로 복사한 뒤, SHA-256으로 대조했다(`sha-manifest.mjs`, 결과 `sha-manifest-result.json`).
- `git diff --cached --check`가 원문 빌드 로그 2개(`build-after-fix.log`, `haru-iphone-push-build-20261109.log`)의 Vite 출력 후행 공백·끝 빈 줄을 지적했다. 원문 바이트를 고치지 않기 위해 이 폴더에만 `.gitattributes`(`*.log -whitespace`)를 두었다. 그 뒤 검사 통과. 제품 코드의 공백 검사는 영향 없다.

## 6. Codex 재검토 요청 (이 실행)

요청 댓글 링크·시각·대상 HEAD는 `codex-request-2.md`에 기록한다(요청 뒤 추가 커밋).

## 7. 남은 위험·후속 (상위 작업자)

- 독립 검토 권장 2~4는 이번 범위에서 다루지 않았다.
  - 2: 화면을 다시 열면 "등록 확인 전"으로 보인다.
  - 3: 기기 토큰 캐시가 계정별로 나뉘지 않는다(기존 문제).
  - 4: `App.tsx`·서비스워커 로그.
- `warning: 'cache'`인 기기는 나중에 계정 알림을 꺼도 `removeCurrentToken`이 이 기기 토큰을 지우지 못한다. 기존 동작이고, 안내 문구로 알린다.
- 실기기 E2E·운영 실수신은 그대로 남아 있다(`../README.md` 6절, 독립 검토 "검증 한계").
