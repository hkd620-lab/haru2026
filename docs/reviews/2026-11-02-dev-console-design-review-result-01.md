수정 후 승인

- **대상:** `bea0aadcd8afe6e548ea8b9c3a8d221b0f471225` 기준 현재 작업트리 diff (커밋 전)
- **검토일:** 2026-11-02
- **범위:** 설계·변경 범위 검토이며, 최종 HEAD 승인이 아닙니다. 파일은 수정하지 않았습니다.

구조는 타당하고 과삭제나 공용 기능 손상은 찾지 못했습니다. 다만 커밋 범위 정리 1건, 대표님 결정 2건, 검증 공백을 해결해야 합니다.

## 작업 규모와 8.1 멈춤 조건

- **작업 규모: 대규모.** 라우터(`App.tsx`)와 홈(`HomePageV2.tsx`)을 바꾸고 화면 8개·Functions 14개를 제거하며, 일반 사용자 진입도 바꿉니다.
- **멈춤 조건 해당: 판정①만으로 병합할 수 없습니다.**
  - **홈·라우터:** 원요구는 메뉴·경로 제거와 일반 기록형식 이동을 허용하므로 지금 작업은 계속할 수 있습니다. main 병합 전에는 대표님의 범위 확인이 필요합니다.
  - **주식 카드 추가:** 삭제된 주석의 2026-10-23 결정 ②(주식거래일지는 비서로 본다)를 뒤집습니다. 원요구로 설명은 되지만 보고에 명시해야 합니다.
  - **비용:** 일반 사용자에게 주식 사진 OCR이 열립니다(P1-2).
- **해당 없음:** 저장 경로 변경, Rules 변경, 결제·인증 정책 변경, 운영 데이터 삭제, 모델 교체는 diff에 없습니다. 로그인과 공용 Drive 경로도 유지됩니다.

## 지적 사항

### P1-1. 빌드 산출물과 심볼릭 링크를 커밋에서 제외

- **위치:**
  - `functions/lib/index.js`, `functions/lib/snsToDiary.js`, `functions/lib/englishBibleWordMeaning.js`
  - `frontend/node_modules`, `functions/node_modules` (미추적 심볼릭 링크)
- **근거:**
  - `functions/lib/`는 `.gitignore` 대상인데 11개 파일만 예전부터 추적됩니다. 마지막 커밋은 2026-10-06입니다.
  - 현재 diff에는 AI 창구 이전 등 약 한 달치 무관한 변경이 섞여 있습니다.
  - 새 `lib/index.js`는 추적되지 않는 `./ai/aiGateway`를 불러옵니다.
  - 배포 predeploy가 빌드를 다시 하므로 이 파일을 커밋할 이유가 없습니다.
- **영향:** 사용자 영향은 없습니다. 다만 커밋 설명과 실제 변경이 달라져 멈춤 조건에 걸리고, 검토 범위도 흐려집니다.
- **수정 조건:** 위 경로를 stage하지 않습니다. `git diff --cached --name-only`에 `functions/lib/`와 `node_modules`가 없어야 합니다. `git add -A`는 쓰지 않습니다.

### P1-2. 주식 OCR 공개에 대한 비용 확인

- **위치:** `functions/src/index.ts:5879`의 `extractStockTradeTextFromPhoto`, `frontend/src/app/components/FormatModal.tsx:1847`
- **근거:** 함수 진입부에서 확인한 제한은 로그인과 `enforceRateLimit(uid, ..., 5, 30)`뿐입니다. 구독이나 월간 한도 확인은 진입부에서 보이지 않습니다. 호출부 전체를 끝까지 보지는 않았으므로 실행자가 재확인해야 합니다.
- **영향:** 일반 사용자의 AI 호출이 늘어 비용이 증가할 수 있습니다.
- **수정 조건:** 다음 중 하나를 대표님이 결정합니다.
  - 현 제한을 유지한 채 공개합니다.
  - 월간 한도를 먼저 붙입니다.

  결정 없이 병합하지 않습니다.

### P2-1. 주식거래일지의 '일반 기록형식' 범위 확인

- **위치:** `frontend/src/app/records/formatRegistry.ts:49-54`, `functions/src/formats/formatRegistry.ts:32`, `frontend/test/recordStats.test.mjs:17`
- **근거:** 통계·합본·EPUB 대상 목록은 주식을 '비서'로 보고 제외합니다. SAYU에서도 업무가 아닌 전용 묶음 `HARU주식관리`에 표시됩니다. 선교보고·일반보고는 이미 이 대상에 들어 있습니다.
- **영향:** 사용자는 일반 기록처럼 쓰지만 주식 기록만 통계·합본에서 빠집니다.
- **수정 조건:** 현 상태 유지 또는 대상 추가를 대표님이 결정합니다. 추가한다면 프론트와 Functions 목록, parity 테스트를 함께 고칩니다. 유지한다면 완료 보고에 한계로 적습니다.

### P2-2. 제거된 경로가 빈 화면이 될 수 있음

- **위치:** `frontend/src/app/App.tsx` (`path="*"` 없음)
- **근거:** 기준 코드에서는 일반 사용자도 `RecordPage`의 하루학습 탭에서 `/bible`로 들어갈 수 있었습니다. 코드상 일치하는 경로가 없어 본문이 비어 보일 것으로 판단합니다. 브라우저 실측은 안 했습니다.
- **영향:** 즐겨찾기나 PWA 이력으로 `/bible`, `/vocab`, `/asset-explorer`에 들어가면 안내 없이 빈 화면을 볼 수 있습니다.
- **수정 조건:** preview에서 실제 동작을 확인합니다. 빈 화면이면 공통 폴백을 추가해 테스트하거나, 수용 사실을 대표님 보고에 명시합니다. 공통 폴백은 다른 잘못된 URL의 동작도 바꾸므로 라우터 변경 승인이 필요합니다.

### P2-3. 저장 자료는 남지만 사용자가 볼 화면은 사라짐

- **위치:** 삭제되는 `VocabPage.tsx`, `BiblePage.tsx`, `AssetExplorerPage.tsx`
- **근거:**
  - `vocabulary`를 읽는 화면은 `VocabPage`가 유일했습니다.
  - 작업트리 `frontend/src/app`에는 `vocabulary`, `bibleWordbook`, `bibleProgress`를 읽는 코드가 남아 있지 않습니다.
  - Rules와 계정 삭제 목록의 `bibleProgress`, `bibleWordbook`, `vocabulary`, `assets`는 유지됩니다.
- **영향:** 자료는 보존되지만 사용자는 볼 수 없습니다. EEB로 옮겨지는 경로도 이 diff에는 없습니다.
- **수정 조건:** 코드 수정은 필요 없습니다. 완료 보고에 "데이터 보존, 화면 열람 불가"를 명시합니다.

### P2-4. 운영 함수와 외부 연결 토큰이 남음

- **위치:** `functions/src/index.ts` (삭제 export 14개), `functions/src/accountDeletion.ts:124`
- **근거:**
  - 코드만 제거되므로 운영 함수 14개는 삭제 전까지 계속 살아 있습니다.
  - `users/{uid}/integrations/googleDrive`와 `users/{uid}/cloudConnections/oneDrive`는 계정 삭제 목록에 없습니다. 이 누락은 기준 코드부터 있었습니다.
  - 이번 삭제로 이 토큰 문서를 쓰던 코드가 함께 사라집니다.
- **영향:**
  - 호출 가능한 고아 엔드포인트가 남습니다.
  - Drive·OneDrive refresh token이 탈퇴 후에도 남을 수 있습니다.
- **수정 조건:**
  - 완료 보고에 "코드 제거 ≠ 운영 제거"를 적습니다.
  - 운영 함수 삭제, 토큰 폐기·삭제, 계정 삭제 목록 추가는 별도 승인 작업으로 등록합니다.
  - 후속 Functions 배포는 함수명을 명시합니다.

### P2-5. 필수 검증 근거 부족

- **위치:** `frontend/test/devConsoleCleanup.policy.test.cjs`, `functions/test/devConsoleCleanup.policy.test.js`
- **근거:** 새 정책 테스트는 대부분 문자열 확인입니다. 주식 초안 제목 차단은 코드 읽기로만 확인했고, 실제 저장과 기존 기록 재열람은 검증되지 않았습니다.
- **수정 조건:** 다음을 PR에 첨부합니다.
  - 최신 HEAD 기준 `cd frontend && npm run build`, `cd functions && npm run build`, 변경 영역 테스트, export diff
  - preview의 일반 계정 확인: 홈 카드 3종 진입, 먼저 쓰기 초안, 저장, SAYU 표시, 기존 세 형식 기록 재열람·수정
  - 영어일기(번역·문법·단어·퀴즈·TTS), 하루식물탐정, 로그인의 회귀 확인

  세 형식 저장 흐름은 대표님이 실제 기기에서 최소 1회 확인해야 합니다.

### P3. 사소한 잔여물

- **`functions/src/index.ts:152`:** 상수 없이 주석 `// 관리자 전용 기능 접근 제어용 UID`만 남았습니다. 삭제합니다.
- **`frontend/src/app/records/writeBeforeFormat.ts:43`:** 주식 초안에 `stock_simple`도 저장됩니다. 주식 화면에는 이 입력칸이 없어(`FormatModal.tsx:4914`) 수정해도 반영되지 않는 숨은 복사본이 남습니다. 주식은 제외하고 테스트를 추가합니다.
- **`HomePage.tsx`, `RecordHubPage.tsx`:** 렌더링되지 않는 파일인데 세 형식을 계속 숨깁니다. `/record-hub`도 `HomeOrLanding`으로 연결됩니다. 지금은 영향이 없으니 파일을 복구해 쓸 때 맞추면 됩니다.
- **`firestore.rules:364`, `functions/src/index.ts:9184`:** 옛 설명 주석이 남아 있습니다. Rules는 건드리지 말고 그대로 둡니다.

## 삭제와 보존 확인 결과

| 항목 | 결과 | 근거 |
|---|---|---|
| 삭제 누락 | 없음 | 제거 대상 파일·경로·함수명을 `frontend/src`, `frontend/test`, `functions/src`, `functions/test`, `mobile/lib`, 설정에서 검색. `firestore.rules:364`와 `accountDeletionCompleteness.policy.test.js:26`의 주석만 남음 |
| 삭제 전용성 | 전용 확인 | 삭제 Functions의 기준 호출처는 삭제 대상 화면뿐. `ensureOneDriveHaruFolder`는 프론트 호출처 없음. 성경 JSON은 `GrammarDashboard` 글롭이 유일 |
| 공용 데이터 | 보존 | `bible_quotes*`, `quotes*`, 기타 `src/data` 유지. `TodayQuote` 영향 없음 |
| 영어일기 | 보존 | `DiaryLearnPage`가 쓰는 `translateToEnglish`, `generateTTS`, `getGrammarExplain`, `getVerseQuiz`, `getWordMeaning` 유지. `getWordMeaning`은 성경 문맥 분기만 삭제됐고, 일기 호출은 `{ word }`만 보냄 |
| TTS | 보존 | `generateTTS`, `ttsQuality`, `SayuPage`, `BookReader` 유지 |
| 로그인·Drive | 보존 | OAuth 콜백과 영수증 Drive 경로 유지 |
| 식물탐정 | 보존 | 경로·화면·함수 유지. 기록탐정과 혼동 없음 |
| 기존 기록 호환 | 영향 없음 | `firestoreService.ts`, `formatRegistry.ts`, `FormatModal.tsx`, Rules 변경 없음. 주식은 `formats`로 저장되고 `SayuPage.tsx:3229`로 표시 |
| EEB·Flutter 의존성 | 소스 의존 없음 | `easy-bible`에서 대상 함수 호출 없음. `haru-flutter`는 운영 연결 금지 정책. 현재 체크아웃 기준이며 운영 호출 로그는 미확인 |
| 요청 밖 변경 | `functions/lib`만 해당 | P1-1 |

## 이번 검토에서 직접 실행한 검증

- **통과:**
  - 신규 정책 테스트 2종
  - `writeBeforeFormat.test.mjs` 7/7
  - Functions `tsc --noEmit`
  - `aiGateway` 16/16, `generateTts` 8/8, OAuth 테스트 2종, 계정 삭제 완전성 테스트
  - 프론트 정책 테스트 4종
- **제한적 확인:** 프론트 `tsc`는 모듈 누락 오류만 걸러 봤고, 해당 오류는 없었습니다. 전체 타입 오류 여부는 확인하지 않았습니다.
- **실패:** `frontend/test/statsStorage.policy.test.cjs`가 `FormatModal.tsx`의 `photoEditorSessionRef` 정규식 검사에서 실패했습니다. 이 파일은 diff에 없어 이번 변경과 무관해 보이지만 기준선에서 재현하지는 않았습니다. 실행자가 기준 커밋에서 대조해 기록해야 합니다.
- **미실행:** `npm run build`, 기준선 비교 빌드, preview·브라우저 E2E, 운영 함수 실측입니다.

## 후속 절차

1. P1-1, P3, P2-5를 반영하고 커밋해 PR을 만듭니다.
2. Codex 리뷰와 CI를 받습니다.
3. 이 판정 원문과 반영 내역을 함께 넘겨 독립 재검토와 최종 완료 검토를 받습니다.
4. P1-2, P2-1, P2-2와 홈·라우터 범위를 대표님께 보고하고 결정을 받습니다.

원문 보관은 실행자가 해야 합니다. 이 세션은 파일을 쓰지 않았고, `docs/reviews/2026-11-02-dev-console-design-review-result-01.md`는 아직 0바이트입니다. 이 답변 전문을 대상 기준 커밋, 검토 시각과 함께 그대로 저장해 주세요.
