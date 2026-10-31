# 가계부 파일 가져오기 1단계 수정 설계 (04 독립판정 1회차 M1–M12 반영)

코드, Git, 게시 작업은 하지 않았습니다. 04 원문과 02를 읽었고, `FormatModal.tsx`의 저장 진입점과 파일 읽기 경로(:611, :2824–3133, :5517, :6889)를 확인했습니다. 이 세션에는 쓰기 도구가 없어서 설계를 이 답변으로만 드립니다.

## 0. 폐기와 범위

- **폐기:**
  - 02 §3-3의 승인번호 키와 §5의 "승인번호면 이미 저장됨"
  - `amountBasis`, `billed`, `billedAmount`
  - 기준연도 입력과 올해 추정
  - 02 §7-5의 "자동연동 유지"
  - `cardDetail`, `keyBasis`, `transferKind`(R4)
  - 카드 경로의 암호 입력
  - 표준양식(샘플) 다운로드는 추가하지 않습니다.
- **새 파일 4개:**
  - `services/householdImportSources.ts`
  - `components/HouseholdImportGuide.tsx`
  - `services/householdCardImport.ts`
  - `services/householdImportReview.ts`
- **수정 파일:** `FormatModal.tsx` 1개
- **수정하지 않는 것:**
  - 저장, 중복, 합계 서비스
  - 카카오 파서 2개, `ledgerPeriodImport.ts`
  - Functions, Rules, 라우터, 모바일
- **화면 이름:** 「카드 이용내역 엑셀 시범 가져오기(아래 필수 열이 있는 양식)」. 어떤 국민카드 파일도 지원을 보장하지 않습니다.

## M1 거래 키

- 키는 `card:kb:` + 해시(fileDigest, 시트번호, 원본 행번호)로 만듭니다.
- fileDigest는 카카오와 같은 방식으로 정규화한 셀 내용의 해시입니다. 파일명은 넣지 않으므로 이름만 바꾼 같은 파일은 "이미 저장됨"이 됩니다.
- 카카오 파서에 해시 함수가 export되어 있으면 재사용합니다. 없으면 카카오 파일을 고치지 않고 같은 로직을 카드 모듈에 둡니다.
- 승인번호 열은 읽지도 저장하지도 않습니다.
- 다른 파일과 겹치는 거래는 기존 `householdDuplicates.ts`의 "의심" 판정을 그대로 씁니다.
- **테스트** (`householdDuplicates.test.mjs`에 추가):
  - 같은 파일을 이름만 바꿔 다시 넣음 → 이미 저장됨
  - 다른 파일에 승인번호·날짜·금액이 같은 행 → 의심(이미 저장됨 아님)
  - 같은 파일 안 반복 거래 2건 → 둘 다 신규

## M2 금액은 이용금액 하나만

**파일 읽기 전 확인**
- 파일 선택 버튼 바로 위에 필수 체크를 둡니다: "이 파일은 카드 **승인 이용내역**이며, 청구서나 월별 할부 청구 내역이 아닙니다."
- 체크하지 않으면 파일 선택이 꺼집니다.
- 이 확인값은 `cardImportContext.confirmedApproval`에 고정됩니다.

**금액 기준 안내**
- "이용금액(구매 전체금액) 기준으로 기록합니다. 할부도 전체금액 1건으로 기록되며, 월 청구분이 아닙니다."

**파일 전체 거부**
- 머리글에 청구 열(`이번달결제금액`, `결제원금`, `회차`, `결제예정금액`, `청구금액`, 공백 제거 후 비교)이 하나라도 있으면 거부합니다.

**할부**
- 할부 열이 없으면 위 사전 확인에 의존합니다.
- 할부 열이 있으면 값이 빈칸, `일시불`, `0`, `N개월`, 정수일 때만 허용합니다. 그 밖의 값이 1건이라도 있으면 파일 전체를 거부합니다(M4의 "불명확한 행" 원칙).

**외화**
- 현지금액이나 통화 열에 값이 있거나 원화 이용금액이 없으면 행 상태를 `blocked`로 둡니다.
- `amount=''`로 두고 선택할 수 없게 하며, "직접 입력해 주세요"라고 안내합니다.

**취소**
- 음수나 괄호 금액은 음수 지출로 두고, "취소·환불: 원거래와 함께 확인"이라고 안내합니다.
- 상태가 취소인데 금액이 양수면 `needsChoice`로 둡니다. 처음에는 미선택에 `amount=''`입니다.
- 사용자가 명시적으로 골라야 합니다:
  - "취소(음수)로 기록" → `-|이용금액|`, 선택 가능
  - "제외" → 계속 선택 불가
- 상태 값은 허용 목록으로만 판정합니다. 이 목록은 시범 규칙이며 국민카드 실제 값이라고 주장하지 않습니다.
  - 정상: `정상`, `승인`, `매입`
  - 취소: `취소`, `승인취소`, `매입취소`
  - 그 밖의 값이 하나라도 있으면 파일 전체를 거부합니다.
- "시범"이라는 표시가 이 규칙들을 면제하지 않습니다.

## M3 연도

- 날짜는 연도가 있는 형식만 받습니다:
  - `YYYY-MM-DD`, `YYYY.MM.DD`, `YYYY/MM/DD`, `YYYYMMDD`
  - 엑셀 날짜 셀
- 실제로 있는 달력 날짜인지 검증합니다.
- MMDD처럼 연도가 없는 날짜가 1건이라도 있으면 파일 전체를 거부합니다.
- `normalizeLedgerDate`와 그 기준연도 경로, 올해 추정은 쓰지 않습니다.

## M4 엄격한 머리글 검사 (파서: `householdCardImport.ts`)

**필수 열** (공백 제거 후 정확히 일치)
- 날짜: `이용일자` 또는 `이용일`
- 가맹점: `가맹점명` 또는 `가맹점`
- 금액: `이용금액` (`금액`, `결제금액`은 안 됨)
- 상태: `상태`

**선택 열:** `할부개월`·`할부`, `현지금액`·`해외이용금액`, `통화`. 나머지 열(이용카드, 승인번호 등)은 읽지 않습니다.

**파일 전체 거부 조건**
- 필수 열이 하나라도 없음
- 같은 필수 열이 두 번 나옴
- 머리글 후보 행이 2개 이상이거나, 앞 20행 안에서 머리글을 찾지 못함
- 날짜는 있는데 금액·가맹점·상태를 읽지 못하는 행이 1건이라도 있음
- 날짜 칸은 비어 있는데 다른 값이 있는 행이 있음 (합계 행 예외는 아래)

**버리는 행**
- 날짜 칸이 비어 있고 `합계`·`소계`·`총계` 문구가 있는 행
- 완전히 빈 행

**구현 원칙**
- 보조장부 파서(청구금액 우선 사용, `\d+건` 행 버림)는 재사용하지 않습니다.
- 금액은 엄격 정규식으로 읽습니다: 숫자·쉼표, 앞의 `-`, 괄호, 끝의 `원`. `parseHouseholdAmountText`의 "5천원" 같은 관대한 해석은 쓰지 않습니다.
- 거부 메시지에는 시트와 행 번호만 넣고 셀 값은 넣지 않습니다.

**같은 화면 안내:** 필수 열과 거부 조건을 표로 보여 줍니다. 사용자가 파일을 고르기 전에 자기 파일과 대조할 수 있게 해서, 항상 거부되기만 하는 기능이 되지 않게 합니다.

## M5 저장 검증 우회 차단

**행 정보 (parser row metadata)**
- 파서가 행마다 다음을 함께 돌려줍니다: `{entryId, sheet, rowNo, state: 'ok'|'blocked'|'needsChoice', cancelChoice?, expectedAmount, reasons}`
- 이 정보는 entry에 넣지 않고 FormatModal 상태 `cardImportRows`에 보관합니다.
- `cardImportContext`에 `{sourceId:'kbcard', fileDigest, confirmedApproval, cardType}`을 둡니다.

**순수 함수:** `householdImportReview.ts`의 `validateHouseholdImportSave(entries, context, rows)`

검사 항목 (실제로 보낼 entries를 하나씩 봅니다):
- `importSource.kind==='card'`인데 context가 없음 → 차단
- 메타 없음, `blocked`, `needsChoice`에서 아직 선택 안 함, `cancelChoice==='exclude'` → 차단
- 금액이 기대값과 다름 → 차단 (`expectedAmount`, 음수 선택 시 `-|이용금액|`)
- `fileDigest`가 고정값과 다름 → 차단
- `confirmedApproval`이 거짓이거나 `cardType` 미선택 → 차단
- `paymentMethod`가 고른 카드종류와 다름, 또는 `memo`가 비어 있지 않음 → 차단
- 카드가 아닌 entry는 통과 → 카카오와 수동 입력 동작은 바뀌지 않습니다.

**적용 위치** (저장 서비스는 고치지 않음)
- `handleSaveKakaoXlsxImport`(:3087): 미리보기 버튼(:5517)과 하단 공통 저장 버튼(:6889, 가져오기가 있을 때)이 함께 쓰는 함수입니다. `saveHouseholdEntriesBatch` 호출(:3117) 직전에 검사합니다.
- `handleSaveHouseholdEntries`(:2867): 하단 공통 저장(가져오기가 없을 때)과 `handleSaveOriginalAsSayu`가 쓰는 함수입니다. `saveHouseholdEntriesBatch` 호출(:2883) 직전에 검사합니다.
- 중복 확인 후 다시 저장할 때도 같은 함수를 거치므로 자동으로 검사됩니다.

**화면 쪽 보조 장치**
- `blocked` 행과 선택 전 `needsChoice` 행은 `amount=''`, 선택 토글 꺼짐, "모두 선택"에서도 빠짐(:3080 조건에 추가).
- 카드 행의 날짜·금액 입력은 읽기 전용입니다.
- 이렇게 해도 검사를 우회하면 `amount=''`라서 기존 저장 서비스가 한 번 더 거부합니다.

**테스트** (`householdImportReview.test.mjs`)
- 다음 각각을 차단:
  - 카드종류 미선택
  - 사전 확인 거짓
  - blocked 행 강제 선택
  - needsChoice 미선택
  - 금액 변조
  - 다른 fileDigest
  - 메타 없는 카드 entry
- 카카오 entry는 통과

## M6 기관 선택과 Function 차단

- 상태 `householdImportSourceId`(`'kakaobank'|'kbcard'`)를 둡니다. 카드 파일을 고르면 `pinnedCardFile={file, sourceId}`로 고정합니다.
- 다음 중 하나라도 해당하면 기관 라디오를 끕니다: 고정된 파일 있음, 읽는 중, 미리보기 있음, 저장 중(`householdSavingRef`).
- 기관을 바꾸면 다음을 모두 초기화합니다:
  - 미리보기(`kakaoXlsxMonthGroups`)
  - `householdChecks`, `householdDecisions`
  - `cardImportRows`, `cardImportContext`
  - 사전 확인값, 카드종류
- 카드 처리는 새 함수 `handleCardFileSelect`/`handleCardFileParse`로 분리합니다:
  - `accept=".xls,.xlsx"`
  - 20MB 제한
  - 앞 바이트가 ZIP(`50 4B`)이나 CFB(`D0 CF 11 E0`)일 때만 `XLSX.read`
  - 암호나 읽기 오류 → "암호 없는 파일로 받아 주세요"
  - `.pdf` 거부
  - 암호 입력창 없음, `httpsCallable` 없음
- 카카오 처리 함수(:2923, :2947)와 `xlsx|pdf` 검사는 그대로 둡니다.
- `householdCardImport.ts`는 `firebase/*`를 import하지 않습니다.
- **테스트:**
  - 카드 모듈 소스에 `firebase` import가 0건
  - 화면 단위 테스트에서 카드 경로 Function 호출 0회

## M7 계정 전환

- 카드 처리에도 세션 확인 3곳을 넣습니다:
  - 파싱 직후 (`session !== photoEditorSessionRef.current`)
  - 분류 기억을 불러온 뒤 (`ownsHouseholdSession`)
  - `checkHouseholdDuplicates` 뒤
- 새 상태(기관, 고정 파일, 행 정보, context, 사전 확인, 카드종류)는 기존 카카오 상태를 초기화하는 세션 전환 위치(:510 effect 계열)에서 함께 초기화합니다.
- **테스트:** 계정을 바꾸면 카드 상태가 비워지고, 늦게 도착한 결과는 버려짐

## M8 카드대금 후보

- `cardPaymentCandidates(rows)`는 순수 함수입니다.
- 지금 카카오 미리보기에 있는 새 은행 행 중 이미 저장됨이 아닌 지출만 봅니다. 가맹점에 `국민카드`, `KB국민카드`, `KB카드`가 들어 있으면 "카드대금 후보" 표시를 붙입니다.
- 사용자가 직접 "이체로 바꾸기"를 눌러야 합니다. 이때 기존 `changeKakaoTransactionType(month, id, '이체')`를 그대로 씁니다.
- 자동 전환은 없고, 이미 저장된 거래는 바꾸지 않습니다. R3의 읽기 전용 표시도 넣지 않습니다.
- 카드 미리보기 고정 안내: "이미 저장된 은행 카드대금, 승인일과 출금일이 다른 체크카드 거래, 카드대금 합산은 자동으로 판정하지 않습니다. 합계가 이중으로 잡힐 수 있습니다."
- **테스트:** 원본 불변, 저장된 행은 후보에서 빠짐

## M9 기관 안내표 (`householdImportSources.ts`와 Guide)

- **카카오뱅크 엑셀·PDF:** 현재지원. 01의 공식 링크 2개와 확인일을 표시합니다.
- **국민카드 엑셀:** 시범.
  - 이름: 「카드 이용내역 엑셀 시범 가져오기(아래 필수 열이 있는 양식)」
  - 경로: "국민카드 공식 홈페이지 MyKB > 카드이용 > 이용내역·매출전표"
  - 링크: `https://card.kbcard.com/MKB/DVIEW/HMBMCXPRIMYS0007`
  - "로그인 뒤 엑셀 저장 버튼과 앱 다운로드는 확인 전"
  - "어떤 국민카드 파일도 지원을 보장하지 않습니다"
  - 같은 화면에 M4 필수 열 표
- **미지원:** 국민카드 PDF, 암호가 걸린 카드 엑셀, 스캔 PDF, 다른 기관
- 링크와 문구는 구현하는 날 다시 확인합니다.
- **테스트** (SSR): 위 문구 3개와 필수 열 표가 보임, 카카오 링크와 확인일이 보임

## M10 장부 정정

02 §7-5를 폐기합니다. `NEXT_HANDOFF.md:61`의 9번(자동연동)은 35 문서로 대체되었습니다. 기존 기록 파일은 고치지 않습니다. 원문 보존과 자동연동 제외를 적은 새 장부 파일은 구현할 때 `docs/reviews/`에 작성합니다. 이번에는 쓰지 않습니다.

## M11 데이터 최소화

- 카드 entry 내용:
  - `transactionType:'지출'`, `vendor`, `amount`, `date`
  - `paymentMethod: '신용카드'|'체크카드'`
  - `memo:''`, 기본 분류, `categorySource:'import-default'`
  - `importSource:{kind:'card', issuer:'kb', fileDigest, key}`
- 다음 정보는 넣지 않습니다: 이용카드·카드번호, 승인번호, 파일명, 원문 행, 할부·외화 상세.
- 행 내용을 콘솔에 출력하지 않습니다.
- `HouseholdEntry.importSource` 타입은 위처럼 합집합으로 넓힙니다(:170–186). `kind==='kakao'` 분기는 그대로 둡니다.
- **테스트:** 저장 payload(`household_entries`, `household_sayu`) JSON에 합성 카드번호 조각과 승인번호가 없음

## M12 필수 테스트 (합성 자료만 사용)

| 파일 | 내용 |
|---|---|
| `householdCardImport.test.mjs` | xlsx와 xls(CFB) 읽기 / 청구 열 → 거부 / MMDD → 거부 / 상태 열 없음 → 거부 / 알 수 없는 상태값 → 거부 / 미판독 행 1건 → 파일 전체 거부 / 할부 해석 불가 → 거부 / 합계 행만 제외 / 외화 → blocked, `amount=''` / 취소+양수 → needsChoice / 음수·괄호 → 음수 지출 |
| `householdDuplicates.test.mjs` | M1 3건 |
| `householdImportReview.test.mjs` | M5와 M8 |
| `householdSave.emulator.test.mjs` | 기존 거래(사용자 분류·메모, 예전 단건 문서)가 가져오기 후에도 바이트 단위로 같음 / 같은 카드 파일 동시 저장 2건 → 1건만 추가 |
| 화면·SSR | M6, M7, M9 |
| 회귀 | 00-baseline 44건 통과, `npm run build` (dist는 배포하지 않음) |

## 카카오 영향, 멈춤 조건, 완료 판정

- **카카오 영향 없음:** 카카오 처리 함수와 검사는 그대로입니다. 검증 함수는 카카오 entry를 통과시킵니다. 바뀌는 것은 타입 확장뿐입니다.
- **멈추고 보고할 조건:**
  - 저장·중복·합계 서비스를 고쳐야 할 때
  - 이미 저장된 거래를 바꿔야 할 때
  - Function, Rules, 라우터, 모바일을 바꿔야 할 때
- **실제 국민카드 형식 검증:** 추가 E2E(🔍)로 남깁니다. 실제 머리글이 필수 열과 다르면 열 이름을 추가하지 않고 보고합니다.
- **승인 전에는 구현하지 않습니다.** 재검토 때는 04 원문과 이 반영 내역을 함께 넘깁니다.

작업 난이도: **5.5 높음**