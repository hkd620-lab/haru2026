# PR #373 독립 Claude 검토 1차 — 원문

- 실행: 2026-11-11 (KST 14:25경 요청, 14:28경 완료)
- 검토 대상 HEAD: `c0c7f2db671aa7944a989a83646b47e408a36202` (base `45d4f3b7`)
- 검토자: CC가 작업 맥락을 넘기지 않고 띄운 별도 에이전트 (읽기 전용)
- 판정 원문: **판정: 수정 후 승인**

## 질문 원문

```
You are an independent code reviewer for the HARU2026 web app (repo checkout: /Users/heogyeongdae/Developer/HARU2026, GitHub hkd620-lab/haru2026). Do NOT modify any files, do not commit, push, comment on GitHub, or post to Slack. Read-only.

Review PR #373 ("fix: 공개 웹 화면 인증 표시와 접근성 개선"), head commit c0c7f2db671aa7944a989a83646b47e408a36202, base main 45d4f3b7. Get the diff with: `cd /Users/heogyeongdae/Developer/HARU2026 && git fetch -q origin codex-web-public-a11y-fixes-20261111 && git diff 45d4f3b7 c0c7f2db671aa7944a989a83646b47e408a36202` and `gh pr view 373`. Read surrounding source at that commit with `git show c0c7f2db:<path>` (the local working tree is a different branch; don't rely on it).

Project rules to read first: CLAUDE.md and docs/HARU2026_Slack_운영정책.md section 8.1 (especially "멈춤 조건" — stop conditions requiring the owner's decision, e.g. router/home-screen file changes, auth/payment policy changes).

Check: correctness of the new SignedInRoute guard in App.tsx (loading/redirect behavior, any routes that should or should not be guarded, regressions for logged-in users); the public (logged-out) /subscription pricing card accuracy vs the PLANS definition in SubscriptionPage.tsx and vs LandingPage pricing text; the removal of the sentence telling payment reviewers ("심사자") to log in with a test account; contrast/accessibility color changes (are new colors actually higher contrast on their real backgrounds?); any unintended behavior change. Also state whether the change size is 소/중/대 and whether any 8.1 stop condition applies.

Reply in Korean. Start with one line exactly "판정: 승인" or "판정: 수정 후 승인" or "판정: 재설계", then numbered findings each with file:line and a short code excerpt, then the 규모 and 멈춤 조건 assessment.
```

## 결과 원문

판정: 수정 후 승인

대상: PR #373, head c0c7f2db (base 45d4f3b7, 커밋 3개 c33831dd·986bf018·c0c7f2db, 7개 파일 +61/−39). 읽기만 했습니다. 파일 수정, 커밋, GitHub 댓글, Slack 게시는 하지 않았습니다.

**검토 결과**

1. **App.tsx:161-166, 227, 231 — SignedInRoute 자체는 맞게 동작함.**
   ```tsx
   function SignedInRoute({ children }: { children: ReactNode }) {
     const { user, loading } = useAuth();
     if (loading) return null;
     if (!user) return <Navigate to="/login" replace />;
     return children;
   }
   ```
   - `useAuth().loading`은 AuthContext.tsx:854에서 `loading || (user && currentDocument?.status !== 'ready')`입니다. 로그인한 사용자가 계정 문서를 확인하는 동안 `/login`으로 잘못 보내지지 않습니다. 기존 `HomeOrLanding`, `AiLibraryRoute`와 같은 방식입니다.
   - `/vault`는 `/settings`로 옮겨진 뒤 다시 이 확인을 거칩니다. 문제없습니다.
   - 로그인한 사용자에게는 달라지는 점이 없습니다(로딩 중 빈 화면은 홈과 같은 동작).
   - 참고: 이메일 미인증 비밀번호 계정은 막지 않습니다. 홈은 `EmailVerificationPage`로 보내지만 이 확인은 그렇지 않습니다. 기존과 같아서 퇴행은 아닙니다.
   - 참고: `/record`, `/stats`, `/merge`, `/household` 같은 다른 개인 화면은 여전히 확인 없이 열립니다. 요청 범위가 두 화면이었으니 범위 밖이지만, 기준이 섞여 있다는 점은 기록해 둘 만합니다.

2. **[수정 권장] App.tsx:229 + PrivacyPage.tsx:86 / BusinessInfoPage.tsx:38 — 공개 약관 화면의 ✕ 버튼이 비로그인 방문자를 로그인 화면으로 보냄.**
   ```tsx
   <button onClick={() => navigate('/settings')} ...>✕</button>
   ```
   - 두 화면은 푸터에서 누구나 여는 공개 화면입니다. 결제 심사자도 봅니다.
   - 이번 확인 때문에 비로그인 상태에서 ✕를 누르면 `/settings`를 거쳐 `/login`으로 갑니다. 닫기를 눌렀는데 로그인 화면이 뜹니다.
   - 제안: 비로그인 상태면 `navigate(-1)` 또는 `'/'`로 보냅니다. 예: `navigate(user ? '/settings' : '/')`

3. **[개선 권장] App.tsx:166 — 로그인 후 원래 화면으로 돌아오지 않음.**
   - 확인에 걸린 경로를 기억하지 않습니다. postLoginReturn.ts는 `/ai-import#…` 형식만 허용합니다.
   - 그래서 `/sayu`나 `/settings`로 들어와 로그인하면 항상 `/`로 갑니다.
   - 기존에도 비로그인 화면 자체가 쓸 수 없었으므로 퇴행은 아닙니다. 다만 설명란의 "로그인 이동"은 원래 화면으로 돌아오는 것까지 뜻하지 않는다는 점을 알아 두면 됩니다.

4. **SubscriptionPage.tsx:818-838 — 공개 요금 카드는 PLANS 정의와 정확히 맞음.**
   ```tsx
   {plan.title} · 월 {plan.priceLabel}
   {plan.badge && <span ...>{plan.badge}</span>}
   <p ...>부가세 포함 · {plan.description}</p>
   ```
   - PLANS(83-126)를 그대로 쓰므로 금액이 따로 놀 위험이 없습니다.
     - 베이직: "베이직 · 월 ₩4,000"
     - 프리미엄: "프리미엄 · 월 ₩6,000 예정 준비 중", 설명 "이번 출시에서는 결제되지 않습니다"
   - 랜딩 요금 표기(LandingPage.tsx:114-125, 672, 702)와 금액·준비 중 표기가 일치합니다.
   - 사소한 점:
     - 프리미엄 혜택의 '식물탐정 프리미엄 판정 유지'는 랜딩에 없습니다. 아직 팔지 않는 상품에 "유지"라는 표현이 공개 화면에서는 어색합니다. 기존 로그인 화면과 같은 문구라 막을 사유는 아닙니다.
     - 공개 카드에 환불·해지 안내나 `/refund` 링크가 없습니다. 랜딩 702행에는 있습니다. 결제 심사용 공개 화면이라면 한 줄을 넣는 것을 권장합니다(선택).

5. **[일관성] SubscriptionPage.tsx(삭제)와 SinglePaymentPage.tsx:284(남음) — 심사자 문구 제거가 한쪽에서만 됨.**
   - 구독 화면에서는 "비회원 구매는 제공하지 않습니다. 심사자는 전달받은 테스트 계정으로…"가 지워졌습니다.
   - 일반결제 화면에는 같은 문구가 그대로 있습니다.
   - "비회원 구매 불가"라는 뜻은 구독 화면 867행(로그인 화면)과 새 문구 "구독은 로그인 후 신청할 수 있습니다"에 남아 있어 정책 의미는 유지됩니다.
   - 이 문구는 2026-07-17(f2415418) 결제/약관 정비 때 들어갔습니다. 결제사 심사가 아직 진행 중인지, 심사 대응으로 넣은 문구인지는 허대표님 확인이 필요합니다. 아래 멈춤 조건 참고.

6. **[브랜드 확인 필요] LoginPage.tsx:297 — 네이버 로그인 버튼 색 변경.**
   ```tsx
   backgroundColor: '#00783A',   // 기존 #03A94D
   ```
   - 흰 글자 대비는 3.09에서 5.6:1로 올라갑니다.
   - 하지만 네이버 공식 색 #03C75A(흰 글자 대비 2.25:1)에서 더 멀어집니다. 네이버 로그인 버튼 사용 규칙과 맞지 않을 수 있습니다. 저장소에 docs/naverpay-audit-report.md가 있을 만큼 네이버 심사 이력도 있습니다.
   - 대안: 공식 녹색은 유지하고 버튼을 흰 바탕 + 녹색 로고 + 진한 글자로 바꿉니다. 아니면 공식 가이드 범위를 확인한 뒤 결정합니다.

7. **[접근성 퇴행 우려] BottomNav.tsx:63 — 선택된 메뉴와 나머지 메뉴의 구분이 약해짐.**
   ```tsx
   color: isActive ? '#1A3C6E' : '#595959',
   ```
   - 선택 안 된 메뉴의 흰 바탕 대비는 2.85에서 7.0:1로 좋아졌습니다.
   - 대신 선택된 메뉴(남색 #1A3C6E)와의 명도 차가 약 1.6:1밖에 안 됩니다. 남은 차이는 아이콘 선 두께(2.5 대 2) 정도입니다.
   - 색만으로 상태를 알리는 형태(WCAG 1.4.1)가 되고, `aria-current`도 없습니다.
   - 제안: 선택된 링크에 `aria-current={isActive ? 'page' : undefined}`를 넣고 글자 굵기(font-weight)를 다르게 줍니다.

8. **[디자인 참고] LandingPage.tsx:19, 742, 950 — olive를 진하게 바꾼 영향.**
   ```css
   .lp-plan--hl .lp-btn--primary{background:var(--olive);color:#fff;}
   ```
   - olive를 #7A8B4E에서 #596B36으로 바꾼 결과, 강조 카드(배경 #4A5A2C) 안의 주 버튼과 카드 배경 대비가 2.02에서 1.28:1로 떨어졌습니다. 버튼 윤곽이 거의 보이지 않습니다.
   - 버튼 글자 대비는 5.86:1로 좋습니다.
   - `.lp-plan__badge`, `.lp-trial-badge`에 흰 글자는 3.73에서 5.86:1로 좋아졌습니다.
   - `--accent-active`는 #7A8B4E 그대로라 색 기준이 둘로 나뉘었습니다. 의도인지 확인이 필요합니다.

9. **대비 실측: 나머지 변경은 모두 실제 배경 위에서 대비가 높아짐(WCAG 상대휘도 계산).**

   | 위치 | 배경 | 변경 전 | 변경 후 |
   |---|---|---|---|
   | Footer 글자·링크 #595959 | #fff | — | 7.0 |
   | 뉴스 날짜 #c8bda9 | 머리줄 #171717 | 3.68 | 9.65 |
   | 뉴스 푸터 #625a4d | #f8f5ee | 4.47 | 6.24 |
   | olive 글자 | #F5F0E8 | 3.29 | 5.17 |
   | terracotta | #F5E5DC | 3.72 | 5.75 |
   | fg-2 | #F5F0E8 | 4.36 | 5.80 |
   | muted | #F5F0E8 | 3.18 | 5.10 |
   | 강조 카드 이름 #F4CFB5 | #4A5A2C | 4.2 | 5.18 |
   | 강조 카드 금액 단위·메모 → var(--bg) | #4A5A2C | 3.54 | 6.64 |
   | 첫 사용 안내 설명 | #5C6E36 끝 | 4.03 | 4.95 |
   | 로그인 안내 회색 #595F6A | #fff | 2.54 | 6.42 |
   | 로그인 탭 #555B65 | #fff | 4.83 | 6.84 |

   - 뉴스 날짜는 숫자상 더 밝아졌지만, 실제 배경이 어두운 머리줄이라 맞는 방향입니다.
   - `ph-grid`의 `tabIndex={0} role="region" aria-label` + `:focus-visible` 윤곽선, 그리고 `role="group"` 추가는 적절합니다.

10. **[검증 한계] 화면 변경은 자동 테스트가 확인하지 않음.**
    - `test:subscription-display`(subscriptionDisplay.policy.test.cjs)는 `subscriptionDisplay.ts` 유틸만 확인합니다.
    - 이번 공개 카드 화면이나 SignedInRoute는 확인하지 않습니다. 검증은 빌드와 수동 브라우저 확인에 기대고 있습니다.
    - 로그인 계정으로 `/sayu`·`/settings` 진입, 그리고 로딩 중에 `/login`으로 잘못 가지 않는지는 실제 계정으로 확인하지 않았습니다(PR 설명에도 적혀 있음).

**의도하지 않은 동작 변경**
- 위 2번(약관 화면 ✕가 로그인으로 이동)과 7번(하단 메뉴 선택 상태 구분 약화) 외에는 확인되지 않았습니다.
- 결제 금액·결제 버튼 조건, Functions, Firestore 경로, Rules는 바뀌지 않았습니다. diff로 확인했습니다.

**규모: 중**
- 컴포넌트 여러 개 수정과 라우트 진입 조건 변경이 섞여 있습니다.
- 새 기능은 아니지만, 라우터 파일에서 인증 진입 조건이 바뀌므로 소규모가 아닙니다.

**8.1 멈춤 조건: 해당함 (자동 판정만으로 병합 불가, 허대표님 결정 필요)**
- (a) **라우터 파일 변경:** `frontend/src/app/App.tsx`의 Route element를 바꿨습니다. 8.1은 "홈화면·라우터 파일을 바꾸는 작업은 화면이 동일한 구조 변경이라도 허대표님이 허용하기 전까지 멈춤 대상"이라고 정합니다. 명확히 해당합니다.
- (b) **인증 정책 변경:** 비로그인 사용자의 `/sayu`·`/settings` 접근을 막고 로그인으로 보내는 것은 접근 정책 변경으로 볼 수 있습니다. 해당 가능성이 높습니다.
- (c) **결제 심사 관련 문구 삭제:** 결제 흐름은 그대로입니다. 다만 결제사 심사 대응 문구일 수 있으므로 심사가 진행 중인지 허대표님 확인을 권합니다. 함께 SinglePaymentPage에 남은 같은 문구를 어떻게 할지 정해야 합니다.

**권장 조치:** 2번과 7번을 고치고, 6번 네이버 버튼 색은 허대표님 결정 또는 원래 색으로 되돌립니다. 그 뒤 Codex 재검토를 받고, (a)~(c)는 허대표님께 보고해 승인받은 뒤 병합합니다.
