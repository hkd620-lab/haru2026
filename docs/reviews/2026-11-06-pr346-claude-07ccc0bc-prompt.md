# PR 346 독립 Claude 검토 — 질문 원문

- 실행 시각: 2026-11-06
- 검토 대상 HEAD: `07ccc0bc`
- 검토자 모델: Opus 5.5 (작업 맥락 없는 별도 에이전트)
- 전달한 것: 저장소 경로, PR·Slack 링크, 질문. CC의 검증 결과와 판단은 넘기지 않음

---

당신은 독립 코드 검토자입니다. 파일을 수정하거나 커밋·push·PR 댓글을 하지 마세요. 읽기만 합니다.

대상
- 저장소: /Users/heogyeongdae/Developer/HARU2026 (GitHub hkd620-lab/haru2026)
- PR: https://github.com/hkd620-lab/haru2026/pull/346 (base main, head feature/home-assistant-badge-and-preview-copy, 검토 대상 커밋 07ccc0bc)
- 배경 논의: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1793936135844209 (Slack 스레드. 읽을 수 있으면 읽고, 못 읽으면 건너뛰세요)
- diff 확인: `git diff origin/main...07ccc0bc` 또는 `gh pr diff 346 --repo hkd620-lab/haru2026`
- 프로젝트 규칙: 저장소 루트 CLAUDE.md (특히 "CC 코드 수정 원칙")

확인해 주세요
1. diff가 PR 제목·본문이 말하는 범위와 정확히 일치하는지, 범위를 벗어난 변경이 없는지.
2. HomePageV2.tsx 의 비서실 배지 식 `agentViewMode === 'my' && effectivePersonalizationLoaded ? \`전체 ${visibleAgents.length}가지 · 내 비서 ${homeAgents.length}개\` : \`${visibleAgents.length}가지 비서\``가 맞는 값을 내는지.
   - `visibleAgents`, `homeAgents`, `selectedAgents`, `effectivePersonalizationLoaded`, `agentViewMode`의 정의와 갱신 시점을 코드에서 직접 따라가 확인하세요.
   - '내 비서 0개'가 나오는 경우(개인화 선택이 비어 있을 때)에 화면의 다른 문구와 모순되지 않는지.
   - developerOnly·숨김 비서(HIDDEN_AGENT_LABELS)가 일반 사용자와 개발자에서 각각 어떻게 세어지는지.
3. 배지가 들어가는 `SectionHead`와 모바일 CSS(`[data-v2="section-badge"]`, `[data-v2="section-head"]`)에서 배지 문자열이 길어져도 레이아웃이 깨지지 않는지(코드 기준으로만 판단, 렌더링 확인 못 하면 못 했다고 쓰세요).
4. "역할 보고 선택하기 →"를 "무엇을 도와주는지 보기 →"로 바꾼 두 곳이 실제 동작과 맞는지. 해당 버튼을 누르면 무엇이 열리는지 코드로 확인하세요.
5. 바뀐 두 문구를 참조하는 테스트·문서가 있는지(frontend/test, frontend/src, docs). `HomePageV2.tsx`를 읽는 테스트 중 이 변경으로 영향받는 것이 있는지.
6. 그 밖에 이 변경이 일으킬 수 있는 회귀 위험.

답변 형식
- 판정: 승인 / 수정 후 승인 / 재설계 중 하나
- 근거: 확인한 파일·줄과 명령, 본 그대로의 결과
- 지적 사항: 번호, 심각도(높음·중간·낮음), 위치, 이유
- 확인하지 못한 것은 "확인 못 함"이라고 분명히 적으세요. 추측을 사실처럼 쓰지 마세요.
