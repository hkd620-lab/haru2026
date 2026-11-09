# PR 346 독립 Claude 검토 — 결과 원문

- 질문 원문: `2026-11-06-pr346-claude-07ccc0bc-prompt.md`
- 검토 대상 HEAD: `07ccc0bc`
- 검토자: Opus 5.5 별도 에이전트 (파일 수정·커밋·push·댓글 금지, 읽기 전용)
- 아래는 검토자 보고 원문이다. 요약·수정 없이 옮김.

---

## PR #346 독립 검토 (대상 커밋 07ccc0bc)

**판정: 승인.** 낮음 지적 3건이 있지만 병합을 막지 않습니다. 파일 수정, 커밋, push, PR 댓글은 하지 않았습니다.

### 근거

**1. 범위**
- `git log --oneline origin/main..07ccc0bc` 결과는 07ccc0bc 커밋 1개입니다.
- `git diff --stat origin/main...07ccc0bc` 결과는 `frontend/src/app/pages/HomePageV2.tsx | 6 +++---`, 1개 파일입니다.
- diff는 정확히 3줄입니다: 배지(1252행), 필요 카드 문구(1267행), 비서 카드 태그(1411행).
- PR 제목·본문·커밋 메시지와 일치합니다. 범위 밖 변경은 없습니다. Firestore·Functions·조회 추가도 없습니다.
- Slack 스레드를 읽었습니다. 기장 의견("'전체 13가지 / 내 비서 n개'처럼 집계 대상을 구분", "미리보기를 유지한다면 '무엇을 도와주는지 보기'가 더 정확")과 PR 내용이 맞습니다.

**2. 배지 식 (07ccc0bc 기준 HomePageV2.tsx)**
- `visibleAgents` (544-548행): `AGENTS`에서 developerOnly(개발자가 아닐 때)와 `HIDDEN_AGENT_LABELS`(22-24행, '나도작가')를 뺀 목록입니다. `isDeveloper`가 바뀔 때만 다시 계산합니다.
  - AGENTS 라벨은 14개입니다. developerOnly가 붙은 비서는 현재 없습니다(AGENTS 블록 grep 결과 0건).
  - 따라서 일반 사용자와 개발자 모두 13입니다. 숨김 비서는 개발자에게도 빠집니다.
- `selectedAgents` (714-718행): 개인화가 로드되기 전에는 `[]`입니다. 로드 뒤에는 `getHomeAssistantSelection`(`utils/homeAssistantSelection.ts:9-20`) 결과입니다. 아직 고르지 않은 사용자는 하루LAW 1개, 고른 사용자는 저장된 목록입니다. 저장 목록은 필터링하지 않습니다.
- `homeAgents` (723-725행):
  - 'my' 보기: `visibleAgents` 중 선택된 것만 남깁니다. 저장 목록에 숨김 비서나 없어진 키가 남아 있어도 숫자에 들어가지 않습니다. 화면 격자(`homeAgents.map`, 1299행)와 같은 배열이라 화면에 보이는 카드 수와 숫자가 항상 같습니다.
  - 'all' 보기: `visibleAgents` 전체입니다.
- 준비중(disabled) 비서는 없습니다. path가 null인 것은 타임라인 하나인데 action이 있습니다.
- `effectivePersonalizationLoaded` (703-705행): 로드가 끝났고 현재 uid와 일치할 때만 true입니다. 비서실 섹션은 `isPersonalizationPending`(708행, **homeViewMode** 기준)일 때 숨겨집니다. 그래서 homeViewMode가 'all'이고 로드 전이면 섹션이 보일 수 있습니다. 이때 배지 식의 로드 조건이 기존 문구 `13가지 비서`로 되돌려 주므로 "내 비서 0개"가 잘못 뜨지 않습니다. 조건이 쓸모 있는 방어입니다.
- 'all' 보기에서는 기존 문구 `13가지 비서`가 나옵니다. 의도와 같습니다.
- **'내 비서 0개'인 경우**: `isMyHaruEmpty`(726행)가 true가 되어 `EmptyMyHaru`(1699-1709행)가 "자주 쓰는 비서를 여기에 담아두세요"를 보여 줍니다. 위의 필요 카드 3개(가계부·LAW·식물탐정 중 내 목록에 없는 것)도 함께 보입니다. "전체 13가지 · 내 비서 0개"와 모순되지 않습니다.

**3. 레이아웃 (코드 기준, 렌더링 확인 못 함)**
- 모바일(≤640px)에서는 페이지 좌우 여백이 12px이고(838행) 다음 설정이 걸립니다(868-873행).
  - `section-head`: `flex-wrap: nowrap`
  - `section-title`: `nowrap`, `flex-shrink: 0`
  - `section-sub`: 숨김
  - `section-badge`: 8px, `nowrap`, `flex-shrink: 0`
- 즉 배지가 줄어들 수도 줄바꿈될 수도 없습니다. 너비가 모자라면 오른쪽으로 넘칩니다.
- 대략 추정한 폭은 아이콘 30 + 제목 약 90 + 간격 12 + 배지 약 120~130 = 약 260px입니다. 320px 화면의 사용 가능 폭 296px 안에 들어갈 것으로 보이지만 **실제 렌더링은 확인하지 못했습니다**.
- 641px 이상에서는 부제(12px, 30자 안팎)가 보이고 배지에 nowrap이 없습니다. 641~820px 근처에서 배지가 두 줄로 접히거나 부제가 줄바꿈될 가능성이 있습니다. 이것도 **확인 못 함**입니다.

**4. 바뀐 문구와 실제 동작**
- 1265행의 필요 카드와 1307행의 비서 카드 모두 `onClick={() => setPreviewAgent(a)}`입니다.
- 1629-1649행의 Dialog가 열리고 다음을 보여 줍니다:
  - 제목(라벨·베타)
  - `HOME_ASSISTANT_NEEDS` 설명과 `sub`
  - "{라벨} 열기" 버튼
  - "+ 내 비서에 담기 / ✓ 내 비서에서 빼기" 버튼
- 바로 이동하지 않고 설명을 먼저 보여 주므로 "무엇을 도와주는지 보기"가 동작과 맞습니다.
- disabled일 때 '준비중'이 나오는 분기는 그대로입니다.

**5. 테스트와 문서 참조**
- `grep -rln "역할 보고 선택하기|무엇을 도와주는지 보기|가지 비서|내 비서 "`를 frontend/src, frontend/test, docs에서 돌렸습니다.
  - 결과는 HomePageV2.tsx 자신과, 이 PR의 검토 질문 문서(`docs/reviews/2026-11-06-pr346-claude-07ccc0bc-prompt.md`)뿐입니다.
  - 나머지 두 건은 우연히 겹친 문자열이었습니다: `homeAssistantSelection.test.mjs:35` 테스트 이름, `docs/reviews/home-first-use-validation-20261105.md:33`. 둘 다 바뀐 문구를 검사하지 않습니다.
- HomePageV2.tsx를 읽는 테스트를 직접 실행했습니다(frontend 폴더).
  - 통과(ℹ pass/fail 결과 그대로):
    - loginPerformanceCallsites 1/0
    - authCallbackAndHomePersonalization 1/0
    - haruLawEntry 5/0
    - assistantEntryScroll 1/0
    - snsStoryCreator 1/0
    - homeAssistantSelection 5/0
  - 실패: `devConsoleCleanup.test.mjs`
    - `--import tsx`로 실행하면 pass 9 / fail 1입니다. 실패는 129행 "홈 카드의 형식이 기록 화면의 작성 모달까지 전달된다"입니다.
    - tsx 없이 실행하면 모듈 해석 오류로 파일 전체가 실패합니다.
    - 기존 실패입니다. 검사하는 문자열 `navigate('/record', { state: { format: r.format, from: '/v2' } })`는 `git show origin/main:...`과 `07ccc0bc:...` 모두에서 0건입니다. 이 PR과 무관합니다.
  - `frontend/test/home-assistants-browser/`의 README와 mock에도 바뀐 문구 참조는 없습니다.
- `npm run build`는 실행하지 않았습니다(확인 못 함).

### 지적 사항
1. **낮음**, 873행 / 1252행: 모바일 배지가 `nowrap`·`flex-shrink:0`이라 문자열이 길어진 만큼 가로로 넘칠 수 있습니다. 추정상 320px에서도 들어가지만 렌더링으로 확인하지 못했습니다. 320px·390px, 그리고 두 자리 수 "내 비서 13개"(전체 담기) 상태에서 눈으로 확인할 것을 권합니다.
2. **낮음**, 1252행: 한 배지 안에서 단위가 섞입니다("13가지"와 "M개"). 기장 제안 문구와 같고 오류는 아닙니다. 문구 취향의 문제입니다.
3. **낮음**, 1411행: 미리보기에는 "내 비서에 담기"도 있는데, 새 문구는 '보기'만 말합니다. 동작과 어긋나지는 않습니다. 영문 폰트, 대문자 변환, letter-spacing 0.14em인 9px 태그에서 길이가 2자 늘었습니다. 렌더링은 확인 못 함입니다.

### 확인 못 한 것
- 실제 화면 렌더링(모바일·태블릿 폭의 배지 한 줄 여부)
- `npm run build`
- 프리뷰 채널에서 로그인한 상태의 화면
- Codex 리뷰와 CI 결과

---

## CC 메모 (검토자 보고가 아님)

- CC가 직접 확인: `HomePageV2.tsx`에서 `developerOnly`는 타입 선언(38·50행)과 필터(541·546행)에만 나오고 `AGENTS` 항목에는 쓰이지 않음. `AGENTS` 라벨 14개, 숨김 `나도작가` 1개 → 13. 검토자 설명과 일치.
- `npm run build`는 CC가 가짜 환경값으로 임시 폴더에 실행해 통과(검토자는 실행하지 않음). 새 문구가 번들에 포함됨을 확인.
- 지적 1의 모바일 배지 폭, 지적 3의 태그 폭은 CC도 렌더링을 확인하지 못함.
