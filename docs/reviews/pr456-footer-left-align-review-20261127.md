# PR #456 회사정보 푸터 정렬 교차 검토

검토 커밋 `ac34e102618ca75dcbb0181f073c29825d04291f`

## Codex 자동 리뷰

실행 1. 초안 해제 시 자동 실행. 요청 댓글 없음. 시작 2026-11-27 12:25:34 UTC, 완료 12:26:10 UTC. 지적 없음. 별도 리뷰 ID 없이 [요약 댓글 7218228877](https://github.com/hkd620-lab/haru2026/pull/456#issuecomment-7218228877)에 기록됐습니다.

## Claude Code 독립 검토

### 요청 원문 (2026-11-27T12:25:20.687880+00:00)

~~~~text
독립 검토 요청. 코드 HEAD ac34e102. 사용자 요청은 회사정보 공용 푸터의 기존 12px을 유지하며 본문 및 링크를 왼쪽 정렬하는 것. 코드 수정이나 외부 작업 없이 diff를 검토하고 승인/수정 후 승인/재설계, 규모·멈춤 조건, 회귀와 접근성 판정을 제시하세요. 웹 빌드 통과 및 실제 Footer 컴포넌트와 생산 CSS를 사용한 WebKit 검사 320/375/390/1024px에서 12px, 왼쪽 정렬(줄 시작점), 6개 링크, 가로 넘침 없음 확인. 모바일 실기기는 운영 배포 후 검증 예정.
diff --git a/frontend/src/app/components/Footer.tsx b/frontend/src/app/components/Footer.tsx
index 09c476db..f0d2c440 100644
--- a/frontend/src/app/components/Footer.tsx
+++ b/frontend/src/app/components/Footer.tsx
@@ -7,18 +7,18 @@ export function Footer() {

   return (
     <footer
-      className="border-t border-black/10 bg-white px-4 py-4 text-center text-xs leading-relaxed text-gray-600"
+      className="border-t border-black/10 bg-white px-4 py-4 text-left text-xs leading-relaxed text-gray-600"
       style={{ marginBottom: 'calc(var(--bottomnav-height, 80px) + env(safe-area-inset-bottom, 0px))' }}
     >
       <div className="mx-auto flex max-w-3xl flex-col gap-2 break-keep">
-        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
+        <p className="flex flex-wrap gap-x-3 gap-y-1">
           <span>상호명: {BUSINESS_INFO.company} (HaruLab)</span>
           <span>대표자: {BUSINESS_INFO.representative}</span>
           <span>사업자등록번호: {BUSINESS_INFO.businessNumber}</span>
           <span>통신판매업신고번호: {BUSINESS_INFO.mailOrderNumber}</span>
         </p>
         <p>사업장 주소: {BUSINESS_INFO.address}</p>
-        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
+        <p className="flex flex-wrap gap-x-3 gap-y-1">
           <span>연락처: {BUSINESS_INFO.phone}</span>
           <span>이메일: {BUSINESS_INFO.email}</span>
           <span>사이트: {BUSINESS_INFO.site}</span>
@@ -27,7 +27,7 @@ export function Footer() {
           하루랩에서 운영하는 사이트에서 판매되는 모든 상품은 하루랩에서 책임지고 있습니다.<br />
           민원 담당자: 허경대 / 연락처: 010-6309-6107
         </p>
-        <nav aria-label="서비스 및 사업자 정보" className="flex flex-wrap justify-center gap-x-3 gap-y-1 underline">
+        <nav aria-label="서비스 및 사업자 정보" className="flex flex-wrap gap-x-3 gap-y-1 underline">
           <a className="whitespace-nowrap" href="/subscription">구독/요금</a>
           <a className="whitespace-nowrap" href="/business-info">사업자 정보</a>
           <a className="whitespace-nowrap" href="/terms">이용약관</a>
~~~~

### 결과 원문 (2026-11-27T12:26:00.149094+00:00)

# 독립 검토 결과: 회사정보 푸터 왼쪽 정렬 (HEAD `ac34e102`)

**판정: 승인.** 수정할 곳은 없습니다.

이번 세션에서는 Bash와 파일 읽기 도구를 쓸 수 없었습니다. 그래서 저장소를 직접 확인하지 못했고, 보내주신 diff만 보고 판단했습니다. 커밋에 다른 파일이 섞였는지, `Footer.tsx` 전체 내용이 어떤지, 다른 곳에서 푸터 스타일을 덮어쓰는지는 확인하지 못했습니다. 기장이 병합 전에 `git show --stat ac34e102`로 바뀐 파일이 `Footer.tsx` 하나뿐인지 한 번 확인해 주세요.

## 1. diff 검토

```diff
- className="... px-4 py-4 text-center text-xs leading-relaxed text-gray-600"
+ className="... px-4 py-4 text-left text-xs leading-relaxed text-gray-600"
- <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">   (2곳)
+ <p className="flex flex-wrap gap-x-3 gap-y-1">
- <nav ... className="flex flex-wrap justify-center gap-x-3 gap-y-1 underline">
+ <nav ... className="flex flex-wrap gap-x-3 gap-y-1 underline">
```

- **요청대로 바뀌었는지:** 맞습니다.
  - 일반 문단(사업장 주소, 민원 안내)은 바깥 `text-left`를 물려받아 왼쪽 정렬됩니다.
  - 가로로 늘어서는 줄 3곳(사업자 정보 두 줄, 링크 줄)은 `justify-center`가 빠지면서 기본값인 왼쪽 시작으로 바뀝니다.
  - 가운데 정렬을 만들던 속성 4곳이 모두 정리됐고, 남은 곳은 없습니다.
- **12px 유지:** `text-xs`를 그대로 두었습니다. 줄 간격, 색, 여백, `break-keep`, 하단 메뉴 높이만큼 띄우는 `marginBottom`도 바뀌지 않았습니다.
- **링크:** 주소, 이동 경로, `aria-label`, `whitespace-nowrap`이 모두 그대로입니다. 링크 6개는 diff에 일부만 보이지만, 나머지 줄도 바뀌지 않은 것으로 보입니다.

## 2. 참고 사항 (병합을 막는 문제는 아님)

**넓은 화면에서의 시작점:** `mx-auto max-w-3xl`(최대 너비 768px, 가운데 배치)은 그대로입니다. 그래서 1024px처럼 넓은 화면에서는 글자가 화면 왼쪽 끝이 아니라, 가운데 놓인 768px 상자의 왼쪽에서 시작합니다.

- 요청이 "본문과 링크를 왼쪽 정렬"이었으므로 지금 결과가 요청에 맞는다고 판단했습니다.
- 대표님이 "PC에서도 화면 왼쪽 끝부터"를 원하신 거라면 `mx-auto`를 빼야 합니다. 이건 별도 확인이 필요합니다.
- 1024px 검사에서 기준으로 삼은 줄 시작점이 이 상자 기준이었는지 보고서에 적어 두면 좋겠습니다.

## 3. 회귀 판정: 문제 없음

- 바뀐 것은 CSS 클래스뿐입니다. 동작, 데이터, 저장 경로, 라우팅, 불러오는 모듈은 바뀌지 않았습니다.
- 줄바꿈 동작(`flex-wrap`, `break-keep`, `whitespace-nowrap`)이 그대로라서, 정렬을 바꿔도 화면 밖으로 넘칠 위험은 새로 생기지 않습니다. 320px에서 가로 넘침이 없다는 측정 결과와도 맞습니다.
- 푸터를 쓰는 모든 페이지에 똑같이 적용되는 의도된 변경입니다. 다만 특정 페이지가 푸터 바깥에서 따로 가운데 정렬을 걸고 있는지는 확인하지 못했습니다(도구 제한). 실제 컴포넌트로 4개 화면 너비를 검사했다면 그 위험은 낮습니다.

## 4. 접근성 판정: 문제 없음, 오히려 조금 나아짐

- 여러 줄짜리 한국어 문단은 가운데 정렬보다 왼쪽 정렬이 줄 시작점을 찾기 쉬워 읽기에 더 좋습니다.
- `nav`와 `aria-label`, 밑줄, 글자 크기, 색 대비(`text-gray-600`, 흰 배경)는 바뀌지 않았습니다.
- 링크가 12px이고 줄 간격이 4px이라 손가락으로 누르기에 작은 편입니다. 다만 원래부터 그랬던 부분이고, 이번 요청 범위 밖이니 지적만 남깁니다.

## 5. 규모와 멈춤 조건

- **규모:** 소규모(정렬만 바꿈)입니다. 절차는 feature 브랜치 → PR → preview 확인 → 병합 → 자동 배포입니다.
- **멈춤 조건:** 해당 없음.
  - 모델이나 출력 품질에 영향이 없습니다.
  - 커밋 메시지 "회사정보 푸터 왼쪽 정렬"이 실제 변경과 일치합니다.
  - 대규모 작업이 아닙니다.
- **Firestore 경로, Functions 리전:** 이번 변경과 관계없습니다.
- **남은 검증:** 모바일 실기기 확인은 운영 배포 후 예정이라 아직 끝나지 않았습니다. 지금 단계에서 실기기 확인을 끝났다고 보고하면 안 됩니다.

## Slack 기록용 확정 요약

Slack에는 게시하지 않았습니다.

> [CC 독립검토] 회사정보 푸터 왼쪽 정렬 `ac34e102` (codex/footer-left-align-20261127)
> - 판정: **승인** (소규모, 멈춤 조건 해당 없음)
> - 변경: Footer.tsx `text-center`→`text-left`, flex 3곳 `justify-center` 제거. 12px(`text-xs`)·링크 6개·aria 유지
> - 회귀/접근성: 이상 없음. 왼쪽 정렬로 가독성 소폭 개선
> - 참고: 넓은 화면은 가운데 놓인 768px 상자 안에서 왼쪽 정렬(`mx-auto max-w-3xl` 유지)
> - 한계: CC 세션 도구 제한으로 diff만 검토. 커밋 파일 범위는 기장 확인 필요
> - 남은 검증: 운영 배포 후 모바일 실기기

## 병합 전 확인

- 코드 커밋에는 `Footer.tsx` 한 파일만 포함됩니다.
- 웹 빌드 및 WebKit 320·375·390·1024px에서 12px, 왼쪽 정렬, 링크 6개와 가로 넘침 없음을 확인했습니다.
- 1024px에서도 기존 최대 너비 컨테이너의 왼쪽을 줄 시작점으로 확인했습니다.
