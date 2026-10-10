# Codex 실행 3 — 재검토 요청 원문 (PR #274 보완 커밋 1~4)

- 요청 댓글: https://github.com/hkd620-lab/haru2026/pull/274#issuecomment-6095869878 (작성 도구 호출 시각 2026-10-10T08:54:22Z)
- 검토 요청 대상 HEAD: `9b19efe537180f9d85de935b3b52223a50a54ff8` (Codex 실행 2의 검토 대상 `e4ff864e` 이후 변경)
- 작성자: CC(허대표님 지시로 PR #274 작업 브랜치에 fast-forward push). 댓글 끝에 Claude Code 출처 표기가 붙는다.
- 이전 Codex 지적 원문 2건과 독립 Claude 1회 지적 F1~F3·P3 원문, 반영 내역, 수정 diff 요약을 함께 전달했다. 결과 원문은 `2026-10-10-question-input-codex-3-result.md`에 이어서 보존한다.
- 아래 댓글 본문은 요약·수정 없이 그대로 보존한다.

## 요청 댓글 원문

@codex review

실행 3: 최신 검토 대상 HEAD `9b19efe5`. Codex 실행 2가 검토한 `e4ff864e`(주요 지적 없음) 이후 변경은 독립 Claude 검토 1회 "수정 후 승인"의 지적 F1~F3·P3을 반영한 4개 커밋(코드·시험)입니다. 허대표님 지시로 CC가 PR #274 작업 브랜치에 fast-forward push했습니다(5bb6758f → 9b19efe5, 강제 push 없음). 최신 변경 전체를 검토해 주세요.

이전 Codex 지적 2건(모두 `e4ff864e` 기준 해결, 실행 2 결과 https://github.com/hkd620-lab/haru2026/pull/274#issuecomment-6095062965 ):
1. Safari IME: https://github.com/hkd620-lab/haru2026/pull/274#discussion_r4236814726
2. activeLawQuery 검증 문서: https://github.com/hkd620-lab/haru2026/pull/274#discussion_r4236814730

## 독립 Claude 검토 1회 지적 원문 (대상 5bb6758f, 판정: 수정 후 승인, 원문 전체: https://github.com/hkd620-lab/haru2026/blob/048140ac/docs/reviews/2026-10-10-question-input-claude-independent-1-result.md )

> ### 2. 발견 사항
> - **F1 (P2, 코드 추정)**: `ResultChatModal.tsx:1120`의 `form?.requestSubmit()`은 Safari 16 미만에서 지원되지 않습니다.
>   - `vite.config.ts:14`가 `ios >= 13`을 지원 대상으로 둡니다.
>   - iOS 13~15에서는 Enter를 누르면 `preventDefault` 뒤에 TypeError가 나서 전송도 줄바꿈도 안 됩니다. 변경 전 input은 동작했습니다.
>   - 최소 수정: 핸들러에서 `void sendQuestion(question);`을 직접 호출합니다(기존 가드 그대로 사용).
> - **F2 (P2, 실행 확인)**: IME 방어의 실질 방어선이 `keyCode 229` 하나뿐입니다.
>   - `:1112`가 `compositionend`에서 ref를 바로 풉니다. Safari 순서(compositionend 다음 keydown)에서는 ref가 쓸모없습니다.
>   - Chromium 에뮬레이션 결과:
>     - Chrome 순서(229, isComposing)는 차단됩니다.
>     - Safari 순서에서 229면 차단됩니다.
>     - `compositionend` 직후 `keyCode 13`이 오면 전송됩니다(iOS가 229를 안 주는 경우).
>   - 해제를 `setTimeout(...,0)`으로 미루면 세 경우 모두 차단되고, 100ms 뒤의 Enter는 정상 전송됩니다(실행 확인).
>   - `compositionend`가 누락되면 ref가 고착되어 Enter가 줄바꿈만 넣습니다(실행 확인, 포커스 이동 후에도 유지). 발생 빈도는 모릅니다.
>   - 권장 수정:
>     ```
>     onCompositionEnd={() => { setTimeout(() => { questionComposingRef.current = false; }, 0); }}
>     onBlur={() => { questionComposingRef.current = false; }}
>     ```
> - **F3 (P2, 범위 확인)**: 장문 작성칸까지 3줄로 고정하고 resize를 없앴습니다.
>   - 간편 기록 8행→3줄(`FormatModal:4380`), 외국어일기 220px→3줄(`DiaryLearnPage:692`), 독서 본문·독서장 5행→3줄(`4010`·`5836`)입니다.
>   - 독서장은 AI 반영 텍스트가 맨 끝에 붙어서(`applyReadingAiReference`), 3줄 창 밖에 숨습니다.
>   - `final-verification.md`는 "범위 질문에 답이 없어 해석해 진행"했다고 밝히는데, PR 본문에는 이 사실이 없습니다.
>   - 허대표님 확인 근거를 남기거나, 작성칸만 `resize:vertical`을 유지하세요.
> - **P3**
>   - 모바일 소프트 키보드는 Shift+Enter가 없어 줄바꿈을 못 넣습니다. `enterKeyHint`와 Enter 안내 문구도 없습니다.
>   - 전송 버튼(42px)이 89px 입력칸 옆에서 상단 정렬됩니다.
>   - 3줄이 아닌 채 남은 유사 입력칸:
>     - `PlantDetectivePage:3668`, `PetHealthVaccinePage:208`(rows 2)
>     - `GyeongdaePreviewPage:699`, `AssistantOnboardingDetailPage:167`(rows 4)
>     - `NovelStudio:407`·`:1198`
>     - 법률 메모 3곳(min-h-24~28)
>     - 성장타임라인 사진 설명
>     - 제목의 "모든"은 과장이라 제외 목록을 명시하는 편이 좋습니다. `HaruRawPage`는 금지 파일(AGENTS.md:42)이고 `ExportModal`·`RecordModal`은 import가 없어, 제외는 정당합니다.
>   - PR에 UI·키 처리 테스트가 없어 "136개 검증"은 재현할 수 없습니다. 저장소 관례인 `*.policy.test.cjs` 추가를 권장합니다.

## 반영 (커밋별)
- `1a1440b7` F1: Enter가 `sendQuestion(question)`을 직접 호출. `requestSubmit` 제거.
- `9f963f50` F2: `EnterSubmitGuard`(`frontend/src/app/utils/questionEnterSubmit.ts`)로 분리. 조합 중·keyCode 229는 그대로 두고, compositionend 직후 50ms 안의 Enter는 이벤트 timeStamp 차이로 확정 Enter로 보아 전송도 줄바꿈도 하지 않음. blur에서 조합 표시와 직전 종료 기록 해제. 시험 `frontend/test/questionEnterSubmit.test.mjs` 11건. (권장안의 `setTimeout(0)` 대신 timeStamp 방식을 택한 이유: 핸들러 실행 지연·이벤트 순서와 무관하게 판단하고 단위 시험이 가능합니다.)
- `924087a1` F3: 시작 높이 rows=3 유지, 변경 전 크기 조절이 가능했던 장문 작성칸 7곳만 `resize: 'vertical'` 복원. 질문칸 4곳은 3줄 고정(resize 없음) 유지. 소스 정책 시험 `frontend/test/questionInputs.policy.test.cjs`. PR 본문에 범위 해석·제외 목록 기재.
- `9b19efe5` P3: 현재 라우터·코드로 판별해 식물탐정 "오늘의 관찰" 자유 메모만 rows 2→3. 나머지 후보는 질문칸도 초기 작성칸도 아니어서 제외(사유는 PR 본문과 커밋 메시지).
- 미반영 P3(이번 범위 밖): 모바일 Enter 안내 문구·`enterKeyHint`, 전송 버튼 정렬, PR 제목의 "모든" 표현.

<details>
<summary>수정 diff (frontend/src, 5bb6758f..9b19efe5)</summary>

```diff
--- a/frontend/src/app/components/ResultChatModal.tsx
+++ b/frontend/src/app/components/ResultChatModal.tsx
@@ import
+import { EnterSubmitGuard } from '../utils/questionEnterSubmit';
@@ state
-  const questionComposingRef = useRef(false);
+  const [questionEnterGuard] = useState(() => new EnterSubmitGuard());
@@ textarea handlers
-              onCompositionStart={() => { questionComposingRef.current = true; }}
-              onCompositionEnd={() => { questionComposingRef.current = false; }}
+              onCompositionStart={() => questionEnterGuard.compositionStart()}
+              onCompositionEnd={(event) => questionEnterGuard.compositionEnd(event.timeStamp)}
+              onBlur={() => questionEnterGuard.reset()}
               onKeyDown={(event) => {
-                if (
-                  event.key === 'Enter' && !event.shiftKey &&
-                  !questionComposingRef.current && !event.nativeEvent.isComposing &&
-                  event.nativeEvent.keyCode !== 229
-                ) {
-                  event.preventDefault();
-                  event.currentTarget.form?.requestSubmit();
-                }
+                const decision = questionEnterGuard.decide({
+                  key: event.key,
+                  shiftKey: event.shiftKey,
+                  isComposing: event.nativeEvent.isComposing,
+                  keyCode: event.nativeEvent.keyCode,
+                  timeStamp: event.timeStamp,
+                });
+                if (decision === 'pass') return;
+                event.preventDefault();
+                if (decision === 'send') void sendQuestion(question);
               }}
--- /dev/null
+++ b/frontend/src/app/utils/questionEnterSubmit.ts
+export const ENTER_AFTER_COMPOSITION_GUARD_MS = 50;
+export class EnterSubmitGuard {
+  private composing = false;
+  private compositionEndedAt: number | null = null;
+  compositionStart(): void { this.composing = true; }
+  compositionEnd(timeStamp: number): void { this.composing = false; this.compositionEndedAt = timeStamp; }
+  reset(): void { this.composing = false; this.compositionEndedAt = null; }
+  decide(input: EnterKeyInput): EnterKeyDecision {
+    if (input.key !== 'Enter' || input.shiftKey) return 'pass';
+    if (this.composing || input.isComposing || input.keyCode === 229) return 'pass';
+    if (this.compositionEndedAt !== null) {
+      const sinceCompositionEnd = input.timeStamp - this.compositionEndedAt;
+      if (sinceCompositionEnd >= 0 && sinceCompositionEnd < this.guardMs) return 'ignore';
+    }
+    return 'send';
+  }
+}
--- FormatModal.tsx (6곳) / DiaryLearnPage.tsx (1곳)
-  resize: 'none'
+  resize: 'vertical'
--- PlantDetectivePage.tsx (자유 메모)
-  rows={2}
+  rows={3}
```
(요약본입니다. 전체 diff는 `git diff 5bb6758f 9b19efe5 -- frontend`)
</details>

## 검증 (CC 직접 실행, 9b19efe5)
오프라인 전체 시험 48개 파일이 5bb6758f와 같은 결과(신규 2개 통과, 기존 실패 2개는 기준 main에서도 동일), `tsc --noEmit` 신규 오류 0(기준과 같은 250건, 전부 미사용 `ExportModal.tsx`), 더미 Firebase 변수로 `vite build` 성공, 실제 JSX·앱 CSS Chromium 시험 267/267(Enter 전송·Shift+Enter·`requestSubmit` 없는 브라우저·Chrome/Safari 순서·compositionend 직후 Enter·blur 해제 포함). 실기기 iOS/Android 한글 확정 Enter와 로그인 후 전체 화면 E2E는 미확인입니다. 병합·운영 배포는 실행하지 않았습니다.

---
_Generated by [Claude Code](https://claude.ai/code)_
