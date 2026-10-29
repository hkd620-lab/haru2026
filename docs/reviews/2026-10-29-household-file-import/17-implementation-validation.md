# 파일 가져오기 첫 구현 단위 — 검증과 남은 조건

기준 main: c37ff6244f99b3a6460d2972c40500c6505011fb. 작업 브랜치: codex-household-file-import. 실행 담당 변경 근거는15. 설계06+09, 최종 독립 설계11 **승인**(수정 후 승인 누적2회) 기준으로 구현했다. 이 문서는 구현 검증 기록이며 독립 완료 승인이나 운영 완료 판정이 아니다.

## 변경

- `HouseholdImportGuide.tsx`, `householdImportSources.ts`: KB국민은행·KB국민카드·카카오뱅크·신한·하나·우리·NH농협 7기관. 공식 공개 메뉴/확인일과 로그인 뒤 확인 전 단계를 나눠 표시. 카카오 현재지원, 카드 필수열 양식 시범, 나머지 은행은 안내만 제공하고 파일 선택을 차단.
- `householdCardImport.ts`: 기기 내 XLS/XLSX 읽기. 필수 열은 연도 포함 이용일·가맹점·이용금액·상태. 청구서·모호한 행/상태/날짜/금액/할부는 파일 전체 거부. 외화는 미선택·금액 비움. 취소 양수는 음수 기록 또는 제외를 명시 선택. 카드 파일명·카드번호·승인번호·원문 행은 저장하지 않는다. 키는 내용 해시+시트+행이며 다른 파일끼리는 기존 의심 확인을 사용한다.
- `householdImportReview.ts`: 실제 선택 ID와 금액·카드종류·확인 메타데이터·출처를 저장 직전에 검증. 전체/선택/외화제외/확인필요/이미저장 건수와 완료 메시지. 이미 저장된 취소는 미확인 건수에서 제외.
- `FormatModal.tsx`: 가계부 분기 연결, 타입 확장, 읽기 세션 보호, 개별/전체 선택 차단, 두 저장 진입 검증. 새 은행 미리보기의 국민카드 대금 후보만 표시하고 사용자가 기존 유형 변경 함수로 이체를 선택한다. 저장된 과거 거래는 바꾸지 않는다.
- `HouseholdPage.tsx`: 진입 버튼의 문구 1줄을 ‘은행·카드 파일 가져오기’로 바꿈. 라우터나 탐색 구조 변경은 없다. 승인 설계 파일 목록 외의 최소 문구 보완이며 기능 범위 확대가 아니다.
- 합성 테스트·기존 로컬 브라우저 하네스: 실제 파서를 사용하는 읽기 대기/재개, 합성 계정 전환, Functions 호출 횟수 계측. 제품 화면에는 포함되지 않는다.

## 검증

- 관련 단위·SSR 및 공용 형식 회귀 **205/205**, 실패/건너뜀0. 원문17-unit-ssr.txt. frontend에서 `node --import tsx --test` 실행: householdAmount, householdSummary, householdExport, householdDuplicates, householdSavePreview, householdPdf, householdDashboard, householdEdit, householdCashEntry, householdCategories, householdCardImport, formatRegistry, writeBeforeFormat, formatPhotoUploadResult, formatPolishRequest, sayuEditedTitle, sayuPhotoUpload의 `.test.mjs` 17개 파일.
- 실제 SDK·기존 Rules **40/40**, 실패/건너뜀0. `FIRESTORE_EMULATOR_HOST=127.0.0.1:18867 node --import tsx --test test/householdSave.emulator.test.mjs test/householdEdit.emulator.test.mjs test/householdCardSave.emulator.test.mjs`. 원문17-sdk-rules.txt. `demo-haru-household-dedup` 합성 자료만 사용. 기존529건(배열528+예전 단건1) 문서·메모·분류·본문의 저장 전후 동일성, 카드 동시저장/재시도/음수 환불 확인.
- `npm run build`: 합성 Firebase 설정으로 prebuild 환경검사/Vite/PWA 통과. 원문17-build.txt에 보존. 이 합성 `dist`는 운영에 배포하지 않는다. 실제 설정 빌드는 PR CI에서 별도 확인한다.
- `git diff --check` 통과. 카카오2개 파서·보조장부 파서·중복 서비스·저장 서비스·합계 서비스·Functions·Rules의 diff는 없다.
- 전체 `tsc`는 기존 ExportModal 구문 오류 이력이 있으며, 이번 실행 결과는17-tsc.txt에 별도 보존한다. 타입 검사 전체 통과로 주장하지 않는다.

## 실제 브라우저 + 로컬 Rules 에뮬레이터

390×844 임시 viewport. 실제 FormatModal, SheetJS와 파서, 실제 Firestore SDK·로컬 Rules를 사용했다. 인증은 합성 사용자이며 운영과 연결하지 않았다. Vite 변경 감시가 늦는 현상이 있어 하네스 변경 후 이 작업의 서버를 재시작하고 새 화면을 확인했다.

1. 5개 은행을 각각 선택: 모두 공식 공개 메뉴/로그인 뒤 확인 전 단계 표시, 파일 선택 비활성.
2. 카드종류·승인이용내역 확인 전 파일 선택 비활성. 둘 다 선택한 뒤 합성 XLSX 읽기: 정상1·취소확인1·외화제외1, 총3건. 취소/외화 기본 미선택, 기관/카드종류 고정.
3. 취소를 명시적으로 음수 선택 후 하단 **공통 저장 버튼** 사용: 실제 저장 **2건·지출2500원**(4500−2000). 외화1건은 미저장.
4. 같은 파일 재가져오기: 기존2건은 이미 저장됨·미선택·편집불가. 추가선택0, 외화제외1, 확인필요0. Functions 호출 **0건** 계측. 화면16-card-reimport-mobile.png.
5. 실제 XLS 읽기를 하네스에서 대기시킴 → 합성 계정 전환 → 읽기 재개: 이전 미리보기/카드종류 입력 없음, 카카오 기본 안내와 파일선택으로 초기화. 늦은 결과가 복구되지 않음. 이 검증은 읽기 중 계정 전환이며 운영 로그인 전환 E2E라고 주장하지 않는다.
6. 안내 화면16-card-guide-mobile.png, 국민은행 안내16-kbbank-guide-mobile.png. 모두 합성 검증 하네스 화면이다. 아이폰 실기기/PWA 검증은 아니다.

## 설계 조건 연결

| 조건 | 구현 | 검증 |
|---|---|---|
| M1 키·반복·겹침 | CardImport fileDigest/시트/행 + 기존 duplicates 유지 | CardImport 테스트 재가져오기/반복/기간겹침, SDK 동시저장 |
| M2·N4·N5 금액/상태 | CardImport 엄격 금액·셀 z/w·외화·취소 규칙 | XLS/XLSX·통화·소수·취소·할부·불명행 거부 테스트 |
| M3 연도 | CardImport cardDate | 연도 누락/잘못된 날짜/엑셀 날짜 테스트 |
| M4 헤더·부분거부 | CardImport 후보/필수/중복/청구 열 검증 | 형식 거부·합계 행 테스트 |
| M5·N7 저장검증 | ImportReview validate + FormatModal 두 저장 진입/선택 토글 | 순수 검증 변조·선택 불일치·취소 선택, SDK 외화 거부, 실제 공통 저장 |
| M6·N6 기관·종류고정/전송 | Guide 선택/FormatModal cardFileReading·context/기기 내 reader | 실제 사전확인·기관고정·Functions0, 카드 바이트 검사 |
| M7 계정/세션 | FormatModal owner·session·readVersion와 초기화 effect | 실제 대기→계정전환→응답폐기 |
| M8 카드대금 | 새 카카오 행 후보만, 명시 이체 변경 | 순수 후보 원본불변/저장행제외, 카카오회귀 |
| M9·N1·N2 기관안내 | Sources/Guide와 importKind | 7기관 SSR, 5은행 실제 버튼 비활성 |
| M10 장부 | 35 직접결정·05a·15·현재기록 | 자동연동 제외, 과거 원문 보존 |
| M11 최소저장 | CardImport entry 허용필드 구성 | 카드번호/승인번호 부재 단위·실제 SDK |
| M12 검증 | 새 단위·SDK·하네스 | 205+40, build, 합성390px |
| N3 건수 | ImportReview counts/completion·두 위치 표시 | 제외/확인필요 단위·실제3행 미리보기·2행저장 |
| N8 카카오 보존 | 기존 파서·payload·합계 서비스 불변 | 기존 PDF 회귀·SDK36 포함·카카오 원본불변/후보 무변경 |

## 배포 영향·남은 장부

Hosting 프론트만 대상. Firebase `haru2026-8abb8`, Firestore `users/{uid}/records/{date}`, Functions 리전 `asia-northeast3` 유지. Functions·Rules·환경변수 파일·결제·인증·새 AI 호출·모바일·라우터 변경 없음. 운영 데이터 쓰기 없음. PR·독립 완료 승인·최신 Codex 리뷰·최종 CI 전에는 병합/배포하지 않는다. 되돌리기는 이 기능 커밋 revert와 이전 Hosting 버전 재배포 범위이며 실행 전 실제 대상을 확인한다.

- **API 자동연동은 추진 범위에서 제외**한다. 이전 장부9번을 다시 추진하지 않는다.
- 실제 국민카드 파일과 머리글, 아이폰 PWA 추가 E2E 필요. 모든 국민카드/타은행 파일 지원으로 보고하지 않는다.
- 5대 은행은 다운로드 진입 안내만 포함. 로그인 뒤 실제 파일 저장 방법의 상세 검증 및 은행별 파서 확장은 남음.
- 이미 저장된 카드대금, 승인일과 출금일이 다른 체크카드 거래, 카드대금 합계와 개별 거래 연결은 자동 해결하지 못한다. 합계의 이중 계산 가능성을 화면에 알린다.
- 기존 고정지출·할부 일정/배분/잔액 대조/저축 목표/선택 가계부 조회 공유는 후속 장부 유지. 이번 구매 전체금액 표시가 할부 일정 관리 완료를 뜻하지 않는다.
- 독립 완료 검토는 CC 지출 한도 해제 여부를 확인해야 한다. 독립 설계11 승인을 완료 검토로 재사용하지 않는다.

현재 판정: **⚠️ 구현·합성 검증 완료 / 필수 리뷰·실파일 E2E·배포 미완료**. 작업 난이도 **5.5 높음**.
