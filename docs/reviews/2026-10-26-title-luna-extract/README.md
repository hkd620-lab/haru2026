# 기록 제목 추출(extractTitle) Luna 교체 — 검증 요약

- 기록 작성: 2026-10-26T06:52 KST (2026-10-25T21:52Z), CC.
- 브랜치: `codex-title-luna-extract`. 기준 커밋 `39b4f20d4115437c262f99562f8fbff18035a449`(origin/main, PR #300 병합).
- 코드 커밋: `5d8e77661bd57df5fb9a72820c3513d75d2983e9` `fix: 기록 제목 추출을 Luna로 전환`.
- 이 기록은 별도 docs 커밋으로 `docs/reviews/2026-10-26-title-luna-extract/` 아래에 새 파일만 추가한다. 기존 문서와 코드는 고치지 않는다.
- 파일: [독립 검토 질문·결과 원문](independent-review.md), [개발 화면 검증 근거](evidence.json), [검증 요약 JSON](validation-summary.json).

## 허대표님 승인 범위

- 원문: "좋아 제목만 Luna로 교체하고 개발 화면에서 검증해줘. 키워드는 Gemini 유지하고".
- 포함: `recordTitle`(extractTitle) 모델 교체, 로컬 개발 화면 검증.
- 제외: 운영 배포, main 병합. 모델 교체는 운영정책 8.1 멈춤 조건이므로 병합·배포는 허대표님 별도 승인이 필요하다.

## 변경 내용 (코드 3개 파일, +57 −7)

| 파일 | 변경 |
|---|---|
| `functions/src/ai/aiModels.ts` | `AiRoute`에 OpenAI 전용 선택 설정 `openai?: { reasoningEffort?: 'none'; maxCompletionTokens?: number }` 추가. `recordTitle`만 `openai` / `gpt-6-luna` / `{ reasoningEffort: 'none', maxCompletionTokens: 512 }` |
| `functions/src/ai/aiGateway.ts` | `callOpenAi`가 설정 표의 `route.openai`를 받아 값이 있을 때만 `reasoning_effort`·`max_completion_tokens`를 붙인다. 호출부의 `maxOutputTokens`가 있으면 그 값이 우선. Chat Completions 유지 |
| `functions/test/aiGateway.test.js` | 모델 고정 기대값 갱신(나머지 31개 용도는 기존 모델 유지, `openai` 설정 없음). 새 테스트 1개: 제목 요청 실제 본문, OpenAI 키 연결, 키워드 Gemini 유지 |

- `recordKeywords`·`recordTitleBackfill`·`sayuPolish` 등 다른 용도: Gemini 그대로.
- `index.ts`의 호출부·프롬프트, 리전 `asia-northeast3`, Firestore 경로 `users/{uid}/records/{date}`, 프론트 화면: 변경 없음.
- 새 환경변수 없음. `extractTitle`의 `secrets: aiSecretsFor('recordTitle')`가 설정 표에 따라 기존 `OPENAI_API_KEY`로 연결된다(키워드·일괄 보정은 `GEMINI_API_KEY`).
- 결제·인증 로직 변경 없음.

## 검토 대상과 커밋의 관계

- 독립 검토는 기준 HEAD `39b4f20d` 위의 커밋 전 작업트리 diff(위 3개 파일)를 대상으로 했다.
- 검토 뒤 코드는 고치지 않았고, 같은 3개 파일을 그대로 `5d8e7766`으로 커밋했다. `git diff --raw 39b4f20d 5d8e7766`:
  - `functions/src/ai/aiGateway.ts` `57f0425c → 4c7234bb`
  - `functions/src/ai/aiModels.ts` `c400576e → 83e6ea0c`
  - `functions/test/aiGateway.test.js` `12846865 → 4f71f889`
- 첫 작업 세션의 최종 `git diff`도 같은 blob(`aiGateway.ts` `57f0425c..4c7234bb`, `aiModels.ts` `c400576e..83e6ea0c`)이었고, 검토 원문의 "+57 −7"과도 일치한다.

## 빌드·테스트·export

| 항목 | 결과 |
|---|---|
| `npm run test:ai-gateway`(빌드 `tsc` 포함) | 통과, 15/15 |
| `node --test test/generateTitlesForAll.test.js test/readingAi.test.js` | 통과, 19/19 |
| `lib/index.js` export 목록 (변경 전 → 후) | 114 → 114, 정렬 목록 sha256 `5bdd7903424f94ef1c7c2fd636ca91d74a01512839055b9b3de997645862a719` 동일 |

- 위 결과는 첫 세션과 코드 커밋 직전에 CC가 다시 실행해 얻었다.
- 빌드는 git에 추적되는 `functions/lib/index.js`·`lib/snsToDiary.js`를 다시 만든다. 커밋된 사본이 이미 원본 소스와 맞지 않던 상태라 범위 밖으로 보고 `git restore`로 되돌렸다. 커밋에 포함하지 않았다.
- `functions/node_modules`는 공유 의존성 링크(로컬 전용)이며 커밋하지 않았다.

## 로컬 개발 화면 검증 (부모 Codex 수행)

경로: 실제 `GrowthTimelineCreator` 화면과 Firebase callable SDK → localhost callable 프로토콜 브리지 → 소스에서 AST로 뽑은 실제 `extractTitle`·`extractKeywords` 함수 → 빌드된 `aiGateway` → 실제 API.

| 경우 | 결과 |
|---|---|
| 제목(Luna, `none`/512) | "첫 방울토마토 수확" (1771ms, 입력 125·출력 11 토큰) |
| 키워드(Gemini `gemini-3.1-flash-lite`) | `["방울토마토","텃밭","오이지지대"]` |
| 공급자 실패 | callable `INTERNAL`, 화면은 사용자 제목 "내 텃밭 기록" 보존 |
| 빈 응답 | `title: ""`, 화면은 기본 제목 "2026.10.26 성장타임라인" 유지 |
| 인증 없음 | `UNAUTHENTICATED`, 추가 AI 호출 없음 |

- 실제 API 호출: 제목 1회 + 키워드 1회, 총 2회.
- `evidence.json`은 원본 바이트 그대로이며 sha256 `c0961bd5c04a6c8a89ac6b4a65d587712f1cb1d352b3236472cc00a26ccdd388`가 `validation-summary.json`의 `evidenceSha256`과 일치한다.
- `validation-summary.json`은 원본을 읽어 다시 쓴 사본이고, 원본 해시는 기록되지 않아 바이트 일치는 확인하지 못했다.
- 두 파일 모두 합성 기록 내용만 담고 있으며 개인정보·키·토큰은 없다. 화면 캡처 `success.png`는 저장소에 넣지 않았다.

### 한계

- 사진·메타데이터·Storage 업로드와 기록 저장은 합성 fixture와 로컬 메모리로 대신했다.
- 운영 Firebase Auth 토큰, Rules, IAM(서비스 계정의 `OPENAI_API_KEY` 접근 권한 포함), 배포 ID, Firestore 운영 저장은 검증하지 않았다.
- 다른 운영 화면과 실제 운영 데이터는 검증하지 않았다.
- 실제 Luna 품질 확인은 1건이다.

## 비용 비교

- 승인 전 부모 Codex가 한 사전 비교(가상 기록 30건, 120회 호출)는 이번 검증과 별도인 시험이다. 그 결과는 이 기록과 위 API 호출 2회에 포함되지 않는다.
- 제목 추출은 원래 사용량 기록을 남기지 않아 교체 뒤 비용 변화를 앱 안에서 볼 수 없다(독립 검토 5절 4번).

## 독립 검토

- 판정: **승인**(승인 범위: 제목만 교체·개발 화면 검증). 중규모, 멈춤 조건 해당 → 병합·배포는 허대표님 별도 승인 필요.
- 원문의 한계는 그대로 남긴다. 검토자는 권한 거부로 OpenAI 모델 문서를 열지 못했고, 빌드와 `tsc --noEmit`도 직접 실행하지 못했다. 빌드 성공과 export 114개 일치는 작업자 보고에만 근거한다고 적었다.

### 별도 관찰 (부모 Codex 보완 — 독립 검토 판정에 포함되지 않음)

- 부모 Codex가 공식 문서 <https://developers.openai.com/api/docs/models/gpt-6-luna>에서 `reasoning_effort: 'none'` 지원을 확인했다고 전달했다.
- 부모 Codex의 실제 API 호출(위 검증)에서 `none`/512 설정의 제목 요청이 성공했다.
- 부모 Codex가 구현 diff를 검토했고, 조치가 필요한 지적은 없었다.

## 보안·운영

- API 키·인증정보는 열람·출력하지 않았다. 이 기록에도 키·토큰·개인정보는 없다.
- 운영 배포 없음. main 병합 없음.
