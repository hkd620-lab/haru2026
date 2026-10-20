독립 읽기 전용 설계/완료 검토. 파일 수정·외부 메시지·운영 API/데이터·PR/병합/배포 금지. 구현 대화는 제공하지 않습니다.
저장소: /private/tmp/haru-issue279-performance-20261019
기준 main: be7f9afee0f686c80d63728263242824893d4c9b
대상 HEAD: 3a3b81e8f5e70c7b7167c56f2a326fd5c351413a
실제 전체 diff: /private/tmp/haru-title-first-pass-review/diff.json (diff 문자열 원문).
요청: 제목 일괄 생성 1차 개선만 수정/검증. 유효한 사용자·AI 제목 보존, 비문자열 제목 처리, 요청 안의 동일 기록/접두어 중복 처리 방지. 동시 요청 잠금·강제 재생성·병합·배포는 미승인입니다.
검토 범위: functions/src/index.ts의 generateTitlesForAll 변경, functions/test/generateTitlesForAll.test.js, docs/reviews/2026-10-20-title-backfill-first-pass.
선행 진단/개선 범위(이 감사 브랜치의 원문; 제품 코드로 혼입하지 않음): https://github.com/hkd620-lab/haru2026/blob/57d61160/docs/reviews/2026-10-20-title-api-duplication-audit.md . 이 구현 건의 독립 검토는 첫 실행이며 이전 판정은 없습니다.
제품/시험 파일과 실제 diff를 직접 읽으세요. 제목 원값·updatedAt 보존, 안전한 타입 처리, 중복이 문서 단위로 구분되는지, AI 오류/무효 응답/저장 실패 후 재시작, 권한·count·모델·프롬프트·기존 공유 validator 유지, 시험 결함 탐지력을 확인하세요. 빌드로 재생성된 기존 추적 lib 파일의 광범위 드리프트를 복구하고 소스만 포함한 판단과 배포 제한도 확인하세요. 작업 규모·멈춤 조건을 판별하고 승인/수정 후 승인/재설계 중 하나를 명시하세요. 차단 지적에는 파일/행과 재현 근거를 제시하세요.
AGENTS.md와 docs/HARU2026_Slack_운영정책.md 8.1절을 따르되 이 판정은 PR CI/자동 리뷰/운영 E2E/병합·배포 승인이 아닙니다. 도구는 읽기 전용이므로 시험/빌드 직접 실행은 불가하며 확인의 한계를 명시하세요. 사용자가 제외한 동시 요청 잠금·강제 재생성을 이번 구현의 필수조건으로 요구하지 마세요.
