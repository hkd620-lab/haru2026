# PR #454 사유기록 하단과 푸터 검토

검토 대상 `e84bd416bb3aab38778d656a4347e62263c21555`

## Codex 자동 리뷰

실행 1. 초안 해제 시 자동 실행. 요청 댓글 없음. 시작 시각 확인 불가. 완료 2026-11-27 12:00:49 UTC. 지적 없음. 별도 리뷰 ID 없이 [요약 댓글 7217734377](https://github.com/hkd620-lab/haru2026/pull/454#issuecomment-7217734377)에 기록.

## Claude Code 독립 검토

### 요청 원문 (2026-11-27T11:59:47.282297+00:00)

````text
독립 검토 요청. HEAD e84bd416 사유기록 여백/공용 푸터. 코드 변경·외부 작업 없이 diff와 아래 검증 근거를 검토해 주세요. 필수 사업자 정보·정책 링크 보존, 접근성, :has 범위, 기존 화면 회귀, 변경 규모·멈춤 조건을 확인하고 승인/수정 후 승인/재설계 판정. Vite 빌드 통과, 실제 iPhone 16e Safari에서 수정 Footer + 빌드 CSS 검증용 화면 확인, iPhone 13/SE/데스크톱 WebKit에서 0/80px 경로별 여백, 공정위 한 링크, 가로 넘침 없음, 하단 메뉴 여백 보존을 검증.
diff --git a/frontend/src/app/components/Footer.tsx b/frontend/src/app/components/Footer.tsx
index ce91b128..09c476db 100644
--- a/frontend/src/app/components/Footer.tsx
+++ b/frontend/src/app/components/Footer.tsx
@@ -4,56 +4,40 @@ import { BUSINESS_INFO } from './BusinessInfoNotice';
 export function Footer() {
   const location = useLocation();
   if (location.pathname === '/v2') return null;
+
   return (
-    <footer style={{
-      borderTop: '1px solid rgba(0,0,0,0.08)',
-      padding: '20px 16px',
-      textAlign: 'center',
-      color: '#595959',
-      fontSize: '11px',
-      lineHeight: 1.8,
-      background: '#fff',
-      marginBottom: 'calc(var(--bottomnav-height, 80px) + env(safe-area-inset-bottom, 0px))',
-    }}>
-      <p>
-        상호명: 하루랩 (HaruLab) &nbsp;|&nbsp; 대표자: 허경대 &nbsp;|&nbsp;
-        사업자등록번호: {BUSINESS_INFO.businessNumber} &nbsp;|&nbsp;
-        통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber} &nbsp;|&nbsp;
-        <a
-          href={BUSINESS_INFO.ftcUrl}
-          target="_blank"
-          rel="noopener noreferrer"
-          style={{ color: '#595959', textDecoration: 'underline' }}
-        >
-          사업자정보확인
-        </a>
-      </p>
-      <p>사업장 주소: {BUSINESS_INFO.address}</p>
-      <p>연락처: {BUSINESS_INFO.phone} &nbsp;|&nbsp; 이메일: {BUSINESS_INFO.email} &nbsp;|&nbsp; 사이트: {BUSINESS_INFO.site}</p>
-      <p>
-        하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.<br />
-        민원 담당자: 허경대 / 연락처: 010-6309-6107
-      </p>
-      <p>
-        <a href="/subscription" style={{ color: '#595959', textDecoration: 'underline' }}>구독/요금</a>
-        &nbsp;|&nbsp;
-        <a href="/business-info" style={{ color: '#595959', textDecoration: 'underline' }}>사업자 정보</a>
-        &nbsp;|&nbsp;
-        <a href="/terms" style={{ color: '#595959', textDecoration: 'underline' }}>이용약관</a>
-        &nbsp;|&nbsp;
-        <a href="/privacy" style={{ color: '#595959', textDecoration: 'underline' }}>개인정보처리방침</a>
-        &nbsp;|&nbsp;
-        <a href="/refund" style={{ color: '#595959', textDecoration: 'underline' }}>환불정책</a>
-        &nbsp;|&nbsp;
-        <a
-          href={BUSINESS_INFO.ftcUrl}
-          target="_blank"
-          rel="noreferrer"
-          style={{ color: '#595959', textDecoration: 'underline' }}
-        >
-          공정위 사업자정보 확인
-        </a>
-      </p>
+    <footer
+      className="border-t border-black/10 bg-white px-4 py-4 text-center text-xs leading-relaxed text-gray-600"
+      style={{ marginBottom: 'calc(var(--bottomnav-height, 80px) + env(safe-area-inset-bottom, 0px))' }}
+    >
+      <div className="mx-auto flex max-w-3xl flex-col gap-2 break-keep">
+        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
+          <span>상호명: {BUSINESS_INFO.company} (HaruLab)</span>
+          <span>대표자: {BUSINESS_INFO.representative}</span>
+          <span>사업자등록번호: {BUSINESS_INFO.businessNumber}</span>
+          <span>통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber}</span>
+        </p>
+        <p>사업장 주소: {BUSINESS_INFO.address}</p>
+        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
+          <span>연락처: {BUSINESS_INFO.phone}</span>
+          <span>이메일: {BUSINESS_INFO.email}</span>
+          <span>사이트: {BUSINESS_INFO.site}</span>
+        </p>
+        <p>
+          하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.<br />
+          민원 담당자: 허경대 / 연락처: 010-6309-6107
+        </p>
+        <nav aria-label="서비스 및 사업자 정보" className="flex flex-wrap justify-center gap-x-3 gap-y-1 underline">
+          <a className="whitespace-nowrap" href="/subscription">구독/요금</a>
+          <a className="whitespace-nowrap" href="/business-info">사업자 정보</a>
+          <a className="whitespace-nowrap" href="/terms">이용약관</a>
+          <a className="whitespace-nowrap" href="/privacy">개인정보처리방침</a>
+          <a className="whitespace-nowrap" href="/refund">환불정책</a>
+          <a className="whitespace-nowrap" href={BUSINESS_INFO.ftcUrl} target="_blank" rel="noopener noreferrer">
+            공정위 사업자정보 확인
+          </a>
+        </nav>
+      </div>
     </footer>
   );
 }
diff --git a/frontend/src/styles/theme.css b/frontend/src/styles/theme.css
index 634e8a1f..40e6694f 100644
--- a/frontend/src/styles/theme.css
+++ b/frontend/src/styles/theme.css
@@ -133,6 +133,11 @@
   --color-sidebar-ring: var(--sidebar-ring);
 }

+/* SAYU's footer reserves space for the fixed bottom navigation. */
+main:has(> .sayu-page-container) {
+  --content-pb: 0px;
+}
+
 @layer base {
   * {
     @apply border-border outline-ring/50;
````

### 결과 원문 (2026-11-27T12:01:00.804843+00:00)

# 독립 검토 결과: HEAD `e84bd416` 사유기록 여백과 공용 푸터

**판정: 승인. 단, 병합 전에 아래 B1·B2 두 가지를 기장이 확인해야 합니다.** 코드를 고쳐야 할 결함은 찾지 못했습니다. 두 가지 확인 결과가 기대와 다를 때만 "수정 후 승인"으로 바뀝니다.

이 세션에는 파일 읽기나 셸 도구가 없었습니다. 그래서 저장소의 `BusinessInfoNotice.tsx`, `--content-pb`를 정의·사용하는 곳, `.sayu-page-container`가 쓰인 곳을 직접 열어 보지 못했습니다. 이 검토는 받은 diff와 검증 근거만으로 판단했습니다. 코드를 바꾸거나 외부 작업을 하지는 않았습니다.

## A. 확인된 항목 (문제 없음)

| 항목 | 근거 |
|---|---|
| 필수 사업자 정보 | 상호, 대표자, 사업자등록번호, 통신판매업신고번호, 주소, 연락처, 이메일, 사이트, 민원 담당자, 책임 문구가 모두 남아 있습니다. |
| 공정위 링크 | 첫 줄의 "사업자정보확인"과 마지막 줄의 "공정위 사업자정보 확인"이 겹쳐 있었는데, 뒤쪽 하나만 남겼습니다. `rel`이 `noreferrer`에서 `noopener noreferrer`로 바뀌어 오히려 나아졌습니다. 확인 경로는 그대로 남아 있으므로 정보를 지운 것이 아니라 중복을 정리한 것입니다. |
| 정책 링크 5개 | 구독/요금, 사업자 정보, 이용약관, 개인정보처리방침, 환불정책의 `href`가 모두 그대로입니다. |
| 대비와 글자 크기 | `#595959`는 흰 배경에서 7.0:1입니다. `text-gray-600`은 약 7.5:1이라 AA를 계속 충족합니다. 글자는 11px에서 12px로 커졌습니다. |
| 접근성 개선 | 시각용 `&nbsp;\|&nbsp;` 구분자가 없어져 화면낭독기가 "세로선"을 읽지 않습니다. `<nav aria-label>`로 랜드마크도 생겼습니다. |
| 밑줄 | `nav`에 준 `underline`이 블록화된 flex 자식에게 전파되고, 간격 부분에는 밑줄이 생기지 않습니다. 실기기에서 확인했다는 결과와도 맞습니다. |
| `:has` 우선순위 | 이 규칙은 `@layer` 밖에 있어서 `@layer base`나 utilities보다 우선합니다. 범위는 `main`의 **직계 자식**으로 한정됩니다. |
| 구형 브라우저 | `:has`를 지원하지 않는 브라우저(Safari 15.4 미만, Firefox 121 미만)에서는 규칙이 무시되고 예전처럼 80px가 됩니다. 여백이 두 번 들어가던 원래 상태로 돌아갈 뿐, 하단 메뉴가 내용을 가리지는 않습니다. |
| safe-area 보존 | 푸터의 `marginBottom: calc(var(--bottomnav-height,80px) + env(safe-area-inset-bottom))`이 그대로 남아 있습니다. |
| 변경 규모와 멈춤 조건 | 2개 파일, 소~중규모입니다. 모델, 라우터, Firestore 경로, Functions, 새 기능은 건드리지 않았습니다. 커밋 메시지와 실제 변경도 일치하므로 멈춤 조건에 해당하지 않습니다. |

## B. 병합 전에 확인할 것 (필수)

**B1. `BUSINESS_INFO.company`와 `BUSINESS_INFO.representative` 필드가 실제로 있고, 값이 정확한지**

예전 코드는 이름을 직접 적었는데, 이번 변경으로 상수를 참조하게 됐습니다.

```diff
- 상호명: 하루랩 (HaruLab) &nbsp;|&nbsp; 대표자: 허경대
+ <span>상호명: {BUSINESS_INFO.company} (HaruLab)</span>
+ <span>대표자: {BUSINESS_INFO.representative}</span>
```

- **Vite 빌드는 타입을 검사하지 않습니다.** 필드가 없으면 빌드는 통과하지만 화면에는 `상호명:  (HaruLab)`처럼 이름이 빠진 채 나옵니다.
- `company` 값에 이미 `(HaruLab)`이 들어 있다면 `하루랩 (HaruLab) (HaruLab)`처럼 두 번 표시됩니다.
- 확인 방법: `frontend`에서 `npx tsc --noEmit`을 실행하고, `grep -n "company\|representative" frontend/src/app/components/BusinessInfoNotice.tsx`로 값을 봅니다. iPhone 16e 스크린샷에 "상호명: 하루랩 (HaruLab)"과 "대표자: 허경대"가 정확히 보였다면 그것으로도 충분합니다.

**B2. `.sayu-page-container`가 어디에 쓰이는지**

```css
main:has(> .sayu-page-container) { --content-pb: 0px; }
```

이 규칙은 "이 컨테이너가 있는 경로에서는 공용 Footer가 항상 `main` 뒤에 렌더링되고, 그 Footer가 하단 메뉴 높이만큼 여백을 확보한다"는 전제 위에 서 있습니다.

- 이 클래스가 SayuModal이나 다른 페이지에서도 `main`의 직계 자식으로 쓰이면, 그 화면도 0px가 됩니다.
- Footer가 렌더링되지 않는 경로(현재 `/v2`)나, `main`만 스크롤되는 구조라면 마지막 내용이 하단 메뉴에 가려집니다.
- 확인 방법: `grep -rn "sayu-page-container" frontend/src`, 그리고 `grep -rn "content-pb" frontend/src`로 `main`에서 어떻게 쓰이는지 봅니다. 0px/80px 경로별 실측 결과가 이미 있으므로, 이 클래스가 SAYU 경로에서만 쓰인다는 것만 확인되면 됩니다.

## C. 선택 개선 (이번 병합을 막지 않음, 기장 판단)

1. **텍스트 연결:** JSX에서 줄을 바꾼 `<span>` 사이에는 공백이 들어가지 않습니다. 그래서 복사하거나 일부 리더 모드에서 읽으면 `…(HaruLab)대표자: …`처럼 붙어 나옵니다. 보이지 않는 구분자를 넣으면 해결됩니다.
   ```tsx
   <span>상호명: …</span><span className="sr-only"> · </span><span>대표자: …</span>
   ```
   또는 각 `span` 끝에 `{' '}`를 넣어도 됩니다.
2. **새 창 안내:** 공정위 링크가 새 창으로 열린다는 것을 화면낭독기에 알려 주면 좋습니다: `<span className="sr-only">(새 창)</span>`.
3. **터치 영역:** 링크 높이가 약 19.5px이고 세로 간격은 4px라서, WCAG 2.2의 24px 기준에 조금 못 미칩니다. 예전에도 같았으므로 회귀는 아닙니다. 필요하면 `<a>`에 `py-1`을 추가합니다.
4. **같은 문제가 다른 화면에도 있을 수 있음:** Footer와 `main`이 모두 하단 메뉴 높이를 확보하는 구조라면, SAYU 외의 페이지에서도 여백이 두 번 들어가 있을 가능성이 있습니다. 이번 범위 밖이므로 별도 과제로 기록하는 정도면 됩니다.

## Slack 기록용 확정 요약

이 세션에서는 Slack에 게시하지 않았습니다.

> [CC 독립 검토] `e84bd416` 사유기록 여백/공용 푸터 — **승인 (병합 전 확인 2건)**
> - 필수 사업자 정보·정책 링크 5개 보존, 공정위 링크는 중복 1개만 제거(rel 강화). 대비 AA 유지, nav 랜드마크 추가. `:has` 직계 자식 한정·unlayered, 미지원 브라우저는 기존 80px로 안전하게 되돌아감. 멈춤 조건 해당 없음.
> - 확인① `BUSINESS_INFO.company/representative` 존재·값 확인(`tsc --noEmit`; Vite 빌드는 타입 미검사, "(HaruLab)" 중복 여부)
> - 확인② `sayu-page-container`가 쓰인 곳과 `--content-pb` 사용 위치 grep → SAYU 경로 한정 확인
> - 선택: span 사이 sr-only 구분자, 새 창 안내, 링크 터치 영역 `py-1`
> - 한계: CC 세션에 파일/셸 도구가 없어 diff와 제출된 검증 근거로만 검토함

## 병합 전 확인

- `BusinessInfoNotice.tsx`의 상호와 대표자 상수를 소스에서 확인했고, iPhone에서 사용한 렌더링 HTML에 각각 정확한 텍스트가 표시됐습니다. 괄호 표기가 반복되지 않습니다.
- `.sayu-page-container` 클래스 부여는 `SayuPage.tsx` 한 곳입니다. `SayuModal.tsx` 사용처는 인쇄 스타일에서 해당 클래스를 참조합니다. 인증 후 `/sayu` 출력은 `main`의 직계 자식이며 공용 푸터가 고정 메뉴 여백을 유지합니다.
- Vite 빌드와 iPhone 16e Safari 로컬 미리보기, Playwright WebKit iPhone 13·SE·데스크톱 검증을 통과했습니다.
