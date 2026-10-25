# 독립 Claude 검토 원문 — extractTitle Luna 교체

- 검토 대상: 기준 HEAD `39b4f20d4115437c262f99562f8fbff18035a449` + 커밋 전 작업트리 diff 3개 파일(`functions/src/ai/aiModels.ts`, `functions/src/ai/aiGateway.ts`, `functions/test/aiGateway.test.js`).
- 이 diff는 검토 뒤 수정 없이 코드 커밋 `5d8e77661bd57df5fb9a72820c3513d75d2983e9`로 커밋됐다. 같은 diff인지 판단한 근거는 [README](README.md)의 "검토 대상과 커밋의 관계" 절에 있다.
- 검토자: 작업 맥락을 공유하지 않는 독립 Claude 세션(`claude-opus-5-5`, session_id `e71bbc2a-66ec-4f5b-a580-58f030d49661`), 읽기 전용. CLI 결과: `subtype: success`, `is_error: false`, `num_turns: 24`, `duration_ms: 143552`.
- 원본 파일: 질문 `/private/tmp/haru-title-luna-review-request.txt`, 결과 `/private/tmp/haru-title-luna-independent-review.json`(`result` 필드). 아래 두 절은 이 원본을 고치지 않고 옮긴 것이다. 결과 JSON의 다른 필드(사용량·비용)는 옮기지 않았다.
- 검토 시각: 결과 JSON에는 완료 시각 필드가 없다. 이 세션에서는 `/private/tmp` 파일의 수정 시각을 읽을 권한이 없어서 측정하지 못했다. 검토는 2026-10-26(KST) 첫 작업 세션 뒤, 이 기록(2026-10-26T06:52 KST 작성)보다 앞서 이뤄졌다.
- 검토자 권한 거부 기록(`permission_denials`): 테스트 파일 일부 `sed` 읽기, 근거 파일을 마스킹해 읽기, OpenAI 문서 `curl` 조회, 임시 복사본 빌드, `tsc --noEmit` 실행이 허가되지 않았다. 결과 원문 5절 1·2번 한계(문서 확인 못 함·빌드 직접 못 함)가 이 때문이다.

## 질문 원문

```text
독립 Claude 설계·완료 검토를 수행하세요. 파일 수정·커밋·외부 전송 금지, 읽기 전용입니다. 작업자 설명을 전달받지 않은 별도 세션입니다. AGENTS.md와 docs/HARU2026_Slack_운영정책.md 8.1에 따르세요. 검토 대상: /Users/heogyeongdae/.codex/worktrees/title-luna/HARU2026, 기준 HEAD 39b4f20d 및 현재 git diff의 functions/src/ai/aiModels.ts, functions/src/ai/aiGateway.ts, functions/test/aiGateway.test.js. 사용자의 승인 범위는 제목 extractTitle만 gpt-6-luna 교체하고 개발 화면 검증, 키워드 Gemini 유지. 운영 배포·main 병합 승인 없음. 보호 파일 열람 금지: routes.tsx, HaruRawPage.tsx, LibraryPage, .zombie.
근거: /private/tmp/haru-title-luna-dev/evidence.json (실제 provider 호출 및 로컬 UI 검증; 계속 검증 중일 수 있음), /private/tmp/haru-title-luna-cc-result.json(검증 명령·원문 결과), https://developers.openai.com/api/docs/models/gpt-6-luna. 결과 파일을 신뢰하지 말고 diff·테스트와 대조하세요. 운영 데이터 저장 검증으로 해석하지 마세요. API 키·인증정보를 읽거나 출력하지 마세요. 작업 규모 소/중/대와 멈춤 조건 해당 여부, 승인 범위 충족 여부를 포함해 판정을 정확히 승인/수정 후 승인/재설계 중 하나로 작성하고 근거와 남은 검증 한계를 보고하세요. 제목 교체만인지, Gemini 키워드/일괄 보정/다듬기 보존, OpenAI none·출력 상한이 그 용도에만 적용되는지, secret routing, 테스트 유효성, 운영 배포 미실시를 검토하세요. 추가 에이전트는 만들지 마세요.
```

## 결과 원문

## 독립 Claude 설계·완료 검토 결과

**판정: 승인**

이 승인은 허대표님이 허락한 범위, 즉 "제목 추출만 Luna로 교체하고 개발 화면에서 검증"까지만 해당합니다. main 병합과 운영 배포는 이 판정에 들어 있지 않습니다. 이번 변경은 멈춤 조건(모델 교체, 비용 변화 가능)에 해당하므로 둘 다 허대표님의 별도 승인이 필요합니다.

- **검토 대상:** `codex-title-luna-extract` 브랜치, HEAD `39b4f20d`, 커밋하지 않은 수정 3개 파일(+57 −7)
- **검토 방식:** 읽기만 했습니다. 파일 수정, 커밋, 외부 전송은 하지 않았고, 열람 금지 파일과 API 키도 열지 않았습니다.

### 1. 작업 규모와 멈춤 조건
- **규모: 중규모.** 바꾼 건 기능 1개의 모델이지만, AI 호출 창구에 용도별 OpenAI 설정이라는 새 통로가 생겼습니다. 또 창구를 거쳐 실제로 OpenAI로 가는 첫 용도이기도 합니다. 지금까지 OpenAI 쪽 코드는 테스트에서 회사를 임시로 바꿔 끼워서만 실행됐습니다.
- **멈춤 조건: 해당합니다.**
  - 모델 교체는 답변 품질에 영향을 줍니다.
  - 모델이 바뀌면 비용이 늘 수 있습니다. 이 점은 직접 확인하지 못했습니다.
  - 그래서 이 변경은 자동 판정 대상이 아닙니다. 허대표님 승인이 있는 개발 검증까지만 진행할 수 있습니다.
- **판정①(확정) 조건: 아직 충족하지 않습니다.** PR이 없어서 PR CI와 Codex 리뷰가 없고, PR에 첨부할 필수 검증 로그도 없습니다.

### 2. 승인 범위대로 됐는지

**제목 추출만 바뀌었습니다.** `functions/src/ai/aiModels.ts`의 diff에서 모델 설정이 바뀐 용도는 `recordTitle` 하나뿐입니다.
- 회사는 openai, 모델은 `gpt-6-luna`입니다.
- OpenAI 설정은 추론 끄기(`reasoningEffort: 'none'`)와 출력 상한 512입니다.

**그대로 유지된 것**
- 키워드(`recordKeywords`), 제목 일괄 보정(`recordTitleBackfill`), 다듬기(`sayuPolish`, `sayuPolishComment`)는 diff에서 바뀌지 않았고, 모두 Gemini `gemini-3.1-flash-lite`입니다.
- 테스트도 이 31개 용도를 Gemini로 고정하고, 이들에 OpenAI 설정이 없다는 것까지 확인합니다.
- `index.ts`의 호출부와 프롬프트는 diff에 없습니다.
- 리전 `asia-northeast3`도 그대로입니다(`index.ts:2563`).

**추론 끄기와 출력 상한은 제목 추출에만 붙습니다.**
- 창구 코드(`aiGateway.ts`)는 설정 표에 그 용도의 OpenAI 설정이 있을 때만 `reasoning_effort`와 `max_completion_tokens`를 요청에 넣습니다.
- Gemini로 보내는 쪽에는 이 설정이 전달되지 않습니다.
- 기존 OpenAI 테스트(`aiGateway.test.js:83-90`)는 다른 용도의 요청 내용 전체를 비교합니다. 그래서 다른 용도에 이 값이 새어 들어가면 테스트가 실패합니다.
- 호출부가 출력 한도를 직접 넘기면 그 값이 우선합니다. 코드 주석과 테스트 둘 다 이 동작을 확인합니다.

**API 키 연결(secret routing)**
- 제목 추출 함수의 키 연결은 기존 코드 그대로입니다(`index.ts:2564`, `secrets: aiSecretsFor('recordTitle')`). 설정 표만 바뀌었으므로 다음 배포 때 이 함수에는 `OPENAI_API_KEY` 하나만 연결됩니다.
- 키워드와 일괄 보정에는 `GEMINI_API_KEY`만 연결됩니다. 테스트가 이를 확인합니다.
- `OPENAI_API_KEY`는 `elderBook.ts`, `bookReview.ts`에서 이미 쓰고 있어서 운영 Secret Manager에 있는 것으로 보입니다.

**운영 배포는 하지 않은 것으로 보입니다.**
- HEAD는 `39b4f20d` 그대로이고, 수정은 커밋되지 않았으며, 브랜치는 로컬에만 있습니다.
- 다만 `gcloud functions list`는 제가 실행하지 않았습니다. 운영 상태를 직접 재본 것은 아닙니다.

### 3. 테스트가 제대로 확인하는지
- `node --test test/aiGateway.test.js` 결과 **15개 모두 통과**했습니다. 제가 직접 실행했습니다.
  - 테스트는 `lib/ai/*.js`(빌드 결과)를 불러옵니다. 이 파일들은 원본(06:27:06/16)보다 나중(06:27:54)에 만들어졌고, 바뀐 코드가 들어 있는 것도 확인했습니다.
- 새 테스트는 다음을 고정합니다.
  - 실제로 보내는 요청 내용: 모델, 메시지, `reasoning_effort: 'none'`, `max_completion_tokens: 512`
  - OpenAI 키를 쓰는지
  - 호출부가 넘긴 출력 한도가 우선하는지
  - 키워드는 Gemini로 가는지
- 기존 테스트(342행)가 제목 추출 호출부의 인자를 `input,purpose`로 고정하고 있습니다. 그래서 새 테스트의 "제목 추출은 input 하나만 넘긴다"는 전제도 유효합니다.
- 테스트 한계: 이 테스트는 가짜 SDK로 요청 모양만 확인합니다. OpenAI가 실제로 `reasoning_effort: 'none'`을 받아들이는지는 확인하지 못합니다.

### 4. 근거 파일과 대조한 결과
- **`evidence.json`(개발 검증 기록)**
  - 실제 API 호출 기록이 있습니다. 제목은 openai/Luna로 1771ms가 걸렸고 입력 125·출력 11 토큰으로 "첫 방울토마토 수확"이 나왔습니다. 키워드는 Gemini로 나갔습니다.
  - 일부러 실패시킨 경우는 INTERNAL 오류로, 빈 응답인 경우는 빈 제목으로 끝났습니다. 둘 다 기존 동작과 같습니다.
  - 추론 끄기와 512가 들어간 요청을 기록한 항목(`openai-request`)은 실제 전송 내용을 캡처한 것이 아니라 검증 도구가 남긴 로그입니다. 그래도 같은 설정으로 실제 호출이 성공했으므로, 이 설정이 받아들여졌다는 간접 근거는 됩니다.
  - 이 기록은 개발 환경 검증입니다. 운영 데이터 저장 검증으로 보지 않았습니다.
- **`cc-result.json`(작업자 보고)**의 내용은 diff와 일치합니다. 작업자가 되돌렸다고 한 git 추적 파일 `functions/lib/index.js`는 현재 수정 상태가 아닙니다.

### 5. 남은 한계와 주의할 점
1. **모델 문서를 확인하지 못했습니다.** 외부 접속이 허가되지 않아 OpenAI의 gpt-6-luna 문서를 열지 못했습니다. 그래서 `reasoning_effort: 'none'` 지원 여부와 가격은 확인하지 못했습니다. 비용이 늘어나는지는 허대표님이 판단하셔야 합니다.
2. **빌드를 직접 하지 못했습니다.** 빌드는 git에 추적되는 `lib` 파일을 다시 만들기 때문에 실행하지 않았습니다. 타입 검사(`tsc --noEmit`)와 다른 폴더로 복사해 빌드하는 것은 실행이 허가되지 않았습니다. 빌드 성공과 export 114개 일치는 작업자 보고에만 근거합니다. PR 단계에서 다시 실행해야 합니다.
3. **배포 전 확인할 것:** 제목 추출 함수의 서비스 계정이 `OPENAI_API_KEY`에 접근할 수 있는지는 확인되지 않았습니다.
4. **사용량 기록이 없습니다.** 제목 추출은 원래 사용량을 기록하지 않습니다(키워드는 기록함). 그래서 회사를 바꾼 뒤 늘어나는 비용을 앱 안에서 볼 수 없습니다. 이번 범위는 아니지만 알아 두실 점입니다.
5. **커밋할 때 빼야 할 것:** `functions/node_modules`는 링크 형태라 git 제외 목록에 걸리지 않고 `git status`에 `??`로 나옵니다. 커밋에서 빼야 합니다.
6. **품질 확인은 한 건뿐입니다.** 실제 Luna 응답으로 확인한 사례가 하나뿐입니다. 짧은 기록, 영어 기록, 따옴표가 붙은 출력 같은 경우에 품질이 어떤지는 개발 화면에서 더 확인해야 합니다.

### Slack 기록용 확정 요약
저는 Slack에 게시하지 않았습니다. 게시와 `docs/reviews/` 원문 보관은 CC가 맡습니다.
> [독립 Claude 검토] extractTitle Luna 교체(codex-title-luna-extract, 기준 HEAD 39b4f20d + 커밋하지 않은 diff 3개 파일) — 판정: **승인** (승인 범위: 제목만 교체·개발 화면 검증). 중규모, 멈춤 조건 해당(모델 교체, 비용 변화 가능) → main 병합·운영 배포는 허대표님 별도 승인 필요. aiGateway 테스트 15/15 통과(검토자 실행). 키워드·일괄 보정·다듬기는 Gemini 유지 확인. 추론 끄기와 출력 상한 512는 recordTitle에만 적용. 남은 확인: 빌드와 export 목록 재실행, PR CI, Codex 리뷰, OPENAI_API_KEY 접근 권한, Luna 가격과 reasoning_effort 문서 확인.
