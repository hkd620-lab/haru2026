독립 설계·완료 검토를 수행하세요. 파일 수정, Bash, 네트워크, 다른 에이전트 호출 없이 Read/Glob/Grep만 사용하세요. 작업자의 대화 맥락은 제공하지 않습니다. 저장소·PR·근거를 직접 대조하고 검토 결과를 한국어로 반환하세요.

대상: hkd620-lab/haru2026 초안 PR #282 (https://github.com/hkd620-lab/haru2026/pull/282), #280 시험 하네스 정합성 복구.
기준 main a4d55436fee851f2b66f1ae86a62dcdeb21dcadf; 검토 HEAD 3fb503f3e280da4b05a2e1b765eb9b0ad29caf11; 코드 커밋92a7e4fcd58f030e265759613e0197e1d02f0f23.
이 #280 건의 기존 독립 검토 실행/판정은 없습니다(수정 후 승인 누적0). PR270의 판정 횟수를 상속하지 않습니다.

허용 범위: frontend/test/haruLawSave.test.cjs 시험 하네스만 수정, 검증 기록 추가, 초안 PR 및 프리뷰 자동배포. 앱 코드·Rules 수정, main 병합·운영 배포 금지. PR270 완료 유지. 다른 P3/#281 범위 제외.

현재 저장소가 대상 HEAD입니다. 다음을 읽고 근거를 검토하세요.
1. /private/tmp/haru-issue280-pr-review-20261019/test.diff (main 대비 코드 전체 diff)
2. frontend/test/haruLawSave.test.cjs 전체
3. frontend/src/app/assistants/haruLaw/HaruLawPanel.tsx 실제 useHaruLaw의 ref·effect·handleLawSave 및 frontend/src/app/pages/RecordPage.tsx의 관련 날짜 입력 구간. 실제 경로가 다르면 Glob으로 찾으세요. 앱 변경 제안은 이번 범위 밖입니다.
4. docs/reviews/2026-10-19-issue280-harness-contract-fix-and-verification.md 및 링크된 evidence 디렉터리 로그/메타데이터.
5. /private/tmp/haru-issue280-pr-review-20261019/pr-body.md
6. docs/HARU2026_Slack_운영정책.md 8.1 및 CLAUDE.md의 멈춤 조건.

확인: 추출 callback에 실제 인스턴스별 ref, 최신 state closure, 실제 cleanup을 제공하는지; duplicate save의 재렌더 전/후 동시성, 저장 완료 후 재진입 차단/날짜 변경 reset, unmount 후 이동 방지 및 인스턴스 독립성 검증이 타당한지; 테스트가 앱 계약과 동떨어진 거짓 통과를 만드는지; 기존 단언이 약화됐는지; 4개 memory mutation의 제한과 Rules1skip/Node26local/실제 DOM 및 운영 E2E 미실행을 정확히 표현하는지; 변경/배포 범위 준수와 되돌림이 적절한지.

결과에는 정확한 판정 문구 '승인' / '수정 후 승인' / '재설계' 중 하나, 근거 및 발견사항(우선순위·파일·라인), 작업 규모 소/중/대, 멈춤 조건 해당 여부, 운영 E2E 필요 여부와 범위를 포함하세요. 독립 검토 범위의 승인이며 Codex/CI 완료나 main병합/운영배포 승인을 대신하지 않는다는 점을 명시하세요. 직접 확인하지 못한 사실은 확인했다고 하지 마세요. 추측성 개선이나 무관한 범위 확장으로 승인을 막지 마세요.
