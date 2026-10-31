# 독립 검토 1 — 결과 원문

- 대상 HEAD: `b4dfdd436190c321fea061e8a234014e6007b2bc`
- 출처: 검토 에이전트 최종 회신(전사 파일에서 그대로 추출, 수정 없음)

````text
판정: 수정 후 승인

검토 대상 HEAD: b4dfdd436190c321fea061e8a234014e6007b2bc (cc/stats-merge-epub). base는 codex-write-then-format 9f4e93f9이고, 검토 시점 CI(build_and_preview)는 pending이었습니다.
근거 자료: PR 본문, Slack 스레드(결정 1~6, ①~⑤, 기장 보완 4가지 원문 확인), CLAUDE.md, 운영정책 8.1절.
직접 확인한 것: PR HEAD를 scratchpad에 git archive로 풀어 실행했습니다. 저장소 파일과 브랜치는 건드리지 않았습니다.
- recordStats 테스트: 16개 통과
- functions tsc(출력은 scratchpad로): 오류 없음
- epubContent 테스트: 6개 통과
- 같은 HEAD에 Codex P2 지적 1건이 남아 있습니다(아래 1번).

## 지적 목록

**1. [중간] 텃밭 작물 배열(garden_crops)이 저장되지 않음 (Codex P2와 같은 내용, 아직 미해결)**
- 위치: `frontend/src/app/components/FormatModal.tsx:1261-1263`, `:2894-2896`, `:2942-2944`. 세 경로 모두 `onSave(...)`를 거쳐 `frontend/src/app/pages/RecordPage.tsx` 약 764행에 도착합니다.
- RecordPage는 문자열 값만 저장 데이터에 복사합니다.
  ```ts
  if (typeof value === 'string' && value.trim().length > 0) { updateData[key] = value; ... }
  ```
- 실패 시나리오:
  - 작물을 고르고 저장하면 `garden_crop` 문자열만 남고 `garden_crops` 배열은 버려집니다.
  - 그러면 통계(`recordStats.ts:545-552`)가 '고른 작물(사실)'을 인식하지 못합니다. 대신 등록 작물이 본문에 나오는지로 대조하게 되어, 고르지 않은 작물이 잡히거나 고른 작물이 빠집니다. 결정 ②의 목적이 무너집니다.
- 부수 문제 두 가지:
  - 저장 조건이 `selectedCrops.length > 0`이라서, 선택을 모두 해제해도 기존 선택이 그대로 남습니다.
  - 편집을 열 때 `initialData.garden_crops`가 없으면 기존 `garden_crop` 값이 있어도 선택이 복원되지 않습니다.
- 제안:
  - RecordPage 저장 경계에서 `garden_crops`(문자열 배열)를 그대로 통과시킵니다. 빈 배열도 저장되게 합니다.
  - 해제 상태도 저장되게 조건을 바꿉니다(텃밭일지면 항상 `garden_crops` 기록).
  - 저장 경계 테스트를 1건 추가합니다.

**2. [중간] 특별한 날 저장 키가 결정 ⑤ 문구와 다르고, 옛 숫자 `_rating`을 지움**
- 위치: `frontend/src/app/pages/SayuPage.tsx:2688-2698`
  ```ts
  [`specialDays.${formatKey}`]: isSpecial,
  ...(hasLegacyRating ? { [ratingKey]: null } : {}),
  ```
- 키 이름 문제:
  - 결정 ⑤는 "저장 칸을 `형식_special`로 따로 둡니다"였습니다. 구현은 `specialDays[형식 키]` 맵입니다.
  - 맵을 쓰는 데에는 타당한 이유가 있습니다. `pet_special`이 반려동물 '특별한 일' 입력 칸(FormatModal 필드)과 충돌하기 때문입니다.
  - 하지만 PR 본문과 Slack에 이 차이와 이유가 적혀 있지 않습니다.
- 옛 값 삭제 문제:
  - 결정은 "기존 `_rating`의 0/1 값은 옮기지 않고 읽을 때 구분"이었습니다. 구현은 다시 저장하면 숫자 `_rating`을 삭제합니다. 결정에 없는 운영 데이터 변경입니다.
  - 되돌리기 위험이 있습니다. 이 PR을 revert하면, 그동안 다시 저장된 기록은 옛 코드가 `specialDays`를 읽지 못하고 `_rating`도 없어서 '특별한 날'이 사라집니다.
  - 삭제가 꼭 필요한 것도 아닙니다. `isSpecialDayRecord`가 boolean인 `specialDays`를 먼저 읽기 때문입니다.
- 제안:
  - 숫자 `_rating` 삭제를 빼거나, 업무일지 `work_rating`의 0/1 정리로만 한정합니다.
  - 키 이름 차이와 이유를 PR과 Slack에 기록하고 허대표님 확인을 받습니다.

**3. [중간] EPUB 실행 시간·메모리 여유 부족, 그리고 Firebase Storage HEAD 응답 미검증**
- 위치: `functions/src/epubExport.ts:151-155`(timeoutSeconds 120, 512MiB 그대로), `functions/src/epubContent.ts:123-138`
- 실행 시간 계산:
  - 사진 미리 확인: 최대 200장, 한 번에 8장씩, 장당 10초 제한. 최악이면 약 250초입니다.
  - 그 뒤 epub-gen-memory가 사진을 다시 내려받습니다(fetchTimeout 20초 × 3회 재시도, 한 번에 100장).
  - 저장소가 느리면 120초 제한에 걸려 EPUB 전체가 실패합니다. 주석의 "사진 1장 때문에 전체가 실패하지 않게" 의도와 반대 결과입니다.
- HEAD 응답 문제:
  - Firebase Storage 다운로드 URL이 HEAD 요청에 405가 아닌 다른 오류로 답하면, 모든 사진이 '건너뜀'으로 빠집니다.
  - 운영에서 확인하지 않았습니다.
- 확인한 것:
  - `ignoreFailedDownloads`는 epub-gen-memory 1.1.2에 있는 옵션입니다.
  - `src`를 `&amp;`로 이스케이프해도 htmlparser2가 원래 문자로 되돌리므로 토큰 URL은 깨지지 않습니다.
- 제안:
  - timeout을 300초 수준으로, 메모리를 1GiB로 올리는 것을 검토합니다. 확인 요청 제한 시간도 줄입니다.
  - 미리보기에서 사진이 많은 기간으로 실제 EPUB을 만들어 확인합니다.

**4. [낮음] 기록 ID 500개 초과 시 EPUB 실패**
- 위치: `epubContent.ts:59`, `MergeViewerPage.tsx:146`
- 프리미엄 '직접 선택'으로 긴 기간을 고르면 500개가 넘을 수 있습니다. 그러면 invalid-argument가 나고 화면에는 일반 실패 문구만 보입니다.
- 제안: 화면에서 미리 안내하거나, 서버에서 나눠 처리합니다.

**5. [낮음] 사진 상한 초과분도 '내려받지 못함'으로 안내됨**
- `skippedPhotos`에 200장 상한을 넘은 장수도 들어갑니다. 그런데 안내 문구는 "내려받지 못해 뺐습니다"입니다(`MergeViewerPage.tsx`).
- 제안: 두 경우를 나눠 셉니다.

**6. [낮음] 기록 내보내기에 새 필드가 그대로 노출됨**
- 위치: `firestoreService.ts:2092-2103` `isExportBodyExcluded`
- TXT/JSON 기록 내보내기 본문에 `specialDays`, `statsChecks` JSON과 `garden_crops`가 노출됩니다.
- 제안: 제외 목록에 추가합니다.

**7. [낮음] 기분 미선택 시 빈 문자열이 저장됨**
- 위치: `SayuModal.tsx:1430`
- SayuModal 편집 저장이 기분을 고르지 않았을 때 `mood: ''`를 씁니다. 나중에 기분 분포를 만들 때 빈 문자열을 '선택 안 함'으로 처리해야 합니다.
- 위험도는 낮습니다. RecordPage와 HaruLaw 쪽은 기분이 없으면 필드를 빼도록 고쳐져 있습니다.

**8. [낮음] 통계 로딩 실패가 '기록 없음'으로 보임**
- `getRecordsInRange`가 오류를 잡아서 `[]`를 돌려줍니다. 그래서 통계 화면의 `loadFailed` 안내가 나오지 않고 '기록 없음'으로 보입니다(기존 서비스 동작).
- '맞아요/아니에요'를 누를 때마다 `updateRecord`가 `updatedAt`을 갱신하고 사용량 로그를 남깁니다. 의도한 것인지 확인이 필요합니다.

**9. [낮음] 결정 ⑥ 중 일부 미구현**
- 결정 ⑥의 프리미엄 '전체 기간·작년 비교'가 없습니다. '출시 후'라서 보류할 수 있지만, 누락이라고 기록해 둘 필요가 있습니다.

**10. [낮음] 오래된 iOS에서 정규식 오류 가능**
- `splitSentences`가 lookbehind 정규식을 씁니다. iOS Safari 16.4 미만에서는 실행할 때 오류가 납니다.
- 같은 패턴이 이미 `drugService.ts`에 있습니다. 대상 iOS 버전 정책을 확인하면 됩니다.

## 데이터 안전
- 저장 경로: `users/{uid}/records` 그대로입니다. 새 필드(`specialDays`, `statsChecks`, `garden_crops`)는 모두 같은 문서 안에 들어가고, `updateDoc`의 점 경로를 쓰므로 다른 필드를 덮어쓰지 않습니다. Rules 변경은 없습니다.
- 다른 사용자 기록 접근: EPUB `recordIds`는 서버에서 `users/${auth.uid}/records/${id}`로만 읽습니다. ID는 `/`를 막고 길이와 개수를 제한합니다. 읽은 뒤 기간·비서 여부·SAYU·특별한 날 조건을 다시 확인합니다. 결제 확인도 그보다 먼저 합니다. 다른 사용자 기록에 닿을 경로는 찾지 못했습니다.
- 업무일지 Rating 칸 문장이 덮어써지던 문제는 고쳐졌습니다(문자열 `work_rating`은 건드리지 않음). 다만 2번의 옛 숫자 값 삭제는 결정 범위 밖입니다.
- 형식을 삭제할 때 `specialDays`와 `statsChecks`도 같이 지웁니다(RecordDetailPage). 의도에 맞습니다.

## 요구사항 충족
대부분 충족합니다.
- 기록형식 11종, 비서 제외
- 원문 기준 지표, 출처 3가지 구분, '자세히 보기'
- 표본 기준 5건·3건·10건
- 기간 등급과 🔒 표시, 기간 자동 변경 없음
- 여행 '기록이 이어진 기간', 금액 합산 안 함
- "마지막 기록은 N일 전", '기록상 미결 표현'
- 'SAYU 완료 기록' 문구, 날짜순 정렬, EPUB이 화면과 같은 ID·순서 사용
- 비서 합본 숨김, 보조장부는 `/merge?mode=ledger`, 식물탐정·타임라인 통계 버튼
- 홈 주식거래일지 카드 내림

빠지거나 다른 것:
- 결정 ②의 작물 저장이 실제로 동작하지 않음(1번)
- 결정 ⑤ 키 이름 차이와 옛 값 삭제(2번)
- 결정 ⑥ 프리미엄 일부(9번)

## 규모·멈춤 조건 판단
- 규모: 대규모입니다.
  - 통계 화면을 전면 교체하는 새 기능입니다. 후보 확인 버튼과 저장 필드 3종이 새로 생깁니다.
  - Functions 운영 배포가 필요합니다. 28개 파일, 약 2천 줄입니다.
- 홈화면 파일(`HomePageV2.tsx`): 주식거래일지 카드 1개를 지운 것뿐입니다. Slack 결정 ②의 "이 결정을 그 허용으로 기록합니다"로 허용된 범위입니다.
- 해당하지 않는 것: 라우터 파일 변경 없음, 경로·Rules·결제·인증·AI 호출 변경 없음.
- 비용: EPUB에 사진을 확인하는 HEAD 요청과 사진 포함량이 조금 늘어나는 정도라 비용 증가 수준은 아닙니다.
- 멈춤 해당 (병합·배포 전 허대표님 승인 필요):
  - CLAUDE.md 기준 대규모 작업이라 승인 후 병합해야 합니다.
  - 2번은 결정 문구와 다른 저장 방식이고 운영 데이터를 바꾸므로 대표님 확인이 필요합니다.
  - `exportEpub` 운영 배포와 실기기 PDF/EPUB 확인은 사람이 해야 합니다.
- PR 본문도 "병합·배포는 허대표님 승인 후"라고 적고 있어 이 판단과 맞습니다.

## 테스트 충분성
- 순수 함수 테스트(통계 규칙·기간·표본, EPUB 조건·사진·ID 검증·이스케이프)는 충분합니다. 둘 다 통과를 재현했습니다.
- 부족한 것:
  - 저장 경계: `garden_crops`가 RecordPage를 통과하는지, 선택 해제가 저장되는지
  - SayuPage의 `specialDays` 저장과 옛 숫자 값 처리
  - `exportEpub` 핸들러 수준: 순서 유지, 없는 문서·조건 미달 건너뛰기, 500개 초과
  - '화면 건수 = PDF 건수 = EPUB 장 수' 대조(Slack 검증안 ③)
- 화면 확인도 하지 않은 상태입니다. 미리보기 채널에서 무료·베이직·프리미엄 계정으로 확인해야 합니다.
````
