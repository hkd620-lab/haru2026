# 가계부 보완 1단위 설계: 현금 입력, 분류, 편집, 거래처 기억

파일은 하나도 수정하지 않았습니다. 확인한 기준은 브랜치 `codex-household-supplements`, origin/main `2e622d82`입니다. 이번 단위는 Rules, path, 인증, 결제, Functions, AI를 바꾸지 않습니다.

## 0. 확인한 사실
- 가계부 거래는 `users/{uid}/records/{YYYY-MM-01_household}` 문서의 `household_entries`에 JSON 문자열로 들어 있습니다. 예전 단건 필드(`household_category` 등)로만 된 문서도 있습니다.
- 거래 식별키는 `householdIdentity`(`householdDuplicates.ts:28`)이고 `importSource.key` 또는 `manual:${id}`입니다. 재가져오기는 키가 같으면 `already`로 처리하고 추가만 합니다(`householdSaveService.ts:90-105`). 그래서 이미 저장된 거래는 덮어쓰지 않습니다.
- 대시보드의 `sourceKey`(`householdDashboard.ts:88`)는 빈 거래를 걸러낸 **뒤의 위치**입니다. 저장 배열의 실제 위치와 다를 수 있어 편집 키로 쓸 수 없습니다.
- `users/{uid}/settings/{id}`는 이미 본인만 읽고 쓸 수 있습니다(`firestore.rules:262,327`). 예산(`settings/householdBudget`)이 이 경로를 씁니다. 따라서 새 설정 문서를 추가해도 Rules 변경이 필요 없습니다.
- 은행 가져오기는 기본값으로 `기타`/`기타수입`/`이체`를 넣습니다(`householdKakaoImport.ts:104`). 그래서 사용자가 직접 고른 `기타`와 자동 기본값을 지금은 구분할 수 없습니다.
- 대시보드의 두 버튼은 같은 `openEntry`를 부릅니다(`HouseholdPage.tsx:240,313,321`).

## 1. 데이터 모델 (기존 필드는 그대로, 선택 필드만 추가)
`HouseholdEntry`(`FormatModal.tsx:162`)에 선택 필드 두 개를 추가합니다.
- `subcategory?: string`
- `categorySource?: 'user' | 'rule' | 'import-default'`: 새로 저장하거나 수정한 거래에만 붙입니다. 기존 529건에는 쓰지 않습니다.

설정 문서 두 개를 새로 둡니다. 둘 다 `settings` 경로입니다.
- `settings/householdCategories`: `{ version:1, types:{ 수입|지출|이체: [{ name, subcategories:[name], archived? }] } }`
  - 기본 목록은 코드에 두고 화면에서 합칩니다. 이체 기본값으로 `계좌이동, 저축·투자, 카드대금, 대출상환, 기타이체`를 추가합니다.
  - 이름은 NFKC 정규화·trim 후 같은 유형 안에서 중복을 막습니다. 길이 40자 이하, 유형당 200개 이하입니다.
  - 삭제는 하지 않고 `archived`로 숨기기만 합니다. 거래에는 기존처럼 분류 **이름 문자열**을 저장합니다.
  - 이름 바꾸기는 이번 범위에서 제외합니다. 지원하려면 거래를 일괄로 고쳐야 하기 때문입니다.
- `settings/householdVendorRules`: `{ version:1, rules:{ "<유형>|<정규화 거래처>": { vendorLabel, category, subcategory?, updatedAt } } }`
  - 거래처 정규화는 NFKC, 소문자, 공백 축약 후 **정확히 같을 때만** 일치로 봅니다. 규칙은 2,000개 이하입니다.
- 두 설정 문서는 모두 `runTransaction`으로 읽고 고친 뒤 씁니다. 두 기기에서 동시에 추가해도 둘 다 남습니다.

## 2. 현금 간편 입력
- `HouseholdPage.tsx`에서 "현금 등 거래 추가" 버튼을 새 `components/HouseholdCashEntry.tsx`(바텀시트)에 연결합니다. 은행 버튼은 지금처럼 `openEntry`(`/record`)로 갑니다. 라우터, `routes.tsx`, App.tsx는 바꾸지 않습니다.
- 입력 항목: 날짜(오늘 로컬 날짜 기본), 지출/현금 수입 선택(지출 기본), 금액, 사용처 또는 받은 곳, 유형별 분류와 세부분류(선택·직접 입력, 직접 입력하면 설정에 추가), 선택 메모. `paymentMethod`는 `'현금'`으로 고정합니다.
- 사진, 영수증, 파일, 이체, 결제수단, 테스트 버튼은 넣지 않습니다. 입력 전에는 거래 수나 중복 문구를 보여 주지 않습니다.
- 저장은 기존 `firestoreService.saveHouseholdRecord`를 그대로 씁니다. 같은 트랜잭션, 중복 판정, 사용량 기록 경로입니다.
  - 중복 의심이면 기존 `HouseholdDuplicateReview`로 건너뛰기/그대로 저장을 고르게 하고 다시 저장합니다. 같은 날 같은 금액의 정상 반복 거래는 "그대로 저장"으로 남길 수 있습니다.
  - 거래 `id`는 시트를 열 때 한 번 만들고, 저장에 성공했을 때만 새로 만듭니다. 네트워크 상태가 애매해서 다시 보내도 `manual:id`가 `already`가 되어 두 번 저장되지 않습니다.
  - 저장 중에는 버튼을 막고, 성공하면 대시보드를 다시 불러옵니다.

## 3. 저장된 거래의 개별/일괄 수정 (핵심)
새 파일 `services/householdEditService.ts`에 `updateHouseholdEntries(db, uid, edits)`를 만듭니다.
- **위치 정보(locator)**: `{ recordId, rawIndex, identity, fingerprint }`
  - `readHouseholdDashboard`가 `recordId`와 **걸러내기 전 원래 배열 위치**(`rawIndex`)를 함께 넘기게 합니다. 기존 `sourceKey`와 집계는 그대로 둡니다.
  - `fingerprint`는 원본 거래 객체의 `householdDigest`입니다.
- **트랜잭션 처리**: 관련 월 문서를 모두 읽고, 문서마다 `householdStoredEntries`로 거래를 꺼냅니다.
  - id나 `importSource`가 있으면 식별키로 찾고, 없으면 `rawIndex`로 찾습니다.
  - 찾은 거래의 지문이 다르거나 거래가 없으면 `HouseholdOriginalConflict`를 던지고 **아무것도 저장하지 않습니다**(일부만 저장 금지).
- **바꾸는 필드는 셋뿐**: `category`, `subcategory`, `memo`. 바꾸면 `categorySource:'user'`를 붙입니다. 날짜, 금액, 거래처, 식별키, `balanceAfter`, `transactionAt`, `household_importKeys`, 다른 형식 필드, 배열 순서와 개수는 그대로입니다.
- **예전 단건 문서**(`legacy:` id, `household_entries` 없음)는 `household_category`·`household_memo`·`household_subcategory` 필드만 고칩니다. `household_entries`를 새로 만들지 않습니다.
- `household_sayu`는 덧붙여 쌓는 기록이라 고쳐 쓰지 않습니다. 메모를 고쳐도 sayu 문자열은 그대로입니다. 검토자가 확인할 지점입니다.
- **동시 저장**
  - 다른 기기의 거래 추가와 겹치면 Firestore 트랜잭션이 재시도하고 양쪽 다 남습니다.
  - 같은 거래를 동시에 수정하면 지문이 달라져 뒤에 저장한 쪽이 충돌 오류를 받습니다.
  - 기존 `saveHouseholdOriginal`은 `household_entries` 문자열을 비교하므로 편집기를 연 뒤 수정이 있었으면 충돌로 막힙니다.
- **입력 제한**: 분류 40자, 메모 500자, 제어문자 금지. 일괄 수정은 한 번에 300건 이하이고 문서 수 400 상한은 기존 저장과 같습니다.
- **화면**(`HouseholdPage.tsx` 목록)
  - 행을 누르면 수정 시트(분류·세부분류·메모, "이 거래처 다음에도 이 분류 제안" 체크, 기본은 꺼짐)가 열립니다.
  - "선택" 모드에서 여러 건에 분류를 한 번에 지정합니다. 일괄 수정에서 메모는 바꾸지 않습니다.
  - "분류 확인 필요" 필터는 분류가 비어 있거나, `categorySource`가 없으면서 `기타`/`기타수입`/`이체`인 거래를 모아 보여 주기만 합니다. 데이터는 바꾸지 않습니다.
  - 세부분류는 목록에 표시하고 분류별 통계에서 펼쳐 볼 수 있게 합니다. 기존 집계 기준은 그대로입니다.
- **은행 가져오기 미리보기**(`FormatModal.tsx:5347` 근처, 가계부 분기 안에서만): 고정 목록에 사용자 분류, 직접 입력, 세부분류를 더합니다. 다른 기록 형식에는 영향이 없습니다.

## 4. 거래처 분류 기억 (명시적으로 만든 규칙만)
- 규칙은 사용자가 수정 시트에서 체크했을 때만 만들거나 고칩니다. 설정에서 목록을 보고 지울 수 있습니다.
- 규칙은 **아직 저장 전인 새 거래**(현금 시트, 가져오기 미리보기)의 분류가 비어 있거나 가져오기 기본값일 때만 채웁니다. 이때 "기억한 분류" 표시와 함께 `categorySource:'rule'`을 붙이고, 사용자가 바꾸면 그 선택이 우선합니다.
- 이미 저장된 거래(529건 포함)에는 자동으로 적용하지 않습니다. 체크 없이 한 번만 바꾼 분류는 규칙을 만들지 않습니다. AI 호출은 없습니다.

## 5. 테스트 (기존 단위 58개, 에뮬레이터 20개, 빌드 통과는 유지)
- **단위 테스트**
  - `householdEdit.test.mjs`: id·importSource·id 없음(rawIndex)·예전 단건 각각의 위치 찾기, 걸러낸 위치와 원래 위치가 다른 경우, 지문 불일치 시 충돌, 허용한 세 필드만 바뀌는지.
  - `householdCategories.test.mjs`: 기본값 합치기, NFKC 중복 막기, 유형 간 분리, archived, 상한.
  - `householdVendorRules.test.mjs`: 정규화, 정확 일치만, 새 거래에만 적용, 사용자 선택 우선, 저장된 거래에 미적용.
- **에뮬레이터** `householdEdit.emulator.test.mjs` (메모 포함 합성 529건, 여러 월, 예전 단건 섞음)
  - 30건 일괄 수정 후 전체 개수 529, 대상이 아닌 거래·문서·`importKeys`·메모가 그대로인지(deep-equal).
  - 동일 거래 동시 수정 → 하나는 충돌. 수정과 같은 월 추가가 동시에 일어나도 둘 다 보존.
  - 수정 후 같은 카카오 파일 재가져오기 → `already`이고 수정한 분류·메모 유지.
  - 편집기를 연 뒤 수정이 있었으면 `saveHouseholdOriginal` 충돌.
  - 설정 문서 동시 추가 → 둘 다 남음.
- **현금 저장 에뮬레이터**: 새 월 문서 생성, 같은 id로 다시 보내면 `already`, 같은 날 같은 금액은 의심 → 그대로 저장/건너뛰기.
- **브라우저 하네스**(`household-dashboard-browser`): 현금 시트에 금지 버튼이 없고 빈 상태에 거래 수 표시가 없는지, 375px 모바일, 실패 시 오류 표시, 계정 전환, 합성 529건 조회와 수정.
- **실행 명령**: `cd frontend && npm run build`, 변경 영역 `frontend/test/*`, 에뮬레이터 테스트. 운영에서는 거래를 저장하지 않고 읽기만 확인하며, 아이폰 PWA는 추가 E2E가 필요하다고 따로 표시합니다.

## 6. 후속 단위 장부 (전체 표를 유지하고, 각 단위마다 같은 8.1 절차)
| 순서 | 항목 | 설계 방향 | 막는 요인 |
|---|---|---|---|
| 4 | 카드내역 가져오기와 이중합산 방지 | 범용 열 매핑과 `importSource.kind:'card'`. 통장의 `이체/카드대금` 거래와 카드 승인 내역을 `linkId`로 연결하고, 통장 쪽은 지출 집계에서 제외. 체크카드 은행·카드 양쪽 거래는 기존 중복 의심 흐름 재사용 | 카드사 형식(합성 샘플로 먼저 진행) |
| 5 | 반복·고정지출·할부 | `settings/householdSchedules`에 예정 거래를 두고 실제 거래와 분리, 실제 거래와 맞으면 예정을 소진. 할부는 원구매와 회차 중 집계 기준을 하나로 명시 | 없음 |
| 6 | 한 거래 여러 분류 배분 | 거래에 `splits[{category,amount}]`, 합계가 원거래 금액과 같아야 함. 집계는 배분만 더하고 원본 식별키·총액 보존 | 없음 |
| 7 | 계좌 잔액 대조 | `settings/householdAccounts`(기초잔액·기준일)와 `balanceAfter`로 대조. 정보가 부족하면 "확인 불가"로 표시 | 기초잔액 입력 |
| 8a | 저축 목표 | 예산 문서와 분리한 목표 문서 | 없음 |
| 8b | 가족 조회 공유 | 소유자가 고른 월·기간만 별도 읽기 전용 공유 문서(`householdShares/{id}`)에 복사. 초대한 uid만 읽기, 소유자만 쓰기·해제. `records`에는 접근 불가, 자동 공유·자동 갱신 없음(소유자가 "공유 갱신"을 누를 때만) | **Rules 추가 필요.** 8.1에서 Rules 변경은 멈춤 조건이므로 Rules와 에뮬레이터 테스트까지 준비한 뒤 정책 절차를 따름 |
| 9 | 은행·카드 자동 연동 | 공급자·비용·동의 조건 조사 후 보고. 동작하지 않는 연결 버튼은 배포하지 않음 | 계약·자격증명 |

## 7. 검토자가 확인할 지점
- 예전 단건 문서에 `household_subcategory` 필드를 새로 추가하는 것이 괜찮은지.
- 메모를 고쳐도 `household_sayu`를 그대로 두는 방침.
- "분류 확인 필요" 판정 기준(기본값 세 개와 `categorySource` 없음).
- 이번 단위는 Rules 변경이 없으므로 멈춤 조건에 해당하지 않는다는 판단. 작업 규모(소·중·대) 판정은 8.1에 따라 검토자가 정합니다.

## 8. 변경 예정 파일
`HouseholdPage.tsx`/`.css`, 새 파일 `HouseholdCashEntry.tsx`, `householdEditService.ts`, `householdCategories.ts`, `householdVendorRules.ts`, `householdDashboard.ts`(`recordId`·`rawIndex` 추가), `FormatModal.tsx`(가계부 미리보기의 분류 부분만), `firestoreService.ts`(필요하면 감싸는 함수만), 테스트 파일.

모바일, Functions, Rules, `routes.tsx`, App.tsx는 바꾸지 않습니다.

난이도: **5.5 높음**