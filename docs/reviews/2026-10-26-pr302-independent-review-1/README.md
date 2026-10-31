# PR #302 독서장 간결한 답변 독립 검토

- 제품 HEAD: `5ea63d3d9f740b01682429e45c906ff7828ffd5f` (main `39b4f20d`).
- [질문 원문](prompt.md), [CLI 결과 원문](result.json), [판정 원문](reviewer-result.md), [시각·실행 메타데이터](metadata.json).
- 판정 원문: **판정: 승인**. 차단 지적 없음, 규모 소, 멈춤 조건 해당 없음(제품 코드).
- 비차단 메모와 배포 승인 범위에 관한 검토자 의견을 원문 전체에 보존한다. `구체적으로`가 단순 사실 질문에 사용될 때의 오탐, 조건 보존과 3줄 제한의 긴장, 빌드 산출물 제외를 별도 기록했다.
- 이번 변경은 동일 대화에서 승인한 독서장 개선의 후속 답변 지침 보완이다. 사용자 요구는 “독서장 AI 답변을 기본 3줄 이내로, 핵심 팩트만 답하도록 바꿔줘. 자세한 설명은 요청할 때만 해줘.”이다. 이전 직접 지시 “검토와 CI 확인하고 문제 없으면 병합·배포까지 진행해줘”를 같은 독서장 기능 보완에 적용한다. 과거 2026-10-07 CC 세션의 상시 배포 승인을 이어받지 않는다.
- 병합 전에 최신 CI·Codex 결과·필수 검증을 모두 확인한다. 이후 추가는 `docs/reviews/` 아래 새 검토 기록만 허용한다. 실제 모델 응답 검증 전에는 운영 완료로 확정하지 않는다.
- 실행 명령: `claude -p --tools Read,Glob,Grep --allowedTools Read,Glob,Grep --strict-mcp-config --mcp-config '{"mcpServers":{}}' --setting-sources '' --no-session-persistence --output-format json`.

## 필수 검증

- 최종 지침을 컴파일한 `functions`의 `npm run test:reading-ai`: `tsc` 빌드와 8/8 통과. 최종 lib/readingAiCore.js에 “단순히 근거” 규칙 반영 확인.
- `git diff --check` 통과.
- `git diff origin/main...HEAD -- functions/src/index.ts functions/src/readingAi.ts functions/src/ai/aiModels.ts` 결과 없음. Functions export 정의·리전·모델·출력 한도·호출량 변경 없음.
- 프론트 제품 변경 없음. PR CI의 웹 빌드·미리보기 성공은 별도 색인에 기록한다.
- 실제 모델의 기본 → 명시적 상세 → 일반 질문 복귀 확인은 배포 후 별도 수행하며, 화면 폭에 따른 자동 줄바꿈 수 고정과 구분한다.
