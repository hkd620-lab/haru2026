# 독립 Claude 설계·완료 검토 1회차 — 질문 원문 (PR #270, HEAD 1dacf47c)

- 실행: 독립 Claude 검토 1회차. 이 PR의 첫 독립 검토이며 이전 CC·독립 Claude 검토 원문은 없다(`2026-10-15-pr270-prior-reviews-check.md`). 같은 건의 "수정 후 승인" 누적은 이 요청 시점에 0회다.
- 요청 시각(UTC): 2026-10-14T15:36:17Z (한국시간 2026-10-15 00:36:17)
- 검토 대상 HEAD: PR #270 작업 브랜치 `codex-assistant-recommendation-accuracy` `1dacf47c861538136b847254cbfb9f3c58ff55a0`(기능 검토 HEAD `cf390deae921782e00d0d11ff27b331d3a57ce91`), 최신 main `69c371cce46f39f8720283167c037d099fede7af`, PR 기준 main `4db3ce792da0a40678bd35afce8be74b696f1e9f`
- 검토자: 작업 맥락을 공유하지 않은 별도 에이전트(읽기 전용). 모델은 임의로 바꾸지 않고 CC 세션의 기본 설정을 그대로 썼다.
- 에이전트에게 준 실제 프롬프트는 아래 "에이전트 프롬프트"의 짧은 안내문이고, 질문 전문은 그 안내문이 가리키는 파일이다. 아래 "질문 원문"은 그 파일 전체를 요약·수정 없이 그대로 보존한 것이다.
- 질문에는 CC의 의견·검증 결과·지적을 넣지 않았다. 전달한 것은 저장소·PR·요구와 근거 링크, 이전 검토 원문 확인 결과, Codex 실행 1 원문, 대표님 프리뷰 확인 원문뿐이다.
- 이후 마무리 요청(2026-10-14T15:56:47Z)은 `2026-10-15-pr270-followup-instruction-and-wrapup-request.md`에 있다.

## 에이전트 프롬프트 (원문)

```
PR #270 독립 설계·완료 검토(독립 Claude 1회차)를 맡아 주세요. 검토 질문 전문은 아래 파일에 있습니다. 먼저 Read 도구로 이 파일을 끝까지 읽고, 그 안의 지시(읽기 전용 제약, 금지 사항, 검토 질문 7개, 산출 형식)를 그대로 따르세요.

파일: /tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad/pr270-indep-request-body.md

작업 폴더 루트(/home/user/haru2026)에는 어떤 파일도 만들지 마세요. 임시 파일은 직접 만든 worktree 또는 scratchpad 아래 새 폴더에만 두세요. 최종 보고는 파일 5절의 산출 형식(한국어)으로 작성하세요.
```

## 질문 원문

PR #270 독립 설계·완료 검토를 요청합니다(독립 Claude 1회차). 이 파일 전체가 검토 질문입니다. 읽기 전용이며 파일 수정·commit·push·PR 댓글·Slack 게시·병합·배포는 하지 마세요. 포트 18762 사용과 가상사용자 하네스 실행, 외부 AI 호출, 저장소 읽기용 git fetch 외의 네트워크 호출, 운영 데이터 접근도 금지입니다. 임시 파일은 직접 만든 worktree 또는 scratchpad(/tmp/claude-0/-home-user-haru2026/62ae6786-c6c7-5992-9954-12c1a12b54bd/scratchpad/ 아래 새 폴더) 안에만 두고, 작업 폴더 루트(/home/user/haru2026)에는 어떤 파일도 만들지 마세요. 모델은 임의로 바꾸지 마세요.

## 1. 대상

- PR: https://github.com/hkd620-lab/haru2026/pull/270 (초안, OPEN) — "fix: AI 비서 추천의 키워드 오탐과 순위 개선"
- 최신 HEAD: `1dacf47c861538136b847254cbfb9f3c58ff55a0` (작업 브랜치 `codex-assistant-recommendation-accuracy`)
- 기능 검토 HEAD: `cf390deae921782e00d0d11ff27b331d3a57ce91`. 그 뒤 2커밋(`f664640f`, `1dacf47c`)은 `docs/reviews/` 새 파일 추가(A) 2개뿐입니다(CC가 `git diff --name-status cf390dea..1dacf47c`로 확인).
- 최신 main: `69c371cce46f39f8720283167c037d099fede7af`. 이 PR의 기준(merge-base) main은 `4db3ce792da0a40678bd35afce8be74b696f1e9f`입니다. 그 뒤 main에 PR #271·#272(보조장부 F-13~F-19)가 병합됐습니다.
- 가져오기: `git fetch origin pull/270/head:refs/review/pr270-indep` 와 `git fetch origin main`. 기존 `refs/review/pr270` 는 옮기지 마세요. 코드를 실행하려면 새 worktree를 만들어 쓰세요(예: `git worktree add --detach <scratchpad 아래 새 폴더> refs/review/pr270-indep`). CC의 worktree(`cc-270`, `cc-270-main`, `cc-270-merge` 등)는 읽지도 건드리지도 마세요. `frontend/node_modules`는 `/home/user/haru2026/frontend/node_modules`를 읽기 전용으로 심볼릭 링크해 쓰되 `npm install`·`npm ci`는 하지 마세요.
- **실제 PR diff는 반드시 `main...HEAD`(삼중점)로 보세요**: `git diff origin/main...refs/review/pr270-indep`. `main..HEAD` 직접 비교는 PR 이후 병합된 F-13~F-19를 이 PR이 삭제하는 것처럼 보이지만 사실이 아닙니다. 기존 main을 되돌리는 변경은 없어야 합니다.
- PR 본문·댓글은 GitHub MCP 도구(ToolSearch로 `select:mcp__github__pull_request_read` 등을 불러와 사용)로 읽을 수 있습니다. 본문과 로그의 주장(예: "34개 통과", 수정 전·후 표)은 검증할 대상이지 근거가 아닙니다.

## 2. 요구 (허대표님 지시 원문)

추천 약한 키워드 단독 후보 차단, 낱말 경계·조사·합성어, 강3/약1 점수·동점 형식 우선순위, 최대2장·1위 절반 기준, 기존 함수/비서 id/연결 경로/FORMAT_PRIORITY·ALIASES 보존이 요구입니다.

이 작업(④ AI 비서 추천 정확도 개선, 허대표님 2026-10-09 승인)의 근거 문서입니다. 동작 요건 6개, 합격 기준 표 13행, 고칠 범위·바꾸지 않는 것, "글자 그대로 검사되는 부분(`formatRegistry.test.mjs`)"이 2-1절에 있습니다.
- 증거 브랜치 문서(읽기 전용 근거): https://github.com/hkd620-lab/haru2026/blob/e06e6210/frontend/test/persona-sim/handoff/2026-10-08-codex.md (2-1절 "작업 ④")
- 후속 인수인계: https://github.com/hkd620-lab/haru2026/blob/e06e6210/frontend/test/persona-sim/handoff/2026-10-09-pr270.md
- 그 브랜치(`claude/elegant-noether-z5zy29`)의 앱 코드는 오래되었고 검토 대상이 아닙니다. 위 두 문서만 근거로 읽고, `docs/reviews/` 아래 다른 파일(다른 PR의 기록 포함)은 읽을 필요가 없습니다.

## 3. 이전 검토 원문

CC가 이 PR에 대해 이전 CC 검토·독립 Claude 검토 원문이 있는지 확인했습니다. 확인한 곳: PR 댓글 4개, PR 리뷰·리뷰 스레드(0건), Slack 개발 스레드(1791469123.725619의 답글 29개 전체), Slack 감사 채널 검색, 저장소 `docs/reviews/`(증거 브랜치·PR 브랜치·main). **이 PR의 이전 CC 검토나 독립 Claude 검토 원문은 없습니다.** Slack 기록에는 "독립 Claude 검토 대기"·"CC 검토 미실행"으로 적혀 있습니다. 따라서 이번이 독립 검토 1회차입니다(같은 건의 "수정 후 승인" 누적 0회). 아래는 이 PR에서 있었던 다른 검토·확인의 원문입니다.

### 3-1. Codex 실행 1 (자동 리뷰어, OpenAI 계열)
- 요청 댓글(질문 원문): https://github.com/hkd620-lab/haru2026/pull/270#issuecomment-6072094831 (2026-10-09T01:00:33Z, 작성자 hkd620-lab = 기장 계정)

```
@codex review

검토 대상 HEAD: cf390deae921782e00d0d11ff27b331d3a57ce91

인수인계 작업 ④(허대표님 2026-10-09 승인)입니다. 법률 메모에서 하루LAW만 추천하는지, 약한 단어 단독 후보 차단, 한글 낱말 경계와 조사·명시적 활용형, 점수 우선·형식 동점 기준, 카드 2장·절반 기준, 5개 표시 전 전체 점수, 기존 FORMAT_PRIORITY·FORMAT_ALIASES 계약 유지와 회귀를 검토해 주세요. 신규 27+기존 7 테스트와 frontend 빌드가 로컬에서 통과했습니다. 이전 리뷰는 없습니다. 초안 PR 상태에서 요청하며 대표님 확인 전 병합하지 않습니다.
```

- 결과 댓글: https://github.com/hkd620-lab/haru2026/pull/270#issuecomment-6072158788 (2026-10-09T01:06:39Z, chatgpt-codex-connector[bot])

```
Codex Review: Didn't find any major issues. Keep it up!

**Reviewed commit:** `cf390deae9`
```
(뒤에 오는 "About Codex in GitHub" 안내문은 표준 문구라 생략했습니다. 전체 원문은 위 링크에 있습니다.)

- 완료 요약 댓글: https://github.com/hkd620-lab/haru2026/pull/270#issuecomment-6072159314 — 상태 Completed, 시각 `2026-10-09T01:06:41.380512Z`, 커밋 `cf390de`, 트리거 Manual request.
- PR 브랜치의 색인: `docs/reviews/2026-10-09-pr270-codex-run1-request.md`, `docs/reviews/2026-10-09-pr270-codex-run1-result.md` (PR 브랜치 안에 있습니다).
- CI: `build_and_preview` 실행 37868688147(job 113621446927) success, `Deploy Preview` success (최신 HEAD 기준).

### 3-2. 허대표님 프리뷰 화면 확인 (Slack 기록, 원문)
Slack 개발 스레드 https://harulab-hq.slack.com/archives/C0C11P98MHV/p1791516011708289?thread_ts=1791469123.725619&cid=C0C11P98MHV (2026-10-09 12:20:11 KST, 기장이 기록)

```
[④ PR #270 — 대표님 프리뷰 화면 확인]
• 확인 근거: 허대표님이 제공한 2026-10-09 12:19:38 스크린샷. PR #270 프리뷰 /sayu의 기존 10월9일 메모 상세 화면.
• 확인 결과: ‘이 기록과 연결 가능한 AI 비서’ 영역에 하루LAW 1장만 표시. 생활·육아 비서 카드 없음. 지정한 프리뷰 확인 기준 충족.
• 기준 HEAD: 1dacf47c. Codex 주요 지적 없음·최종 CI/프리뷰 성공은 직전 확인 상태.
• 확인 범위: 추천 카드 표시만. 연결 버튼·AI 호출·추가 저장 동작은 이번 화면으로 검증하지 않음.
• 남은 일: 독립 Claude 검토 미완료. 화면 확인을 병합 승인으로 해석하지 않음. 병합·운영 배포 없음.
```

이 확인은 카드 표시만 본 것이며 연결·AI 호출·저장·병합 승인이 아닙니다.

## 4. 검토 질문

아래를 직접 실행·확인하고, **실행으로 확인한 것과 코드를 읽고 추정한 것을 구분**해 주세요.

1. **판정**: "승인" / "수정 후 승인" / "재설계" 중 하나와 이유.
2. **규모와 멈춤 조건**: 작업 규모(소·중·대)와 정책 8.1 멈춤 조건 해당 여부를 근거와 함께 판단하세요. 멈춤 조건은 홈화면·라우터 파일 변경, 저장 경로 변경·마이그레이션, 운영 데이터 삭제·변경, 결제·인증 정책 변경, Firestore·Storage Rules 변경, 새 AI 호출·모델·호출량 등 비용 증가 변경, 모델 다운그레이드·교체, 커밋 메시지와 실제 변경 불일치, 대규모 작업(새 기능·라우터), 실기기 운영 E2E가 완료 조건인 작업의 "운영 완료" 판정입니다(정책 본문: https://github.com/hkd620-lab/haru2026/blob/main/docs/HARU2026_Slack_운영정책.md 8.1절).
3. **요구 충족**: 2절 요구와 근거 문서의 동작 요건 6개를 항목별 표로(약한 단어 단독 후보 차단 / 낱말 경계·조사·합성어 / 강3·약1 점수 / 동점 형식 우선순위 / 최대 2장 / 1위 절반 기준과 경계값 포함 여부 / 기존 함수·비서 id·제목·연결 경로·FORMAT_PRIORITY·FORMAT_ALIASES·안내문 보존 / matchedKeywords 강한 단어 우선·최대 5개 / 결정성). 합격 기준 13행은 실제 함수를 실행해 확인하세요.
4. **회귀**: (a) 최신 main에 PR을 직접 병합해 본 별도 worktree에서 충돌 여부, PR 이후 main에 들어간 F-13~F-19(보조장부 엑셀·집계 정합: `ledgerExportService.ts`, `FormatModal.tsx`, ledger 시험)가 보존되는지, (b) 변경 파일이 PR의 4개 파일뿐이고 main을 되돌리지 않는지, (c) 호출처(`RecordPage.tsx`·`SayuPage.tsx` 및 `getAssistantRecommendations`를 쓰는 모든 곳)와 `matchedKeywords` 표시에 미치는 영향, (d) 기존 시험·타입(`tsc --noEmit`)·빌드(`npm run build`, 필요하면 더미 `VITE_FIREBASE_*`·`VITE_AI_LIBRARY_FIREBASE_*` 값 사용)가 병합 전후 같은지.
5. **추천 누락(미탐)과 오탐**: 수정 전(main)과 수정 후 함수를 같은 입력으로 직접 실행해 비교하고, 현실적인 한국어 기록에서 (가) 이제 놓치는 경우(조사·활용형·합성어·띄어쓰기 등)와 (나) 여전히 잘못 뜨는 경우를 구체적 예시로 제시하세요. 각 예시에 심각도(P1/P2/P3)와 "이 PR에서 고쳐야 하는지 / 후속으로 미뤄도 되는지"를 적으세요. 이 PR이 문서로 인정한 한계(미등록 합성어·활용형을 놓침, F-10 교사·학부모 맥락 구분 불가)와 그 밖의 한계를 구분하세요.
6. **코드 품질·성능·호환성**: 키워드마다 정규식을 새로 만드는 비용, ReDoS 위험, 대상 브라우저 지원(`frontend/vite.config.ts`의 legacy 타깃과 `\p{L}`·`u` 플래그·lookahead 사용), 유니코드 정규화(NFC)와 대소문자, 정렬 안정성·결정성, 테스트가 요구를 실제로 고정하는지(변이 시험은 복사본에서만, 원본 수정 금지).
7. **새 지적은 고치지 말고 구체적인 수정 필요사항**(파일·위치·최소 수정안)으로 제시하세요. 수정 필요가 없는 의견은 "선택"으로 분리하세요.

## 5. 산출 형식 (한국어, 간결하게)

`## 검토 결과: PR #270 (HEAD 1dacf47c)` 아래에 1. 판정 / 2. 규모와 8.1 멈춤 조건 / 3. 요구별 충족 표 / 4. 회귀 / 5. 추천 누락·오탐 / 6. 새 지적(P1~P3, 수정 필요 여부) / 7. 미확인과 실행 요약 순서로 적어 주세요. 이 보고는 CC가 요약·수정 없이 원문 그대로 저장소 `docs/reviews/`에 보존합니다. 끝나면 임시 worktree를 정리하고 작업 폴더에 파일이 남지 않았는지 `git status --short`로 확인해 보고에 적어 주세요.
