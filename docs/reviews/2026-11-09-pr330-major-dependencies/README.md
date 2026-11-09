# PR #330 메이저 의존성(puppeteer 25 · zod 4) 호환성 검증 — CC 실행자 기록 (2026-11-09)

- 이 문서는 **실행자 기록**이다. 승인 기록이 아니며 자기 승인하지 않는다. 독립 Claude 검토와 Codex 리뷰는 별도로 진행한다.
- 원 PR: <https://github.com/hkd620-lab/haru2026/pull/330> (dependabot, HEAD `e19e908c5fac7be721319c43ef25871ff6f54221`, 열린 상태 유지)
- 작업 위치: `/private/tmp/haru-pending-major-deps-20261109` (격리 worktree), 로컬 브랜치 `codex/pending-major-deps-20261109`
- 원격 push 브랜치: `codex-pending-major-deps-20261109` (원격에 `codex` 브랜치가 있어 `codex/...` 이름은 만들 수 없음 — GitHub API `git/matching-refs/heads/codex`로 확인)
- 기록 시각: 2026-11-09 11:06 KST 기준

## 1. 입력 질문 원문

```text
CC 실행자입니다. 사용자 '모두 완료하자'의남은7개의존성중PR330 https://github.com/hkd620-lab/haru2026/pull/330 의메이저호환성검증을수행하세요. cwd새격리worktree는원PRHEAD e19e908c 기반 codex/pending-major-deps-20261109 입니다. 먼저현재상태및AGENTS.md/Slack정책8.1확인. 최신origin/main을merge하고 같은원PR의 puppeteer25/zod4 실제변경·공식릴리스/이전버전호환성·런타임Node22지원·추가브라우저다운로드/배포패키지영향을검토. 코드사용처없다고임의제거/다운그레이드/모델교체금지. 단지메이저라는이유로대표결정으로미루지말고현재'모두완료'범위안에서필요검증으로판단. 기존PR358(6개패치)의변경을중복포함하지마세요. 브라우저다운로드끄고Node22/npm10으로npmci와Functions build·관련시험·exportsdiff·원래src에서zod/puppeteer사용여부·간접사용SDK호환성검증. 외부AI/운영데이터호출금지. 셸환경변수설정이권한거부되면명령문을바꾸어우회하지말고필요한정확한명령을상위에게보고. 바뀐의존성의API실사용테스트를명확히. 기존원PR의검토원문이있다면이력보존. docs/reviews/2026-11-09-pr330-major-dependencies/에이입력질문원문·실제명령/결과·위험·실행환경·배포영향/대상·rollback새문서만추가. 코드/Rules/인증/결제변경금지. 작업브랜치커밋·push·초안대체PR까지(원격codex/pending충돌시codex-pending-major-deps-20261109). 원PR330종료·main병합·배포·Slack게시하지마세요. 다른worktree/기존변경보존. 결과일반자료는상위가외장보관. 최종결과로검증상태및실제부족한증거를구체화하세요. 독립리뷰와Codex는별도진행합니다.
```

## 2. 이전 검토 이력

- PR #330에는 GitHub 리뷰·리뷰 댓글·일반 댓글이 **없다**(`gh pr view 330 --json comments,reviews` → 빈 배열, `gh api .../pulls/330/comments` → 0건).
- 저장소 `docs/reviews/`(main 기준)에 #330 관련 기록 없음.
- 관련 선행 기록: PR #358 브랜치(`codex-complete-pending-20261109`, 아직 main 미병합)의 `docs/reviews/2026-11-09-pending-dependencies/run2-executor-record.md` 4절 "#330 제외 사유" — "직접 production 의존성 메이저 업그레이드, 최소 변경 범위 아님, `functions/src`에 import 없음, 제거 여부는 허대표님 결정 대상". 이 문서는 그 기록을 고치지 않고, 이번 지시("메이저라는 이유만으로 대표 결정으로 미루지 말 것", "사용처 없다고 임의 제거 금지")에 따라 업그레이드 자체의 호환성을 검증한다.
- Slack 이전 기록은 이 세션에서 접근 수단이 없어 확인하지 못했다.

## 3. 실행 환경

| 항목 | 값 |
|---|---|
| 로컬 OS | macOS (Darwin 27.0.0, arm64) |
| 로컬 Node / npm | **v26.8.2 / 11.19.1** (지시된 Node 22 / npm 10 아님) |
| Node 22 확보 시도 | `/opt/homebrew/opt/node@22/bin/node -v` → **권한 거부**, `npx -y node@22 -v` → **권한 거부** |
| 디스크 여유 | 13Gi (`df -h /private/tmp`) |
| CI 실측 환경 (원 PR HEAD) | GitHub Actions `ubuntu-26.04`, **Node v22.23.4 / npm 10.9.9**, `PUPPETEER_SKIP_DOWNLOAD=true` |
| Functions 배포 런타임 | `firebase.json` `functions[0].runtime = "nodejs22"`, predeploy `npm --prefix "$RESOURCE_DIR" run build` |

## 4. 실행 명령과 결과

| # | 명령 | 결과 |
|---|---|---|
| 1 | `pwd; git branch --show-current; git status --short; git worktree list` | 경로·브랜치 일치, clean, HEAD `e19e908c` |
| 2 | `AGENTS.md`, `docs/HARU2026_Slack_운영정책.md` 8.1절 읽기 | 확인 |
| 3 | `cat /Users/heogyeongdae/Developer/HARU_작업위치.md` (복합 명령) | 권한 거부 → Read 도구로 읽음 |
| 4 | `git fetch origin main` | `origin/main` = `5f41cd7e` (2026-11-08T08:53:41+09:00) |
| 5 | `git merge --no-ff --no-edit origin/main` | 충돌 없음, merge 커밋 `525d808d` |
| 6 | `git diff --name-status origin/main HEAD` | `M functions/package-lock.json`, `M functions/package.json` **두 파일뿐** (functions/src 차이 없음) |
| 7 | `git diff --stat 69480eca origin/main -- functions/package.json functions/package-lock.json` | main 쪽 변경 4+/8− (merge에 자동 반영, 충돌 없음) |
| 8 | lock 패키지 단위 비교 (`git show <ref>:functions/package-lock.json`을 node로 파싱, 5절) | 제거 66 · 추가 12 · 버전 변경 9 · dev 표시 변경 11 |
| 9 | `PUPPETEER_SKIP_DOWNLOAD=true npm ci --prefix functions --no-audit --no-fund` | **권한 거부** (환경변수 접두). 지시대로 다른 형태로 우회하지 않음 |
| 10 | `npm ci --dry-run --ignore-scripts --prefix functions --no-audit --no-fund` (설치·스크립트 없음, lock 정합성만) | 성공, `added 686 packages`(dry-run), EBADENGINE 경고 1건(로컬 node 26 ≠ engines `22`). zod 4.6.7, puppeteer/puppeteer-core 25.16.0, @puppeteer/browsers 3.2.6, chromium-bidi 157.0.8090-0 해석 |
| 11 | `npm view puppeteer@25.16.0 …`, `npm view puppeteer@24.40.0 …` | **권한 거부** → GitHub 공식 저장소 태그 원본으로 대체(6절) |
| 12 | `gh api repos/puppeteer/puppeteer/releases/tags/puppeteer-v25.0.0`, `…/puppeteer-core-v25.0.0` | 공식 BREAKING CHANGES 확인(6절) |
| 13 | `gh api repos/puppeteer/puppeteer/contents/packages/puppeteer/{package.json,src/puppeteer.ts,src/getConfiguration.ts,src/node/install.ts,install.mjs}?ref=puppeteer-v25.16.0` 및 `getConfiguration.ts?ref=puppeteer-v24.40.0` | 6절 |
| 14 | `gh api repos/colinhacks/zod/releases?per_page=100` (v4.0.x) | v4.0.1 공식 설명 확인(7절). `releases/tags/v4.0.0`은 404 |
| 15 | `gh pr view 330 --json statusCheckRollup` | `build_and_preview` SUCCESS, `linux_x64_node22` SUCCESS |
| 16 | `gh run view 41586920981 --log` (원 PR HEAD `e19e908c`의 `Functions sharp Linux check`) | Node `v22.23.4`, npm `10.9.9`, `npm ci` → `added 688 packages in 11s`, `npm ls sharp` → `sharp@0.35.5`, `tsc && mkdir -p lib/fonts && cp …` 성공, `# tests 14 / # pass 14 / # fail 0` |
| 17 | 저장소 사용처 검색 (Grep, node_modules·lock·docs 제외) | 8절 |
| 18 | `git ls-remote --heads origin …` | **권한 거부** → `gh api repos/hkd620-lab/haru2026/git/matching-refs/heads/codex`로 대체: `refs/heads/codex` 존재, `codex-pending-major-deps-20261109` 없음 |
| — | 로컬 `npm run build`(functions), 관련 시험, export 목록 diff | **미실행**: 9번 설치가 거부되어 `node_modules`가 없음. 10번 dry-run은 설치가 아니다 |

## 5. 실제 변경 (merge 후 HEAD vs origin/main)

`functions/package.json`: `"puppeteer": "^24.40.0"` → `"^25.16.0"` 한 줄. `functions/package-lock.json`만 그 외 변경. 소스·Rules·설정 변경 없음.

버전 변경 9건:

| 패키지 | 이전 → 이후 |
|---|---|
| puppeteer / puppeteer-core | 24.40.0 → 25.16.0 |
| @puppeteer/browsers | 2.13.0 → 3.2.6 |
| chromium-bidi | 14.0.0 → 157.0.8090-0 |
| devtools-protocol | 0.0.1581282 → 0.0.1704951 |
| webdriver-bidi-protocol | 0.4.1 → 1.0.1 |
| typed-query-selector | 2.12.1 → 2.12.3 |
| ws | 8.21.0 → 8.22.1 |
| zod | 3.25.76 → 4.6.7 |

- 제거 66건: puppeteer 24 전용 하위 의존성(`proxy-agent`·`pac-proxy-agent`·`socks*`·`degenerator`·`escodegen`·`extract-zip`·`yauzl`·`tar-fs`·`tar-stream`·`bare-*`·`cosmiconfig`·`import-fresh` 등). 최상위 `proxy-from-env@1.1.0`도 빠지지만 axios는 자체 중첩 `axios/node_modules/proxy-from-env@2.1.0`(axios 요구 `^2.1.0`)을 그대로 쓴다(main과 HEAD 모두 확인).
- 추가 12건: `modern-tar`, `lilconfig`, `get-east-asian-width`, `@puppeteer/browsers` 아래 yargs 18 계열.
- dev 표시 변경 11건: `typescript`, `parse-json`, `esprima`, `source-map`, `@babel/code-frame` 등이 production → dev 전용으로 바뀜. 원인은 `cosmiconfig`(puppeteer 24 의존, `typescript` optional peer)가 빠진 것. `typescript`는 원래 `devDependencies`에 있고 빌드는 배포 전 로컬 predeploy에서 한다.
- zod 사용자(lock 기준): `chromium-bidi@157` → `zod ^4.6.5`(직접), `@anthropic-ai/sdk@0.91.1` → peer `^3.25.0 || ^4.0.0`, `openai@6.22.0` → peer `^3.25 || ^4.0`. 4.6.7은 세 요구 모두 만족.

**PR #358과 중복 없음**: PR #358의 functions lock 변경 대상(body-parser·express·follow-redirects·qs·side-channel)은 이 브랜치에서 main 버전 그대로다(express 4.22.2, body-parser 1.20.6, follow-redirects 1.16.0, qs 6.15.2 — 10번 dry-run 출력으로 확인). 이 브랜치는 PR #358 커밋을 포함하지 않는다.

## 6. puppeteer 25 공식 변경과 이 저장소 영향

공식 BREAKING CHANGES(puppeteer-v25.0.0, puppeteer-core-v25.0.0, 2026-05-12):

| 공식 변경 | 이 저장소 영향 |
|---|---|
| 최소 Node 22 (`engines.node >=22.12.0`, 25.16.0 package.json 원본) | 배포 런타임 `nodejs22`, CI Node v22.23.4로 충족. Cloud Functions 실제 런타임 마이너 버전은 운영 데이터 조회 금지로 **미확인** (Node 22.12는 2024-12 출시라 낮을 가능성은 작음). 미달이어도 npm 기본값에서 engines는 경고만 낸다 |
| ESM 전용 (`"type": "module"`, `exports["."].require`도 ESM 파일) | `functions/src`·`functions/test`에 puppeteer import/require **없음** → 배포 코드 영향 없음. 루트 로컬 스크립트 `capture_grape.js:7`이 `require('./functions/node_modules/puppeteer')` 사용 — 8절 |
| `executablePath()`, `defaultArgs()`가 Promise 반환 | 사용처 없음 |
| `Puppeteer.product`, `Browser.isConnected()`, `MouseOptions.clickCount`, Cookie `sameParty` 제거 / 헤더 줄바꿈 정규화 | 사용처 없음 (`capture_grape.js`는 `launch`·`newPage`·`setViewport`·`setContent`·`screenshot`·`close`만 사용) |
| 설정 로더 cosmiconfig → lilconfig, `getConfiguration` 비동기화 | 저장소에 `.puppeteerrc*`·`puppeteer.config.*`·package.json `puppeteer` 키 없음. `PUPPETEER_SKIP_DOWNLOAD` 환경변수 처리 방식은 24·25 동일(`getBooleanEnvVar('PUPPETEER_SKIP_DOWNLOAD')`) |

브라우저 다운로드(설치 시):

- 25.16.0 `postinstall` = `node install.mjs` → `downloadBrowsers()`: `PUPPETEER_SKIP_DOWNLOAD`가 없으면 **chrome과 chrome-headless-shell 두 개**를 `~/.cache/puppeteer`에 받는다(firefox 기본 제외). 24.40.0과 같은 동작이다. 받는 Chrome 버전만 바뀐다(25.16.0 = Chrome 156.0.8078.47, 공식 릴리스 노트).
- `install.mjs`는 다운로드 실패를 `console.warn('Browser download failed', …)`로 잡고 종료 코드를 실패로 만들지 않는다.
- 추가 다운로드 대상은 **늘지 않았다**. 저장소 CI(`functions-sharp-linux.yml`)는 `PUPPETEER_SKIP_DOWNLOAD: 'true'`를 이미 쓴다.

## 7. zod 4 공식 설명과 영향

- zod v4.0.1 공식 릴리스: "There were no code changes between 3.25.76 and 4.0.0" — Zod 4 API는 3.25.x 안의 `zod/v4` 하위 경로로 먼저 배포됐고, 4.0.0은 기본 진입점을 v4로 바꾼 것. 3.x API는 `zod/v3`로 계속 제공.
- 이 저장소에서 zod는 **간접 의존성만**이다(`dependency-type: indirect`). `functions/src`·`functions/test`에 `zod` import 없음.
- `openai` 사용처: `functions/src/elderBook.ts:12`, `bookReview.ts:8`, `bookStudio.ts:3`, `ai/aiGateway.ts:6,60` — 모두 기본 진입점 `openai`만 사용. zod가 필요한 `openai/helpers/zod`(`zodResponseFormat`, `zodFunction`)는 사용처 없음.
- `@anthropic-ai/sdk`: `functions/src`에서 import 없음. zod helper도 없음.
- 따라서 zod 4는 `chromium-bidi`(puppeteer 내부) 전용으로 로드된다. 배포 코드가 puppeteer를 로드하지 않으므로 운영 실행 경로에서 zod는 로드되지 않는다(정적 분석 결론, 실행 실측 아님).

## 8. 사용처 검색 결과 (Grep)

| 검색 | 범위 | 결과 |
|---|---|---|
| `from ['"](zod\|puppeteer\|puppeteer-core)` · `require\(['"](zod\|puppeteer\|puppeteer-core)` | `functions/` (node_modules 제외) | 없음 |
| `puppeteer\|zod` | `.github/**`, `firebase.json`, `functions/src/**`, `functions/test/**`, `.puppeteerrc*` | 없음 (워크플로의 `PUPPETEER_SKIP_DOWNLOAD`는 대문자라 이 패턴에 안 걸림, 직접 Read로 확인) |
| `puppeteer` | 저장소 전체 (node_modules·lock·docs 제외) | `functions/package.json`, `functions/package-lock.json`, `capture_grape.js` |
| `(openai\|@anthropic-ai/sdk)/(helpers\|lib)\|zodResponseFormat\|zodFunction\|betaZodTool\|zodOutputFormat` | `functions/` | 없음 |

`capture_grape.js`(루트, 배포 대상 아님, 포도 애니메이션 캡처용 로컬 도구): CJS `require()`로 ESM 전용 puppeteer 25를 읽는다. Node ≥22.12 / 20.19의 `require(esm)` 기본 지원으로 모듈 네임스페이스가 반환되고, 25.16.0 `src/puppeteer.ts`가 `launch`를 이름 있는 export로 내보내므로 `puppeteer.launch(...)` 호출 형태는 유지된다. 단, 의존 그래프에 top-level await가 있으면 `ERR_REQUIRE_ASYNC_MODULE`이 날 수 있는데 **실행 확인하지 않았다**. 이 스크립트는 브라우저 다운로드도 필요하다.

## 9. 배포 영향과 대상

- 바뀌는 것은 `functions/` 의존성 lock뿐이다. Hosting(frontend)·Rules·Firestore 경로·리전(`asia-northeast3`)·환경변수·결제·인증·AI 모델 변경 없음.
- main 병합만으로는 Functions가 배포되지 않는다(Hosting 자동배포만 있음, functions 소스 변화 없음). **다음에 어떤 함수든 배포할 때** Cloud Build가 이 lock으로 `npm ci`를 하므로 그때부터 모든 Functions 배포 패키지에 반영된다. 특정 대상 함수는 없다(puppeteer·zod를 쓰는 함수 없음).
- 배포 빌드 영향: lock 항목 788 → 734(제거 66, 추가 12). 설치 시 puppeteer postinstall이 Cloud Build 안에서 chrome·chrome-headless-shell 다운로드를 시도하는 동작은 24와 같다(다운로드 위치 `~/.cache/puppeteer`, 실패해도 설치 계속). 배포 이미지 크기·빌드 시간 실측은 없다.
- 이 브랜치의 이번 작업에서 배포하지 않았다.

## 10. Rollback

- 병합 전: 이 초안 PR을 닫으면 끝. 원 PR #330도 그대로 열려 있다.
- 병합 후·Functions 배포 전: 병합 커밋 revert(`functions/package.json`·`functions/package-lock.json`만 되돌아감).
- Functions 배포 후 문제 시: revert 커밋으로 lock을 되돌린 뒤 **문제 함수만** `firebase deploy --only functions:<함수명> --project haru2026-8abb8`로 재배포. 리전 `asia-northeast3` 확인. 데이터·Rules·캐시 조치 필요 없음.

## 11. 남은 위험

1. **로컬 Node 22 / npm 10 검증 0건.** 로컬은 Node 26 / npm 11이고 실제 설치도 못 했다. Node 22 근거는 원 PR HEAD `e19e908c`의 CI 1건뿐이며, merge 후 HEAD 근거는 이 초안 PR CI 결과로만 얻을 수 있다.
2. **export 목록 diff 미실행.** `functions/src`가 origin/main과 동일하므로(4절 6번) 소스 기준 export 이름 변화는 없어야 하나 **실측 아님**.
3. **puppeteer·zod API 실사용 시험 없음.** 배포 코드에 사용처가 없어 대상 시험 자체가 존재하지 않는다. `capture_grape.js`의 `require(esm)` 동작도 미확인.
4. Cloud Functions 실제 Node 22 마이너 버전 미확인(engines `>=22.12.0`).
5. PR #358과 같은 `functions/package-lock.json`을 다른 부분에서 고친다. 먼저 병합된 쪽 뒤에 나머지 PR은 lock 재생성 또는 충돌 해결이 필요할 수 있다.
6. puppeteer는 사용처가 없는데도 production 의존성으로 남아 Cloud Build마다 브라우저 다운로드를 시도한다. 이번 지시에 따라 제거하지 않았다(기존 상태와 동일, 이번 변경으로 늘지 않음).
7. zod 4.6.x 릴리스 노트에 "9월 21일 main에 악성 커밋 6개, 당일 revert, npm 미배포" 공지가 있다(4.6.6 노트). 4.6.7 npm provenance·integrity는 lock의 `integrity`값 외에 별도 검증하지 않았다.

## 12. 상위 실행자가 실행해야 할 정확한 명령 (권한 거부로 미실행)

Node 22 / npm 10 환경에서 이 worktree 기준:

```bash
cd /private/tmp/haru-pending-major-deps-20261109/functions
node -v   # v22.x 확인
npm -v    # 10.x 확인
PUPPETEER_SKIP_DOWNLOAD=true npm ci --no-audit --no-fund
npm run build
npm run test:sharp-pipelines
npm run test:ai-gateway
node -e "console.log(Object.keys(require('./lib/index.js')).sort().join('\n'))" > /private/tmp/pr330-exports-head.txt
```

비교 기준(origin/main, 별도 worktree에서 같은 순서):

```bash
node -e "console.log(Object.keys(require('./lib/index.js')).sort().join('\n'))" > /private/tmp/pr330-exports-main.txt
diff /private/tmp/pr330-exports-main.txt /private/tmp/pr330-exports-head.txt
```

`lib/index.js` require 시 Firebase 초기화 부작용이 있을 수 있으므로, 기존 PR 기록에서 쓰던 export diff 방식이 있으면 그 방식을 우선한다. 운영 데이터·외부 AI 호출이 일어나지 않는지 확인한 뒤 실행한다.

## 13. 검증 상태 요약 (사실만)

| 항목 | 상태 |
|---|---|
| 최신 origin/main merge | ✅ `5f41cd7e`, 충돌 없음 |
| 공식 릴리스·이전 버전 호환성 검토 | ✅ 6·7절 (GitHub 공식 저장소 원본) |
| src 사용처(zod·puppeteer) | ✅ 없음 (정적 검색) |
| 간접 사용 SDK(openai·Anthropic) zod peer 호환 | ✅ peer 범위 충족, zod helper 사용처 없음 (정적) |
| 추가 브라우저 다운로드 | ✅ 늘지 않음 (24·25 소스 비교) |
| lock 정합성 | ✅ npm 11 dry-run / 원 PR HEAD는 CI Node 22·npm 10.9.9 `npm ci` 성공 |
| Node 22 / npm 10 `npm ci` + build + 시험 (merge 후 HEAD) | 🔍 초안 PR CI `linux_x64_node22` 결과 대기 |
| 로컬 Functions build · 관련 시험 · export diff | ❌ 미실행 (환경변수 명령 권한 거부) |
| puppeteer·zod API 실사용 시험 | ❌ 해당 사용처 없음, `capture_grape.js` 미실행 |
| PR #358 중복 | ✅ 없음 |
