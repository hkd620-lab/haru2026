# 독립 Claude 재검토 — 질문 원문 (PR #274 보완 커밋 1~4)

- 실행: 독립 Claude 재검토 1회(1회차 "수정 후 승인"의 후속). 1회차와 같은 독립 에이전트를 재개했다(작업 맥락은 1회차 보고와 이 요청뿐).
- 요청 시각(UTC): 2026-10-10T08:55:01Z
- 검토 대상 HEAD: PR #274 작업 브랜치 `codex-question-input-three-lines` `9b19efe537180f9d85de935b3b52223a50a54ff8` (이전 검토 대상 `5bb6758f14d81595c6132aca06cf1336382b3b98`의 직계 후손, 기준 main `69c371cce46f39f8720283167c037d099fede7af`)
- 1회차 질문·결과 원문은 덮어쓰지 않는다: `2026-10-10-question-input-claude-independent-1-request.md`, `…-1-result.md`
- 아래 질문 원문은 요약·수정 없이 그대로 보존한다.

## 질문 원문

PR #274 독립 Claude 재검토를 요청합니다(직전 판정 "수정 후 승인" 1회차의 후속). 읽기 전용이며 파일 수정·commit·push·PR 댓글·Slack 게시·병합·배포는 하지 마세요. 포트 18762 사용과 가상사용자 하네스(runner/run.mjs) 실행도 금지입니다.

대상: PR #274 작업 브랜치 codex-question-input-three-lines 의 새 HEAD 9b19efe537180f9d85de935b3b52223a50a54ff8. 이전 검토 대상 5bb6758f 의 직계 후손이며 4개 커밋(1a1440b7, 9f963f50, 924087a1, 9b19efe5)이 추가됐습니다. 기준 main 은 69c371cc 입니다.
가져오기: git fetch origin pull/274/head:refs/review/pr274-v2 (또는 git fetch origin codex-question-input-three-lines). 기존 refs/review/pr274 는 5bb6758f 이므로 옮기지 마세요. 코드를 실행하려면 새 worktree 를 만들어 쓰세요. CC 의 worktree(cc-274, cc-274-base, fix-274)는 읽지도 건드리지도 마세요.

당신의 직전 판정과 지적 F1~F3·P3 원문은 당신이 보고한 그대로입니다. 작성자(CC, 허대표님 지시)의 반영 내역은 다음과 같습니다. 이것은 검증 대상 주장입니다.
- 1a1440b7 (F1): Enter 핸들러가 form.requestSubmit() 대신 기존 sendQuestion(question)을 직접 호출.
- 9f963f50 (F2): EnterSubmitGuard(frontend/src/app/utils/questionEnterSubmit.ts)로 분리. 조합 중(compositionstart~end, isComposing, keyCode 229)은 그대로 두고, compositionend 직후 50ms 안의 Enter 는 두 이벤트의 timeStamp 차이로 확정 Enter 로 보아 전송도 줄바꿈도 하지 않음(preventDefault). blur 에서 조합 표시와 직전 종료 기록을 지움. 당신이 권한 setTimeout(0) 방식 대신 timeStamp 방식을 택함. 시험 frontend/test/questionEnterSubmit.test.mjs 11건.
- 924087a1 (F3): 시작 높이 rows=3 유지. 변경 전 크기 조절이 가능했던 장문 작성칸 7곳(독서 현재 본문, 간편 작성, 보조장부 업무·일반 메모, 독서장, 기록 형식 공통 상세 입력, 외국어일기 작성)만 resize vertical 복원. 질문칸 4곳(공통 AI 질문, 독서 AI 질문, 하루LAW 질문, 전망 직접 질문)은 resize 없음 유지. 일기 상세는 변경 전부터 resize 없음이라 그대로. 소스 정책 시험 frontend/test/questionInputs.policy.test.cjs 추가. PR 본문에 "보완 반영" 절(범위 해석·제외 목록·알려진 제한)을 추가함: https://github.com/hkd620-lab/haru2026/pull/274
- 9b19efe5 (P3): 현재 App.tsx 라우터와 코드로 판별해 식물탐정 "오늘의 관찰" 자유 메모(PlantDetectivePage)만 rows 2→3. 나머지 후보는 제외하고 사유를 PR 본문과 커밋 메시지에 적음.
- 이번 범위에서 미반영한 P3: 모바일 Enter 안내 문구·enterKeyHint, 전송 버튼 정렬, PR 제목의 "모든" 표현.
작성자 주장 검증(확인 대상): 오프라인 전체 시험 48개 파일이 5bb6758f 와 같은 결과(신규 2개 통과), tsc 신규 오류 0, 더미 Firebase 변수 vite build 성공, 실제 JSX 를 Chromium 으로 렌더한 시험 267/267.
수정 diff: git diff 5bb6758f 9b19efe5 -- frontend

요청 사항
1. F1~F3·P3 각 지적의 해결 여부(건별 근거. 실행 확인과 코드 추정을 구분).
2. 새 코드(EnterSubmitGuard, 핸들러 변경)의 오류·회귀 위험. 특히 timeStamp 기반 50ms 보호, 사람이 Enter 를 빠르게 두 번 누르는 경우, blur 해제, compositionstart 뒤 compositionend 누락, 가능한 iOS·Android 이벤트 순서.
3. F3 범위 구분(resize 복원 7곳 대 질문칸 4곳)과 제외 목록이 맞는지, 식물탐정 한 칸 변경이 과한지.
4. 두 시험이 요구를 실제로 고정하는지(가능하면 변이 시험).
5. 판정(승인 / 수정 후 승인 2회차 / 재설계), 규모, 정책 8.1 멈춤 조건 해당 여부. 새 지적은 파일·위치·재현 조건·최소 수정으로.
회신 형식은 이전과 같고 본문은 약 2,000자 이내로 해 주세요.
