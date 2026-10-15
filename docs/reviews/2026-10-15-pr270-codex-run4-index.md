# PR #270 Codex 검토 실행 4 색인 (P2-3 변경, HEAD bdefa3f8) — 지적 2건(P2 1·P3 1)

- PR: <https://github.com/hkd620-lab/haru2026/pull/270> (초안, 열림)
- 작업: ④ AI 비서 추천 정확도 개선 — 독립 Claude 1회차 지적 중 P2-3(상위 빈도 합성어·한자어 활용형 22개) 보완의 재검토. 허대표님이 "한 가지씩" 진행하도록 지시했고 이번 Codex 재검토도 허대표님이 승인했다.
- 실행 번호: **실행 4**. 실행 1(`cf390dea`, 2026-10-09, 주요 지적 없음)의 색인은 PR 브랜치 `docs/reviews/2026-10-09-pr270-codex-run1-request.md`·`…-run1-result.md`에, 실행 2(`12a89231`)는 `2026-10-15-pr270-codex-run2-index.md`(`1d5aeaad`), 실행 3(`84363132`)은 `2026-10-15-pr270-codex-run3-index.md`(`26f0ffdb`)에 있다. 중단·대체된 실행은 없다.
- 요청 댓글(질문 원문): <https://github.com/hkd620-lab/haru2026/pull/270#issuecomment-6191928586>
- 요청 시각: 2026-10-15T12:22:01Z (한국시간 2026-10-15 21:22:01)
- 요청 계정: `hkd620-lab`(CC가 작성, 허대표님 승인 지시). 같은 계정이 다른 댓글에도 쓰여 계정만으로 요청 주체를 구분할 수는 없다.
- 요청 당시 PR HEAD: `bdefa3f8c681d887606342ab54bbb581be908a32` (요청 직전 PR 조회와 `git ls-remote`로 확인, 결과 확인 시점까지 head 변동 없음)
- 요청 문구의 검토 대상 HEAD: `bdefa3f8c681d887606342ab54bbb581be908a32` — 요청 당시 PR HEAD와 **같다**.
- 실행 종류: 댓글로 명시적 요청(`@codex review` 1회). 자동 실행이 아니며 중복 요청은 없다. 이 댓글 이후 새 일반 댓글은 없었다(`perPage=1` 조회에서 14번째 페이지가 요청 댓글, 15번째 페이지는 비어 있음).
- **확인 가능한 시작 시각: 2026-10-15T12:22:14.622627Z.** Codex 요약 댓글(`6072159314`)이 중간 상태 "🔄 Running since 2026-10-15T12:22:14.622627Z | `bdefa3f` | Manual request"(숨은 상태 값의 `commit_sha`는 `bdefa3f8c681d887606342ab54bbb581be908a32`, `status`는 `running`)로 갱신됐고, 이 CC 세션이 PR 이벤트 구독(`issue_comment.edited`, 서버 queued 12:22:18Z, 수신 12:22:29Z)으로 그 내용을 관측했다. 요약 댓글은 완료 시 같은 댓글이 덮어써져 중간 상태 원문은 아래 "원문 사본"의 이벤트 사본에만 남는다. 이전 실행 1~3은 이 중간 상태를 관측하지 못해 시작 시각을 "확인 불가"로 적었다. 요청 후 약 13.6초에 시작했다.
- 실행 완료 시각: **2026-10-15T12:24:39.927189Z** (요약 댓글 'Completed' 원문). 결과 리뷰 제출 12:24:36Z, 인라인 댓글 작성 12:24:37Z, 요약 댓글 갱신 12:24:40Z.
- 소요: 요청 → 완료 약 2분 38.9초, 시작 → 완료 약 2분 25.3초. 2시간 시한(2026-10-15T14:22:01Z) 안에 응답이 왔으므로 무응답 규칙 해당 없음.
- 결과 리뷰 ID: **PR review `5533027872`** (state `COMMENTED`, `commit_id` `bdefa3f8c681d887606342ab54bbb581be908a32`, 제출 2026-10-15T12:24:36Z). 결과 링크: <https://github.com/hkd620-lab/haru2026/pull/270#pullrequestreview-5533027872>
- 별도 inline 지적: **있음** — 리뷰 스레드 2개(`PRRT_kwDORWOKJc6sxEuv`, `PRRT_kwDORWOKJc6sxEu6`), 모두 미해결·최신(outdated 아님). 별도 결과 일반 댓글은 없다(Codex는 이번에 지적을 리뷰로 남겼다).
- 완료 요약 원문: <https://github.com/hkd620-lab/haru2026/pull/270#issuecomment-6072159314> — Codex가 실행마다 같은 요약 댓글을 갱신하므로 이 댓글의 현재 값은 실행 4다. 실행 3 시점 본문은 `2026-10-15-pr270-codex-run3-index.md`(`26f0ffdb`), 실행 2 시점은 `2026-10-15-pr270-codex-run2-index.md`(`1d5aeaad`), 실행 1 시점은 `2026-10-15-pr270-prior-reviews-check.md`(`0984dc9e`)에 사본이 있다.
- 원문 판정: 리뷰 본문 "💡 Codex Review — Here are some automated review suggestions for this pull request." (제안 있음, "Didn't find any major issues"가 아님)
- 검토 커밋: `bdefa3f8c6`(리뷰 본문 표시), `bdefa3f`(요약), 리뷰 `commit_id` 전체 SHA — 모두 요청 대상 및 최신 HEAD `bdefa3f8c681d887606342ab54bbb581be908a32`와 **일치**한다.

## 지적

| 번호 | 심각도 | 제목 | 위치(`frontend/src/app/utils/assistantRecommendations.ts`, `bdefa3f8`) | 원문 댓글 링크 | 스레드 상태 | 반영 커밋 |
|---|---|---|---|---|---|---|
| 1 | **P2** (Codex 배지·본문: "병합 전에 수정할 P2") | 맛 표현인 `고소했다`를 법률 변형에서 제외하세요 | 184행 `고소: ['고소장', '고소했다'],` | <https://github.com/hkd620-lab/haru2026/pull/270#discussion_r4282906294> (댓글 ID `4282906294`) | 미해결 | **없음 — 이번 단계 지시(수정하지 말고 보고 후 정지)에 따라 수정하지 않음** |
| 2 | **P3** (Codex 배지·본문: "병합을 막을 P1/P2보다는 선택 P3") | 일상적인 `합의했다`의 오탐 위험을 명시적으로 처리하세요 | 183행 `합의: ['합의서', '합의했다'],` | <https://github.com/hkd620-lab/haru2026/pull/270#discussion_r4282906305> (댓글 ID `4282906305`) | 미해결 | **없음 — 이번 단계 지시에 따라 수정하지 않음** |

두 지적의 위치는 CC가 `git show bdefa3f8:…assistantRecommendations.ts`로 확인했다(183행 = `합의` 항목, 184행 = `고소` 항목).

## 질문별 Codex 답 (요청 질문 (1)·(2)와 대조)

- **질문 (2)** — 이번 diff가 새로 만든 두 오탐의 심각도와 최소 대응안:
  - `참기름 냄새가 고소했다` → 하루LAW: **P2, 병합 전에 수정할 것**으로 판정. 최소 대응은 **닫힌 목록에서 `고소했다`만 제외**(문맥 예외는 비권장, 이유: 낱말 경계로 구분할 수 없는 동형어 오탐이고 사용자에게 명백히 무관한 고위험 분야를 추천함).
  - `회의에서 일정에 합의했다` → 하루LAW: **선택 P3**(병합을 막을 P1/P2가 아님, 이유: 기존 기본 키워드 `합의`도 같은 의미 범위를 의도적으로 포함). 정확도를 우선하면 **`합의했다`만 제외**가 최소 코드 대응이고, 현재 사례를 허용하기로 하면 문맥 예외를 이번 패치에 넣지 말고 **알려진 위험으로 후속 기록**하면 충분.
- **질문 (1)** — 22개의 기존 키워드 연결, 닫힌 목록·낱말 경계·기존 오탐 차단·P2-1/P2-2·점수 정책: Codex는 항목별로 답하지 않았다. 리뷰에는 위 두 건만 있고 다른 지적은 없다. 지적이 없다는 것이 이 항목을 확인했다는 뜻인지는 알 수 없으므로 증명으로 읽지 않는다.

## 읽을 때의 제한

- 심각도 P2·P3는 Codex의 판정이며 CC나 독립 Claude의 판정이 아니다. 이번 단계에서 독립 Claude 재검토는 요청하지 않았다.
- **미해결 P2 지적이 있으므로 정책 8.1 판정①의 조건(Codex 지적이 모두 해결됨)은 충족되지 않는다.** 해결은 수정 커밋 또는 CC의 반박을 독립 검토자가 수용한 경우만이며 스레드를 resolve하는 것만으로는 해결이 아니다. 이 결과는 승인이 아니다.
- 전체 PR 판정은 "수정 후 승인 유지, 누적 1회"에서 변동 없다(독립 1회차 1회, 2·3회차는 항목 판정). 이번 단계에서는 수정·재검토·병합·배포를 하지 않았다. 수정이 이뤄지면 새 HEAD에 대한 Codex·독립 재검토가 필요하다.

## CC가 확인한 사실 (실행)

- `git diff --name-status 84363132c2a01dd9790ca410f6f63e90deafe57d..bdefa3f8c681d887606342ab54bbb581be908a32` → `M frontend/src/app/utils/assistantRecommendations.ts`, `M frontend/test/assistantRecommendations.test.mjs` 두 줄 (`git diff --shortstat`: 2 files, +65 −1). 기능 파일이 바뀌었으므로 검토 대상 기능 HEAD는 `bdefa3f8`이다.
- 최신 HEAD CI: `build_and_preview` 실행 38733077239 (job 116415413344, 2026-10-15T12:14:00Z~12:15:59Z) success, `Deploy Preview` (12:15:42Z~12:15:57Z) success.
- 결과 확인 시점(2026-10-15T12:25Z)에 PR head는 `bdefa3f8`, main은 `69c371cc`로 변동 없음. PR 리뷰는 이 1건뿐이고 리뷰 스레드는 2개(둘 다 미해결)다.
- 이 색인 파일은 증거 브랜치 `claude/elegant-noether-z5zy29`에 새 파일로만 추가된다(PR #270 브랜치와 main은 건드리지 않음). 이 브랜치는 오래된 앱 코드를 포함하므로 main에 병합하지 않는다.

## 원문 사본 (GitHub에서 그대로 옮김, 기준은 GitHub 댓글·리뷰)

### 요청 댓글 6191928586 (hkd620-lab, 작성 2026-10-15T12:22:01Z, 수정 없음)

```
@codex review

재검토 대상 HEAD: bdefa3f8c681d887606342ab54bbb581be908a32
이번 단계는 P2-3(상위 빈도 합성어·한자어 활용형 22개) 보완만 검토합니다. 변경 범위: 84363132..bdefa3f8의 assistantRecommendations.ts `KEYWORD_VARIANTS`(기존 `보증금` 항목 1줄 확장 + 새 키 11개로 22개 추가)와 신규 테스트 3건(2파일 +65/-1). 허대표님이 가성비를 고려해 한 가지씩 진행하도록 지시했고, 이번 Codex 재검토 요청도 허대표님이 승인했습니다.

이전 판정과 반영 내역:
- 독립 Claude 1회차 원문(P2-3 최소수정안 22개 포함, 수정 후 승인, 누적 1회): https://github.com/hkd620-lab/haru2026/blob/0984dc9e/docs/reviews/2026-10-15-pr270-claude-independent-1-result.md
- 독립 Claude 2회차 원문(P2-1 해결, 전체 판정 수정 후 승인 유지): https://github.com/hkd620-lab/haru2026/blob/7882ea3f/docs/reviews/2026-10-15-pr270-claude-independent-2-result.md
- 독립 Claude 3회차 원문(P2-2 해결, 전체 판정 수정 후 승인 유지): https://github.com/hkd620-lab/haru2026/blob/9cf6e05e/docs/reviews/2026-10-15-pr270-claude-independent-3-result.md
- 이번 P2-3 구현·검증(CC 시험 43/43, 더미 환경 빌드 성공, CI·Deploy Preview 통과): https://github.com/hkd620-lab/haru2026/pull/270#issuecomment-6191845117
- 구현 기록: https://github.com/hkd620-lab/haru2026/blob/394d375a/docs/reviews/2026-10-15-pr270-p2-3-implementation.md
- 이전 Codex 결과(실행 3, P2-2 변경 84363132, 주요 지적 없음): https://github.com/hkd620-lab/haru2026/pull/270#issuecomment-6177775420
- 독립 1회차가 권고한 22개: 전세보증금·월세보증금·민사소송·행정소송·형사소송·합의서·고소장·내용증명우편·손해배상청구·고혈압·저혈압·고혈당·저혈당·공복혈당·식후혈당·건강보험료·현금영수증·입금했다·입금되었다·고소했다·고발했다·합의했다

반영: `KEYWORD_VARIANTS`에 위 22개만 닫힌 목록으로 추가했습니다(전세·월세보증금 2개는 기존 `보증금` 항목에 이어 붙이고, 나머지 20개는 새 키 11개 — 소송·합의·고소·고발·내용증명·손해배상·혈압·혈당·건강보험·영수증·입금 — 에 넣었습니다). 정규식·조사 목록(`KOREAN_PARTICLES`)·점수·규칙 분류·P2-1·P2-2는 바꾸지 않았고 한자어+하다/되다 일반화나 목록 밖 확대도 하지 않았습니다. 22개 모두 기준 소스에서 이미 인식되던 형태가 없어 중복 추가는 없습니다.

확인 질문은 두 가지입니다:
(1) 독립 1회차 P2-3 최소수정안 22개가 정확히 기존 법률·건강·재무 키워드에 연결됐고, 닫힌 목록·낱말 경계·기존 오탐 차단·P2-1/P2-2·점수 정책을 깨뜨리지 않는가?
(2) 이번 diff가 새로 만든 아래 두 오탐이 병합 전에 수정해야 하는 P1/P2인지, 선택 P3 또는 허용 위험인지 판정해 주세요. 기준 소스(84363132)에서는 두 문장 모두 추천 없음이었고 CC가 두 소스를 직접 실행해 비교했습니다(검증 출력의 spot-check-output.txt F 그룹).
  - `참기름 냄새가 고소했다` → 하루LAW(고소). `고소했다`는 맛(고소하다)의 뜻에서 명확한 새 오탐입니다.
  - `회의에서 일정에 합의했다` → 하루LAW(합의). 일상 용법의 합의이며, 기본 키워드 `합의`가 이미 같은 성격입니다.
  "주요 문제 없음" 한 줄만이 아니라 가능하면 각각의 심각도와 최소 대응안(해당 변형 제외 / 문맥 예외 / 후속 기록 중 무엇이 적절한지)을 검토해 주세요. 이 요청은 수정 지시가 아니라 리뷰 요청이며, 코드는 수정하지 말고 판정과 최소 대응안만 제시해 주세요.

P2-1·P2-2는 이미 별도 검토를 받았고, 독립 3회차 선택 P3(시험 보강)와 기존 P3(성능·가중치·`고소하고`·약한 단어 정책·`건강검진표`)는 이번에 수정하지 않았습니다. 전체 PR 승인이나 판정①은 요청하지 않습니다. 전체 감사·새 코퍼스·대규모 변이·성능·기존 P3 재조사는 제외하고 diff와 관련 시험에 집중해 주세요.

---
_Generated by [Claude Code](https://claude.ai/code)_
```

### 요약 댓글 6072159314 — 실행 4 중간 상태 (이벤트 알림 사본, 서버 queued 2026-10-15T12:22:18Z)

GitHub 댓글은 완료 시 아래 완료 상태로 덮어써졌다. 숨은 상태 주석의 `&#123;`·`&#125;`는 원문의 HTML 엔티티 표기 그대로다.

```
<!-- codex-pull-request-review-summary -->
<!-- codex-review-state:v1 &#123;"code_review":&#123;"commit_sha":"bdefa3f8c681d887606342ab54bbb581be908a32","has_any_findings":null,"has_unresolved_findings":null,"status":"running"&#125;,"security_review":&#123;"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null&#125;&#125; -->

## Codex Review Summary

This comment shows the latest Codex review activity on this pull request.

| Review | Status | Commit | Review trigger |
| --- | --- | --- | --- |
| 📝 **Code Review** | 🔄 **Running** since <relative-time datetime="2026-10-15T12:22:14.622627Z">2026-10-15T12:22:14.622627Z</relative-time> | `bdefa3f` | Manual request |




<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review" or "@codex security review".

Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.

</details>
```

### 결과 리뷰 5533027872 본문 (chatgpt-codex-connector[bot], 제출 2026-10-15T12:24:36Z, state COMMENTED, commit_id bdefa3f8c681d887606342ab54bbb581be908a32)

```

### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `bdefa3f8c6`
    

<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.




Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".
            
</details>
```

### 인라인 댓글 4282906294 — P2 (chatgpt-codex-connector[bot], 작성 2026-10-15T12:24:37Z, 위치 `assistantRecommendations.ts` 184행)

```
**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  맛 표현인 `고소했다`를 법률 변형에서 제외하세요**

`참기름 냄새가 고소했다`처럼 맛이나 냄새를 설명하는 흔한 입력에서도 새 변형 하나가 강한 법률 키워드 `고소`로 계산되어, 이전에는 없던 하루LAW 카드가 기록 저장 후 표시됩니다. 이는 낱말 경계로 구분할 수 없는 동형어 오탐이므로 문맥 예외를 추가하기보다 이번 닫힌 목록에서 `고소했다`만 제외하는 것이 최소 대응이며, 사용자에게 명백히 무관한 고위험 분야를 추천한다는 점에서 병합 전에 수정할 P2로 판단합니다.

Useful? React with 👍 / 👎.
```

### 인라인 댓글 4282906305 — P3 (chatgpt-codex-connector[bot], 작성 2026-10-15T12:24:37Z, 위치 `assistantRecommendations.ts` 183행)

```
**<sub><sub>![P3 Badge](https://img.shields.io/badge/P3-lightgrey?style=flat)</sub></sub>  일상적인 `합의했다`의 오탐 위험을 명시적으로 처리하세요**

`회의에서 일정에 합의했다`처럼 법적 분쟁과 관계없는 일상적 합의도 이 변형 하나만으로 강한 법률 신호가 되어 하루LAW를 새로 추천합니다. 다만 기존 기본 키워드 `합의`도 같은 의미 범위를 의도적으로 포함하므로 병합을 막을 P1/P2보다는 선택 P3가 적절합니다. 정확도를 우선한다면 `합의했다`만 제외하는 것이 최소 코드 대응이고, 현재 재현 사례를 허용하기로 결정한다면 문맥 예외를 이번 패치에 추가하기보다 알려진 위험으로 후속 기록하는 것으로 충분합니다.

Useful? React with 👍 / 👎.
```

### 요약 댓글 6072159314 — 실행 4 완료 상태 (갱신 2026-10-15T12:24:40Z)

```
<!-- codex-pull-request-review-summary -->

## Codex Review Summary

This comment shows the latest Codex review activity on this pull request.

| Review | Status | Commit | Review trigger |
| --- | --- | --- | --- |
| 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-15T12:24:39.927189Z">2026-10-15T12:24:39.927189Z</relative-time> | `bdefa3f` | Manual request |




<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review" or "@codex security review".

Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.

</details>
```
