# 기록 입력·비서 선택 구분 검증

- 요청: 기록할 곳과 비서 선택·입력 위치가 헷갈리므로 글상자 경계를 명확히 표시.
- 기준: origin/main `d5c28c23d1fa9c323ac2c32dc2f8bbc0c037b89b`, 작업 브랜치 `codex/input-clarity-20261106`.
- 범위: 홈과 일반 기록 초안, 공통 기록·비서 AI 질문창, 하루LAW 질문창의 시각 표현 및 홈 비서 선택 안내. 저장·전송·선택 목록 처리 로직은 변경하지 않음.
- 표시: 기록은 연녹색 배경·2px 테두리, 질문은 연파란색 배경·2px 테두리. 항상 보이는 label과 3px focus outline. 비서명·선택 버튼·선택한 비서 제목·이용 버튼을 명시.

## 검증

- `node --import tsx --test test/homeRecordComposer.test.mjs test/homeAssistantSelection.test.mjs`: 8건 통과.
- `npm run test:question-enter`: 21건 통과. 한글 조합 보호, Enter/Shift+Enter 동작 유지.
- `npm run test:question-inputs`: 기존 3줄·크기 조절·잠금 정책 검사 통과.
- `npm run build`: 성공. 로컬 worktree에 실제 Firebase 환경값이 없어 검증용 더미 환경값 사용. 운영 배포용 빌드가 아님. 기존 대형 번들·동적 import·Vite 설정 경고 발생.
- `git diff --check`: 통과.
- 기존 home-assistants-browser 격리 환경의 Firebase mock에 auth/orderBy/onSnapshot export를 보완. 현황 카드 자체는 검증 범위에서 제외(auth.currentUser=null).
- 실제 HomePageV2/HomeRecordComposer: 데스크톱 표시, 빈 글상자 버튼 비활성, 원문 입력 → 형식 선택 → 메모 편집창에 같은 원문 전달 확인.
- 홈 카드 → ‘선택한 비서 · 하루LAW’ → 이용하기 → `/haru-law` 경로와 기존 이동 state 유지 확인. 역할 설명을 여는 것만으로 즐겨찾기 저장은 발생하지 않음.
- 기존 390px/320px iframe 검증: 스크롤바를 제외한 viewport 375px/305px에서 문서 scrollWidth 일치, 기록칸 경계·배경 표시, 320px의 긴 비서명 선택 대화상자 표시 확인.
- 실제 HaruLawPage/HaruLawPanel 격리 환경: visible label, 2px 테두리, 연파란 배경, 3px focus outline 확인. 합성 질문 입력 → 모의 응답 표시 확인. 운영 AI·Firestore 호출 없음.
- 공통 ResultChatModal은 빌드와 기존 질문 정책·키보드 테스트 범위에서 확인. 모든 비서의 개별 화면 및 운영 로그인 실기기 E2E 전체를 수행한 것은 아님.

## GitHub·Slack 대조 및 운영 상태

- 선행 PR 351은 GitHub에서 병합 SHA d5c28c23 확인. Hosting 실행 42200434210 성공.
- Slack 대표/CC 기록: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793960245034969 — PR 345~351 병합·배포와 대표님 계정의 현황 확인 기록을 보존.
- 이번 변경은 위 배포 이후 별도 요청으로 작업했으며, 기존 성공 근거를 대체하지 않음.
- PR 352는 별도 작업. 이번 홈 변경은 비서 선택 안내 영역으로 한정하고 PR 352의 추천 비서 배열 변경은 포함하지 않음.
- 이번 변경의 main 병합·운영 배포는 수행하지 않음. 리뷰와 운영 반영 승인이 남음.
- Functions 리전 asia-northeast3, Firestore users/{uid}/records/{date}, Rules, 환경변수 설정, 결제·인증, AI 호출 로직 변경 없음.
- Slack 검색은 수행했으나 이번 결과를 직접 게시하지 않음. 최종 대화에 게시 가능한 확정 요약 제공.
