# PR #274 CC 의견 — 기록·비서 질문 입력칸 3줄 통일 (대상 HEAD 5bb6758f)

- 작성 시각(UTC): 2026-10-10T08:41Z
- 대상: PR #274 (`codex-question-input-three-lines`, 초안) HEAD `5bb6758f14d81595c6132aca06cf1336382b3b98` / 기준 main `69c371cce46f39f8720283167c037d099fede7af`. 앱 코드가 마지막으로 바뀐 커밋은 `1ba530f3`, Codex 2회가 검토한 `e4ff864e` 이후는 docs/reviews 새 파일 2건(A)뿐이다.
- 작성: CC. 이 의견은 위 HEAD에 대한 것이며 작성 시점까지 앱 코드 수정과 PR 브랜치 push는 없었다. 같은 날 허대표님이 보완 구현을 지시했으며, 그 사이클은 별도 기록으로 이어간다.
- 근거: 최초 의뢰문(`2026-10-10-question-input-cc-request.md`), 독립 Claude 1회 질문·결과 원문(`…-claude-independent-1-request.md`, `…-1-result.md`), 아래 직접 검증, 재현 도구·결과(`2026-10-10-question-input-cc-repro/`).

## 1. 판정

- **CC 판정: 수정 후 승인.** 독립 Claude 1회(수정 후 승인, 1회차)와 같다. P1은 없고 재설계도 아니다.
- 승인으로 바꾸는 조건
  1. F1: Enter 전송의 `requestSubmit()` 의존을 없앤다.
  2. F2: IME 방어를 보강하고 재현 테스트를 둔다.
  3. F3: 작성칸까지 줄인 범위 해석을 허대표님이 확인하거나, 장문 작성칸의 세로 크기 조절을 되살린다.
  4. 실기기 iOS Safari·Android 키보드의 한글 확정 Enter를 확인한다.
- 규모: 중규모(컴포넌트 6개, 공통 AI 모달의 입력 요소와 키 처리 변경).
- 정책 8.1 멈춤 조건: **해당 없음.** diff에 저장 경로·마이그레이션, 운영 데이터, 결제·인증, Rules, 새 AI 호출·모델·호출량 증가, 홈·라우터 변경이 없다(CC가 diff로 확인). Enter 전송은 기존 폼 제출과 같은 `sendQuestion` 경로다.
- 판정①(자동 병합 판정) 조건은 **미충족**이다. 독립 Claude 판정이 "승인"이 아니고 실기기 E2E가 없다. 이 의견은 병합·운영 배포 승인이 아니다.

## 2. 검증 구분 — 기장 보고와 CC 직접 확인

| 항목 | 기장 보고 | CC 직접 확인 |
|---|---|---|
| HEAD 구성 | e4ff864e 이후 docs 2건 | `git diff --name-status e4ff864e 5bb6758f` = A 2건(codex-index-2, codex-result-2). 기준 대비 11개 파일(앱 6·문서 5, +194/−23) |
| CI 실행 38034254488 | 성공 | GitHub 체크런 조회: build_and_preview 성공(07:23:24Z~07:25:24Z), Deploy Preview 성공. CI는 빌드·프리뷰 배포만 하며 단위·UI 시험은 돌리지 않는다 |
| 회귀 45/45 | 통과 | **재현.** 별도 worktree에서 지정 6개 파일 45/45(3.8초). 단 이 시험은 장부·사진·AI 오류·독서 AI·형식 등록 로직이라 변경된 입력칸·키 처리를 검사하지 않는다 |
| QA 환경 빌드 | 성공(합성 변수 6개) | **다른 조건으로 재현.** 더미 Firebase 변수 12개로 `vite build` 성공(1분 12초). `tsc --noEmit`은 기준·PR 모두 250건, 전부 `ExportModal.tsx`(미사용 파일), 출력 동일 — 신규 오류 0. `git diff --check` 깨끗 |
| 격리 Chromium 136개 | 통과 | **재현 불가.** 시험 스크립트가 PR·저장소에 없다. 대신 PR HEAD의 실제 JSX 원문을 AST로 뽑아 앱의 실제 React·Tailwind·전역 CSS로 렌더하는 별도 시험을 만들어 **276/276** 통과. 두 숫자는 같은 검사가 아니다 |
| 실기기 iOS Safari 실제 IME | 미확인 | CC도 미확인(수행 불가) |
| 로그인된 전체 화면 E2E | 미확인 | CC도 미확인. 프리뷰 URL은 이 세션의 외부 접속 정책(프록시 403)으로 열 수 없었다 |
| 하루LAW 저장 시험 8실패 | 변경 전 main과 동일(2통과·8실패·1제외) | CC는 실행하지 않음. 독립 검토자가 기준·PR 각각 실행해 같음을 확인 |

## 3. CC 직접 재현 결과

### 3.1 범위·영역 구분
- 저장소의 `<textarea>` 78개 중 PR이 건드린 것은 12개(HaruLawPanel 1, FormatModal 7, ReadingAiChat 1, DiaryLearnPage 1, NovelStudio 1, ResultChatModal은 `<input>`→`<textarea>` 전환). 질문 문구(`질문`·`물어`·`궁금`)를 가진 입력칸은 `ResultChatModal`·`ReadingAiChat` 두 곳뿐이며 둘 다 변경됐다.
- **③ 결과 편집기·기존 기록 편집기는 변경되지 않았다.** AI가 다듬은 결과 편집기(min-height 400px), 독서사유 SAYU 분석(240px), SayuModal·ElderBook·RecordBook·SnsStory 편집기, AI 참고 메모 제안(rows 4)이 그대로다.
- `RecordModal`·`FormatModal_DEBUG`·`ExportModal`은 저장소 안에서 import되지 않는다(grep 기준). 전체 인벤토리와 기준 대비 차이는 `…-cc-repro/textareas-*.txt`.

### 3.2 3줄 높이·긴 글 스크롤 (Chromium, 390px·1280px)
- 12개 입력칸의 빈 상태 내용 높이가 **3.00~3.03줄**(반올림 오차)이다. 줄 높이는 19.5~25.5px.
- 3줄을 입력하면 잘리지 않고(scrollHeight = clientHeight), 15줄과 긴 한 문단은 칸 안에서 스크롤된다. 입력량이 늘어도 칸 높이는 고정이고 가로 넘침이 없다. 한글 타이핑 값은 보존된다.
- 3줄 높이를 덮는 `height`/`minHeight`는 남아 있지 않다. 일기 상세(`FormatModal:5103`)의 `minHeight:56px`는 3줄 높이(약 108px)보다 작아 영향이 없다.
- 이 시험은 입력칸 단위다. 전체 모달 안에서의 배치(스크롤 컨테이너, 키보드 가림)는 보지 못했다.

### 3.3 질문 폼 키 처리 (ResultChatModal, 실제 폼 JSX + 원문 `sendQuestion` 가드 대역)
- Enter = 전송 1회·입력칸 비움. Shift+Enter = 줄바꿈(전송 없음). 여러 줄 질문이 줄바꿈 포함 그대로 전송된다.
- 빈 입력·공백만 입력한 Enter는 `requestSubmit()`이 실행되지만 `sendQuestion`의 `!trimmed` 가드가 막아 전송 0건이다. 전송 버튼은 입력이 없으면 비활성, 있으면 활성이며 클릭 전송이 동작한다.
- IME(합성 이벤트): Chrome 순서(조합 중 keydown, `isComposing=true`)는 전송하지 않고 기본 동작도 막지 않는다. Safari 순서(`compositionend` 뒤 keydown, `isComposing=false`, keyCode 229)도 전송하지 않는다. 조합이 끝난 뒤 일반 Enter(keyCode 13)는 전송한다.
- IME(Chromium 실조합, CDP `Input.imeSetComposition`): 조합 중 Enter는 전송하지 않는다. 정상 확정(`Input.insertText`) 뒤 Enter는 `compositionend` → keydown(13) 순서로 전송된다. 조합 중 포커스 이동·값 교체 시 Chromium은 `compositionend`를 발생시켜 조합 표시(ref)가 풀린다.

### 3.4 F1 — `requestSubmit` 미지원 브라우저 모사
- `HTMLFormElement.prototype.requestSubmit`을 지우고 Enter를 누르면 `TypeError: … requestSubmit is not a function`이 나고 질문은 전송되지 않는다. 입력값은 남고 전송 버튼은 계속 동작한다. `preventDefault()`가 먼저 실행되어 줄바꿈도 들어가지 않으므로 Enter가 아무 일도 하지 않는 것처럼 보인다.
- 이 앱은 `vite.config.ts`의 `@vitejs/plugin-legacy`가 `ios >= 13`을 지원 대상으로 둔다. `requestSubmit`은 Safari 16부터 지원하며 이 플러그인은 DOM 메서드를 폴리필하지 않는다(코드 추정). 변경 전 `<input>`은 암묵적 폼 제출로 모든 브라우저에서 동작했다.

### 3.5 F2 — IME 방어선과 조합 표시 고착
- Safari 순서에서는 `compositionend`가 keydown보다 먼저 와서 ref가 이미 `false`다. 실질 방어선은 `keyCode === 229` 하나다. iOS가 확정 Enter에 229를 주지 않는다면 보호가 없다(실기기 미검증).
- 합성 Enter(keyCode 13)를 조합 중에 넣으면 `compositionend`가 오지 않아 ref가 `true`로 고착되고 이후 Enter는 줄바꿈만 넣는 것을 재현했다(독립 검토자도 `compositionend` 누락 시 같은 고착을 실행으로 확인). 실제 IME에서 얼마나 자주 생기는지는 알 수 없다. 포커스 이동(blur)에서 ref를 풀어 주면 막을 수 있다.

### 3.6 F-13~F-19 보존
- PR의 FormatModal 변경 구간은 4018~5888행의 입력칸 스타일뿐이다. F-19 오류 분기(1378~1384행)와 F-18 사진 초과 안내(1985행) 근처 코드는 바뀌지 않았다. 기준 main 69c371cc의 F-13~F-19 코드를 그대로 이어받는다.

## 4. 지적별 판단과 최소 수정

| 지적 | CC 판단 | 위치 | 최소 수정 |
|---|---|---|---|
| F1 (P2) | 동의 — `requestSubmit`이 없을 때 Enter가 아무 일도 하지 않는 동작은 **실행 확인**, iOS 13~15가 해당한다는 점은 코드 추정. 변경 전 `<input>`은 동작했으므로 회귀 | `ResultChatModal.tsx` Enter 핸들러의 `event.currentTarget.form?.requestSubmit()` | `void sendQuestion(question);`을 직접 호출한다. 빈 값·진행 중 가드는 기존 `sendQuestion`이 처리한다 |
| F2 (P2) | 동의 — Safari 순서에서 ref가 무효이고 고착 위험이 있음을 **실행 확인.** 실기기 효과는 미검증 | 같은 파일의 `onCompositionEnd` | `compositionend`의 ref 해제를 `setTimeout(…, 0)`으로 미루고, 보류 중인 타이머는 blur·재조합 때 정리한다. `onBlur`에서 ref를 `false`로 푼다. 세 순서(조합 중 keyCode 229·확정 직후 keyCode 229·확정 직후 keyCode 13)와 blur 해제를 재현 테스트로 고정한다 |
| F3 (P2) | 동의 — 허대표님 지시문은 "질문칸만 수정"이고 작성칸까지 줄인 것은 작성자 해석이다. PR 본문에 그 사실이 없다. 독서장은 AI 반영 텍스트가 맨 끝에 붙어 3줄 창 밖에 숨는다(독립 검토자, 코드 추정) | `FormatModal.tsx` 4010·4380·5458·5558·5836·5877행, `DiaryLearnPage.tsx` 692행 | 초기 높이는 `rows=3`을 유지하고 **장문 작성칸만** 변경 전처럼 `resize:vertical`로 되돌린다. 질문칸은 `resize:none`을 유지한다. PR 본문에 범위 해석과 제외 목록을 적는다 |
| P3 | 참고 | 모바일 소프트 키보드에는 Shift+Enter가 없어 줄바꿈을 넣을 수 없음. 전송 버튼(42px)이 89px 입력칸 옆에서 위쪽 정렬. 3줄이 아닌 채 남은 유사 입력칸(식물탐정 자유 메모, 반려동물 접종 메모, 미리보기 페이지, 어시스턴트 온보딩, 법률 메모, 성장타임라인 사진 설명 등) | 라우터·코드로 실제 질문/초기 작성칸인지 판별한 뒤 해당 칸만 3줄로 맞춘다. 제목의 "모든"은 제외 목록으로 보완한다 |

## 5. 남은 E2E·한계

- 실기기 iOS 16 이상 Safari의 한글 확정 Enter(F2의 핵심), iOS 13~15의 Enter(F1), Android Chrome(Gboard·삼성 키보드)의 조합 중 Enter는 미확인이다.
- 로그인 후 전체 화면 E2E(기록 작성 모달 안의 배치, 독서장 AI 반영 흐름), 프리뷰 화면은 미확인이다.
- 하루LAW 저장 시험 harness의 8건 실패는 변경 전 main에서도 같은 기존 문제다.
- CC의 시험은 합성 이벤트와 Chromium 입력 메서드 기반이다. 실제 모바일 IME 순서를 재현했다고 말할 수 없다.
- 이 의견은 병합·운영 배포를 승인하지 않는다. 판정①을 주장하지 않는다.
