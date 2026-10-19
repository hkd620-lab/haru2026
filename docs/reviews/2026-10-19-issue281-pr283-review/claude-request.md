독립 설계·완료 검토. 파일 수정·Bash·네트워크·다른 에이전트 호출 없이 Read/Glob/Grep만 사용하세요. 저장소·PR·근거를 직접 대조하고 한국어로 반환하세요.
대상 hkd620-lab/haru2026 초안 PR283 (https://github.com/hkd620-lab/haru2026/pull/283), #281 시험 계약 검증. main75a6d8490262babe98e5d67fd2c7800b43548894, 검토HEAD5fc95117490a9d8fd0a080e1433c9dbf0909114b, 코드5640e0d7e3381eec6c00e11408b6f3864356b4a8. cwd 저장소는 이 HEAD입니다.
이 #281 건의 이전 독립 검토 실행/판정은 없습니다(수정후승인 누적0). PR270·282는 다른 건이며 그 횟수를 상속하지 않습니다.
허용: 시험1파일 및 검증기록, 초안 PR/프리뷰 자동배포. 앱코드·Rules·인증정책 수정, main병합·운영배포 금지. PR270·282/#280완료 유지.

반드시 읽을 근거:
1. /private/tmp/haru-issue281-pr-review-20261019/test.diff 및 pr-body.md.
2. frontend/test/loginProviderStorage.policy.test.cjs 전체.
3. frontend/src/app/contexts/AuthContext.tsx의 mapUser/rememberLoginProvider 및 실제 onSnapshot effect 전체, frontend/src/app/utils/loginProvider.ts, AuthCallbackPage.tsx 관련 기억함수 호출. 앱은 읽기전용 대조 대상입니다.
4. docs/reviews/2026-10-19-issue281-provider-contract-test-fix.md 및 evidence 디렉터리: 로그·execution.json·mutation-source.md·build-summary.json. 실행기 원문은 mutation-source.md에 있습니다(다른 외부 경로를 읽을 필요 없음).
5. docs/HARU2026_Slack_운영정책.md 8.1, CLAUDE.md 멈춤조건.

확인: 하네스가 실제effect/cleanup/함수를 올바르게 추출하고 동작을 복사해 거짓통과시키지 않는지; UID캡처 이후user객체변경·다른authUID/로그아웃/세대/cleanup·캐시/대기쓰기·setter가드 시험의 의미; 초기Firebase우선과 스냅샷로컬우선의 구분; 별칭정규화/폴백/UID별저장·저장소거부; 기존14개 정책단언 유지; 테스트가 앱계약의 실제 회귀를 검출하는지; 변이12종 및 최초앵커오류의 제외기록과 실제DOM/StrictMode/OAuth/SDK/Rules/시간경과 미검증 한계를 정확히 표현하는지; 범위·되돌림.
판정 '승인'/'수정 후 승인'/'재설계' 중 하나, 근거·발견사항(우선순위·파일·라인), 작업규모 소/중/대, 멈춤조건 해당여부, 운영E2E 필요여부와 범위를 제시하세요. 독립승인이 CI/Codex완료나 main병합/운영배포 승인을 대신하지 않음을 명시하세요. 직접 확인못한 것은 못했다고 하세요. 무관한 범위확장을 요구하지 마세요.
