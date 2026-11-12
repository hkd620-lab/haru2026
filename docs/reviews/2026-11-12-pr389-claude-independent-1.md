# PR #389 독립 Claude 검토 1회 원문

- 대상 구현 HEAD: `71193ce60f2ebd8121bb231721fe7789fdf1fe71`
- 질문 시각: 2026-11-12T10:22:36.063Z
- 결과 시각: 2026-11-12T10:24:13.215Z
- 실행 환경: Claude Mac 앱 새 세션, Sonnet 5.5, 계획 모드
- 판정: 수정 후 승인 (1회)

## 질문 원문

독립 검토 요청입니다. 이전 작업 설명이나 판단은 받지 마세요. 저장소의 PR #389, 구현 커밋 71193ce60f2ebd8121bb231721fe7789fdf1fe71을 검토하세요. 현재 작업 트리에는 다른 미커밋 변경이 있으므로 그것은 무시하고 git show 71193ce 및 git diff 05ff2c8b..71193ce의 변경만 확인하세요. 관련 기존 구독 접근 코드와 docs/HARU2026_Slack_운영정책.md 8.1을 필요한 범위에서 읽으세요. 파일 수정, Git 변경, 외부 메시지는 금지합니다. 한국어로 1) 판정: 승인/수정 후 승인/재설계 중 하나 2) 구체적 보안·기능 지적과 파일 위치 3) 작업 규모와 8.1 멈춤 조건 해당 여부 4) 검토 커밋 및 근거를 작성하세요.

## 결과 원문

Now compare with the existing client entitlement logic and other server-side checks.
**1) 판정: 수정 후 승인**

접근 통제 구조와 보안 설계는 맞습니다. 다만 8.1이 요구하는 검증 근거가 저장소와 PR에 없어, 지금 상태로는 판정①의 조건을 채우지 못합니다. 코드를 바꾸는 수정은 필수가 아닙니다.

**2) 지적 사항**

잘 된 점:
- **직접 읽기 차단**: `firestore.rules`의 `funVideos`는 읽기·쓰기 모두 `isAdmin()`만 허용합니다. 구독자는 Functions(`getFunVideos`)로만 읽습니다.
- **쓰기 검증**: 필드를 `hasOnly`로 제한하고, 문서 ID와 `videoId`를 `^[A-Za-z0-9_-]{11}$`로 맞추며, `url` 일치와 `title` 1~100자를 검사합니다. 같은 `wildcard` 허용 규칙은 없습니다.
- **구독 검증**: `functions/src/funVideos.ts:7-16`은 plan이 basic/premium이고 status가 active/cancelled이며 `endDate`(또는 `expiresAt`)가 미래일 때만 통과시킵니다. 환불 처리 후 상태(`plan: 'free'`, `status: 'none'`)와 만료 상태는 거절됩니다. 기존 클라이언트 `useSubscription.ts`와 서버 판별 기준에 맞습니다. 목록은 최대 100건이고, 응답은 필요한 필드만 서버에서 다시 조립합니다.
- **SSRF 방지**: `functions/src/funVideoMetadata.ts`는 관리자 UID만 호출할 수 있습니다. `videoId`를 정규식으로 검증하고, 고정된 `youtube.com/oembed` 주소만 호출하며, 리다이렉트를 막고 8초 제한을 둡니다. 오류 내용은 응답에 담기지 않습니다.
- **XSS·링크**: 제목은 React 텍스트로만 출력합니다. 외부 링크는 `rel="noopener noreferrer"`입니다. 이번 변경에서 `users/{uid}/records` 경로는 건드리지 않았고, 리전은 `asia-northeast3`입니다.

수정이 필요한 점 (모두 근거와 증빙 문제):
1. **재현 가능한 Rules·Functions 테스트가 없습니다.** 8.1 판정①은 Rules 변경에 Rules 테스트, Functions 변경에 `functions/test/*`와 export 목록 diff를 요구합니다. 이 커밋에는 테스트 파일이 없습니다. PR 본문이 말하는 에뮬레이터 통합 시험은 `/private/tmp/haru-fun-function/integration.cjs`에 있어 저장소 밖입니다. 로그도 PR에 첨부되지 않았고 명령과 요약 문장만 있습니다. 기존 선례는 `functions/test/lawConsultCache.rules.emulator.test.mjs`입니다. 최소로 다음을 저장소 테스트로 두고 로그를 첨부해야 합니다.
   - 비관리자·구독자의 `funVideos` 직접 읽기 거절
   - 관리자 쓰기의 허용·거절 경계(필드·ID·URL·제목 길이)
   - `getFunVideos`의 구독 만료·free·비로그인 거절
   - export 목록 diff(새 export는 `getFunVideoMetadata`, `getFunVideos` 두 개)
2. **서버와 클라이언트·기존 서버의 `endDate` 판정이 다릅니다.** (`functions/src/funVideos.ts:11-15`) 신규 코드는 `endDate`가 없거나 해석되지 않으면 거절합니다. 클라이언트 `isExpired`와 기존 `epubExport.ts` 등은 이 경우를 만료로 보지 않고 통과시킵니다. 보안상 더 엄격한 쪽이라 문제는 아닙니다. 그래도 유료 문서에 `endDate`가 비어 있다면 화면은 열리는데 "목록을 불러오지 못했습니다"로 보일 수 있습니다. 운영 구독 문서에 `endDate`가 항상 ISO 문자열인지 확인해 PR에 한 줄 남기십시오. 이번 diff에서 확인한 쓰기 지점(`index.ts` 8535 등)은 모두 `toISOString()`입니다.
3. **낮은 등급 보강**:
   - `FunVideosPage.tsx`의 관리자 경로는 `item.data()`의 `url`을 그대로 `href`로 씁니다. 서버처럼 `videoId`로 URL을 재조립하면 안전합니다. 지금은 Rules가 `url` 값을 고정하므로 실제 취약점은 아닙니다.
   - `getFunVideos`는 호출마다 문서 읽기가 최대 101회입니다. 구독자가 반복 호출하면 읽기 비용이 늘어납니다. 호출 제한이나 App Check는 비용 정책 판단 사항입니다.
   - `rules`의 `createdAt`은 `request.time`으로 고정하지 않지만, 관리자 전용이라 영향은 작습니다.
   - 썸네일을 `i.ytimg.com`에서 직접 불러와 구독자 IP가 YouTube로 전달됩니다. CSP 제한은 없어 막히지 않습니다. 개인정보처리방침에 해당 외부 호출이 반영돼 있는지는 별도로 확인할 일입니다.
4. 참고로 `functions/lib`가 추적되고 있는데 이 커밋은 `functions/src`만 바꿨습니다. 배포 `predeploy`가 빌드하므로 막는 문제는 아닙니다. 관례(`chore: Functions 빌드 반영`)를 따를지 확인하십시오.

**3) 작업 규모와 8.1 멈춤 조건**
- **규모**: 대규모(새 기능)입니다. 새 화면·라우트·Functions 2개·Rules 변경이 함께 들어 있습니다.
- **멈춤 조건에 해당하는 항목** (자동 판정 대상이 아니므로 허대표님 승인 필요):
  - `frontend/src/app/App.tsx`에 라우트 추가: 라우터 파일 변경
  - 새 기능 착수
  - `firestore.rules` 변경과 그 배포
  - 전체 사용자 하단 메뉴에 항목 추가(`BottomNav.tsx`): 홈·네비게이션 영역 변경
  - 새 외부 호출(YouTube oEmbed)과 Functions 2개 신규 배포: 비용·호출량 증가 가능성
- **그 외**: 결제·인증 정책 변경이나 저장 경로 변경은 없습니다. 구독 문서는 읽기만 합니다.
- **결론**: 이 건은 CC 단독 판정①으로 병합·배포할 수 없고 허대표님 승인이 필요합니다. Rules 배포 전에 Functions를 먼저 배포하지 않으면 구독자 화면이 오류로 보일 수 있습니다. 배포 순서도 승인 때 함께 정해야 합니다.

**4) 검토 커밋과 근거**
- **검토 대상**: `71193ce60f2ebd8121bb231721fe7789fdf1fe71` (기준 `05ff2c8b`)
- **읽은 범위**:
  - `git show 71193ce`, `git diff 05ff2c8b..71193ce` 중 변경 7개 파일 전체
  - `useSubscription.ts`, `epubExport.ts`, `generateLawsuitClaimReason.ts`, `subscriptionHelpers.ts`, `subscriptionRefunds.ts`(환불 후 상태)
  - `firestore.rules` 전체 구조와 `firebase.json`
  - `docs/HARU2026_Slack_운영정책.md` 8.1
- **PR 상태**: PR 본문과 체크 상태도 읽었습니다. 체크 3건은 모두 SUCCESS이고, Codex는 `71193ce` 기준 지적 없음으로 표시됩니다.
- **한계**:
  - 에뮬레이터 시험은 직접 재실행하지 못했습니다.
  - 파일 수정, Git 변경, 외부 메시지는 하지 않았습니다.
  - 8.1에 따라 이 검토 원문은 `docs/reviews/`에 파일로 남겨야 합니다. 저는 수정할 수 없으므로 CC가 질문·결과 원문과 시각, 대상 HEAD를 함께 저장하고 Slack 감사 채널에 게시해야 합니다.
  - 지금까지 "수정 후 승인"은 1회입니다.
