# PR #141 잔여 제품 이식 실행 기록 (2026-10-31)

- 기준: `main` `a8a8a6b8`, 작업 브랜치 `codex/completion-reader141`, 원격 `codex-completion-reader141`
- 질문 원문: `prompt.txt`
- 판정 상태: ⚠️ 부분완료. 구현·시험은 끝났지만 **Node 22 검증과 웹 build는 이 세션에서 실행하지 못했다.**

## 과거 변경과 현재 main 대조

| PR #141 항목 | 현재 main | 조치 |
| --- | --- | --- |
| AGENTS/CLAUDE 문서 수정 | 이미 대체됨 | 가져오지 않음 |
| `functions/lib/index.js`의 `ADMIN_UID` 등 | 컴파일 산출물 | 가져오지 않음 |
| `toGrammarText` (Bible, Diary) | 반영됨 | 재작성하지 않음 |
| Diary 문법 팝업 단어 클릭 | 반영됨 | 변경 없음 |
| Bible 문법 팝업 단어 클릭 | 없음 | 이식. 원래 코드는 `verseKey`를 보내지 않아 현재 `getWordMeaning`이 `invalid-argument`로 거부하므로 팝업의 `verseKey`를 전달 |
| 단어 팝업 zIndex 200 | 없음 | 이식 |
| 고음질 듣기 | 없음 | 이식. 표준 호출의 `cacheKey`에 `_standard`를 붙이던 부분은 기존 캐시를 무효화하므로 제외 |
| 책 1권 이어작성 | 없음 | 이식. 책 선택이 막혀도 입력 화면으로 넘어가던 원래 흐름은 공통 `continueReadingBook`으로 교체 |

## 원래 PR과 다르게 구현한 지점

- 표준 음성: 모델 `tts-1`, 속도 0.95, 경로 `ttsCache/${cacheKey}_${voice}.mp3`, 클라이언트 요청 모양이 모두 기존과 같다. 기존 객체 삭제나 경로 이전은 없다.
- 고음질 음성: `ttsCache/native/<sha256(model, speed, voice, text)>.mp3`. `cacheKey`를 경로에 쓰지 않아 80자 절단이나 사용자 지정 키로 표준 캐시와 섞일 수 없다. 표준 경로는 `_${voice}.mp3`로 끝나고 해시에는 밑줄이 없어 겹치지 않는다.
- 클라이언트 `cacheKey`: 고음질은 `_native` 표시가 잘리지 않게 앞부분을 줄인다.
- 시작일: 기존에는 `onSelectExistingBook`이 시작일을 `lastDate`로 초기화해, 원래 PR의 `prev.reading_started_at || lastDate`로는 고칠 수 없었다. 책별로 가장 이른 `reading_started_at`을 모으고, 없으면 가장 오래된 기록일을 쓴다.
- 늦은 응답: 문법·단어·음성에 최신 요청 표식을 두었다. 다른 장으로 이동해도 팝업은 처음 고른 절의 `verseKey`를 유지한다. 전체 듣기 중 자동 장 이동이 팝업을 닫지 않도록 자동 닫기는 넣지 않았다.
- 키보드: 팝업 단어, 원어민 듣기, 이어작성 카드는 `button type="button"`이다.
- `functions/lib`: `functions/.gitignore` 대상인데 일부 파일만 추적 중이고 `src`와 이미 크게 어긋나 있다. 배포는 `firebase.json` predeploy가 `src`에서 다시 빌드하므로 커밋하지 않았다.

## 검증

`logs/`의 파일이 명령 출력 원문이다. **모두 Node v26.8.2 결과이며 Node 22 필수 검증을 대신하지 않는다.**

| 명령 | 결과 | 로그 |
| --- | --- | --- |
| `npm --prefix functions run test:generate-tts` | build 포함 8건 통과 | `logs/functions-generate-tts-node26.log` |
| `npm --prefix functions run test:reading-ai` | 8건 통과 | `logs/functions-reading-ai-node26.log` |
| `npm --prefix functions run test:english-bible-word` | 통과 | `logs/functions-english-bible-word-node26.log` |
| `npm --prefix frontend run test:bible-grammar` | 10건 통과 | `logs/frontend-bible-grammar-node26.log` |
| `npm --prefix frontend run test:reading-continue` | 10건 통과 | `logs/frontend-reading-continue-node26.log` |
| `npm --prefix frontend run test:reading-ai` | 17건 통과 | `logs/frontend-reading-ai-node26.log` |

- Functions export: `exports-before.txt`와 `exports-after.txt`가 91개로 같다. `functions/src/index.ts` 원문 기준 비교다.
- 변경 프론트 파일 4개는 esbuild 구문 변환이 오류 없이 끝났다. 타입 검사나 build를 대신하지 않는다.
- 설치는 `npm ci`로 했고 `package-lock.json`은 바꾸지 않았다. 새 의존성은 없다.
- 시험은 실제 handler 원문을 꺼내 모의 OpenAI·Storage·Firestore·callable로 실행한다. 실제 브라우저 화면과 운영 OpenAI 호출은 확인하지 않았다.

## 권한 거부로 실행하지 못한 명령

자동 승인 불가로 거부되었고 우회하지 않았다.

```text
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm --prefix .../functions ci --no-audit --no-fund
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm --prefix .../frontend ci --no-audit --no-fund
/opt/homebrew/opt/node@22/bin/node --version
env PATH=/opt/homebrew/opt/node@22/bin:/usr/bin:/bin npm --prefix .../functions ci --no-audit --no-fund
env VITE_FIREBASE_API_KEY=dummy ...(더미 6값) npm --prefix .../frontend run build
```

## 부모가 이어서 할 일

1. Node 22로 `functions`와 `frontend` 재설치, 위 시험 6종 재실행, 실제 버전 원문 저장.
2. 더미 6값으로 `frontend` build 실행.
3. Functions 배포 대상은 `generateTTS` 하나이며 웹보다 먼저 또는 함께 배포한다.

## preview·운영 확인 시나리오

1. 성경 절의 문법 팝업에서 절·예문·내 문장의 단어를 눌러 단어 뜻이 문법 팝업 위에 뜨는지, 닫으면 문법 팝업이 남는지 확인한다.
2. Tab과 Enter로 단어 버튼과 🔊 버튼을 조작한다.
3. 🔊를 눌러 음성이 나는지, 같은 문장을 다시 누르면 일시정지되는지 확인한다.
4. 고음질 호출 후 Storage의 `ttsCache/native/`에 객체가 생기고 재호출이 `cached: true`인지, 일반 절 듣기는 기존 캐시를 쓰는지 확인한다. 이 시험이 `tts-1-hd` 운영 지원의 실제 확인이다.
5. 문법 분석 중 팝업을 닫거나 다른 절을 열어 이전 결과가 나타나지 않는지 확인한다.
6. 작성중인 책 1권과 완료 책이 있는 계정에서 이어작성 카드가 바로 입력 화면을 열고, 시작일이 원래 날짜이며, 저장 후 회차 수와 AI 참고자료가 유지되는지 확인한다.
7. 작성중인 책 2권 계정에서는 목록에 머무는지 확인한다.

## 남은 위험

- `tts-1-hd`와 `speed`는 코드베이스의 `/v1/audio/speech` 호출과 `cc-instructions/20260506_01_TTS_tts1_통일.md`의 과거 기록만 근거로 했다. 운영 키로 호출하지 않았으므로 현행 지원은 시나리오 4로 확인해야 한다.
- 고음질은 표준의 약 2배 비용(위 과거 기록 기준)이다. 사용 한도는 표준과 같은 하루 500회이고 캐시 적중은 차감하지 않는다.
- 기존 동작 그대로 `generateTTS`의 바깥 `catch`가 한도 초과 오류도 `internal`로 바꾼다. 그래서 서버 한도 초과 시 클라이언트의 한도 안내 문구가 뜨지 않는다. 범위 밖이라 고치지 않았다.
- 표준 캐시는 기존과 같이 본문을 식별에 넣지 않는다. 전체 경로 이전 금지 조건 때문에 유지했다.
- 예문·내 문장의 단어 뜻은 해당 문장을 `verseText`로 보내므로 프롬프트에는 "현재 KJV 구절"로 표시된다. 뜻 분석은 그 문장 기준으로 동작하지만 표현은 다르다.
- 예전에 마지막 기록일로 덮여 저장된 시작일은 가장 이른 값을 쓰는 방식으로 복원하며, 첫 기록까지 덮인 경우는 되돌릴 수 없다.
