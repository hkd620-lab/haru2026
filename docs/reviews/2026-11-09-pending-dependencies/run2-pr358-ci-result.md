# 초안 PR #358 CI 결과 기록 (2026-11-09, CC 실행자)

- PR: <https://github.com/hkd620-lab/haru2026/pull/358> (draft, base `main`, head `codex-complete-pending-20261109`)
- 대상 커밋: `b38912e2` (CI merge 커밋 `f448ec1` = `b38912e2` into main `5f41cd7e`)
- 이 파일은 CI 결과 사실 기록이다. 승인 기록이 아니다.
- 원격 브랜치 이름: 원격에 `codex` 브랜치가 있어 `codex/complete-pending-20261109` push는 `remote rejected (directory file conflict)`. 로컬 브랜치명은 그대로 두고 원격 이름만 `codex-complete-pending-20261109`로 push했다.

## 1. Deploy to Firebase Hosting on PR / build_and_preview — 성공

run <https://github.com/hkd620-lab/haru2026/actions/runs/42547469764/job/128935472471>

- node v22.23.4, npm 10.9.9 (#331·#333·#335 실패 때와 같은 버전)
- `npm ci`: `added 835 packages, and audited 836 packages in 33s` — #331·#333·#335의 `Missing: react-is@16.13.1 from lock file` 오류 재발 없음
- `Firebase build environment validation passed.` → `✓ built in 27.96s`
- 이 빌드는 저장소 secrets(없으면 dummy)로 만든 **preview 채널** 빌드다. 라이브 배포가 아니다. 채널 `pr358-codex-complete-pendi`, 만료 2026-11-16T01:49:45Z.
- 참고: 같은 lock으로 로컬 npm 11.19.1은 825개를 설치했다. npm 10.9.9의 835개와 차이는 중첩 `react-is`·`@types/babel__*` 등 npm 버전 간 해석 차이로 보인다(정확한 목록은 비교하지 않음).

## 2. Functions sharp Linux check / linux_x64_node22 — 성공

run <https://github.com/hkd620-lab/haru2026/actions/runs/42547469759/job/128935472301>

- Node 22, npm 10.9.9, `PUPPETEER_SKIP_DOWNLOAD=true`
- `npm ci --no-audit --no-fund`: `added 742 packages in 9s`
- `npm ls sharp`: `sharp@0.35.5`, Linux 네이티브 패키지 확인 통과
- `npm run test:sharp-pipelines`: `tsc && …` 빌드 후 `# tests 14 / # pass 14 / # fail 0`

## 3. 아직 충족되지 않은 것

- functions export 목록 diff: 미실행(로컬 빌드 권한 거부, CI는 export 비교를 하지 않음)
- express·body-parser·qs(6.16)·follow-redirects를 쓰는 HTTP 함수의 동작 시험: 미실행
- frontend 관련 `frontend/test/*`: 세 패키지를 직접 쓰는 시험 없음, 실행 안 함
- Codex 리뷰: 이 기록 시점 PR에 리뷰·댓글 없음(draft). 요청하지 않았다
- 독립 Claude 검토: 미요청(별도 세션 담당)
- 로컬 CI 로그 사본: `/private/tmp/haru-deps-20261109/pr358-frontend-ci.log`, `pr358-functions-ci.log`
