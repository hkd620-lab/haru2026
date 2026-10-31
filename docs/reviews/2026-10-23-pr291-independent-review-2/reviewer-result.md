# 독립 검토 2 — 결과 원문

- 대상 HEAD: `5afe4b9e97627ef6419729ea2d580a266bc99520`
- 출처: 검토 에이전트 최종 회신(전사 파일에서 그대로 추출, 수정 없음)

````text
판정: 수정 후 승인

검토 대상 HEAD: 5afe4b9e97627ef6419729ea2d580a266bc99520 (origin/cc/stats-merge-epub, base codex-write-then-format)
- 이전 HEAD b4dfdd43 이후 커밋은 2개입니다.
  - 8baecf98: 코드 반영
  - 5afe4b9e: docs/reviews/ 파일 5개 추가만 (코드 변경 없음, git show --stat로 확인)

## 직접 확인한 것
PR HEAD를 git archive로 scratchpad에 풀어서 실행했습니다. 저장소 파일과 브랜치는 건드리지 않았습니다.
- frontend `npm run test:record-stats`: recordStats 16개 통과, statsStorage 정책 테스트 통과
- functions `tsc`: 오류 없음 / epubContent 테스트 6개 통과
- PR CI: build_and_preview, Deploy Preview 모두 pass
- Codex 리뷰: 새 HEAD에 대한 리뷰는 아직 없습니다. 기존 리뷰는 b4dfdd43 기준 1건뿐입니다.
- Slack 스레드 원문: 확인했습니다. 결정 ②·⑤ 문구, '허대표님 확인이 필요한 것 ①②③' 게시

## 이전 지적별 해결 여부

**1. garden_crops 저장 경계 — 해결. 다만 이 수정으로 새 버그 2건이 생겼습니다(아래 새 지적 A·B)**
- RecordPage.tsx:768-770에서 garden_crops 문자열 배열을 통과시킵니다. 내용 판정(hasContent)에는 넣지 않습니다.
- FormatModal의 세 경로(:1268-1272, :2902-2905, :2950-2953)는 모두 onSave를 거쳐 RecordPage로 갑니다. 셋 다 텃밭일지면 빈 배열도 저장합니다.
- 저장은 saveRecord(setDoc merge)를 거치며, 배열을 걸러내는 단계가 없습니다.
- 옛 기록 복원(:647-654)은 동작합니다. 다만 아래 새 지적 C를 보세요.

**2. 옛 숫자 _rating — 해결**
- SayuPage.tsx:2693에서 업무일지(`work`)일 때만 숫자 work_rating을 지웁니다.
- 다른 형식의 숫자 _rating은 그대로 남습니다. 읽는 쪽 세 곳(recordStats.isSpecialDayRecord, MergePage, functions epubContent)이 모두 boolean specialDays를 먼저 읽고, 없을 때만 옛 숫자를 봅니다. 특별한 날을 해제하면(false) 옛 숫자 1보다 우선하므로 정상입니다.
- 남는 위험: 업무일지만은 revert하면 다시 저장한 기록의 특별한 날이 사라집니다. 범위가 좁고, 덮어써진 숫자를 정리한다는 이유가 있어 수용 가능합니다.

**3. EPUB 시간과 HEAD 응답 — 해결(운영 실측은 아직)**
- 사진 확인 방식:
  - 사진마다 HEAD를 보내고, 실패하면 GET Range 0-0으로 한 번 더 확인합니다. 시도당 5초 제한입니다.
  - 응답 본문은 cancel해서 버립니다.
  - Firebase Storage가 HEAD에 405가 아닌 다른 오류를 줘도 GET으로 구제됩니다.
- 시간 계산(최악):
  - 미리 확인: 200장 ÷ 동시 12개 ≈ 17묶음 × 10초 ≈ 170초
  - 라이브러리 다운로드: batchSize 100(기본값)으로 2묶음 × 15초 × 최대 2회 ≈ 60초
  - 합계 약 230초로 300초 안에 들어옵니다.
- 옵션 확인: epub-gen-memory 1.1.2에 fetchTimeout, retryTimes, ignoreFailedDownloads가 실제로 있음을 node_modules에서 확인했습니다.

**4. 500개 초과 — 해결**
- MergeViewerPage에서 서버를 부르기 전에 막습니다.
- 서버 MAX_MERGE_RECORD_IDS(500)와 값이 같습니다.

**5. 개수 분리 — 해결**
- failed(실패)와 overLimit(상한 초과)로 나눴고, 화면 안내도 두 가지로 나눴습니다. 테스트도 갱신됐습니다.

**6. 기록 내보내기 노출 — 해결**
- isExportBodyExcluded에 세 필드를 추가했습니다.

**7. 기분 빈 값 — 해결**
- SayuModal은 기분을 고른 경우에만 mood를 저장합니다.

**8, 9 — 남겨 두는 것이 타당합니다(아래 '남긴 항목' 참고)**

**10. lookbehind — 해결**
- replace 두 번과 split으로 같은 동작을 만들었습니다.
- 정책 테스트가 `(?<=`, `(?<!`의 재발을 막습니다. 기존 16개 테스트도 통과합니다.

## 새 지적

**A. [중간] 새로 저장한 모든 텃밭일지에서 SayuModal '다시 다듬기'가 실패하고, 원본 보기에 'Crops' 칸이 생김 (지적 1 반영으로 생긴 회귀)**
- 위치:
  - `frontend/src/app/pages/SayuPage.tsx:2410-2421`: originalData 수집이 `garden_`로 시작하는 키를 형식(type) 확인 없이 담습니다. 그래서 garden_crops 배열이 들어갑니다.
  - `frontend/src/app/components/SayuModal.tsx:1717-1718`:
    ```ts
    const contentValues = Object.values(editedOriginalData)
      .filter(v => v && v.trim())
    ```
- 실패 시나리오:
  1. 이제 텃밭일지는 저장할 때마다 `garden_crops`가 들어갑니다. 아무 작물도 고르지 않으면 `[]`가 들어갑니다.
  2. SAYU에서 그 기록을 열고 원본 보기 → '다시 다듬기'를 누릅니다.
  3. `[]`는 참(truthy)이므로 `[].trim()`이 호출되고 TypeError가 납니다. 화면에는 "다시 다듬기에 실패했습니다"만 보입니다.
  4. 원본 보기(:1783 이하)에는 'Crops'라는 칸이 textarea로 나옵니다. 사용자가 이 칸을 고치고 '원본 저장'(:1701 updateDoc)을 누르면 garden_crops가 문자열로 바뀝니다.
- b4dfdd43에서는 배열이 RecordPage에서 버려져 Firestore에 닿지 않았으므로, 이번 반영으로 새로 생긴 문제입니다.
- 제안:
  - SayuPage originalData 수집에 `typeof record[key] === 'string'` 조건을 추가합니다(또는 `garden_crops`를 제외합니다).
  - SayuModal :1718도 `typeof v === 'string' && v.trim()`으로 방어합니다.
  - 정책 테스트에 이 두 조건을 1줄씩 추가합니다.

**B. [중간] 빈 배열 저장 때문에 '작물을 고르지 않은 기록'의 본문 후보 찾기가 꺼짐**
- 위치: `frontend/src/app/records/recordStats.ts:555`
  ```ts
  collect(entries.filter((entry) => !Array.isArray(entry.record.garden_crops)), prefix, rule)
  ```
- 실패 시나리오:
  1. 작물 칩을 쓰지 않고 본문에만 "고추에 물을 줬다"라고 쓴 새 기록을 저장합니다. 이 기록에도 `garden_crops: []`가 저장됩니다.
  2. 그러면 이 기록은 본문 대조에서 빠져, 작물별 마지막 기록에 아무것도 잡히지 않습니다.
  3. 같은 지표의 설명 문구 "고르지 않은 기록은 등록 작물이 본문에 나온 것(본문 후보)"과 Slack 결정 내용에 어긋납니다.
- 덧붙여: 이전 검토에서 "빈 배열도 저장"을 제안했는데, 통계 쪽 조건을 함께 바꾸라고 하지 않은 것은 이전 제안이 부족했던 탓입니다.
- 제안:
  - 선택 판정을 `Array.isArray(g) && g.length > 0`으로 바꿉니다. 빈 배열은 '고르지 않음'으로 보고 본문 후보로 넘깁니다.
  - 빈 배열 저장은 '기존 선택 해제'를 남기는 용도로 그대로 유효합니다.
  - recordStats 테스트에 `garden_crops: []`와 본문 언급 케이스를 1건 추가합니다.

**C. [낮음] 옛 garden_crop 문자열로 선택을 복원하는 방식이 Slack에서 확인된 사실과 맞지 않음**
- 위치: `FormatModal.tsx:647-654`
- Slack 조사에서 "옛 `garden_crop`에는 그 기록의 작물이 아니라 등록 작물 전체 목록이 들어 있다"고 확인됐습니다. 등록 작물이 없던 사용자는 자유 문장이 들어 있습니다.
- 그래서 복원하면 다음과 같이 됩니다.
  - 전체 작물이 '고른 작물(사실)'로 바뀝니다.
  - 또는 "토마토, 상추, 고추를 심었습니다"를 쉼표로 나눠, 칩에 보이지 않는 가짜 작물명이 garden_crops에 저장됩니다. 화면에 없어서 사용자가 해제할 수도 없습니다.
- 낮음으로 본 이유: 현재 편집 경로가 거의 없습니다. RecordPage는 draft 데이터만 넘기고 garden_crop을 넣지 않습니다. 이 경로는 메뉴에서 숨긴 LibraryPage에서만 닿습니다.
- 이 복원도 이전 검토의 제안이었는데, Slack 사실과 맞지 않았습니다.
- 제안: garden_crops가 없는 옛 기록은 빈 선택으로 시작합니다. 또는 복원 값을 등록 작물 목록과 겹치는 것으로만 제한합니다.

**D. [낮음, 기존 코드] SayuModal이 등록 작물 전체를 garden_crop에 채움**
- 위치: `SayuModal.tsx:1313-1330`
- garden_crop이 비어 있으면 등록 작물 전체를 garden_crop에 채워 '🌱 식물종류'로 보여 줍니다. 원본 저장을 누르면 그 값이 실제로 기록됩니다.
- 이번 수정으로 고른 작물이 없으면 garden_crop을 쓰지 않게 됐습니다. 그래서 이 보완이 더 자주 동작합니다.
- 통계는 garden_crops를 쓰므로 수치 영향은 없습니다. 다만 Slack에 적은 "고른 작물만 garden_crop에 저장"과 어긋나므로, 후속 정리 대상으로 기록하는 것이 좋겠습니다.

## CC가 남긴 항목이 타당한지
- **2의 키 이름(`형식_special` 대신 `specialDays` 맵):** 타당합니다. `pet_special` 충돌은 실제로 있습니다(FormatModal 필드). 코드 주석, PR, Slack '허대표님 확인이 필요한 것 ①'에 기록돼 있습니다. 결정 문구와 다르므로 대표님 확인 대상으로 남기는 처리가 맞습니다.
- **3의 메모리 1GiB:** 512MiB 유지가 타당합니다. 기록 사진은 업로드할 때 `compressImage(file, 800, 0.85)`로 압축됩니다(FormatModal.tsx:1972). 200장이어도 수십 MB 수준입니다. 비용이 늘어나는 결정이라 대표님 판단으로 넘긴 것도 맞습니다. 단, 사진이 많은 기간으로 미리보기에서 실제 EPUB을 만들어 보는 확인은 아직 하지 않았습니다.
- **8(로딩 실패가 '기록 없음'으로 보임, updatedAt 갱신):** 타당합니다. 기존 서비스 동작이고, 같은 문서를 수정하는 것이라 이번 범위 밖입니다. 후속 과제로 기록할 것을 권합니다.
- **9(프리미엄 '전체 기간·작년 비교'):** 프리미엄이 출시 전이라 보류가 타당합니다. 보류 사실이 README와 Slack에 남아 있습니다.

## 규모·멈춤 조건 판단 (이전 판단 유지)
- 규모는 대규모입니다. 통계 화면 전면 교체, 새 저장 필드 3종, Functions(exportEpub) 운영 배포가 포함됩니다. CLAUDE.md상 허대표님 승인 후 병합해야 합니다.
- 이번 반영에서 달라진 점:
  - exportEpub timeout 120→300초: 실행한 만큼만 과금되므로 비용 멈춤 조건은 아닙니다. 메모리는 그대로입니다.
  - region은 asia-northeast3로 유지됩니다.
  - 저장 경로는 users/{uid}/records 그대로이고, Rules·라우터·결제·인증·AI 호출 변경은 없습니다.
- 멈춤 해당 (병합·배포 전 허대표님 결정 필요):
  - 대규모 작업 승인
  - 특별한 날 키 이름 차이(Slack 확인 ①)
  - 메모리 상향 여부(②)
  - exportEpub 운영 배포와 실기기 PDF/EPUB 확인
- 판정①(작업 성격 확인)만으로 병합할 수 있는 건이 아닙니다.

## 승인 조건 요약
- A·B를 고치고 테스트를 추가할 것 (각각 1~2줄 수정)
- 새 HEAD의 Codex 리뷰 결과를 확인할 것
- C·D는 이번에 고치거나 후속 과제로 기록할 것
````
