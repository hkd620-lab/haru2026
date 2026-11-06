# PR 347 독립 Claude 검토 — 질문 원문

- 실행 시각: 2026-11-06
- 검토 대상 HEAD: `dc60f38f`
- 검토자 모델: Opus 5.5 (작업 맥락 없는 별도 에이전트)
- 전달한 것: 저장소 경로, PR·Slack 링크, 질문. CC의 검증 결과와 판단은 넘기지 않음

---

당신은 독립 코드 검토자입니다. 파일을 수정하거나 커밋·push·PR 댓글을 하지 마세요. 읽기만 합니다.

대상
- 저장소: /Users/heogyeongdae/Developer/HARU2026 (GitHub hkd620-lab/haru2026)
- PR: https://github.com/hkd620-lab/haru2026/pull/347 (base main, head feature/stock-to-assistant-format-cleanup, 검토 대상 커밋 dc60f38f)
- 배경 논의: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793936135844209 (Slack 스레드. 읽을 수 있으면 읽고, 못 읽으면 건너뛰세요. 특히 "협의 ①" 답변)
- diff 확인: `git diff origin/main...dc60f38f` 또는 `gh pr diff 347 --repo hkd620-lab/haru2026`
- 프로젝트 규칙: 저장소 루트 CLAUDE.md (특히 "CC 코드 수정 원칙", "HARU2026 사용자 기록 저장 원칙")

확인해 주세요
1. diff가 PR 제목·본문이 말하는 범위와 정확히 일치하는지, 범위를 벗어난 변경이 없는지. 저장 경로·필드·Functions·Rules 변경이 없는지.
2. 주식거래일지가 홈 기록 카드에서 비서 카드로 옮겨진 뒤에도 사용자가 실제로 새 주식 기록을 시작할 수 있는지. 비서 카드(`path:'/record'`, `state:{format:'주식거래일지'}`)를 눌렀을 때의 흐름을 `HomePageV2.tsx`의 클릭 처리부터 `RecordPage.tsx`의 `openFormatDirectly`까지 코드로 따라가 확인하세요. 업무 탭 목록에서 빠진 것이 이 흐름을 막는지.
3. `readHomeWritingDraft`의 `ACCEPTED_DRAFT_FORMATS` 분리가 맞는지: 이미 전달된 주식 초안은 받고, 선택 목록(`DRAFT_PICKER_FORMATS`)에는 나오지 않는지. 다른 계정·빈 내용·다른 형식 거부 동작이 그대로인지.
4. 새 비서의 `selectionKey`가 `getAgentKey`(HomePageV2.tsx)의 기본 계산값과 같은지, 기존 비서 키가 바뀌지 않았는지, `getHomeAssistantSelection`(utils/homeAssistantSelection.ts)이 이미 비서를 고른 사용자와 아직 고르지 않은 사용자에게 어떻게 동작하는지. 비서 선택을 저장·복원하는 코드 경로에서 새 비서가 문제를 일으킬 곳이 있는지.
5. 랜딩 `FORMATS`와 홈 `RECORDS`, `DRAFT_PICKER_FORMATS`, `STATS_MERGE_RECORD_FORMATS`가 실제로 같은 11종인지. 랜딩에 새로 넣은 `church`·`bookbind` 아이콘 이름이 그 파일의 아이콘 표에 실제로 있는지.
6. `HomeRecordComposer.tsx`에서 `DRAFT_PICKER_FORMATS.length`를 문구에 쓴 것이 올바른 값(11)을 내는지, 순환 import가 생기지 않는지.
7. PR 본문의 "라우트에 연결되지 않은 화면" 주장(`RecordHubPage.tsx`, 옛 `HomePage.tsx`)이 `App.tsx` 기준으로 맞는지.
8. 바뀐 테스트가 실제로 의미 있는 것을 검사하는지(항상 통과하는 검사가 아닌지). `frontend/test/devConsoleCleanup.test.mjs`, `frontend/test/writeBeforeFormat.test.mjs`를 직접 실행해 보고(frontend 폴더에서 `node --import tsx --test test/<파일>`), 결과를 본 그대로 적으세요. `devConsoleCleanup.test.mjs`의 "홈 카드의 형식이 기록 화면의 작성 모달까지 전달된다" 실패가 이 PR 이전부터 있던 것인지 `origin/main`에서 직접 확인하세요.
9. 그 밖에 이 변경이 일으킬 수 있는 회귀 위험. 특히 SAYU 주식 묶음, 기존 주식 기록 열기, 주식 OCR 진입, 통계·합본에 미치는 영향.

답변 형식
- 판정: 승인 / 수정 후 승인 / 재설계 중 하나
- 근거: 확인한 파일·줄과 명령, 본 그대로의 결과
- 지적 사항: 번호, 심각도(높음·중간·낮음), 위치, 이유
- 확인하지 못한 것은 "확인 못 함"이라고 분명히 적으세요. 추측을 사실처럼 쓰지 마세요.
