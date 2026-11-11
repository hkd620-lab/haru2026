# PR #373 독립 Claude 검토 2차 — 원문

- 실행: 2026-11-11 (KST 14:35경 요청, 14:37경 완료)
- 검토 대상: 코드 HEAD `870d471bb66a5e7818499f1de07c7650edc16724`, PR HEAD `2ff1e178a461d3ecd5f1139eeae0a7dc51c253fc` (docs/reviews 추가만), base `45d4f3b7`
- 검토자: CC가 작업 맥락을 넘기지 않고 띄운 별도 에이전트 (읽기 전용). 1차 원문(`2026-11-11-pr373-claude-independent-1.md`)과 CC 반영 내역을 함께 전달
- 판정 원문: **판정: 수정 후 승인** (같은 건 2회째)

## 질문 원문

```
You are an independent code reviewer for the HARU2026 web app (repo checkout: /Users/heogyeongdae/Developer/HARU2026, GitHub hkd620-lab/haru2026). Read-only: do NOT modify files, commit, push, comment on GitHub, or post to Slack.

This is the 2nd review of PR #373. Code HEAD to review: 870d471bb66a5e7818499f1de07c7650edc16724; final PR HEAD 2ff1e178a461d3ecd5f1139eeae0a7dc51c253fc (adds only a docs/reviews file). Base main 45d4f3b7. Fetch: `git fetch -q origin codex-web-public-a11y-fixes-20261111`. Read files via `git show <sha>:<path>`; the local working tree is a different branch.

The previous (1st) review verdict and full text is in the repo at `git show 2ff1e178:docs/reviews/2026-11-11-pr373-claude-independent-1.md` — read it in full. Its verdict was "판정: 수정 후 승인".

The executor (CC) says it applied, in commit 870d471b (see `git show 870d471b`):
- finding 2: Privacy/BusinessInfo/Terms close button → `navigate(user ? '/settings' : '/')` (adds useAuth import)
- finding 7: BottomNav active item gets `aria-current='page'` and fontWeight 700
- finding 6: Naver button color reverted from #00783A to the original #03A94D pending brand-guide check
- finding 8: added a light border to `.lp-plan--hl .lp-btn--primary`
- finding 3 (return to original page after login) left out of scope as it never existed; finding 5 (SinglePaymentPage reviewer sentence) left out of scope.
- Owner decision (허대표님, 2026-11-11, in the CC conversation: "승인함"): allows the App.tsx router change (SignedInRoute for /sayu and /settings) and keeps the deletion of the reviewer ("심사자") sentence on the subscription page.

Also check: full diff `git diff 45d4f3b7 870d471b`, and `git diff --name-status 870d471b 2ff1e178` (must show only A docs/reviews/...). Verify the fixes are correct, introduce no regressions (e.g. are these pages inside AuthProvider? do they crash during auth loading?), and whether any remaining issue blocks approval. Read CLAUDE.md and docs/HARU2026_Slack_운영정책.md 8.1 for rules; state 규모 and whether remaining 멈춤 조건 are covered by the stated owner decision.

Reply in Korean. First line exactly one of "판정: 승인" / "판정: 수정 후 승인" / "판정: 재설계", then numbered findings with file:line and short excerpts.
```

## 결과 원문

판정: 수정 후 승인

검토 대상: 코드 HEAD 870d471b (base 45d4f3b7). 최종 PR HEAD는 2ff1e178입니다. 파일 수정, 커밋, GitHub 댓글, Slack 게시는 하지 않고 읽기만 했습니다.

`git diff --name-status 870d471b 2ff1e178` 결과는 아래 한 줄뿐입니다. 8.1의 검토 기록 전용 커밋 예외에 해당합니다.
```
A	docs/reviews/2026-11-11-pr373-claude-independent-1.md
```

**지적 사항**

1. **[막는 문제, 반드시 수정] TermsPage.tsx:2,126 · PrivacyPage.tsx:80,84 — `/terms`, `/privacy` 화면이 바로 깨집니다(흰 화면).**
   ```tsx
   import { useAuth } from '../contexts/AuthContext';
   ...
   const { user } = useAuth();
   ```
   - 두 화면은 App.tsx의 `<Route>`로 그려지지 않습니다. `PublicLegalBoundary`가 **AuthProvider 바깥**에서 먼저 그립니다.
     - App.tsx:330-338: `<PublicLegalBoundary><AuthProvider>…`
     - PublicLegalBoundary.tsx:11-17: 경로가 `/terms`·`/privacy`이면 `children`(AuthProvider)을 그리지 않고 TermsPage/PrivacyPage만 그립니다.
     - 이 구조는 d54832d3("keep legal documents readable before consent")에서 일부러 만든 것입니다. 동의 전이나 계정 복구 중에도 약관을 읽을 수 있게 하려는 목적입니다.
   - `useAuth()`는 Provider가 없으면 예외를 던집니다(AuthContext.tsx:900-905: `throw new Error('useAuth must be used within an AuthProvider')`). main.tsx와 App.tsx에는 ErrorBoundary가 없습니다.
   - 결과적으로 로그인 여부와 관계없이 `/terms`·`/privacy`에 들어가는 순간 화면 전체가 하얗게 멈춥니다. 막히는 곳은 다음과 같습니다.
     - 결제 심사자가 보는 공개 약관
     - 가입 동의 화면의 약관 링크
     - 푸터 링크
   - 기존 테스트 `tests/public-legal-boundary.test.cjs`는 Provider 없이 `renderToString`으로 이 화면을 그립니다. 그래서 이 커밋에서는 실패할 것으로 판단됩니다. 실행은 하지 않았고 코드만 읽고 판단했습니다. 이 테스트는 CI·npm 스크립트에 연결돼 있지 않아 빌드 통과만으로는 드러나지 않습니다.
   - 수정 제안:
     - 두 화면에서 `useAuth`를 쓰지 말고, 누르는 순간 Firebase 로그인 상태를 읽습니다.
       ```tsx
       import { auth } from '../config/firebase';
       onClick={() => navigate(auth.currentUser ? '/settings' : '/')}
       ```
     - 또는 `navigate(-1)`에 `/` 대체 경로를 붙이는 방식도 됩니다.
     - 수정 뒤 `node --test tests/public-legal-boundary.test.cjs`를 실행해 PR에 로그를 첨부합니다.

2. **BusinessInfoPage.tsx:2,8,40 — 이 화면의 수정은 맞습니다.**
   - `/business-info`는 PublicLegalBoundary 대상이 아니고 AuthProvider 안의 App.tsx:309 라우트로 그려지므로 `useAuth` 사용에 문제가 없습니다.
   - 인증을 불러오는 중에 `user`가 잠깐 null이면 로그인 사용자가 `/`로 갈 수 있습니다. 홈으로 가는 것이라 문제는 아닙니다.
   - 다만 1번을 고칠 때 세 화면을 같은 방식(`auth.currentUser`)으로 맞추는 편이 일관됩니다.

3. **BottomNav.tsx:61,65 — 7번 반영이 맞습니다.**
   ```tsx
   aria-current={isActive ? 'page' : undefined}
   fontWeight: isActive ? 700 : 400,
   ```
   - 글자 `<span>`에는 따로 font-weight 클래스가 없어 굵기가 그대로 이어받아집니다.
   - 색 외의 구분(굵기, 아이콘 선 두께, aria-current)이 생겨 WCAG 1.4.1 우려가 해소됐습니다.

4. **LoginPage.tsx:297 — 6번 반영(`#03A94D` 원복)이 맞습니다.** 바뀌기 전 base와 같은 색으로 돌아갔고, 브랜드 문제는 생기지 않습니다. 흰 글자 대비가 약 3.1:1이라는 접근성 과제는 남지만, 이번 PR 전에도 같던 상태라 퇴행이 아닙니다.

5. **LandingPage.tsx:950 — 8번 반영이 맞습니다.**
   ```css
   .lp-plan--hl .lp-btn--primary{...;border:1px solid rgba(245,240,232,0.7);}
   ```
   - 강조 카드 배경 #4A5A2C 위에서 밝은 테두리가 보여 버튼 윤곽이 다시 구분됩니다.
   - hover 색과 글자 대비는 그대로입니다.

6. **App.tsx:161-166, 227, 231 — SignedInRoute는 1차 검토 결과와 같습니다.** `loading` 동안 null을 반환하고 비로그인이면 `/login`으로 보냅니다. 새 퇴행은 없습니다.

7. **범위 밖으로 둔 항목은 받아들일 수 있습니다.**
   - 3번(로그인 후 원래 화면으로 복귀): 기존에도 없던 기능이므로 퇴행이 아닙니다.
   - 5번(SinglePaymentPage.tsx:284의 심사자 문구): 구독 화면 문구 삭제는 허대표님 결정 범위입니다. 일반결제 화면 문구는 그대로 두는 것으로 이해되며, 후속 정리 과제로 기록하면 충분합니다.

8. **[검증 공백] 화면 동작 테스트가 없습니다.**
   - 1번 같은 런타임 예외는 `npm run build`와 타입 검사로 잡히지 않습니다.
   - 8.1의 "변경 영역 테스트" 항목에는 최소한 `tests/public-legal-boundary.test.cjs` 실행 로그를 포함할 것을 권합니다.
   - Preview에서 비로그인으로 `/terms`·`/privacy`·`/business-info`의 ✕ 동작을 직접 확인해야 합니다.

**규모: 중**
- 여러 컴포넌트를 고치고 라우트 진입 조건을 바꿨습니다. 새 기능이나 라우터 구조 개편은 아닙니다.

**8.1 멈춤 조건**
- (a) 라우터 파일(App.tsx)의 SignedInRoute 변경과 (b) 비로그인 `/sayu`·`/settings` 접근 정책 변경은 해당합니다. 전달받은 허대표님 결정("승인함", 2026-11-11)이 이 변경을 허용한 것으로 보아 해소된 것으로 판단합니다.
- (c) 구독 화면 심사자 문구 삭제도 같은 결정으로 해소된 것으로 봅니다.
- 다만 이 결정은 CC 대화에만 있으므로, 판정 기록(Slack `#haru2026-감사`, docs/reviews)에 원문 인용이나 링크로 남겨야 합니다.
- 이번 870d471b 수정분은 새 멈춤 조건을 만들지 않습니다. 결제 금액·Functions·Firestore 경로·Rules는 바뀌지 않았습니다.
- 이번이 같은 건의 2번째 "수정 후 승인"입니다(상한 3회).

**권장 조치**
1. 1번을 수정합니다(Terms/Privacy에서 `useAuth`를 빼고 `auth.currentUser` 사용, BusinessInfo도 같은 방식으로 통일 권장).
2. `tests/public-legal-boundary.test.cjs` 실행 로그를 PR에 첨부합니다.
3. Codex 재검토를 받고 독립 검토자 3차 재검토를 받습니다.

## CC 실측 보충 (원문과 별도)

- 검토자 1번 판단을 CC가 실행으로 확인: `node --test tests/public-legal-boundary.test.cjs` → base `45d4f3b7` pass 6 / fail 0, `870d471b` 로드 실패(fail 1).
- `auth.currentUser` 안은 `config/firebase`가 테스트 번들(cjs)에서 `import.meta.env`를 읽지 못해 같은 테스트를 깨뜨릴 수 있어, 검토자가 함께 제시한 `navigate(-1)` + `/` 대체 방식을 택함.
