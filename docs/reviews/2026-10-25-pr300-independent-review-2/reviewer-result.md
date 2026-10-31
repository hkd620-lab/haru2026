## PR #300 독립 재검토 2: 결과

- **대상:** HEAD `e2b90ca0`, 기준 main `535cae73`. 현재 작업 트리를 Read/Grep으로만 읽었습니다. git, 테스트, 빌드는 실행하지 않았습니다.
- **먼저 읽은 원문:** 검토 1의 `prompt.md`, `reviewer-result.md`, `result.json`, Codex 색인 1, `codex-review-comments.json`. 이 다섯 개를 모두 읽었습니다. 검토 1 판정은 **'수정 후 승인'**이었고, 차단 지적 B1과 비차단 메모 6건이 있었습니다. 수정 후 승인은 지금까지 1회입니다.

---

### 1. 이전 지적과 이번 수정 대조

**B1 / Codex P2-1: 내부 AI 메모를 반영하면 외부 참고자료가 사라짐 → 해소**

```ts
// services/readingAiCore.ts:34-45
export function mergeInAppReadingReference(rawReference, bookId, selected, memo) {
  const previous = parseReadingAiReference(rawReference, bookId);
  const external = (previous?.selectedAnswers || []).filter((item) => item.answer.startsWith('[외부 AI 답변 · '));
  const answers = [...external];
  for (const item of selected) { if (!answers.some(...)) answers.push(item); }
  if (answers.length > 3) throw new Error('외부 참고자료와 합쳐 답변 3개를 넘습니다. ...');
  const aiMemo = [...external.map((item) => item.answer), memo.trim()].filter(Boolean).join('\n\n');
  if (aiMemo.length > 4000) throw new Error('외부 참고자료와 합쳐 4,000자를 넘습니다. ...');
  return { selected: answers, aiMemo };
}
```

```tsx
// components/ReadingAiChat.tsx:113-122
try {
  const merged = mergeInAppReadingReference(reference, bookId, chat.selected, chat.proposal);
  onApply(merged.selected, merged.aiMemo);
  setApplied(true);
} catch (error) { setApplyError(...); }
```

- **반영 흐름:** `FormatModal.tsx:4236-4239`의 `onApply`는 받은 값을 `applyReadingAiReference`에 그대로 넘깁니다. 이제 외부 가져오기와 내부 반영 모두 합친 값을 넘기므로 두 경로가 같은 방식으로 동작합니다. `reference` prop은 그 순간의 `formData.reading_ai_context`입니다.
- **재편집:** 저장된 회차를 다시 편집하는 경우도 해소됐습니다. `prepareReadingEdit`(`FormatModal.tsx:3161`)가 복원한 값에서 외부 답변을 다시 읽기 때문입니다.
- **한도 초과:** 예외가 나면 `onApply`와 `setApplied`에 도달하지 않습니다. 그래서 기존 참고자료와 제안 메모가 그대로 남습니다.
- **출처와 독서장:** 외부 답변의 출처 머리표는 aiMemo에 원문 그대로 남습니다. 독서장 본문에는 외부 원문이 들어가지 않습니다(테스트 63행).
- **회귀 테스트:** `frontend/test/readingAi.test.mjs:54-79`에 추가됐습니다. 다룬 순서는 외부 → 내부 반영, 다시 내부 반영, 다시 외부 가져오기입니다. 다른 책 거부와 3개·4,000자 초과 거부도 확인하고, 실패해도 원본이 바뀌지 않는지 봅니다. 검토 1에서 요구한 두 테스트가 모두 들어 있습니다. 테스트는 17개로, 보고된 17/17과 맞습니다.

**Codex P2-2: 긴 외부 답변이 자동으로 잘림 → 해소**

- `ReadingAiChat.tsx:97`의 외부 답변 textarea에서 `maxLength`가 없어졌습니다.
- `useReadingAiChat.ts:20`은 복원할 때 `slice` 없이 원문을 그대로 읽습니다.
- 3,000자를 넘으면 `importExternalReadingAnswer`(`readingAiCore.ts:19`)가 예외를 냅니다. 예외가 나면 `setExternalAnswer('')`에 도달하지 않으므로 입력한 원문이 남습니다. 보고된 3,253자 확인 결과와 코드가 맞습니다.

**설계 확인: 이전 내부 답변 교체 방식 유지**

내부 반영을 다시 하면 이전 내부 답변과 메모는 교체되고 외부 답변만 남습니다(테스트 64-67행). 원래 설계와 같습니다. 외부 가져오기는 내부 답변도 함께 누적하므로 두 방식이 서로 다르지만, 의도된 차이이고 소실 문제는 아닙니다.

### 2. 차단 지적

**없습니다.**

### 3. 비차단 메모

**검토 1의 메모 6건 (이번 PR에서 반영하지 않음, 원문 그대로 유효)**

1. 참고 텍스트에서 질문과 답변의 짝이 AI에 전달되지 않습니다.
2. 외부 답변만 반영된 상태는 UI에서 지울 수 없습니다.
3. 책 제목을 입력하기 전에 붙여넣은 답변이 다른 세션 키에 남아 화면에서 사라집니다.
4. 반영한 뒤 제목이나 저자를 바꾸면 참고자료가 `"null"`로 저장됩니다.
5. 참고자료가 본문보다 앞에 들어가서 본문이 4,100자 기준으로 잘릴 수 있습니다.
6. 가져온 뒤에도 질문 칸이 남아 다음 질문 때 같은 질문이 다시 전송될 수 있습니다.

검토 1에서 "이번 PR에서 반영하지 않아도 된다"고 판정했고, 이번에도 차단으로 올리지 않습니다.

**이번에 새로 본 사소한 점**

7. **한도 초과 안내가 맞지 않는 경우가 있습니다.** 외부 답변이 이미 3개면 선택을 1개로 줄여도 한도를 넘습니다. 그런데도 "선택을 줄이거나"라고 안내합니다(`readingAiCore.ts:41`). 이 경우에는 "새 회차에서"만 안내하면 됩니다.
8. **지난 오류 문구가 남습니다.** 답변 선택을 바꾸면 제안은 비워지지만 `applyError`는 그대로입니다. 그래서 다음 제안 상자에 이전 오류가 다시 보입니다. 선택을 바꾸거나 제안을 받을 때 `setApplyError('')`를 호출하면 됩니다.
9. **외부 답변 입력에 길이 상한이 없습니다.** 매우 긴 글을 붙여넣으면 입력할 때마다 localStorage에 기록하다가 저장 공간이 넘칠 수 있습니다. 그래도 `storageError` 안내가 뜨고 입력 내용은 남으므로 데이터는 잃지 않습니다. 라벨 옆에 글자 수 표시(`n/3,000`)를 붙이면 미리 알 수 있습니다.
10. **「대화 삭제」 확인 문구가 부족합니다.** 확인 창은 "독서장과 이미 저장한 기록은 유지됩니다"라고만 말합니다. 실제로는 저장하지 않은 외부 참고자료도 `onClearReference`로 함께 지웁니다(`ReadingAiChat.tsx:79`). 확인 창을 거치므로 경고 없는 소실은 아닙니다. a3dcdc40부터 있던 동작이지만, 문구에 "반영한 AI 참고자료도 지워집니다"를 넣을 것을 권합니다.

### 4. 작업 규모와 멈춤 조건

- **규모: 중.** 검토 1과 같습니다. 이번 보완은 프론트 순수 함수 1개, 컴포넌트·훅 수정, 테스트 2개입니다. `FormatModal.tsx`, Functions, Rules, 라우터, 모델, 저장 형식(`version: 1`)은 그대로입니다.
- **멈춤 조건: 해당 없음.** 새 AI 호출, 모델 변경, 비용 구조 변경이 없습니다. 외부 가져오기는 여전히 서버를 호출하지 않습니다.
- **병합·배포 근거:** 이번 건에 대한 허대표님의 명시 지시입니다(프롬프트 기재). 검토 1의 권고대로, 판정 기록에 그 지시의 근거 링크를 함께 남기기 바랍니다.

### 5. 이번 판정과 따로 보는 항목

- **Codex 리뷰:** e2b90ca0에 대한 최신 리뷰가 진행 중이고, 색인 1에 확정 SHA도 아직 없습니다. 8.1절 판정① 조건 3은 아직 충족되지 않았습니다.
- **CI:** 새 CI가 진행 중입니다. Codex 리뷰와 CI가 통과하기 전에는 병합하지 않는다는 조건을 그대로 유지합니다.
- **운영 E2E와 실제 모델 답변 품질:** 확인하지 않았습니다. 격리 FormatModal 확인은 운영 완료로 보지 않습니다.
- **테스트·빌드 결과:** 프롬프트에 적힌 결과를 옮긴 것이고, 이 검토에서 다시 실행하지 않았습니다.

---

**판정: 승인**

B1과 Codex P2 2건은 코드와 회귀 테스트로 해소됐습니다. 비차단 메모 1-10은 후속 작업으로 처리하면 됩니다. 이 승인은 설계와 코드에 대한 판정입니다. 병합하려면 최신 Codex 리뷰와 CI가 통과해야 합니다.

이 결과는 파일로 저장하지 않았습니다. CC가 원문 그대로 `docs/reviews/2026-10-25-pr300-independent-review-2/`에 보관해야 합니다.
