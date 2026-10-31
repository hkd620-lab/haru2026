판정: 승인 (PR #290 `1bf767df`, PR #291 `6251e391`)

두 Codex 지적(P1, P2)은 코드에서 해결된 것을 확인했습니다. 새로 생긴 회귀나 새 멈춤 조건은 없습니다. 이번 판정은 '수정 후 승인'이 아니므로 수정 후 승인 횟수는 3회 그대로입니다.

다만 코드 승인과 별개로 **배포 조건은 아직 다 충족되지 않았습니다.**
- **#290 `1bf767df`는 충족:** 테스트 54/54 통과(`haru290-lifecycle-tests.log`), 빌드 `✓ built in 2m 43s`(`haru290-lifecycle-build.log`)를 확인했습니다.
- **#291 `6251e391`은 미충족:**
  - 테스트는 77/77 통과했습니다(`haru291-final2-tests.log`).
  - 빌드 로그(`haru291-final2-build.log`)는 `rendering chunks...`에서 끝나 있고 완료 표시가 없습니다. 그래서 통과로 판단하지 않았습니다.
  - 이전 HEAD의 최종 빌드(`haru291-final-build.log`, `✓ built in 2m 31s`)는 완료됐지만, 이번 HEAD 기준 결과는 아닙니다.
  - 이 HEAD의 웹 빌드나 CI가 완료·통과해야 배포할 수 있습니다. 저는 읽기 도구만 있어서 `gh`로 CI를 확인하지 못했습니다.

## 1. P1 해결: 저장이 끝난 뒤 초안 ID를 다시 쓰는 문제
```ts
// RecordPage.tsx:696
const finishDraftAfterSave = (recordId: string) => {
  if (recordId !== draftRecordIdRef.current) return;
  draftRecordIdRef.current = null;
  ...
};
// :906 — 모든 저장이 성공한 뒤, toast 직전에만 호출
finishDraftAfterSave(recordId);
```
- **실제로 저장된 ID만 비교합니다.** 초안 경로(805-813행)에서 저장 결과로 받는 ID는 두 경우 모두 초안 ID입니다.
  - 문서가 이미 있으면 merge 저장 후 `customRecordId`를 씁니다.
  - 문서가 없으면 `saveRecord`가 `recordData.id ?? …`로 같은 ID를 돌려줍니다(firestoreService.ts:449).
- **기존 회차 수정은 초안을 지우지 않습니다.** 이때 저장 ID는 `entry.id`라서 초안 ID와 다르고, 초안은 그대로 남습니다.
- **실패하면 초안이 남습니다.** 내용이 비어 일찍 return할 때, 성장 대상 확인에 실패해 throw할 때, catch로 빠질 때는 이 함수가 호출되지 않습니다. 다시 저장하면 같은 ID로 merge되므로 중복 기록이 생기지 않습니다.
- **같은 편집창 안에서도 ID가 다시 쓰이지 않습니다.** `draftEditorRecordId` 상태는 이 함수가 비우지 않습니다. 그래도 회차 저장(3353)과 최종 저장(3393)이 모두 `closeAfterCommit()`으로 창을 닫고, onClose(1227-1231)에서 이 상태를 비웁니다. 다음 글은 `openDraftEditorForFormat`(684)에서 새 ID를 받습니다.
- **미리보기 URL 해제도 안전합니다.** FormatModal에 넘기는 사진은 `File` 객체(691)입니다. RecordPage 미리보기용 blob URL을 해제해도 편집창에는 영향이 없습니다.

## 2. P2 해결: 이전 렌더의 사진 개수를 참조하는 문제
```ts
// FormatModal.tsx:917 (초기화 effect, deps [isOpen])
initialUploadedImagesRef.current = initialImages;
setUploadedImages(initialImages);
// :1923
const currentImageUrls = periodRow?.entry.imageUrls || (requireAll ? initialUploadedImagesRef.current : uploadedImages);
```
- **실행 순서가 맞습니다.** 초기화 effect(약 860-989행)는 초안 사진 effect(1007행)보다 먼저 선언되어 있습니다. 같은 커밋 안에서 선언 순서대로 실행되므로, 업로드가 시작될 때 ref에는 이미 이번 초기값이 들어 있습니다.
- **기존 상태를 덮어쓰지 않습니다.** 결과 반영은 `setUploadedImages(prev => [...prev, ...new])`(2069) 방식이라 실제 상태에 덧붙습니다.
- **수동 추가는 예전과 같습니다.** `requireAll`이 아닌 수동 업로드(2099)는 그대로 `uploadedImages`를 씁니다. 업로드가 진행 중이면 `isUploadingRef`가 동시 실행을 막습니다.
- **조기 반환보다 앞에 있습니다.** Hook 호출 위치는 `if (!isOpen) return null;`(1020) 앞을 유지합니다.
- **테스트가 이 경우를 잡습니다.** 새 테스트(`uploadedImages`에 옛 사진 5장 → 새 사진 1장 성공)가 정확히 이 재현 조건을 확인합니다.

## 3. 새 지적(차단 아님) 및 후속 과제 정정
- **새 차단 지적은 없습니다.**
- **후속 과제로 넘긴 "날짜가 비어 있는 옛 회차" 설명을 정정합니다.** 이전 설명("초안 날짜로 저장될 수 있다")보다 영향이 조금 다릅니다.
  - `handleSaveReadingNote`(3331)는 `editingReadingEntryDate`가 비어 있으면 `_recordDate`를 넣지 않습니다.
  - 그러면 `applyDraftSaveTarget`(writeBeforeFormat.ts:46)의 edit 예외 조건이 성립하지 않아 `_recordId`가 초안 ID로 바뀝니다.
  - 결과적으로 원래 회차를 고치는 대신 초안 ID로 새 문서가 생기고, 이어서 초안도 종료됩니다.
  - 일어나는 조건이 같아서 가능성은 여전히 낮습니다. 저장 정책상 `date`가 반드시 있어야 하기 때문입니다. 후속 과제에 이 내용을 정확히 적어 두기를 권합니다.
  - 수정 위치 제안: `writeBeforeFormat.ts:46`의 조건을 `mode === 'edit' && data._recordId`로 완화하고, 날짜가 없으면 초안 날짜를 채우는 방식입니다.
- **나머지 후속 과제는 이전 판정 그대로입니다.** 독서 초안에서 「+ 오늘 소감 쓰기」나 「수정」을 누를 때 확인 안내를 넣는 건입니다.

## 4. #291과 규모·멈춤 조건
- **#291 코드는 #290 통합분과 같습니다.** `6251e391`은 #290의 두 수정을 통합한 커밋이고, 지금 checkout(`cc/stats-merge-epub`)의 코드가 diff와 일치합니다. `epubExport.ts`의 1GiB와 동시 요청 1개 설정은 이전 승인 그대로입니다.
- **규모:** 대규모입니다. 이번 수정 자체는 소규모 버그 수정 두 건입니다.
- **멈춤 조건:** 해당하는 것이 없습니다.
  - 저장 경로는 `users/{uid}/records`를 유지합니다.
  - Functions 리전은 `asia-northeast3`입니다.
  - Rules, 결제, 인증, AI 모델, 라우터 변경이 없고 모델 다운그레이드도 없습니다.
  - 커밋 메시지와 실제 변경이 일치합니다.
- **승인 범위:** 요청문에 적힌 대표 승인(병합·배포, specialDays, 1GiB·동시 요청 1)을 근거로 했습니다. 원문은 직접 보지 못했습니다.

## 5. 병합·배포 전 필수 사항
1. #291 `6251e391`의 웹 빌드나 CI가 완료·통과했는지 확인합니다.
2. #290을 병합한 뒤 #291의 base를 main으로 바꾸고, 충돌과 CI를 다시 확인합니다.
3. `exportEpub`은 Hosting과 같이 또는 먼저 배포합니다. 운영 함수가 `recordIds`를 모르기 때문입니다(이전 판정 그대로).
4. 남은 E2E(이전 판정 그대로)에 저장 성공 뒤 흐름을 추가합니다.
   - 이전 항목: 형식별 통계를 실제 기록과 대조, 사진이 들어간 합본 EPUB 운영 생성과 내려받기, iOS·Android에서 PDF/EPUB 열기, 공통 글쓰기 → 독서사유 흐름 실제 화면 확인
   - 추가 항목: 공통 글쓰기 → 저장 성공 → 새 글이 빈 칸과 새 ID로 시작하는지 실제 화면에서 확인

저장소 파일 수정, Git 변경, Slack 게시, 배포는 하지 않았습니다.