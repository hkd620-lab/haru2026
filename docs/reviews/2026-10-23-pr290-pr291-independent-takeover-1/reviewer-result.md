판정: 승인 (PR #290 `eb1ce601`, PR #291 `47da9ec7` 모두 해당)

이번 검토에서 새로 고쳐야 할 코드는 없습니다. 이전에 '수정 후 승인'이 이미 3회 나왔지만, 이번은 수정 후 승인이 아니므로 그 횟수 때문에 따로 대표 보고할 일은 생기지 않습니다. 다만 병합 전 조건이 하나 있습니다. #291의 최종 웹 빌드 로그(`/private/tmp/haru291-final-build.log`)가 `rendering chunks...`에서 끝나 있고 완료 표시가 없습니다. 그래서 #291 HEAD `47da9ec7`의 웹 빌드는 통과로 판단하지 않았습니다. 병합 전에 이 HEAD에서 빌드나 CI 통과를 확인해야 합니다.

## 근거로 확인한 것
- 실제 저장소(`cc/stats-merge-epub`, HEAD `47da9ec7`)의 해당 파일과 diff 3개를 읽었습니다.
- 완료 표시까지 확인한 로그:
  - #290 테스트 52/52 통과, #290 빌드 `✓ built in 2m 42s`
  - #291 테스트 75/75 통과
  - Functions tsc 빌드와 epub 테스트 8/8 통과
- 미완료 로그: #291 최종 웹 빌드
- 저는 읽기 도구만 있어서 `gh`로 PR CI를 확인하지 못했습니다. 색인 문서의 CI 성공 기록은 그 이전 HEAD(`e8414275`, `0a8a20d6`) 기준입니다.

## 1. Codex 지적 해결 여부

**#290 실행 1 P1(조건부 Hook 호출): 해결**
- 초안 사진 effect가 1005행으로 옮겨졌고, 조기 반환 `if (!isOpen) return null;`(1018행)보다 앞에 있습니다.
- `use*(` 패턴을 따로 찾아봤습니다. `useReadingDraft` 같은 사용자 정의 Hook까지 포함해 1018행 뒤에 Hook 호출이 없습니다. 새 테스트의 정규식은 사용자 정의 Hook을 잡지 못하지만, 실제 코드는 문제없습니다.
- effect 안에서 쓰는 `uploadSelectedImages`는 뒤쪽(1899행)에 선언됩니다. 그래도 문제가 없습니다.
  - effect는 렌더가 끝난 뒤 실행되므로, 열린 상태에서는 이미 선언이 끝나 있습니다.
  - 닫힌 상태에서는 `if (!isOpen) {…return}`에서 먼저 빠져나가서 이 함수를 쓰지 않습니다.
- 사진 정리 동작(`initialPhotoUploadKeyRef`, `requireAll`)은 이동 전 내용과 똑같습니다.

**#290 실행 2 P2-1(독서사유를 처음 고를 때 공통 초안이 사라짐): 해결**
```ts
// FormatModal.tsx:647 (열릴 때)
initialReadingJournalRef.current = initialWritingDraft && format === '독서사유' ? initialData.reading_journal || '' : '';
// :3028 (책 전환 시 한 번만 사용)
const journal = initialReadingJournalRef.current;
initialReadingJournalRef.current = '';
setFormData((prev) => resetReadingBookDraft(prev, title, author, startedAt, journal));
```
- 초안을 넘기는 세 경로 모두 이 처리를 거칩니다: 기존 책 선택(3059), 새 책 시작(3077), 새작성 카드(3626).
- 일반 편집(초안 없음)에서는 `initialWritingDraft=false`라서 ref가 비어 있고, 동작이 예전과 같습니다.

**#290 실행 2 P2-2(기존 회차를 수정할 때 ID·날짜를 덮어씀): 해결**
```ts
// writeBeforeFormat.ts:46
if (data.reading_accumulation_mode === 'edit' && data._recordId && data._recordDate) return data;
return { ...data, _recordId: draftId, _recordDate: draftDate };
```
- 회차 수정 저장(3323-3342)은 `_recordId: entry.id`와 `_recordDate: entry.date`를 넣고 모드를 `'edit'`로 정합니다. 그래서 원래 문서 ID와 날짜가 그대로 유지됩니다.
- 새 회차와 최종 기록은 초안 ID로 저장됩니다. 실패한 뒤 다시 시도해도 같은 문서에 merge되므로 중복 기록이 생기지 않습니다(RecordPage 796-804행).
- 로컬 독서 초안 저장소는 `reading_` 키만 저장합니다(`readingDraft.ts:35`). 그래서 지난 세션의 `_recordId`나 `_recordDate`가 복원되면서 끼어들 수 없습니다.

**선교보고·일반보고(e8414275): 해결**
- `mission_space`와 `report_space`가 FormatModal FORMAT_FIELDS(234·242행)에 실제로 있는 키입니다.

## 2. 새 지적(차단 아님)
1. **[낮음] 공통 초안이 들어온 상태에서 독서사유의 「+ 오늘 소감 쓰기」나 「수정」을 누를 때**
   - 위치: `prepareReadingAppend`(3086-3091), `prepareReadingEdit`(3115)
   - 두 함수 모두 `reading_journal`을 비우거나 옛 회차 내용으로 바꿉니다. 그래서 첫 선택 때 지켜 둔 초안이 편집창에서 사라집니다. 초안을 쓴 사용자는 이 버튼부터 누르기 쉽습니다.
   - RecordPage의 `draftContent`는 그대로 남아 있습니다. 편집창을 닫았다가 다시 열면 복구되므로 영구 손실은 아닙니다.
   - 제안(나중에 해도 됨): 초안 세션에서는 내용을 비우기 전에 확인을 받거나, 「+ 오늘 소감 쓰기」가 초안을 유지하게 합니다.
2. **[참고] `entry.date`가 빈 옛 회차를 수정할 때**
   - `_recordDate`에 초안 날짜가 남아, 그 날짜로 저장될 수 있습니다.
   - 초안이 없는 경로에서도 `savedDateStr`로 저장되는 기존 동작과 같아서 회귀는 아닙니다. 저장 정책상 `date`는 반드시 있어야 하므로 실제로 일어날 가능성은 낮습니다.

## 3. #291 승인 이후 변경과 자원 설정
- 승인한 `2cb31382` 이후 코드 변경은 위 #290 통합분과 `f3b176aa` 하나뿐입니다.
```ts
// epubExport.ts:156
region: 'asia-northeast3', timeoutSeconds: 300, memory: '1GiB', concurrency: 1,
```
- 승인된 1GiB와 동시 요청 1개와 정확히 같습니다. 리전은 그대로이고, v2 `onCall`에서 쓸 수 있는 설정입니다. 커밋 메시지와 실제 변경도 일치합니다.
- 지금 운영은 512MiB에 동시 요청 80입니다. 사진을 최대 200장까지 메모리에 모으는 구조라, 이번 변경으로 메모리 부족 위험이 줄어듭니다.
- 참고 1: 사진 1장당 바이트 상한은 없습니다. 압축하지 않은 옛 원본이 많으면 1GiB 여유를 다시 계산해야 합니다.
- 참고 2: `maxInstances`가 정해져 있지 않습니다. 요청 하나마다 인스턴스가 하나씩 쓰입니다.

## 4. 규모, 멈춤 조건, 승인 범위, 남은 E2E
- **규모:** 대규모입니다(통계 화면 교체, 새 저장 필드, Functions 변경).
- **새 멈춤 조건:** 없습니다.
  - 저장 경로는 `users/{uid}/records`를 유지합니다.
  - Rules, 결제, 인증, AI 모델, 라우터 변경이 없습니다.
  - 모델 다운그레이드가 없습니다.
- **승인 범위:** 아래는 요청문에 적힌 대표 승인을 근거로 했습니다. 저는 Codex 대화 원문을 직접 확인하지 못했습니다.
  - #290 → #291 순서의 병합과 Hosting 자동배포
  - 서울 `exportEpub` 단독 배포
  - `specialDays` 키 확정
  - 1GiB와 동시 요청 1개
- **배포 순서 주의:** `exportEpub`을 Hosting과 같이 또는 먼저 배포하는 것을 권합니다.
  - 새 화면은 `recordIds`를 보냅니다(`epubExportService.ts`).
  - 지금 운영 함수는 `recordIds`를 모릅니다. Hosting만 먼저 나가면 합본 EPUB이 고른 기록이 아니라 기간 전체로 만들어질 수 있습니다.
  - 운영 제한 시간도 지금은 120초뿐입니다.
- **병합 전 필수:** `47da9ec7`에서 웹 빌드나 CI 통과를 확인하고, #290 병합 뒤 #291의 base를 main으로 바꾼 다음 충돌과 CI를 다시 확인합니다.
- **남은 E2E(아직 확인하지 않음):**
  - 로그인 계정으로 형식별 통계를 실제 기록과 대조
  - 사진이 들어간 합본 EPUB의 운영 생성과 내려받기
  - iOS·Android에서 PDF/EPUB 열기
  - 공통 글쓰기 → 독서사유 흐름의 실제 화면 확인(첫 책 선택, 회차 수정, 실패 후 재시도)

저장소 파일 수정, Git 변경, Slack 게시, 배포는 하지 않았습니다.