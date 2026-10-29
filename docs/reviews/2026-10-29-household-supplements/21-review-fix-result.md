# PR #316 리뷰 반영 결과 (CC 실행, 미커밋)

- 요청 원문: [20-review-fix-request.txt](20-review-fix-request.txt). 기준 HEAD `14b20616a017ecb608a3375a52f37d4dfcc68058`, 브랜치 `codex-household-supplements`. 작업 난이도 **5.5 중간**.
- 판정 이력(초기화 없음): 독립 설계 **수정 후 승인 1회**([04](04-independent-design-result.md)) → 독립 완료 **승인**([19](19-independent-completion-01.md)). Codex 실행 1([18](18-codex-run01-result.md))의 필수 지적 2건이 이 반영 전까지 미해결이었으므로 19의 승인을 병합 승인으로 쓰지 않는다. 이 반영 뒤 **최신 HEAD Codex 재검토와 독립 재검토**를 다시 받아야 하며, 재검토 질문에 19 원문과 이 문서를 함께 넘긴다.
- 커밋·push·PR 갱신·병합·배포·Slack은 하지 않았다. 기존 검토 기록 파일은 수정하지 않았다(이 파일과 [21-unit.txt](21-unit.txt)만 추가).

## Codex 필수 지적 반영

| 지적 | 반영 | 반영 커밋 |
|---|---|---|
| [4410696753](https://github.com/hkd620-lab/haru2026/pull/316#discussion_r4410696753) 은행 미리보기 거래처 변경 시 자동 제안 분류 재계산 | 반영 | 미커밋 — 기장 커밋 후 보조 색인에 실제 SHA 기록 |
| [4410696761](https://github.com/hkd620-lab/haru2026/pull/316#discussion_r4410696761) 레거시 거래 수정 내용을 SAYU 거래 보기에 표시 | 반영 | 미커밋 — 위와 같음 |

### 1. 은행 미리보기 거래처 변경 (`FormatModal.tsx`, `householdVendorRules.ts`, `householdKakaoImport.ts`)

- 거래처 입력은 `updateKakaoRow({vendor})` 대신 `changeKakaoVendor`를 쓴다. 거래 객체만 바꾸고 행 id·`householdChecks`(중복 재확인 결과)·`householdDecisions`는 그대로다. 이미 저장된 행의 `disabled={rowLocked}` 잠금도 그대로다.
- 새 순수 함수 `resuggestHouseholdCategory(entry, defaultCategory, rules, views)`:
  - `categorySource === 'user'`이면 분류·세부분류를 그대로 둔다(사용자 선택 우선). 출처가 없는 값도 건드리지 않는다.
  - `'rule'`/`'import-default'`이면 이전 세부분류를 지우고, 분류를 **새 거래처 기준의 파서 기본값**(`mapCategory`를 export, PDF·XLSX 공통)으로 되돌린 뒤 `import-default`로 표시한다. 그 다음 기존 `suggestHouseholdCategory`로 새 거래처의 규칙만 다시 제안한다(보관 분류는 제외). 규칙이 없으면 `기타`/`기타수입`/`이체` + `import-default`가 되어 대시보드에서 **확인 필요**로 남는다. 첫 선택지(식비)로 확정하지 않는다.
- 같은 문제를 가진 구분 변경(`changeKakaoTransactionType`)의 대체값 `nextOptions[0]`(지출이면 식비, `import-default`라 확인 필요에서도 빠짐)도 같은 파서 기본값으로 바꿨다. 사용자가 고른 분류가 새 구분에도 있으면 유지하는 기존 동작은 그대로다.
- 원본 키(`id`, `importSource.key/fileDigest`), 금액, 날짜, `transactionAt`, `balanceAfter`는 바뀌지 않는다.

### 2. SAYU 상세의 예전 단건 거래 (`SayuModal.tsx`)

- `parseHouseholdEntriesForSayu`가 대시보드·편집과 같은 `householdRecordShape`를 쓴다.
  - `array`: 유효 거래(객체 + 거래 필드)만 표시. 대시보드와 같은 걸러내기.
  - `legacy`(`household_entries` 없음 또는 유효 거래 없는 `[]`): `household_date/type/category/subcategory/vendor/amount/payment/memo`로 거래 1건을 만들어 표시한다. 단건 편집의 메모·분류·세부분류가 그대로 보인다. 단건 필드도 비어 있으면 기존 본문 보기(textarea).
  - `corrupt`: 단건 필드로 대신하지 않고 기존 본문 보기 fallback을 유지한다. 원본을 고치거나 덮어쓰지 않는다.
- `householdSayuIsUserText`: 예전 단건 문서는 편집 서비스가 본문을 다시 만들지 않으므로(`legacyPatch`) 본문이 있으면 항상 **보존된 본문 안내**를 표시한다. 배열 문서는 기존 기준(자동 생성 본문과 다를 때만) 그대로.
- 메모 편집이 상세에 보이도록 수입·지출 카드에도 메모 줄(`메모: …`, 줄바꿈 유지)을 표시한다. 이체는 기존처럼 제목에 메모를 쓴다. 이 한 줄 외 화면 구성은 바꾸지 않았다.
- 표시 전용 변경이다. `household_sayu`·배열·단건 필드에 쓰지 않는다. SayuModal의 원본 저장(`saveHouseholdOriginal`) 경로는 바꾸지 않았다.

## 독립 권고 반영 (19의 권고 1–4)

1. **CRLF 메모**: 시트의 patch 결정을 `householdEditSheetPatch`로 꺼내 비교 양쪽을 같은 방식으로 줄바꿈 정규화한다. 분류만 바꾸거나 확정만 하면 patch에 `memo`가 없어 저장된 CRLF 문자열이 그대로 남는다. 사용자가 실제로 고친 메모만 보낸다(서비스가 LF로 정규화하는 기존 동작 유지).
2. **현금 입력의 보관 판정**: 설정 합치기를 순수 함수 `mergeLoadedHouseholdSettings`로 옮기고 `categoriesKnown`을 추가했다. 이 계정의 분류 설정을 실제로 읽었거나(같은 계정의 이전 성공 = 캐시) 트랜잭션 결과를 받았을 때만 알고 있는 상태다. 모르면 `householdSuggestionRules`가 빈 규칙을 돌려 현금 입력에 거래처 기억을 제안하지 않는다(은행과 같음). 분류 관리 화면의 규칙 목록 표시는 그대로다. 기존 revision(`settingsRevision`)·owner(`ownerUid`) 경계는 그대로 유지하며, 시작 후 트랜잭션이 반영된 항목은 늦은 조회 값으로 덮지 않는다. 다른 계정의 이전 상태는 캐시로 쓰지 않는다. 처음부터 분류 설정을 못 읽으면 "거래처 분류 제안은 쓰지 않고" 안내를 따로 표시한다.
3. **일괄 분류의 세부분류**: 시트에 "세부분류 없음으로 바꾸면 선택한 거래의 기존 세부분류(N건)가 지워집니다." / 세부분류를 고르면 "모두 ‘…’(으)로 바뀝니다." 안내를 표시한다. 저장 동작은 바꾸지 않았다.
4. **비교 기준 통일**: `householdCategories`의 비교 함수를 NFKC + 공백 정리 + 대소문자 무시(`sameHouseholdLabel`)로 하고, `householdRuleArchived`도 같은 함수를 쓴다. 대소문자·전각이 달라도 보관한 분류·세부분류는 다시 제안하지 않는다. 규칙 자체와 과거 거래는 지우거나 바꾸지 않는다. 부수 효과: 예전 거래에 공백·전각만 다른 같은 분류가 있으면 분류 목록에서 하나로 합쳐 보인다(거래 값은 그대로).

권고 5(손상 문서가 있으면 현금 저장 전역 차단)는 요청대로 우회·자동 정리하지 않았다. 원본 보존과 현재의 안전한 거부를 유지한다.

## 브라우저 검증 지원 (합성 하네스만)

- `test/household-dashboard-browser`에 시험 버튼 `legacy-array`를 추가했다. 누르면 합성 계정 `legacy-array`로 바뀌고, 이번 달 문서 1개에 **id·importSource가 없는 예전 배열 거래 3건**(내용이 같은 2건, CRLF 메모 1건)과 사용자 본문이 들어 있다. 운영 화면(현금 입력 모달 포함)에는 시험 버튼을 추가하지 않았다. 실제 금융자료·실사용 계정과 무관하다.
- 확인 방법(기장): 하네스 실행 → `legacy-array` → 같은 내용 2건 중 하나만 분류·메모 편집 → 다른 1건 그대로, CRLF 메모 거래는 분류만 바꿔도 메모 줄 유지 확인.

## 검증

| 명령 | 결과 |
|---|---|
| `cd frontend && node --import tsx --test --test-reporter=tap` 가계부 10개 + SAYU/형식 5개 파일(목록은 [21-unit.txt](21-unit.txt) 생성 명령과 같음: householdAmount, householdCashEntry, householdCategories, householdDashboard, householdDuplicates, householdEdit, householdExport, householdPdf, householdSavePreview, householdSummary, formatRegistry, sayuEditedTitle, sayuPhotoUpload, structuredAssistantRecords, polishCommentOptOut) | **173/173 통과** ([원문](21-unit.txt)). 새 단위·SSR 테스트 9개 포함(에뮬레이터 새 2개는 별도) |
| `node --import tsx --test test/sayuGrowthTimeline.test.mjs test/assistantSavedResultOpen.test.mjs` | 기존 실패 7건(성장타임라인 6 + assistantSavedResultOpen 1), 모두 `isSpecialDayRecord is not defined`(SayuPage). SayuPage는 바꾸지 않았고 성장타임라인 실패 6건은 [14 기준](14-growth-current.txt)과 같은 수다. 범위 밖이라 고치지 않았다 |
| `FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test --test-reporter=tap test/householdSave.emulator.test.mjs test/householdEdit.emulator.test.mjs` | **미실행** — 이 세션에서 환경변수 접두 명령이 도구 승인 필요로 막혔다. 우회하지 않았다. **기장 실행 필요**. 기대값: 이전 34 + 새 2 = 36건. 새 2건: 예전 단건(배열 없음·`[]`) 실제 편집 결과를 실제 SayuModal 상세로 렌더해 분류·세부분류·메모·보존 본문 안내 확인 + 사용자 본문·배열·다른 형식 필드 불변 / 분류만 고칠 때 CRLF 메모 문자열 불변 |
| 전체 TypeScript 검사 | **미실행** — `tsc` 실행이 도구 승인 필요로 막혔다. 대신 변경한 TSX/TS 10개 파일의 esbuild 변환(구문) 통과. 기존 ExportModal/성장타임라인 실패는 범위 밖 |
| `npm run build` | 미실행. 환경변수 없이는 실패하는 것이 알려져 있어 기장이 합성 변수로 실행한다 |
| `git diff --check` | 통과 |

새 테스트가 지키는 것:
- 거래처 변경: 규칙 없음 → `기타`+`import-default`(첫 선택지 `식비` 아님), 구독 키워드 → `구독료`, 다른 규칙 → 그 규칙·이전 세부분류 제거, 원래 거래처로 되돌리면 원래 규칙, 사용자 선택 불변, id·원본 키·금액·날짜·잔액 불변, 원본 객체 불변. FormatModal이 실제로 이 경로를 쓰고 `nextOptions[0]`이 없으며 잠금이 유지되는지 소스 계약.
- SAYU: 실제 `SayuModal.tsx` 함수의 AST 원문 실행(`test/householdSayuView.helper.mjs`, 공용). 배열 없음·`[]` 단건 / 손상 배열 fallback / 배열 자동·사용자 본문 안내와 메모 줄.
- 보관 판정: 전각·대소문자·공백이 다른 규칙의 보관 세부분류·분류 미제안, 규칙 수 불변, 병합 일치.
- 설정: 첫 조회 분류 실패 시 규칙 미제안, 다른 계정 상태 미사용, 같은 계정 캐시 유지, 늦은 결과가 트랜잭션 결과를 덮지 않음, 화면 연결.
- CRLF patch, 일괄 분류 세부분류 안내.

## 변경 범위

`frontend/src/app/components/{FormatModal,SayuModal,HouseholdEditSheet}.tsx`, `frontend/src/app/pages/HouseholdPage.tsx`, `frontend/src/app/services/{householdVendorRules,householdCategories,householdKakaoImport}.ts`, 테스트 4개 + 새 helper 1개, 합성 하네스 3개. Rules·Functions·AI·인증·결제·Firestore 경로·모바일·라우터(App/routes)·HaruRawPage·숨김 LibraryPage 변경 없음. 운영 데이터 쓰기 없음(로컬 에뮬레이터 테스트도 이번 세션에서는 실행하지 않음). 새 저장 필드 없음(`categoriesKnown`은 화면 상태만).

## 남은 제한

- 에뮬레이터 36건·전체 타입 검사·합성 변수 빌드는 기장이 실행해 결과를 기록해야 한다.
- 실제 브라우저 확인(은행 미리보기 거래처 변경, SAYU 단건 상세, `legacy-array` 시나리오, 일괄 분류 안내)은 아직 하지 않았다. 아이폰 PWA 실기기 E2E도 별도.
- 반영 커밋 후 Codex 색인 보조 파일에 실제 SHA를 적고 `@codex review`를 다시 요청한다. 스레드 resolve만으로 해결로 보지 않는다. 그 다음 독립 재검토(19 원문 + 이 문서 + 수정 diff 전달).
- 01 장부 4–9번(카드 연결, 반복·할부, 배분, 잔액, 목표, 가족 공유, 자동 연동)은 여전히 후속이다.
