# 기록·비서 질문 입력칸 3줄 검증 및 인수인계

- 사용자 지시: 기존 작업 완료·검증 후 모든 기록 형식·비서 질문칸의 작은 높이는 키우고 큰 높이는 줄여 3줄로 맞춘다. 기존 목표·수정사항을 보존한다.
- 기준 main: `69c371cce46f39f8720283167c037d099fede7af`.
- 변경 커밋: `d6c012ea`, 브랜치 `codex-question-input-three-lines`.
- 상태: 구현·로컬 검증 완료. 초안 PR 검토, 병합·운영 배포는 별도 단계이며 판정①을 주장하지 않는다.

## 기존 작업 확인

- PR #272 main 병합 `de9e1c25`, PR #271 main 병합 `69c371cc`.
- #271 Hosting 실행 38004176369: success, headSha `69c371cc` 재확인.
- F-13~F-19 구현을 기준 main에서 그대로 계승. 실기기 운영 E2E는 미확인 상태를 유지한다.
- 과거 잔여 쟁점은 이슈 #273이며 이번 입력칸 수정에서 변경하지 않는다.

## 범위 및 구현

1. `ResultChatModal.tsx`: 모든 연결된 기록 형식·비서의 공통 AI 질문 입력을 1줄 input에서 3줄 textarea로 변경. 기존 글꼴·색·버튼·첨부·전송·로딩/선택 대기 잠금을 보존. Enter 전송, Shift+Enter 줄바꿈, IME 조합 중 전송 방지.
2. `ReadingAiChat.tsx`: 독서 AI 자유 질문 2줄 → 3줄. 참고 메모 제안 편집칸은 그대로 유지.
3. `HaruLawPanel.tsx`: 하루LAW 질문 8줄/235px → 3줄. 저장일·첨부·분석·저장 로직은 그대로 유지.

`rows=3`과 명시적 행 높이로 표시하고 사용자가 입력칸 크기를 바꾸지 않도록 한다. 글자 수 제한은 바꾸지 않으며 긴 질문은 내부 스크롤을 사용한다. 이미 3줄인 건강·반려동물 증상 입력칸은 유지한다. 기록 본문·수정 결과·메모·검색/날짜 입력은 질문칸과 구분하여 보존한다. 질문 기능이 없는 화면에 새 AI 질문 기능을 추가하지 않는다.

Firestore 경로·Functions 리전·환경변수·AI 호출/모델·결제·인증·Rules·모바일 변경 없음. 금지 파일 `routes.tsx`, `HaruRawPage.tsx`, `.zombie`, 숨김 LibraryPage 변경 없음.

## 검증 결과

- `git diff --check`: 통과.
- frontend에서 `node --import tsx --test test/ledgerExportConsistency.test.mjs test/ledgerEmptyExport.test.mjs test/recordPhotoPolicy.test.mjs test/haruLawError.test.mjs test/readingAi.test.mjs`: 38/38 통과.
- `npm run build`: 성공. 로컬은 필수 Firebase 변수 6개에 합성 QA 값을 제공하여 검증했으며 운영 연결·배포용 산출물이 아니다. 기존 번들 크기 경고 있음.
- 실제 변경 JSX를 가져와 외부 Firebase·AI 호출 없이 React로 렌더링한 격리 Chromium 검증: 42개 통과. 화면 폭 390/1280px 각각 세 입력칸의 3줄 내용 높이, 명시적 3줄 입력의 클리핑 없음, 수평 화면 이탈 없음, 긴 텍스트 내부 스크롤 확인. 공통 질문 Enter 전송·Shift+Enter 줄바꿈·IME 조합 중 전송 방지·로딩 시 입력과 전송 잠금 확인.
- 실제 측정 높이: 공통 AI·독서 AI 89px(본문 63px / 행 21px), 하루LAW 94px(본문 72px / 행 24px). 글꼴·테두리 차이 때문에 픽셀 높이는 달라도 텍스트 표시 분량은 3줄이다.
- 이는 실제 컴포넌트 전체의 로그인/네트워크/운영 E2E가 아닌 입력 JSX의 격리 검증이다. iOS Safari·실기기 운영 E2E는 미확인.

### 기존 테스트 실패 분리

추가 확인한 `node --test test/haruLawSave.test.cjs`는 2 통과 / 8 실패 / 1 제외. 확인된 오류는 `lawSaveRef is not defined`이며 현재 구현과 오래된 테스트 harness의 불일치가 보인다. 변경 전 main의 동일 테스트·대상 파일을 별도 디렉터리에 추출하여 실행해 동일한 2/8/1 결과를 확인했다. 이번 변경은 저장 핸들러를 바꾸지 않으며 이 실패를 통과로 보고하지 않는다. 저장 테스트 harness 보완은 별도 작업으로 남긴다.

## 다음 첫 행동과 복구

- 최신 PR HEAD CI 및 리뷰를 확인한다. 입력 UI 검토 후 승인 범위에 따라 병합·Hosting 배포한다.
- 실제 화면에서는 기록 결과 AI 대화, 독서 자유 질문, 하루LAW 질문에서 3줄 입력·긴 질문 스크롤·전송을 확인한다.
- 복구는 기능 커밋 `d6c012ea`의 revert PR로 진행하며 기존 F-13~F-19 커밋은 되돌리지 않는다.
- main 직접 수정·강제 push·전체 Functions/Rules 배포·민감정보 기록 금지.

난이도: 5.5 중간.
