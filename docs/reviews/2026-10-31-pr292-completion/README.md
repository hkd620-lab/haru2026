# PR #292 최신 main 통합·배포 전 검증 기록

실행자 CC의 자체 검증 기록이다. **독립 검토 승인이 아니며**, main 병합·운영 배포 승인도 아니다.

## 대상

- 브랜치: `codex/completion-pr292` (worktree `/private/tmp/haru-completion-pr292-20261031`)
- 통합 전 HEAD: `c07d7105`, 기존 구현: `756cc3b1`
- 통합한 main: `693af514`
- merge commit: `7e032a0f` (부모 `c07d7105`, `693af514`)
- 기존 검토: `docs/reviews/2026-10-27-pr292-independent-6/result.txt` 승인, 누적 수정 후 승인 1회. 대상은 main `0df59145` 통합본 `756cc3b1`이며 이번 통합 HEAD는 아니다.

## 통합 결과

`git merge --no-commit --no-ff origin/main` 자동 병합 성공, 충돌 없음. 충돌 해결이나 추가 수정 없이 커밋했다. rebase·force는 쓰지 않았다.

## 검증 결과

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| Functions 빌드 | `npm --prefix functions run build` | 성공 (merge 전 상태, `7e032a0f`에서 각 1회) |
| 관련 시험 | `cd functions && node --test test/polishContent.test.js test/aiUsageLogger.request.test.js test/aiGateway.test.js test/monthlyAiQuota.policy.test.js` | **69/69 통과** ([원문](related-tests.log), `7e032a0f` 빌드 직후) |
| 제품 diff 동일성 | `git diff origin/main -- functions/src functions/test`와 `git diff 0df59145 756cc3b1 -- functions/src functions/test`를 `index` 행 제외 후 문자열 비교 | **동일** (26,941자) |
| main 대비 변경 파일 | `git diff --cached --stat origin/main -- . ':!docs'` | 아래 6개뿐. `functions/lib` 차이 없음 |
| 공백 검사 | `git diff --cached --check origin/main -- . ':!docs' ':!functions/lib'` | 지적 없음 |
| export 대조 | `src/index.ts` 이름·재수출 행을 main과 비교, 빌드 `lib/index.js` 이름 집합 비교 | src 선언 73 동일, 재수출 행 동일. 빌드 lib 114개 |

main 대비 제품 diff:

- `functions/src/aiUsageLogger.ts`
- `functions/src/index.ts`
- `functions/src/polishUsage.ts`
- `functions/test/aiGateway.test.js`
- `functions/test/aiUsageLogger.request.test.js`
- `functions/test/polishContent.test.js`

빌드 lib 114개는 main의 추적 `lib/index.js` 113개보다 `chatWithReadingContext` 1개가 많다. 이 이름은 main `functions/src/index.ts:19`에 이미 있으므로 PR이 추가한 것이 아니라 main의 추적 lib가 소스보다 뒤처진 것이다.

## 무효 처리한 실행

이전 시도에서 빌드 완료 전에 시험이 시작되어 missing lib로 실패한 실행이 있었다. 코드 결함의 근거도 통과의 근거도 아니므로 집계하지 않았다. 위 69/69는 빌드 완료 뒤 다시 실행한 결과다.

## 생성물 처리

- 빌드가 바꾼 `functions/lib/index.js`, `functions/lib/snsToDiary.js`는 커밋하지 않고 merge 결과 내용으로 되돌렸다.
- `functions/node_modules`는 원본 폴더를 가리키는 임시 symlink이며 커밋하지 않았다. 실행 샌드박스가 저장소 밖 대상 조회를 막아 링크 대상 자체는 직접 나열하지 못했고, 빌드·시험이 해석에 성공한 것으로만 확인했다.

## 한계

- 실행한 것은 Functions 관련 시험 4파일이다. 전체 Functions 시험, 에뮬레이터 시험, 프런트 빌드·시험은 실행하지 않았다. 이번 통합으로 main에 대해 달라지는 프런트 코드는 없다.
- CI와 Codex 리뷰는 push 전이라 이 HEAD에 대해 결과가 없다.
- `functions/lib` 추적본은 소스보다 뒤처져 있다. Functions 배포 시 predeploy build 결과가 쓰이는지 배포 전에 확인해야 한다.
- 실제 AI 호출, 운영 Firestore, 로그 쓰기, 배포, Slack 기록은 하지 않았다. 새 합성 시험도 추가하지 않았다.
- 모델·프롬프트·요금·인증·경로·Rules는 이번 통합에서 변경하지 않았다.

## 다음 행동

1. 브랜치 push 후 PR #292 CI·Codex 리뷰 확인.
2. 이 HEAD를 대상으로 독립 검토자 재판정.
3. 허대표님의 main 병합·배포 승인 후 필요한 함수만 명시적으로 배포하고 운영 확인.
