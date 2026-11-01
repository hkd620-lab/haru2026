# PR321 독립3 승인 증거 기록

기록자: 실행 CC. 이 문서는 문서 실행 결과이며 추가 독립 검토가 아니다. 판정 본문은 `web-upgrade-independent3-result.json`의 `result`가 원본이고, 충돌하면 원문을 따른다.

- PR: https://github.com/hkd620-lab/haru2026/pull/321
- 검토 대상 HEAD: `48a098e7f6042a453e352a3782aeb72d5d2970f5`, base `a8a8a6b8`
- 판정 문구: **승인 (제품 코드·설계와 시험 증거 한정)**
- 같은 건 "수정 후 승인" 누적: **1/3 유지**. 이번 승인은 횟수를 늘리지 않는다.

## 현재 상태 구분

| 구분 | 상태 |
| --- | --- |
| 제품 코드·설계와 시험 증거 | 독립3 승인. 필수 결함 없음 |
| Codex | 실행3 지적 0, 미해결 0. `codex-index-3.md` |
| 최종 HEAD CI | **대기.** 이 기록 커밋 뒤 부모가 확인한다 |
| 판정① | **미확정.** 최종 CI 확인과 기록 전용 예외 확인 전에는 판정①로 표현하지 않는다 |
| 병합·운영 배포 | **미승인, 사용자 결정 대기.** 2026-10-07 승인은 이어받지 않는다 |
| 운영 E2E | **전부 미실행.** AI가 대신 확인할 수 없다 |

## 판정 이력

| 검토 | 대상 | 판정 | 원문 |
| --- | --- | --- | --- |
| 독립1 | 75372144 | 판정 없음. API 429 중단, 승인으로 세지 않음 | `../limit-2017/` |
| 독립2 | `683bca45` | 수정 후 승인 1/3. 제품 결함 없음, Must 2개 | `../resume0035-review2/web-upgrade-independent2-prompt.txt`, `-result.json` |
| 독립3 | `48a098e7` | 승인 (제품 코드·설계와 시험 증거 한정) | `web-upgrade-independent3-prompt.txt`, `-result.json`, `-stderr.txt` |

독립2 뒤 첫 인증 시험은 21건 전부 실패했다. 이 실패는 승인 뒤에도 숨기지 않으며 원문을 `../auth-gate-validation/`에 그대로 둔다.

## 독립2 Must 충족

1. **인증 관문 시험 실행: 충족.** 후보와 기준선 모두 21/21 통과.
2. **기록 보존: 충족.** `../resume0035-review2/`에 `codex-index-1-2.md`와 지정 원문 추가. 독립3 이후 남은 원문은 이 폴더에 추가했다.

## 시험 숫자

독립3이 stdout과 meta 원문을 직접 대조한 값이다.

| 실행 | 종료코드 | tests | pass | fail | skipped |
| --- | --- | --- | --- | --- | --- |
| 후보, 보정 전 (`683bca45`, 19:32:02Z) | 1 | 21 | 0 | 21 | 0 |
| 기준선, 보정 전 (19:40:31Z) | 1 | 21 | 0 | 21 | 0 |
| 기준선, 보정 후 (19:41:08Z) | 0 | 21 | 21 | 0 | 0 |
| 후보, 보정 후 (19:41:18Z) | 0 | 21 | 21 | 0 | 0 |
| 후보 공개 약관 | 0 | 6 | 6 | 0 | 0 |
| 기준선 공개 약관 | 0 | 6 | 6 | 0 | 0 |
| 후보 `webMajorUpgrade` | 0 | 12 | 12 | 0 | 0 |

보정 전 실패는 기준선과 후보가 같은 export 5개 누락 오류이고, "No matching export"는 각각 110회다. 두 로그의 나머지 차이 211줄은 독립3이 줄별로 보지 않았다.

## 불변 범위

- **제품 코드 불변:** `git diff --name-status 028c5bb3 48a098e7 -- frontend tests functions mobile .github` 결과는 `M tests/fixtures/auth-gate/firebase.ts` 1건이다.
- **fixture 한 파일 패치:** `ece2f972`는 `tests/fixtures/auth-gate/firebase.ts` 18줄 추가·1줄 삭제다. blob은 `8e31c9a6..338a89c5`이고, 독립3이 `../auth-gate-fixture-fix/fixture.patch`의 hunk와 일치함을 확인했다.
- **기준선 동일 입력:** 독립3이 기준선과 후보의 `firebase.ts`, `auth-user-document-gate.test.cjs` 내용이 같음을 확인했다. 기준선 스택은 React 18.3.1 / Router 7.18.1, 후보는 React 19.3.1 / Router 8.5.1이다.
- **기대값 불변:** 시험 삭제, skip, 단언 변경이 없다. a8a8a6b8 대비 `tests/` 변경은 위 fixture와 `public-legal-boundary.test.cjs` 2개뿐이다.
- **인증 입력 불변:** 이번 보정에서 `AuthContext.tsx`, `loginPerformance.ts`, `ProtectedRoute.tsx`, 인증 시험 파일은 바뀌지 않았다.

## 한계

- **mock 경계:** 21/21은 mock Firebase와 로컬 fixture를 쓴 Chromium의 보호 경계 시험이다. 운영 Google OAuth, iOS, PWA 완료가 아니다.
- **추적 호출 미검증:** 21/21은 인증 관문의 근거이고 로그인 추적 5개 함수 호출 정확성의 근거가 아니다. fixture와 실제 모듈의 차이는 `../auth-gate-fixture-fix/README.md`에 있다.
- **README 미기재 차이:** 계정 미연결 상태의 추적 종료 시 fixture는 차단 기록을 남기지 않는다. 독립3은 이 기록을 보는 단언이 없어 영향이 없다고 판단했다.
- **CI 범위:** CI는 이 인증 시험을 실행하지 않으므로 CI 성공은 시험 통과의 근거가 아니다.
- **Chromium 버전:** 147.0.7727.15는 README와 구현자 결과에만 있고 별도 원문 로그가 없다.
- **`webMajorUpgrade`:** 산출물 검사는 기존 `frontend/dist`를 읽고 다시 빌드하지 않았다.
- **독립3 권한 거부:** README의 SHA-256 값을 독립3이 재계산하지 못해 git blob과 내용 diff로 대신했다. 이번 기록에서도 그 값은 재계산하지 않았다.
- **Preview `/terms`:** 독립2 이후 `net::ERR_BLOCKED_BY_CLIENT`로 화면 검증이 실패했다. 성공으로 해석하지 않는다.

## CI 스냅샷

run 41235562939, 대상 `48a098e7f6042a453e352a3782aeb72d5d2970f5`. 최종 HEAD의 CI가 아니다.

| 검사 | ID | 결과 |
| --- | --- | --- |
| `build_and_preview` | 124638490903 | success, 주석 2건 |
| Deploy Preview | 124638750581 | success |

`web321-ci-authfix-details.json`의 주석 원문은 다음과 같다. 독립3은 이 본문을 보지 못했다고 적었고, 이 raw와 대조해 내용을 확인했다. 둘 다 시험 실패가 아니다.

- warning: `Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4.`
- notice: `The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026.`

## 배포 뒤 필수 운영 확인 (전부 미실행)

1. Google 로그인과 복귀 후 개인화, `/vault`→`/settings` 이동
2. 기록 저장·재열기, recharts 차트
3. AI 마크다운, 의약품 안내, xlsx·PDF 가져오기
4. 기존 PWA의 새 SW 갱신과 오프라인 재진입
5. iOS 16.4 미만 실기기 또는 시뮬레이터 부팅, 블러 UI, 로그인
6. iOS 최신 Safari PWA 블러 UI

잔여 위험: iOS 13~16.3이 레거시 경로로 바뀐 영향은 실제 파싱과 로드 지연이 불명이다. 구형 iOS의 동적 lookbehind 예외는 기준선과 같은 기존 한계다.

## 기록 전용 예외 확인

필터 없는 `git diff --name-status 48a098e7..HEAD` 결과는 이 문서를 포함한 커밋 뒤에야 나오므로 여기에 넣지 않는다. 결과는 작업본 밖 `/private/tmp/haru-completion-control-20261031/web321-review3-records-name-status.txt`에 저장한다. 기록 밖 경로가 하나라도 섞이면 독립3 승인은 그 HEAD에 적용되지 않는다.

## 이 폴더의 원문

`source-hashes.json`에 9개 파일의 SHA-256이 있고, 이번 기록 작성 시 9개 모두 재계산해 일치를 확인했다.

- `web-upgrade-independent3-prompt.txt`, `web-upgrade-independent3-result.json`, `web-upgrade-independent3-stderr.txt`
- `web-upgrade-auth-fixture-fix-result.json`, `web-upgrade-auth-fixture-fix-stderr.txt`
- `web321-codex3-running-comments.json`, `web321-codex3-completed-comments.json`
- `web321-ci-authfix-48a098e7.json`, `web321-ci-authfix-details.json`
