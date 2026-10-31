# PR #274 완료 작업 CC 검증 기록 (2026-10-31)

- 작성: 실행자 Claude Code(CC). 이 문서는 독립 검토 승인이 아니다.
- 검토 대상 코드 HEAD: `9b79a8bc507f586bf5c2c8c09830b503d21f3361`
- 원래 PR HEAD: `9fa88eada5b4dafec1ab2950d95f22119cae073c`
- 병합한 main: `693af514b30134defe243b3dc6c2ef78922cd380`
- 작업 위치: `/private/tmp/haru-completion-pr274-20261031`, branch `codex/completion-pr274`
- push·PR 댓글·병합·배포·운영 데이터 쓰기: 하지 않음

## 승인 범위

허대표님 지시 "완료바람", PR #274 범위 답변 "일반 작성칸도 처음 3줄로 변경". 질문칸과 원래 PR의 일반 작성칸을 처음 3줄로 만들고 기존 크기 조절 기능을 유지한다. 원래 `resize: none`인 칸에는 기능을 추가하지 않는다.

## 커밋

| 커밋 | 내용 |
|---|---|
| `e1a93cf4` | main 일반 merge. 충돌은 `ReadingAiChat.tsx` 1건이며 main의 안내문과 PR의 `rows={3}`을 함께 유지 |
| `9b79a8bc` | 독서 AI·하루LAW 세로 크기 조절 복원, 정책 시험 갱신, P3 T1·T2 반영 |

## 질문칸 크기 조절 상태

| 입력칸 | 처음 줄 수 | 크기 조절 | 근거 |
|---|---|---|---|
| 독서 AI 질문 | 3 | 세로 | 공통 `textarea` 스타일의 `resize: 'vertical'` 상속. 재정의 제거 |
| 하루LAW 질문 | 3 | 세로 | `resize: 'vertical'` 복원 |
| 공통 AI 질문 | 3 | 없음 | 원래 한 줄 `input`. 기능 추가 안 함 |
| 전망 직접 질문 | 3 | 없음 | 원래 `resize: 'none'` |

일반 작성칸은 `resize: 'vertical'`을 유지하며 `questionInputs.policy.test.cjs`가 8개 칸을 확인한다. 일기 상세는 원래 `resize: 'none'`이라 그대로다.

## 재검토 3회차 P3 반영

- T1 반영: `onKeyDown` 핸들러 배선을 정규식으로 확인.
- T2 반영: `ENTER_AFTER_COMPOSITION_GUARD_MS === 50` 확인.
- T3 미반영: 선택 사항이고 범위를 넓히지 않기 위해 제외.

## 검증 결과 (HEAD `9b79a8bc`)

| 항목 | 명령 | 결과 |
|---|---|---|
| 웹 빌드 | `npm --prefix frontend run build` | **미완료.** `prebuild`의 `validate:build-env`가 Firebase 환경변수 6개 누락으로 exit 1. Vite 빌드 시작 전 중단, 산출물 없음 |
| 더미 env 빌드 | 위 명령 앞에 더미값 지정 | **미실행.** 실행 환경 권한 거부 |
| 타입검사 | `npx tsc --noEmit` | **미실행.** 실행 환경 권한 거부 |
| Enter 단위 시험 | `npm run test:question-enter` | 21건 통과, 실패 0 |
| 입력칸 정책 시험 | `npm run test:question-inputs` | 통과 |
| 수정 영역 회귀 시험 | 20개 파일 `node --import tsx --test` | 219건 중 통과 218, 실패 0, 건너뜀 1 |
| 공백 검사 | `git diff --check origin/main HEAD -- frontend` | 지적 없음 |
| secret 패턴 | main 대비 추가 줄에서 Google API key, `sk-`, GitHub·Slack token, private key, service account 검색 | 0건 |

회귀 시험 파일: `readingAi`, `haruLawError`, `haruLawAttachmentCleanup`, `haruLawSave`, `lawEasyExplain.policy`, `formatRegistry`, `formatPolishRequest`, `formatPhotoUploadResult`, `ledgerAmount`, `ledgerEmptyExport`, `ledgerExportConsistency`, `plantDetectiveEdit`, `plantDetectivePhotoEdit`, `sayuMobileReadingUx.policy`, `originalSaveAutoTitle`, `sayuEditedTitle`, `writeBeforeFormat`, `householdSavePreview`, `householdCardImport`, `householdDashboard`.

건너뛴 1건은 `로컬 Rules: 없는 날짜 → 실제 저장, 기존 기록 병합, 전체 권한 정책 전후 비교`다. 실패가 없어 최신 main 대조 실행은 하지 않았다.

## 변이 확인

임시 복사본에서 실행했다. 저장소 파일은 바꾸지 않았다. 7개 모두 시험에서 잡혔다.

- `onKeyDown` → `onKeyUp`
- 보호 시간 50 → 25
- 독서 AI `resize: 'none'` 재도입
- 독서 AI 공통 스타일의 `resize` 제거
- 하루LAW `resize: 'none'` 재도입
- 독서 AI `rows` 2 복귀
- 공통 AI에 `resize: 'vertical'` 추가

## main 대비 변경 범위

코드 변경은 `frontend/` 11개 파일(458줄 추가, 18줄 삭제)이다. `functions/`, Rules, env, `mobile/` 변경은 없다. `FormatModal.tsx`, `ReadingAiChat.tsx`, `HaruLawPanel.tsx`, `ResultChatModal.tsx`, `PlantDetectivePage.tsx`의 main 대비 diff를 읽었고 PR의 줄 수·입력칸 변경만 남아 있다. FormatModal 가계부, 기록 AI, 제목 저장 코드는 되돌리지 않았다.

- `frontend/package.json`
- `frontend/src/app/assistants/haruLaw/HaruLawPanel.tsx`
- `frontend/src/app/components/FormatModal.tsx`
- `frontend/src/app/components/ReadingAiChat.tsx`
- `frontend/src/app/components/ResultChatModal.tsx`
- `frontend/src/app/pages/DiaryLearnPage.tsx`
- `frontend/src/app/pages/NovelStudio.tsx`
- `frontend/src/app/pages/PlantDetectivePage.tsx`
- `frontend/src/app/utils/questionEnterSubmit.ts`
- `frontend/test/questionEnterSubmit.test.mjs`
- `frontend/test/questionInputs.policy.test.cjs`

## 미확인과 제한

- `npm run build` 성공과 산출물은 확인하지 못했다.
- 타입검사는 이번 HEAD에서 실행하지 못했다.
- iOS Safari, Android, 실제 한글 IME, 실제 끌어서 크기 조절은 실기기·브라우저에서 확인하지 못했다.
- `/Users/heogyeongdae/Developer/HARU_작업위치.md`는 권한 거부로 읽지 못했다.
- 최신 HEAD의 Codex 재검토와 독립 Claude 재검토는 아직 없다.
- `frontend/node_modules`는 기존 설치본 symlink이고 `.gitignore`에 걸리지 않아 추적되지 않은 항목으로 남아 있다. 커밋하지 않았다.
