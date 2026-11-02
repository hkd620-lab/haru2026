# Preview 삭제 경로 확인

- 확인자: Codex 상위 작업자
- 검토 대상 HEAD: `748bacfcd4f0d4ff339b6658a1dd1ccf98cdcc59`
- Preview: https://haru2026-8abb8--pr323-codex-dev-console-cl-7xgvmfzi.web.app
- 방법: Codex in-app browser에서 각 URL 직접 진입 후 현재 URL과 접근성 트리 확인. `/bible` 진입 후 홈 랜딩 화면의 실제 렌더링도 screenshot으로 확인했다. 별도 이미지 파일은 저장하지 않았다.

| 진입 경로 | 실제 최종 경로 | 결과 |
|---|---|---|
| `/bible` | `/` | 홈 랜딩 렌더링 확인 |
| `/vocab` | `/` | 홈으로 이동 |
| `/asset-explorer` | `/` | 홈으로 이동 |
| `/dev/masterpiece-detective` | `/` | 홈으로 이동 |
| `/dev/hangul-word` | `/` | 홈으로 이동 |

로그아웃 상태의 읽기 전용 확인이다. 로그인·사용자 기록 저장·변경·삭제·AI 호출은 수행하지 않았다. 일반 계정의 세 형식 저장/재열기, 공용 영어일기·식물탐정의 운영 E2E는 이 확인으로 대체하지 않는다.
