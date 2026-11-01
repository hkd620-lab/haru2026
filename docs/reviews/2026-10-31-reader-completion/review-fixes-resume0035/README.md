# PR #320 독립1·Codex3 지적 수정 기록 (2026-11-01 00:35 재개)

기존 `../README.md`, `../resume-1930/`, `../retry-play-fix/`, `../limit-2017/`은 고치지 않고 이 폴더로 보완한다.

- 판정 상태: ⚠️ 부분완료. 지적 3건은 수정했고 모의 회귀 시험으로 확인했다. 새 HEAD의 Codex4·CI, 독립 Claude 2차, preview·운영 E2E, 병합, 배포는 남아 있다.
- 실행자: Claude Code (CC). PR·Slack·병합·배포는 하지 않았다.
- 시작 HEAD: `9b15e0d06567b5350d0d07c7c3f75bdebb6c5926` (이전 검토 HEAD `fb710c87`, 제품 `7bdfbc16`).
- 제품 수정 커밋: `58ac7a0a0023ff2ea28e008febbfd97e903c23c9`. 프론트 파일 2개만 바꿨다.
- 독립 판정 누적: "수정 후 승인" 1/3회를 그대로 잇는다. 이 수정으로 횟수를 리셋하지 않는다.
- 실행 환경: Node v22.23.2, npm 10.9.8.
- 이번 실행의 `raw/reader141-review-fixes-resume0035-result.json`은 넣지 않았다. control의 원본이 실행 중이라 비어 있다. **부모가 종료 후 새 파일로 추가한다.**

## 지적과 반영

| 지적 | 출처 | 원인 | 반영 (`58ac7a0a`) |
| --- | --- | --- | --- |
| F1 P2 고음질 최종 재생 실패 무안내 | 독립1 | 안내가 바깥 `catch`에만 있어 300ms 재시도의 실패와 빈 `audioSrc`가 말없이 끝남 | 재시도 `catch`의 취소 확인 뒤 `native`만 안내. 빈 응답은 `native`만 바깥 `catch`로 보내 기존 안내 경로 재사용 |
| F2 P2 페이지 이탈 뒤 늦은 음성 | 독립1 | `ttsRequestRef`를 무효화하는 unmount cleanup이 없음 | 빈 의존성 `useEffect` cleanup에서 `ttsRequestRef.current += 1`만 실행. 이미 재생 중인 음성 정책은 유지 |
| Codex3 P2 재개 `play()` 취소 누락 | `discussion_r4431468969` | `ttsPaused === key` 분기가 `await` 뒤 취소를 확인하지 않음 | 요청 번호와 오디오를 캡처하고 `await` 뒤 확인. 취소면 캡처한 오디오만 `pause()`하고 표시·안내를 바꾸지 않음 |

Codex3 지시대로 `handleTTS`의 다른 대기 지점도 확인했다.

| 대기 지점 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 무음 `play()` | 뒤에 취소 확인 없음. 취소된 요청도 유료 서버 호출 | `isStale()` 확인 추가 |
| 서버 호출, `AudioContext.resume()` | 요청 번호만 확인 | 공통 `isStale()` 사용 |
| 첫 `play()` | 요청 번호만 확인. 오디오가 교체되면 옛 요청이 표시를 덮음 | 공통 `isStale()` 사용 |
| 재시도 타이머·두 번째 `play()` | `isRetryStale()` | 같은 조건을 `isStale()`로 승격 |
| 바깥 `catch`·`finally` | 요청 번호만 확인 | 공통 `isStale()` 사용 |
| 일시정지 재개 | 확인 없음 | 위 표의 Codex3 반영 |

안내 문구는 기존 문자열을 `showNativeTTSFailureAlert`로 옮겨 재사용했다. 새 문구·설정은 없다. 전체 장 재생 등 다른 handler는 바꾸지 않았다.

## 표준 음성에서 달라진 점

요청 표시·안내는 그대로이고 아래 세 가지만 다르다. 모두 취소 또는 재개 실패 경로다.

1. 재개 `play()` 실패가 처리되지 않은 promise 거부에서 `console.error`로 바뀌었다. 화면 상태는 전과 같이 일시정지로 남고 안내는 없다.
2. 무음 `play()` 대기 중 취소되면 서버를 호출하지 않는다.
3. 첫 `play()` 대기 중 오디오가 교체되면 옛 오디오를 끄고 표시를 덮지 않는다.

재개 분기의 `native` 실패에도 안내를 넣었고 일시정지 상태를 유지해 다시 누를 수 있다. 지시문의 "새 native 안내 경로" 확인 범위로 판단했다.

## 시험

실제 `handleTTS`, `closeGrammarPopup`, `stopAllTTS`, `handleFullChapterTTS`와 실제 unmount cleanup 원문을 추출해 모의 `Audio`·callable로 실행했다. 테스트용 미러 구현은 없다. `frontend/test/bibleGrammarPopup.test.mjs`에 시험 11개를 추가해 24개에서 35개가 됐다.

| 로그 (`logs/`) | 명령 | HEAD와 코드 상태 | 결과 |
| --- | --- | --- | --- |
| `01-red-bible-grammar-before-fix.log` | `npm --prefix frontend run test:bible-grammar` | `9b15e0d0`, 제품 수정 전, 시험만 미커밋 | 종료 1, 25 통과 / 10 실패 |
| `02-bible-grammar-after-fix-attempt1.log` | 위와 같음 | `9b15e0d0`, 제품 수정 미커밋 | 종료 1, 34 통과 / 1 실패. 시험 도우미 결함 |
| `03-bible-grammar-after-fix.log` | 위와 같음 | `9b15e0d0`, 수정 미커밋 | 종료 0, 35/35 |
| `04-question-enter.log` | `npm --prefix frontend run test:question-enter` | 위와 같음 | 종료 0, 21/21 |
| `05-question-inputs.log` | `npm --prefix frontend run test:question-inputs` | 위와 같음 | 종료 0 |
| `06-frontend-build.log` | 더미 6값 `env ... npm --prefix frontend run build` | 위와 같음 | 종료 0, 49.09초 build, PWA 791항목 |
| `07-tsc-bible-page-baseline-compare.log` | `functions/node_modules/.bin/tsc -p <임시 tsconfig> --pretty false` | 위와 같음 + 수정 전 임시 사본 | 종료 2, 오류 16개. 아래 비교 참조 |
| `07b-tsc-compare-summary.log` | `python3 -I raw/reader141-resume0035-tsc-compare.py <07 로그>` | `58ac7a0a` | 수정본에만 있는 오류 없음 |
| `08-mutation-checks.log` | 수정을 하나씩 되돌리고 `test:bible-grammar` | `58ac7a0a` 기준 임시 변형 | 12개 변형 모두 종료 1, 복원 해시 일치 |
| `09-bible-grammar-committed-head.log` | `npm --prefix frontend run test:bible-grammar` | `58ac7a0a` 커밋 그대로 | 종료 0, 35/35 |
| `10-diffcheck-product.log` | `git diff --check 9b15e0d0 58ac7a0a` | 제품 diff만 | 종료 0, 출력 없음 |
| `11-diffcheck-evidence.log` | `git diff --cached --check` | 이 기록 파일만 | 종료 2. 시험·build 원문 로그 01·02·06의 공백 지적뿐이며 원문이라 고치지 않음 |

03~07은 커밋 직전 작업본에서 실행했고, 그 뒤 두 파일을 바꾸지 않고 `58ac7a0a`로 커밋했다. `06-frontend-build.log`의 값은 모두 `haru-completion-dummy`다.

### 수정 전 재현의 한계와 보완

`01` 로그에서 시험 25·27·28번은 cleanup이 없다는 존재 검사에서 멈췄고, 29번도 첫 조합의 실패만 담는다. 실제 동작이 재현됐다고 쓰기에 부족해 `08` 변형 시험을 추가했다. cleanup을 뺀 변형은 존재 검사도 임시로 빼서 재시도 실패 안내와 페이지 이탈 뒤 소리 잔존을 직접 확인했다. 시험 28번은 cleanup이 재생 중인 음성을 끄지 않는다는 고정 시험이라, 수정 전에 동작이 달랐던 것이 아니다.

`02`의 실패는 제품이 아니라 시험 도우미 결함이다. `quality = 'native'` 기본값 때문에 표준 조합에 넘긴 `undefined`가 `native`가 됐다. 키로 기본값을 정하도록 고쳤고 실패 로그는 보존했다.

### 타입검사

`frontend`에는 `typescript`가 없어 `functions`의 TypeScript 5.9.3으로 `BiblePage.tsx`와 수정 전 임시 사본을 함께 검사했다. 임시 사본은 검사 뒤 삭제했다. 앱 전체 tsc는 실행하지 않았다.

- `BiblePage` 오류는 수정 전후 내용이 같은 2건이고, 수정본 2791·2814번 줄이다. 이번 변경 줄이 아니다.
- 나머지 12건은 함께 불러온 다른 파일의 기존 오류이며 고치지 않았다.

### 다시 실행하지 않은 것

- Functions build·시험, export 114 대조: `functions/` 변경 없음. 근거는 `../resume-1930/raw/reader141-parent-exports-check.json`을 유지한다. 실행자는 Codex 부모다.
- `test:reading-continue`, frontend `test:reading-ai`: 이번 변경과 무관하다.
- 시험은 모의 `Audio`를 쓴다. 실제 브라우저의 자동재생 거부와 `AbortError`는 확인하지 않았고, 대기 중 promise를 reject해 대신했다.

## CI annotation

`raw/reader141-ci-fb710-details.json`에서 `fb710c87`의 `build_and_preview`는 성공이고 annotation 2개는 다음뿐이다.

- warning: `actions/checkout@v4`, `actions/setup-node@v4`의 Node.js 20 지원 종료 알림.
- notice: `ubuntu-latest`의 Ubuntu 26 이행 알림.

제품 결함이 아니다. `58ac7a0a` 이후 HEAD의 CI는 아직 없다.

## 권한 거부 기록 (이번 실행)

모두 자동 거부됐고 같은 명령을 다시 실행하지 않았다.

| 거부 사유 원문 | 명령 | 필요했던 이유 | 처리 |
| --- | --- | --- | --- |
| `This command changes directory before running a version-control command, which can pick up untrusted hooks or repository configuration from the target directory.` | `cd <작업본> && python3 ...; ls ...; git log ...; cat AGENTS.md` | Codex3 원문 요약, 기록 위치, AGENTS 확인 | 원인은 직전 명령의 `cd`로 셸 위치가 control 폴더로 옮겨진 것이다. 비 git 조회는 절대 경로로 분리했고, 단독 `cd`로 지시받은 작업본에 돌아온 뒤 git을 실행했다. `git -C`나 샌드박스 해제는 쓰지 않았다 |
| `This Bash command contains multiple operations. The following parts require approval: sed -E ..., awk '{print}', grep '^@@'; grep -n 'pages/BiblePage.tsx' $L` | tsc 로그를 sed·awk로 집계한 복합 명령 | 수정 전후 타입 오류 대조 | `raw/reader141-resume0035-tsc-compare.py`와 검색 도구로 대체 |
| `This Bash command contains multiple operations. The following parts require approval: grep -v "^$D/" ; git diff --cached --name-only, grep -cE '\.(zip\|png\|env)$'` | 기록 파일 스테이지와 cached 파일명 필터를 묶은 복합 명령 | 기록 폴더 밖 파일과 금지 형식 포함 여부 확인 | 명령 전체가 실행되지 않았다. 필터를 빼고 파일을 개별 스테이지한 뒤 `git diff --cached --name-status` 전체 출력을 직접 확인 |

## 남은 문제

1. **요청 번호를 올리지 않는 재생과의 겹침(기존, 일부 미수정):** 전체 장 재생이 오디오를 교체하기 전에는 취소로 판단되지 않는다. 대기 중인 재개가 `pause()`의 `AbortError`로 끝나면 고음질 안내가 뜰 수 있다. 고음질 버튼은 문법 팝업(`position: fixed` 전체 덮개) 안에 있어 코드상 그 재생 버튼에 닿기 어렵지만 실제 브라우저에서 확인하지 않았다.
2. **다른 handler의 재개 분기(기존, 미수정):** 한국어·연속·전체 장 등의 `await play()`는 범위 밖이라 그대로다.
3. **비차단 N1~N3(기존, 미수정):** 독립1 원문의 표 그대로다. N2로 새 요청 시작 때 `ttsPlaying`을 비우지 않는 점도 유지했다.
4. **이어지는 미완료:** Codex4, 새 HEAD CI, 독립 2차, preview·운영 E2E, 병합, `generateTTS` 배포. 병합·배포 승인은 별도 확인이 필요하다.

## 파일

- `codex-index-3.md`: Codex 3차 요청·결과 색인. `../retry-play-fix/codex-index-2.md`를 보완한다.
- `logs/`: 이번 실행 원문 로그. 머리에 실행자, node, HEAD, 코드 상태, 명령이 있고 끝에 종료 코드가 있다.
- `raw/`: 이번 질문, 한도 중단 원문, 독립1 원문, 재시도 수정 실행 원문, Codex3·CI 원문, 이번에 쓴 작은 제어 스크립트.
- `source-hashes.json`: control 원본과의 SHA-256 대조와 비밀값 패턴 검사 결과. 불일치 0, 일치 패턴 0.
