# PR321 인증 관문 fixture 보정과 기준선 비교 기록

- 실행자: CC. 부모 Codex는 기록 보존자이며 이 시험을 실행하지 않았다.
- 대상: `fe0cffa0483108ec78fb6a39db38abfa189c8702` 위 fixture 보정, 커밋 `ece2f972`. 시험은 커밋 전 같은 파일 내용으로 실행했다.
- 환경: Node v22.23.2, npm 10.9.8, darwin arm64, Playwright 1.59.1, 헤드리스 Chromium 147.0.7727.15
- 입력 판정: 독립2 "수정 후 승인" 누적 1/3 유지. 이 기록은 횟수를 바꾸지 않는다.

## 결론

독립2 필수 조치 1의 시험 실행 공백은 해소됐다. 실제 헤드리스 Chromium에서 인증 시험 21건이 후보와 기준선 양쪽 모두 통과했다.

기준선과 후보의 결과가 같으므로 이 시험 범위에서 React 19·Router 8 이행으로 생긴 회귀는 발견되지 않았다. 번들 실패는 수정 전 기준선에서도 같은 오류로 재현되어, 이행 회귀가 아니라 fixture 노후화임을 실행으로 확인했다.

## 실행 결과

각 명령은 `run-recorded.cjs`로 1회씩 실행했다. 재시도는 없었고, 아래 행이 이번 단계 시험 실행의 전부다. 모든 실행의 stderr는 0바이트다.

| 라벨 | 위치 | 명령 | 종료코드 | 결과 |
| --- | --- | --- | --- | --- |
| `baseline-auth-gate-unmodified` | 기준선, fixture 수정 전 | `node --test tests/auth-user-document-gate.test.cjs` | 1 | tests 21, pass 0, fail 21 |
| `baseline-auth-gate-fixture1` | 기준선, fixture 수정 후 | 같음 | 0 | tests 21, pass 21, fail 0, skipped 0 |
| `candidate-auth-gate-fixture1` | 후보, fixture 수정 후 | 같음 | 0 | tests 21, pass 21, fail 0, skipped 0 |
| `candidate-public-legal` | 후보 | `node --test tests/public-legal-boundary.test.cjs` | 0 | tests 6, pass 6, fail 0 |
| `candidate-webMajorUpgrade` | 후보 | `node --test frontend/test/webMajorUpgrade.test.mjs` | 0 | tests 12, pass 12, fail 0 |
| `baseline-public-legal` | 기준선 시험 파일, 후보 작업 디렉터리에서 절대 경로로 실행 | `node --test <기준선>/tests/public-legal-boundary.test.cjs` | 0 | tests 6, pass 6, fail 0 |

- 후보의 실패 기록은 이전 단계 `../auth-gate-validation/`에 있다. 같은 시험, 같은 오류 5건, tests 21, fail 21이다. 이번에 후보의 수정 전 시험은 다시 실행하지 않았다.
- `meta.json`의 `head`는 실행자가 넘긴 값이다. 이번 `run-recorded.cjs`는 git을 호출하지 않는다.
- `npm ci`는 다시 실행하지 않았다. 후보 `tests/node_modules`는 이전 단계 설치본이고, 기준선은 부모가 만든 symlink로 같은 설치본을 쓴다.
- Chromium 버전은 `chromium.launch()` 후 `browser.version()`으로 확인했다. 실제 브라우저 계정·프로필은 쓰지 않았고 시험은 `127.0.0.1` fixture만 접속한다.
- `AUTH_GATE_SCREENSHOT`은 지정하지 않아 스크린샷은 없다.

## 변경

`tests/fixtures/auth-gate/firebase.ts` 한 파일, 18줄 추가·1줄 삭제. 원문은 `fixture.patch`다. 제품 코드, 시험 파일, 시험 기대값, 시험 패키지는 바꾸지 않았다.

실제 코드를 읽어 정한 대응은 다음과 같다.

| 함수 | 실제 `loginPerformance.ts` | fixture |
| --- | --- | --- |
| `bindLoginTraceToAccount` | `no_trace`, `bound`, `same_account`, `account_changed` 반환 | `harness.traceAccount`로 `bound`, `same_account`, `account_changed` 반환 |
| `endLoginTraceForAuthChange` | 활성 추적을 `account_switch`로 막고 제거 | 활성 계정이 있을 때만 `blocked:account_switch` 기록 후 초기화 |
| `blockLoginTrace` | 차단 사유 기록 | `blocked:<사유>` 기록 |
| `resumeLoginTrace` | 재개 사유 기록 | `resumed:<사유>` 기록 |
| `markLoginAccessReady` | `resumeLoginTrace('required_access_ready')` 후 T6 표시 | 같은 호출 순서 |

`AuthContext.tsx:492`는 `bindLoginTraceToAccount` 반환값이 `account_changed`이면 T4를 표시하지 않는다. 이 분기만 상태가 필요하므로 계정 연결만 상태로 두었다. 기존 `markLoginTrace`는 그대로이며 `tests/auth-user-document-gate.test.cjs:82`의 T5 단언도 그대로다.

### 실제 모듈과 다른 점

- 실제 모듈은 `beginLoginTrace`가 없으면 전부 무동작이고 `no_trace`를 반환한다. fixture는 기존 `markLoginTrace`처럼 추적이 항상 진행 중이라고 본다.
- 계정 변경 직후 다음 연결은 실제 `no_trace`, fixture `bound`다. `AuthContext`에서는 둘 다 같은 분기다.
- 계정 변경 뒤 실제 모듈은 표시를 버리지만 fixture는 계속 기록한다.
- `resumeLoginTrace`의 재개 가능 사유 검사와 같은 사유 중복 차단은 모형화하지 않았다. `AuthContext`가 반환값을 쓰지 않아 호출만 기록한다.

### 시험이 검증하지 않는 것

새 추적 기록을 확인하는 단언은 없다. 추적 단언은 `:82`의 T5 부재 1건뿐이다. 이번 지시가 fixture 한 파일 보정이어서 단언을 추가하지 않았다. 따라서 21건 통과는 인증 관문 동작의 근거이고, 로그인 추적 5개 함수 호출의 정확성 근거는 아니다.

## 기준선 차이

- 기준선: `/private/tmp/haru-completion-control-20261031/web-upgrade-baseline-build-a8a8a6b8`. `frontend/`는 원래 것, `tests/`는 부모가 `git archive a8a8a6b8 tests`로 추가했다.
- `diff -r -q tests <기준선>/tests -x node_modules` 결과 다른 파일은 `tests/public-legal-boundary.test.cjs` 1개다. 후보가 `react-router`를 쓰도록 고친 한 줄 차이다(`../fix-public-legal/`).
- `git diff --stat a8a8a6b8 HEAD`로 인증 시험 입력을 대조한 결과 `fe0cffa0` 기준 변경은 `PublicLegalBoundary.tsx` 1줄뿐이다.
- `frontend/test/webMajorUpgrade.test.mjs`는 기준선에 없어 기준선 실행 대상이 아니다.
- 기준선 fixture는 후보와 같은 내용으로 덮어썼고 되돌리지 않았다. 그 폴더의 다른 파일과 `frontend/`는 바꾸지 않았다.

## 해시 (SHA-256)

| 파일 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 후보·기준선 `tests/package-lock.json` | `e7758a46c5025735a7ac8666e3a3e33abd0626e0c484c8fd26afa572f77adf6f` | 같음 |
| 후보 `tests/package.json` | `ea1f235be73191cccc7d243d90513bd4cd1073e283c8568266b7da8af20be80d` | 같음 |
| 후보·기준선 `tests/fixtures/auth-gate/firebase.ts` | `e796c5d6ac0253448ea501f193188f19b1a2f03376faccd65b73ea2a10b0004e` | `9911eed1c7e82950e893514ffa047c66cf7291539a590345918761e02c9f6479` |

## 권한 거부 기록

모두 우회하지 않았다.

1. control이 세션 주 작업 디렉터리로 잡혀 있을 때 `cd <작업본> && git ...` 복합 명령이 거부됐다. 사유: "This command changes directory before running a version-control command". 그 사이 git을 다른 형태로 실행하지 않고 파일 도구와 기록을 먼저 진행했다. 이후 git은 세션 주 작업 디렉터리가 작업본으로 돌아온 뒤 작업본에서 직접 실행했다.
2. 셸 변수와 파이프를 쓴 복합 조회가 거부됐다. 단일 명령과 Read·Glob으로 대체했다.
3. `/Users/heogyeongdae/Library/Caches/ms-playwright` 목록 조회가 거부됐다. 세션 허용 경로 밖이다. Playwright가 시험 중 브라우저를 정상 실행했으므로 조회는 필요하지 않게 됐고, 캐시 위치는 확인하지 않았다.

정책 파일 `/Users/heogyeongdae/AI_STORAGE_POLICY.md`는 Read로 읽었다. LaCie에는 쓰지 않았고 이 기록은 저장소 필수 검토 기록 예외다.

## 이 폴더의 파일

- 시험 원문: `<라벨>.stdout.log`, `.stderr.log`, `.meta.json`
- 패치와 기록 스크립트: `fixture.patch`, `run-recorded.cjs`
- 앞선 단계 원문: `web-upgrade-auth-gate-validation-prompt.txt`, `-result.json`, `-stderr.txt`
- 이번 단계 질문 원문: `web-upgrade-auth-fixture-fix-prompt.txt`. 이번 단계 최종 result는 부모가 종료 후 추가한다.

## 남은 일

1. `ece2f972`는 `docs/reviews` 밖 변경이므로 검토 기록 전용 예외가 아니다. 최신 HEAD에 대한 Codex 3차 검토와 독립3이 필요하다.
2. 최종 HEAD CI는 부모가 확인한다. `.github`에 이 인증 시험을 실행하는 곳이 없어 CI 통과가 이 시험 통과를 뜻하지는 않는다.
3. 전체 643시험과 전체 build는 제품 소스 변경이 없어 지시대로 다시 실행하지 않았다.
4. `webMajorUpgrade` 시험의 산출물 검사는 기존 `frontend/dist`를 읽으며 이번에 다시 빌드하지 않았다.
