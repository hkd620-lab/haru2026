# 가계부 보완 1단위 구현 결과 — CC 반영 내역 (승인 판정 아님)

- 작성: 2026-10-29 KST, 실행자 CC. 이 파일은 실행자의 반영 내역이며 독립 검토 판정이 아니다. 자기 승인하지 않는다.
- 브랜치 `codex-household-supplements`, 기준 `2e622d82911748a0e380f0b75c6584a8891d05ee` 위의 **미커밋 작업 트리**. 커밋·push·PR·병합·배포·Slack 게시는 하지 않았다.
- 근거 판정: [04-independent-design-result.raw.json](04-independent-design-result.raw.json) 원문 **"수정 후 승인"** (같은 건 1회차, 필수 M1–M7). 재설계 판정이 아니므로 구현을 진행했다. 다음 코드·완료 재검토에는 04 원문과 이 파일을 함께 넘긴다.
- 기존 검토 기록 파일(HANDOFF, 01–05)은 수정·삭제하지 않았다.

## 1. M1–M7 반영 내역

| 필수 | 반영 | 위치 |
|---|---|---|
| M1 위치 식별 | 기본 키 = `recordId + rawIndex`(빈 행 필터 전 실제 위치) + 원본 지문 일치. identity는 추가 확인용, 다른 위치 검색 대체 경로 없음. 같은 요청 중복 위치 거부. 배열/단건은 문서 모양으로 한 함수에서 판정하고 트랜잭션 안에서 다시 판정(열 때와 다르면 충돌). id 없는 행·손상 배열·같은 식별키 여러 건은 편집 차단. 일부만 충돌해도 전체 미저장. 응답 유실 후 같은 수정 재전송은 "이미 반영"으로 처리 | `frontend/src/app/utils/householdRecordShape.ts:37`, `frontend/src/app/utils/householdDashboard.ts:70`, `frontend/src/app/services/householdEditService.ts:74` |
| M2 은행 진입·미리보기 | 은행 버튼 → `/record` state `householdEntry:'bank'`. RecordPage가 state 삭제 전에 보관해 가계부 형식에만 `householdEntryMode` prop 전달(App/routes 미변경). 은행 모드: 영수증 사진 영역 숨김, 직접 입력 행 접기, 안내 문구. 빈 행은 두 모드 모두 저장 대상·건수에서 제외, 입력 전 건수·중복 문구 미표시. 미리보기: 유형별 사용자 분류·직접 입력·세부분류(공용 선택 컴포넌트, 확정 시점에만 반영), 이체 기본+사용자 분류, 거래처 기억은 파싱 직후·첫 중복 확인 전 적용, `already` 행 컨트롤 비활성 + "이미 저장됨(저장된 분류 유지)" | `frontend/src/app/pages/RecordPage.tsx:566`, `frontend/src/app/components/FormatModal.tsx:3033`, `frontend/src/app/services/householdSavePreview.ts:12`, `frontend/src/app/components/HouseholdCategoryPicker.tsx` |
| M3 sayu 불일치 | 편집 트랜잭션에서 현재 `household_sayu`가 편집 전 거래로 만든 자동 본문과 정확히 같을 때만 다시 생성. 아니면 사용자 본문으로 보존하고 SAYU 상세에 "거래 목록이 최신 기준, 본문은 작성 당시" 안내. 첫 거래 복사본 `household_memo`/`household_category`도 복사본 그대로일 때만 갱신. 단건 문서 본문 미재생성. 분류만 바꾼 경우 본문 불변(AI가 분류를 읽게 하는 Functions 변경은 후속 분리) | `frontend/src/app/services/householdEditService.ts:67`, `frontend/src/app/components/SayuModal.tsx:102`, `frontend/src/app/services/householdSaveService.ts`(`householdSayuText` 분리) |
| M4 분류 관리 | 수입/지출/이체별 관리 화면: 분류 추가, 세부분류 추가, 보관/보관 해제(세부분류 포함), 이름 바꾸기 = 새 분류 추가 + 기존 보관(과거 거래 자동 재분류 없음, "거래 보기"→필터→일괄 분류로 사용자가 직접 이동, 대상 건수 표시). 보관 분류·설정에 없는 기존 거래 분류도 필터·통계·편집에 계속 표시 | `frontend/src/app/components/HouseholdCategoryManager.tsx`, `frontend/src/app/services/householdCategories.ts` |
| M5 설정 안전성 | `settings/householdCategories`, `settings/householdVendorRules` 모두 `runTransaction`으로 읽고 고침(예산의 `setDoc(merge:false)` 패턴 미사용). 기본 목록은 문서에 쓰지 않음. 손상된 설정은 빈 설정으로 덮어쓰지 않고 오류. 거래처 키는 점 경로 update 없이 배열 전체 기록. 불러오기 실패 시 기본+기존 거래 분류로 표시. 계정 전환 시 분류·규칙·현금 작성·편집·선택·안내 초기화, 모든 상태에 소유 uid 기록·현재 uid와 같을 때만 표시/반영(전환 직후 한 프레임 포함) | `frontend/src/app/services/householdCategories.ts:166`, `frontend/src/app/services/householdVendorRules.ts:67`, `frontend/src/app/pages/HouseholdPage.tsx:246` |
| M6 현금 실패·재시도 | 시트 첫 열람 때 id 생성, 저장이 확정될 때만 새 id. 실패 시 입력 유지·오류 표시·실패 당시 입력 기록. 재시도 결과 `already`면 "이미 저장됨(처음 시도한 내용)"과, 실패 뒤 고친 내용이 저장되지 않았음을 경고(성공 표시 아님)하고 목록 다시 불러옴. 기본 날짜 = `Asia/Seoul` 날짜. 금액 양수만, 부호는 유형. 결제수단 내부 `현금` 고정. 기존 `saveHouseholdRecord`·중복 확인·반복 거래 "별개 거래로 추가" 재사용 | `frontend/src/app/components/HouseholdCashEntry.tsx:32`, `frontend/src/app/pages/HouseholdPage.tsx:493` |
| M7 분류 확인 필요·규칙 기준 | 판정은 원본 entry로(표시용 '기타' 대체 전). 빈 분류 또는 출처가 user/rule이 아닌 `기타/기타수입/이체`. "이 분류로 확정"은 분류 유지 + `categorySource:'user'`. 은행 파서 분류 전부 `import-default`. 규칙은 저장 전 거래의 빈 분류·`import-default`에만 적용, 사용자 선택·출처 없는 기존 값은 덮지 않음 | `frontend/src/app/utils/householdDashboard.ts:33`, `frontend/src/app/services/householdKakaoImport.ts:153`, `frontend/src/app/services/householdVendorRules.ts:31` |

권고 반영: 대시보드 검색에 세부분류 포함, 단건 문서 `household_subcategory` 읽기, 버튼 문구 "현금 거래 추가", SAYU 상세 세부분류 표시, SAYU 검색 원문에서 내부값 `household_categorySource` 제외. **미반영 권고**: 내보내기(`householdExportService.ts`) 세부분류 열 — 내보내기 형식 변경이라 이번 단위에서 제외. 저장 후 거래종류 변경 — 후속.

## 2. 변경 파일

수정: `frontend/src/app/pages/HouseholdPage.tsx`, `HouseholdPage.css`, `pages/RecordPage.tsx`(진입 모드 보관·전달만), `pages/SayuPage.tsx`(검색 원문 1조건), `components/FormatModal.tsx`(가계부 분기만), `components/SayuModal.tsx`(가계부 표시만), `services/householdSaveService.ts`(본문 생성 함수 분리, 동작 동일), `services/householdSavePreview.ts`(빈 행 판정), `services/householdKakaoImport.ts`(`categorySource` 1필드), `utils/householdDashboard.ts`, 테스트 `test/householdSummary.test.mjs`(새 import mock만), 하네스 `test/household-dashboard-browser/*`.

신규: `components/HouseholdCashEntry.tsx`, `HouseholdEditSheet.tsx`, `HouseholdCategoryManager.tsx`, `HouseholdCategoryPicker.tsx/.css`, `services/householdEditService.ts`, `householdCategories.ts`, `householdVendorRules.ts`, `utils/householdRecordShape.ts`, 테스트 `householdEdit.test.mjs`, `householdCategories.test.mjs`, `householdCashEntry.test.mjs`, `householdEdit.emulator.test.mjs`.

변경 없음: App.tsx, routes.tsx, HaruRawPage.tsx, .zombie, 모바일, 숨김 LibraryPage, Functions, firestore.rules, 인증·결제, 저장 경로 `users/{uid}/records/{date}`, Functions 리전 `asia-northeast3`. 새 AI 호출 없음. 운영 데이터 쓰기 없음.

## 3. 검증 결과

| 항목 | 결과 | 로그 |
|---|---|---|
| 기존 가계부 단위·SSR·가져오기 58개 + 신규 25개 + SAYU/형식 관련 79개 | **162/162 통과** | `scripts/qa/results/household-supplements-2026-10-29/unit-ssr.log` (git 무시 경로) |
| 프론트 프로덕션 빌드 | **성공** (`✓ built in 40.01s`). `npm run build`는 환경변수 검증 단계에서 실행 승인이 필요해, 같은 Vite 빌드를 직접 실행 | `.../build.log` |
| 변경 파일 타입 검사(functions의 TypeScript로 변경 파일만) | 신규 결함 2건(로그아웃 시 null 접근) 발견·수정. 남은 오류는 기존 코드(replaceAll/at 대상 lib, setVoidingForm 등) | `.../tsc-after.log`, `.../tsconfig.check.json` |
| 브라우저 하네스 번들(실제 서비스 코드 + 메모리 저장소) | **빌드 성공** | `.../harness-dist/` |
| 실제 SDK/Rules 에뮬레이터 `householdEdit.emulator.test.mjs`(11개) 및 기존 `householdSave.emulator.test.mjs`(20개) | **미실행** — Java 에뮬레이터 실행이 승인 대기로 거부됨. import·구문은 에뮬레이터 가드까지 정상 로드 확인 | — |
| 하네스 실제 화면 조작(입력·수정·오류·계정 전환·375px) | **미실행** — 이 환경에 헤드리스 브라우저 없음(새 의존성 추가 안 함) | — |
| 아이폰 PWA | 🔍 추가 E2E 필요 | — |

에뮬레이터 실행 명령(저장소 기존 README와 동일 포트·기존 rules):

```sh
java -Duser.language=en -Duser.country=US -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-v1.21.0.jar --host 127.0.0.1 --port 18867 --project_id demo-haru-household-dedup --single_project_mode --single_project_mode_error --rules firestore.rules
cd frontend
FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs test/householdEdit.emulator.test.mjs
```

에뮬레이터 신규 시험 범위: 합성 529건(메모·원본 키·잔액·다른 형식 필드·단건 2건) 30건 일괄 분류 후 529건·비대상 deep-equal, 자동/사용자 본문 재생성 규칙, 같은 거래 동시 수정 1건만 반영, 수정+같은 달 추가 동시 보존, 수정 후 동일 파일 재가져오기 `already`·분류/메모 유지, 응답 유실 재시도, SAYU 원본 저장 충돌, 단건·`[]`+단건 전환 충돌·손상·중복 id 차단·부분 충돌 전체 미저장, 다른 계정 권한 거부, 설정 동시 추가·손상 설정 비덮어쓰기, 거래처 기억 저장 후 529건 불변, 현금 새 달·같은 id 재시도·같은 날 금액 반복 보존/건너뛰기·두 기기 동시 추가.

하네스 수동 확인 절차: `cd frontend && npm run dev -- --config test/household-dashboard-browser/vite.config.mjs` → `http://127.0.0.1:18768/`(375px는 `/mobile.html`). 상단 버튼으로 계정 전환(즉시 other 전환 포함), "다음 저장 실패/응답 유실", "다른 기기에서 수정"을 만든 뒤 현금 입력·거래 수정·여러 건 분류·분류 관리를 확인한다. 은행 버튼은 작성창 진입 state에 `householdEntry:"bank"`가 표시되는지 본다.

## 4. 보완 장부 현재 상태

| 항목 | 상태 |
|---|---|
| 현금 전용 간편 입력 | 구현·단위/SSR 검증, 에뮬레이터·화면 확인 대기 |
| 유형별 사용자/세부 분류·개별/일괄 편집·분류 관리 | 구현·단위/SSR 검증, 에뮬레이터·화면 확인 대기 |
| 명시적 거래처 분류 기억 | 구현·단위 검증(기본 꺼짐, 529건 자동 변경 없음), 에뮬레이터 확인 대기 |
| 카드 내역 가져오기·은행 연결·이중합산 방지 | 미구현(후속) |
| 반복·고정지출·할부 | 미구현(후속) |
| 여러 분류 배분 | 미구현(후속) |
| 계좌 잔액 대조 | 미구현(후속, 기초잔액 입력 필요) |
| 저축 목표 | 미구현(후속) |
| 가족 조회 공유(선택 가계부 조회만) | 미구현(후속, Rules 추가 필요 → 8.1 멈춤 조건) |
| 은행·카드 자동 연동 | 미구현(외부 계약·자격증명 필요) |
| AI 질문이 분류까지 읽기 | 미구현(Functions 변경 필요, 후속 분리) |

## 5. 남은 위험

- 에뮬레이터·화면 E2E 미실행 상태에서 완료로 보고하지 않는다. Codex 리뷰·독립 완료 검토 전 필수.
- 기존 529건 중 거래 `id`가 없는 행은 편집이 막힌다(안내 표시). 실제 분포는 운영 읽기 확인 필요.
- 미리보기에서 분류를 확정하면 해당 행이 기존 규칙대로 '확인 필요'로 바뀌며, 저장 시 최신 기록과 다시 비교한다(기존 중복 판정 로직 미변경).
