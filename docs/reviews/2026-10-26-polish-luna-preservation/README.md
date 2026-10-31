# 일반 다듬기 Luna 전환·원문 보존 지시문 — 검토·비교 근거

- 대상 소스: `ecb46df5..516abd0a`. 소스 HEAD `516abd0a2ec4db4c7d90531bdc19e7e21801577d` `fix: 일반 다듬기를 Luna 기본 모드로 전환하고 원문 말투 보존 지시`.
- 브랜치 `codex-title-luna-extract`, 초안 PR <https://github.com/hkd620-lab/haru2026/pull/301>.
- 같은 PR의 제목 추출 Luna 교체 기록은 [../2026-10-26-title-luna-extract/](../2026-10-26-title-luna-extract/README.md)에 있고, 여기서는 고치지 않는다.
- 이 폴더는 docs 커밋으로 새 파일만 추가한다. 소스와 기존 검토 기록은 바꾸지 않는다.
- **범위: 개발 검증까지.** main 병합 안 함, 운영 배포 안 함. 모델 교체는 운영정책 8.1 멈춤 조건이므로 병합·배포는 허대표님 별도 승인이 필요하다.

## 허대표님 승인

1. "좋아 기본 다듬기는 Luna로 교체하고, 풍성형은 원문 의미와 말투를 유지하도록 지시문을 고쳐서 다시 비교해줘."
2. "일반 다듬기 버튼을 Luna 기본 모드로 연결 (권장)"

## 무엇이 바뀌었나

| 항목 | 변경 |
|---|---|
| 기본 다듬기 본문 | 새 용도 `sayuPolishBasic` = openai / `gpt-6-luna` / `reasoning_effort: 'none'` / `max_completion_tokens: 8192`. `polishContent`는 `mode`가 정확히 `'BASIC'`일 때만 이 용도로 보낸다 |
| 일반 다듬기 버튼 | `FormatModal`의 `pendingPolishMode` 초기값과 `handlePolishClick` 값이 `'BASIC'`. 제목 확인 → 월 한도 모달 → 확인 → 다듬기 흐름은 그대로 |
| 풍성형 | 모델은 Gemini 그대로. 지시문만 고침: 감각 묘사·비유 추가 대신 순서·문장 호흡·중복 정리만, 분량 억지 확장 금지 |
| 기본·풍성형 공통 | 원문 보존 규칙 추가: 말투(존댓말·반말·해요체·한다체)·화자·시제·숫자·부정·미정·발언자·감정 정도 보존, 없는 사건·장소·날씨·감각·원인·교훈 추가 금지, 짧으면 짧게, 원문 속 명령·인용은 따르지 않음, `[원문 시작]`/`[원문 끝]` 사이만 다듬고 본문만 출력 |
| 균형·보수형 | "존댓말 유지"를 "원문 말투 유지"로만 고침(Gemini 유지). 배뇨일지 요약 지시문은 그대로 |
| 기록 화면 안내문 | "무조건 ~다체" 지시와 제목 응답 예시 삭제, 원문 표시 추가, "공백 제외 2500자" PDF 요구와 사실 보존 자기검증 유지(안내문 580자 → 500자) |
| 그대로인 것 | 키워드(`recordKeywords`)·제목 일괄 보정·AI 한마디·통계는 Gemini. 제목 추출은 이미 Luna(이전 기록). 요청 형식·반환값·요청 수 제한·월 한도 예약/실패 환급·리전 `asia-northeast3`·Firestore 경로 `users/{uid}/records/{date}`·결제·인증 |

**경로별 모드**
- 기록 화면의 일반 다듬기 버튼(일기 footer, 일반 형식 footer)이 BASIC을 보낸다.
- `독서사유` 화면은 footer에 전용 버튼(중간기록저장하기·독서마무리하기)만 있어 일반 다듬기 버튼이 나오지 않는다. 독서 전용 다듬기는 `PREMIUM` 그대로다.
  - 첫 CC 보고(`haru-polish-connect-basic-result.json`)의 "독서사유도 일반 버튼으로 BASIC" 서술은 부정확했다(독립 검토 발견 1). 원본은 고치지 않고 여기 현재 설명을 바르게 적는다. PR 본문에는 같은 서술이 없다.
- 배뇨일지·`SayuModal` 재다듬기는 `PREMIUM`을 보낸다. `ExportModal`은 mode를 보내지 않아 서버 기본값 `premium`이 된다.

**제품 영향(승인 범위 안, 배포 승인 때 알려야 함)**
- 일반 버튼이 형식과 상관없이 BASIC 지시문 하나로 보낸다. 그래서 이 버튼에서는 풍성·균형·보수형 구분이 적용되지 않고, 맞춤법 위주로 교정이 약해진다.
- 일기·에세이 사용자는 "다듬기가 약해졌다"고 느낄 수 있다.
- 화면의 `SAYU (BASIC)`·`(BASIC 모드)` 표시와, 이 버튼으로 다듬은 기록의 `_mode` 저장값이 `BASIC`이 된다. 이 값으로 동작이 갈리는 코드는 없다.

## 검증 (자세한 명령·건수: [validation-summary.json](validation-summary.json))

- Functions 빌드 통과.
- Functions 테스트: aiGateway 16/16, polishContent 20/20, generateTitlesForAll 11/11, readingAi 8/8, monthlyAiQuota 정책 통과.
- 함수 export 114 → 114, 정렬 목록 sha256 `5bdd7903…2719` 같음.
- 프론트: formatPolishRequest 6/6(실제 버튼 → 확인 → 요청 흐름), readingAi 17/17, `vite build` 통과(합성 Firebase 값).
- 테스트가 확인하는 동작
  - 모드별 용도와 사용량 기록 모델
  - 월 한도 예약 1회, 실패 환급 1회
  - 통계·한마디 부분 성공 계약
  - 키워드·일괄 보정 Gemini 유지
  - 지시문 내용
  - 제목 없음·중복 확인 방지
- CI(`516abd0a`): `build_and_preview` SUCCESS(<https://github.com/hkd620-lab/haru2026/actions/runs/40246976065/job/121330493314>), `Deploy Preview` SUCCESS. Hosting PR preview이며 Functions·운영 배포가 아니다.
- Codex 리뷰 실행 2(`516abd0a`): 지적 없음. 자세한 내용은 [codex-review-02.md](codex-review-02.md).

## 실제 호출 비교 (부모 Codex 수행, 합성 데이터만)

**파일**
- [results.jsonl](results.jsonl): 124행, 응답 원문 포함
- [summary.json](summary.json), [findings.json](findings.json), [gateway-live.json](gateway-live.json), [key-access-audit.json](key-access-audit.json)
- [cases.json](cases.json): 합성 원문 18개 = 기존 비교의 base 12개 + 새 fresh 6개
- [compare.cjs](compare.cjs): 재현 스크립트
- 이 파일들은 부모 Codex가 작업폴더로 복사한 원본과 sha256이 같다.
- 실험 입력 전체(`inputs.json`, 약 560KB)는 위 원문 18개와 compare.cjs가 만드는 요청의 중복이라 보관하지 않았다.

**실험 구성(compare.cjs)**
- old: `/Users/heogyeongdae/Developer/HARU2026`의 당시 작업본. 그 저장소의 HEAD는 실험 기록에 남아 있지 않다.
- new: 이 worktree. 당시 HEAD `ecb46df5`에 커밋 전 1차 구현(BASIC 용도·지시문·안내문)을 더한 상태였다.
  - 그 뒤 `516abd0a`로 커밋하기 전에 바뀐 것은 `pendingPolishMode` 두 줄과 테스트뿐이다.
  - 그래서 실험이 추출한 `handlePolishWithMode`·`polishContent` 코드는 `516abd0a`와 같다(CC 작업 기록 기준).
- 각 버전의 실제 `FormatModal.tsx` `handlePolishWithMode`와 `index.ts` `polishContent` handler를 TypeScript AST로 꺼내 실행해, 화면이 만드는 요청과 서버가 만드는 system prompt를 그대로 얻었다. 그다음 같은 입력으로 각 회사 API를 직접 호출했다.
- 비교에서 출력 상한은 4096이다. 제품 BASIC 설정은 8192다.
- API 키는 실행 중 `gcloud secrets versions access`로 메모리에만 읽었다. 스크립트와 결과 파일에 키 원문은 없다(키 형태 문자열 검사 결과 0건).

**호출 구성**

| 묶음 | 지시문 | 호출 |
|---|---|---|
| paired | base 12개 × old/new × 2회 × Gemini/Luna, 모드 PREMIUM(형식별 풍성·균형·보수형) | 96 |
| fresh | fresh 6개 × new × 2회 × Gemini/Luna, 모드 PREMIUM | 24 |
| basic-live | 4개 × new × Luna, 모드 BASIC(`sayuPolishBasic`) | 4 |

- 124회 모두 성공했다(오류 0, `stop` 외 종료 0).
- 이와 별도로, 빌드된 공통 창구(`aiGateway`)로 `sayuPolishBasic`을 1회 호출해 성공했다([gateway-live.json](gateway-live.json): `none`, 8192, 빈 응답 아님, `finish: "stop"`).

**결과**
- 비용: 새 지시문 paired 같은 24건에서 Gemini $0.0069345, Luna $0.002721로 **약 61% 낮았다**(model 토큰 비용 추정, 이 24건 비교에 한정).
- 품질(Codex 수동 평가, [findings.json](findings.json))
  - 새 지시문이 두 모델 모두에서 원문에 없는 장면을 지어내는 것을 줄였고, 말투를 강제로 바꾸던 문제를 없앴다.
  - 이 표본에서는 Luna가 원래 말투를 더 일관되게 지켰다.
  - Gemini는 새 지시문에서도 가끔 말투나 뉘앙스가 바뀌었다(예: long-mixed에서 "데운 국을 먹음" 추가).

**비교의 한계**
- 품질 평가는 블라인드가 아닌 Codex 수동 평가다.
- 표본은 합성 원문 18개뿐이고, 사용자 운영 기록은 쓰지 않았다. 일반화할 수 없다.
- 61% 절감과 말투 일관성 비교는 **PREMIUM 형식별 지시문**으로 두 모델을 비교한 결과다. 일반 버튼이 이제 보내는 **BASIC 지시문**은 Luna로 4회(+창구 1회)만 호출됐다.
- 긴 입력(5000자에 가까운 경우)으로 8192 상한을 실제 호출한 근거는 없다. 비교의 최대 출력은 578토큰이었다.
- `callOpenAi`는 `finish_reason: 'length'`(출력 잘림)를 따로 감지하지 않는다. 낮은 수준의 기존 위험이다(독립 검토 발견 3).
- 기록 화면의 "공백 제외 2500자" PDF 요구 때문에 긴 입력은 압축해야 하고, 이는 원문 보존 규칙과 부딪칠 수 있다. 이번에 생긴 문제가 아니라 기존부터 있던 긴장이다.
- 모델 호출 성공은 출력 품질이나 운영 무장애를 보장하지 않는다.

## 독립 검토

- 원문: [independent-review.md](independent-review.md)(질문·결과 원문 전문), 원본 [질문](haru-polish-independent-review-prompt.txt)·[결과 JSON](haru-polish-independent-review-result.json).
- 판정 원문: "**판정: 승인.** 허대표님이 승인한 개발 범위까지만 해당합니다."
- 규모 중규모, 멈춤 조건 해당. main 병합·배포는 허대표님 별도 승인이 필요하다.
- 발견: 1 CC 보고 서술 부정확(코드 영향 없음, 위 "경로별 모드"에 반영), 2 일반 버튼의 형식별 구분이 사라지는 제품 영향(위 "제품 영향"에 고지), 3 출력 잘림 미감지(낮음, 위 한계에 명시).

**원문 보완(원문은 고치지 않음)**
- 검토자는 PR 댓글 조회 권한이 없어 `516abd0a`의 Codex 결과를 확인하지 못했다고 적었다. 부모 Codex와 CC가 결과 댓글 [6405188278](https://github.com/hkd620-lab/haru2026/pull/301#issuecomment-6405188278)("Codex Review: Didn't find any major issues. Breezy!", Reviewed commit `516abd0a2e`)을 직접 확인했다. 이 근거로 개발 단계 검토는 통과했다.
- 검토자는 `gateway-live.json`의 `requestShape`를 "설정값 기록이며 실제 전송 캡처는 아님"으로 보았다. 부모 Codex에 따르면 이 값은 SDK `chat.completions.create`에 들어가는 body를 감싼 코드에서 캡처한 것이다. 캡처 스크립트(`/private/tmp/haru-polish-preservation-v2/gateway-live.cjs`)는 이 폴더에 보관하지 않았다.
- 검토자는 빌드와 export 해시를 직접 재지 못했다. CC가 빌드와 해시를 재실행했다(validation-summary.json).

## 배포할 때 필요한 것 (지금은 하지 않음)

- 운영 `polishContent`는 현재 `GEMINI_API_KEY`만 연결돼 있다. 새 소스를 배포해야 `GEMINI_API_KEY`·`OPENAI_API_KEY`가 둘 다 연결된다.
- 읽기 전용 점검([key-access-audit.json](key-access-audit.json)) 결과, 기존 함수 서비스 계정은 OpenAI secret에 직접 접근 권한이 이미 있다. IAM은 수정하지 않았다.
- 새 환경변수는 없다.
- 배포 대상: `polishContent`·`extractTitle` Functions, 웹 Hosting. 리전 `asia-northeast3`는 그대로다.

## 되돌리기 (지금은 실행하지 않음)

- 소스 커밋 `516abd0a`(필요하면 제목 커밋 `5d8e7766`도)을 `git revert`한 뒤, 대상 함수(`polishContent`, `extractTitle`)와 웹을 다시 배포한다.

## 파일 목록

| 파일 | 내용 |
|---|---|
| `README.md` | 이 문서 |
| `independent-review.md` | 독립 검토 질문·결과 원문(읽기용) |
| `haru-polish-independent-review-prompt.txt`, `haru-polish-independent-review-result.json` | 독립 검토 원본 |
| `haru-polish-basic-rich-cc-result.json`, `haru-polish-connect-basic-result.json` | CC 구현 결과 원본(1차 BASIC·지시문, 2차 버튼 연결) |
| `validation-summary.json` | 검증 명령·건수·결과 요약 |
| `codex-review-02.md`, `codex-observed-start.json` | Codex 리뷰 실행 2 기록, 부모가 관측한 시작 시각 |
| `results.jsonl`, `summary.json`, `findings.json`, `gateway-live.json`, `key-access-audit.json` | 실제 호출 비교 원본 |
| `cases.json`, `compare.cjs` | 합성 원문 18개, 재현 스크립트 |
