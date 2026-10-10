# PR #274 보완 사이클 CC 재현 도구·결과 (대상 HEAD 9b19efe5)

CC가 PR #274의 보완 4커밋(`1a1440b7`, `9f963f50`, `924087a1`, `9b19efe5`)을 검증하려고 쓴 스크립트와 결과다. 앱 코드가 아니며 PR #274에 포함되지 않는다. 해석은 `../2026-10-10-question-input-cc-fix-cycle-1.md`에 있다. 보완 전(5bb6758f) 재현 도구는 `../2026-10-10-question-input-cc-repro/`에 있다.

| 파일 | 역할 |
|---|---|
| `restore-resize.cjs` | 장문 작성칸 7곳의 `resize: 'none'`을 TypeScript AST로 요소 범위를 한정해 `'vertical'`로 되돌린 변경 스크립트(한 요소에 한 곳씩만 바뀜을 스스로 검사) |
| `gen-entry2.cjs` | PR 작업 폴더의 실제 textarea JSX 12개와 `ResultChatModal`의 질문 `<form>`을 내용 조건으로 찾아 원문 그대로 삽입한 시험 페이지를 만든다(보완 전 생성기는 줄 번호로 찾았다) |
| `run-repro2.mjs` | Chromium(Playwright)으로 390px·1280px에서 13개 입력칸의 초기 3줄 높이, 입력칸별 `resize` 기대값(질문칸 none / 장문 작성칸 vertical), 3줄 입력 무클리핑, 15줄·긴 문단 내부 스크롤, 높이 고정, 가로 넘침, 값 보존을 확인하고, 질문 폼에서 Enter·Shift+Enter·빈 입력 가드·전송 버튼·`requestSubmit` 없는 브라우저·Chrome/Safari 이벤트 순서·compositionend 직후 Enter·blur 해제·CDP 실제 조합을 시험한다. 결과 `results-final.json`(267개 검사, 모두 통과) |
| `run-all-tests.sh` | 에뮬레이터가 필요 없는 `frontend/test/*.test.{mjs,cjs}` 전체를 파일별로 실행해 결과를 기록한다 |
| `alltests-5bb6758f.txt` / `alltests-9b19efe5.txt` | 위 스크립트를 보완 전 HEAD와 보완 후 HEAD에서 실행한 파일별 결과. 차이는 신규 시험 2개(`questionEnterSubmit.test.mjs`, `questionInputs.policy.test.cjs`)뿐이다 |

## 한계

- 합성 이벤트와 Chromium CDP 입력 메서드 기반이다. 실제 iOS Safari·Android 키보드의 IME 순서는 재현하지 못한다.
- 입력칸·질문 폼 단위 시험이며 로그인된 전체 화면을 렌더하지 않았다.
- 경로 상수(`/tmp/claude-0/...`, `/home/user/haru2026/...`)는 CC 세션의 임시 경로다. 다시 돌리려면 작업 폴더에 맞게 바꾼다.
- 보완 중간 상태(2번째 커밋 직후)에서 같은 시험을 한 번 돌렸을 때 아직 반영되지 않은 F3·P3 항목 18건만 실패하고 F1·F2 항목은 모두 통과했다. 최종 상태 결과가 `results-final.json`이다.
