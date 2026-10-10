# Codex 실행 4 — 재검토 요청 원문 (PR #274 보완 커밋 5~6)

- 요청 댓글: https://github.com/hkd620-lab/haru2026/pull/274#issuecomment-6096036957 (작성 도구 호출 시각 2026-10-10T09:16:42Z)
- 검토 요청 대상 HEAD: `9fa88eada5b4dafec1ab2950d95f22119cae073c` (Codex 실행 3의 검토 대상 `9b19efe5` 이후 변경 2커밋)
- 작성자: CC(허대표님 지시로 PR #274 작업 브랜치에 fast-forward push). 댓글 끝에 Claude Code 출처 표기가 붙는다.
- 독립 Claude 2회차 지적 N1~N3 원문(과 N2가 참조하는 시험 평가 부분), 반영 내역, 수정 diff 요약을 함께 전달했다. 결과 원문은 `2026-10-10-question-input-codex-4-result.md`에 이어서 보존한다.
- 아래 댓글 본문은 요약·수정 없이 그대로 보존한다.

## 요청 댓글 원문

@codex review

실행 4: 최신 검토 대상 HEAD `9fa88ead`. Codex 실행 3이 검토한 `9b19efe5`(주요 지적 없음, https://github.com/hkd620-lab/haru2026/pull/274#issuecomment-6095901252 ) 이후 변경은 독립 Claude 재검토 2회차 "수정 후 승인"의 지적 N1~N3을 반영한 2개 커밋(코드·시험)입니다. 허대표님 지시로 CC가 PR #274 작업 브랜치에 fast-forward push했습니다(9b19efe5 → 9fa88ead, 강제 push 없음). 최신 변경 전체를 검토해 주세요.

이전 Codex 지적 2건(실행 1, `e4ff864e` 기준 해결): https://github.com/hkd620-lab/haru2026/pull/274#discussion_r4236814726 , https://github.com/hkd620-lab/haru2026/pull/274#discussion_r4236814730 . 독립 Claude 1회차 지적 F1~F3·P3 원문과 반영은 실행 3 요청 댓글(https://github.com/hkd620-lab/haru2026/pull/274#issuecomment-6095869878 )에 있습니다.

## 독립 Claude 재검토 2회차 지적 원문 (대상 9b19efe5, 판정: 수정 후 승인 2회차, 원문 전체: https://github.com/hkd620-lab/haru2026/blob/83b77f61/docs/reviews/2026-10-10-question-input-claude-independent-2-result.md )

> ### 2. 새 지적
> - **N1 (P2, 실행 확인)**: `frontend/src/app/utils/questionEnterSubmit.ts:52`의 `sinceCompositionEnd >= 0 &&`
>   - 50ms 보호는 keydown 시각이 compositionend보다 늦거나 같을 때만 작동합니다. 단위 시험 #10(`questionEnterSubmit.test.mjs:87-91`)은 시각이 역전된 경우를 'send'로 고정합니다.
>   - 재현 조건: compositionend 직후 keydown(Enter, keyCode 13, isComposing=false)이 오고 keydown.timeStamp가 compositionend보다 앞설 때입니다.
>   - Chromium에서 실제 컴포넌트 JSX와 실제 가드로 확인했습니다. keydown의 플랫폼 시각을 compositionend보다 2.6ms 앞서게 보내면 `sent=["글"]`로 전송됩니다.
>   - 같은 시나리오에서 `Math.abs` 변형은 차단됩니다. 자연 시각(+0.8ms)에서는 양쪽 모두 무시됩니다.
>   - WebKit은 키보드 이벤트에 플랫폼 입력 시각을, 조합 이벤트에 생성 시각을 쓰는 구조로 보여 Safari 순서에서 역전이 흔할 수 있습니다(코드 추정, 실기기 미확인).
>   - keyCode 229를 주지 않는 환경에서 이 규칙이 걸리지 않으면 1회차 F2의 위험이 그대로 남습니다.
>   - 최소 수정: `Math.abs(sinceCompositionEnd) < this.guardMs`로 바꾸고, 시험 #10을 −10ms면 'ignore', −100ms면 'send'로 교체합니다.
>   - 이 변경 시 나머지 단위 시험 10건은 그대로 통과합니다(변이 실행).
> - **N2 (P3)**: 시험이 핸들러 배선을 고정하지 못합니다(4번 참고).
> - **N3 (P3)**: 커밋 `924087a1`은 하루LAW·독서 AI 질문칸이 resize 없음을 "유지"한다고 적었습니다. 두 칸은 변경 전 resize vertical이었고 이번 PR이 제거했습니다. 구분 자체는 의도이니 문구만 정정하면 됩니다.
>
> ### 4. 범위·제외 목록과 시험 평가 (N2가 참조하는 부분)
> - **변이 시험(복사본, 45개 중 33개 사망)**:
>   - 가드 단위 변이 13개 중 12개가 사망했습니다. 생존은 `isComposing` 제거 1개이고, 다른 조건과 중복입니다.
>   - 핸들러 배선 변이 7개는 모두 생존했습니다. 정책 시험은 문자열만 확인하기 때문입니다.
>     - `preventDefault` 제거
>     - 'ignore'에서도 전송
>     - 'pass' 조기 반환 제거
>     - `shiftKey`·`key` 배선
>     - 가드를 매 렌더 재생성
>     - 윈도 0
>   - 정책 시험은 AI 참고 메모 제안 `rows`, 일기 상세 `rows`, 독서 AI `maxLength`, 공통 질문칸 `disabled` 변이도 놓칩니다.
>   - 즉 Enter 전송과 Shift+Enter 줄바꿈의 통합 동작은 시험이 고정하지 못합니다. onKeyDown 본문을 유틸의 순수 함수로 옮겨 시험하는 것을 권장합니다.
>   - CI는 빌드만 돌립니다.

## 반영 (커밋별)
- `cf2f340b` N1: 두 이벤트 시각 차이의 절댓값이 50ms 안이면 확정 Enter로 보아 전송도 줄바꿈도 하지 않음(`Math.abs(sinceCompositionEnd) < this.guardMs`). 시각 역전을 전송으로 고정하던 시험은 "-10ms는 무시, 보호 시간 경계(±50ms)와 -100ms는 전송" 시험 2개로 교체.
- `9fa88ead` N2: onKeyDown 본문을 `handleQuestionEnterKeyDown(guard, event, send)`(`frontend/src/app/utils/questionEnterSubmit.ts`)로 옮기고 컴포넌트는 `sendQuestion(question)`을 넘겨 호출만 함. 단위 시험 20건(pass/ignore/send별 기본 동작 차단·전송 횟수, 조합 중·compositionend 직후·경계·blur 초기화·연속 Enter), 정책 시험은 연결 문자열과 함께 공통 질문칸 잠금·독서 AI 질문 글자 수 제한·AI 참고 메모 제안 4줄·일기 상세 3줄 등을 확인.
- N3: 코드 변경 없음. 커밋 메시지는 이력 보존을 위해 고치지 않고 PR 본문 "범위 해석과 제외"에 정확히 적었습니다(공통 AI 질문은 변경 전 `input`, 전망 직접 질문은 변경 전에도 resize 없음, 독서 AI 질문·하루LAW 질문은 변경 전 세로 크기 조절이 가능했으나 이 PR이 없앰 — 허대표님 확인 사항으로 표시).

<details>
<summary>수정 diff (frontend/src, 9b19efe5..9fa88ead)</summary>

```diff
--- a/frontend/src/app/utils/questionEnterSubmit.ts
+++ b/frontend/src/app/utils/questionEnterSubmit.ts
@@ EnterSubmitGuard.decide
       const sinceCompositionEnd = input.timeStamp - this.compositionEndedAt;
-      if (sinceCompositionEnd >= 0 && sinceCompositionEnd < this.guardMs) return 'ignore';
+      if (Math.abs(sinceCompositionEnd) < this.guardMs) return 'ignore';
@@ 추가
+export type QuestionKeyDownEvent = {
+  key: string;
+  shiftKey: boolean;
+  timeStamp: number;
+  nativeEvent: { isComposing: boolean; keyCode: number };
+  preventDefault: () => void;
+};
+export function handleQuestionEnterKeyDown(
+  guard: EnterSubmitGuard,
+  event: QuestionKeyDownEvent,
+  send: () => void,
+): EnterKeyDecision {
+  const decision = guard.decide({
+    key: event.key,
+    shiftKey: event.shiftKey,
+    isComposing: event.nativeEvent.isComposing,
+    keyCode: event.nativeEvent.keyCode,
+    timeStamp: event.timeStamp,
+  });
+  if (decision === 'pass') return decision;
+  event.preventDefault();
+  if (decision === 'send') send();
+  return decision;
+}
--- a/frontend/src/app/components/ResultChatModal.tsx
+++ b/frontend/src/app/components/ResultChatModal.tsx
-import { EnterSubmitGuard } from '../utils/questionEnterSubmit';
+import { EnterSubmitGuard, handleQuestionEnterKeyDown } from '../utils/questionEnterSubmit';
 ...
               onKeyDown={(event) => {
-                const decision = questionEnterGuard.decide({ ... });
-                if (decision === 'pass') return;
-                event.preventDefault();
-                if (decision === 'send') void sendQuestion(question);
+                handleQuestionEnterKeyDown(questionEnterGuard, event, () => { void sendQuestion(question); });
               }}
```
(요약본입니다. 전체 diff는 `git diff 9b19efe5 9fa88ead -- frontend`)
</details>

## 검증 (CC 직접 실행, 9fa88ead)
오프라인 전체 시험 48개 파일이 직전과 파일별 결과 집합이 같고(node:test 합계 통과 228·실패 0, 기존 실패 2개는 기준 main에서도 동일), PR 지정 회귀 6개 파일 45/45, `tsc --noEmit` 신규 오류 0(기준과 같은 250건), `git diff --check` 깨끗, 더미 Firebase 변수로 `npm run build` 성공(1m 6s). 직접 만든 변이 29개를 시험이 모두 잡았고, 실제 JSX·앱 CSS Chromium 시험 273/273에는 keydown 시각을 compositionend보다 2.6ms·10ms 앞서게 보낸 경우 전송하지 않고 100ms 앞선 경우 전송하는 시나리오가 포함됩니다(직전 코드에서는 앞의 두 경우가 전송됨). 실기기 iOS/Android 한글 확정 Enter와 로그인 후 전체 화면 E2E는 미확인입니다. 병합·운영 배포는 실행하지 않았습니다.

---
_Generated by [Claude Code](https://claude.ai/code)_
