# 열린 의존성 PR #329~#335 반영 — CC 실행자 2차 기록 (2026-11-09)

- 같은 폴더의 `README.md`·`lockcheck.mjs`는 1차 실행(권한 거부로 분석만 함) 기록이다. 고치지 않고 그대로 둔다. 이 파일이 2차 실행 기록이다.
- 작업 위치: `/private/tmp/haru-complete-pending-20261109` (독립 worktree), 브랜치 `codex/complete-pending-20261109`, 기준 `origin/main` = `5f41cd7e` (`git fetch origin` 후에도 변동 없음 확인).
- 이 문서는 실행자 기록이며 승인 기록이 아니다. 자기 승인하지 않는다. 검토는 별도 세션의 독립 검토자와 Codex가 한다.

## 1. 질문 원문

1차 기록 `README.md` 1절과 같은 입력이다(같은 지시를 2차 실행에서 다시 받음). 원문을 그대로 옮긴다.

```text
CC 실행자 역할입니다. 현재 사용자 지시: HARU2026 미완료 항목을 모두 완료하자. 당신의 한정 작업은 열린 의존성 PR #329~#335를 최신 origin/main과 대조하여 필요한 업데이트를 최소 변경으로 완료하고 검증·작업 브랜치 커밋/push/초안 PR까지 만드는 것입니다. main 병합·배포·기존 PR 종료는 아직 하지 마세요. 저장소 AGENTS.md, CLAUDE.md, docs/HARU2026_Slack_운영정책.md를 읽고 준수하세요. 현재 cwd는 독립 codex/complete-pending-20261109, 최신 main 5f41cd7e 기반입니다. 기본 작업본의 미커밋 파일/다른 worktree는 건드리지 마세요. 열린 PR의 실제 diff와 main 버전을 확인하고 이미 반영된 건은 증거만 문서화하세요. 필요한 최소 package/lock 변경만, 도구 지원 방식으로 수행하고 lock 전체 재해결·모델변경·기능추가·Rules/인증/결제 변경은 금지. npm install 전 공간 확인, 기존 의존성 재사용이 가능하면 읽기만 활용하세요. 실패한 frontend CI #331,#333,#335 원인을 확인하고 재현되는 검증을 해주세요. Functions 변경이면 빌드·관련 시험·export diff, 프론트 변경이면 빌드·관련 시험. 비밀없는 합성 env로 로컬 빌드하되 실제 운영 배포본이라고 하지 마세요. docs/reviews/2026-11-09-pending-dependencies/에 질문 원문(이 입력), 실행 명령·결과·변경 PR 대응표·실제 남은 위험을 기록하세요. 검토자는 별도 세션에서 요청할 것이므로 자기 승인 금지. 한국어 커밋/PR 설명에 목적·주요 변경·검증·배포영향·위험·롤백·리전/경로/환경/결제/인증 변경여부 명시. 외장 일반 최종 보관은 상위 실행자가 담당, 필요한 임시 로그만 /private/tmp에 두세요. permission 거부는 우회하지 말고 정확히 보고하세요. git 강제/reset/stash/정리 삭제 금지. 직접 메시지·Slack 게시 금지. 진행 요약과 정확한 남은 조치를 결과로 반환하세요.
```

## 2. PR 대응표 (GitHub 확인값)

`gh pr list --state open`으로 번호·브랜치·HEAD를 확인했다. 1차 기록의 "추정" 대응은 모두 맞았다. 7개 모두 merge-base `69480eca`, main `5f41cd7e`에는 **어느 것도 반영되지 않았다**(main lock의 해당 버전 직접 확인).

| PR | HEAD | 내용 | PR CI | 이번 브랜치 반영 | 반영 방식 |
|---|---|---|---|---|---|
| #329 | `47d41652` | functions body-parser 1.20.6→1.20.9 | (확인 안 함) | body-parser **1.20.9** | npm 생성 |
| #330 | `e19e908c` | functions **puppeteer ^24→^25(직접 의존성 메이저)**, zod 3→4, lock +233/−840 | 성공 2건 | **제외** | — |
| #331 | `f87ad828` | frontend serialize-javascript 7.0.5→7.1.4 (dev) | **실패** | **7.1.4** | npm 생성 값 이식 |
| #332 | `5d1349e1` | functions express 4.22.2→4.22.3, qs 6.15.2→6.15.4 | (확인 안 함) | express **4.22.3**, qs **6.16.2**(최상위 1개) | npm 생성 |
| #333 | `eb7c6212` | frontend dompurify 3.4.13→3.4.17 | **실패** | **3.4.17** | npm 생성 값 이식 |
| #334 | `50772325` | functions follow-redirects 1.16.0→1.16.2 | (확인 안 함) | follow-redirects **1.16.3** | npm 생성 |
| #335 | `905cd7e1` | frontend fast-uri 3.1.5→3.1.9 (dev) | **실패** | **3.1.9** | npm 생성 값 이식 |

PR과 다른 점:

- **qs**: dependabot은 최상위 qs 6.15.4 + body-parser·express 아래 중첩 qs 6.16.2를 따로 두었다. 세 functions 건을 한 번에 갱신하자 npm이 최상위 qs 하나를 6.16.2로 올리고 중첩을 만들지 않았다. 최상위 qs 6.16.2는 npm이 lock의 모든 요구 범위를 만족한다고 판단한 결과다(`npm ci` 성공으로 확인).
- **follow-redirects**: `npm update`가 범위 안 최신 1.16.3을 골랐다(PR 1.16.2보다 1패치 높음). 정확히 1.16.2로 맞추려면 `npm install follow-redirects@1.16.2`가 필요한데 이는 package.json에 직접 의존성을 추가하므로 쓰지 않았다.
- side-channel 1.1.1, path-to-regexp ~0.1.13 요구는 #329·#332와 같다.

## 3. frontend CI 실패(#331·#333·#335) 원인 — 실제 로그로 확인

세 PR 모두 `Deploy to Firebase Hosting on PR / build_and_preview`의 `npm ci` 단계에서 같은 오류로 실패했다(node v22.23.4, npm 10.9.9).

| PR | Actions run | 오류 |
|---|---|---|
| #331 | <https://github.com/hkd620-lab/haru2026/actions/runs/41586921584/job/125754472031> | `npm ci can only install packages when your package.json and package-lock.json ... are in sync` / `Missing: react-is@16.13.1 from lock file` |
| #333 | <https://github.com/hkd620-lab/haru2026/actions/runs/41586927258/job/125754490080> | 같음 |
| #335 | <https://github.com/hkd620-lab/haru2026/actions/runs/41586935353/job/125754517103> | 같음 |

원인: dependabot lock은 목표 패키지 외에 `node_modules/prop-types/node_modules/react-is`(16.13.1)와 `@types/babel__core`·`babel__generator`·`babel__template`·`babel__traverse`(dev·optional·peer)를 지웠다. `prop-types@15.8.1`은 `react-is ^16.13.1`이 필요한데 최상위 `react-is`는 19.3.1이다. npm 10.9.9는 이 중첩 항목이 lock에 있어야 한다고 보고 `npm ci`를 중단한다.

로컬 재현 결과(로컬 npm은 11.19.1, CI와 다름):

- 로컬 npm 11에서 main lock으로 `npm update serialize-javascript dompurify fast-uri --package-lock-only`를 하면 **dependabot과 똑같이** 위 5개 항목을 지웠다(목표 버전 외 차이는 #331 lock과 dompurify·fast-uri 줄뿐). 즉 부수 삭제는 npm(최신) 자체의 해석 결과다. `frontend/package.json`의 `overrides.recharts.react-is = 19.3.1`이 `recharts → react-smooth → prop-types` 경로에도 적용되면서, 공유되는 `prop-types`의 react-is 요구를 덮어쓴 것으로 보인다(추정 — npm 버전 간 overrides 해석 차이).
- npm 11 `npm ci --dry-run`은 #331 lock과 main lock을 **둘 다 통과**시켰다. npm 10.9.9에서 #331 lock이 실패하는 것은 위 CI 로그로만 확인했다. 로컬 npm 10.9.9 재현(`npx -y npm@10.9.9 ci --dry-run …`)은 **권한 거부**로 실행하지 못했다.
- 1차 기록의 `lockcheck.mjs`를 main lock에 돌리면 오류 10건이 나온다. 하이픈 범위(`1 - 2`)를 잘못 해석하는 등 스크립트 자체의 거짓 양성이다. **이 스크립트 결과는 근거로 쓰지 않는다.**

## 4. 실제 변경

변경 파일은 2개뿐이다. package.json 변경 없음.

### functions/package-lock.json (+22/−21)

`origin/main`의 package.json·lock을 `/private/tmp`에 복사해 `npm update express body-parser follow-redirects --package-lock-only --ignore-scripts`(npm 11.19.1)를 실행한 결과 lock을 그대로 가져왔다. 바뀐 항목: body-parser, express, follow-redirects, qs, side-channel(버전·resolved·integrity와 그 패키지의 의존 범위 줄). 다른 항목 변화 없음.

### frontend/package-lock.json (+9/−9)

npm 생성 lock에는 CI(npm 10.9.9)를 깨는 부수 삭제가 들어 있어 그대로 쓸 수 없었다. 그래서 **main lock에 npm 생성 lock의 세 항목(`serialize-javascript`, `dompurify`, `fast-uri`)의 `version`·`resolved`·`integrity` 세 값만 옮겼다**(`/private/tmp/haru-deps-20261109/scripts/transplant-frontend-lock.mjs`, JSON 재직렬화 2칸 들여쓰기 + 끝 줄바꿈 — 결과 diff는 정확히 9줄).

- 세 항목의 나머지 필드(dependencies, engines, dev/optional, license, funding)는 npm 생성 lock과 main lock이 **같음**을 비교 스크립트로 확인했다. 즉 새 버전에서 의존 관계 변화가 없다.
- **검토 포인트**: 이 방식은 "npm이 만든 값을 옮겨 적은 것"이지 npm이 lock 전체를 다시 쓴 것은 아니다. 지시의 "도구 지원 방식" 기준에서 허용되는지 검토자 판단이 필요하다. 대안은 (a) CI npm 버전을 올리는 워크플로 변경, (b) overrides 조정 — 둘 다 이번 범위(최소 변경, 설정 변경 금지) 밖이라 하지 않았다.

### #330 제외 사유

직접 production 의존성 puppeteer의 메이저 업그레이드(24→25)와 zod 3→4로 lock 1,073줄이 바뀐다. "최소 변경" 범위가 아니다. `functions/src`에 `puppeteer`·`zod` import가 없다(이 worktree 검색). 사용처가 없다면 업그레이드보다 제거 여부가 맞는 질문일 수 있으나, 배포 패키지 구성 변경이라 허대표님 결정 대상이다. PR #330은 열린 채 둔다.

## 5. 실행 명령과 결과

| 명령 | 결과 |
|---|---|
| `pwd; git branch --show-current; git status --short; git log -1 origin/main; df -h /private/tmp` | 경로·브랜치 일치, 미추적 이 폴더만, main `5f41cd7e`, 여유 14Gi |
| `git fetch origin` | 성공, main 변동 없음 |
| `gh pr list --state open …` | #329~#335 번호·브랜치·HEAD 확인 |
| `gh pr checks 331` 등 | **권한 거부** |
| `gh pr view 331/333/335/330 --json statusCheckRollup` | #331·#333·#335 `build_and_preview` FAILURE, #330 성공 2건 |
| `gh run view <run> --log-failed` (3건) | 3절 오류 확인. 원본 로그 `/private/tmp/haru-deps-20261109-ci-{331,333,335}.log` |
| `gh run view … \| grep …` | **권한 거부**(파이프) — 파일 저장 후 Grep 도구로 대체 |
| `node …/lockcheck.mjs origin/main frontend` | 오류 10건(스크립트 거짓 양성, 3절) |
| `npm --version` | 11.19.1 |
| `npm ci --dry-run --ignore-scripts --prefix <#331 lock 복사본>` (npm 11) | 통과 |
| `npx -y npm@10.9.9 ci --dry-run …` | **권한 거부** |
| `npm update serialize-javascript dompurify fast-uri --package-lock-only --ignore-scripts --prefix <main 복사본>` | 3개 갱신 + 부수 삭제 5항목(3절) |
| `npm ci --dry-run --ignore-scripts --prefix <main lock 복사본>` (npm 11) | 통과 |
| `npm update express body-parser follow-redirects --package-lock-only --ignore-scripts --prefix <functions main 복사본>` | 4절 결과(EBADENGINE 경고: 로컬 node 26 ≠ engines 22) |
| `node transplant-frontend-lock.mjs …` | 세 항목 이식, diff 9줄 |
| 세 항목 나머지 필드 비교 | `other-fields-same` ×3 |
| `df -h` → `npm ci --ignore-scripts --no-audit --no-fund --prefix frontend` | 성공, 825 packages, node_modules 865M, 이후 여유 13Gi |
| 설치 버전 확인 | serialize-javascript 7.1.4, dompurify 3.4.17, fast-uri 3.1.9 |
| `npm ci --ignore-scripts --no-audit --no-fund --prefix functions` | 성공, 740 packages, node_modules 568M, 이후 여유 12Gi |
| 설치 버전 확인 | express 4.22.3, body-parser 1.20.9, qs 6.16.2, side-channel 1.1.1, follow-redirects 1.16.3, path-to-regexp 0.1.13 |
| `npm ci` 후 `git status --short` | lock 2개 외 변화 없음(설치가 lock을 바꾸지 않음) |
| frontend 합성 env 빌드 (스크립트 실행, 명령줄 env + `npm --prefix frontend run build` 두 형태) | **둘 다 권한 거부** |
| `npm ls dompurify …` | **권한 거부** — lock 파싱으로 대체: serialize-javascript ← `@rollup/plugin-terser`(dev), fast-uri ← `ajv`(dev), dompurify ← `jspdf`(prod, optional) |
| `npm --prefix functions run build` | **권한 거부** |

권한 거부는 우회하지 않았다. 특히 빌드 거부 뒤 `vite`·`tsc`를 직접 실행하는 등 같은 동작을 다른 형태로 다시 시도하지 않았다.

참고: npm 11 `npm ci`로 설치한 frontend `node_modules`에는 `prop-types/node_modules/react-is`가 생기지 않았다(lock에는 있음). main lock 그대로여도 npm 11에서 같은 결과이며 이번 변경 때문이 아니다.

## 6. 검증 상태 (사실만)

| 항목 | 상태 |
|---|---|
| frontend lock `npm ci` (npm 11, macOS) | ✅ 성공 |
| frontend lock `npm ci` (npm 10.9.9, CI) | 초안 PR CI 결과로 확인 예정 |
| frontend 빌드 (합성 env) | ❌ 로컬 미실행(권한 거부). 초안 PR CI `build_and_preview`가 같은 단계 수행 |
| frontend 관련 시험 | 세 패키지를 직접 쓰는 `frontend/src`·`frontend/test` 코드 없음(검색). 실행한 시험 없음 |
| functions lock `npm ci` (npm 11, macOS) | ✅ 성공 |
| functions 빌드 + `test:sharp-pipelines` | ❌ 로컬 미실행(권한 거부). 초안 PR CI `Functions sharp Linux check`(Node 22, `npm ci` → `npm run test:sharp-pipelines`, 빌드 포함)로 확인 예정 |
| functions export 목록 diff | ❌ 미실행(빌드 불가). lock만 바뀌고 `functions/src` 변경 없음 — export 이름 변화 가능성은 낮으나 **실측 아님** |
| express·body-parser를 쓰는 HTTP 함수 동작 시험 | ❌ 미실행 |

로컬 빌드는 하나도 하지 못했다. 이 기록의 어떤 내용도 "빌드 통과"가 아니다.

## 7. 실제 남은 위험

1. **frontend lock 이식 방식**(4절): npm이 lock을 직접 쓴 결과가 아니다. 검토자가 허용 여부를 판단해야 한다.
2. **npm 10/11 해석 차이**: 이후 누군가 npm 11로 frontend lock을 다시 만들면 같은 부수 삭제가 생겨 CI가 다시 깨질 수 있다. dependabot frontend PR도 같은 원인으로 계속 실패할 수 있다. 근본 해결(CI npm 버전, overrides 조정)은 별도 결정이 필요하다.
3. **qs 6.15 → 6.16 마이너 업**(최상위): PR #332는 최상위를 6.15.4로 두었는데, 이번 결과는 최상위 6.16.2다. qs를 직접 쓰는 다른 패키지에도 6.16.2가 쓰인다. 쿼리 문자열 파싱 동작 차이 가능성은 시험하지 않았다.
4. follow-redirects 1.16.3은 PR 대상(1.16.2)과 다르다.
5. 로컬 빌드·시험·export diff 미실행. CI 결과 전에는 검증 미완료다.
6. 로컬 Node v26.8.2 / npm 11.19.1 ≠ CI·Functions 런타임 Node 22 / npm 10.9.9.
7. #330 미처리(puppeteer 24, zod 3 유지).
8. 초안 PR이라도 `pull_request` 이벤트로 Hosting **preview 채널** 배포가 실행된다(라이브 아님). 이 preview 빌드는 secrets로 만들어지므로 로컬 합성 env 빌드와 다르다.
9. 기존 PR #329·#331~#335는 종료하지 않았다. 이 브랜치가 병합되면 그 PR들은 충돌·중복 상태가 된다 — 종료는 병합 뒤 별도 조치.

## 8. 변경 여부

- 리전·Firestore 경로·환경 변수·결제·인증·Rules·AI 모델: **변경 없음**
- package.json: 변경 없음 / lock: frontend 9줄, functions 43줄
- main 병합·운영 배포·기존 PR 종료·Slack 게시: **하지 않음**
- 임시 로그·스크립트: `/private/tmp/haru-deps-20261109/`, `/private/tmp/haru-deps-20261109-ci-*.log` (외장 최종 보관은 상위 실행자 담당)
- worktree 안 `frontend/node_modules`(865M), `functions/node_modules`(568M) 생성 — gitignore 대상, 삭제하지 않음
