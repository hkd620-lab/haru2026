# PR #274 완료 후속 작업 CC 검증 기록 (2026-10-31)

- 작성: 실행자 Claude Code(CC). 이 문서는 독립 검토 승인이 아니다.
- 검토 대상 코드 HEAD: `6081aef4` (이전 코드 HEAD `9b79a8bc`, 이전 최종 HEAD `87e3da36`)
- 작업 위치: `/private/tmp/haru-completion-pr274-20261031`, branch `codex/completion-pr274`
- push·PR 댓글·병합·배포·운영 데이터 쓰기: 하지 않음
- 기존 기록 `cc-validation.md`는 수정하지 않았다. 이 문서가 그 기록의 빌드·타입검사·회귀 항목을 이어받는다.

## 범위 정정

허대표님 답변 "일반 작성칸도 처음 3줄로 변경"에는 일반 글쓰기의 첫 입력칸도 포함된다. 이전 지시가 원래 PR 대상에 한정했던 점을 바로잡은 후속 지시다. 새 기능이 아니며 화면 구조·라우터·저장 동작은 바꾸지 않았다.

## 변경

| 파일 | 내용 |
|---|---|
| `frontend/src/app/pages/RecordPage.tsx` | `aria-label="기록 내용"` 입력칸 `rows={9}` → `rows={3}`. `resize: 'vertical'` 유지 |
| `frontend/test/questionInputs.policy.test.cjs` | 장문 작성칸 목록에 `일반 글쓰기 첫 입력칸` 추가. 3줄·세로 크기 조절 확인 |

## 검증 결과

빌드와 시험은 커밋 전 작업 트리에서 실행했다. 변이 확인은 빌드 뒤에 했고 원상복구했으며, 커밋 내용은 빌드한 내용과 같다.

| 항목 | 명령 | 결과 |
|---|---|---|
| 더미 env 빌드 | 지시된 `env VITE_FIREBASE_...=더미 npm run build` (`frontend`) | **통과.** env 검증 통과, 3559개 모듈 변환, `built in 1m 11s`, `dist/index.html` 생성 확인 |
| 타입검사 | `npx tsc --noEmit` | **실패(환경).** 실행되지 않음. `frontend/package.json`에 `typescript`가 없고 `npm ls typescript`도 비어 있어 npx가 "This is not the tsc command" 안내 후 exit 1. 코드 타입 오류 여부는 **미확인** |
| Enter 단위 시험 | `npm run test:question-enter` | 21건 통과, 실패 0 |
| 입력칸 정책 시험 | `npm run test:question-inputs` | 통과 |
| 공백 검사 | `git diff --check` | 지적 없음 |
| secret 패턴 | 이 폴더의 검토 문서에서 Google API key, `sk-`, GitHub·Slack token, private key 머리글 검색 | 0건 |

더미값은 명령 환경으로만 넣었다. 실제 서비스 키가 아니며 `.env`는 만들지 않았다. `frontend/dist`는 더미값 산출물이라 **배포에 쓰면 안 된다.**

## 기록 작성 영향 회귀 시험

`RecordPage`를 참조하는 시험 8개와 `writeBeforeFormat`을 실행했다.

| 묶음 | 결과 |
|---|---|
| `writingDraftLifecycle`, `writeBeforeFormat`, `householdCashEntry`, `assistantEntryScroll.policy`, `haruLawError`, `haruLawSave`, `lawEasyExplain.policy` | 34건 중 통과 33, 실패 0, 건너뜀 1 |
| `assistantSavedResultOpen` | **19건 중 통과 18, 실패 1** |
| `statsStorage.policy` | **실패.** 74번째 줄 assert에서 중단되어 그 뒤 검사는 실행되지 않음 |

건너뛴 1건은 이전과 같은 `로컬 Rules: 없는 날짜 → 실제 저장, 기존 기록 병합, 전체 권한 정책 전후 비교`다.

이전 20개 회귀 묶음에는 위 실패 파일 2개가 들어 있지 않아 이번에 처음 드러났다.

### 실패 2건

1. `assistantSavedResultOpen`의 `SAYU opens the exact future essay among same-date siblings`
   - `ReferenceError: isSpecialDayRecord is not defined`
   - `SayuPage.tsx`의 `openFormatSayu`가 쓰는 `isSpecialDayRecord`를 시험 실행 환경이 넘기지 않는다.
2. `statsStorage.policy.test.cjs:74`
   - 시험 정규식은 의존성 배열을 `[isOpen, format, recordId]`로 기대하는데, `FormatModal.tsx:517`은 `[isOpen, format, recordId, user?.uid]`다.

### main 대조

같은 명령으로 main을 실행한 대조는 **하지 못했다.** main 스냅샷의 압축 해제가 실행 환경 권한으로 막혔다. 대신 git으로 입력을 비교했다.

- `git diff --stat 693af514 HEAD`(후속 커밋 전 기준): `assistantSavedResultOpen.test.mjs`, `statsStorage.policy.test.cjs`, `SayuPage.tsx`, `RecordPage.tsx` 모두 차이 없음.
- `git grep`: main `693af514`의 `FormatModal.tsx:517`도 `[isOpen, format, recordId, user?.uid]`이고 시험 74번째 줄도 같다.

따라서 두 실패는 main에 이미 있던 것으로 **판단**한다. 실행으로 확인한 사실은 아니다. 이번 `rows` 변경은 두 실패의 원인과 관계없다. 범위 밖이라 고치지 않았다.

## 변이 확인

저장소 파일을 잠시 바꿔 실행한 뒤 원상복구했다. 2개 모두 시험에서 잡혔고, 복구 뒤 시험은 통과했다.

- `RecordPage` `rows={9}` 복귀 → `일반 글쓰기 첫 입력칸: rows={3}이어야 합니다`
- `RecordPage` `resize: 'none'` → `일반 글쓰기 첫 입력칸: 장문 작성칸은 resize:vertical이어야 합니다`

## 이전 실행 원문 보존

| 파일 | 원본 |
|---|---|
| `cc-first-run-prompt.txt` | `/private/tmp/haru-completion-control-20261031/pr274-prompt.txt` |
| `cc-first-run-result.json` | `/private/tmp/haru-completion-control-20261031/pr274-result.json` |

`cp`가 작업 폴더 밖 원본이라 권한으로 막혀, Read로 읽은 내용을 Write로 옮겨 적었다. 바이트 단위 일치는 확인하지 못했다. JSON은 파싱되며 세션 ID와 `permission_denials` 10건이 그대로다.

## 미확인과 제한

- 타입검사는 이번에도 확인하지 못했다. TypeScript가 설치돼 있지 않고, 의존성 추가는 지시 범위가 아니라 하지 않았다.
- 실패 2건의 main 실행 대조는 하지 못했다.
- 이전 20개 회귀 묶음 전체는 다시 돌리지 않았다. `rows` 변경은 그 묶음이 읽는 다른 소스를 바꾸지 않는다.
- iOS Safari, Android, 실제 한글 IME, 실제 끌어서 크기 조절은 실기기·브라우저에서 확인하지 못했다.
- 최신 HEAD의 Codex 재검토와 독립 Claude 재검토는 아직 없다.
- `frontend/node_modules` symlink는 추적되지 않은 항목으로 남아 있고 커밋하지 않았다.
- 대조용 임시 파일 `/tmp/haru-pr274-main-693af514.tar`가 작업 폴더 밖에 남아 있다.
