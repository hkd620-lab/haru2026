# PR #457 회사정보 푸터 두 단 교차 검토

검토 커밋 `d2a4e0c08fba44e0d66a4c25cf2953b1b28e69a9`

## Codex 자동 리뷰

실행 1. 초안 해제 시 자동 실행. 요청 댓글 없음. 시작 2026-11-27 22:29:56 UTC, 완료 22:30:35 UTC. 지적 없음. 리뷰 ID 없이 [요약 댓글 7229377930](https://github.com/hkd620-lab/haru2026/pull/457#issuecomment-7229377930)에 기록됐습니다.

## Claude Code 독립 검토

### 요청 원문 (2026-11-27T22:29:40.968254+00:00)

~~~~text
독립 검토 요청, 코드 HEAD d2a4e0c0. 사용자가 승인한 두 단 미리보기 그대로: 위아래 3px 선, 12px 왼쪽 정렬, 첫째/마지막 줄과 위아래 여백 일치, 정책 링크 6개 아래. 코드 변경과 외부 작업 없이 diff를 검토해 승인/수정 후 승인/재설계와 규모·멈춤 조건, 정보와 접근성·회귀를 판정해 주세요. 웹 빌드 통과. 실제 Footer 컴포넌트와 빌드 CSS로 WebKit 320/375/390/1024px에서 두 단, 12px, 왼쪽 정렬, 위아래 대칭 여백, 링크 수, 가로 넘침 없음을 확인. 실기기 확인은 운영 배포 후 진행합니다.
diff --git a/frontend/src/app/components/Footer.tsx b/frontend/src/app/components/Footer.tsx
index f0d2c440..94307576 100644
--- a/frontend/src/app/components/Footer.tsx
+++ b/frontend/src/app/components/Footer.tsx
@@ -7,27 +7,33 @@ export function Footer() {

   return (
     <footer
-      className="border-t border-black/10 bg-white px-4 py-4 text-left text-xs leading-relaxed text-gray-600"
+      className="bg-white px-4 py-4 text-left text-xs leading-relaxed text-gray-600"
       style={{ marginBottom: 'calc(var(--bottomnav-height, 80px) + env(safe-area-inset-bottom, 0px))' }}
     >
-      <div className="mx-auto flex max-w-3xl flex-col gap-2 break-keep">
-        <p className="flex flex-wrap gap-x-3 gap-y-1">
-          <span>상호명: {BUSINESS_INFO.company} (HaruLab)</span>
-          <span>대표자: {BUSINESS_INFO.representative}</span>
-          <span>사업자등록번호: {BUSINESS_INFO.businessNumber}</span>
-          <span>통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber}</span>
-        </p>
-        <p>사업장 주소: {BUSINESS_INFO.address}</p>
-        <p className="flex flex-wrap gap-x-3 gap-y-1">
-          <span>연락처: {BUSINESS_INFO.phone}</span>
-          <span>이메일: {BUSINESS_INFO.email}</span>
-          <span>사이트: {BUSINESS_INFO.site}</span>
-        </p>
-        <p>
-          하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.<br />
-          민원 담당자: 허경대 / 연락처: 010-6309-6107
-        </p>
-        <nav aria-label="서비스 및 사업자 정보" className="flex flex-wrap gap-x-3 gap-y-1 underline">
+      <div className="mx-auto max-w-3xl break-keep">
+        <section
+          aria-label="회사정보"
+          className="grid grid-cols-2 gap-4 border-y-[3px] border-[#475569] py-3 [overflow-wrap:anywhere]"
+        >
+          <div className="flex min-w-0 flex-col justify-between gap-1">
+            <p>상호명: {BUSINESS_INFO.company} (HaruLab)</p>
+            <p>대표자: {BUSINESS_INFO.representative}</p>
+            <p>사업자등록번호: {BUSINESS_INFO.businessNumber}</p>
+            <p>통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber}</p>
+            <p>사업장 주소: {BUSINESS_INFO.address}</p>
+          </div>
+          <div className="flex min-w-0 flex-col justify-between gap-1">
+            <p>연락처: {BUSINESS_INFO.phone}</p>
+            <p>이메일: {BUSINESS_INFO.email}</p>
+            <p>사이트: {BUSINESS_INFO.site}</p>
+            <p>하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.</p>
+            <p>
+              민원 담당자: 허경대<br />
+              연락처: 010-6309-6107
+            </p>
+          </div>
+        </section>
+        <nav aria-label="서비스 및 사업자 정보" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 underline">
           <a className="whitespace-nowrap" href="/subscription">구독/요금</a>
           <a className="whitespace-nowrap" href="/business-info">사업자 정보</a>
           <a className="whitespace-nowrap" href="/terms">이용약관</a>
~~~~

### 결과 원문 (2026-11-27T22:30:25.501093+00:00)

# 독립 검토 결과: 회사정보 푸터 두 단 (HEAD `d2a4e0c0`)

## 판정: **승인**
지금 고칠 곳은 없습니다. 선택 제안 두 가지는 아래에 따로 적었습니다.

**검토 범위:** 이 세션에는 셸과 파일 읽기 도구가 없었습니다. 그래서 저장소를 직접 열지 못했고 빌드도 다시 돌리지 못했습니다. 판정은 전달받은 diff와 기장이 보고한 검증 결과(빌드 통과, WebKit 320/375/390/1024px 확인)를 근거로 했습니다. 지시대로 코드 변경과 외부 게시는 하지 않았습니다.

## 1. 승인한 미리보기와 맞는지
| 승인 항목 | 코드 근거 | 판정 |
|---|---|---|
| 위아래 3px 선 | 섹션에 `border-y-[3px] border-[#475569]`, 기존 footer의 `border-t border-black/10`은 제거 | 일치. 선이 겹치지 않음 |
| 12px, 왼쪽 정렬 | footer의 `text-xs text-left`는 그대로 | 일치 |
| 첫째·마지막 줄과 위아래 여백 일치 | 섹션은 `py-3`, 두 단 모두 `flex-col justify-between` | 일치. 그리드 칸이 같은 높이로 늘어나므로 양쪽 단 모두 첫 줄은 위 선에서 12px, 마지막 줄은 아래 선에서 12px에 놓임 |
| 정책 링크 6개는 아래로 | `<nav>`가 섹션 밖에 있고 `mt-3`, 링크 마크업은 diff에서 바뀌지 않음 | 일치. 링크 수 6개는 기장이 실측함 |

## 2. 표시 정보
- 전자상거래법 표시 항목이 모두 남아 있습니다: 상호, 대표자, 사업자등록번호, 통신판매업신고번호, 주소, 전화, 이메일. 사이트 주소와 책임 문구, 민원 담당자도 빠지지 않았습니다.
- 값은 전부 `BUSINESS_INFO`에서 가져오고, 하드코딩된 민원 정보는 문구가 이전과 같습니다. 줄 위치만 달라졌습니다.

## 3. 접근성
- 읽는 순서는 왼쪽 단 전체, 오른쪽 단, 정책 링크 순입니다. 논리적으로 맞습니다.
- `<section aria-label="회사정보">`는 이름이 있어서 화면낭독기에 region(구역)으로 잡히고, footer 안에 구역이 하나 늘어납니다. 문제는 아닙니다. 다만 구역 목록을 줄이고 싶으면 `<div>`로 바꿔도 됩니다.
- 3px 선은 장식이고, 본문 색 `text-gray-600`은 흰 배경에서 대비 기준을 넘습니다.

## 4. 회귀 위험 (낮음)
- `marginBottom`(하단 메뉴 높이 + safe-area)은 바뀌지 않아서 하단 메뉴 겹침 위험은 늘지 않습니다.
- 320px에서 각 단은 약 136px입니다. 주소와 책임 문구가 여러 줄로 길어지는 것은 예상된 결과입니다. `min-w-0`과 `[overflow-wrap:anywhere]` 덕분에 이메일처럼 긴 문자열도 칸을 넘지 않습니다. 대신 이메일이 단어 중간에서 끊길 수 있는데, 기장 실측에서 가로 넘침은 없었으니 막을 사유는 아닙니다.
- 양쪽 단의 줄 수가 다른 좁은 폭에서는 짧은 쪽 단의 줄 간격이 벌어집니다. 승인한 미리보기의 의도대로 동작하는 것으로 봅니다.

## 선택 제안 (막지 않음, 기장 판단)
1. 오른쪽 단에 `연락처:`가 두 번 나옵니다(회사 대표 전화, 민원 담당자 전화). 두 번호가 같으면 중복이고, 다르면 헷갈릴 수 있습니다. 두 번째를 `민원 연락처:`로 바꾸면 분명해집니다. 승인된 미리보기의 문구를 바꾸는 일이므로 허대표님 확인이 필요합니다.
2. 구역 목록을 줄이고 싶으면 `section`을 `div`로 바꿉니다(3절 참고).

## 규모와 멈춤 조건
- **규모: 소규모.** 한 컴포넌트의 배치와 스타일만 바뀌었습니다. 절차는 feature 브랜치 → PR → preview 확인 → merge → 자동배포입니다.
- **멈춤 조건: 해당 없음.** 모델 교체, 커밋 메시지와 실제 변경의 불일치, 대규모 작업, Firestore·Functions 변경이 모두 없습니다. 커밋 메시지 "회사정보 푸터 두 단과 대칭 여백 적용"은 diff 내용과 맞습니다.
- 남은 확인: 운영 배포 뒤 실기기(아이폰, 삼성폰)에서 safe-area와 하단 메뉴 위치를 봐야 합니다.

## Slack 기록용 확정 요약
> 회사정보 푸터 두 단(d2a4e0c0) CC 독립 검토: **승인**. 승인한 미리보기의 4개 항목(3px 위아래 선, 12px 왼쪽 정렬, 위아래 대칭 여백, 정책 링크 6개 아래)이 코드와 일치함. 법정 표시 항목 누락 없음, 접근성 회귀 없음. 소규모, 멈춤 조건 없음. 선택 제안: 두 번째 `연락처:`를 `민원 연락처:`로 바꿀지(문구 변경이라 허대표님 확인 필요), section→div. 이 검토는 diff와 기장 실측 보고를 근거로 했고 빌드는 다시 돌리지 않음. 실기기 확인은 운영 배포 뒤 진행.

Slack에는 게시하지 않았습니다. 위 요약은 기장이 스레드에 그대로 옮겨 붙이면 됩니다.

## 병합 전 확인

`Footer.tsx` 한 파일을 변경했습니다. 웹 빌드 및 WebKit 320·375·390·1024px에서 두 단, 12px, 왼쪽 정렬, 3px 테두리, 첫 줄과 마지막 줄의 높이, 위아래 대칭 여백, 링크 6개, 가로 넘침 없음을 확인했습니다.
