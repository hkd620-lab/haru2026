# PR #356 검토·병합 준비 기록

- 최신 검토 대상 HEAD: `16862b4191556cd980508dae6926dd05f812f311`
- 대상 main: `a704984c1a0c2c51b5ef13127f920dc03fae1c22`
- 허대표님이 이 채팅에서 검토 후 PR #356 병합·운영 배포, 실제 서비스 로고·PWA 확인, Slack 기록을 명시적으로 승인했다.
- Codex 1차 P2를 `16862b41`에서 수정. [1차 색인](2026-11-07-pr356-codex-8bc4c321-index.md), [최종 재검토 색인](2026-11-07-pr356-codex-16862b41-index.md).
- Codex 최종 원문: `Codex Review: Didn't find any major issues. You're on a roll.`
- 독립 Claude 최종 판정 원문: **최종 판정: 승인**. [결과 전문](2026-11-07-pr356-claude-16862b41-reauth-result.md), [JSON 원문](2026-11-07-pr356-claude-16862b41-reauth-raw.json).
- Claude 참고 의견 2건은 비차단 지적이다. CLAUDE.md 기존 절 갱신은 대표 결정에 맞춰 모순을 줄이기 위한 절차 예외였음을 Slack에 기록한다. manifest 소개 문구의 호박 비유 제거는 하루lab과 앱 식별을 구분하는 방향으로 유지한다. 기존 랜딩 브랜드 스토리와 호박 원본은 보존한다.
- 최근 독립 검토는 읽기 전용 별도 CLI 세션에서 수행됐으며 파일 변경 없음. 이전 인증 실패 실행에는 승인 판정이 없었고, 이후 검토자에게 이전 실패 원문을 모두 제공했다.
- 인증 복구 후 실제 검토 결과는 승인이다. 검토 규모는 중규모 이하, 멈춤 조건 없음으로 판정. 홈 로고 변경 및 운영 병합·배포는 대표가 명시 승인한 범위이다.

## 실행 이력

- `2026-11-07-grape-brand-claude-b147953b`: 원문 저장 시각 2026-11-07T12:00:57.593311+00:00, is_error=True, [질문](2026-11-07-grape-brand-claude-b147953b-prompt.md) · [결과 원문](2026-11-07-grape-brand-claude-b147953b-raw.json).
- `2026-11-07-pr356-claude-8bc4c321`: 원문 저장 시각 2026-11-07T12:21:55.763043+00:00, is_error=True, [질문](2026-11-07-pr356-claude-8bc4c321-prompt.md) · [결과 원문](2026-11-07-pr356-claude-8bc4c321-raw.json).
- `2026-11-07-pr356-claude-16862b41`: 원문 저장 시각 2026-11-07T12:24:53.771316+00:00, is_error=True, [질문](2026-11-07-pr356-claude-16862b41-prompt.md) · [결과 원문](2026-11-07-pr356-claude-16862b41-raw.json).
- `2026-11-07-pr356-claude-16862b41-reauth`: 원문 저장 시각 2026-11-07T12:33:04.609870+00:00, is_error=False, [질문](2026-11-07-pr356-claude-16862b41-reauth-prompt.md) · [결과 원문](2026-11-07-pr356-claude-16862b41-reauth-raw.json).

## 검증과 배포 범위

- 프론트 `npm run build`는 QA 환경값으로 통과한 기존 구현 검증을 보존한다. 이후 앱 구현 변경은 없고 SAYU 테스트 기대값만 수정했다.
- 최신 검토 HEAD에서 SAYU mobile reading UX, share image meta, login performance callsites, social login return origin 검사 4종 재실행 통과.
- 검토 HEAD의 CI: https://github.com/hkd620-lab/haru2026/actions/runs/42372323042 성공.
- 뒤따르는 커밋은 `docs/reviews/` 새 파일 추가만 하며, 필터 없이 `git diff --name-status 16862b41..HEAD`의 모든 상태가 A인지 확인한다. 최종 HEAD의 CI는 병합 전에 따로 확인한다.
- 배포 대상은 Firebase 프로젝트 `haru2026-8abb8`의 웹 Hosting만이다. 기존 main push GitHub Actions로 배포한다.
- Functions runtime·리전(`asia-northeast3`), Firestore `users/{uid}/records/{date}`, Rules·Storage ACL·환경변수·결제·인증 변경 없음.
- 배포 후 운영 HTML·manifest·PNG 크기/해시와 공개 화면 로고를 확인한다. 실계정 홈/SAYU·실기기 설치 갱신·푸시 수신의 검증 한계는 별도로 유지한다.
