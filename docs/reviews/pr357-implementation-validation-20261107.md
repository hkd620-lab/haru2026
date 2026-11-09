# PR #357 구현 검증 및 Firebase 조사

- 기준 코드: `9c0fdedd6c1dd51592799dbf054eb7190a4207c7` (코드 검증 후 이 기록을 추가).
- PR: https://github.com/hkd620-lab/haru2026/pull/357
- 요청: 허대표님이 CCR 잔여 작업을 기장 권고 순서대로 진행하도록 지시. 문구·체험 수정 및 읽기 전용 조사 범위이며 운영 병합·배포 승인은 별도.
- 원 요청/대조: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793960245034969 및 https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1794051253280329. Slack 원 의견은 이전 코드 기준이며 PR352~356의 기존 완료 근거를 보존했다.

## 구현과 검증

- SAYU 준비 예시 7종·20편에서 원문에 없는 사건·감정·교훈을 제거. 직접 입력 체험은 AI 실행/저장 없이 입력 그대로 표시하며 준비된 의미·통계 예시와 구분한다.
- 가계부(기간 비교)·보조장부(거래처/증빙/엑셀)의 차이와 미래전망의 AI 창작 성격을 홈 및 소개 화면에 표시. 이름·키·라우트·내 비서 저장 기능은 유지.
- 랜딩에서 SAYU 문장 다듬기와 모아보기·통계를 구분. OCR·EPUB 설명, 일반 AI 이용 횟수 안내를 추가. 요금/할당 로직 변경 없음.
- Functions·Rules·인덱스·환경변수·인증·결제·모바일 변경 없음. Firestore `users/{uid}/records/{date}`, Functions `asia-northeast3` 유지. 별도 PR356의 회사 호박/서비스 포도 로고를 보존.
- `node --test test/sayuPreviewInput.test.cjs`: 실제 페이지 계산식을 추출·실행하여 직접 입력/기본 예시/빈 입력 10/10 통과.
- `node --import tsx --test test/homeRecordComposer.test.mjs test/homeAssistantSelection.test.mjs test/monthProgress.test.mjs`: 40/40 통과.
- `node --import tsx --test test/homeRecordComposer.test.mjs test/writeBeforeFormat.test.mjs`: 12/12 통과.
- `npm run test:subscription-display`, `npm run test:share-image-meta` 통과.
- `npm run build` 통과(로컬 검증용 합성 Firebase 환경값). 코드 HEAD 9c0fdedd의 실제 PR build_and_preview 및 Deploy Preview도 SUCCESS: https://github.com/hkd620-lab/haru2026/actions/runs/42374224676
- TypeScript 전용 의존성/검사 스크립트 도입은 별도 결정 사항이며 빌드를 타입검사로 표현하지 않는다.

## 브라우저 QA

- 미리보기: https://haru2026-8abb8--pr357-codex-ccr-followups-3cespho2.web.app
- `/gyeongdae-preview`: 직접 입력 `오늘은 속상했다.` → `직접 입력한 문장`에 동일 문장 표시. 준비된 가족·평온 의미는 직접 입력의 분석 결과가 아니라는 안내 확인. AI 호출·실제 기록 저장 안 함.
- 320px viewport에서 체험·랜딩의 DOM clientWidth/scrollWidth 각각 305/305, 390px 랜딩 375/375로 가로 넘침 없음. 온보딩의 원문 보존 예시와 기간별 모아보기/작성 현황 문구 확인.
- 기존 홈 격리 fixture(`test/home-assistants-browser`, 실제 HomePageV2 + mock 서비스)에서 전체 보기 및 보조장부/미래전망 소개창의 수정된 설명 확인. 320px에서 305/305로 가로 넘침 없음. 내 비서 추가나 이용 시작 버튼을 누르지 않았고 저장 없음 상태 유지. 이 fixture의 월간 카드 mock 오류는 운영 재현/과금 측정 근거가 아님.
- `/prophecy-hub`: 기록/질문 답변으로 만드는 AI 창작 이야기라는 소개와 두 시작 방식 표시 확인. 실제 생성 버튼의 후속 기능/AI 품질/실기기 운영 결과는 이번 검사 대상이 아님.
- 원격 브라우저·격리 화면 확인을 운영 배포 또는 실기기 E2E 완료로 확대하지 않는다.

## Firebase 월간 카드 읽기 조사

### 실제 측정

2026-11-07, 현재 인증 계정 본인의 2026년 11월 records만 읽기 전용 Query Explain(analyze=true)로 확인. 실제 월간 카드와 같은 날짜 범위/역순 조건, 개인정보를 보관하지 않기 위해 `__name__` projection 사용.

보존한 3회 결과는 각각 문서 반환 10개, readOperations 10, documentsScanned 10, indexEntriesScanned 10, documentsBillable 10, indexEntriesBillable 0. 실행 시간 13.721ms / 4.377ms / 10.510ms. 인덱스 `(date DESC, __name__ DESC)`.

이전 1차 실행에서도 3회 분석 요청은 성공했으나 이어진 후보 쿼리 오류 응답 파싱 실패로 결과 보관 전에 종료했다. 파서를 수정한 재실행의 3회 결과를 보존했다. 전체 측정 요청이 총 3회뿐이었다고 주장하지 않는다.

`formats ARRAY_CONTAINS_ANY` 11종을 추가하는 후보는 analyze=false 계획 확인에서 HTTP400/FAILED_PRECONDITION. 오류 본문을 보관하지 않아 정확한 세부 원인은 확정하지 않는다. 새 인덱스를 만들거나 운영 쿼리를 바꾸지 않았다.

### 구독 제어기 관찰과 한계

실제 `monthProgressController.ts`를 합성 구독 어댑터로 실행: 최초 1회, 같은 mount에서 60회 refreshToday 및 동일 uid start의 추가 구독 0회, 오류 후 retry 추가 1회, 재mount 추가 1회, 최대 활성 구독 1, stop 후 0. 이는 실제 제어기의 구독 호출 수 관찰이며 Firebase 접속/과금 측정이 아니다. 첫 시험 어댑터가 오류로 종료된 구독을 활성 상태로 세던 것을 수정한 뒤 위 결과를 확인했다.

Query Explain은 polled query만 지원한다. 위 readOperations를 `onSnapshot` 최초/갱신/재접속의 실제 청구량으로 동일시하지 않는다. IAM으로 실행하여 Security Rules의 부가 읽기는 포함하지 않았고, 이름 projection이므로 전체 문서 전송 바이트도 측정하지 않았다. 단일 계정/한 달 표본이므로 전체 사용자 분포·비용으로 확대하지 않는다. 클라이언트는 memoryLocalCache이며 페이지 mount/retry/재접속의 실제 SDK 비용은 별도이다.

권고: 이번 10개 표본만으로 즉시 운영 필터/인덱스 변경을 하지 않는다. 월간 카드 전체 최적화 완료 판정은 유보한다. 향후 실제 SDK 스트리밍/재접속 읽기 및 전송량, 기존 형식 데이터의 필터 호환성을 확인한 뒤 변경 효과가 입증되면 별도 작업으로 결정한다.

공식 근거:
- https://firebase.google.com/docs/firestore/query-explain
- https://firebase.google.com/docs/firestore/reference/rest/v1/ExplainMetrics
- https://firebase.google.com/docs/firestore/pricing

### 원본 보관

- 외장(APFS LaCie UUID `06827F85-BF9F-465C-9C30-E39085839975`) 확인 후 새 폴더에 보존.
- `/Volumes/LaCie/Mac_작업/완료자료/HARU2026/20261107_214953_CCR_후속_검증/month-card-query-explain.json`
- SHA-256 `2e6adcab2a1423055443376648d1be89381fdf1c20c7d08ca005303ccfff1a62`; 별도 sha256 파일과 대조 완료. 계정 이메일·uid·토큰·기록 제목/본문 보관 없음.

## 현재 판정 범위

구현/검증 완료, 독립 Claude 및 Codex 검토 진행 전. 운영 미배포. 실제 사용자 입력이 AI로 다듬어지는 품질이나 전체 Firebase 요금 개선을 완료로 선언하지 않는다. 새 Slack 게시 승인은 아직 요청 전이므로 이 문서만으로 게시했다고 기록하지 않는다. 작업 난이도: 중간.
