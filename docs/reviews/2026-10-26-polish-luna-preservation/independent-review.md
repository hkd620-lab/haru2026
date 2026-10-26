# 독립 Claude 검토 원문 — PR #301 delta(기본 다듬기 Luna·일반 버튼 BASIC·원문 보존 지시문)

- 검토 대상: `ecb46df5..516abd0a`. 소스 HEAD `516abd0a2ec4db4c7d90531bdc19e7e21801577d`(브랜치 `codex-title-luna-extract`).
- 검토자: 작업 맥락을 공유하지 않는 독립 Claude 세션(`claude-opus-5-5`, session_id `20a82ba2-550e-47b3-a050-511b2066e82a`), 읽기 전용.
- CLI 결과: `subtype: success`, `is_error: false`, `num_turns: 48`, `duration_ms: 235646`.
- 원본 파일
  - 질문: [haru-polish-independent-review-prompt.txt](haru-polish-independent-review-prompt.txt) (sha256 `4240d65f…8698`)
  - 결과: [haru-polish-independent-review-result.json](haru-polish-independent-review-result.json) (sha256 `83317568…6614`). 사용량·권한 거부 기록(`permission_denials` 12건) 등 모든 필드가 들어 있다.
  - 두 파일은 부모 Codex가 `/private/tmp`에서 작업폴더로 복사한 것을 그대로 옮겼고, 복사본과 원본 해시가 같다.
- 시각: 결과 JSON에는 완료 시각 필드가 없다. 검토는 소스 커밋 `516abd0a`의 push(2026-10-25T23:57Z 전후) 이후, 이 기록 작성 이전에 이뤄졌다.
- 아래 두 절은 원본 텍스트를 스크립트로 그대로 넣은 것이다. 내용은 고치지 않았다. 원문에 대한 보완 설명은 [README](README.md)의 "독립 검토" 절에 따로 적었다.

## 질문 원문

```text
HARU2026 설계·완료 독립 검토입니다. 파일 수정·커밋·배포·Slack·추가에이전트·비밀값 읽기 금지. 읽기전용 검토 후 승인/수정 후 승인/재설계 중 하나를 명확히 판정하고 작업규모(소/중/대), 멈춤조건, 위험/누락을 보고하세요. CC구현자 세션과 독립된 새 세션입니다.
저장소 /Users/heogyeongdae/.codex/worktrees/title-luna/HARU2026, PR https://github.com/hkd620-lab/haru2026/pull/301. git rev-parse HEAD로 검토SHA확인. AGENTS.md 및 docs/HARU2026_Slack_운영정책.md8.1 준수. 보호파일 routes.tsx/HaruRawPage.tsx/LibraryPage/.zombie 읽지마세요.
같은건 이전검토원문은 docs/reviews/2026-10-26-title-luna-extract/independent-review.md 에질문/결과전문이있습니다. 반드시읽고이번delta와함께검토하세요. 이전검토대상은 제목Luna+키워드Gemini였고 ecb46df5 이후 추가되는이번delta는기본다듬기Luna,일반화면BASIC연결,풍성프롬프트원문보존입니다. 이전Codex결과색인 codex-review-01.md도확인. 기존검토문서수정없음.
사용자직접승인: 기본다듬기Luna교체,풍성형은의미/말투보존지시문수정후재비교. 추가승인: 일반다듬기버튼을LunaBASIC으로연결. 제목Luna유지,키워드Gemini유지. 풍성모델은Gemini유지. mainmerge·운영배포승인없으며실행하지않음.
검토대상 git diff ecb46df5..HEAD 소스/테스트; 특히소스functions/src/ai/aiModels.ts,index.ts,frontend/src/app/components/FormatModal.tsx 와관련테스트. BASIC요청이실제화면에서연결되고PREMIUM과전문독서·배뇨등별도경로는유지되는지,sharedgateway에secret/mode/model/log/request/response/quota/errorrefund보존되는지,임의내용추가금지프롬프트충돌없는지검토. Firestore경로·리전·결제인증변경없는지확인. 기본max8192/none이지원되는지실호출증거로확인.
실험원본근거(모두합성기록): /private/tmp/haru-polish-preservation-v2/inputs.json,results.jsonl,summary.json,findings.json,gateway-live.json,key-access-audit.json. 124건비교는실제구/신frontendwrapper+backendprompt를추출해API실호출했음. gateway-live는compiled공통gateway의별도실호출1회. findings는Codex의비블라인드수동평가로한계명시. 큰표없이판정가능하되표본일반화금지. 기존실운영SA에OpenAIsecretaccessor권한있지만현재운영polishContent엔Gemini키만연결,새source는둘다연결되므로나중명시배포필요. 운영IAM변경없음.
검증내역은 PR본문과 CC출력 /private/tmp/haru-polish-connect-basic-result.json 및 /private/tmp/haru-polish-basic-rich-cc-result.json 확인. 새sourceHEAD에서현재필수검증수행·export114불변여부확인. gitdiffcheck/nodetests읽기용실행은허용. 결과는작업개발완료범위와배포/운영미완료구분. 현재배포없으므로운영무장애보장으로판정하지말것. 발견시재현가능한파일/함수/영향포함,없으면없음명시.
```

## 결과 원문 (`result` 필드)

## 독립 Claude 검토 결과 — PR #301 delta(`ecb46df5..516abd0a`)

**판정: 승인.** 허대표님이 승인한 개발 범위까지만 해당합니다. 그 범위는 기본 다듬기를 Luna로 바꾸고, 일반 다듬기 버튼을 BASIC에 연결하고, 풍성형·기본 지시문에 원문 보존 규칙을 넣는 것입니다. main 병합과 운영 배포는 이 판정에 들어 있지 않습니다.

- **검토 SHA:** `516abd0a2ec4db4c7d90531bdc19e7e21801577d`, 브랜치 `codex-title-luna-extract`. 작업트리에는 미추적 `node_modules` 링크 2개만 있습니다.
- **검토 방식:** 읽기만 했습니다. 파일 수정, 커밋, Slack 게시, 추가 에이전트 생성은 하지 않았습니다. 보호 파일과 비밀값도 열지 않았습니다.
- **이전 검토(제목 Luna·키워드 Gemini) 유지:** `recordTitle` 설정과 키워드·일괄 보정의 Gemini 설정은 이번 delta에서 바뀌지 않았습니다.

### 1. 작업 규모와 멈춤 조건
- **규모: 중규모.** 기능 하나(polishContent)의 모델을 바꾸고 화면 연결을 바꿨습니다. 라우터·새 기능·저장 구조는 바뀌지 않았습니다.
- **멈춤 조건: 해당합니다.** 모델 교체는 답변 품질에 영향을 줍니다.
  - 개발 범위는 허대표님이 직접 승인했습니다.
  - main 병합과 Functions 배포는 허대표님 별도 승인이 필요합니다. 판정①로 대신할 수 없습니다.
- **판정① 조건: 아직 충족하지 않습니다.**
  - CI(`516abd0a`)의 `build_and_preview`와 `Deploy Preview`는 SUCCESS로 직접 확인했습니다.
  - `516abd0a`에 대한 Codex 리뷰 결과는 확인하지 못했습니다. PR 댓글 조회가 허가되지 않았습니다.

### 2. BASIC이 실제 화면에 연결됐고, 다른 경로는 그대로인지
- **일반 버튼은 BASIC으로 갑니다.** 흐름은 `handlePolishClick` → `setPendingPolishMode('BASIC')` → `handleConfirmMonthlyAiPolish` → `polishContent({ mode: 'BASIC', includeAiComment:false })`입니다(`FormatModal.tsx:1360,1369,1429`). 버튼이 연결된 곳은 일기 footer(6488)와 일반 footer(6650) 두 곳입니다.
- **별도 경로는 바뀌지 않았습니다.**
  - 독서 마무리(3285)와 중간기록(3339~)은 `'PREMIUM'`을 보냅니다.
  - 배뇨(`SayuHealthVoidingPage.tsx:241`)와 `SayuModal`(1713)도 `'PREMIUM'`을 보냅니다.
  - `ExportModal`(354, 924)은 mode를 보내지 않아 서버 기본값 `'premium'`이 됩니다.
  - 독서사유·가계부·배뇨 화면의 footer는 각자 전용 버튼만 있습니다(6565/6616/6629/6638). 이 화면들에서는 일반 다듬기 버튼이 나오지 않습니다.
- **서버 분기는 대소문자까지 정확히 `'BASIC'`일 때만 Luna로 갑니다.**
  ```ts
  const polishPurpose = mode === 'BASIC' ? 'sayuPolishBasic' : 'sayuPolish';
  const modelName = getAiRoute(polishPurpose).model;
  ```
  BASIC 분기는 배뇨(voiding) 분기보다 먼저 검사됩니다. 그래도 배뇨는 PREMIUM만 보내므로 영향이 없습니다.
- **`{prefix}_mode` 저장값:** 이제 `'PREMIUM'` 대신 `'BASIC'`이 저장됩니다. 이 필드는 메타 제외 목록에서만 쓰이고, 이 값에 따라 동작이 갈리는 코드는 없습니다(grep 확인).

### 3. 공통 창구(gateway)에서 기존 처리가 유지되는지
| 항목 | 확인 결과 |
|---|---|
| secret | `aiSecretsFor('sayuPolish','sayuPolishBasic','sayuPolishComment','recordStats')`이 GEMINI와 OPENAI 키를 둘 다 연결합니다. 테스트가 이를 확인합니다. |
| 설정 범위 | `reasoning_effort:'none'`과 `max_completion_tokens:8192`는 `sayuPolishBasic`에만 붙습니다. 같은 함수의 나머지 용도에는 OpenAI 설정이 없고, 테스트가 이를 확인합니다. |
| 사용량 log | 성공 시 실제로 쓴 용도의 모델(`gpt-6-luna`)이 남습니다. 실패 시 model은 null, success는 false로 남습니다. |
| quota·환급 | 예약 1회, 본문 호출 실패와 text 읽기 실패 모두 환급 1회, 유료 이용 로그는 남기지 않습니다. 테스트가 이를 확인합니다. |
| request·response | 반환 형식 `{text, stats, aiComment}`, 5000자 제한, rate limit 10/60은 바뀌지 않았습니다. |
| 리전·인증·Firestore·결제 | `asia-northeast3`와 `request.auth` 검사는 그대로입니다. delta에 Firestore 경로나 결제 코드는 없습니다. |

### 4. 지시문 충돌 여부
- **예전 충돌이 없어졌습니다.** 예전에는 화면 지시문이 "무조건 ~다체"를, 서버 지시문이 "존댓말 유지"를 요구했습니다. 이제 화면과 서버 모두 "원문 말투 유지"입니다.
- **표시 안내는 화면과 서버가 맞습니다.** 화면은 `[원문 시작]`/`[원문 끝]` 표시를 보내고 "본문만 출력"을 요구합니다. 서버의 BASIC·풍성형 규칙은 "표시가 있으면 그 사이만"입니다.
- **표시 없이 보내는 호출부도 문제없습니다.** `SayuModal`과 `ExportModal`은 표시 없이 보냅니다. 서버 규칙이 조건부라서 이 경우에도 충돌하지 않습니다.
- **남는 긴장 하나(기존부터 있던 것):** 독서 중간기록은 화면에서 "~다 체"를 지시하고, 보수형 서버 지시문은 "원문 말투"를 요구합니다. 예전 "존댓말"보다는 약해졌지만 방향이 다릅니다. Gemini PREMIUM 경로이고 이번 승인 범위 밖이라 그대로 둡니다.

### 5. 검증 결과(검토자가 직접 실행)
- `functions`: `node --test test/aiGateway.test.js test/polishContent.test.js`가 **36/36 통과**했습니다.
- `frontend`: `node --test test/formatPolishRequest.test.mjs`가 **6/6 통과**했습니다. 이 테스트는 실제 `handlePolishClick`·confirm·`handlePolishWithMode` 코드를 꺼내 실행합니다.
- `git diff --check ecb46df5..HEAD`는 깨끗합니다.
- **export 114개 유지:** delta의 `index.ts`에 새 `export`는 없습니다(diff 전체 확인). 다만 빌드와 export 해시(114, `5bdd7903…`)는 직접 재지 못했습니다.
  - git이 추적하는 `functions/lib/index.js`는 빌드 후 원래대로 되돌려진 상태라 `sayuPolishBasic`이 들어 있지 않습니다.
  - `tsc --noEmit` 실행은 허가되지 않았습니다.
  - 그래서 Functions 빌드 성공은 CC 보고에 근거합니다. 배포 때는 `firebase.json`의 predeploy(`npm run build`)가 다시 빌드하므로, 이 오래된 lib 파일이 배포에 들어가지는 않습니다.
- **8192/none 실호출 근거:** `gateway-live.json`에 빌드된 공통 gateway로 `sayuPolishBasic`을 1회 실제 호출한 기록이 있습니다. `finish:"stop"`, 출력 71토큰, 해요체와 미정 표현이 보존됐습니다.
  - 이 파일의 requestShape는 설정값을 기록한 것이고, 실제 전송 내용을 캡처한 것은 아닙니다. 그래도 같은 설정으로 호출이 성공했으므로 지원된다는 근거로 충분합니다.
  - 긴 입력(5000자에 가까운 경우)으로 8192 상한을 확인한 근거는 없습니다. 124건 비교는 4096 상한으로 진행됐습니다.
- **124건 비교:** 비교 대상은 합성 원문 18개였습니다. 오류 0, 잘림 0이었고, 표본 기준 Luna 비용은 Gemini보다 낮았습니다. `findings.json`은 Codex가 블라인드 없이 직접 평가한 것이라 일반화할 수 없습니다.
  - 같은 문서에 따르면 Gemini 풍성·균형형은 새 지시문에서도 가끔 말투가 바뀌거나 내용이 추가됐습니다. 예: long-mixed에서 "데운 국을 먹음"이 추가됨.
- **권한 감사:** 운영 polishContent에는 현재 `GEMINI_API_KEY`만 연결돼 있습니다. 서비스 계정에는 OpenAI secret 접근 권한이 있습니다. 새 source를 명시적으로 배포해야 두 키가 연결됩니다.

### 6. 발견 사항
1. **[보고 부정확, 코드 수정 불필요]** CC 보고(`haru-polish-connect-basic-result.json`)에 "`독서사유` 기록도 일반 버튼을 거쳐 BASIC이 나간다"고 적혀 있습니다. 실제로는 `FormatModal.tsx:6565` 분기 때문에 독서사유 footer에 일반 다듬기 버튼이 없어서, 이 경로가 생기지 않습니다. PR 본문이나 기록에 같은 문장이 있다면 바로잡는 것이 좋습니다.
2. **[제품 영향, 승인 범위 안]** 일반 버튼이 모든 형식을 BASIC 지시문 하나로 보냅니다. 그래서 풍성·균형·보수형 구분은 이 버튼에서 더 이상 적용되지 않습니다. 이 구분은 이제 `SayuModal`의 재다듬기와 `ExportModal`에서만 쓰입니다. 일기·에세이 사용자가 "다듬기가 약해졌다"고 느낄 수 있습니다. 화면에 보이는 라벨도 `SAYU (BASIC)`와 `(BASIC 모드)` 안내로 바뀝니다. 의도된 변화이지만 배포 승인 때 같이 알려야 합니다.
3. **[낮음, 기존과 같은 수준]** `callOpenAi`는 `finish_reason:'length'`(출력 잘림)를 감지하지 않습니다. 잘린 본문도 성공으로 반환됩니다. 8192는 5000자 한도에 비해 여유가 있다고 보지만, 실제 긴 입력으로 확인하지는 않았습니다.
4. 그 밖에 재현 가능한 결함은 **없습니다.**

### 7. 완료된 것과 안 된 것
- **개발 완료:** 소스, 테스트, feature push, 초안 PR, CI preview까지 끝났습니다.
- **미완료:**
  - `516abd0a`에 대한 Codex 리뷰 결과(검토자 미확인)
  - 판정① 기록
  - 허대표님의 main 병합·배포 승인
  - Functions 배포. 배포 후 `gcloud functions list`로 확인하고, 운영 polishContent에 OPENAI 키가 연결됐는지 확인해야 합니다.
  - 운영 화면에서 BASIC 결과 확인
- 현재 배포된 것이 없으므로, 이 판정은 운영 무장애를 보장하지 않습니다.

### Slack 기록용 확정 요약
저는 Slack에 게시하지 않았습니다.
> [독립 Claude 검토] PR #301 delta `ecb46df5..516abd0a`(기본 다듬기 Luna, 일반 버튼 BASIC 연결, 풍성·기본 원문 보존 지시문) — 판정: **승인**(개발 범위). 중규모, 멈춤 조건 해당(모델 교체) → main 병합·배포는 허대표님 별도 승인 필요. 검토자 실행 결과: functions 36/36, frontend 6/6, diff check 깨끗, CI SUCCESS. BASIC만 Luna(none/8192)로 가고, 독서·배뇨·SayuModal·Export는 PREMIUM/Gemini 그대로. 키 연결·사용량 기록·월 한도 환급·리전·Firestore 경로 유지. 발견: CC 보고의 "독서사유 일반 버튼" 서술이 부정확(코드 영향 없음), 일반 버튼에서 형식별 지시문 구분이 없어지는 제품 변화 고지 필요, 출력 잘림 미감지(낮음). 남은 것: `516abd0a` Codex 리뷰 확인, 직접 빌드·export 재확인, 긴 입력으로 8192 확인, 배포 후 OPENAI 키 연결 확인.
