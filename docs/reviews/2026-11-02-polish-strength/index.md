# 기록 AI 다듬기 약·강 — 검증·검토 기록

- 요구: 대표님이 확인한 예시 수준을 약으로 삼고, 강은 같은 사실과 이미 드러난 감정을 더 충분한 문장·문단으로 풀어 쓴다. 새 사실·감정·장면·비유·해석은 창작하지 않는다.
- PR: https://github.com/hkd620-lab/haru2026/pull/324
- 최신 구현 HEAD: `2e9334aea9193abceef69d4a45730a98e74d6ff1`
- 브랜치: `codex-polish-strength`
- 상태: 구현·로컬 검증·최신 구현 CI·Codex 자동 검토 완료. 독립 Claude 검토는 인증 실패로 미실행. main 병합·운영 배포·실제 AI 결과 E2E는 하지 않았다. 자동 판정①의 모든 조건을 충족했다고 선언하지 않는다.
- 난이도: 중간.

## 변경과 검증 범위

FormatModal 안내창과 SayuModal 다시 다듬기에 공통 약·강 선택 UI를 적용했다. 기본값은 약이다. strength 값에 따라 지시문만 달라지며 기존 BASIC/PREMIUM 모델 선택·호출 횟수·월 사용량 및 응답·저장 계약을 유지한다. 옵션 없는 기존 요청과 배뇨 수치 요약의 의료 안전 지시는 유지한다. 배뇨 수치 요약에는 선택 UI를 표시하지 않는다. 일반 기록의 약은 기존 맞춤법 교정에 그치지 않고 흐름과 표현을 정돈한다.

- Functions: `cd functions && npm run build` 성공. `node --test test/polishContent.test.js` 42/42 통과. export 선언 72개 동일. Firestore 경로·리전·Rules 변경 없음.
- 웹: lockfile 기준 `npm ci --no-audit --no-fund` 후 `npm run build` 성공(Vite 8.3.5). 실제 프로젝트 자격 증명 대신 빌드 검증용 Firebase 더미 환경값 사용. 최초 의존성 설치는 npm 캐시 샌드박스 쓰기 제한으로 실패했으며 기존 권한 절차에 따라 재시도해 완료했다.
- 웹: `node --import tsx --test test/polishCommentOptOut.test.mjs test/formatPolishRequest.test.mjs test/recordPhotoPolicy.test.mjs` 25/25 통과. 합계 67건 통과.
- 실제 FormatModal/SayuModal을 기존 격리 fixture의 모의 Firebase/AI SDK로 실행: 약 기본 선택, 강 선택, 강 표시 미리보기, 저장, 원본 탭의 강 선택 및 다시 다듬기 성공을 확인했다. 390px iframe에서 라디오 두 개·설명·실행 버튼이 표시되고 선택되는 것을 확인했다.
- mock SDK가 현재 소스의 getDocsFromServer/runTransaction import를 해석하도록 보완했다. transaction은 실행을 거절하며 운영 접근은 없다.
- Functions 빌드에서 재생성된 기존 stale 추적 lib/index.js, lib/snsToDiary.js는 요청 범위 밖의 대량 차이가 있어 커밋에서 제외하고 빌드 전 내용으로 복원했다. firebase.json의 Functions predeploy 빌드는 유지된다.
- `git diff --check` 통과. 실제 모델 출력의 풍성함 차이·사실 보존은 아직 시험하지 않았다. 모의 결과를 실제 생성 품질 증거로 삼지 않는다.

## Codex 자동 검토 색인

1. 최초 자동 실행: 대상 `1cac3067d8925ea3c07fea52f2920523833875cf`. 요청 댓글 없음(PR opened 자동). PR 생성 2026-11-02 11:04:12 UTC. summary에 관측한 시작 11:04:19.668022 UTC, 완료 11:05:28.939558 UTC. 관측 결과 completed, has_any_findings=false, has_unresolved_findings=false. 별도 review ID는 반환되지 않았으며 무지적 summary 댓글 ID는 6575540892이다. 결과 없이 대체된 실행이 아니다.
2. 수동 최신 구현 검토: 대상 `2e9334aea9193abceef69d4a45730a98e74d6ff1`. 요청 시각 2026-11-02 11:11:14 UTC. [요청 원문](https://github.com/hkd620-lab/haru2026/pull/324#issuecomment-6575674636). 정확한 시작 시각은 별도 보존되지 않아 확인 불가. 완료 11:12:46.318358 UTC. 결과 completed, has_any_findings=false, has_unresolved_findings=false. 별도 review ID 없음(무지적 summary만 반환), summary 댓글 ID 6575540892. 필수 수정 지적·반영 커밋 없음.

[최신 summary 원문](https://github.com/hkd620-lab/haru2026/pull/324#issuecomment-6575540892). 동일 summary 댓글이 최신 실행 결과로 갱신되므로 최초 실행 시간·결과는 당시 관측값을 위에 분리 보존했다. 최신 GitHub 원문은 github-comments-observed.json, github-reviews-observed.json, github-status-observed.json에 보관한다.

## 독립 Claude 검토 실행 기록

- 대상은 두 시도 모두 `1cac3067d8925ea3c07fea52f2920523833875cf`. 별도 CLI 새 세션, 도구 비활성, 세션 저장 비활성, 패치만 전달한 읽기 전용 검토를 요청했다.
- 질문 원문: claude-request-1cac3067.txt. 두 시도는 같은 질문이다. 정확한 요청 UTC 시각은 별도 계측하지 않아 확인 불가(2026-11-02 실행).
- 1차 샌드박스 실행 결과 원문: claude-attempt1-1cac3067.json.
- 2차 기존 인증 갱신을 허용하는 권한 절차 후 재시도 결과 원문: claude-attempt2-1cac3067.json.
- 두 결과 모두 is_error=true, `Failed to authenticate: OAuth session expired and could not be refreshed`. 검토 본문·승인·수정 후 승인·재설계 판정은 생성되지 않았다. 검토 통과로 처리하지 않는다. 최신 구현도 독립 Claude 검토를 받지 않았다.

## GitHub·Slack 대조와 저장

- 최신 구현 CI: build_and_preview / linux_x64_node22 / Deploy Preview SUCCESS. PR preview는 운영 서비스 배포와 구별한다. 근거 URL·SHA·시각은 github-status-observed.json 참조.
- Slack 관련 검색: `in:haru2026-개발 "강약" after:2026-11-01`, `in:haru2026-개발 "324" after:2026-11-02` 모두 결과 없음. 기존 성공 증거를 무효화하지 않으며 Slack 기록은 확인 필요로 남긴다. Slack에 게시했다고 주장하지 않는다.
- 화면·최종 웹 빌드 로그 보관: `/Volumes/LaCie/Mac_작업/완료자료/HARU2026/2026-11-02_AI다듬기_약강_PR324`.
- 연결된 LaCie UUID `06827F85-BF9F-465C-9C30-E39085839975` 확인 후 새 폴더에 복사. 두 파일의 SHA-256 원본/복사본 일치. 검증_SHA256.json 보존. 내부 임시 원본은 삭제하지 않았다.

## Slack 기록용 확정 요약

기록 AI 다듬기 약·강 선택 구현. 신규 기록과 다시 다듬기에 적용, 약은 흐름 정돈·강은 원문 사실과 감정을 풍성한 서술로 풀어 쓰도록 지시. PR #324, 구현 2e9334ae. 웹/Functions 빌드 및 관련 시험 67건 통과, 최신 구현 CI·Codex 무지적 검토 완료. 독립 Claude 검토는 OAuth 만료로 미실행. main 병합·운영 배포·실제 모델 응답 E2E는 하지 않음.
