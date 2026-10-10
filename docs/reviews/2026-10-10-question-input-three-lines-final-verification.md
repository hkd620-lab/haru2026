# 질문 입력칸 최종 범위·검증 보충

이 파일이 최종 구현 범위를 설명한다. 앞선 3개 컴포넌트 검증은 최초 구현 시점 기록이며, 최종 구현은 기록 작성 질문칸도 포함한다. 사용자에게 범위 질문을 제시했으며, 별도 답변 없이 원 요청의 "모든 기록 형식"에 작성 질문칸까지 포함하는 것으로 해석해 진행했다.

## 최종 범위

- FormatModal: 기록 형식 공통 상세 질문, 간편 작성, 일기 상세, 독서 본문 입력, 보조장부 업무 메모/일반 메모, 주식 기록 입력을 3줄로 맞춘다. 저장된 본문 내용·항목·placeholder·잠금·저장·SAYU 처리 로직을 보존한다.
- ResultChatModal: 연결된 모든 기록 형식·비서 공통 AI 질문을 3줄로 맞춘다. Enter 전송 / Shift+Enter 줄바꿈. 한글 등 IME 조합 상태는 ref로 추적하고 nativeEvent.isComposing 및 WebKit keyCode 229일 때 전송하지 않는다.
- ReadingAiChat: 독서 자유 질문 3줄.
- HaruLawPanel: 하루LAW 첫 질문 235px에서 3줄로 축소.
- NovelStudio: 전망받고 싶은 상황 직접 질문 3줄.
- DiaryLearnPage: 외국어일기 첫 작성 입력 220px에서 3줄로 축소.
- 생성된 결과물을 수정하는 편집기, 기존 기록 조회·SAYU 본문 편집기, AI 참고 메모 제안, 날짜·금액·선택 입력은 보존한다. 이미 3줄인 건강/반려동물 증상 질문칸도 유지한다.

질문 기능 없는 화면에 새로운 AI 기능을 추가하지 않는다. 글자 수 제한·입력 내용·Firestore 경로·Functions 리전·환경변수·AI 호출/모델·결제·인증·Rules·모바일 변경 없음. 기존 F-13~F-19는 기준 main 69c371cc를 그대로 계승한다.

## 최종 검증

- 관련 테스트 45/45: `node --import tsx --test test/ledgerExportConsistency.test.mjs test/ledgerEmptyExport.test.mjs test/recordPhotoPolicy.test.mjs test/haruLawError.test.mjs test/readingAi.test.mjs test/formatRegistry.test.mjs`.
- 합성 Firebase QA 변수 6개로 `npm run build` 성공. 배포용 산출물은 아니며 외부 운영 DB/AI 호출 없음.
- 변경된 실제 JSX 12종을 격리 React/Chromium으로 렌더링하여 390/1280px에서 136개 검증 통과: 3줄 실제 내용 높이, 3줄 입력 클리핑 없음, 긴 글 내부 스크롤, 수평 이탈 없음, Enter 전송·Shift+Enter 줄바꿈·IME 조합 상태·native isComposing·keyCode 229 전송 방지·로딩 입력/버튼 잠금.
- `git diff --check` 통과. 저장·AI·첨부 처리 변경 없음은 diff로 확인했다.
- 실기기 iOS Safari의 실제 IME와 로그인된 전체 화면 E2E는 미확인이다. 합성 이벤트 검증을 실기기 검증으로 표현하지 않는다.
- 추가 확인한 하루LAW 저장 테스트의 2 통과/8 실패/1 제외는 변경 전 main에서도 동일하다. 확인된 ReferenceError는 lawSaveRef is not defined. 저장 테스트 harness 보완은 별도 남는다.

## 첫 리뷰 지적 및 반영

- Codex 실행 1: 요청 https://github.com/hkd620-lab/haru2026/pull/274#issuecomment-6094947166, 대상 2d03e1e5, 시작 2026-10-10T07:06:10.739072Z, 완료 2026-10-10T07:09:07.926459Z, 리뷰 ID 5478079081.
- P2 Safari IME: https://github.com/hkd620-lab/haru2026/pull/274#discussion_r4236814726 → composition 상태 ref 및 keyCode 229 확인을 추가했다.
- P2 검증 문서 activeLawQuery 표현: https://github.com/hkd620-lab/haru2026/pull/274#discussion_r4236814730 → 검증 문서에서 확인되지 않은 오류 이름을 제거했다. 이전 원문은 2d03e1e5 커밋에 보존되며, 수정 diff를 다음 검토 요청에 명시한다. 최초 실행/지적은 삭제하지 않는다.
- 최신 변경은 재검토 대상이며 이전 리뷰로 승인 또는 판정①을 주장하지 않는다.

## 배포·다음 행동

이 PR은 초안이며 병합·운영 배포하지 않는다. 최신 HEAD CI/프리뷰와 재검토를 확인한 후 승인 범위에 따라 병합·Hosting 배포한다. 원 작업 #271/#272 병합·Hosting 성공 및 실제 기기 E2E 미확인 상태는 그대로 유지한다.

최소 실제 화면 확인: 기록 작성 질문 3줄, 독서 질문 3줄, 하루LAW 첫/추가 질문, 전망 직접 질문, 외국어일기 작성. 긴 글 스크롤·내용 보존·저장/전송·iOS 한글 확정 Enter를 확인한다. 복구는 이번 UI 커밋의 revert PR로 진행하며 F-13~F-19를 되돌리지 않는다.

난이도: 5.5 중간.
