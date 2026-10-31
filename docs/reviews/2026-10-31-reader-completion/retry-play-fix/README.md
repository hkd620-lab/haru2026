# PR #320 재시도 play 취소 경합 수정 기록 (2026-10-31)

기존 `../README.md`, `../resume-1930/`, `../node22-followup/`은 고치지 않고 이 폴더로 보완한다.

- 판정 상태: ⚠️ 부분완료. 경합 버그는 수정했고 모의 회귀 시험으로 확인했다. 새 HEAD의 Codex·CI, 독립 Claude 검토, preview·운영 E2E, 병합, 배포는 남아 있다.
- 시작 HEAD: `b6fc89357c7d156a1a5f93945a64ad3c300c7ce5` (제품 기준 `c99f59d8`).
- 제품 수정 커밋: `7bdfbc16c0480354ca2841b156d5b74aebd7c768`. 프론트 파일 2개만 바꿨다.
- 이전 승인을 최종 근거로 쓰지 않는다. `c99f59d8` 기준 Codex "지적 없음"은 이 수정을 검토하지 않았다.
- 실행 환경: Node v22.23.2, npm 10.9.8.

## 원인과 수정

`handleTTS`의 300ms 재시도는 시작 전에만 요청 번호를 확인했다. 두 번째 `play()` 대기 중 팝업을 닫거나 정지해도 `pause()`가 불리지 않았고, 늦은 완료·실패가 `setTtsPlaying`으로 새 요청의 표시를 덮었다.

`frontend/src/app/pages/BiblePage.tsx`의 `handleTTS`만 고쳤다.

- 재시도가 `audioRef.current` 대신 캡처한 `audio`만 재생·정지한다. 새 요청의 오디오를 멈추지 않는다.
- `await audio.play()` 뒤 취소됐으면 해당 `audio`를 `pause()`하고 표시를 바꾸지 않는다.
- 취소된 재시도의 `catch`와 `finally`는 표시와 로딩을 바꾸지 않는다.
- 취소 판단은 요청 번호와 오디오 일치 여부를 함께 본다. 전체 장 재생 등은 요청 번호를 올리지 않고 오디오만 바꾸므로, 캡처만 하면 교체된 옛 오디오가 재시도로 함께 재생되어 단일 재생이 깨진다. 이때 로딩은 새 재생이 이미 덮어쓰거나 지운다(`setTtsLoading` 호출을 코드로 대조, 전체 장 재생만 시험).

표준·고음질 요청 모양, 첫 `play()` 경로, 재시도 성공·최종 실패 동작, 전체 장 재생 구조는 바꾸지 않았다.

## 시험

실제 `handleTTS`, `closeGrammarPopup`, `stopAllTTS`, `handleFullChapterTTS` 원문을 추출해 모의 `Audio`·callable로 실행했다. `frontend/test/bibleGrammarPopup.test.mjs`에 시험 4개를 추가했다.

| 번호 | 시나리오 | 수정 전 | 수정 후 |
| --- | --- | --- | --- |
| 15 | 첫 play 실패 → 재시도 진입 → 두 번째 play 대기 → 팝업 닫기·정지 → resolve | 실패 (`closeGrammarPopup 뒤 소리가 남으면 안 된다`) | 통과 |
| 16 | 위 대기 중 새 요청 재생 → 옛 play 완료·실패 | 실패 (옛 오디오가 안 멈춤) | 통과 |
| 17 | 위 대기 중 새 요청 로딩 → 옛 play 완료·실패 | 실패 (옛 요청이 재생 표시를 덮음) | 통과 |
| 18 | 전체 장 재생이 오디오를 교체 (두 번째 play 대기 중, 300ms 대기 중) | 실패 | 통과 |

각 시험은 첫 실패 지점에서 멈추므로, 수정 전 로그는 시나리오별 첫 실패만 담고 있다. 16~18번의 반복 변형은 수정 전에 모두 실행되지 않았다.

| 로그 (`logs/`) | 명령 | 결과 |
| --- | --- | --- |
| `01-red-bible-grammar-before-fix.log` | `npm --prefix frontend run test:bible-grammar` | 종료 코드 1, 15~18번 실패. `BiblePage.tsx`는 `b6fc8935` 그대로이고 시험만 추가한 상태 |
| `02-frontend-bible-grammar.log` | 위와 같음 | 24/24 통과 (기존 20 + 신규 4) |
| `03-frontend-question-enter.log` | `npm --prefix frontend run test:question-enter` | 21/21 통과 |
| `04-frontend-question-inputs.log` | `npm --prefix frontend run test:question-inputs` | 통과 |
| `05-frontend-build.log` | 더미 6값 `env ... npm --prefix frontend run build` | 환경 검증 통과, 1분 8초에 build 완료, PWA 파일 생성 |

- 02~05는 커밋 직전 작업본에서 실행했고, 그 뒤 이 두 파일을 바꾸지 않고 `7bdfbc16`으로 커밋했다. 로그 자체에는 HEAD와 종료 코드가 없으며 종료 코드는 도구 결과로 확인했다(02~05 모두 0).
- 다시 실행하지 않음: Functions build와 Functions 시험(소스 변경 없음), `test:reading-continue`, frontend `test:reading-ai`(이번 변경과 무관). 이전 결과는 `../node22-followup/logs/`.
- export 114개 일치 근거는 Functions 소스 변경이 없으므로 `../resume-1930/raw/reader141-parent-exports-check.json`을 그대로 유지한다. 실행자는 Codex 부모다.
- `npx tsc`는 실행하지 않았다. Vite build는 타입을 검사하지 않으므로 이번 변경의 타입검사 결과는 없다.
- 시험은 모의 `Audio`를 쓴다. 실제 브라우저의 자동재생 거부와 `AbortError`는 확인하지 않았고, 후자는 대기 중 promise를 reject해 대신했다.

## 권한 거부 기록 (이번 실행)

모두 자동 거부됐고 같은 명령을 다시 실행하지 않았다.

| 거부 사유 원문 | 명령 | 필요했던 이유 | 처리 |
| --- | --- | --- | --- |
| `Contains brace with quote character (expansion obfuscation)` | python heredoc으로 시험을 고치고 grep·수정 전 시험을 묶은 복합 명령 | 시험 추가와 수정 전 실패 기록 | Edit 도구로 시험을 고치고, 시험은 단일 명령으로 분리 실행 |
| `A variable in this command can't be checked before it runs` | `npm --prefix frontend run test:bible-grammar > <log> 2>&1; echo exit=$?` | 종료 코드를 함께 확인 | `$?` 없이 실행. 그래서 로그에 종료 코드가 없고 도구 결과로 확인 |
| `This command requires approval` | `env` 없이 값이 다른 더미 변수 6개를 앞에 둔 `npm --prefix frontend run build` | 웹 build | 지시문의 허용 형식 `env VITE_FIREBASE_API_KEY=haru-completion-dummy ...`로 실행 |

## 보존 원문

- `raw/reader141-retry-fix-prompt.txt`: 이번 질문 원문.
- `raw/reader141-resume1930-result.json`, `raw/reader141-resume1930-stderr.txt`: 직전 실행의 결과와 stderr(빈 파일). `../resume-1930/README.md`에서 부모가 추가하기로 남긴 항목이다.
- 한도로 중단된 Node 22 후속 실행의 result는 `../resume-1930/raw/reader141-node22-result.json`에 이미 있다. 내용이 같은 사본은 만들지 않았다.
- `raw/reader141-retry-fix-result.json`은 실행 중이라 비어 있어 넣지 않았다. **부모가 종료 후 새 파일로 추가한다.**

## 남은 문제

1. **요청 번호를 올리지 않는 재생과의 겹침(기존, 미수정):** 전체 장 재생 등이 첫 음성을 불러오는 동안에는 `audioRef`가 그대로라 재시도가 취소로 판단되지 않고, 옛 오디오가 재생되어 표시가 덮일 수 있다. 같은 `Audio` 객체를 재사용하는 `handleSequentialTTS`류도 일치 비교로 구분되지 않는다. 고치려면 다른 재생 handler를 바꿔야 해 지시의 범위 제한대로 두었다. 수정 전에도 있던 동작이다.
2. **표시 범위(기존, 미수정):** 재시도로 재생이 성공하면 단어 하이라이트는 시작하지 않는다.
3. **짧은 소리 가능성:** 취소가 로딩 상태에서 들어오면 `closeGrammarPopup`은 `pause()`를 부르지 않고, `play()` resolve 뒤 재시도가 멈춘다. 그 사이 소리가 잠깐 날 수 있는지는 실제 브라우저에서 확인하지 않았다. 첫 `play()` 경로도 같다.
4. **이어지는 미완료:** 새 HEAD의 Codex·CI, 독립 Claude 검토, preview·운영 E2E, 병합, `generateTTS` 배포. `../resume-1930/README.md`의 나머지 남은 문제는 그대로다.

## 파일

- `codex-index-2.md`: `../resume-1930/codex-index-1.md`의 정정 색인.
- `logs/`: 이번 실행 원문 로그.
- `raw/`: 질문과 이전 결과 원문.
