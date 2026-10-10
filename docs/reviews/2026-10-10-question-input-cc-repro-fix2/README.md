# PR #274 보완 사이클 2 CC 재현 도구·결과 (대상 HEAD 9fa88ead)

CC가 PR #274의 보완 2차 커밋(`cf2f340b`, `9fa88ead`)을 검증하려고 쓴 스크립트와 결과다. 앱 코드가 아니며 PR #274에 포함되지 않는다. 해석은 `../2026-10-10-question-input-cc-fix-cycle-2.md`에 있다. 앞선 도구는 `../2026-10-10-question-input-cc-repro/`(보완 전)와 `../2026-10-10-question-input-cc-repro-fix/`(보완 1차)에 있다.

| 파일 | 역할 |
|---|---|
| `gen-entry3.cjs` | 보완 1차의 생성기와 같되, 컴포넌트 원문이 쓰는 `handleQuestionEnterKeyDown`을 함께 가져오도록 import만 바꿨다 |
| `run-repro3.mjs` | 보완 1차의 Chromium 시험(13개 입력칸 높이·resize·스크롤, 질문 폼 Enter·Shift+Enter·`requestSubmit` 없는 브라우저·IME 순서·blur 해제)에 독립 검토 N1 재현을 더했다. CDP로 keydown의 플랫폼 시각을 compositionend보다 2.6ms·10ms·100ms 앞서게 보내 각각 전송 없음·전송 없음·전송을 확인한다. 결과 `results-cycle2.json`(273개 검사, 모두 통과) |
| `results-cycle2-oldcode-9b19efe5.json` | 같은 시험을 직전 코드(9b19efe5)에서 돌린 결과. N1 재현 2건(2.6ms·10ms 앞선 keydown이 전송됨)만 실패하고 나머지 271건은 통과 — 수정 전 결함을 시험이 잡는다는 증거 |
| `run-mutants.sh` / `mutants-cycle2.txt` | 가드·배선 함수 16개, 컴포넌트 배선 8개, 입력칸 속성 5개, 총 29개 변이를 하나씩 적용해 단위 시험과 정책 시험이 잡는지 확인하고 원본을 복원하는 스크립트와 그 실행 결과(29개 모두 KILLED) |
| `alltests-9fa88ead.txt` | `../…-cc-repro-fix/run-all-tests.sh`를 보완 2차 HEAD에서 돌린 파일별 결과. 보완 1차(`alltests-9b19efe5.txt`)와 파일별 결과 집합이 같다 |

## 한계

- 합성 이벤트와 Chromium CDP 입력 메서드 기반이다. 실제 iOS Safari·Android 키보드의 IME 순서와 이벤트 시각은 재현하지 못한다. WebKit에서 keydown 시각이 compositionend보다 앞선다는 점은 독립 검토자의 코드 추정이며 실기기 미확인이다.
- 입력칸·질문 폼 단위 시험이며 로그인된 전체 화면을 렌더하지 않았다.
- 경로 상수(`/tmp/claude-0/...`, `/home/user/haru2026/...`)는 CC 세션의 임시 경로다. 다시 돌리려면 작업 폴더에 맞게 바꾼다.
