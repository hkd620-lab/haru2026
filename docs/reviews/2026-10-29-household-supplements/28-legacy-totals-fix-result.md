# PR #316 추가 리뷰 반영 — SAYU 전체 합계의 레거시 단건 포함 (CC 실행 결과)

- 요청 원문: [27-legacy-totals-fix-request.txt](27-legacy-totals-fix-request.txt)
- 기준 HEAD: `28873c6c8abd2cdbb599084477cbc5a9aed0a913` (작업 트리 미커밋 변경. 커밋·push·PR·배포·Slack 없음 — 이 세션은 `.git` 쓰기가 막혀 있고, git 읽기 명령도 승인 필요로 막혔다)
- 대상 지적: Codex 실행 2 P2 [4411045874](https://github.com/hkd620-lab/haru2026/pull/316#discussion_r4411045874) (리뷰 `5696009830`), 독립 검토 26 권고 1(사용자 본문 접근성)
- 독립 판정 이력은 초기화하지 않는다: 설계 수정 후 승인 1회(04) → 승인(19) → 승인(26). 이번 변경은 Codex 재검토와 독립 재검토가 다시 필요하다. 재검토 질문에는 [26 원문](26-independent-completion-02.md) + 이 문서 + 수정 diff를 함께 넘긴다.
- 병합 금지 상태 유지: 최신 HEAD Codex 재검토 전까지 판정① 조건 3 미충족.

## 1. 원인 (코드 확인 결과)

1. **지적 그대로**: `SayuPage.tsx`의 `allHouseholdEntries` IIFE가 `household_entries` 배열만 모았다. 전체보기에서 레거시(배열 없음·`[]`) 기록을 열면 상세 목록에는 레거시 거래가 보이지만, 상단 합계는 배열형 거래만으로 계산됐다(레거시 3,000 + 배열 5,000 → 지출 5,000원).
2. **추가로 찾은 실제 연결 결함** (기존 테스트가 원본 문서를 SayuModal 함수에 직접 넣어 놓쳤다): SayuPage가 넘기는 `originalData`는 키에 `sayu`가 들어간 값과 문자열이 아닌 값을 뺀다. 그래서 실제 화면에서는
   - `household_sayu`가 빠져 `householdSayuIsUserText`가 항상 거짓 → 75f2f0ce에서 넣은 "기록 본문은 작성 당시 내용" 안내가 **실제 SAYU에서는 뜨지 않았다**.
   - 숫자 `household_amount`(예: `3000`)가 빠져 레거시 카드가 **0원**으로 보였다.
   - 레거시 `household_date`가 없을 때 기록 날짜로 대신할 값이 없었다.
   이 결함이 남아 있으면 "상세와 합계가 같은 읽기"가 될 수 없어 이번 범위에서 함께 고쳤다. 원본 칸(`originalData`)·원본 편집·저장 경로는 바꾸지 않았다.

## 2. 변경 파일과 핵심 변경

| 파일 | 변경 |
|---|---|
| `frontend/src/app/utils/householdRecordShape.ts:54-90` | `HouseholdSayuEntry` 타입과 `householdSayuEntries(record)` 추가. 기존 `parseHouseholdEntriesForSayu` 본문을 그대로 옮겼다(배열형은 거래 필드가 있는 객체만, 배열 없음·`[]`은 단건 필드 1건, 손상 배열은 `[]`). 변경점은 레거시 날짜 대체 `household_date \|\| date` 하나. 금액은 숫자·문자 모두 `String()`으로 원문 유지 |
| `frontend/src/app/components/SayuModal.tsx` | `parseHouseholdEntriesForSayu`가 공통 함수를 부른다(`:70-73`). `householdSayuViewData`(`:77`) = `{...열린 기록 원본, ...원본 칸}` 표시용 복사본 — 원본 칸에서 빠진 본문·숫자 금액·날짜를 원본에서 읽고, 원본 칸 값(편집 결과)이 위에 온다. 선택 prop `householdRecord`(`:576`, 읽기 전용). 상세 목록·사용자 본문 판정·본문 문자열을 이 복사본으로 계산(`:667-670`). 두 렌더 지점은 같은 인자. `renderHouseholdSayuView`에 사용자 본문 안내 아래 **기본 닫힌 `<details>` "작성 당시 본문 보기"**(`:188-193`) — 본문 문자열을 React 텍스트로 그대로 표시(HTML 해석 없음), 저장·AI·본문 재생성 경로 없음 |
| `frontend/src/app/pages/SayuPage.tsx` | `buildSayuOriginalData`(`:597`) — `openFormatSayu`의 원본 칸 생성 코드를 그대로 옮긴 함수(동작 동일, `:2447`에서 호출). `buildSayuHouseholdTotals`(`:617`) — 기존 IIFE 본문을 옮기고 수집부만 `householdSayuEntries`로 교체. 현재 기록이 한 달짜리 배열이면 `undefined`(자체 합계), 월별보기면 `undefined`, 전체보기만 전체 합계 — **기존 범위/월별 bypass 그대로**. `household_` 키가 있는 기록만 모으고 손상 배열 기록은 제외(이전 catch skip과 같음). 같은 내용 거래 중복 제거 없음. `householdRecord` prop 전달(`:5550`, 가계부일 때 `records.find(id)`) |
| `frontend/test/householdSayuView.helper.mjs` | AST 로더를 함수로 정리하고 `householdSayuViewData`, SayuPage의 `buildSayuOriginalData`·`buildSayuHouseholdTotals`를 실제 원문으로 추가 로드. `renderSayuPageDetail(records, id, scope)` — SayuPage가 넘기는 원본 칸·본문·원본 기록·합계로 SayuModal과 같은 순서의 조합을 실제 함수로 실행. 기존 `renderSayuDetail`은 유지(에뮬레이터 15번이 사용) |
| `frontend/test/householdSummary.test.mjs` | 새 테스트 3건(아래) |
| `frontend/test/sayuGrowthTimeline.harness.mjs` | `TOP_LEVEL`에 `buildSayuOriginalData` 이름만 추가. `openFormatSayu`가 새 최상위 함수를 부르므로, 기존 `isSpecialDayRecord` 하네스 결함이 나중에 고쳐질 때 새 미정의 오류가 숨지 않게 한다. 소스에 없는 이름은 건너뛰는 구조라 이동 전 원본 비교에 영향 없음 |

변경하지 않은 것: Rules, Functions, AI, 인증, 결제, 저장 경로(`saveHouseholdOriginal`·편집 서비스), 원본 칸 구성, 모바일, 라우터, LibraryPage, 디자인(접힌 본문 보기 외). 손상 문서 전역 저장 거부(권고 5)와 설정 실패 시 같은 계정 캐시(권고 4)는 확대하지 않았다.

## 3. 새 회귀 테스트 (실제 SayuPage 합계 → 실제 SayuModal 렌더)

고정 데이터: 레거시(숫자 3000, 사용자 본문 `예전 <b>단건</b> 본문\n둘째 줄`, `household_date` 없음), `[]`+단건(`"1,500원"`), 한 달 배열(숫자 5000, 사용자 본문), 여러 달 배열(수입 10,000·이체 2,000·지출 -1,000·같은 내용 지출 700 두 건), 손상 배열(단건 9,999), 다른 형식 기록.

1. **전체보기 합계**: 레거시를 열면 합계 거래 8건, 상단 수입 10,000 / 지출 9,900 / 차액 100. 원본 칸에 `household_amount`가 없어도 상세 카드는 `-3,000원`, `식비 · 간식 · 현금`, 메모 표시. 9,999·123,456 미포함. 같은 내용 700 두 건 보존, 이체 2000 유지·합계 제외, -1000 원부호. **지적 재현 쌍(레거시 3,000 + 배열 5,000) → 지출 8,000원**, `[]` 단건 1,500 + 5,000 → 6,500원.
2. **범위 유지**: 레거시 월별보기 → 합계 미전달, 지출 3,000. 한 달 배열을 전체보기에서 열면 합계 미전달, 지출 5,000. 여러 달 배열: 월별보기 자체 합계(지출 400, 차액 9,600), 전체보기 전체 합계(9,900). 손상 기록 → 기존 readonly textarea 본문.
3. **사용자 본문**: 레거시 안내 표시, `<details>`에 `open` 없음, 본문은 `&lt;b&gt;`로 이스케이프된 원문과 줄바꿈 그대로. 배열 사용자 본문도 같은 접힌 보기. 본문 없는 배열·손상 기록에는 안내/접힌 보기 없음. 테스트 전후 `records` deepEqual과 각 기록 `Object.keys` 불변.

**의미 확인(일시 변이 후 원복)**: ① 합계에서 배열 없음·`[]` 기록을 건너뛰게 하면(이전 동작) 1번 실패(`8` 기대, `6` 실제) ② `householdSayuViewData`가 원본 칸만 쓰게 하면(이전 실제 연결) 2번 실패(지출 `0원`)·3번 실패(사용자 본문 `false`). 원복 후 `MUTATION` 검색 0건, 다시 15/15 통과.

## 4. 검증 결과

| 명령 (`frontend/`에서) | 결과 |
|---|---|
| `node --import tsx --test test/householdSummary.test.mjs` | **15/15 통과** (기존 12 + 새 3) |
| `node --import tsx --test` 가계부 10개(`householdAmount·CashEntry·Categories·Dashboard·Duplicates·Edit·Export·Pdf·SavePreview·Summary`) + SAYU/형식 관련 10개(`formatRegistry·sayuEditedTitle·sayuPhotoUpload·recordPhotoLayouts·recordPhotoPolicy·structuredAssistantRecords·epubSingleRecord·plantDetectivePhotoEdit·polishCommentOptOut·sayuAssistantAdapters`) | **214/214 통과**. 파일 범위가 23의 16개 명령과 다르므로 숫자를 179와 직접 비교하지 않는다 |
| `node --import tsx --test test/sayuGrowthTimeline.test.mjs test/assistantSavedResultOpen.test.mjs` | 30건 중 23 통과 / **7 실패** — 기준과 같은 수(성장타임라인 6 + 1), 7건 모두 `ReferenceError: isSpecialDayRecord is not defined`. 하네스 이름 추가 전후 동일. 범위 밖 기존 결함 |
| esbuild `transformSync`로 변경 소스 3개 전체 변환 | 통과(구문 확인만) |
| 줄 끝 공백(Grep) | 새 파일·변경 테스트·새 함수 줄 0건 |

**이 세션에서 도구 권한으로 막혀 실행하지 못한 것 (우회하지 않음, 기장 실행 필요)**:

- `FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test --test-reporter=tap test/householdSave.emulator.test.mjs test/householdEdit.emulator.test.mjs` (`env` 접두도 막힘). 기대: 23과 같은 **36/36**. 에뮬레이터 15번이 쓰는 `renderSayuDetail`은 인자·동작이 같고, 그 안의 `parseHouseholdEntriesForSayu`는 같은 본문을 공통 함수로 옮긴 것이다. 새 SDK 시나리오는 추가하지 않았다(이번 변경은 읽기·표시만이고 쓰기 경로 변경 없음).
- `npm run build`: 이 세션에서 실행은 됐지만 prebuild 환경검사가 `VITE_FIREBASE_*` 6개 누락으로 중단. 23처럼 합성 설정을 명령에만 넘기는 빌드(환경변수 접두)와 `npx vite build`, `npx tsc --noEmit`은 승인 필요로 막힘. **기장이 23과 같은 방식으로 빌드 실행 필요.** 타입은 코드로 확인: `HaruRecord`에 `[key: string]: any`가 있어 새 함수 인자와 맞고, prop 타입은 공통 `HouseholdSayuEntry` 하나다.
- `git status --short`, `git diff --stat`, `git diff --check`: git 명령 전부 승인 필요로 막힘. **기장 실행 필요.** 예상 변경: 소스 3개(`householdRecordShape.ts`, `SayuModal.tsx`, `SayuPage.tsx`) + 테스트 3개(`householdSayuView.helper.mjs`, `householdSummary.test.mjs`, `sayuGrowthTimeline.harness.mjs`) + 이 문서. 독립 권고 26-2에 따라 커밋 후 `git diff --name-status 28873c6c..<새 HEAD>`도 기록.

## 5. 남은 한계

- 브라우저·아이폰 PWA 확인 없음. 접힌 본문 보기의 실제 모양, 전체보기에서 레거시 기록을 열었을 때의 합계는 SSR 렌더로만 확인했다. 운영 읽기 확인 없음, 운영 쓰기 없음.
- 회귀 하네스의 마지막 조합(원본 칸·원본 기록 → `householdSayuViewData` → 목록·판정·본문 문자열 → 렌더)은 SayuModal 컴포넌트 안 세 줄(`:667-670`)과 같은 순서로 부른다. 그 세 줄 자체는 컴포넌트 내부라 AST로 떼지 않았다. 대신 각 단계는 실제 함수다.
- `householdRecord`는 SayuPage의 `records` 상태에서 찾는다. 모달 안에서 원본을 저장한 직후 `records`가 다시 불러와지기 전까지는 원본 칸(편집 결과)이 위에 얹히므로 편집한 문자열 필드는 바로 반영되고, 본문·숫자 금액은 저장 전 원본 값을 표시한다(원본 저장은 본문을 바꾸지 않는다).
- 전체 합계는 이전처럼 SayuPage가 불러온 `records` 전체 기준이다(검색·필터와 무관). 이번에 기준을 바꾸지 않았다.
- 성장타임라인·assistantSavedResultOpen 기존 실패 7건은 그대로(범위 밖).

## 6. 다음 행동 (기장)

1. 위 막힌 명령 3종(에뮬레이터, 합성 설정 빌드, git status/diff/check) 실행과 원문 보관.
2. 개별 파일 stage → 커밋 → push → `@codex review` 재요청 → Codex 색인 새 파일.
3. 독립 재검토: [26 원문](26-independent-completion-02.md) + 이 문서 + 수정 diff + 1번 결과를 함께 제공.
