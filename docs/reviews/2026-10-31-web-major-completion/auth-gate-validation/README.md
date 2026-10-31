# PR321 인증 관문 시험 실행 기록 (독립2 필수 조치 1)

- 시험 실행자: CC. 부모 Codex는 기록 보존자이며 이 시험을 실행하지 않았다.
- 대상: HEAD `683bca45349f7eda8c7a540d37b7050713d74913`, 작업본 `/private/tmp/haru-completion-web-upgrade-20261031`
- 환경: Node v22.23.2, npm 10.9.8, darwin arm64 (uname -r 27.0.0)
- 입력 판정: 독립2 "수정 후 승인" 누적 1/3, 제품 결함 0. 원문 `../resume0035-review2/web-upgrade-independent2-result.json`

## 결론

**필수 조치 1은 충족되지 않았다.** 시험은 실행됐지만 21건 전부 실패했고, 인증 동작은 하나도 검증되지 않았다.

`before` 훅의 esbuild 번들 단계에서 멈춰 Chromium은 시작되지 않았다. 따라서 이 기록은 React 19·Router 8에서 인증 관문이 정상이라는 근거도, 비정상이라는 근거도 아니다.

## 실행 결과

| 명령 | 시작(UTC) | 종료코드 | 결과 | 원문 |
| --- | --- | --- | --- | --- |
| `npm ci --prefix tests` | 2026-10-31T19:31:55.787Z | 0 | 4개 패키지 추가, 취약점 0, stderr 0바이트 | `npm-ci.*` |
| `node --test tests/auth-user-document-gate.test.cjs` | 2026-10-31T19:32:02.890Z | 1 | tests 21, pass 0, fail 21, cancelled 0, skipped 0, 1578ms, stderr 0바이트 | `auth-gate-test.*` |

두 명령은 `run-recorded.cjs`로 각 1회 실행했다. 이 스크립트는 명령을 재시도 없이 실행하고 stdout, stderr, 종료코드, HEAD, 버전을 남긴다. 환경변수 값은 기록하지 않는다.

`AUTH_GATE_SCREENSHOT`은 지정하지 않아 스크린샷은 없다.

## 실패 원인

`auth-gate-test.stdout.log`의 esbuild 오류 5건은 모두 같은 종류다.

```
No matching export in "tests/fixtures/auth-gate/firebase.ts" for import "bindLoginTraceToAccount"
(blockLoginTrace, endLoginTraceForAuthChange, markLoginAccessReady, resumeLoginTrace 동일)
```

- `tests/auth-user-document-gate.test.cjs:20`의 플러그인이 `utils/loginPerformance`를 fixture `firebase.ts`로 대체한다.
- `frontend/src/app/contexts/AuthContext.tsx:31-36`은 이 모듈에서 6개를 가져오는데, fixture에는 `markLoginTrace`만 있다.
- 실제 `frontend/src/app/utils/loginPerformance.ts`에는 6개가 모두 export되어 있다.
- 이력: fixture와 시험의 마지막 수정은 2026-09-23 `d54832d3`이다. 빠진 import는 2026-09-25 `f12c115f`에서 `AuthContext.tsx`에 추가됐다.

## 기준선 비교 상태

**a8a8a6b8 기준선에서 같은 시험을 실행하지 못했다.**

- 기록상 기준선 경로 2곳 모두 루트 `tests/`가 없다.
  - `/private/tmp/haru-completion-control-20261031/web-upgrade-baseline-build-a8a8a6b8` : `frontend/`만 있음. 의존성 설치 완료, `AuthContext.tsx` blob이 a8a8a6b8와 같음(`8b0d817d`).
  - `/private/tmp/haru-completion-control-20261031/web-upgrade-clean-a8a8a6b8` : `frontend/src`와 tsconfig만 있고 `package.json`이 없음.
- control에 새 폴더를 만들어 a8a8a6b8의 시험 파일을 풀고 기준선 `frontend`를 링크하려 했으나 권한이 거부됐다. 거부 원문은 아래와 같고, 폴더는 생성되지 않았다.

```
Permission for this tool use was denied. It requires approval, and this session has no approval surface
What required approval: This Bash command contains multiple operations. The following part requires approval:
tar -x -C /private/tmp/haru-completion-control-20261031/web-upgrade-auth-gate-baseline-a8a8a6b8 && ln -s
/private/tmp/haru-completion-control-20261031/web-upgrade-baseline-build-a8a8a6b8/frontend
/private/tmp/haru-completion-control-20261031/web-upgrade-auth-gate-baseline-a8a8a6b8/frontend
```

다른 방법으로 권한을 돌아가지 않았고, 다른 worktree나 사용자 원본도 사용하지 않았다.

### 읽기 전용 대조 (실행 근거 아님)

`git diff --name-status a8a8a6b8 683bca45` 결과, 시험 입력 중 바뀐 파일은 다음 1개뿐이다.

- 동일: `tests/auth-user-document-gate.test.cjs`, `tests/fixtures/auth-gate/*`, `tests/package.json`, `tests/package-lock.json`, `AuthContext.tsx`, `loginPerformance.ts`, `ProtectedRoute.tsx`
- 변경: `PublicLegalBoundary.tsx` 1줄(`react-router-dom` → `react-router`). 위 오류 5건과 무관한 import다.

이 대조로 보면 같은 export 누락이 기준선에도 있으며 이번 이행의 회귀가 아니라고 판단된다. 다만 기준선 실행 결과가 아니라 소스 대조에 근거한 판단이다.

## 잠금 파일과 작업본

- `tests/package-lock.json` blob 전후 동일: `0b83b4164f714ef6bf9c38bf78b19c352fd84642`
- `tests/package.json` blob 전후 동일: `650dc59405dca66a0f91f2328ef9fb586750b6fc`
- `tests/node_modules`는 `.gitignore:20`으로 제외되어 추적 파일 변경 없음.
- 제품 코드, 시험, fixture는 수정하지 않았다.

## 권한 거부 기록

- `/Users/heogyeongdae/Library/Caches/ms-playwright` 조회 거부. 세션 허용 경로 밖이다. 시험이 Chromium 시작 전에 멈췄으므로 **Playwright 1.59.1용 Chromium의 설치 여부는 미확인**이다.
- 위 기준선 폴더 생성 거부.

## 남은 필요 사항

1. fixture 보정: `tests/fixtures/auth-gate/firebase.ts`에 빠진 5개 export를 추가할지 결정한다. 이는 `docs/reviews` 밖 시험 파일 변경이므로 검토 기록 전용 커밋 예외가 아니고 Codex 재검토가 필요하다. 이번 지시의 stage 범위를 벗어나 수행하지 않았다.
2. 보정 후 `node --test tests/auth-user-document-gate.test.cjs`를 실행한다. 이때 Chromium이 없으면 브라우저 설치 승인도 필요하다.
3. 기준선 실행이 필요하면 a8a8a6b8의 `tests/`를 기준선 `frontend/` 옆에 두는 작업을 허용한다.
4. 기록 커밋 후 최종 HEAD CI를 다시 확인한다. 이는 부모가 이어간다.
