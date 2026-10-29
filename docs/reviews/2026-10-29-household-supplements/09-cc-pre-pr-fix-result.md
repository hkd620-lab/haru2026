# 가계부 보완 1단위 PR 전 수정 결과 — CC 반영 내역 (승인 판정 아님)

- 작성: 2026-10-29 KST, 실행자 CC. 실행자의 반영 기록이며 독립 검토 판정이 아니다. 자기 승인하지 않는다.
- 근거: [08-pre-pr-fix-request.txt](08-pre-pr-fix-request.txt), [06-root-pre-review-findings.md](06-root-pre-review-findings.md), 독립 판정 [04-independent-design-result.md](04-independent-design-result.md) "수정 후 승인"(1회, M1–M7).
- 브랜치 `codex-household-supplements`, HEAD `2e622d82` 위 **미커밋 작업 트리**. 커밋·push·PR·병합·배포·Slack 전송 없음. 기존 검토 파일(HANDOFF, 01–08) 수정·삭제 없음. 운영 데이터 쓰기·마이그레이션 없음.
- 변경 없음: Rules, Functions, AI 호출, 인증, 결제, Firestore 경로 `users/{uid}/records/{date}`, Functions 리전, 모바일, App.tsx/routes.tsx, ExportModal.tsx.

## 1. 요청별 반영

| # | 요청 | 반영 | 위치 |
|---|---|---|---|
| 1 | M1 해석 보완 | 대시보드의 "id 없음"·"같은 식별키 여러 건" 편집 차단을 없앴다. 편집 위치는 `recordId + rawIndex` 하나뿐이고, 열 때의 원본 지문이 지금과 같은지 확인한다. identity는 **같은 위치에서만** 비교한다(`householdIdentity`와 같은 값, id가 없으면 `manual:undefined`). 다른 위치를 찾는 경로는 없다. 편집 서비스에서 `!entry.id`와 identity 개수 검사를 없앴다. 계속 막는 경우: 기록 문서 id 없음, 손상 배열, 문서 없음, 위치 이동·범위 밖, 지문 불일치, 한 요청 안의 같은 위치 중복. 없던 id·importSource를 만들지 않고, 있던 값도 바꾸지 않는다(`applyHouseholdPatch`는 분류·세부분류·메모·categorySource만 쓴다). | `frontend/src/app/utils/householdDashboard.ts:46`, `:118`; `frontend/src/app/services/householdEditService.ts:130` |
| 2 | `'[]'` + 예전 단건 필드 문서에 추가할 때 보존 | `householdStoredEntries`가 대시보드·편집과 같은 `householdRecordShape` 판정을 쓴다. 판정 결과별 처리: **array**는 저장 배열 그대로. **legacy**는 단건 필드에 거래 내용이 있으면 `[...거래 없는 원 배열 항목, 단건 거래]`, 없으면 원 배열 그대로(실제 빈 문서). **corrupt**(깨진 JSON, 배열이 아닌 값, 문자열이 아닌 값)는 "기존 가계부 내역을 읽지 못했습니다. 저장하지 않았습니다."로 거부한다. `household_entries`가 없는 문서는 기존 규칙(`legacy:{recordId}` 거래로 변환한 뒤 추가)을 그대로 따른다. 변환한 단건 거래에는 저장된 `household_subcategory`/`household_categorySource`가 있을 때만 함께 넣는다. 상위 단건 필드·`household_importKeys`·다른 형식 필드·제목은 기존 merge 저장 규칙대로 남는다. 단건 문서를 편집하면 계속 단건 필드만 고친다. 단건 문서를 연 사이 거래가 추가되면 지문이 달라져 충돌로 처리한다(기존 그대로). | `frontend/src/app/services/householdDuplicates.ts:33` |
| 3 | mounted ref | 세 곳 모두 `useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, [])`로 바꿨다. | `HouseholdCashEntry.tsx`, `HouseholdEditSheet.tsx`(`useSubmitting`), `HouseholdCategoryManager.tsx` |
| 4 | 분류 관리 계정 경계·설정 조회 경쟁 | `managerOpen:boolean` 대신 `managerOwner:uid`를 쓴다. 현재 uid와 같을 때만 그리고 `key={uid}`를 붙여, 계정이 바뀐 첫 프레임에도 이전 탭·입력·안내가 보이지 않는다. 설정 변경 트랜잭션 결과를 반영할 때(`keepSettings`)마다 `settingsRevision`의 categories/rules 번호를 올린다. 초기 조회와 재조회는 시작할 때 번호를 기억해 두고, 끝났을 때 번호가 바뀐 항목은 덮지 않는다(늦게 도착한 과거 값 무시). 첫 조회가 끝나기 전 변경이 오면 그 결과로 소유 설정을 만든다. 재조회가 실패하면 마지막으로 받은 값을 유지하고 오류를 표시한다. 현금 저장 직후 `setReload`→조회 시작→`rememberVendor` 트랜잭션 반영 순서에서도 rules 번호가 바뀌므로, 늦게 온 조회가 새 규칙을 지우지 않는다. | `frontend/src/app/pages/HouseholdPage.tsx`(`settingsRevision`, 설정 조회 effect, `keepSettings`, 분류 관리 렌더) |
| 5 | 보관 분류 제안·already 재시도 | `suggestHouseholdCategory(entry, rules, views?)` 규칙: 규칙의 분류가 보관됐으면 제안하지 않는다(파서 기본값 유지). 세부분류만 보관됐으면 분류만 제안한다. 규칙은 지우지 않는다. 적용 위치는 현금 입력과 은행 미리보기(파싱 직후, 구분 변경 시) 두 곳이다. 분류 관리의 거래처 기억 탭에 "보관한 분류라 새 거래에 제안하지 않습니다" 또는 "보관한 세부분류라 ‘…’ 분류만 제안합니다"를 표시한다. 현금 재시도: 서로 다른 내용으로 여러 번 실패하면 어느 시도가 저장됐는지 단정하지 않는 표시를 남긴다. `householdCashRetryDiff`는 `changedAfterFailure`(미반영 안내 유지)와 `rememberMismatch`(구분·거래처·분류·세부분류가 실패한 시도와 다름)를 판정한다. `already`이고 mismatch이면 거래처 기억을 저장하지 않고, 이유와 목록에서 다시 지정하는 방법을 안내한다. 메모만 바뀐 경우에는 기억을 그대로 저장한다. | `frontend/src/app/services/householdVendorRules.ts:30`, `frontend/src/app/components/HouseholdCashEntry.tsx:30`, `FormatModal.tsx`(호출 인자 2곳), `HouseholdCategoryManager.tsx`, `HouseholdPage.tsx`(`onCashSaved`) |
| — | 로그아웃 null 접근(06-root 1) | CC가 이전에 고친 `uid && …ownerUid === uid` 조건을 그대로 두고, 회귀 SSR 테스트로 고정했다. user=null 및 다른 uid 첫 프레임에서 예외 없이 그려지고 이전 계정 거래가 보이지 않는다. | `frontend/test/householdSummary.test.mjs`(마지막 테스트) |

## 2. 테스트 변경

- `test/householdEdit.test.mjs`
  - 기존 "id 없는 거래·중복 id·중복 출처키 → 편집 차단" 테스트를 M1 의미로 바꿨다. id 없는 3건, 중복 id 2건, 같은 출처키 2건이 모두 서로 다른 `recordId#rawIndex`를 갖는다. 조회는 원본을 바꾸지 않는다. 기록 id 없음과 손상 배열은 계속 막는다.
  - 신규 3개: `[]`+단건 저장 읽기(실제 빈 문서·거래 있는 배열·손상·기존 단건 구분), 보관 분류·세부분류 제안 제외, 현금 재시도 차이 판정.
- `test/householdCashEntry.test.mjs` 신규 2개(소스 계약): mounted setup 복원 3곳, 분류 관리의 `managerOwner === uid`·`key={uid}`·설정 수정 번호·mismatch 시 기억 생략.
- `test/householdSummary.test.mjs`: SSR 로더에 user 인자를 추가했다(기본값은 기존과 같다). 로그아웃·계정 전환 회귀 1개를 추가했다.
- `test/householdEdit.emulator.test.mjs`(실제 SDK + 기존 Rules)
  - 기존 단건 테스트의 "중복 id·id 없음 → 거부" 부분을 바꿨다. 이제 열 때와 다른 위치·지문(같은 id 이웃 위치, 범위 밖)으로 보내면 거부하고 문서가 그대로인지 확인한다.
  - 신규 **M1 위치 편집**: id 없는 두 거래(내용도 같음)·중복 id·id까지 같은 동일 내용 두 건·같은 출처키를 각각 위치대로 편집한다. 이웃은 deep-equal로 그대로이고, id 유무·importSource·formats·importKeys·사용자 본문·상위 메모·다른 형식 필드도 그대로다. 같은 위치 중복 요청, 지문 불일치, 위치 이동, 범위 밖, 문서 없음은 거부한다. 같은 수정 재전송은 unchanged로 처리한다.
  - 신규 **`[]`+단건 문서 현금 추가**: 합성 529건 + `[]`+단건 문서(메모 줄바꿈·세부분류·importKeys·다른 형식) + 실제 빈 문서에 현금 2건을 추가한다. 단건 거래가 배열 첫 항목으로 남고 상위 필드·importKeys·제목·다른 형식·formats는 그대로다. 본문은 덧붙이기만 한다. 다른 문서는 deep-equal로 그대로다. 전체 530→532건, 같은 현금 재시도는 `already`로 쓰기 없음.
  - 신규 **손상 배열 달에 현금 추가 거부**: 원본이 그대로인지 확인한다.

## 3. 검증 결과

| 항목 | 결과 | 로그(git 무시 경로 `scripts/qa/results/household-supplements-2026-10-29/`) |
|---|---|---|
| 가계부 단위·SSR·가져오기 10개 파일(householdEdit, CashEntry, Categories, Summary, Dashboard, Duplicates, SavePreview, Pdf, Export, Amount) | **89/89 통과** | `pre-pr-fix-unit.log` |
| 관련 형식·SAYU 회귀(formatRegistry, sayuAssistantAdapters, sayuEditedTitle, originalSaveAutoTitle) | **47/47 통과** | 터미널 출력 |
| `sayuGrowthTimeline.test.mjs` | **6개 실패, 이번 변경과 무관한 기존 문제로 판단** — `ReferenceError: isSpecialDayRecord is not defined`. HEAD의 `SayuPage.tsx:66`에 이미 `isSpecialDayRecord` import가 있는데, 테스트 하네스(`sayuGrowthTimeline.harness.mjs`, 미변경)가 이를 넣어 주지 않는다. 이번 브랜치의 SayuPage 변경은 검색 원문 조건 1개뿐이다. 이전 162개 실행 목록에도 없었다. 수정 범위 밖이라 고치지 않았다. | 터미널 출력 |
| `git diff --check` | **이상 없음** | — |
| 실제 SDK/Rules 에뮬레이터(`householdSave.emulator` + `householdEdit.emulator`, 기존 31 + 신규 3) | **CC 미실행** — 이 환경에서 실행 승인이 필요해 막혔다. 요청대로 다시 묻지 않았다. 기장이 이미 실행 중인 127.0.0.1:18867에서 실행해야 한다. | — |
| 변경 파일 타입 검사 | **CC 미실행** — 같은 이유. 설정 파일은 준비해 두었다. | `tsconfig.pre-pr-fix.json` |
| `npm run build`, 브라우저 하네스(18769) | **CC 미실행** — 기장 검증 대상 | — |

기장 실행 명령:

```sh
cd frontend
FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs test/householdEdit.emulator.test.mjs
cd .. && functions/node_modules/.bin/tsc -p scripts/qa/results/household-supplements-2026-10-29/tsconfig.pre-pr-fix.json   # 변경 파일만, 기존 오류와 구분
cd frontend && npm run build
```

브라우저 하네스 추가 확인 권장:
1. 분류 관리를 연 채 계정을 전환하면 바로 닫히고, 다시 열었을 때 이전 입력이 없어야 한다.
2. 거래처 기억 저장 직후 새 현금 입력에서 그 거래처의 분류가 제안돼야 한다.
3. 보관한 분류의 규칙은 제안되지 않고, 거래처 기억 탭에 안내가 보여야 한다.
4. id 없는 예전 거래도 수정 시트가 열려야 한다.

## 4. 남은 위험·판단 필요

- 에뮬레이터·타입·빌드는 CC가 직접 돌리지 못했다. 기장이 실행해 통과를 확인하기 전에는 완료로 보지 않는다.
- `household_entries`가 빈 문자열 `''`이면 공통 판정에 따라 `[]`와 같게 본다(전에는 저장할 때 JSON 오류로 거부했다). 대시보드 표시 기준과 맞춘 결과다.
- 현금 already에서 mismatch가 아니면(메모만 다름 등) 기억을 저장한다. 실패한 시도가 여러 번이고 내용이 서로 달랐으면 언제나 mismatch로 처리한다.
- 운영 529건 중 id 없는 거래도 이제 편집할 수 있다. 편집해도 id는 새로 만들지 않는다. 그런 행의 분포는 운영 읽기로만 확인할 수 있다.
