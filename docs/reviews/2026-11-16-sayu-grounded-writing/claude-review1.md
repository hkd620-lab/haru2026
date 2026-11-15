# PR #402 첫 독립 Claude 검토 결과 원문

- 대상 HEAD: 03600e3bbece4bb8c661e235fcb0a7fd8f5fa30f
- [Claude 대화](https://claude.ai/chat/dfa8578a-734d-4ef7-b10f-8ebc9533c77a)

PR #402의 실제 diff를 읽기 전용으로 가져와 선행 검토 문서와 대조한 뒤 판정을 정리하겠습니다.

Now the full `polishContent` handler at the PR head, to check the surrounding paths (format gating, eventInference, PDF, callAi, response shape).

Build and tests pass independently (50/50, export diff 0). Now I'll run a main↔PR comparison harness and probe the verifier's edge cases.

## PR #402 독립 검토 (HEAD `03600e3` 실측)

**판정: 수정 후 승인** · **규모: 소** · **8.1 멈춤 조건: 해당 없음**(단서 ③)

읽기 전용 클론으로 `refs/pull/402/head`를 받아 HEAD 일치, base `a29e0e5`(main) 위 커밋 1개(`index.ts` +59/−1, 테스트 +56/−3)를 확인했습니다. 코드·운영 미수정, 푸시 없음. 실제 모델 호출은 하지 않았습니다.

### 1. 직접 확인한 것
- Functions 빌드 통과, `polishContent.test.js` **50/50**, export 60개 main↔PR diff 0, `git diff --check` 깨끗.
- main↔PR 하네스 **2,025조합**(15형식×3모드×3강도×5본문×3래퍼): **1,881 동일, 변경 144 = 정확히 일기·에세이·여행기록(+DIARY)×STRONG×화이트리스트 행사명이 아닌 본문**. 전 조합에서 purpose 순서·횟수·모델 동일(BASIC→Luna, 그 외→Gemini). 약·strength 미전송·균형·보수·voiding·**화이트리스트 행사명 경로 바이트 동일**.
- 변경 내용은 JSON 응답 모드 + system 프롬프트 **+1,269자**(1,102→2,371, 2.15배)만. 공개 응답 `{text, stats, aiComment}` 형태 불변, 해석은 기존 행사 경로처럼 `text`에 `\n\n`으로 합쳐짐. PDF 2500자(공백 제외) 상한 동일 방식, 경계 실측 정상.
- 게이트웨이: `responseMimeType: application/json`은 Gemini·OpenAI 모두 지원(OpenAI는 `json_object`로 변환, 전제 조건인 "JSON" 단어가 프롬프트에 있음). 공급사 교체 시 미지원 설정은 창구가 오류로 막는 기존 설계 그대로.
- 실패 처리: JSON 파싱 실패·`body` 비정상 → **원문(래퍼 제외 source) 반환**, 해석 형식·근거 불일치 → 본문만. 래퍼 안내문이 결과에 새지 않음.

### 2. 필수 (수정 후 승인 사유)
1. **#401 화이트리스트 우회**: 참석+일시+장소 메모인데 행사명이 화이트리스트 밖이면(`eventInference` 없음) 근거 경로가 켜지고, 프롬프트에 행사 예시("이름으로 취지 추정 문장은 **본문에** 넣지 않음")와 근거 지시가 공존합니다. 하네스에서 `독서토론회 참석.` 원문에 "독서토론회라는 이름에서 …취지가 읽힌다"가 서버 검사를 통과해 붙었습니다. #401이 3개 행사명으로 닫은 취지 추정이 임의 행사명으로 다시 열립니다. 권고: `if (!eventInference && !hasAttendanceNote)`로 참석 메모를 제외(PR이 밝힌 "일반 기록" 범위와 일치).
2. **실패가 보이지 않음**: 파싱 실패 시 로그 없이 원문을 돌려주고 통계·한마디·월 할당량은 그대로 소비됩니다. 최소 `logger.warn`(사유·길이) 추가. 원문 반환 유지 vs 오류 반환(할당량 롤백·재시도 유도)은 허대표님 결정 사항으로 보고 권고.

### 3. 비차단
1. 근거 일치 검사는 **형식 검사**입니다(원문 그대로 인용·문장 경계·오전/오후 승계·결과어 6개). `evidence`를 원문 전체로 잡으면 경계 검사가 자동 통과하고, 실측에서 동행·원인 날조("피로를 잊게 하는 즐거움"), 습관 일반화("주말마다…습관"), 목록 밖 결과어("좋아졌다")가 모두 붙었습니다. 의미 근거는 프롬프트에만 의존하므로 "합성 비교"가 실질 품질 증거입니다. 결과어 확장(좋아졌|나아졌|극복|도움|덕에), 일반화어(마다|항상|늘|습관) 근거 대조, 해석 문장 길이 상한을 권합니다.
2. 어미: 한다체 본문 + "읽힙니다" 통과. 행사 경로처럼 본문 어미로 기대값을 정해 하나만 허용.
3. 보수적 누락: 해석 끝 공백·`indexOf` 첫 출현만 검사(두 번째 출현이 경계여도 탈락). `sentence.trim()` 권고.
4. 테스트 공백: 참석 메모 비화이트리스트, `body.includes(sentence)` 중복 제거, 근거 경로 PDF 상한, 래퍼 입력 파싱 실패→source 반환.
5. **비용**: 호출 수·모델 무변경이라 선례(#401 +658자 '해당 없음')상 멈춤 조건은 아니지만, 이 경로 프롬프트가 두 PR 누적 +1,927자, 출력도 JSON·해석만큼 늘어납니다. 보고에 수치 명시 권고.

### 4. 확인하지 못한 것
PR 본문·CI·Codex 재검토 결과(GitHub 페이지 접근 제한, API 자격 미부착). BASIC(Luna `reasoning_effort none` + `json_object`)과 Gemini flash-lite JSON 모드의 **실제 응답**은 라이브 호출 없이 판단 불가 — 배포 전 BASIC 일기 강 1건 실측 권고.
