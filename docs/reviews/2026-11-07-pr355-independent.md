# PR355 독립 검토 원문

- HEAD9eb1e5863c22aa783970e6bad0978ec84f0968ab
- 새 대화 https://claude.ai/chat/46c7beed-4b06-406a-bec0-fa9d6c3ec969
- 모델 Opus5.5 중간, UI 기본값 유지. 수집 2026-11-07T11:20:25.925041+00:00 (UI 요청/완료 정확시각 미표시).

## 질문 원문

독립 새 검토: PR355 https://github.com/hkd620-lab/haru2026/pull/355 HEAD9eb1e5863c22aa783970e6bad0978ec84f0968ab. 파일·Git·서비스·Slack 수정 금지. 다른 대화/메모리 대신 아래 근거만 읽고 승인/수정 후 승인/재설계 및 작업규모·멈춤조건을 한국어로 판단하세요. 이 작업의 앞선 독립 판정 없음. 대표님 직접 지시 “320px 관리자 화면 상단 메뉴 넘치는 것도 수정하고 검토 후 배포해줘. 결과는 Slack 감사 채널에 올려줘.”로 홈 수정·검토 후 main병합·웹Hosting 배포 승인 범위입니다. 원인: header displayflex aligncenter spacebetween nowrap에 로고와5버튼을 합한 최소폭이 화면초과. 640px이하 header flexwrap/gap, actions flexwrap/maxwidth/marginleftauto만 추가. 버튼 크기·권한·저장 동작 불변. 격리 fixture developer-full은 운영 조건 UID+검증된 개발자 이메일을 함께모의해5개버튼 표시. build성공·홈선택/작성8/8·diff검사 통과. 브라우저 실측: 관리자320 client305 scroll305,5버튼 right119/161/203/245/287.390 client375 scroll375.1280 client1265 scroll1265 headernowrap. 일반320 client305 scroll305. 물리실기기 미검증, 현재 운영은수정전. Codex와CI 별도대기. 정책8.1 판정은 최신CI+필수검증+Codex완료지적해결+독립승인 모두필요; docs/reviews 신규추가만 이후변경이면재검토예외(필터없는name-status확인,최종CI필수). 모든 질문/결과원문보존. 작업중상세검토필요하면최소범위요청하세요.
전체diff:
diff --git a/frontend/src/app/pages/HomePageV2.tsx b/frontend/src/app/pages/HomePageV2.tsx
index 1f75de50..fb28b4d4 100644
--- a/frontend/src/app/pages/HomePageV2.tsx
+++ b/frontend/src/app/pages/HomePageV2.tsx
@@ -844,12 +844,12 @@ export function HomePageV2() {
           [data-v2="hero-date-chips"] > span { font-size: 10px !important; padding: 5px 9px !important; }
 
           [data-v2="page"] { padding: 12px 12px 96px !important; }
-          [data-v2="header"] { padding: 4px 0 12px !important; }
+          [data-v2="header"] { padding: 4px 0 12px !important; flex-wrap: wrap; gap: 12px; }
           [data-v2="logo"] { width: 38px !important; height: 38px !important; border-radius: 11px !important; }
           [data-v2="logo"] img { width: 28px !important; height: 25px !important; }
           [data-v2="brand-title"] { font-size: 17px !important; }
           [data-v2="brand-sub"] { font-size: 11px !important; letter-spacing: 0.5px !important; line-height: 1.4 !important; margin-top: 3px !important; }
-          [data-v2="header-actions"] { gap: 6px !important; }
+          [data-v2="header-actions"] { gap: 6px !important; flex-wrap: wrap; max-width: 100%; margin-left: auto; }
           [data-v2="header-actions"] .v2-pill { padding: 6px 9px !important; font-size: 11px !important; }
           [data-v2="profile"] { width: 36px !important; height: 36px !important; }
 
diff --git a/frontend/test/home-assistants-browser/mocks.tsx b/frontend/test/home-assistants-browser/mocks.tsx
index b898b508..0aec2e7e 100644
--- a/frontend/test/home-assistants-browser/mocks.tsx
+++ b/frontend/test/home-assistants-browser/mocks.tsx
@@ -11,7 +11,7 @@ let selection: any = params.get('scenario') === 'existing'
     : params.get('scenario') === 'empty'
       ? { personalized: true, assistantSelectionConfigured: true, selectedRecordFormats: ['메모'], selectedAgents: [] }
       : null;
-const fixtureUser = { uid: params.get('scenario') === 'developer' ? __HOME_DEVELOPER_UID__ : 'fixture-user', email: params.get('scenario') === 'library-developer' ? AI_LIBRARY_DEVELOPER_EMAIL : 'fixture@example.test', emailVerified: params.get('scenario') === 'library-developer' };
+const fixtureUser = { uid: ['developer', 'developer-full'].includes(params.get('scenario') || '') ? __HOME_DEVELOPER_UID__ : 'fixture-user', email: ['library-developer', 'developer-full'].includes(params.get('scenario') || '') ? AI_LIBRARY_DEVELOPER_EMAIL : 'fixture@example.test', emailVerified: ['library-developer', 'developer-full'].includes(params.get('scenario') || '') };
 export function useAuth() { return { user: params.get('scenario') === 'guest' ? null : fixtureUser, loading: false }; }
 export const buildTimelineMeta = () => ({});
 export const firestoreService = {

현재 모바일CSS와헤더 주변:
          /* 모든 pill / nav 버튼 텍스트 줄바꿈 금지 */
          .v2-pill, [data-v2="hero-date-tag"], [data-v2="hero-date-chips"] > span { white-space: nowrap !important; }
          /* 헤더 액션 pill을 아이콘만 표시 (텍스트 숨김) */
          [data-v2="header-actions"] .v2-pill { font-size: 0 !important; padding: 0 !important; width: 36px !important; height: 36px !important; gap: 0 !important; justify-content: center !important; }
          [data-v2="header-actions"] .v2-pill svg { width: 16px !important; height: 16px !important; }
          [data-v2="header-actions"] .v2-pill > span { display: none !important; }
          /* 히어로 날짜: 한 줄 유지 */
          [data-v2="hero-date-num"] { flex-wrap: wrap !important; align-items: baseline !important; white-space: nowrap !important; word-break: keep-all !important; }
          [data-v2="hero-date-num"] small { flex-basis: 100% !important; margin-top: 4px !important; white-space: nowrap !important; }
          /* 히어로 우상단 태그 (현재 렌더되지 않음) */
          [data-v2="hero-date-tag"] { font-size: 9px !important; padding: 3px 8px !important; gap: 5px !important; top: 10px !important; right: 10px !important; }
          /* 히어로 칩들 줄바꿈 안 깨지게 */
          [data-v2="hero-date-chips"] { gap: 5px !important; }
          [data-v2="hero-date-chips"] > span { font-size: 10px !important; padding: 5px 9px !important; }

          [data-v2="page"] { padding: 12px 12px 96px !important; }
          [data-v2="header"] { padding: 4px 0 12px !important; flex-wrap: wrap; gap: 12px; }
          [data-v2="logo"] { width: 38px !important; height: 38px !important; border-radius: 11px !important; }
          [data-v2="logo"] img { width: 28px !important; height: 25px !important; }
          [data-v2="brand-title"] { font-size: 17px !important; }
          [data-v2="brand-sub"] { font-size: 11px !important; letter-spacing: 0.5px !important; line-height: 1.4 !important; margin-top: 3px !important; }
          [data-v2="header-actions"] { gap: 6px !important; flex-wrap: wrap; max-width: 100%; margin-left: auto; }
          [data-v2="header-actions"] .v2-pill { padding: 6px 9px !important; font-size: 11px !important; }
          [data-v2="profile"] { width: 36px !important; height: 36px !important; }


## 결과 원문

# PR #355 독립 검토 판정 (HEAD `9eb1e586…`)

## 판정: **승인 (코드 수정 불요)**

다만 이 승인은 정책 8.1의 네 가지 조건 중 **독립 승인 1건**에만 해당합니다. **최신 CI 통과**와 **Codex 완료·지적 해결**이 아직 대기 중이므로, 지금 시점에는 main 병합과 배포 모두 불가입니다.

## 근거

**1. 원인과 수정이 맞습니다.**
- 원인: header가 `nowrap`이라 로고, 브랜드, 5버튼의 최소폭 합이 320px을 넘었습니다.
- 수정: 640px 이하에서만 header와 actions에 `flex-wrap`을 주고, actions에 `margin-left:auto`를 주었습니다.
- 버튼 크기, 권한 분기, 저장 로직은 diff에 없습니다. 범위가 대표님 지시("320px 상단 메뉴 넘침")와 일치합니다.

**2. 실측 결과가 수정 의도와 일치합니다.**
- 관리자 320px: scrollWidth와 clientWidth가 모두 305로 가로 넘침이 없습니다.
- 버튼 right 값의 간격이 42px로 일정합니다(버튼 36px + gap 6px). 5개 버튼의 묶음 폭은 204px(83~287)로 화면 안에 들어갑니다.
- 390px, 1280px, 일반 사용자 320px에서도 모두 넘침이 없습니다.
- 1280px에서 header가 `nowrap`을 유지하므로 데스크톱 회귀도 없습니다.

**3. fixture 변경이 안전합니다.**
- 기존 시나리오의 동작은 그대로입니다.
  - `developer`: 개발자 UID, fixture 이메일, 미검증
  - `library-developer`: fixture UID, 개발자 이메일, 검증됨
- `developer-full`만 두 조건을 동시에 충족하도록 새로 추가되었습니다.
- 변경 파일이 `frontend/test/` 아래에 있어 운영 번들 영향은 없는 것으로 판단합니다.

## 비차단 관찰 (병합을 막지 않음)

- **세로 배치 미측정:** 실측은 가로 넘침만 확인합니다. 줄바꿈 후 브랜드 텍스트가 잘리거나 겹치는지는 보장하지 않습니다. 배포 전에 아래 중 하나를 확인하면 충분합니다.
  - 관리자 320px 스크린샷 1장
  - logo, brand, header-actions의 top/bottom 값과 brand-title의 scrollWidth/clientWidth 값
- **`!important` 미사용:** 추가된 `flex-wrap`에 `!important`가 없어 파일의 기존 관례와 다릅니다. 320px 실측이 통과했으므로 실제로 적용된 것으로 보이며, 수정 요구는 아닙니다.
- **641~1024px 구간 미측정:** 이 구간은 PR의 변경 범위 밖이며, 기존에 있던 위험일 수 있습니다. 필요하면 별도 과제로 다루는 것을 권합니다.
- **자동 회귀 테스트 없음:** 320px 넘침을 잡는 자동 테스트는 없습니다. 차단 사유는 아닙니다.
- **물리 실기기 미검증:** 이미 고지된 대로입니다.

## 작업 규모

**소.** CSS 2줄과 테스트 fixture 1줄이며, 동작 로직 변경은 없습니다.

## 멈춤 조건

1. 최신 HEAD 기준 CI가 실패하거나 아직 미완료이면 멈춥니다.
2. Codex 검토가 미완료이거나, 지적 사항이 미해결이면 멈춥니다.
3. 이 판정 이후 HEAD가 바뀐 경우, 필터 없는 `name-status`로 확인합니다. `docs/reviews/` 아래 **신규 추가 파일 외의 변경**(수정, 삭제, 다른 경로)이 하나라도 있으면 멈추고 재검토합니다. 예외에 해당하더라도 최종 CI는 반드시 필요합니다.
4. build가 실패하거나 홈 선택/작성 테스트가 8/8에 못 미치면 멈춥니다.
5. 배포 대상이 웹 Hosting이 아니거나, 승인 범위 밖의 서비스·규칙·함수가 함께 배포되려 하면 멈춥니다.
6. 배포 후 운영 320px 관리자 화면에서 넘침이 재현되거나 홈 기능에 이상이 있으면 즉시 멈추고, 이전 릴리스로 롤백을 검토합니다.

※ 이 검토에서는 지시대로 파일, Git, 서비스, Slack을 수정하지 않았습니다. Slack 감사 채널 게시는 진행 측에서 이 판정 원문을 그대로 올려 주십시오.

## 실행 검증

웹 build61초 성공(합성 Firebase 환경값), frontend cwd에서 홈8/8통과. 최초 루트 cwd 테스트 실행은 tsx해결 실패로 중단되어 frontend cwd로 바로잡음. diff 검사 통과. 관리자320px 스크린샷을 직접 열어 브랜드·메뉴가 두 줄로 겹침 없이 표시됨을 확인. client/scroll305 일치.390px375/375,1280px1265/1265,일반320px305/305. 운영·물리실기기는 배포 후 별도.
