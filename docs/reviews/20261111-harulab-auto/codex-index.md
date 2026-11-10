# harulab 자동 분류 검토 기록

대상 PR: https://github.com/hkd620-lab/haru2026/pull/371

1. 자동 실행(PR 생성), 대상 910b6633ab3d7e1adc6469db162058e03eea4fae, 요청 시각 2026-11-10T21:24:29.768209Z(시작), 완료 2026-11-10T21:26:32.798724Z, 지적 없음. 결과 원문 요약 댓글(같은 댓글이 후속 실행으로 갱신됨): https://github.com/hkd620-lab/haru2026/pull/371#issuecomment-6779647985 . 당시 원문은 codex-first-snapshot.json 참고. 별도 PR review ID 없음, 코드 댓글 없음.
2. 재검토 요청: https://github.com/hkd620-lab/haru2026/pull/371#issuecomment-6779866361 (2026-11-10T21:34:53Z). 대상 0a61166118d3ac40ddc5070e8ecfdc6ea4c8b94a, 시작 2026-11-10T21:35:04.031702Z, 완료 2026-11-10T21:37:12.684574Z. 지적 없음. 결과 ID6779914286: https://github.com/hkd620-lab/haru2026/pull/371#issuecomment-6779914286 . 별도 PR review ID 없음. 코드 댓글 없음.

독립 Claude 검토 1~3: 각 prompt/raw/meta/err 전체 보관. 모든 판정 승인. 1차4a36ecb7, 2차910b6633, 최종0a611661. 2차 권고 E(분류 개수 문구)는0a611661로 해결, 3차 확인. A/B는 기존 JSON 크기 예약 처리와 프롬프트 판 기록에 관한 비차단 권고로 이번 범위 외, 중복키 보존을 우선한다. 모델 정확도는 오프라인 가짜 응답 시험으로 주장하지 않는다.

검증: Functions build 성공; 기존 분류/전송/합성83건; 자동 분류13건; 폴더/보류/기존 분류/한국어/트리거74건 별도 성공; 최종 보류목록6건 성공. Frontend build 성공(운영 Firebase 공개 구성 사용), test:ai-import의7+25+4건 성공. 초기 환경 미설정 build와 tsx 없는 직접 일괄 테스트는 구성 문제로 실패했고 정식 스크립트/운영 공개 환경으로 재실행해 통과했다. Functions source index.ts diff 없음(export 목록 동일), 경로/리전 유지.

현재 사용자 승인: 앞으로 수집하는 현재 개발 앱 자료를 자동 harulab, 애매하면 보류, 수동 분류 보존. 기존 자료 재처리 없음. 모델/기록당 호출 수/일일 예산 그대로. 운영 배포 대상 classifyNewAiLibraryLog 하나, Hosting은 보류 안내 문구 한 줄. Rules·일괄 callable·회원탈퇴 변경/배포 없음.

Slack 공개 감사 검색(harulab, 2026-11-10 이후)은 관련 결과 없음. GitHub PR370 병합b7f9ec7c와 현재PR371 근거 대조. Slack 게시하지 않음.
