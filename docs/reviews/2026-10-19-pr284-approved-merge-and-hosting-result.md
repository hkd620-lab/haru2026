# PR #284 승인된 병합·Hosting 자동배포 결과

## 판정과 승인 범위

**✅ 완료 — 허대표님이 요청한 PR #284 병합과 Hosting 자동배포 완료.**

사용자 원문: “PR #284 병합하고 Hosting 자동배포까지 진행해.” 이 지시에 따라 해당 PR의 main 병합과 Hosting live 자동배포만 진행했다. Functions·Rules·운영 데이터·추천 정책 변경은 없다.

## 병합·검토·배포 근거

- [PR #284](https://github.com/hkd620-lab/haru2026/pull/284): **MERGED**, 2026-10-19T09:24:14Z (18:24:14 KST).
- 병합 SHA: **`9141f7f37fa9ff7e41baae977f9a594de649d603`**. 부모는 기존 main `4433a043…`와 PR HEAD `68500994…`다.
- 병합 트리와 PR 최종 HEAD 트리 모두 `a7a15fabebf4e21210cc8d0b6372f58a373de6a0`로 동일.
- 병합 diff는 추천 시험 1파일 수정과 새 검토 문서·증거 파일 추가뿐이다. `frontend/src`, `frontend/public`, package/lockfile, `firebase.json`, `.firebaserc`는 기존 main과 동일하다.
- 병합 전: [Codex 실행1 지적 없음](2026-10-19-pr284-codex-1-index.md), [독립 Claude 승인·승인 유지](2026-10-19-pr284-independent-review-and-preview.md), 최종 PR CI 성공 재확인. 검토 후 20항목 모두 `A docs/reviews/…`인 기록 전용 예외도 재확인했다. 로컬 추천40+등록부7 통과·웹 빌드 성공·변이7종 검출 근거는 기존 기록 그대로다.
- ready 전환 자동 Codex 실행2는 최신 PR HEAD `68500994…`에서 **지적 없음**으로 병합 후 완료했다. [새 실행 색인](2026-10-19-pr284-codex-2-index.md)에 시각·HEAD·결과 원문을 별도로 보존했다.
- Hosting 자동배포 [run39229796811](https://github.com/hkd620-lab/haru2026/actions/runs/39229796811): **SUCCESS**, 실행 HEAD는 병합 SHA `9141f7f3…`다. 2026-10-19T09:26:05Z 완료.
- Firebase 프로젝트 `haru2026-8abb8`, 사이트 `haru2026-8abb8`, 채널 **live**.
- live 버전 **`eaa5d5376a29cab2`**, 상태 **FINALIZED**, releaseTime **2026-10-19T09:26:00.708Z (18:26:00.708 KST)**.
- GitHub 배포 action 로그의 `hosting: projects/***/sites/***/versions/eaa5d5376a29cab2`와 Firebase live 채널 버전이 일치한다. 이전 live는 `0f6ee81269df92b9`, releaseTime07:46:44.355Z였다.
- [선별한 배포 메타데이터](2026-10-19-pr284-deployment-evidence/hosting-release.json), [Actions 실행·단계 결과](2026-10-19-pr284-deployment-evidence/deploy-run.json).

## 운영 확인과 한계

2026-10-19T09:28:47Z 읽기 전용 HTTP 점검:

| 대상 | 결과 |
| --- | --- |
| https://haru2026.com/ | HTTP200, text/html |
| https://haru2026-8abb8.web.app/ | HTTP200, text/html, 사용자 도메인과 HTML SHA-256 동일 |
| https://haru2026.com/assets/index-8X0CNXeW.js | HTTP200, text/javascript |

[상태·해시·응답 크기 원문](2026-10-19-pr284-deployment-evidence/production-smoke.json).

로그인·기록 저장·AI 호출·실기기 브라우저 전체 E2E는 하지 않았다. 이번 변경은 시험·문서뿐이며, 위 완료 판정은 승인된 병합·Hosting 배포와 HTTP 점검 범위다. 새 추천 동작이나 사용자 저장 흐름을 변경·검증했다고 확대하지 않는다.

## 보존·후속

- 원래 Developer 작업본의 브랜치·기존 작업을 보존했다. 임시 작업본에서는 병합된 main 기반 별도 `codex-pr284-deployment-evidence` 브랜치에 이 새 기록만 추가해 push한다. 기록 push를 위해 main에 직접 커밋하거나 추가 PR·배포하지 않는다.
- Functions 배포 없음. 리전 `asia-northeast3`, Firestore `users/{uid}/records/{date}`, Rules·결제·인증·환경변수·API 비용 정책 유지. 운영 데이터 변경 없음.
- #279는 OPEN 유지. 시험 보강은 이번 PR로 반영됐으며 장문 재계산 비용 계측/개선 범위와 추천 정책 결정이 남아 있다. 기존 PR270 수정 후 승인 누적1회 유지.
- 이 작업의 추가 실행은 필요 없다. 다음 독립 작업을 시작한다면 이 결과와 #279 남은 항목을 읽고 범위를 정한다.

작업 난이도: **5.5 중간**.
