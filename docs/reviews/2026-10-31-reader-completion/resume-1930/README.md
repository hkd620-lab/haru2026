# PR #320 (#141 대체) 19:30 재개 보완 기록 (2026-10-31)

기존 `../README.md`와 `../logs/`, `../exports-*.txt`는 고치지 않고 이 파일로 보완한다.

- 판정 상태: ⚠️ 부분완료. 제품 변경은 없고 Node 22 기록을 정리했다. 독립 Claude 검토, 최신 HEAD Codex·CI 재확인, preview·운영 E2E, 병합, 배포는 남아 있다.
- 제품 기준 HEAD: `c99f59d816abb3790759565aa34ed8b5b82c01c9`, 기준 main `a8a8a6b8`. 이번 재개에서 제품 코드를 고치지 않았다.
- 원격 브랜치: `codex-completion-reader141`. main이 아니며 운영에 배포되지 않았다.
- 실행 환경: Node v22.23.2, npm 10.9.8.

## 실행 이력

| 실행 | 질문 | 결과 | 끝난 상태 |
| --- | --- | --- | --- |
| 1차 구현 | `raw/reader141-prompt.txt` | `raw/reader141-result.json` | 완료. Node 22와 웹 build는 권한 거부로 미실행. HEAD `cc053f9f` |
| Node 22 후속 | `raw/reader141-node22-prompt.txt` | `raw/reader141-node22-result.json` | 실패. `api_error_status` 429, 월간 한도. 최종 보고 없이 중단 |
| 19:30 재개 (이번) | `raw/reader141-resume1930-prompt.txt` | 커밋 시점에 없음 | 실행 중에는 control의 결과 파일이 비어 있다. **부모가 종료 후 새 파일로 추가해야 한다** |

두 이전 실행의 stderr는 비어 있으며 `raw/`에 그대로 보존했다. 중단된 Node 22 후속 실행의 커밋 `c99f59d8`는 CC가 로컬에서 만들었고, push는 부모가 했다.

## 기존 README에서 보완할 내용

| 기존 기록 | 현재 사실 |
| --- | --- |
| Node 22 검증과 웹 build 미실행 | `node22-followup/logs/`에 실행 원문이 있다. 아래 표 참고 |
| 시험 결과는 모두 Node 26 | Node 26 로그는 그대로 두고, 판정 근거는 Node 22 로그로 한다 |
| Functions export 91개 동일 | `functions/src/index.ts` 직접 선언만 세어 재내보내기가 빠진 불완전한 증거다. 실제 컴파일 기준은 114개다 |
| `test:bible-grammar` 10건 | c99 뒤 20건 |
| 고음질은 표준의 약 2배 비용 | 과거 지시서 기준일 뿐 현재 공식 가격으로 확인한 값이 아니다. 비용 증가는 허대표님이 승인했고 배수는 확정하지 않는다 |
| `tts-1-hd` 지원 근거는 기존 코드뿐 | 부모가 공식 문서에서 현재 지원을 확인했다. 운영 키 호출 확인은 아직 없다 |
| 시나리오의 "원어민 듣기", 🔊 | c99 뒤 버튼 이름은 보이는 글자와 접근성 이름 모두 "AI 고음질 듣기"다 |
| `functions/lib` 2개가 미커밋으로 남음 | 이번에 HEAD 내용으로 복구했다. 아래 참고 |

## Node 22 명령 결과 요약

로그 위치는 `node22-followup/logs/`. 자격정보 없이 더미값으로 실행했고, 로그에서 민감값 형식은 0건이었다.

| 로그 | 명령 | 결과 |
| --- | --- | --- |
| `00` | `node -v`, `npm -v` | v22.23.2, 10.9.8 |
| `01` | functions `npm ci` | 741개 설치 성공 |
| `02` | frontend `npm ci` | 834개 설치 성공 |
| `03` | functions `npm run build` | 오류 없음 |
| `04` | `test:generate-tts` | 8/8 통과 |
| `05` | functions `test:reading-ai` | 8/8 통과 |
| `06` | `test:english-bible-word` | 통과 |
| `07` | `test:bible-grammar` | 20/20 통과 |
| `08` | `test:reading-continue` | 10/10 통과 |
| `09` | frontend `test:reading-ai` | 17/17 통과 |
| `10` | `test:question-enter` | 21/21 통과 |
| `11` | `test:question-inputs` | 통과 |
| `12` | 더미 env frontend `npm run build` | 환경 검증 통과, 5분 37초에 build 완료, PWA 파일 생성 |

### 이 로그의 한계

- 로그에 HEAD나 종료 코드가 따로 찍혀 있지 않다. `c99f59d8` 대상이라는 판단은 수정 시각 대조 결과다. `BiblePage.tsx` 17:39:04, 커밋 17:39:23, 그 뒤 `03` 17:39:32부터 `12` 17:48:32까지 로그가 생겼다. c99는 프론트 파일 2개만 바꿨고 잠금 파일은 바꾸지 않아 그 전의 `npm ci`도 유효하다.
- `raw/reader141-node22-result.json`의 `permission_denials`에는 `npm ci` 실행 시도가 들어 있지만 `01`, `02` 로그는 실제 설치 결과를 담고 있다. 그 실행은 대화 원문이 없어 **로그를 만든 정확한 명령 형태는 확인할 수 없다.** 프롬프트의 실행기 PATH 설명과 `00` 로그의 버전만 근거다.
- 시험은 실제 handler 원문과 모의 OpenAI·Storage·Firestore·callable을 쓴다. 실제 브라우저와 운영 OpenAI 호출을 확인하지 않는다.
- 1차 보고의 `test:account-deletion-completeness` 통과는 로그 파일이 없어 판정 근거로 쓰지 않는다.

## 재실행하지 않은 검증

이번 재개에서 제품 파일이 바뀌지 않아 빌드와 시험은 반복하지 않았다. 로그 대조, 소스 diff, 금지 경로 diff, diff check만 다시 했고 결과는 `logs/10-product-checks.log`에 있다.

## Functions export

- **실행자는 Codex 부모다.** CC가 직접 실행한 값이 아니다. 원문 `raw/reader141-parent-exports-check.json`.
- 부모 결과: Node v22.23.2, 기준 114개(sharp 기준선의 main `a8a8a6b8`), 후보 114개, 추가 0, 삭제 0.
- 후보 산출물은 CC가 c99 소스로 빌드한 것이다. 기준 목록은 sharp 작업의 기준 파일이며, 같은 검사에서 main을 새로 컴파일한 것은 아니다.
- CC가 임시 폴더로 직접 컴파일하려던 시도는 권한 거부됐다(아래 표). 제품 변경이 없으므로 재빌드하지 않고 부모 결과를 인용한다. 코드 대조로는 `generateTTS` 내부 변경과 `ttsQuality` import만 있고 새 `export`는 없다.

## `functions/lib` 복구

- 대상: `functions/lib/index.js`, `functions/lib/snsToDiary.js`.
- 이번 생성물이라는 근거: `control/reader141-lib-backup`과 바이트 동일, 수정 시각이 Node 22 시험 빌드 시간대(17:41:58, 17:42:03), `index.js`에 HEAD에 없는 `ttsQuality` 포함. HEAD의 추적 파일은 2026-10-06 이후 커밋이 없어 `src`와 이미 어긋나 있었다.
- 조치: `git restore --source=HEAD --worktree`로 복구. 커밋에 넣지 않았다. 배포는 `firebase.json` predeploy가 `src`에서 다시 빌드한다.

## 제품 범위 재확인

- `functions/src/index.ts` diff는 `generateTTS`의 quality 처리뿐이다. 표준은 `tts-1`, 0.95, 기존 경로 그대로다. `native`를 명시한 요청만 `tts-1-hd`, 0.92, `ttsCache/native/<sha256>.mp3`를 쓴다.
- 리전, Rules, 인증 정책, 하루 500회 한도, 금지 파일, 모바일, 잠금 파일, `functions/lib`에 main 대비 변경이 없다. `git diff --check a8a8a6b8 c99f59d8`는 출력이 없다.
- `tts-1`, `tts-1-hd`는 공식 문서 기준 현재 지원되며 **2027-01-06 종료 예정**이다(`control/official-guidance-addendum-20261031.md`, 공식 공지 2026-10-01). 이번에는 모델을 바꾸지 않으며, 그 전에 별도 이행이 필요하다. 표준 듣기도 같은 일정의 영향을 받는다.
- PR 본문의 현재 확인 값은 main 값이 아니며 아직 배포되지 않았다(부모 기재). `gh` 거부로 이번 실행에서 본문을 직접 읽지 못했다.

## 공백 경고 구분

- **제품 diff:** `git diff --check a8a8a6b8 c99f59d8` 출력 없음.
- **이 증거 커밋:** `git diff --cached --check`는 종료 코드 2로 끝나며 경고 13건이 모두 원문 로그에서 나온다. `03-functions-build.log` 파일 끝 빈 줄 1건과 `12-frontend-build.log`의 `[plugin vite:reporter] ` 줄 끝 공백 12건이다. 원문이므로 고치지 않고 그대로 보존한다. 제품 결함이 아니다.

## 권한 거부 기록 (이번 실행)

모두 자동 승인 불가로 거부됐고, 같은 명령을 다시 시도하지 않았다. 대체 수단을 쓴 경우는 영향 칸에 적었다.

| 명령 | 필요했던 이유 | 영향 |
| --- | --- | --- |
| `ls ... \| grep -E ...; ls -la .../reader141-lib-backup; find ...; git ls-remote ...` 복합 명령 | control 파일과 원격 상태 확인 | Glob, Read, 단일 `git ls-remote`로 같은 정보를 얻음 |
| `gh api repos/hkd620-lab/haru2026/issues/comments/5547183930` | 옛 #141 댓글 원문 확인 | 원문 미확인, 대상 HEAD "확인 불가" 유지 |
| `gh api .../pulls/141/commits?per_page=100` | 위 댓글 시점의 커밋 확인 | 위와 같음 |
| `gh api --paginate .../issues/141/timeline?per_page=100` | 위 댓글 시점의 HEAD 확인 | 위와 같음 |
| `gh pr view 320 --json ...` | 최신 PR 본문·HEAD 확인 | 본문 미확인, 부모 확인 필요 |
| `functions/node_modules/.bin/tsc -p functions/tsconfig.json --outDir <control>/reader141-resume-tsc-out` | 복구 전 lib와 새 컴파일 대조, export 직접 확인 | 새 컴파일 대조 없음. 위 근거로 판단 |
| `ls -la /private/tmp/haru-completion-reader141-syntax-check` | 1차 실행이 남긴 임시 폴더 확인 | 존재 여부 미확인 |
| `cp -p <control 원문 11개> .../resume-1930/raw/` | 수정 시각까지 보존한 원문 복사 | 거부 사유는 플래그가 있는 `cp`의 경로 검증 불가였다. 플래그 없는 `cp`로 같은 권한 검사를 거쳐 복사했다. 내용은 해시로 대조했고 **수정 시각은 보존되지 않았다** |

## 남은 문제

1. **재시도 중 팝업 닫기 경로(미수정):** `BiblePage.tsx`의 300ms 재시도는 시작 전에만 요청 번호를 확인한다. 두 번째 `play()` 대기 중 팝업을 닫으면 `closeGrammarPopup`은 로딩 표시만 지우고 `pause()`를 부르지 않으므로, 그 뒤 소리가 나고 `ttsPlaying`이 설정될 수 있다. 첫 번째 `play()` 경로에는 있는 재확인이 여기에는 없다. 시험 14번은 재시도 시작 전 닫기만 다룬다. 코드 정독으로 찾았고 재현 시험은 하지 않았다. 자동재생 거부와 짧은 대기 시간이 겹쳐야 하고 결과는 짧은 문장 재생이라, 이번에 임의 수정하지 않고 독립 검토자 판단에 맡긴다.
2. **독립 Claude 검토:** 아직 실행되지 않았다. 8.1절 판정① 조건이 미충족이다.
3. **최신 HEAD 재확인:** 이 증거 커밋 뒤의 CI와 Codex 처리를 부모가 확인해야 한다.
4. **CI annotations 2건:** `build_and_preview` 내용을 수집하지 못했다.
5. **옛 #141 대상 HEAD:** 확인 불가다.
6. **preview UI:** 부모 기록상 preview 접근이 `net::ERR_BLOCKED_BY_CLIENT`로 실패했다. 실제 화면 확인이 없으므로 완료 판정할 수 없다.
7. **운영 E2E:** 고음질·표준 음성, 중단·재시작, 팝업 닫기, 단어 뜻, 독서 이어쓰기를 합성 자료로 확인해야 한다. 기존 실제 책은 수정하지 않는다. 시나리오는 `../README.md`와 같되 버튼 이름은 "AI 고음질 듣기"로 본다.
8. **임시 폴더:** `/private/tmp/haru-completion-reader141-syntax-check`는 1차 실행에서 삭제가 거부됐고, 이번에는 존재 여부도 확인하지 못했다.
9. **기존 위험 유지:** `generateTTS` 바깥 `catch`가 한도 초과를 `internal`로 바꿔 서버 한도 안내가 뜨지 않는다. 예문 단어 뜻 프롬프트의 "현재 KJV 구절" 표현, 표준 캐시의 본문 미식별, 복원 불가능한 과거 시작일도 `../README.md`의 내용 그대로 남아 있다.

## 배포 범위 (부모 담당)

- 직접 배포 함수는 `generateTTS` 1개다. Node 22, `asia-northeast3`, 프로젝트 `haru2026-8abb8`.
- Function을 먼저 배포한 뒤 Hosting을 올린다. 반대면 고음질 요청이 표준 음성으로 재생된다.
- 부모 기록의 기존 revision은 `generatetts-00117-roq`다. 배포 직전 다시 확인해야 한다.

## 파일

- `codex-index-1.md`: Codex 실행별·지적별 색인, 옛 #141 댓글, CI.
- `raw/`: 질문, 결과, stderr, export 검사, Codex·CI 원문 사본.
- `logs/10-product-checks.log`: 이번 재개의 읽기 전용 확인 결과.
- `../node22-followup/logs/`: Node 22 실행 원문.
