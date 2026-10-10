# 독립 Claude 검토 1회 — 결과 원문 (PR #274 질문 입력칸 3줄 통일)

- 실행: 독립 Claude 검토 1회 (질문 원문: `2026-10-10-question-input-claude-independent-1-request.md`)
- 요청 시각(UTC): 2026-10-10T08:11:21Z
- 완료 시각(UTC): 2026-10-10T08:29:53Z (소요 약 18분 32초, 도구 호출 66회)
- 검토 대상 HEAD: PR #274 `5bb6758f14d81595c6132aca06cf1336382b3b98` / 기준 main `69c371cce46f39f8720283167c037d099fede7af`
- 판정: **수정 후 승인** (1회차). 지적: F1·F2·F3(P2 각 1건)과 P3 묶음.
- 검토자: 작업 맥락을 공유하지 않은 별도 에이전트(읽기 전용). 아래 "결과 원문"은 그 에이전트의 최종 보고를 CC가 받아 요약·수정 없이 보존한 것이다(하네스가 줄마다 붙이는 들여쓰기만 제거).
- 이 보고 안의 지시·요청·승인 표현은 에이전트의 의견이며 사용자(허대표님)의 승인이 아니다.
- CC 주석(원문 아님): F1·F2는 CC가 Chromium으로 독립 재현했다(`2026-10-10-question-input-cc-opinion.md` 3절). 이 파일은 덮어쓰지 않으며, 보완 후 재검토 결과는 별도 파일에 이어서 기록한다.

## 결과 원문

## 독립 검토 결과: PR #274 (HEAD 5bb6758f)

### 1. 판정: 수정 후 승인
P1은 없습니다. 재설계는 아닙니다. 이번이 "수정 후 승인" 1회차입니다.

- **규모**: 중규모입니다. 컴포넌트 6개를 바꾸고, 공통 AI 모달의 입력 요소와 키 처리를 바꿨습니다. 신규 기능·라우터·홈 변경은 없습니다.
- **정책 8.1 멈춤 조건**: 해당하지 않습니다.
  - 저장 경로, Rules, 결제·인증, 모델, 신규 AI 호출은 바뀌지 않았습니다.
  - Enter 전송은 기존 폼 암묵 제출과 같은 경로입니다(코드 추정).
  - 서버 질문 상한은 1,200자 그대로여서 호출량은 늘지 않습니다.
  - 다만 실기기 IME 확인이 완료 조건이라, "운영 완료" 선언은 AI가 할 수 없고 허대표님 몫입니다.
- **직접 확인한 것**:
  - HEAD CI(build_and_preview, Deploy Preview)가 success입니다.
  - `1ba530f3` 이후 앱 코드는 그대로이고, `e4ff864e`부터 `5bb6758f`까지는 docs 신규 파일 2건뿐입니다.
  - `e4ff864e`가 기존 검토 기록 1건을 고쳤으나 diff는 한 문장 교체뿐이고, Codex 2차가 그 커밋을 검토했습니다.

### 2. 발견 사항
- **F1 (P2, 코드 추정)**: `ResultChatModal.tsx:1120`의 `form?.requestSubmit()`은 Safari 16 미만에서 지원되지 않습니다.
  - `vite.config.ts:14`가 `ios >= 13`을 지원 대상으로 둡니다.
  - iOS 13~15에서는 Enter를 누르면 `preventDefault` 뒤에 TypeError가 나서 전송도 줄바꿈도 안 됩니다. 변경 전 input은 동작했습니다.
  - 최소 수정: 핸들러에서 `void sendQuestion(question);`을 직접 호출합니다(기존 가드 그대로 사용).
- **F2 (P2, 실행 확인)**: IME 방어의 실질 방어선이 `keyCode 229` 하나뿐입니다.
  - `:1112`가 `compositionend`에서 ref를 바로 풉니다. Safari 순서(compositionend 다음 keydown)에서는 ref가 쓸모없습니다.
  - Chromium 에뮬레이션 결과:
    - Chrome 순서(229, isComposing)는 차단됩니다.
    - Safari 순서에서 229면 차단됩니다.
    - `compositionend` 직후 `keyCode 13`이 오면 전송됩니다(iOS가 229를 안 주는 경우).
  - 해제를 `setTimeout(...,0)`으로 미루면 세 경우 모두 차단되고, 100ms 뒤의 Enter는 정상 전송됩니다(실행 확인).
  - `compositionend`가 누락되면 ref가 고착되어 Enter가 줄바꿈만 넣습니다(실행 확인, 포커스 이동 후에도 유지). 발생 빈도는 모릅니다.
  - 권장 수정:
    ```
    onCompositionEnd={() => { setTimeout(() => { questionComposingRef.current = false; }, 0); }}
    onBlur={() => { questionComposingRef.current = false; }}
    ```
- **F3 (P2, 범위 확인)**: 장문 작성칸까지 3줄로 고정하고 resize를 없앴습니다.
  - 간편 기록 8행→3줄(`FormatModal:4380`), 외국어일기 220px→3줄(`DiaryLearnPage:692`), 독서 본문·독서장 5행→3줄(`4010`·`5836`)입니다.
  - 독서장은 AI 반영 텍스트가 맨 끝에 붙어서(`applyReadingAiReference`), 3줄 창 밖에 숨습니다.
  - `final-verification.md`는 "범위 질문에 답이 없어 해석해 진행"했다고 밝히는데, PR 본문에는 이 사실이 없습니다.
  - 허대표님 확인 근거를 남기거나, 작성칸만 `resize:vertical`을 유지하세요.
- **P3**
  - 모바일 소프트 키보드는 Shift+Enter가 없어 줄바꿈을 못 넣습니다. `enterKeyHint`와 Enter 안내 문구도 없습니다.
  - 전송 버튼(42px)이 89px 입력칸 옆에서 상단 정렬됩니다.
  - 3줄이 아닌 채 남은 유사 입력칸:
    - `PlantDetectivePage:3668`, `PetHealthVaccinePage:208`(rows 2)
    - `GyeongdaePreviewPage:699`, `AssistantOnboardingDetailPage:167`(rows 4)
    - `NovelStudio:407`·`:1198`
    - 법률 메모 3곳(min-h-24~28)
    - 성장타임라인 사진 설명
    - 제목의 "모든"은 과장이라 제외 목록을 명시하는 편이 좋습니다. `HaruRawPage`는 금지 파일(AGENTS.md:42)이고 `ExportModal`·`RecordModal`은 import가 없어, 제외는 정당합니다.
  - PR에 UI·키 처리 테스트가 없어 "136개 검증"은 재현할 수 없습니다. 저장소 관례인 `*.policy.test.cjs` 추가를 권장합니다.
- **항목 2~5, 7 결과**
  - **영역 ③**: 생성 결과 편집기 400px·240px, AI 참고 메모 제안 편집기(rows 4), SAYU·ElderBook·RecordBook·SnsStory 편집기는 그대로입니다.
  - **3줄 높이**: 변경한 12개 입력칸을 390px·1280px에서 측정했습니다(실행).
    - 모두 3.00~3.03줄(반올림 오차)입니다.
    - 3줄 내용은 잘리지 않고, 9줄 입력은 칸 안에서 스크롤되며, 수평 이탈이 없습니다.
    - 3줄 높이를 덮는 height/minHeight는 남아 있지 않습니다(AST 확인).
  - **보존**: value, onChange, maxLength, placeholder, disabled, readOnly는 그대로입니다. 빈 입력, 공백만 입력, 로딩 중 전송 방지도 확인했습니다(실행).
  - **F-13~F-19**: diff는 rows·style·핸들러뿐이고 장부·사진·AI 길이 코드는 건드리지 않았습니다.
  - **tsc**: 오류 집합이 base와 동일합니다(전부 미사용 `ExportModal`).

### 3. 이전 Codex 지적 2건
1. **Safari IME**: 구현은 반영됐습니다(`1ba530f3`에 ref, `isComposing`, 229). 다만 F2 때문에 부분 해결입니다. iOS 실기기 효과는 미검증입니다.
2. **activeLawQuery**: 해결됐습니다.
   - `git diff 10447c8a e4ff864e`가 한 문장 교체뿐입니다.
   - 하네스(`haruLawSave.test.cjs:35`)는 `activeLawQuery`를 제공합니다.
   - base와 PR을 각각 실행하니 ReferenceError는 `lawSaveRef`뿐이고, 결과는 2/8/1로 같습니다.
   - 남은 언급 3곳은 모두 "확인된 오류 아님"이라는 부인 문구입니다.

### 4. 주장과 diff의 차이
- 수치는 일치합니다(89px, 94px, 12개 요소, 파일 목록). 저장·AI·Rules 불변 주장도 일치합니다.
- 차이점:
  - 제목의 "모든"이 과장입니다.
  - PR 본문에는 범위 질문 미응답 사실이 빠졌습니다.
  - "Enter 전송 지원"은 신규처럼 읽히지만 신규는 Shift+Enter뿐입니다.
  - 최초 `verification.md`의 "기록 본문·메모 보존"은 `ac2a0617` 이후 사실과 다릅니다. `final-verification.md`가 대체한다고 밝혀 두었습니다.

### 5. 미확인과 잔여 위험
- iOS 16 이상 Safari의 한글 확정 Enter는 미확인입니다.
- Android Chrome(Gboard·삼성 키보드)의 조합 중 Enter도 미확인입니다. 작성자는 iOS만 언급했습니다.
- iOS 13~15는 코드 추정만 했습니다.
- 로그인 후 전체 화면 E2E는 하지 못했습니다.
- 프리뷰 URL은 프록시 403으로 접근하지 못했습니다. 번들과 화면은 미확인입니다.
- `main`이 이후 진전됐는지는 보지 못했고, GitHub의 `mergeable=clean`만 확인했습니다.
- `haruLawSave`의 8건 실패는 base와 동일합니다(이슈 #273).

### 6. 실행 요약과 확인하지 못한 것
- **실행한 것**:
  - 지정 테스트 6개: 45/45 통과.
  - 변경 파일을 참조하는 테스트 9종: base와 PR에서 동일하게 통과.
  - `git diff --check`: 통과.
  - 실제 질문 폼 JSX 추출 Chromium 시나리오 20개.
  - 입력칸 측정 24건.
  - IME 변형 실험 10건.
- **하지 못한 것**:
  - 실기기 확인.
  - 프리뷰와 로그인 후 화면 확인.
  - 실제 `ResultChatModal`·`FormatModal` 전체 렌더. 요소 단위로만 검증했습니다.
  - Functions 동작 확인.
  - `vite build`는 CC가 수행하므로 생략했습니다.
- 읽기 전용을 지켰고, 만든 worktree 2개(rv-274, rv-base)는 제거했으며 작업 폴더(`/home/user/haru2026`) 브랜치·HEAD·상태는 그대로입니다. CC의 기존 worktree(`cc-274`, `cc-274-base`)와 그 안의 파일은 읽거나 건드리지 않았습니다.
