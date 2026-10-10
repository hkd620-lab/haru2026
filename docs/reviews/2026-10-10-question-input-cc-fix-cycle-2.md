# PR #274 보완 사이클 2 — CC 구현·검증 기록 (HEAD 9fa88ead)

- 작성 시각(UTC): 2026-10-10T09:25Z
- 대상: PR #274 작업 브랜치 `codex-question-input-three-lines` `9b19efe537180f9d85de935b3b52223a50a54ff8` → `9fa88eada5b4dafec1ab2950d95f22119cae073c` (fast-forward push, 강제 push 없음, 기준 main `69c371cce46f39f8720283167c037d099fede7af`).
- 근거: 독립 Claude 재검토 2회차 "수정 후 승인"의 새 지적 N1~N3(`2026-10-10-question-input-claude-independent-2-result.md`). 허대표님이 지시한 "정책 8.1 반복/멈춤 조건 적용"에 따라 CC가 수정 → Codex 재검토 → 독립 검토자 재검토를 이어간다.
- 보안 작업 기록과 분리된 PR 검토·보완 증거다(보안 세부는 공개 저장소에 두지 않는다).
- 병합·운영 배포는 실행하지 않았다.

## 1. 작업 방식
- 사이클 1과 같은 격리 worktree(`cc-fix-274`)에서 작업했다. push 직전 원격 PR 브랜치가 여전히 `9b19efe5`이고 로컬 브랜치가 그 후손이며 작업 트리가 깨끗함을 확인한 뒤 `git push origin cc-fix-274:refs/heads/codex-question-input-three-lines`로 올렸다. 한 변경당 한국어 커밋 1개, 파일은 개별 stage.

## 2. 변경 (2커밋)
| 커밋 | 지적 | 변경 파일 | 내용 |
|---|---|---|---|
| `cf2f340b` | N1 (P2) | `utils/questionEnterSubmit.ts`, `test/questionEnterSubmit.test.mjs` | 보호 비교를 `Math.abs(sinceCompositionEnd) < guardMs`로 바꿈. keydown이 compositionend보다 앞선 경우도 50ms 안이면 확정 Enter로 보아 전송도 줄바꿈도 하지 않음. 시각 역전을 전송으로 고정하던 시험 #10을 "-10ms 무시 / 경계(±50ms)·-100ms 전송" 2개로 교체 |
| `9fa88ead` | N2 (P3) | `utils/questionEnterSubmit.ts`, `components/ResultChatModal.tsx`, `test/questionEnterSubmit.test.mjs`, `test/questionInputs.policy.test.cjs` | onKeyDown 본문을 `handleQuestionEnterKeyDown(guard, event, send)`로 옮기고 컴포넌트는 `sendQuestion(question)`을 콜백으로 넘겨 호출만 함. 단위 시험 12→20건, 정책 시험에 연결 문자열·가드 한 번 생성·보존 속성(공통 질문칸 value·disabled, 독서 AI 질문 maxLength·disabled, AI 참고 메모 제안 4줄, 일기 상세 3줄·resize 없음) 추가 |
| (코드 없음) | N3 (P3) | PR 본문 | 아래 3절의 정정을 PR 본문 "범위 해석과 제외"에 적음 |

보호 시간(50ms)은 바꾸지 않았다. WebKit에서 키보드 이벤트는 플랫폼 입력 시각을, 조합 이벤트는 생성 시각을 쓴다는 독립 검토자의 추정이 맞다면 두 시각의 차이가 메인 스레드 지연에 따라 50ms를 넘을 수 있다. 이 경우는 keyCode 229(Safari 확정 Enter에서 기대)가 방어선이고, 229를 주지 않는 환경에서의 실제 시각 차이는 실기기 확인이 필요하다.

## 3. N3 정정 (이력 보존을 위해 기존 파일·커밋은 고치지 않음)
- 사이클 1 기록 `2026-10-10-question-input-cc-fix-cycle-1.md`의 `924087a1` 행, Codex 실행 3 요청 댓글(`2026-10-10-question-input-codex-3-request.md`), 커밋 `924087a1`의 메시지는 "질문칸 4곳은 3줄 고정(resize 없음) 유지"라고 적었다. 정확한 사실은 다음과 같다.
  - 공통 AI 질문: 변경 전 한 줄 `<input>`이었고 이번 PR에서 `<textarea>`가 되어 resize 없음.
  - 전망 직접 질문(`NovelStudio` motiveCustom): 변경 전에도 resize 없음.
  - 독서 AI 질문·하루LAW 질문: 변경 전에는 세로 크기 조절이 **가능**했고 이번 PR이 질문칸 3줄 고정 의도로 **없앴다**. "유지"가 아니라 "변경"이다. 이 두 칸의 크기 조절 제거는 허대표님 확인 사항으로 PR 본문에 표시했다.

## 4. 검증 (CC 직접 실행, 9fa88ead 기준)
- 단위·정책 시험: `test:question-enter` 20/20, `test:question-inputs` 통과. 오프라인 전체 시험 48개 파일이 9b19efe5와 파일별 결과 집합 동일(node:test 합계 통과 228·실패 0, 기존 실패 2개는 기준 main에서도 동일). PR 지정 회귀 6개 파일 45/45.
- 변이 시험: 가드·배선 함수 16개, 컴포넌트 배선 8개, 입력칸 속성 5개, 총 29개를 모두 시험이 잡았다(`…-cc-repro-fix2/mutants-cycle2.txt`). 독립 검토자의 2회차 변이 시험에서 살아남던 핸들러 배선 변이 7개와 `isComposing` 제거가 모두 죽는다.
- 타입·빌드: `tsc --noEmit` 기준 main·5bb6758f·9b19efe5와 같은 250건(모두 미사용 `ExportModal.tsx`), 신규 오류 0. `git diff --check` 깨끗. 더미 Firebase 변수로 `npm run build` 성공(1분 6초).
- Chromium 시험 273/273(390px·1280px): 13개 입력칸 초기 3줄, 3줄 입력 무클리핑, 15줄·긴 문단 내부 스크롤, 작성칸 세로 확장·질문칸 크기 고정, 질문 폼의 Enter·Shift+Enter·`requestSubmit` 없는 브라우저·IME 순서·blur 해제, 그리고 N1 재현: CDP로 keydown의 플랫폼 시각을 compositionend보다 2.6ms·10ms 앞서게 보낸 경우 전송하지 않고(keydown.timeStamp < compositionend.timeStamp임을 함께 확인), 100ms 앞선 경우는 전송한다. 같은 시험을 직전 코드(9b19efe5)에서 돌리면 앞의 두 경우가 전송되어 2건이 실패한다(`results-cycle2-oldcode-9b19efe5.json`).
- CI: 9fa88ead의 결과는 push 직후 확인 대상이며 아래 6절에 이어서 적는다.

## 5. 재검토 요청 (정책 8.1)
- Codex 실행 4: PR 댓글 https://github.com/hkd620-lab/haru2026/pull/274#issuecomment-6096036957 (원문 `…-codex-4-request.md`, 2026-10-10T09:16:42Z). 독립 Claude 2회차 지적 원문과 반영 내역, 수정 diff 요약을 전달했다.
- 독립 Claude 재검토 3회차: 같은 독립 에이전트를 재개해 요청(원문 `…-claude-independent-3-request.md`, 2026-10-10T09:17:00Z). 읽기 전용.
- 8.1 적용: 같은 건의 "수정 후 승인"은 지금까지 2회(1회차 5bb6758f, 2회차 9b19efe5)다. 3회차가 다시 "수정 후 승인"이면 누적 3회로 상한 이내이며 CC가 한 번 더 수정할 수 있지만, 그 다음에도 "수정 후 승인"이면 4회가 되어 CC는 판정하지 않고 허대표님께 보고한다. "재설계"이거나 CC가 지적을 받아들이지 않으려는 경우도 보고 대상이다.
- 결과 원문은 별도 파일(`…-claude-independent-3-result.md`, `…-codex-4-result.md`)에 이어서 보존한다.

## 6. 남은 확인·위험
- 실기기 iOS 16+ Safari·Android 키보드의 한글 확정 Enter(compositionend와 Enter가 50ms 안에 오는 환경에서 첫 Enter가 무시될 수 있음), iOS 13~15의 Enter, 로그인 후 전체 화면(프리뷰) E2E는 미확인이다.
- 작성자 해석(작성칸까지 포함)과 독서 AI·하루LAW 질문칸의 크기 조절 제거에 대한 허대표님 확인은 아직 없다.
- 미반영 P3: 모바일 Enter 안내 문구·`enterKeyHint`, 전송 버튼 정렬, PR 제목의 "모든" 표현.
