PR #397의 실제 diff와 주변 코드를 읽기 전용으로 확인한 뒤 8.1 형식으로 판정하겠습니다. 먼저 저장소를 연결합니다.

PR HEAD 5f1707c 확인했고, merge base는 main 최신(621713d)입니다. diff를 확인합니다.

# PR #397 독립 검토 결과

**검토 대상** hkd620-lab/haru2026 PR #397 `fix/sayu-edit-polish-strength-20261114` → `main`, HEAD `5f1707ccfad802a316227844f205c0580be61400` (merge-base = main 최신 `621713d`), 검토 시각 2026-11-14 11:31 KST. 저장소를 읽기 전용으로 클론해 실제 diff(4개 파일, +66/−12)와 주변 코드를 확인했고, 파일은 수정하지 않았습니다.

## 판정: **수정 후 승인** (필수 수정 1건)

### 확인된 사항 (요구 충족)
- **수정하기 직후 약·강 선택 + 재다듬기** — `canPolishEdit` 조건에서 `PolishStrengthSelect`와 재다듬기 버튼이 편집 화면 상단에 뜨고, 결과는 `setEditedContent`로 편집기에만 반영, 최종 저장은 기존 `handleSave → onSave(handleSaveSayu)` 경로를 그대로 탑니다. 미리보기 전용 호출은 `includeAiComment: false`로 보내 코멘트 생성 비용을 더하지 않습니다.
- **원본 없는 기존 기록** — 제목만 남은 기록(`NovelStoryPage.buildStoryRecord`: `essay_title`·`essay_ai_title`만 있음)은 `_title$` 제외로 원본 판정이 비어 저장 본문 폴백('저장된 본문 다시 다듬기')으로 가는 것을 실제 소스의 필터식을 추출해 확인했습니다. '내용 없음' 센티널 기록은 버튼이 뜨지 않습니다. → **Codex 1차 지적 ① 해결.**
- **취소·실패·늦은 응답** — 저장·취소 버튼은 `isRefining` 동안 비활성, 편집기는 `readOnly`. 늦은 응답은 호출 시점의 textarea 요소와 `mainEditorRef.current`를 비교해 모달이 닫혔거나 다른 기록이 열렸으면 버리므로 다른 기록에 섞이지 않습니다. 빈 결과는 토스트로 안내합니다.
- **공개된 독서사유** — 저장 키가 `getResultChatSourceKey`로 바뀌어 `reading_final_sayu`가 있으면 그 키에 저장(새 테스트가 `reading_sayu`는 그대로임을 확인), 재열기는 기존대로 final 우선, 함께보기는 `getPublishableSharedFormats`가 reading만 `final || draft`로 고르며 `publishRecordToShared`가 저장 뒤 문서를 다시 읽어 반영됩니다. → **Codex 1차 지적 ② 해결.**
- **기존 원본 탭 회귀 없음** — `handleRepolish()` 무인수 호출은 이전과 동일 경로(전역 로딩, `_sayu`·`_ai_comment` 즉시 저장). `onClick={handleRepolish}` → `() => void handleRepolish()` 변경은 필수였습니다(그대로 두면 클릭 이벤트가 `draftSource`로 들어가 미리보기 모드로 오작동). 다른 호출자 없음.
- Functions `polishContent`는 `includeAiComment`·`strength`를 이미 받고, 속도제한(10회/60초)·월 쿼터가 그대로 적용됩니다. Functions·Rules 변경 없음.

### 필수 수정 1건 — 독서사유 기록의 "원본으로 다시 다듬기" 원문에 메타데이터가 섞임
`editPolishOriginal`의 제외 목록이 SayuPage의 `META_SUFFIXES`(`_completedAt`, `_reflection_questions`, `_reflection_answers`, `_entries_snapshot`)와 독서 전용 필드(`_ai_context`, `_started_at`, `_note_createdAt`, `_note_updatedAt`, `_ocr_photo_count`)를 빼지 않습니다. 실제 저장 형태(`FormatModal.handleSaveReadingFinal` / `handleSaveChapterNote`)로 만든 기록에 HEAD의 필터식을 그대로 적용한 결과:

- **최종(마무리) 기록**: 원문에 `"null"`(빈 `reading_ai_context`의 `JSON.stringify(null)`), ISO 타임스탬프 2~3개, 자기성찰 질문·답변 JSON 문자열, `reading_entries_snapshot`(최대 4300자)이 들어갑니다. 안내문까지 더하면 Functions의 5000자 한도를 넘어 `invalid-argument`로 실패하기 쉽고(사용자에게는 "다시 다듬기에 실패했습니다"만 보임), 한도 안이면 JSON·날짜가 섞인 글이 미리보기로 나옵니다. 사용자가 그대로 최종 저장하면 **공개되는 `reading_final_sayu`를 덮어씁니다**(미리보기 확인 단계가 있어 자동 훼손은 아니지만, 버튼 라벨 "원본으로 다시 다듬기"와 결과가 맞지 않음).
- **중간기록**: `reading_ai_context` JSON(AI 메모·답변 최대 수천 자), 타임스탬프, OCR 장수 문자열이 섞입니다.
- 일기·에세이·육아일기 등 일반 형식은 사용자 입력 칸만 들어가 정상입니다(육아일기의 날짜 칸 포함은 기존 원본 탭과 동일한 수준).

최소 수정안(택1 또는 병행): (a) 제외 정규식에 위 접미사들을 추가해 SayuPage `META_SUFFIXES`와 맞춤, (b) `reading_final_sayu`가 있는 완료 독서 기록은 누적 분석 결과라 단일 기록 "원본"이 없으므로 `canPolishEdit`에서 제외하거나 저장 본문 폴백만 허용. 어느 쪽이든 독서사유 최종·중간 기록 픽스처로 필터 테스트를 추가해 주시기 바랍니다.

### 권고 (비차단)
1. 미리보기 다듬기 중 SAYU↔원본 탭 전환·모달 닫기가 막혀 있지 않아, 전환하면 결과가 **아무 안내 없이** 버려지고 `isRefining`도 응답이 올 때까지 남아 다음 기록의 버튼이 잠깐 잠깁니다. 탭·닫기 버튼도 `isRefining` 동안 비활성화하거나 버릴 때 토스트 1개를 권합니다.
2. 미리보기 경로는 `ai_comment`를 재생성하지 않으므로 재다듬기 후 저장해도 AI 코멘트는 이전 본문 기준으로 남습니다. 의도된 비용 절감이면 허대표님 인지로 충분합니다.
3. AI 답변 메모는 재열기 본문이 `memo_sayu` 우선으로 바뀌었지만, 원 기록 아래 "AI 대화 메모" 카드(SayuPage 5543·5843행)는 여전히 `memo_content`를 보여 수정 전·후가 다르게 보입니다.
4. `getPublishableSharedFormats`의 reading 우선순위 변경(Codex ② 수정분)에 테스트가 없습니다. `sayuEditedTitle.test.mjs`처럼 추출 테스트 1건을 권합니다.
5. `_title$` 제외로 `reading_book_title`도 빠져 독서 재다듬기 원문에 책 제목 맥락이 없습니다(필수 수정과 함께 보면 좋음).

### 검증 실행 (검토자)
- 관련 테스트 `sayuEditedTitle`·`polishStrengthGuide`·`polishCommentOptOut`·`formatPolishRequest`·`sayuDirectRecord`: **45건 통과**(PR 설명의 42건과 묶음이 다름).
- `statsStorage.policy.test.cjs`는 main에서도 동일하게 실패 — PR 설명대로 기존 실패입니다. `assistantSavedResultOpen`·`resultChatEvidence`의 실패 2건도 main과 동일(제 환경에 react 미설치 포함)로 이 PR과 무관합니다.
- **빌드는 독립 실행하지 못함**: `npm ci`가 `xlsx@0.20.3`(cdn.sheetjs.com) 차단으로 실패해 esbuild·tsx만 따로 설치했습니다. 빌드·CI 통과는 CC가 판정 기록에 첨부하는 로그로 확인해야 합니다.
- CI 상태·Codex 재검토: PR 페이지상 Codex 재검토는 `5f1707c`에 02:17 UTC 수동 요청, 제 확인 시점에 **결과 없음**. 판정① 조건 3(최신 HEAD Codex 재검토 완료)은 아직 미충족이며, 2시간 무응답 규칙의 기준 시각은 02:17 UTC입니다. PR은 아직 Draft 상태입니다.

## 8.1 확인 항목
- **작업 규모: 소.** 프론트 4개 파일, Functions·Rules·라우터·홈화면·저장 경로 변경 없음. 단, 모든 기록 형식의 편집 화면과 공개본 선택 로직을 건드리므로 운영 검증은 형식별로 필요합니다.
- **멈춤 조건:**
  - *기존 AI를 부르는 새 화면 진입점* — 새 Functions·모델·호출 종류 추가는 없고 기존 `polishContent`(PREMIUM) 재사용, 호출당 비용은 코멘트 생략으로 기존 원본 탭 경로 이하, 속도제한·월 쿼터 동일 적용. 다만 진입점이 늘어 **호출량은 늘 수 있습니다.** 이 진입점은 허대표님 요구사항("수정하기 직후 약·강 선택과 재다듬기") 자체이므로 지시 범위 안으로 보되, "호출량이 늘 수 있는 변경"이라는 사실은 판정 기록에 적고 허대표님 확인란으로 남기는 것이 맞습니다. 자동 판정만으로 넘기지 않기를 권합니다.
  - *웹 Hosting 승인 범위* — 8.1의 배포 승인은 특정 CC 세션(`session_01ATvKfCmo2UfLHqwsFgTT1h`)이 끝날 때까지로 한정되며 새 세션은 이어받지 않습니다. 이 PR을 처리하는 CC 세션이 그 세션인지는 저장소에서 확인할 수 없으므로 **확인 필요** — 다른 세션이면 판정①을 받아도 병합·배포 전 허대표님 재확인이 필요합니다.
  - 그 외(모델 교체, 저장 경로·마이그레이션, 운영 데이터 변경, 결제·인증, Rules) 해당 없음.
- **"같은 건" 횟수:** PR #396(강 다듬기 짧은 메모 품질)과는 설계·작업이 다른 별건으로 보아 이번이 수정 후 승인 1회째입니다. CC가 같은 건으로 묶는다면 그 판단을 기록에 적어 주시기 바랍니다.
- **남은 운영 검증(병합 후 실기기):** ① 일기 등 일반 기록 수정 → 약/강 재다듬기 → 미리보기 → 최종 저장 → 재열기 본문 확인, ② 제목만 있는 기록에서 '저장된 본문 다시 다듬기' 라벨·동작, ③ **공개된 독서사유 최종 기록** 수정 저장 → 함께보기 본문 반영(필수 수정 반영 후), ④ 재다듬기 중 모달 닫기·다른 기록 열기 → 늦은 응답이 다른 기록에 반영되지 않음, ⑤ AI 답변 메모 수정 → 재열기 본문, ⑥ 390px에서 약·강 선택·버튼 배치. 이 중 ①~⑤는 AI가 대신 "운영 완료"로 판정할 수 없는 항목입니다.

**다음 행동:** CC가 필수 수정 1건 반영 → `@codex review` 재요청 → 이 판정 원문과 반영 내역을 함께 넘겨 재검토 요청.
