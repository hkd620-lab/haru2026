# haru2026 포도송이 로고 교체 검증

- 기준 구현 HEAD: `b147953b4e9b8d046e7b1b477712a7a631de35c6`
- 브랜치: `codex-haru2026-grape-brand` (원격 `codex` 브랜치와 directory/file conflict로 `codex/` 접두사를 사용하지 못함)
- PR: https://github.com/hkd620-lab/haru2026/pull/356 (base main, 초안)
- 대표 결정: https://harulab-hq.slack.com/archives/C0C1LQ394JY/p1794052212306259

## 확인 결과

- `git diff --check` 통과.
- `cd frontend && npm run build`: Firebase 환경변수 없는 첫 실행은 prebuild에서 중단. QA용 가짜 Firebase 값으로 최종 재실행 통과. 실제 운영 환경값·배포물 아님. 기존 Vite·청크 크기·동적 import 경고 유지.
- `node test/shareImageMeta.policy.test.cjs`, `node test/loginPerformanceCallsites.policy.test.cjs`, `node test/socialLoginReturnOrigin.policy.test.cjs`: 모두 통과.
- PNG 7종 시그니처·실제 치수(192,512,180,32,16,96,512) 확인.
- 로컬 최종 빌드를 Chrome에서 확인: 390px/1440px, `/`·`/login` 네 조합 모두 포도송이 이미지 로딩 성공, 가로 넘침 없음, pageerror 0. 실계정 로그인은 하지 않음.
- manifest any/maskable 4개 연결 및 실제 192/512 치수 확인. 기준 1024에서 포도알 외곽은 중심 반경 400px 이내로 안전 원 반경 409.6px 안에 배치.
- 실제 PNG 픽셀 확인: 설치 아이콘 비불투명 픽셀 0. 알림 배지는 투명 픽셀 존재·불투명 부분은 흰색(색상 픽셀 0).
- 배지 초기 렌더링 중 CSS 우선순위 문제를 발견해 `.art.badge` 선택자로 수정. 이전 빌드에 대한 첫 픽셀 검사는 실패했고, 수정 자산으로 최종 재빌드 후 검사 통과.
- 하루lab 호박 원본, v2 symbol SVG·512 PNG, 기존 공유 PNG의 origin/main 대비 바이트 동일 확인.
- 하루lab 호박 원본 SHA-256: `5394b762c3d9475ee07b6f8b2f11a5872b17a73702e4b1ce19c553adb5545bc8`.
- 변경 범위에 Functions·Rules·Firestore 경로·리전·결제·인증 정책·환경변수 변경 없음. 비밀값·개인정보 추가 없음.

## 독립 Claude 검토 시도

- 실행 대상: 위 구현 HEAD. 독립 CLI 세션, 읽기 전용 plan 모드, 1회 실행.
- 질문 원문: [prompt](2026-11-07-grape-brand-claude-b147953b-prompt.md)
- 실행 결과 원문: [raw JSON](2026-11-07-grape-brand-claude-b147953b-raw.json)
- 결과: `Failed to authenticate: OAuth session expired and could not be refreshed`. API 호출·검토 0회. 승인 판정이 아니며 통과로 간주하지 않는다.
- Codex PR 검토: 초안 PR 생성 직후 현재 리뷰 없음. 판정① 확정·병합·운영 배포하지 않음.

## 남은 범위

- 독립 검토·최신 PR CI·Codex 검토 확인 후 승인된 범위에서 병합·운영 배포.
- 로그인 후 홈·SAYU 실제 계정 화면, 실기기 PWA 신규 설치·기존 설치본 아이콘 갱신 및 실제 푸시 수신은 미검증.
- 새 파일명으로 캐시 구분. 기존 설치본 아이콘 갱신 시점은 OS·브라우저별 차이가 있으므로 즉시 바뀐다고 보장하지 않는다.
- 작업 난이도: 중간. 로컬 소스·필수 자산·필수 빌드 생성물은 worktree 정상 경로 유지. 별도 배포용 완성 산출물은 생성하지 않음.
