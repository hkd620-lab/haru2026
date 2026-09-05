# HARU2026 PROJECT MAP

- 작성일: 2026-05-16
- 워크트리: `/Users/heogyeongdae/Documents/my apps/HARU2026/.claude/worktrees/dazzling-herschel-6f6efd/`
- 워크트리 HEAD SHA: `4b412fe826314f59fe9916754d60a53be82808ae`
- 브랜치: `claude/dazzling-herschel-6f6efd` (parent: `feature/new-formats`)
- 본 문서의 한계: **빌드/실행 없이 코드만 본 정적 조사**. 런타임 동작·Firestore 실제 데이터·배포 상태는 검증하지 않음. 문서 작성 후 워크트리 변경 사항도 반영되지 않음.

---

## 1. 실제 사용 파일

### 1.1 라우터에 마운트된 페이지 (`frontend/src/app/App.tsx:108-177`)

| Path | 컴포넌트 | 파일 경로 |
|---|---|---|
| `/` | `HomeOrLanding` (로그인 시 `HomePageV2`, 비로그인 시 `LandingPage`) | `frontend/src/app/pages/HomePageV2.tsx`, `LandingPage.tsx` |
| `/v2` | `HomePageV2` | `frontend/src/app/pages/HomePageV2.tsx` |
| `/v1-legacy` | `HomePage` (롤백·비교용) | `frontend/src/app/pages/HomePage.tsx` |
| `/login` | `LoginPage` | `frontend/src/app/pages/LoginPage.tsx` |
| `/auth/callback` | `AuthCallbackPage` | `frontend/src/app/pages/AuthCallbackPage.tsx` |
| `/record` | `RecordPage` | `frontend/src/app/pages/RecordPage.tsx` |
| `/library` | `LibraryPage` | `frontend/src/app/pages/LibraryPage.tsx` |
| `/sayu` | `SayuPage` | `frontend/src/app/pages/SayuPage.tsx` |
| `/merge` | `MergePage` | `frontend/src/app/pages/MergePage.tsx` |
| `/merge-viewer` | `MergeViewerPage` | `frontend/src/app/pages/MergeViewerPage.tsx` |
| `/settings` | `SettingsPage` | `frontend/src/app/pages/SettingsPage.tsx` |
| `/stats` | `StatisticsPage` | `frontend/src/app/pages/StatisticsPage.tsx` |
| `/stats/:format` | `FormatStatisticsPage` | `frontend/src/app/pages/FormatStatisticsPage.tsx` |
| `/recovery` | `BookStudio` (구 책스튜디오 → 원기충전소) | `frontend/src/app/pages/BookStudio.tsx` |
| `/book-studio`, `/book-create`, `/book-reader/:bookId` | `<Navigate to="/" replace />` (폐기 URL 리다이렉트) | — |
| `/news` | `NewsPage` | `frontend/src/app/pages/NewsPage.tsx` |
| `/novel-studio` | `NovelStudio` | `frontend/src/app/pages/NovelStudio.tsx` |
| `/novel-synopsis` | `NovelSynopsisPage` | `frontend/src/app/pages/NovelSynopsisPage.tsx` |
| `/novel-story` | `NovelStoryPage` | `frontend/src/app/pages/NovelStoryPage.tsx` |
| `/record-prophecy` | `RecordProphecyPage` (= `ProphecyFromRecord`) | `frontend/src/app/pages/ProphecyFromRecord.tsx` |
| `/prophecy-hub` | `ProphecyHubPage` | `frontend/src/app/pages/ProphecyHubPage.tsx` |
| `/record-hub` | `HomeOrLanding` (= 홈으로 흡수) | — |
| `/sns-records` | `SnsRecordsPage` | `frontend/src/app/pages/SnsRecordsPage.tsx` |
| `/onbid-realestate` | `OnbidRealEstatePage` | `frontend/src/app/pages/OnbidRealEstatePage.tsx` |
| `/sayu-health` | `SayuHealthHubPage` | `frontend/src/app/pages/SayuHealthHubPage.tsx` |
| `/sayu-health/ebs` | `SayuHealthEbsPage` | `frontend/src/app/pages/SayuHealthEbsPage.tsx` |
| `/sayu-health/drug` | `SayuHealthDrugPage` | `frontend/src/app/pages/SayuHealthDrugPage.tsx` |
| `/sayu-health/hospital` | `SayuHealthHospitalPage` | `frontend/src/app/pages/SayuHealthHospitalPage.tsx` |
| `/sayu-health/library` | `SayuHealthLibraryPage` | `frontend/src/app/pages/SayuHealthLibraryPage.tsx` |
| `/bible` | `BiblePage` | `frontend/src/app/pages/BiblePage.tsx` |
| `/vocab` | `VocabPage` | `frontend/src/app/pages/VocabPage.tsx` |
| `/diary-learn` | `DiaryLearnPage` | `frontend/src/app/pages/DiaryLearnPage.tsx` |
| `/admin/checklist` | `AdminChecklistPage` | `frontend/src/app/pages/AdminChecklistPage.tsx` |
| `/admin/console` | `DevConsolePage` | `frontend/src/app/pages/DevConsolePage.tsx` |
| `/admin/k-news-publisher` | `KNewsPublisherPage` | `frontend/src/app/pages/KNewsPublisherPage.tsx` |
| `/subscription` | `SubscriptionPage` | `frontend/src/app/pages/SubscriptionPage.tsx` |
| `/business-info` | `BusinessInfoPage` | `frontend/src/app/pages/BusinessInfoPage.tsx` |
| `/terms` | `TermsPage` | `frontend/src/app/pages/TermsPage.tsx` |
| `/privacy` | `PrivacyPage` | `frontend/src/app/pages/PrivacyPage.tsx` |
| `/refund` | `RefundPage` | `frontend/src/app/pages/RefundPage.tsx` |

> CLAUDE.md QA 목록의 `CalendarPage` 는 별도 라우트가 아니라 `RecordCalendar.tsx` 컴포넌트로만 존재. 사용처 확인 안 됨 — best-effort grep 결과 `RecordCalendar` 를 import 하는 활성 파일은 없음 (활성 코드 기준 잠재 좀비 컴포넌트). 참고: `frontend/src/app/components/RecordCalendar.tsx:9`.

### 1.2 BottomNav 노출 메뉴 (`frontend/src/app/components/BottomNav.tsx:18-32`)

| 슬롯 | 라벨 | path |
|---|---|---|
| 1 | HARU | `getOrigin() || '/'` |
| 2 | SAYU·다듬기 | `/sayu` |
| 3 (일반) | 원기충전소 | `/recovery` |
| 3 (개발자 UID 한정) | 개발자 콘솔 | `/admin/console` |
| 4 | 설정 | `/settings` |

- `/v2` 경로에서는 BottomNav 자체가 숨김 (`BottomNav.tsx:13`).
- CLAUDE.md QA 목록의 `LibraryPage`, `SayuModal`, `FormatModal` 은 BottomNav 미노출 — 메뉴는 4개 슬롯만 노출됨.

### 1.3 페이지/라우트 - 메뉴 매트릭스

| 페이지 | 라우터에 마운트 | BottomNav 노출 | 메뉴 외 진입 경로 |
|---|---|---|---|
| RecordPage | O (`/record`) | X | HomePageV2 카드/링크 (코드 미확인) |
| SayuPage | O (`/sayu`) | O | — |
| SettingsPage | O (`/settings`) | O | — |
| BookStudio | O (`/recovery`) | O (라벨: 원기충전소) | — |
| LibraryPage | O (`/library`) | X (메뉴 숨김 — CLAUDE.md 명시) | 직접 URL만 |
| AdminConsole/Checklist/KNewsPublisher | O | O(개발자 UID에 한해) | — |
| LandingPage | `/` (비로그인 시) | X | — |
| HomePage(v1) | `/v1-legacy` | X | 롤백·비교용 |
| MergePage / MergeViewerPage | O | X | RecordPage·HomePageV2 내 진입 (코드 미확인) |

### 1.4 사용 vs 좀비 (페이지 기준)

App.tsx 가 import 하지만 메뉴 미노출이라도 `<Route>` 에 마운트되어 있으면 **사용**으로 판정. 아래는 App.tsx 가 import **하지 않는데** `frontend/src/app/pages/` 에 존재하는 페이지:

| 좀비 후보 페이지 | 메모리/QA 라벨 |
|---|---|
| `AiLibraryPage.tsx` | App.tsx import 없음. 좀비. |
| `HaruRawPage.tsx` | App.tsx import 없음. 메모리상 `.zombie` 라벨 일치. 단, 파일 내부에서는 `lawSearch` 호출 코드 유지 (`HaruRawPage.tsx:33`). |
| `GrammarDashboard.tsx` | 라우트 미마운트지만 `SettingsPage.tsx:13,802` 에서 component 로 사용 — **활성**. |
| `StatsPage.tsx` | App.tsx import 없음. `StatisticsPage.tsx` 가 활성. 좀비 후보. |
| `RecordDetailPage.tsx` | App.tsx import 없음. 좀비 후보. |

> 참고: `routes.tsx` 는 본 워크트리에 **존재하지 않음** (`find frontend/src -name routes.tsx` 빈 결과). 메모리상 "좀비" 로 적힌 routes.tsx 는 이미 제거된 듯.

---

## 2. 사진 시스템

### 2.1 업로드 메커니즘

- **표준 저장소: Firebase Storage**. 일반 이미지(JPG/PNG/WebP 등)는 클라이언트에서 압축 후 Firebase Storage 에 업로드 → downloadURL 을 Firestore 에 저장.
- **HEIC 변환은 Cloudinary 경유**. 클라이언트 → Functions `convertHeic` (`functions/src/index.ts:1168-1196`) → Cloudinary 업로더로 JPG 변환 → secure_url 반환 → 클라이언트가 fetch → Blob → 다시 Firebase Storage 에 업로드.
- Base64 / 외부 URL 직접 임베드는 **사용처 확인 안 됨**.

근거 (`frontend/src/app/components/FormatModal.tsx`):
```
584:        // HEIC → JPG 변환 (Cloudinary, Firebase Functions 경유)
602:            const convertHeicFunc = httpsCallable(functionsInstance, 'convertHeic');
631:          const imagePath = `users/${user.uid}/format_photos/${recordId}_${prefix}_${fileName}`;
633:          await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
```

### 2.2 형식별 업로드 컴포넌트

| 업로드 위치 | 파일/라인 | Storage 경로 패턴 | Firestore 필드 |
|---|---|---|---|
| FormatModal (모든 형식 작성) | `frontend/src/app/components/FormatModal.tsx:558-647` | `users/{uid}/format_photos/{recordId}_{prefix}_{timestamp}_{rand}.jpg` | `${prefix}_images` (`FormatModal.tsx:196, 236`) |
| SayuModal (SAYU 화면 내 추가/삭제) | `frontend/src/app/components/SayuModal.tsx:470-519` | `users/{uid}/format_photos/{fileName}` | `${formatKey}_images` (`SayuModal.tsx:491, 519`) |
| RecordPage (직접 업로드 코드) | 확인 안 됨 — 본문에 import `getStorage`/`uploadBytes` grep 미검출 | — | — |
| profile 이미지 | `frontend/src/app/services/imageService.ts:94` | `profile_images/{uid}/avatar.jpg` | — |

### 2.3 Firestore 저장 필드

- 패턴: `${prefix}_images` 에 `JSON.stringify(string[])` 로 저장 (`SayuModal.tsx:491, 519`).
- FormatModal 의 imagesKey 도 동일 (`${prefix}_images`).
- prefix 정의: `frontend/src/app/types/haruTypes.ts:63-76` (`diary`, `essay`, `mission`, `report`, `work`, `travel`, `garden`, `pet`, `child`, `stock`, `memo`, `haruraw`).

### 2.4 표시 위치

| 컴포넌트 | 어떻게 표시 | 근거 |
|---|---|---|
| `RecordDetailModal.tsx` | **이미지 미표시** — 컴포넌트가 `record.format[]`, `record.content` 만 사용. 이미지 필드 참조 없음 | `RecordDetailModal.tsx:1-138` (image/img/photo grep 결과 0건) |
| `MergeViewerPage.tsx` | `${formatPrefix}_images` 파싱 후 화면용/프린트용 1·2·3 장 레이아웃 렌더링 | `MergeViewerPage.tsx:73, 156-225` |
| ExportModal | `${prefix}_images` 를 PDF/HTML 합본에 `<img>` 임베드 | `ExportModal.tsx:97, 244-318, 942` |
| Functions `generateMergePDFFast` | 서버 사이드 PDF 에서 `record.images` 다운로드 후 임베드 | `functions/src/index.ts:1198-1280` |

> **단, 활성 `MergeViewerPage.tsx` 는 `generateMergePDFFast` 를 호출하지 않음** (활성 파일 grep 결과 0건). 서버측 PDF 합본 함수는 잠재 좀비.

### 2.5 이미지 변환/리사이즈

| 위치 | 동작 |
|---|---|
| `functions/src/index.ts:1168-1196` `convertHeic` | Cloudinary 업로더(`format: 'jpg'`, `folder: 'heic_temp'`) |
| `functions/src/snsAnalyzer.ts:7` | `sharp` import — Facebook ZIP 이미지 처리(가능성). 호출처는 `analyzeFacebookZip` 내부 |
| 클라이언트 압축 | `frontend/src/app/components/FormatModal.tsx:623` `compressImage(file, 800, 0.85)` — 800px / quality 0.85 JPG |

---

## 3. AI 호출 구조

### 3.1 Functions export 함수 목록

전체 `onCall`/`onRequest`/`onSchedule` (`functions/src/index.ts` 및 분리 파일)

| 함수명 | 종류 | region | 사용 모델 | secrets | 정의 파일:라인 | 프론트 호출 |
|---|---|---|---|---|---|---|
| `polishContent` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `functions/src/index.ts:115, 201` | `FormatModal.tsx:472`, `SayuModal.tsx:561`, `ExportModal.tsx:341, 911` |
| `extractTitle` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:236, 252` | `FormatModal.tsx:436`, `SayuPage.tsx:494, 1540, 2021, 2180` |
| `extractKeywords` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:302, 322` | `SayuPage.tsx:424` |
| `clearKeywordsCache` | onCall | asia-northeast3 | — | — | `index.ts:402` | `SayuPage.tsx:1280` |
| `generateTitlesForAll` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:448, 475` | `SettingsPage.tsx:392` |
| `kakaoLoginStart` | onRequest | asia-northeast3 | — | KAKAO_CLIENT_ID/SECRET | `index.ts:766` | (브라우저 redirect) |
| `kakaoCallback` | onRequest | asia-northeast3 | — | KAKAO_CLIENT_ID/SECRET | `index.ts:795` | (브라우저 redirect) |
| `naverLoginStart` | onRequest | asia-northeast3 | — | NAVER_CLIENT_ID/SECRET | `index.ts:875` | (브라우저 redirect) |
| `naverCallback` | onRequest | asia-northeast3 | — | NAVER_CLIENT_ID/SECRET | `index.ts:903` | (브라우저 redirect) |
| `googleLoginStart` | onRequest | asia-northeast3 | — | GOOGLE_CLIENT_ID/SECRET | `index.ts:976` | (브라우저 redirect) |
| `googleCallback` | onRequest | asia-northeast3 | — | GOOGLE_CLIENT_ID/SECRET | `index.ts:1010` | (브라우저 redirect) |
| `sendTestNotification` | onCall | asia-northeast3 | — | — | `index.ts:1085` | `SettingsPage.tsx:341` |
| `scheduledPushNotification` | onSchedule (`0 * * * *`) | asia-northeast3 | — | — | `functions/src/scheduledNotification.ts:4` | (스케줄) |
| `sendBroadcastNotification` | onCall | asia-northeast3 | — | — | `functions/src/broadcastNotification.ts:6` | `SettingsPage.tsx:294` |
| `convertHeic` | onCall | asia-northeast3 | — (Cloudinary) | (`CLOUDINARY_API_SECRET` env) | `index.ts:1168` | `FormatModal.tsx:602` |
| `generateMergePDFFast` | onCall (1GiB, 300s) | asia-northeast3 | — | — | `index.ts:1198` | **활성 호출 없음** (구버전 MergeViewerPage backup 에만 존재) |
| `verifySinglePayment` | onCall | asia-northeast3 | — | PORTONE_API_SECRET | `functions/src/index.ts` | `SinglePaymentPage.tsx` |
| `removeAllTags` | onRequest | asia-northeast3 | — | — | `index.ts` | 폐기됨: 항상 410 응답, 데이터 접근 없음 |
| `lawSearch` | onCall | asia-northeast3 | gemini-3.1-flash-lite ×2 (키워드+조문선별) | LAW_API_KEY, GEMINI_API_KEY | `index.ts:1371, 1414, 1484` | `RecordPage.tsx:508` (활성), `HaruRawPage.tsx:33` (좀비 페이지) |
| `lawEasyExplain` | onCall | asia-northeast3 | gemini-2.5-flash (`index.ts:1568`) ※ CLAUDE.md 는 2.5-pro 라고 적혀 있지만 코드는 flash | GEMINI_API_KEY | `index.ts:1548` | `RecordPage.tsx:588` |
| `lawPrecedent` | onCall | asia-northeast3 | gemini-3.1-flash-lite(키워드) + gemini-2.5-flash(요약) | LAW_API_KEY, GEMINI_API_KEY | `index.ts:1613, 1638, 1723` | `RecordPage.tsx:621` |
| `generateTTS` | onCall | asia-northeast3 | — (Google Cloud TTS / OpenAI) | GEMINI_API_KEY, GOOGLE_CLOUD_API_KEY, OPENAI_API_KEY | `index.ts:1793` | `BiblePage.tsx` 다수, `DiaryLearnPage.tsx:319`, `SayuPage.tsx:150`, `BookReader.tsx:57` |
| `cleanupTtsUsage` | onSchedule | asia-northeast3 | — | — | `index.ts:1933` | (스케줄) |
| `generateBook` | onCall (300s) | asia-northeast3 | OpenAI (chat completions; 모델은 미확인) | OPENAI_API_KEY | `functions/src/bookStudio.ts:16` | `BookCreate.tsx:92` ⚠ `BookCreate` 페이지는 App.tsx 에서 `Navigate` 로 리다이렉트됨 → 실질 호출 경로 차단 |
| `analyzeFacebookZip` | onCall (2GiB, 540s) | asia-northeast3 | — (sharp) | — | `functions/src/snsAnalyzer.ts:44` | `SnsRecordsPage.tsx:165` |
| `convertSnsToDiary` | onCall (120s) | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `functions/src/snsToDiary.ts:19, 92` | `SnsHaruTab.tsx:251` |
| `getWordMeaning` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:1967, 1987` | `DiaryLearnPage.tsx:482` |
| `getGrammarExplain` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY, OPENAI_API_KEY | `index.ts:2010, 2030` | `DiaryLearnPage.tsx:409` |
| `preloadChapterGrammar` | onCall (540s) | asia-northeast3 | (내부 grammar) | GEMINI_API_KEY, OPENAI_API_KEY | `index.ts:2196` | `BiblePage.tsx:180`, `GrammarDashboard.tsx:63` |
| `getVerseQuiz` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:2403, 2423` | `DiaryLearnPage.tsx:455` |
| `translateToEnglish` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:2475, 2484` | `DiaryLearnPage.tsx:222, 251` |
| `fetchTopNews` | onSchedule | asia-northeast3 | gemini-2.5-flash | GEMINI_API_KEY | `index.ts:2509, 2543` | (스케줄) |
| `refreshNews` | onCall | asia-northeast3 | gemini-2.5-flash | GEMINI_API_KEY | `index.ts:2593, 2632` | `NewsPage.tsx:55` |
| `analyzeRecordForProphecy` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:2684, 2791` | `NovelSynopsisPage.tsx:161`, `ProphecyFromRecord.tsx:346` |
| `generateHaruProphecy` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:2838` | `NovelSynopsisPage.tsx:84, 103, 185, 204` |
| `getVerseTranslation` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:3080, 3094` | `BiblePage.tsx` 다수 |
| `getVerseWordMapping` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:3106, 3117` | `BiblePage.tsx` 다수 |
| `getCustomToken` | onCall | asia-northeast3 | — | COLLECTOR_SECRET_KEY | `index.ts:3140` | (활성 호출 미확인) |
| `getOnbidRealEstateList` | onCall | asia-northeast3 | — | ONBID_API_KEY | `index.ts:3158` | `OnbidRealEstatePage.tsx:154` |
| `getDrugInfo` | onCall | asia-northeast3 | — | DRUG_API_KEY | `index.ts:3451` | `SayuHealthDrugPage.tsx:283` |
| `getHospitalList` | onCall | asia-northeast3 | — | HIRA_API_KEY | `index.ts:3710` | (활성 호출 미확인 — `SayuHealthHospitalPage` 는 `analyzeSymptomsForSpecialty` 사용) |
| `analyzeDrugPhoto` | onCall | asia-northeast3 | gemini-3.1-flash-lite (vision) | GEMINI_API_KEY, DRUG_API_KEY | `index.ts:3858, 3924` | `SayuHealthDrugPage.tsx:385` |
| `analyzeSymptomsForSpecialty` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:4141, 4198` | `SayuHealthHospitalPage.tsx:47` |
| `extractKNewsMetadata` | onCall | asia-northeast3 | gemini-3.1-flash-lite | GEMINI_API_KEY | `index.ts:4241, 4279` | `KNewsPublisherPage.tsx:80` |

### 3.2 잠재 좀비 Functions

- `generateMergePDFFast` — 활성 frontend 에서 호출 없음 (`MergeViewerPage.tsx` 가 `window.print` 로 전환된 것으로 보임).
- `removeAllTags` — 폐기된 onRequest 엔드포인트. 항상 410 응답하며 데이터에 접근하지 않음.
- `getCustomToken` — 활성 호출 미확인.
- `getHospitalList` — 활성 호출 미확인 (병원 페이지는 `analyzeSymptomsForSpecialty` 만 호출).
- `generateBook` — `BookCreate` 페이지가 `/book-create` 라우트에서 `<Navigate>` 로 리다이렉트되므로 진입 불가. 함수는 export 중이나 실질 호출 경로 없음.

---

## 4. Cloudinary 사용 여부

- **사용 중**. 위치는 단 하나, HEIC → JPG 변환 함수.
- 패키지: `functions/package.json:20` `"cloudinary": "^2.9.0"`
- 함수: `functions/src/index.ts:1166` `const { v2: cloudinary } = require('cloudinary');`
- 설정: `functions/src/index.ts:1177-1181`
  - `cloud_name: 'dmhutjnpn'` (소스 하드코딩)
  - `api_key: '752573158646558'` (소스 하드코딩)
  - `api_secret: process.env.CLOUDINARY_API_SECRET` (env)
- 업로드 폴더: `'heic_temp'`, 변환 후 `secure_url` 반환.
- frontend 에서는 직접 cloudinary SDK import 없음. `FormatModal.tsx:584-606` 주석만 "Cloudinary, Firebase Functions 경유" 로 언급.
- `res.cloudinary.com` URL 패턴 grep 결과: 활성 코드에는 직접 매칭 없음(임시 변환 URL 만 사용하므로 Firestore 에는 Firebase Storage URL 만 남김).

---

## 5. Gemini 사용 위치 (모델별 매핑)

`getGenerativeModel({ model: ... })` 전수 조사 (`functions/src/index.ts`, `functions/src/snsToDiary.ts`)

| 모델 | 함수 | 용도 | 위치 |
|---|---|---|---|
| `gemini-3.1-flash-lite` | `polishContent` (2회) | 본문 다듬기 / 모드별 변형 | `index.ts:201, 252` |
| `gemini-3.1-flash-lite` | `extractTitle` | 제목 추출 | `index.ts:322` |
| `gemini-3.1-flash-lite` | `extractKeywords` | 키워드 추출 | `index.ts:475` |
| `gemini-3.1-flash-lite` | `generateTitlesForAll` | 전체 제목 일괄 생성 | `index.ts:741` |
| `gemini-3.1-flash-lite` | `lawSearch` (kwModel) | 법령 키워드 추출 | `index.ts:1414` |
| `gemini-3.1-flash-lite` | `lawSearch` (selectModel) | 조문 선별 | `index.ts:1484` |
| `gemini-2.5-pro` | `lawSearch` (summaryModel) | 법령 요약 | `index.ts:1507` |
| `gemini-2.5-flash` | `lawEasyExplain` | 60자 한 문장 쉬운 설명 ※ CLAUDE.md 는 2.5-pro 명시했으나 코드는 flash | `index.ts:1568` |
| `gemini-3.1-flash-lite` | `lawPrecedent` (kwModel) | 판례 키워드 | `index.ts:1638` |
| `gemini-2.5-flash` | `lawPrecedent` (sumModel) | 판례 요약 | `index.ts:1723` |
| `gemini-3.1-flash-lite` | `getWordMeaning` | 단어 의미 | `index.ts:1987` |
| `gemini-3.1-flash-lite` | `getGrammarExplain` | 문법 설명 | `index.ts:2030` |
| `gemini-3.1-flash-lite` | `getVerseQuiz` | 성경 구절 퀴즈 | `index.ts:2423` |
| `gemini-3.1-flash-lite` | `translateToEnglish` | 한→영 번역 | `index.ts:2484` |
| `gemini-2.5-flash` | `fetchTopNews` | 뉴스 수집 | `index.ts:2543` |
| `gemini-2.5-flash` | `refreshNews` | 뉴스 새로고침 | `index.ts:2632` |
| `gemini-3.1-flash-lite` | `analyzeRecordForProphecy` | 기록 분석 | `index.ts:2791` |
| `gemini-3.1-flash-lite` | `generateHaruProphecy` | HARU예언 | `index.ts:2838` 영역 (정확한 모델 위치 grep 미세 결과 — `index.ts:2790-2791` block) |
| `gemini-3.1-flash-lite` | `getVerseTranslation` | 성경 번역 | `index.ts:3094` |
| `gemini-3.1-flash-lite` | `getVerseWordMapping` | 단어 매핑 | `index.ts:3117` |
| `gemini-3.1-flash-lite` | `analyzeDrugPhoto` (visionModel) | 약 사진 분석 | `index.ts:3924` |
| `gemini-3.1-flash-lite` | `analyzeSymptomsForSpecialty` | 증상→진료과 | `index.ts:4198` |
| `gemini-3.1-flash-lite` | `extractKNewsMetadata` | K-뉴스 메타 추출 | `index.ts:4279` |
| `gemini-3.1-flash-lite` | `convertSnsToDiary` | SNS→일기 변환 | `snsToDiary.ts:92` |

### 5.1 모델 카테고리 요약

| 모델 | 함수 수 |
|---|---|
| `gemini-3.1-flash-lite` | 17개 함수 (다수) |
| `gemini-2.5-flash` | 4개 함수 (lawEasyExplain, lawPrecedent 요약, fetchTopNews, refreshNews) |
| `gemini-2.5-pro` | 1곳 (lawSearch summary) |

> CLAUDE.md 의 모델 운영 정책(`gemini-3.1-flash-lite-preview` 고정, HARUraw 는 `gemini-2.5-pro`)과 실제 코드 사이에 **편차 존재**:
> - 정책: `gemini-3.1-flash-lite-preview` / 코드: `gemini-3.1-flash-lite` (preview 접미사 없음)
> - 정책: HARUraw `lawEasyExplain`·`lawPrecedent` = `gemini-2.5-pro` / 코드: 둘 다 `gemini-2.5-flash`

---

## 6. 좀비 파일

### 6.1 카운트 (`frontend/src` + `functions/src` 한정)

```
find frontend/src functions/src -type f \( -name "*.old*" -o -name "*.bak*" \
  -o -name "*.backup*" -o -name "*.zombie*" -o -name "*.broken" \
  -o -name "* 2.*" -o -name "* 3.*" \) → 338개
```

### 6.2 패턴 분포 (요약)

| 패턴 | 예시 |
|---|---|
| `*.old`, `*.old3`, `*.old4`, `*.old_xxx` | `App.tsx.old3`, `MergeViewerPage.tsx.old8`, `SayuPage.tsx.old_snstabs`, `SayuPage.tsx.old_crop` |
| `*.bak`, `*.bak2`, `*.bak_xxx` | `LibraryPage.tsx.bak2`, `RecordPage.tsx.bak_formats_merge`, `firestoreService.ts.bak_ailog` |
| `*.backup`, `*.backup_YYYYMMDD`, `*.backup_xxx` | `SayuPage.backup.tsx`, `SayuPage.tsx.backup_20260319_213446`, `SayuModal.tsx.backup_kakao`, `MergePage.tsx.backup_20260320` |
| `*.broken` | `FormatModal.tsx.broken`, `StatisticsPage.tsx.broken` |
| 공백 + 숫자 변형 (macOS 충돌) | `SayuPage.tsx 2.backup_20260319`, `MergeViewerPage.tsx 2.old3`, `SayuModal.tsx 3.backup_format` |
| `_DEBUG` | `FormatModal_DEBUG.tsx` |

### 6.3 명확히 알려진 좀비 (메모리 + 본 조사)

| 파일 | 상태 |
|---|---|
| `routes.tsx` | 본 워크트리에는 **존재하지 않음** (이미 삭제됨) |
| `HaruRawPage.tsx` | 존재. App.tsx import 없음 → 좀비. 내부 `lawSearch` 호출 코드 있으나 진입 경로 없음 |
| `SayuPage.backup.tsx` | 존재. 명백한 좀비 |
| `RecordDetailPage.tsx` | App.tsx import 없음 → 좀비 후보 |
| `AiLibraryPage.tsx` | App.tsx import 없음 → 좀비 후보 |
| `StatsPage.tsx` | App.tsx import 없음. 활성은 `StatisticsPage.tsx` |

### 6.4 .gitignore 확인 (`.gitignore` 루트)

```
*.old*
*.bak*
*. 3.*
*.bak
*.backup_*
*.old*
*.bak
```

- 백업 패턴은 무시되도록 등록됨 → Git 에는 올라가지 않음.
- `frontend/.gitignore` 추가: `*.backup`, `*.old`.
- 그래도 워크트리 디렉토리에는 338개 잔존 (로컬 보존). 정리 시점 별도 작업 필요.

---

## 7. 현재 완료 기능 (코드 존재 기준)

### 7.1 라우터 path 카테고리화

| 카테고리 | path | 코드 상 작동 가능 여부 |
|---|---|---|
| **핵심 기록** | `/`, `/record`, `/library`, `/merge`, `/merge-viewer`, `/settings` | 작동 가능 (`LibraryPage` 는 메뉴 숨김) |
| **인증** | `/login`, `/auth/callback` | 작동 가능 (카카오/네이버/구글 OAuth 함수 정상 export) |
| **SAYU** | `/sayu` (+ `SayuModal` 컴포넌트) | 작동 가능 — Gemini flash-lite + polishContent/extractTitle/keywords 호출 |
| **통계** | `/stats`, `/stats/:format` | 작동 가능 |
| **하루LAW (HARUraw)** | `/record` 내부 통합 (별도 라우트 없음) | 작동 가능 — `lawSearch`/`lawEasyExplain`/`lawPrecedent` 호출 (`RecordPage.tsx:508, 588, 621`) |
| **원기충전소(구 책스튜디오)** | `/recovery` (= `BookStudio`); `/book-studio`,`/book-create`,`/book-reader/:bookId` 는 모두 `Navigate to="/"` | `BookStudio` 페이지만 활성. `generateBook` 함수는 export 되지만 진입 경로 없음 |
| **소설/예언 (나도작가)** | `/novel-studio`, `/novel-synopsis`, `/novel-story`, `/record-prophecy`, `/prophecy-hub`, `/record-hub`(홈) | 작동 가능 — `analyzeRecordForProphecy`, `generateHaruProphecy` |
| **SNS** | `/sns-records` (`analyzeFacebookZip`); `SnsHaruTab.tsx` (`convertSnsToDiary`) | 작동 가능 |
| **HARU건강관리** | `/sayu-health`, `/sayu-health/ebs`, `/sayu-health/drug`, `/sayu-health/hospital`, `/sayu-health/library` | 작동 가능 — `getDrugInfo`, `analyzeDrugPhoto`, `analyzeSymptomsForSpecialty` |
| **부동산** | `/onbid-realestate` | 작동 가능 — `getOnbidRealEstateList` |
| **뉴스/AI 비서실** | `/news`, `/admin/k-news-publisher` | 작동 가능 — `refreshNews`, `extractKNewsMetadata` |
| **영어성경학습** | `/bible`, `/vocab`, `/diary-learn` | 작동 가능 — `generateTTS`, `getVerseTranslation`, `getVerseWordMapping`, `getVerseQuiz`, `getGrammarExplain`, `getWordMeaning`, `translateToEnglish`, `preloadChapterGrammar` |
| **관리자** | `/admin/checklist`, `/admin/console`, `/admin/k-news-publisher` | 작동 가능 (개발자 UID 한정 메뉴 노출) |
| **결제·구독** | `/subscription`, `/payment/single`, `/single-payment` | 정기결제는 `subscribeWithBillingKey`, 단건 결제는 `verifySinglePayment` 호출 |
| **법적** | `/business-info`, `/terms`, `/privacy`, `/refund` | 작동 가능 (정적 페이지) |

### 7.2 기록 형식 10개 + HARUraw prefix 매핑 검증

`frontend/src/app/types/haruTypes.ts:63-76` 의 `FORMAT_PREFIX` 와 CLAUDE.md 의 prefix 표 비교:

| 형식 | CLAUDE.md prefix | 코드 prefix (haruTypes.ts) | 일치 |
|---|---|---|---|
| 일기 | `diary_` | `diary` | ✓ |
| 에세이 | `essay_` | `essay` | ✓ |
| 여행기록 | `travel_` | `travel` | ✓ |
| 텃밭일지 | `garden_` | `garden` | ✓ |
| 애완동물관찰일지 | `pet_` | `pet` | ✓ |
| 육아일기 | `parenting_` | `child` | ✗ **불일치** (CLAUDE.md `parenting_` vs 코드 `child`) |
| 선교보고 | `mission_` | `mission` | ✓ |
| 일반보고 | `report_` | `report` | ✓ |
| 업무일지 | `work_` | `work` | ✓ |
| 메모 | `memo_` | `memo` | ✓ |
| HARUraw | `haruraw_` | `haruraw` | ✓ |
| (HARU주식관리) | — | `stock` | 코드에만 존재 (CLAUDE.md 10개 표 외) |

> 11번째 형식 `HARU주식관리(stock)` 가 코드에 추가되어 있음. CLAUDE.md 의 "기록 형식 10개" 와 차이.

---

## 다음에 더 봐야 할 곳 (선택)

- `HomePageV2.tsx` 안에서 `/record`·`/library`·`/calendar`·`/sayu-health` 등으로 진입하는 카드 구성 — 라우터에 등록된 path 가 실제로 사용자 동선에 노출되는지 매핑.
- `MergeViewerPage.tsx` 의 현재 PDF 출력 방식이 `window.print` 인지 확인 후 `generateMergePDFFast` 정리(undeploy) 검토.
- `lawEasyExplain` / `lawPrecedent` 의 실제 모델이 `gemini-2.5-flash` 인데 CLAUDE.md 는 `gemini-2.5-pro` 로 적힘 — 정책/코드 둘 중 하나는 조정 필요.
- `parenting_` vs `child` prefix 차이 — Firestore 마이그레이션 흔적인지 단순 문서 오류인지 확인 필요 (구 데이터가 `parenting_` 로 남아있을 가능성).
- `BookCreate` 가 `Navigate` 로 막혀있는 상태에서 `generateBook` Function 이 계속 deploy 되어 있으면 OpenAI 비용 위험은 없으나 정리 가치 있음.
