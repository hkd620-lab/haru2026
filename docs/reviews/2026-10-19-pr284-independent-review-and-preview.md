# PR #284 독립 검토·프리뷰 결과

## 요청 범위와 현재 상태

허대표님 “다음 진행” 지시에 따라 #279 시험 보강의 초안 PR·프리뷰·정식 검토를 진행했다. 앞선 [시험 보강 기록](2026-10-19-issue279-recommendation-test-contract.md)은 당시 상태의 역사 기록으로 유지한다. PR·검토 미진행이라는 당시 기록을 사후 수정하지 않는다.

- PR **#284**, base `main`, head `codex-issue279-test-contract`, **OPEN/draft**.
- 최신 기능·시험 검토 HEAD: `d29558cc23b0a8fb3ad403d24b2e2a871c29717e`. 기준 main `4433a043265359f4446a5ffac9d93e942c50464c`.
- 이번 추가 변경은 새 검토 기록·원문·검증 로그뿐이다. 앱 소스·시험은 검토 HEAD 그대로다.
- CI/프리뷰 최초 실행 [39223694271](https://github.com/hkd620-lab/haru2026/actions/runs/39223694271): `build_and_preview` SUCCESS, 2026-10-19T08:35:39Z. `Deploy Preview` SUCCESS, 08:35:37Z.
- [프리뷰 생성 근거](https://github.com/hkd620-lab/haru2026/pull/284#issuecomment-6263122742): d29558c용 프리뷰 생성. 이는 운영 live 배포가 아니다.
- 최종 기록 커밋 push 후에는 최종 HEAD CI를 다시 확인하고 PR/Slack에 사실값을 기록한다.

## 독립 Claude 검토 원문

구현 대화 이력을 주지 않은 별도 Claude CLI 세션이며 기본 모델 옵션을 지정하지 않았다. 실제 응답 모델은 `claude-sonnet-5-5`다. Read/Glob/Grep만 제공했고 쓰기·쉘·MCP·게시 기능은 제공하지 않았다. 둘 다 exit0, `is_error:false`, permission_denials 없음이다. 시각은 출력 파일 생성/쓰기 시각으로 관측한 값이며 API 완료 시각으로 단정하지 않는다.

| 실행 | 시작 관측 UTC | 출력 완료 관측 UTC | 판정 원문 |
| --- | --- | --- | --- |
| 독립 1차 | 2026-10-19T08:34:51.236502Z | 2026-10-19T08:35:37.949307Z | `판정: 승인` |
| 보충 대조 | 2026-10-19T08:36:36.864200Z | 2026-10-19T08:36:58.840492Z | `판정: 승인 유지` |

- 1차 [질문 원문](2026-10-19-pr284-review-evidence/independent-1-prompt.md), [응답 원문](2026-10-19-pr284-review-evidence/independent-1-response.md), [CLI JSON 원문](2026-10-19-pr284-review-evidence/independent-1-result.json).
- 보충 [질문 원문](2026-10-19-pr284-review-evidence/independent-1-supplement-prompt.md), [응답 원문](2026-10-19-pr284-review-evidence/independent-1-supplement-response.md), [CLI JSON 원문](2026-10-19-pr284-review-evidence/independent-1-supplement-result.json).
- [실행 메타데이터](2026-10-19-pr284-review-evidence/independent-executions.json).

보충 이유: 1차가 지목한 PR270의 과거 문서 2개가 main에는 없었다. [기존 전체 승인 및 보충](https://github.com/hkd620-lab/haru2026/blob/3ae362fd/docs/reviews/2026-10-18-pr270-independent-full-approval-and-supplement.md), [독립 3회차 원문](https://github.com/hkd620-lab/haru2026/blob/3ae362fd/docs/reviews/2026-10-15-pr270-claude-independent-3-result.md)을 해당 ref에서 원문 그대로 내려받아 보충했고, 직전 질문·결과 원문도 함께 전달했다. 승인 결과만 선택하거나 앞선 실행을 삭제하지 않았다. PR270 수정 후 승인 누적1회 유지, PR284 수정 후 승인 추가0회다.

검토자는 규모 **소**, 8.1절 멈춤 조건 **해당 없음**으로 확인했다. 시험·빌드를 직접 실행한 검토는 아니며 정적 검토의 한계를 원문에 명시했다. 1차 비차단 지적은 기존 기록의 시점 설명과 검증 로그 보존이다. 이 보조 기록에서 시점을 정정하고 아래 실행 로그를 추가해 처리한다. 앱·시험 수정 요청은 없었다.

## Codex 및 로컬 검증

- [Codex 실행1 색인](2026-10-19-pr284-codex-1-index.md): 최신 검토 HEAD에 지적 없음으로 완료.
- PR 본문에 시험·빌드 명령과 결과를 첨부했다. CI는 추천 시험을 실행하지 않으므로 로컬 시험 결과와 구별한다.
- [로컬 시험 로그](2026-10-19-pr284-review-evidence/local-tests.log): 추천40 + 등록부7 = **47 pass / 0 fail / 0 skip**.
- [로컬 빌드 로그](2026-10-19-pr284-review-evidence/local-build.log): **exit0**. 합성 Firebase placeholder 환경변수로 실행한 컴파일 검증이며 운영 E2E가 아니다.
- [변이·빌드 실행 명령 원문](2026-10-19-pr284-review-evidence/local-verification-command.py). 경로는 실행 당시 임시 작업본과 로그 위치 그대로다. 신규 실행용 앱 기능이 아니다.
- 변이7종 로그: [strong2](2026-10-19-pr284-review-evidence/mutation-strong2.log), [strong4](2026-10-19-pr284-review-evidence/mutation-strong4.log), [weak0](2026-10-19-pr284-review-evidence/mutation-weak0.log), [weak2](2026-10-19-pr284-review-evidence/mutation-weak2.log), [불안감소](2026-10-19-pr284-review-evidence/mutation-suffix-anxiety.log), [걱정스럽다고](2026-10-19-pr284-review-evidence/mutation-suffix-worry.log), [걱정돼요요](2026-10-19-pr284-review-evidence/mutation-suffix-repeat.log). 각각 의도한 시험 AssertionError·exit1을 확인하고 원래 소스로 복원한 뒤 47개 재통과.
- 실행 `.log` 파일은 git 공백 검사를 위해 줄 끝 공백만 제거했다. 검토 질문·응답 Markdown/CLI JSON 원문은 변형하지 않았다.

## 남은 경계

- #279는 OPEN 유지. 장문 성능·추천 정책은 별도 후속이다.
- **main 병합·운영 Hosting/Functions/Rules 배포는 하지 않는다.** 초안 PR을 유지하며 최종 CI 및 검토 기록만 완성한다. 자기 승인·자동 병합 없음.
- Firestore `users/{uid}/records/{date}`, Functions `asia-northeast3`, 환경변수·결제·인증·Rules·AI 호출량·운영 데이터 변경 없음.
- 검토 기록 전용 예외는 필터 없이 `git diff --name-status d29558cc..HEAD`의 **모든 항목이 A이고 docs/reviews/ 아래**인지 확인한다. 최종 CI는 그 기록 커밋까지 포함해 통과해야 한다.

작업 난이도: **5.5 중간**.
