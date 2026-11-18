# PR #407 독립 Claude 검토 3차 실행 원문

- 대상 HEAD: `c1ae245ffb27b73c33bec5137c924a3ed0ef231d`
- 시작 UTC: 2026-11-17T23:52:28.400056+00:00
- 종료 UTC: 2026-11-17T23:57:23.296392+00:00
- 종료 코드: 0
- 결과: **수정 후 승인**, 해당 판정 횟수 1회. 기존 실행 1·2차는 결과 없는 실패.
- 실행: 별도 CLI, safe-mode/restricted, Read/Grep/Glob만 허용, 세션 재개·저장 없음. 기존 CC 작업 세션 조작 없음.
- 검토 한계: 외부 diff·로그 및 의존성 링크 읽기 제한. 다음 재검토에는 전용 근거 폴더를 명시적으로 허용한다.

## 질문 원문

독립 설계·완료 검토 요청. 파일은 수정하지 않고 읽기 전용으로 검토하세요.
저장소 /private/tmp/haru-pwa-design-20261118, PR https://github.com/hkd620-lab/haru2026/pull/407, 기준 main 5f0c8a676f6da00e25ad870a7df6f19937b6deeb, 대상 HEAD c1ae245ffb27b73c33bec5137c924a3ed0ef231d 입니다. 변경 전체는 /private/tmp/haru-pwa-review-c1ae245f.patch 입니다. 원본 파일도 직접 확인하세요.
필수 근거: AGENTS.md, docs/HARU2026_Slack_운영정책.md 8.1/9.1, docs/pwa-design-bundle-20261118.md, docs/reviews/2026-11-18-pwa-design-claude-unavailable.md. 이전 실행 2회는 실제 결과 없이 인증/이용 한도로 실패했고 수정 후 승인 횟수는 0입니다. 이전 실행 원문을 반드시 읽으세요.
검증: npm run build 성공(QA 전용 Firebase 값, 운영 연결 없음), PR CI build_and_preview/Deploy Preview 성공. 확장 시험 97개 중 91개 통과, 나머지 성장타임라인 하네스 6개 ReferenceError(isSpecialDayRecord)는 변경 전 main 원본으로도 동일하게 재현. 빌드 SW 실행 시험 3개 통과. 격리 브라우저 320/390px·데스크톱의 테마, 입력 보존과 형식 선택 전달, 더보기, 설치 도움말, Escape 닫기 확인. 연결/터치는 합성 이벤트이고 실제 설치/업데이트/오프라인/키보드/노치/상태바 E2E는 미실시입니다. 로그 파일은 /private/tmp/haru-pwa-build-final.log, /private/tmp/haru-pwa-tests-final.log, /private/tmp/haru-pwa-build-tests-final.log, /private/tmp/haru-pwa-baseline-tests.log 에 있습니다.
설계·구현 결함, 캐시·업데이트·오프라인, 인증/결제 콜백 제외, 입력 손실, 다크 대비·접근성·safe area, 테스트의 충분성, 회귀 위험·롤백을 검토하세요. 특히 코드가 실제로 보장하는 것과 문서/시험 주장이 일치하는지 확인하세요. 작업 규모(소/중/대)와 멈춤 조건 해당 여부도 판정하세요. 최종 판정은 승인/수정 후 승인/재설계 중 하나로 쓰고, 지적사항은 심각도·파일·정확한 위치·재현 상황·필요 수정으로 구체적으로 작성하세요. 검증하지 않은 성공을 만들지 마세요. 기존 CC 두 세션의 파일/대화/프로세스·설정은 읽거나 수정하거나 종료·재개하지 마세요. 인증 파일·환경파일·개인 원시 기록도 읽지 마세요. 검토 결과는 stdout으로만 출력하세요.

## 결과 원문

# PR #407 독립 설계·완료 검토 (대상 HEAD `c1ae245f`, 기준 `5f0c8a67`)

## 판정: **수정 후 승인**

수정 후 승인 횟수를 세면 이번이 1회째입니다. 이전 두 번의 실행은 결과가 없었으므로 세지 않았습니다.

이 판정과 별개로, 이 건은 **멈춤 조건에 해당합니다**. 수정한 뒤에도 CC가 판정①을 단독으로 기록하거나 병합·배포하지 말고 허대표님께 보고해야 합니다.

---

## 0. 검토 범위의 한계 (먼저 밝힘)

- **읽지 못한 파일:** `/private/tmp/haru-pwa-review-c1ae245f.patch`와 로그 4개는 작업 디렉터리 밖에 있어 도구 제한으로 읽기가 거부됐습니다. `frontend/node_modules`는 원래 저장소로 연결된 심볼릭 링크라 vite-plugin-pwa 원본도 읽지 못했습니다.
- **diff를 볼 수 없었던 영향:**
  - git 명령을 쓸 수 없어 main 대비 diff를 직접 보지 못했습니다. 아래 지적은 **HEAD 원본 파일**을 직접 읽은 결과입니다.
  - 무엇이 삭제됐는지(예: 과거 SW 해제·캐시 삭제 코드, 이전 하단 메뉴 항목)는 원문으로 대조하지 못했습니다.
- **재확인하지 못한 시험 결과:** 빌드 성공, 97개 중 91개 통과, SW 시험 3개 통과, CI 성공은 **이 검토에서 다시 확인하지 못했습니다**. 실패로 보지는 않지만 독립 확인 근거도 아닙니다.
- **9.1 GitHub·Slack 대조:** 접근 수단이 없어 `확인 필요`입니다.
- **이전 실행 원문:** `docs/reviews/2026-11-18-pwa-design-claude-unavailable.md`를 읽고 확인했습니다. 시도 1은 401 토큰 만료, 시도 2는 월 사용 한도로 끝나 실제 검토 결과가 없습니다. 그 질문의 대상은 당시 미커밋 diff였으므로 이번 HEAD와 다릅니다.

---

## 1. 지적사항

### [높음·차단] Google 로그인 콜백이 SW navigation fallback에 걸림 — 인증 콜백 제외 주장과 불일치

- **위치:** `frontend/vite.config.ts:85-86`
  - `navigateFallback: '/index.html'`
  - denylist에 `/oauth`가 없음
- **근거:**
  - `firebase.json:81-86`에서 `/oauth/google/callback` 경로는 Functions `googleCallback`(asia-northeast3)으로 rewrite됩니다.
  - `functions/src/index.ts:373`의 `GOOGLE_REDIRECT_URI = 'https://haru2026.com/oauth/google/callback'`.
  - 이전 독립 검토(`docs/reviews/2026-11-02-dev-console-design-review-result-02.md:65`)는 `navigateFallback: null`이라 `/oauth/google/callback`이 SPA fallback으로 빨려 들지 않는다는 점을 안전 근거로 기록했습니다. 이번 변경이 그 전제를 깨뜨립니다.
- **재현 상황:**
  1. 사용자가 haru2026.com을 한 번 방문해 SW가 설치·활성화된 상태에서 Google 로그인을 누릅니다.
  2. Google이 `/oauth/google/callback?code=…&state=…`로 돌려보냅니다.
  3. 이 이동을 SW의 NavigationRoute가 받아 캐시된 `index.html`을 돌려줍니다.
  4. `App.tsx:332`의 `*` 라우트가 `/`로 보내고, Function은 호출되지 않습니다.
  5. 결과적으로 Google 로그인이 조용히 실패합니다. 설치 앱과 일반 브라우저 모두 해당합니다.
  - Kakao·Naver 콜백은 cloudfunctions.net 도메인이라 영향이 없습니다.
- **시험과 문서의 불일치:**
  - `frontend/test/pwaBuild.test.mjs:26`의 제외 목록에 `/oauth/google/callback`이 없어, 결함이 있어도 시험이 통과합니다.
  - 같은 파일 28행 시험 이름의 "OAuth URLs are absent"는 precache 목록만 검사합니다.
  - 문서 `docs/pwa-design-bundle-20261118.md:14`의 "인증·결제 콜백 … 제외"는 **사실과 다릅니다**.
- **필요 수정:**
  - denylist에 `^\/(?:oauth|__)(?:\/|$)`를 추가합니다. `/__/auth`는 현재 authDomain이 firebaseapp.com이라 영향이 없을 가능성이 높지만, 방어 목적으로 함께 넣습니다.
  - `pwaBuild.test.mjs:26` 목록에 `/oauth/google/callback`, `/__/auth/handler`를 추가합니다.
  - 근본적으로는 `firebase.json`의 Hosting rewrite 목록(Functions·정적 경로)과 denylist가 서로 맞는지 시험이 직접 대조하게 만드는 것을 권장합니다.
  - 문서 14행을 고칩니다.

### [중간] 다크 모드 기본값이 '기기 설정'이 되면서, 토큰화하지 않은 화면에서 대비가 깨질 위험

- **위치:**
  - `ThemeContext.tsx:15`: 저장값이 없으면 `'system'`
  - `index.html:44`
  - `app-shell.css:45`: `.haru-app-shell { color: var(--haru-ink) }`, 다크에서는 `#F0F1E9`
  - `app-shell.css:81`: `.bg-white` 클래스만 재매핑
- **근거:**
  - `var(--haru-` 토큰을 쓰는 파일은 15개뿐입니다.
  - 인라인 `background: '#fff'/'white'`는 77개 파일에 375곳 남아 있습니다. 예: `FormatModal.tsx` 63곳, `PlantDetectivePage.tsx` 43곳, `HealthMedicationPage.tsx:515` 카드는 흰 배경에 color 지정이 없습니다.
  - 인라인 흰 배경 안의 요소가 글자색을 상속하면, 다크에서는 흰 바탕에 밝은 글자가 됩니다.
  - `App.tsx:209`의 `/ai-import`는 `#F7F8FC` 밝은 배경을 강제하는데, 글자색은 shell에서 상속됩니다.
- **재현 상황:**
  1. 기기를 다크 모드로 둔 기존 사용자가 저장값 없이 접속하면 자동으로 다크가 적용됩니다.
  2. 비서 화면(약·식물·반려동물 등)이나 FormatModal 본문에서 color를 지정하지 않은 문구가 흰 카드 위에서 안 보이게 됩니다.
  3. 문서 27행도 "비서별 다크 대비 전수검증 미실시"를 인정합니다.
- **필요 수정:** 다음 중 하나를 고릅니다(🟨 대표 결정 사항).
  - (권장) 전수 점검 전까지 저장값이 없을 때의 기본값을 기존처럼 `light`로 유지하고, 다크는 사용자가 직접 선택할 때만 적용합니다.
  - 또는 토큰화하지 않은 경로에서는 다크 class를 적용하지 않습니다.
  - 어느 쪽이든 390px 다크로 비서 화면을 대표 표본 점검한 캡처를 남깁니다.

### [중간] 다크에서 명언 비활성 탭 글자 대비 부족 (토큰화한 파일 안의 결함)

- **위치:** `frontend/src/app/components/TodayQuote.tsx:116`, `127`
  - 비활성 탭 글자색이 `rgba(26,60,110,0.55)`로 고정
  - 배경은 다크 surface `#2B3127`
- **재현 상황:**
  1. 다크 모드에서 로그인한 상태로 아무 화면 하단의 명언 카드를 봅니다.
  2. 선택하지 않은 탭 글자가 거의 보이지 않습니다. 추정 대비는 약 1.5:1로, 기준 4.5:1에 크게 못 미칩니다.
- **필요 수정:**
  - 비활성 색을 `var(--haru-muted)` 계열로 바꿉니다.
  - 활성 배경 `#1A3C6E`도 `var(--haru-button-blue)`로 맞춥니다.

### [중간·확인 필요] 고정 하단 메뉴가 Footer의 약관·환불 링크 줄을 가릴 가능성

- **위치:**
  - `App.tsx:215`: `main`에만 `paddingBottom: var(--content-pb)` 적용
  - `App.tsx:335-337`: `TodayQuote`와 `Footer`가 `main` **뒤**에 오고, `BottomNav`는 `position: fixed`
  - `app-shell.css`의 shell과 footer에는 하단 여백이 없음
- **재현 상황:**
  1. 390px 화면에서 로그인한 상태로 `/sayu` 같은 화면을 끝까지 스크롤합니다.
  2. 68px + safe area 높이의 메뉴 아래에 Footer 마지막 줄(구독·사업자 정보·약관·개인정보·환불 링크)이 가려질 수 있습니다.
  - 문서 10행은 "링크는 항상 제공"이라고 하지만, 보이는지는 검증하지 않았습니다.
  - 기존부터 있던 구조인지는 diff를 볼 수 없어 판단하지 못했습니다.
- **필요 수정:**
  - 하단 여백을 `main`이 아니라 shell의 맨 끝(또는 Footer)에 둡니다.
  - 320/390px에서 맨 아래까지 스크롤한 캡처로 확인합니다.

### [중간·확인 필요] 업데이트 시 다른 탭의 입력 손실

- **위치:**
  - `pwaRegistration.ts:8`: `update(true)`가 SKIP_WAITING 후 화면을 다시 불러옴
  - `PwaStatus.tsx:21`: 확인창 확인
- **재현 상황:**
  1. 탭 A에서 업데이트를 누릅니다.
  2. 새 SW가 활성화되면 같은 SW 등록을 쓰는 탭 B에서도 controllerchange가 일어납니다.
  3. vite-plugin-pwa가 controlling 이벤트에서 다른 탭까지 다시 불러오는지는 라이브러리 원본을 읽지 못해 확인하지 못했습니다.
  4. 다시 불러온다면, 탭 B에서 저장하지 않은 편집 내용이 확인창 없이 사라집니다.
- **필요 수정:**
  - 두 탭 시험으로 확인합니다.
  - 다른 탭을 다시 불러온다면 문구에 "열린 다른 창도 다시 불러옵니다"를 넣거나, 다른 탭은 배너만 띄우도록 바꿉니다.

### [낮음] 제어받지 않는 첫 방문 세션에서 업데이트 버튼이 멈출 수 있음

- **위치:** `vite.config.ts:82-83`(`clientsClaim: false`), `PwaStatus.tsx:22-23`
- **재현 상황:**
  1. SW가 막 설치돼 아직 페이지를 제어하지 않는 세션에서 새 배포가 감지됩니다.
  2. 업데이트를 누르면 SKIP_WAITING은 처리되지만 controllerchange가 일어나지 않을 수 있습니다.
  3. 그러면 화면이 '업데이트 중…'에 멈춘 채 남을 수 있습니다.
- **필요 수정:** 일정 시간이 지나도 진행되지 않으면 `location.reload()`로 넘기거나 버튼을 다시 활성화합니다.

### [낮음] 상단 safe area가 이중으로 적용됨

- **위치:**
  - `app-shell.css:68`: `.haru-pwa-status`의 padding-top에 `env(safe-area-inset-top)` 포함
  - `app-shell.css:45`: `.haru-app-shell`에도 같은 값
  - `PwaStatus`는 shell 바깥(`App.tsx:346`)에 있음
- **재현 상황:** 노치가 있는 iPhone 설치 앱(`black-translucent`)에서 오프라인·업데이트 배너가 뜨면, 배너 아래에 약 47px의 빈 띠가 추가로 생깁니다.
- **필요 수정:** 배너가 보일 때 shell의 상단 inset을 0으로 하거나, 배너를 shell 안 최상단으로 옮깁니다.

### [낮음] 기타

- **`PwaStatus.tsx:16` 문구:** "아래 기능의 재시도 버튼"은 배너가 화면 상단에 있어 위치 안내가 맞지 않습니다. 또 online 이벤트가 오면 배너가 곧 사라지므로 이 문구가 보이는 일은 드뭅니다.
- **사용하지 않는 파일:** `frontend/public/sw-landing-refresh.js`는 어디서도 참조하지 않는데 여전히 배포 산출물에 포함됩니다. 과거 SW가 `importScripts`로 불러왔던 파일이라면 롤백 시 필요하므로 **삭제하지 말고** 용도를 기록해 두는 정도로 충분합니다.
- **사업자 정보 접기(`Footer.tsx:19`):** 로그인한 홈 `/`에서만 접힙니다. 전자상거래 표시 의무는 링크로 충족된다고 보는 시각이 일반적이지만, 법적 판단이 필요하면 🟨 대표 결정 사항입니다.

---

## 2. 코드에서 확인한 양호 항목

- **캐시 범위:**
  - precache는 `index.html`, `assets`, `icons`, `brand`로 한정됩니다(`vite.config.ts:88`).
  - Firestore·Functions 응답을 캐시하는 runtimeCaching은 없습니다.
  - Firebase Storage는 NetworkOnly입니다(98-99행).
- **결제·인증 SPA 경로:** `/auth/callback`, `/payment/single`, `/single-payment`, `/subscription/inicis`는 denylist에 있어 네트워크에서 받습니다.
- **FCM SW 분리:** `firebase-messaging-sw.js`는 별도 scope(`notificationService.ts:32`)이고 Workbox SW와 충돌하지 않습니다.
- **강제 활성화 없음:** `skipWaiting: false`, `clientsClaim: false`, 사용자 선택 후에만 활성화하며, 전체 캐시를 지우는 코드는 없습니다. HEAD에서 `unregister`나 `caches.` 호출을 찾지 못했습니다.
- **오프라인 안내:** 화면을 다시 불러오지 않고, 오프라인 저장을 약속하지 않습니다(`PwaStatus.tsx:13-17`).
- **설치 표시:** 설치 이벤트는 한 번만 쓰고, 설치 완료는 appinstalled나 standalone 신호로만 표시합니다(`pwaState.ts:30-38`).
- **당겨서 새로고침(`usePullToRefresh.ts`):** 다음 조건을 실제로 막습니다.
  - 화면 최상단이 아닐 때, 두 손가락, 가로 이동
  - 입력 요소·dialog 위에서 시작한 경우
  - 중복 실행(`busy`)
  - 편집창이 열려 있을 때(`SayuPage.tsx:4962`)
  - 오프라인일 때
- **더보기:** Radix Dialog로 포커스 제한과 Escape 닫기를 하고, 메뉴 터치 영역은 68px, 링크는 56px, 버튼은 44px 이상입니다.
- **브랜드:** 매니페스트 아이콘은 포도송이 자산이며, 호박 로고 원본은 건드리지 않았습니다.

---

## 3. 시험의 충분성

- **pwaBuild.test.mjs:** 생성된 SW의 실제 설정을 실행해 확인하는 방식은 좋습니다. 다만 제외 경로 목록을 사람이 직접 적은 탓에 Hosting의 Functions rewrite 경로를 빠뜨렸습니다(위 높음 지적).
- **다크 대비:** 문서 표현대로 일부 표본만 확인했습니다. 이 PR은 기본값을 system으로 바꿔 전 화면에 영향을 주므로, 표본 확인으로는 부족합니다.
- **성장타임라인 6개 실패:** 변경 전 main에서도 같은 `ReferenceError`가 난다고 보고됐습니다. 로그를 읽지 못해 독립 확인은 못 했지만, 이 PR의 변경 영역과도 무관해 보입니다.
- **아직 하지 않은 E2E(판정 전 필요):**
  - 실기기 설치
  - SW 업데이트 수신(기존 운영 SW → 새 SW)
  - 오프라인
  - **SW가 활성화된 상태의 Google 로그인**
  - 두 탭 업데이트

---

## 4. 회귀 위험과 롤백

- **revert만으로 끝나지 않는 이유:** 기존 사용자 브라우저에는 새 SW(fallback 있음, 오래 유지됨)가 남습니다. revert 배포 후에도 이전 SW가 waiting 상태에 머물 수 있고, 사용자 선택 없이는 활성화되지 않습니다. 그동안 위 Google 콜백 결함이 계속될 수 있습니다.
- **롤백 절차 문서 보완:**
  - "revert 시 denylist가 정상인 SW로 바뀌는 경로"를 명시합니다.
  - 필요하면 해제용 SW를 미리 준비합니다. 이 경우에도 승인 범위 안에서만 진행합니다.
- **배포 전 처리:** 높음 지적은 배포 **전에** 반드시 고쳐야 합니다. 배포 후 고치면 사용자가 업데이트를 누를 때까지 결함이 남습니다.

---

## 5. 작업 규모와 멈춤 조건

- **규모: 대.** 다음 영역에 걸친 변경입니다.
  - 하단 메뉴 구조
  - 라우터 파일 `App.tsx` 수정(PwaStatus·ThemeProvider 배치, chrome)
  - 홈 화면
  - 전역 테마
  - SW 캐시·navigation 전략 신설
  - 설치·오프라인·당겨서 새로고침
- **멈춤 조건 해당 (8.1):**
  - ① 홈 화면·라우터 파일 변경과 대규모 작업은 대표님의 개별 또는 범위 허용이 필요합니다. 문서 5행에 "대표님 승인"이 있지만, 그 원문 근거(Slack 링크 등)는 이 검토에서 `확인 필요`입니다.
  - ② 실기기 설치·업데이트·오프라인 E2E가 완료 조건이므로, AI가 운영 완료로 판정할 수 없습니다.
- **해당하지 않음:** 비용 증가, Rules, 저장 경로, 결제 정책 변경. 다만 인증 콜백 결함은 기능 결함일 뿐 정책 변경은 아닙니다.

---

## 6. 승인 조건 요약

1. 필수: denylist에 `/oauth`와 `/__`를 추가하고, `pwaBuild.test.mjs`에 해당 경로를 넣습니다.
2. 필수: 문서 14행을 고치고, 빌드와 SW 시험을 다시 실행해 로그를 첨부합니다.
3. 다크 기본값을 정합니다(권장: 저장값이 없으면 light 유지, 🟨 대표 결정). `TodayQuote` 대비도 고칩니다.
4. Footer 가림 여부와 두 탭 업데이트 동작을 확인하고, 문제가 있으면 고칩니다.
5. 낮음 항목은 선택입니다.
6. 수정한 뒤 Codex 재검토와 독립 검토자 재검토를 받습니다. 재검토 질문에는 이 판정 원문과 반영 내역을 함께 넘깁니다.
7. 멈춤 조건 해당이므로 병합·배포 전에 허대표님 결정을 받습니다.
