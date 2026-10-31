# #319 #320 #321 합본 상호영향 검증

- 실행자: CC 실행자(Claude Code). 부모 Codex는 worktree 생성과 기록 보존 담당이다.
- 대상: `/private/tmp/haru-completion-joint-20261101`, `codex/completion-joint-validation`, HEAD `b935b898`, tree `4a49e02d`
- 계보: `80622676`(#320) + `b9651bf2`(#319) = `022646e1`, `022646e1` + `48a098e7`(#321) = `b935b898`. 로컬 병합이며 운영 main, 원격 PR branch 병합이 아니다.
- 환경: Node v22.23.2, npm 10.9.8, darwin arm64, React 19.3.1, react-router 8.5.1, Vite 8.3.5, sharp 0.35.5, libvips 8.18.7
- 성격: 기존 독립 제품 승인 3건을 대체하는 판정이 아니다.

## 결론

**실행한 자동 시험 범위에서 세 PR 사이의 충돌은 없었다.** 시험 131건 중 131건 통과, 실패 0, 건너뜀 0이다. 빌드 2건, 설치 3건도 종료코드 0이다.

통합 근거의 범위는 아래 "미검증"이 정한다. 특히 음성 handler는 실제 페이지 마운트가 아니고, sharp와 generateTTS는 같은 프로세스 로드까지만 확인했다.

## 결과

| 라벨 | 명령 | 종료 | 결과 |
| --- | --- | --- | --- |
| `01-npm-ci-frontend` | `npm ci --prefix frontend` | 0 | 830 패키지 |
| `02-npm-ci-functions` | `npm ci --prefix functions` | 0 | 742 패키지 |
| `03-npm-ci-tests` | `npm ci --prefix tests` | 0 | 4 패키지 |
| `10-frontend-build` | 더미 6값 + `npm --prefix frontend run build` | 0 | 42.73초, PWA 793항목 |
| `11-bible-grammar` | `npm --prefix frontend run test:bible-grammar` | 0 | 35/35 |
| `12-reading-continue` | `npm --prefix frontend run test:reading-continue` | 0 | 10/10 |
| `13-frontend-reading-ai` | `npm --prefix frontend run test:reading-ai` | 0 | 17/17 |
| `14-auth-gate` | `node --test tests/auth-user-document-gate.test.cjs` | 0 | 21/21 |
| `15-public-legal` | `node --test tests/public-legal-boundary.test.cjs` | 0 | 6/6 |
| `16-web-major-upgrade` | `node --test frontend/test/webMajorUpgrade.test.mjs` | 0 | 12/12 |
| `20-functions-build` | `npm --prefix functions run build` | 0 | stderr 0바이트 |
| `21-generate-tts` | (functions) `node --test test/generateTts.test.js` | 0 | 8/8 |
| `22-functions-reading-ai` | (functions) `node --test test/readingAi.test.js` | 0 | 8/8 |
| `23-sharp-pipelines` | (functions) `node --test test/sharpImagePipelines.test.js` | 0 | 14/14, 시험 안 exports=114 |
| `24-exports` | `Object.keys(require('./lib/index.js'))` | 0 | 114개, 중복 0 |
| `25-sharp-tts-load` | sharp와 lib/index.js, lib/ttsQuality.js 동시 로드 | 0 | generateTTS 함수, 리전 asia-northeast3 |
| `34-dist-bible-voice` | dist/assets 문자열 대조 | 0 | "AI 고음질 듣기"가 모던·레거시 묶음 2개에 있음 |

Functions 시험은 `20` 빌드 결과 1개로 실행했다. 빌드를 3번 반복하지 않으려고 package script의 `npm run build` 앞단을 빼고 뒷단 명령만 실행했다.

## export 대조

`exports-diff.json`에 공개 함수 이름만 있다. 실제 컴파일 목록 114개를 기준선 3종과 비교해 추가 0, 삭제 0이다.

- `docs/reviews/2026-10-31-sharp-completion/logs-node22/baseline/exports.txt`
- `docs/reviews/2026-10-31-sharp-completion/logs-node22/candidate/exports.txt`
- `reader141-parent-exports-check.json`

## 무변경 확인

- `32-final-src-lock-unchanged`: `frontend/src`, `frontend/test`, `functions/src`, `functions/test`, `tests`, package.json, lock, Rules, firebase.json이 HEAD와 같다(종료 0, 출력 없음).
- `33-final-lock-sha256`: lock 4개 해시가 실행 전과 같다.
- 새 commit, push 없음.

**단, worktree는 clean이 아니다.** `30-final-git-status`에 ` M functions/lib/index.js`, ` M functions/lib/snsToDiary.js`가 있다.

- 원인: 지시된 Functions build가 추적 생성물을 덮어썼다. 합칠 때 생긴 문제가 아니다.
- 근거: 커밋본 `lib/index.js`의 마지막 변경은 2026-10-06 `fe5830cd`이고 `ttsQuality` 문자열이 0건이다. 새 빌드에는 4건 있다.
- 배포 영향: `firebase.json` predeploy가 빌드를 다시 실행한다.
- 조치: 증거 산출물이므로 복원하지 않았다. 이 두 파일은 커밋하면 안 된다.

## 미검증

- BiblePage를 실제 브라우저와 BrowserRouter에 마운트한 음성 재생. `11`은 BiblePage 원문에서 handler를 뽑아 실제 React 19 `createElement`, `renderToStaticMarkup`과 모의 Audio, callable로 실행한다. Router 8은 거치지 않는다. Router 8은 `15`, `16`과 `10` 빌드에서 따로 확인됐다.
- 컴파일된 `lib`의 generateTTS handler 실행. `21`은 `src/index.ts` 원문을 변환해 모의 의존성으로 실행하고, `lib/ttsQuality.js`만 컴파일본을 쓴다.
- sharp와 generateTTS가 함께 쓰이는 호출 경로. 이번 범위에서는 같은 프로세스 로드까지만 확인했다.
- 실제 OpenAI, Storage, Firebase, 에뮬레이터, 운영 E2E.
- Linux 재실행, CI, 전체 643시험, 전체 tsc, 모바일.
- export 로드 중 네트워크 차단 측정. `require`만 했고 handler는 호출하지 않았다.

## 권한 거부와 실패 원문

세 건 모두 재시도나 우회를 하지 않았다.

| 명령 | 사유 원문 |
| --- | --- |
| `cd /private/tmp/haru-completion-control-20261031 && git rev-parse --is-inside-work-tree ...` 포함 복합 명령 | `This command changes directory before running a version-control command, which can pick up untrusted hooks or repository configuration from the target directory.` |
| `ls -la .../AI_STORAGE_POLICY.md ...; cat package.json; ... node -e ...` 복합 명령 | `This Bash command contains multiple operations.` |
| `ls /Users/heogyeongdae/Library/Caches/ms-playwright` | `For security, Claude Code may only list files in the allowed working directories for this session` |

영향: control 폴더의 git 상태는 확인하지 못했다. 패키지 파일과 정책 파일은 Read로 확인했다. Playwright 캐시 목록은 못 봤지만 `14`가 브라우저를 실제로 띄워 통과했다.

실행 오류 1건: `git rev-parse --short=8 HEAD^1^1 HEAD^1^2 HEAD^2`가 `fatal: Needed a single revision`(종료 128)으로 끝났다. 인자를 여러 개 준 명령 오류이며 대상 결함이 아니다. 같은 정보는 `00-git-identity`에 있다.

Glob 1건은 control 폴더 파일 수 때문에 20초 시간 초과됐고 `ls`로 대신 확인했다. 이는 권한 문제가 아니다.

## 참고

- `npm ci` 출력: frontend 취약점 18건(critical 1), functions 51건(critical 1). 이번 범위 밖이며 조치하지 않았다.
- `10` stderr는 Vite 경고(`__dirname`, 500kB 초과 chunk, 효과 없는 동적 import, plugin 시간)뿐이다.
- 로그 전체에서 Google, OpenAI, GitHub, Slack 키, Bearer, 개인키, JWT 형식 검색 결과는 0건이다.
- 정책 `/Users/heogyeongdae/AI_STORAGE_POLICY.md`는 Read로 읽었다. LaCie에는 쓰지 않았다. 로그는 작은 검증 기록이다.
- `node_modules`, `frontend/dist`, `functions/lib` 빌드 결과는 worktree에 남겼다. `run-recorded.cjs`는 라벨이 겹치면 실패해 덮어쓰지 않는다.
