판정: 승인

두 파일의 변경은 표시만 바꿉니다. 선택 조건, 특별한 날 집계, 인쇄에서 새로 생긴 회귀는 찾지 못했습니다. 이번 결과는 '수정 후 승인'이 아니므로 수정 후 승인 횟수는 3회 그대로입니다.

## 1. 선택 조건: 기록을 고르는 쪽과 표시하는 쪽이 같은 기준을 씁니다
기록을 고르는 쪽(`MergePage.tsx`):
```ts
// MergePage.tsx:381, 384, 390-391
const formatPrefix = getFormatKey(selectedFormat);
... hasSayu(record, formatPrefix)
.filter(record => mergeFilter === 'all' || isSpecialDayRecord(record, formatPrefix))
// :404-411  state: { records, format, startDate, endDate, filter: mergeFilter }  ← threshold 없음
```
표시하는 쪽(`MergeViewerPage.tsx`):
```ts
// MergeViewerPage.tsx:69-71
const formatPrefix = buildFormatKeyMap(MERGE_VIEWER_FORMATS)[format] || 'diary';
const filterLabel = state.filter === 'special' ? '특별한 날로 표시한 SAYU 기록' : 'SAYU 완료 기록';
const specialDayCount = records.filter((record) => isSpecialDayRecord(record, formatPrefix)).length;
```
- **접두어가 같습니다.** `buildFormatKeyMap`은 역할 지정 없이 `getFormatKey`를 부릅니다(`formatRegistry.ts:63-65`). 그래서 MergePage가 쓰는 접두어와 같은 값이 나옵니다.
- **형식 목록이 같습니다.** `MERGE_VIEWER_FORMATS` 11개와 `STATS_MERGE_RECORD_FORMATS` 11개는 순서만 다르고 형식은 같습니다. 그래서 `'diary'` 대체값으로 빠지는 경우는 실제로 일어나지 않습니다.
- **안내 문구가 실제 선택 조건과 맞습니다.** MergePage는 SAYU가 있는 기록만 고르고, 'special'일 때는 특별한 날 기록만 남깁니다(384, 391행).
- **화면 안내와 함께 넘어가는 값이 같습니다.** EPUB 요청(152행)은 기존 그대로 `state.filter`와 `recordIds`를 넘깁니다.
- **filter 값이 없을 때도 안전합니다.** 문구가 'SAYU 완료 기록'으로 표시됩니다. MergePage는 항상 이 값을 넘기므로 실제로 이런 경우는 없습니다.

## 2. 특별한 날 집계
```ts
// recordStats.ts:254-259
const flag = record.specialDays?.[prefix];
if (typeof flag === 'boolean') return flag;
const legacy = record[`${prefix}_rating`];
return typeof legacy === 'number' && legacy > 0;
```
- **세 곳 모두 같은 함수를 씁니다.** 화면 뱃지(452행), 인쇄 뱃지(912행), 요약 카운트(71행)가 모두 이 함수를 부릅니다.
- **선택과 표시가 서로 어긋나지 않습니다.** 'special' 합본이면 `specialDayCount === records.length`가 됩니다. 'all' 합본이면 그 일부만 셉니다.
- **예전 0점 표시 문제는 해결됐습니다.** 원인이었던 `mergeRating` 참조가 사라졌습니다. 파일 안에 `threshold`, `mergeRating`, `별점` 참조는 하나도 남지 않았습니다(grep 결과 0건). `ViewerRecord`와 `LocationState`에서 해당 필드를 지운 것도 맞습니다.
- **나눗셈 문제도 같이 없어졌습니다.** 평균을 계산하던 코드가 빠졌습니다. 기록이 0개인 경우는 46행에서 미리 막습니다.

## 3. 인쇄
- **표지, 미리보기, 요약이 화면과 같은 값을 씁니다.** 인쇄 표지(887행), 저장 미리보기(334행), 요약 카드(990행 부근)가 화면과 같은 `filterLabel`과 `specialDayCount`를 씁니다.
- **인쇄 서식은 그대로입니다.** 뱃지는 기존 `env-tag` 클래스를 유지해 `@media print`의 흰 배경 처리를 그대로 받습니다. 바뀐 것은 주석 문구뿐입니다.
- **인쇄 동작은 바뀌지 않았습니다.** 페이지 넘김, 사진(`getRecordPhotoUrls`), `window.print` 흐름은 건드리지 않았습니다.

## 4. 규모·멈춤 조건·승인 범위
- **규모: 소규모입니다.** 표시 문구와 표시용 카운트만 바꿨고, 저장된 데이터, 라우터, 선택 로직은 바뀌지 않았습니다.
- **멈춤 조건: 해당 없음.**
  - Firestore 경로, Functions, 리전, Rules, 결제, 인증, AI 모델 변경이 없습니다.
  - 커밋 메시지("합본 화면과 인쇄의 선택 기준 표시 일치")가 실제 변경과 맞습니다.
  - `MergeTitleAnimation` 문구 한 줄도 같은 목적에 속합니다.
- **승인 범위:** 이미 승인·배포된 #290/#291 합본 작업을 표시 쪽에서 마무리하는 보완입니다. 멈춤 조건에 해당하지 않으므로 8.1절 판정①로 진행하면 됩니다. 새로 대표 승인을 받을 필요는 없다고 판단합니다. 대표 승인 원문은 직접 보지 못했습니다.

## 5. 검증 근거
- 테스트: `haru-merge-label-tests.log` → `tests 44 / pass 44 / fail 0`
- 빌드: `haru-merge-label-final-build.log` → `✓ built in 54.19s`. 이번에는 빌드가 끝까지 완료됐습니다.
- **직접 확인하지 못한 것:** 읽기 도구만 있어서 `a4835f9a`와 작업 트리가 일치하는지 `git`으로 확인하지 못했습니다. 작업 트리의 실제 코드는 diff와 같았습니다. GitHub CI(실제 Firebase 환경) 결과도 확인하지 못했으니, 병합 전에 확인해 주세요.

## 6. 바뀌지 않은 기존 문제 (모두 차단 아님)
- **옛 별점 기록의 판정:** 옛 숫자 `_rating`이 0보다 크면 특별한 날로 봅니다. 그래서 예전에 별점 1~5점을 준 기록은 모두 "특별한 날"로 표시·집계됩니다. #291에서 승인된 정책을 그대로 따른 것이고 이번 변경 범위가 아닙니다.
- **새로고침하면 합본이 사라짐:** 뷰어는 화면 이동 때 넘겨받은 값(`location.state`)에 의존합니다. 그래서 새로고침하면 "표시할 기록이 없습니다"가 뜹니다. 예전부터 있던 동작입니다.
- **쓰이지 않는 대체값:** `'diary'` 대체값은 지금은 실행되지 않습니다. 다만 나중에 MergePage에 형식을 추가하면서 `MERGE_VIEWER_FORMATS`를 함께 고치지 않으면, 사진과 특별한 날 판정이 조용히 어긋날 수 있습니다. `STATS_MERGE_RECORD_FORMATS` 하나로 통일하는 것을 후속 과제로 권합니다.
- **이전부터 넘겨 둔 후속 과제:** 날짜가 없는 옛 독서 회차 저장 경로, 독서 초안 확인 안내는 이전 판정대로 차단이 아닌 후속 과제로 남아 있습니다.

## 7. 병합 전후 확인
1. PR #293 CI가 통과하는지 확인합니다.
2. 운영에서 실제 화면을 확인합니다.
   - 'all' 합본: 표지에 "SAYU 완료 기록", 요약에 "특별한 날 N건"(전체 기록 수 이하)이 나오는지
   - 'special' 합본: 표지에 "특별한 날로 표시한 SAYU 기록"이 나오고 N이 전체 기록 수와 같은지
   - 인쇄 미리보기의 표지, 뱃지, 요약이 화면과 같은지

저장소 파일 수정, Git 변경, Slack 게시, 배포는 하지 않았습니다. 계획 모드에서 쓸 수 있는 파일 쓰기 도구가 없어서 계획 파일(`/Users/heogyeongdae/.claude/plans/pr-293-resilient-truffle.md`)도 만들지 않았습니다.