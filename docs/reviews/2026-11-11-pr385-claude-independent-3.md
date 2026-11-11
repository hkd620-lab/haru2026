# PR #385 독립 Claude 최종 코드 재검토 — 2026-11-11 KST

- 대상 HEAD: `ae791c5f73f91696dd679031cb15956731da7726`
- 대화 원본: https://claude.ai/chat/f7186a45-47f9-4f57-909e-7f2f07b9683e
- 이전 질문·결과 원문: [1차](./2026-11-11-pr385-claude-independent-1.md), [2차](./2026-11-11-pr385-claude-independent-2.md)

## 질문 원문

> 최종 코드 재검토 요청입니다. 위의 1차 `수정 후 승인` 원문과 2차 `승인` 원문을 모두 함께 보고, 최신 PR #385 HEAD ae791c5f73f91696dd679031cb15956731da7726의 추가 변경을 직접 확인해 주세요. 별도 CC 독립 검토가 https://github.com/hkd620-lab/haru2026/pull/385#issuecomment-6794988020 에서 발견한 낮은 위험 1건: /sayu → /login → 홈으로 이탈 → 랜딩의 소셜 로그인 버튼을 사용하면 오래된 복귀 경로가 남는 문제. 이번 커밋은 LandingPage.tsx의 Google·카카오·네이버 로그인 시작 직전에 clearProtectedPostLoginReturnPath()를 호출합니다. 변경 파일은 LandingPage.tsx 하나뿐입니다. 최신 코드에서 aiImportReturn 4/4, aiImport.policy 7/7, subscriptionDisplay, authCallback 정책 테스트와 자리값 env 웹 빌드가 통과했고, 최신 HEAD CI run 43016387954 성공, Codex 최신 HEAD 재검토는 지적 없음으로 완료됐습니다(https://github.com/hkd620-lab/haru2026/pull/385#issuecomment-6795220617). 2차 판정 뒤의 변경에서 새로운 문제나 기존 복귀 경로 회귀가 있는지 확인하고, 승인/수정 후 승인/재설계 중 하나로 판정해 주세요. 읽지 못한 근거는 한계로 구분하고 운영 E2E는 여전히 미확인으로 남겨 주세요. 파일 변경·배포·외부 메시지는 하지 마세요.

## 결과 원문 (최종 응답의 표시 텍스트)

판정: 승인. 승인 범위는 최신 HEAD ae791c5f의 코드 diff를 직접 읽은 코드 검토까지입니다. 운영 완료는 여전히 미확인입니다.

### 변경 확인 (36b91689 → ae791c5f)

- 변경 파일은 LandingPage.tsx 하나이고 git diff --check는 이상이 없습니다. 추가된 줄은 import 1줄과 호출 3줄입니다.
- clearProtectedPostLoginReturnPath()는 handleGoogleLogin(:320), handleKakaoLogin(:345), handleNaverLogin(:356)에서 호출됩니다. 세 곳 모두 인앱 브라우저 가드(guardInAppBrowserLogin) 통과 뒤이고 로딩 표시나 window.location.assign 이전입니다.
- 가드에서 걸려 외부 브라우저 안내가 뜨는 경우에는 지우지 않습니다. 로그인이 실제로 시작될 때만 지웁니다.
- 이전에 찾은 /sayu → /login → 홈 이탈 → 랜딩 소셜 로그인 경로는 이제 복귀 경로가 지워집니다. 새 HEAD에서 소셜 로그인 시작점은 LandingPage 4곳과 LoginPage 4곳뿐입니다. 랜딩의 이메일 로그인 버튼은 /login으로 가고, LoginPage의 마운트 시 정리(LoginPage.tsx:44-45)가 이미 처리합니다. 빠진 진입점은 없습니다.
- 회귀 없음입니다. 지우는 대상은 저장값이 /settings·/sayu일 때뿐이라 /ai-import#해시는 보존됩니다(2차에서 확인한 구현 그대로). /settings·/sayu 복귀 흐름, 정규화, AuthCallbackPage의 복귀 처리는 이번 커밋에서 건드리지 않았습니다.
- 랜딩은 로그아웃 상태의 홈이라 보호 화면 리다이렉트가 만든 복귀 경로를 여기서 지우는 것이 맞습니다. 정상 흐름(/sayu → /login → 로그인)은 랜딩을 거치지 않아 영향이 없습니다.
- 새 문제는 찾지 못했습니다.

### 직접 읽지 못한 근거 (한계)

- 이번에 인용하신 별도 CC 독립 검토 댓글(issuecomment-6794988020)은 WebFetch가 rate limit으로 실패해 원문을 읽지 못했습니다. 지적 내용은 말씀해 주신 설명과 코드로 대조했습니다.
- CI run 43016387954와 Codex 최신 HEAD 재검토(issuecomment-6795220617)도 제가 직접 읽지 못했습니다. 테스트(aiImportReturn 4/4, aiImport.policy 7/7, subscriptionDisplay, authCallback)와 자리값 env 빌드도 CC 보고만 있고 제가 실행하지 못했습니다(의존성 설치 권한 거부).
- 8.1절 판정①(확정)은 CC가 위 CI·Codex 결과를 확인하고 필수 검증 로그를 PR에 첨부해야 성립합니다.
- 제 검토 원문은 docs/reviews/에 남기십시오. 이후 커밋이 검토 기록 추가뿐인지 git diff --name-status ae791c5f..HEAD로 확인하십시오.

### 비차단으로 남은 사항 (변동 없음)

1. OAuth 오류 후 재시도하면 복귀 경로가 사라집니다(AuthCallbackPage.tsx:88,97,142가 state 없이 /login으로 보냄). 홈으로 안전하게 떨어집니다.
2. LoginPage의 정리 useEffect와 LandingPage의 새 호출, SignedInRoute의 미인증 분기는 컴포넌트 수준 자동 테스트가 없습니다.
3. 로그인 직후 SPA 이동 경합(정적 분석상 안전, 브라우저 미검증), 미인증 계정의 설정·탈퇴 접근 정책 기록, 네이버 버튼만 큰 글자인 일관성은 그대로입니다.

### 운영 완료

병합, 배포 SHA, 운영 도메인 확인이 모두 없으므로 🔍 추가 E2E 필요입니다. 허대표님이 확인할 동작은 앞선 두 번의 목록과 같고, 이번 변경에 대해서는 두 가지를 추가합니다.

- /sayu에서 로그인 화면으로 갔다가 홈으로 나간 뒤 랜딩의 Google·카카오·네이버로 로그인하면 /sayu가 아닌 홈으로 가는지.
- 같은 방식으로 /sayu에서 바로 로그인하면 /sayu로 돌아오는지.

Sources: PR #385 HEAD ae791c5f 로컬 fetch와 diff(LandingPage.tsx, LoginPage.tsx 해당 부분).
