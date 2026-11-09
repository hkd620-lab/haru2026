# 열린 의존성 PR #329~#335 대조 기록 (2026-11-09, CC 실행자)

- 작업 위치: `/private/tmp/haru-complete-pending-20261109` (독립 worktree)
- 브랜치: `codex/complete-pending-20261109` (시작 시 clean, `origin/main`과 같은 위치)
- 대조 기준: 로컬에 있는 `origin/main` = `5f41cd7e` (2026-11-08 08:53 +0900). **이 세션에서는 `git fetch`가 권한 거부되어 원격 최신값을 다시 받아오지 못했다.**
- 상태: **분석만 완료. 변경·커밋·push·초안 PR은 하지 못했다**(아래 3절, 권한 거부).
- 이 문서는 실행자 기록이며 승인 기록이 아니다. 검토는 별도 세션의 독립 검토자가 한다.

## 1. 질문 원문

```text
CC 실행자 역할입니다. 현재 사용자 지시: HARU2026 미완료 항목을 모두 완료하자. 당신의 한정 작업은 열린 의존성 PR #329~#335를 최신 origin/main과 대조하여 필요한 업데이트를 최소 변경으로 완료하고 검증·작업 브랜치 커밋/push/초안 PR까지 만드는 것입니다. main 병합·배포·기존 PR 종료는 아직 하지 마세요. 저장소 AGENTS.md, CLAUDE.md, docs/HARU2026_Slack_운영정책.md를 읽고 준수하세요. 현재 cwd는 독립 codex/complete-pending-20261109, 최신 main 5f41cd7e 기반입니다. 기본 작업본의 미커밋 파일/다른 worktree는 건드리지 마세요. 열린 PR의 실제 diff와 main 버전을 확인하고 이미 반영된 건은 증거만 문서화하세요. 필요한 최소 package/lock 변경만, 도구 지원 방식으로 수행하고 lock 전체 재해결·모델변경·기능추가·Rules/인증/결제 변경은 금지. npm install 전 공간 확인, 기존 의존성 재사용이 가능하면 읽기만 활용하세요. 실패한 frontend CI #331,#333,#335 원인을 확인하고 재현되는 검증을 해주세요. Functions 변경이면 빌드·관련 시험·export diff, 프론트 변경이면 빌드·관련 시험. 비밀없는 합성 env로 로컬 빌드하되 실제 운영 배포본이라고 하지 마세요. docs/reviews/2026-11-09-pending-dependencies/에 질문 원문(이 입력), 실행 명령·결과·변경 PR 대응표·실제 남은 위험을 기록하세요. 검토자는 별도 세션에서 요청할 것이므로 자기 승인 금지. 한국어 커밋/PR 설명에 목적·주요 변경·검증·배포영향·위험·롤백·리전/경로/환경/결제/인증 변경여부 명시. 외장 일반 최종 보관은 상위 실행자가 담당, 필요한 임시 로그만 /private/tmp에 두세요. permission 거부는 우회하지 말고 정확히 보고하세요. git 강제/reset/stash/정리 삭제 금지. 직접 메시지·Slack 게시 금지. 진행 요약과 정확한 남은 조치를 결과로 반환하세요.
```

## 2. PR 대응표

PR 번호는 `gh`가 권한 거부되어 GitHub에서 직접 확인하지 못했다. 2026-11-03 05:57 UTC에 연달아 생긴 dependabot 브랜치 7개를 생성 순서대로 #329~#335에 맞췄고, frontend 브랜치 3개가 지시문의 "frontend CI 실패 #331·#333·#335" 위치와 정확히 겹친다. **번호 대응은 추정이며 `gh pr list`로 확인해야 한다.**

| PR(추정) | 브랜치 (`origin/dependabot/npm_and_yarn/…`) | 팁 | 변경 파일 | 내용 | main `5f41cd7e` 상태 | 판단 |
|---|---|---|---|---|---|---|
| #329 | `functions/body-parser-1.20.9` | `47d41652` | functions lock | body-parser 1.20.6→1.20.9, 중첩 qs 6.16.2 추가, side-channel 1.1.0→1.1.1 | 1.20.6 그대로(미반영) | 반영 대상 |
| #330 | `functions/multi-010aad1c49` | `e19e908c` | functions package.json + lock (+234/−841) | **puppeteer ^24.40.0→^25.16.0(직접 의존성 메이저)**, zod 3.25.76→4.6.7 | 24.40.0 / 3.25.76 그대로 | **최소 변경 범위 밖 — 이번 작업에서 제외, 결정 필요** |
| #331 | `frontend/serialize-javascript-7.1.4` | `f87ad828` | frontend lock | serialize-javascript 7.0.5→7.1.4 (dev) + 아래 "부수 삭제" | 7.0.5 그대로 | 버전 줄만 반영 대상 |
| #332 | `functions/multi-bbf9670a95` | `5d1349e1` | functions lock | express 4.22.2→4.22.3, 최상위 qs 6.15.2→6.15.4, express 중첩 qs 6.16.2, side-channel 1.1.1 | 4.22.2 / 6.15.2 그대로 | 반영 대상 |
| #333 | `frontend/dompurify-3.4.17` | `eb7c6212` | frontend lock | dompurify 3.4.13→3.4.17 + 부수 삭제 | 3.4.13 그대로 | 버전 줄만 반영 대상 |
| #334 | `functions/follow-redirects-1.16.2` | `50772325` | functions lock | follow-redirects 1.16.0→1.16.2 | 1.16.0 그대로 | 반영 대상 |
| #335 | `frontend/fast-uri-3.1.9` | `905cd7e1` | frontend lock | fast-uri 3.1.5→3.1.9 (dev) + 부수 삭제 | 3.1.5 그대로 | 버전 줄만 반영 대상 |

- 7개 모두 merge-base `69480eca`. main에 **이미 반영된 PR은 없다**(위 버전은 `functions/package-lock.json`, `frontend/package-lock.json`의 `5f41cd7e` 내용을 직접 확인).
- `69480eca..5f41cd7e` 사이 main의 package 파일 변경: `frontend/package.json` 시험 스크립트 2줄, `functions/package.json`·lock의 `fast-xml-parser 5.8.0` 직접 의존성 추가(#4459061c 등). `frontend/package-lock.json`은 그 사이 바뀌지 않았다. functions lock 변경 구간(fast-xml-parser 관련 `optional` 줄)은 #329·#332·#334 hunk와 위치가 다르다 — 충돌 없을 것으로 **예상**(merge-tree 시험은 권한 거부로 미실행).
- #329와 #332는 side-channel 1.1.1 hunk가 동일하다. 같이 반영할 때 한 번만 들어가야 한다.

## 3. 실행 명령과 결과

| 명령 | 결과 |
|---|---|
| `pwd; git branch …; git fetch …; df …` (복합) | 권한 거부 |
| `git status --short --branch` | `## codex/complete-pending-20261109...origin/main`, clean |
| `git fetch origin` | **권한 거부** — 원격 최신 main·PR 브랜치 재확인 못 함 |
| `gh pr list --state open …` | **권한 거부** — PR 번호·CI 로그·Codex 리뷰 확인 못 함 |
| `git branch -a --list '*dependabot*' …`, `git for-each-ref …` | 위 7개 브랜치와 팁 확인 |
| `git diff <브랜치>~1 <브랜치>` (각 PR) | 2절 내용 확인 |
| `git merge-base origin/main <브랜치>` | `69480eca` |
| `git diff 69480eca origin/main -- */package*.json` | 2절 main 변경 확인 |
| `ls -d frontend/node_modules functions/node_modules node_modules` | 셋 다 없음 |
| `df -h /private/tmp` | 여유 14Gi (97% 사용) |
| `node --version` | v26.8.2 (CI는 Node 22) |
| `npm --version` | **권한 거부** — npm ci/install/build/test 전부 이 세션에서 불가 |
| `node docs/reviews/…/lockcheck.mjs origin/main frontend` | **권한 거부** — 작성한 lock 정합성 점검 스크립트 미실행 |
| `git cherry-pick -n <follow-redirects 브랜치>` | **권한 거부** — 작업 브랜치에 변경 반영 못 함 |
| `git merge-tree --write-tree …` | **권한 거부** |
| `/opt/homebrew/lib/node_modules/npm/...` 읽기 | 작업 폴더 밖이라 권한 거부 |

권한 거부는 우회하지 않았다. 빌드·시험·export diff·커밋·push·초안 PR은 **하나도 실행하지 않았다.**

## 4. frontend CI 실패(#331·#333·#335) 원인 분석

PR CI(`.github/workflows/firebase-hosting-pull-request.yml`)는 `frontend`에서 `npm ci` → `npm run build`만 한다. functions PR은 frontend lock을 바꾸지 않아 이 CI가 main lock으로 돌고, frontend PR 3개만 frontend lock을 바꾼다 — 실패 위치와 맞는다.

frontend PR 3개는 목표 패키지 버전 줄 외에 **같은 부수 삭제**를 담고 있다.

1. `node_modules/prop-types/node_modules/react-is` (16.13.1) 삭제
2. `node_modules/@types/babel__core`·`babel__generator`·`babel__template`·`babel__traverse` 삭제 (모두 `dev`·`optional`·`peer` 표시)

main lock에서 `prop-types@15.8.1`은 `"react-is": "^16.13.1"`을 요구하고, 최상위 `node_modules/react-is`는 `19.3.1`이다. 중첩 16.13.1이 지워지면 prop-types는 19.3.1로 해석되어 범위를 만족하지 못한다. `npm ci`는 lock으로 만든 트리와 다시 계산한 트리가 다르면 "package.json and package-lock.json … are not in sync / Missing: react-is@16.13.1 from lock file" 형태로 중단한다.

- **판단: 1번이 CI 실패 원인일 가능성이 가장 높다(추정).** CI 로그는 `gh` 거부로 보지 못했고, `npm ci` 재현도 npm 거부로 못 했다.
- 2번은 optional peer 항목이라 단독으로 실패를 일으키는지는 확인하지 못했다.
- 재현 방법: `docs/reviews/2026-11-09-pending-dependencies/lockcheck.mjs`(의존성 없는 node 스크립트, `git show`로 읽기만 함)를 작성해 두었다. 이 세션에서는 실행이 거부되어 **결과가 없다.** 다음 실행자가 아래 4개를 돌려 main=0건, PR 3개=`INVALID node_modules/prop-types -> react-is@^16.13.1 해석=node_modules/react-is@19.3.1`이 나오는지 확인하고, 최종 확인은 실제 `npm ci`로 한다.

  ```bash
  node docs/reviews/2026-11-09-pending-dependencies/lockcheck.mjs origin/main frontend
  node docs/reviews/2026-11-09-pending-dependencies/lockcheck.mjs origin/dependabot/npm_and_yarn/frontend/serialize-javascript-7.1.4 frontend
  node docs/reviews/2026-11-09-pending-dependencies/lockcheck.mjs origin/dependabot/npm_and_yarn/frontend/dompurify-3.4.17 frontend
  node docs/reviews/2026-11-09-pending-dependencies/lockcheck.mjs origin/dependabot/npm_and_yarn/frontend/fast-uri-3.1.9 frontend
  ```

## 5. 제안하는 최소 변경 (미실행)

한 작업 브랜치(`codex/complete-pending-20261109`)에 다음만 반영한다.

- **functions (#329·#332·#334)**: dependabot 커밋을 `git cherry-pick -n`으로 가져와 lock만 반영. package.json 변경 없음. 예상 결과: body-parser 1.20.9, express 4.22.3, qs 6.15.4(최상위)·6.16.2(body-parser·express 중첩), side-channel 1.1.1, follow-redirects 1.16.2.
- **frontend (#331·#333·#335)**: 부수 삭제를 빼고 목표 버전만 반영한다. lock 수기 편집은 "도구 지원 방식"이 아니다. `npm install <패키지>@<버전>`은 package.json에 직접 의존성을 추가하므로 쓰지 않는다. 전이 의존성만 올리는 `cd frontend && npm update serialize-javascript dompurify fast-uri --package-lock-only --ignore-scripts`(npm 10, Node 22)를 쓰고, 결과 `git diff frontend/package-lock.json`이 세 패키지의 version/resolved/integrity 줄만 바뀌었는지, `prop-types/node_modules/react-is`가 남아 있는지 확인한다. 다른 줄이 바뀌면 그 diff는 버리지 말고(정리 삭제 금지) 커밋하지 않은 채 보고한다.
- **#330(puppeteer 25 / zod 4) 제외 이유**: 직접 production 의존성의 메이저 업그레이드이고 lock 1,073줄이 바뀌어 "최소 변경"이 아니다. `functions/src`에는 `puppeteer` import가 없다(이 worktree 검색 결과) — 사용처가 없다면 업그레이드보다 제거 여부가 맞는 질문일 수 있으나, 그것은 기능·배포 영향 판단이라 허대표님 결정 대상이다.

필수 검증(판정① 2항, 실행 시):

- functions: `cd functions && npm ci --no-audit --no-fund`(PUPPETEER_SKIP_DOWNLOAD=true), `npm run build`, 관련 시험(express·body-parser를 쓰는 HTTP 함수 시험이 있으면 그것, 최소 `npm run test:sharp-pipelines`), export 목록 diff(main 빌드 vs 작업 브랜치 빌드의 `lib/index.js` export 이름 비교).
- frontend: 합성 env(`.github/workflows/firebase-hosting-pull-request.yml`의 dummy 값과 같은 형식, 비밀값 없음)로 `npm ci && npm run build`, 그리고 dompurify를 쓰는 화면 관련 `frontend/test/*`. 이 빌드는 운영 배포본이 아니다.
- 공통: `git diff --check`, `git diff --cached --name-only`로 package-lock 두 개와 이 기록 폴더만 들어갔는지 확인.

## 6. 실제 남은 위험

- 원격 최신 상태 미확인: fetch 거부로 `origin/main`이 `5f41cd7e` 이후 바뀌었는지, PR 브랜치가 rebase됐는지 모른다.
- PR 번호 대응·CI 실패 로그·Codex 리뷰 미확인(`gh` 거부).
- CI 실패 원인은 lock 구조 분석에 따른 추정이며, 재현 시험 결과가 없다.
- 빌드·시험·export diff를 하나도 하지 못했다. 이 기록의 어떤 내용도 "검증 통과"가 아니다.
- #330 미처리: puppeteer 24 유지. 사용처가 없으면 배포 패키지 크기만 늘리는 상태가 계속된다(확인 필요).
- 로컬 Node는 v26.8.2, CI·Functions 런타임은 Node 22. 로컬 재현 시 Node 22를 쓰는 것이 맞다.
- 디스크 여유 14Gi(97% 사용). frontend·functions `npm ci`는 각각 수백 MB~1GB 수준으로 예상되며, 정책상 1GB 이상이면 사용자 확인 대상이다.

## 7. 변경 여부 (이번 세션)

- 코드·package·lock 변경: 없음
- 추가 파일(커밋 안 됨): 이 `README.md`, `lockcheck.mjs`
- 리전/Firestore 경로/환경 변수/결제/인증/Rules/모델 변경: 없음
- main 병합·배포·기존 PR 종료·Slack 게시: 하지 않음
