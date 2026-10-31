# #96 + #116 웹 메이저 이행 재개 기록 — 2026-10-31 19:30 이후

실행자: Claude Code (claude-opus-5-5). 이 폴더는 재개 실행의 보완 기록이다. 상위 폴더의 기존 파일은 수정하지 않았다.

## 원문 보존

| 파일 | 내용 |
| --- | --- |
| `web-upgrade-prompt.txt` | 최초 지시 원문 |
| `web-upgrade-result.json` | 최초 실행 결과. API 429 월 한도로 중단(`terminal_reason: api_error`), 작업 요약 없음 |
| `web-upgrade-stderr.txt` | 최초 실행 stderr (0바이트) |
| `web-upgrade-resume1930-prompt.txt` | 이번 재개 지시 원문 |
| `web-upgrade-parent-review-test.log` | 부모의 9시험 실행 로그 |
| `official-guidance-addendum-20261031.md`, `limit-handoff-20261031.md`, `resume-after-1930.md` | 부모 작성 근거·인수인계 사본 |
| `control-scripts/` | control에서 쓴 실행·비교 스크립트 사본 |

이번 재개의 runner 결과 파일 `web-upgrade-resume1930-result.json`은 이 커밋 시점에 비어 있었다. 실행 종료 후 runner가 기록하므로 부모가 추가해야 한다. 이번 실행의 결과는 이 문서가 대신 기록한다.

## 환경

- cwd `/private/tmp/haru-completion-web-upgrade-20261031`, branch `codex/completion-web-upgrade`, 시작 HEAD `b2866711`
- Node v22.23.2, npm 10.9.8 (`/opt/homebrew/opt/node@22/bin`)
- origin/main `a8a8a6b8` (19:5x 재조회 동일). 다른 branch merge 없음
- 웹 빌드 env는 더미 6값 + AI Library 더미 6값. `.env` 읽지 않음
- `npm ci`, install 전부 `--force`/`--legacy-peer-deps` 없음

## 이번 실행에서 찾은 문제 3건

재개 시점의 "Vite 8 빌드 성공" 상태는 완료가 아니었다. 다음 3건은 빌드 성공만으로는 드러나지 않았다.

### 1. 시험 25개 파일이 esbuild 부재로 실행 불가

Vite 6은 esbuild를 끌어왔지만 Vite 8은 아니다. 기존 시험과 `transformWithEsbuild`가 전이 설치본에 기대고 있었다.

- 증거: `tests/final-vite8-full.log` (`Cannot find package 'esbuild'`)
- 수정: devDependency `esbuild ^0.28.2`. Vite peer `^0.27.0 || ^0.28.0`, tsx `~0.28.0`을 모두 만족하고 lock에 이미 있던 0.28.2와 같다. 로그 `logs/51-esbuild-devdep-install.log`

### 2. iOS 13~16.3 부팅 실패 위험

| 항목 | main 기준선 | Vite 8 기본값 | 최종 |
| --- | --- | --- | --- |
| 모던 진입 가드 | 없음 (iOS 13이 모던 청크 사용) | `import.meta.resolve` 필요 (iOS 16.4+) | Vite 8과 동일 |
| 모던 `?.` / `??` | 0 / 0 | 2606 / 609 | 0 / 0 |
| 모던 lookbehind 리터럴 | 0 | 2 | 0 |
| 레거시 lookbehind 리터럴 | 2 (iOS 13이 쓰지 않던 경로) | 2 (iOS 13이 쓰는 경로) | 0 |

plugin-legacy 8에서 iOS 16.4 미만은 모던 진입 청크가 가드에서 멈추고 레거시로 넘어간다. 이 경로의 `index-legacy`에 lookbehind 리터럴이 남아 있었다. 출처는 `mdast-util-gfm-autolink-literal`과 `src/app/services/drugService.ts:291`이다. Safari 16.4 미만은 이 문법을 지원하지 않아 청크 전체가 파싱 실패할 수 있다.

- 증거: `dist-info/syntax-scan-baseline-a8a8a6b8.json`, `syntax-scan-final-vite8.json`, `syntax-scan-final-complete.json`
- 수정: `frontend/vite.config.ts`의 `modernTargets`를 plugin-legacy 6 내장값으로 복원. 변환기가 lookbehind를 런타임 `RegExp()`로 낮추며 레거시 청크에도 적용된다.
- 빌드 시 plugin의 `modernTargets` 경고가 출력되는데 의도한 설정이다.

### 3. Safari 18 미만 배경 블러 소실

Vite 8 기본 CSS 압축기 Lightning CSS가 plugin-legacy 기본 `cssTarget: chrome61` 기준으로 `-webkit-backdrop-filter`를 지웠다.

- 건수: 기준선 3 → Vite 8 기본값 0 → 최종 3
- 수정: `build.cssTarget: ['chrome61', 'safari13', 'ios13']`

## 검토 후 변경하지 않은 항목

- CommonJS interop 변경: 소스의 default import 대상(`react`, `react-dom/client`, `heic2any`)에 `__esModule`이 없고, `react-markdown`, `remark-*`는 ESM이다. `embla-carousel-react`는 ESM 경로로 해석되며 `ui/carousel`을 import하는 소스가 없다.
- CSP: `firebase.json`에 없어 가드의 `data:` import를 막지 않는다.
- CI 두 workflow: 이미 Node22. 변경 없음.
- 시험 실패 3개 파일: 기준선과 동일하므로 수정하지 않음.

## peer 변경 근거

- `@babel/plugin-transform-runtime ^7.29.0` override: `logs/40-vite8-install.log`의 ERESOLVE. `@rolldown/plugin-babel`의 peerOptional이 8.0.6을 택해 `@babel/core ^8`을 요구했다. peer 범위 `^7.29.0 || ^8.0.0-rc.1` 안의 7.x로 고정해 force 없이 해결했다.
- React·Router 관련 peer는 앞선 커밋 `0fd4aec0`, `b2866711`과 `npm-metadata/` 참조.

## 최종 검증

| 검증 | 결과 | 증거 |
| --- | --- | --- |
| `npm ci` | exit 0, 830 패키지 | `logs/54-final-npm-ci.log` |
| `npm ls --all` | exit 0 | `logs/57-final-npm-ls-all.log` |
| relock | exit 0, 전후 sha256 동일 (`f6a1d4d0…`, `8f071105…`) | `logs/56-final-relock.log` |
| `npm run build` | exit 0 | `logs/58-final-build.log` |
| 비 emulator 시험 81개 파일 | 643건 중 통과 634, 실패 8, skip 1 | `tests/final-complete-rerun-*` |
| 신규 `webMajorUpgrade` | 12/12 | 같은 로그 |
| tsc | 108건, 기준선과 완전 동일 | `tsc/final-complete.txt` |
| main dist와 비교 | 정적 파일 해시 전부 동일, manifest 동일 | `dist-info/final-vs-baseline.json` |
| SW | 793 precache, 누락 대상 0, skipWaiting·clientsClaim·cleanup·런타임 캐시·importScripts·navigate 없음 정책 동일 | 같은 파일, `dist-info/final-complete.json` |
| Chrome 모던 스모크 | 12경로 본문·이동 결과 기준선과 동일 | `smoke/final-complete-modern.json` |
| Chrome 레거시 강제 스모크 | 12경로 동일, 예외 0 | `smoke/final-complete-forced-legacy.json` |

### 시험 실패 대조

기준선과 파일별 tests/pass/fail/skip이 모두 같다. 추가된 파일은 `webMajorUpgrade`뿐이다.

- `test/assistantSavedResultOpen.test.mjs` 1건, `test/sayuGrowthTimeline.test.mjs` 6건: `isSpecialDayRecord is not defined`
- `test/statsStorage.policy.test.cjs` 1건: 정규식 정책 시험

인수인계 문서의 "기존 실패 2건"은 파일 3개, 소시험 8건이 정확한 수치다. `sayuGrowthTimeline`은 같은 원인의 기준선 실패이며 이번 변경으로 생긴 것이 아니다.

### 보존한 중간 실패 로그

- `tests/final-vite8-*`: esbuild 추가 전 26개 파일 실패 (이 중 25개가 esbuild 원인)
- `tests/final-vite8-esbuild-*`: esbuild 추가 후, iOS 타깃 수정 전
- `tests/final-complete-*`: 신규 시험의 내 판별식 오류로 1건 실패. 산출물이 `new` 없는 `RegExp(...)`로 최소화된 것을 인식하지 못했다. 시험만 고쳐 `final-complete-rerun`으로 재실행했다.
- `dist-info/final-vite8.json`, `syntax-scan-final-vite8.json`: 수정 전 산출물

### 스모크의 차이점과 범위

- 기준선만 `/does-not-exist`에서 `No routes matched` 콘솔 경고가 있었다. 화면은 같다. 이 경로는 catch-all이 없으며 기존 동작과 같다.
- 번들 크기: 모던 entry 5.87MB → 5.55MB, 레거시 entry 5.99MB → 5.77MB, CSS 155KB → 176KB. 파일 수 797 → 799는 `index.esm` 공용 청크 2개 증가다.
- `index.html`에 `index.esm` modulepreload 1건이 늘었다.
- 스모크는 더미 Firebase 값의 로그아웃 상태다. 스크린샷은 `smoke/`.

## 권한 거부

| 시도 | 거부 사유 | 결과와 대응 |
| --- | --- | --- |
| `cd docs/reviews/...` 후 `git diff` 등을 묶은 명령 | cd 뒤 git 실행은 대상 폴더 hook·설정을 읽을 수 있어 승인 필요 | 실행 안 됨. 내용은 cd 없이 지정 worktree에서 다시 확인 |
| 로그 `sed/tail/cat` 묶음 명령 | 복수 작업 일부가 승인 필요 | 실행 안 됨. Read/Grep 도구로 확인 |
| `ls`/`grep`/`sed` 도구 탐색 묶음 명령 | 동일 | 실행 안 됨. Read/Grep/Glob 도구로 확인 |
| `xcrun simctl list runtimes` | 승인 필요 | 실행 안 됨. **iOS 시뮬레이터 설치 여부와 실행 확인 불가** |

첫 명령의 `cd control`로 셸 위치가 잠시 control이 됐고, 단독 `cd`로 지정 worktree에 복귀했다. control 위치에서 git은 실행되지 않았다.

## 미해결·미확인

1. **iOS 실제 동작 미확인.** 레거시 강제 실행은 Chrome이다. 문법 비교와 합치면 iOS 13 파싱 위험은 제거됐다고 판단하지만 실기기 또는 시뮬레이터 확인이 필요하다.
2. iOS 16.4 미만 경로가 모던에서 레거시로 바뀌었다. plugin-legacy 8의 의도된 동작이다. 해당 기기는 실패할 모던 entry를 받은 뒤 레거시를 다시 받으므로 첫 로드가 느려질 수 있다.
3. 런타임 `RegExp()` lookbehind는 iOS 16.4 미만에서 호출 시 예외가 난다. remark-gfm 이메일 자동 링크와 `drugService.ts:291` 경로이며 기준선도 같다. 이번 범위에서 고치지 않았다.
4. 로그인 후 기능, 결제, 알림, 실제 SW 갱신, 실제 데이터 화면은 시험하지 않았다.
5. emulator 시험 5개 파일과 `test/*-browser` Vite 설정, `npm run dev`는 실행하지 않았다.
6. 빌드 안내: `vite.config.ts`의 `__dirname`이 향후 `configLoader: 'native'` 기본화 시 교체 대상이다. 현재 동작 영향 없음.
7. `npm ci`의 deprecated 경고(`glob@11.1.0`, `source-map@0.8.0-beta.0`)는 기준선 로그 `logs/01-baseline-npm-ci.log`에도 같은 내용으로 있다. 보안 감사는 이번 범위가 아니다.
8. raw 로그의 줄 끝 공백과 빈 줄은 원문 보존을 위해 고치지 않았다. 따라서 `docs/reviews` 대상 `git diff --check`는 경고를 낼 수 있다. 제품 diff의 `git diff --check`는 경고 없음.

## 운영 E2E 시나리오 (부모·허대표님 확인용)

1. 로그아웃 상태 `/`, `/login`, `/terms`, `/privacy`, `/refund`, `/business-info`, `/welcome`, `/card` 표시 확인
2. `/vault` 진입 시 `/settings`로 이동 확인
3. 구글 로그인 → `/auth/callback` → 복귀 후 홈 개인화 확인
4. 기록 작성·저장·재열기, 통계 차트(recharts) 표시 확인
5. 달력 날짜 선택 (react-day-picker 변경분) 확인
6. AI 비서 결과의 마크다운 표시, 의약품 안내(`drugService`) 확인
7. 가계부 카드 xlsx·카카오 PDF 가져오기 (lazy `xlsx`, `pdfjs-dist`) 확인
8. 배포 후 기존 PWA 사용자가 재실행 시 새 SW로 갱신되는지, 오프라인 재진입 동작 확인
9. iOS 16.4 미만 실기기 또는 시뮬레이터에서 첫 화면 부팅, 블러 UI, 로그인 확인
10. iOS 최신 Safari 홈 화면 PWA에서 `-webkit-backdrop-filter` 화면 확인
