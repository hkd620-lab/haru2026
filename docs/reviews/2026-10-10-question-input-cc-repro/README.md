# PR #274 CC 직접 재현 도구·결과 (대상 HEAD 5bb6758f)

CC가 PR #274의 입력칸 3줄 변경을 직접 재현하려고 쓴 스크립트와 결과다. 앱 코드가 아니며 PR #274에 포함되지 않는다. 판단과 해석은 `../2026-10-10-question-input-cc-opinion.md`에 있다.

| 파일 | 역할 |
|---|---|
| `list-textareas.cjs` | `frontend/src` 전체의 `<textarea>`를 AST로 훑어 rows·height·resize를 표로 만든다 |
| `textareas-base.txt` / `textareas-pr.txt` | 위 스크립트를 기준 main `69c371cc`와 PR HEAD `5bb6758f`에서 실행한 결과 |
| `extract.cjs` | 지정한 줄의 `<textarea>` JSX 원문과 자유 식별자를 뽑는다 |
| `gen-entry.cjs` | PR HEAD의 실제 textarea JSX 11개와 `ResultChatModal`의 질문 `<form>`을 원문 그대로 삽입한 시험 페이지(`entry.tsx`)를 만든다. 앱의 실제 React·Tailwind·전역 CSS를 쓴다 |
| `run-repro.mjs` | Chromium(Playwright)으로 390px·1280px에서 12개 입력칸을 측정하고 질문 폼의 Enter·Shift+Enter·IME 동작을 시험한다. 결과는 `results.json`(276개 검사) |
| `run-ime-edge.mjs` | 조합 중 blur, 값 교체, `requestSubmit` 미지원 브라우저 모사, 합성 Enter 뒤 조합 상태 같은 경계 시나리오 |

## 한계

- 합성 이벤트와 Chromium의 CDP 입력 메서드(`Input.imeSetComposition`)로 만든 시험이다. 실제 iOS Safari·Android 키보드의 IME 순서는 재현하지 못한다.
- 입력칸·질문 폼 단위 시험이다. 로그인된 전체 화면(`ResultChatModal`·`FormatModal` 전체)을 렌더하지 않았다.
- 스크립트 안의 경로 상수(`/tmp/claude-0/...`, `/home/user/haru2026/...`)는 CC 세션의 임시 경로다. 다시 돌리려면 작업 폴더에 맞게 바꾼다. 시험 페이지 번들은 PR HEAD 작업 폴더의 `frontend/`에서 `vite build --config <설정>`으로 만들었다(설정은 `@vitejs/plugin-react`·`@tailwindcss/vite`만 쓰는 최소 구성).
- 최초 실행에서 1건이 실패했으나 시험 코드의 집계 오류(앞서 전송된 질문 2건을 1건으로 가정)였고 수정 후 276/276 통과했다. `results.json`은 수정 후 실행의 결과다.
